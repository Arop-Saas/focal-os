import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure, adminProcedure } from "../trpc";
import { randomBytes } from "crypto";
import { Resend } from "resend";
import { staffInviteEmail } from "@/lib/emails/staff-invite";

const resend = new Resend(process.env.RESEND_API_KEY);

export const staffRouter = router({
  list: workspaceProcedure
    .input(
      z.object({
        search: z.string().optional(),
        role: z
          .enum(["OWNER", "ADMIN", "MANAGER", "PHOTOGRAPHER", "EDITOR", "VA", "VIEWER"])
          .optional(),
        isActive: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.workspaceMember.findMany({
        where: {
          workspaceId: ctx.workspace.id,
          ...(input.role && { role: input.role }),
          ...(input.search && {
            user: {
              OR: [
                { fullName: { contains: input.search, mode: "insensitive" } },
                { email: { contains: input.search, mode: "insensitive" } },
              ],
            },
          }),
        },
        include: {
          user: true,
          staffProfile: {
            include: { availability: true },
          },
        },
        orderBy: { joinedAt: "asc" },
      });
    }),

  getById: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const member = await ctx.prisma.workspaceMember.findFirst({
        where: { id: input.id, workspaceId: ctx.workspace.id },
        include: {
          user: true,
          staffProfile: {
            include: {
              availability: { orderBy: { dayOfWeek: "asc" } },
              jobAssignments: {
                include: {
                  job: {
                    include: { client: { select: { firstName: true, lastName: true } } },
                  },
                },
                orderBy: { job: { scheduledAt: "desc" } },
                take: 10,
              },
            },
          },
        },
      });

      if (!member) throw new TRPCError({ code: "NOT_FOUND", message: "Staff member not found" });
      return member;
    }),

  invite: adminProcedure
    .input(
      z.object({
        email: z.string().email(),
        role: z
          .enum(["ADMIN", "MANAGER", "PHOTOGRAPHER", "EDITOR", "VA", "VIEWER"])
          .default("PHOTOGRAPHER"),
        fullName: z.string().min(2),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if already a member
      const existingUser = await ctx.prisma.user.findUnique({
        where: { email: input.email },
        include: { workspaces: { where: { workspaceId: ctx.workspace.id } } },
      });

      if (existingUser?.workspaces.length) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This person is already a team member.",
        });
      }

      // Invalidate any previous pending invites for this email+workspace
      await ctx.prisma.staffInvite.updateMany({
        where: {
          workspaceId: ctx.workspace.id,
          email: input.email,
          usedAt: null,
        },
        data: { expiresAt: new Date() }, // expire them immediately
      });

      // Create a new invite token (expires in 7 days)
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await ctx.prisma.staffInvite.create({
        data: {
          token,
          workspaceId: ctx.workspace.id,
          email: input.email,
          fullName: input.fullName,
          role: input.role,
          expiresAt,
        },
      });

      // Send branded invite email
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.scalist.io";
      const inviteUrl = `${baseUrl}/invite/${token}`;

      const { html, subject } = staffInviteEmail({
        fullName: input.fullName,
        workspaceName: ctx.workspace.name,
        workspaceLogo: ctx.workspace.logoUrl ?? null,
        brandColor: ctx.workspace.brandColor ?? "#1B4F9E",
        inviteUrl,
        role: input.role,
      });

      await resend.emails.send({
        from: process.env.EMAIL_FROM ?? `${ctx.workspace.name} <onboarding@resend.dev>`,
        to: input.email,
        subject,
        html,
      });

      return { ok: true };
    }),

  updateProfile: workspaceProcedure
    .input(
      z.object({
        memberId: z.string(),
        title: z.string().optional(),
        bio: z.string().optional(),
        skills: z.array(z.string()).optional(),
        serviceRegions: z.array(z.string()).optional(),
        maxJobsPerDay: z.number().min(1).max(20).optional(),
        isActive: z.boolean().optional(),
        payType: z.enum(["HOURLY", "SALARY", "PER_JOB", "COMMISSION"]).optional(),
        payRate: z.number().optional(),
        commissionRate: z.number().min(0).max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { memberId, ...data } = input;

      const member = await ctx.prisma.workspaceMember.findFirst({
        where: { id: memberId, workspaceId: ctx.workspace.id },
        include: { staffProfile: true },
      });

      if (!member) throw new TRPCError({ code: "NOT_FOUND" });

      if (member.staffProfile) {
        return ctx.prisma.staffProfile.update({
          where: { id: member.staffProfile.id },
          data,
        });
      } else {
        return ctx.prisma.staffProfile.create({
          data: { workspaceId: ctx.workspace.id, memberId, skills: [], serviceRegions: [], ...data },
        });
      }
    }),

  updateRole: adminProcedure
    .input(
      z.object({
        memberId: z.string(),
        role: z.enum(["ADMIN", "MANAGER", "PHOTOGRAPHER", "EDITOR", "VA", "VIEWER"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.prisma.workspaceMember.findFirst({
        where: { id: input.memberId, workspaceId: ctx.workspace.id },
      });
      if (!member) throw new TRPCError({ code: "NOT_FOUND" });
      if (member.isOwner) throw new TRPCError({ code: "FORBIDDEN", message: "Cannot change owner role." });

      return ctx.prisma.workspaceMember.update({
        where: { id: input.memberId },
        data: { role: input.role },
      });
    }),

  remove: adminProcedure
    .input(z.object({ memberId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.prisma.workspaceMember.findFirst({
        where: { id: input.memberId, workspaceId: ctx.workspace.id },
      });
      if (!member) throw new TRPCError({ code: "NOT_FOUND" });
      if (member.isOwner) throw new TRPCError({ code: "FORBIDDEN", message: "Cannot remove the workspace owner." });

      return ctx.prisma.workspaceMember.delete({ where: { id: input.memberId } });
    }),

  getAvailableForDate: workspaceProcedure
    .input(
      z.object({
        date: z.date(),
        durationMins: z.number().default(90),
        skills: z.array(z.string()).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const dayOfWeek = input.date.getDay();

      // Get staff with availability on this day
      const staff = await ctx.prisma.staffProfile.findMany({
        where: {
          workspaceId: ctx.workspace.id,
          isActive: true,
          availability: { some: { dayOfWeek, isAvailable: true } },
          ...(input.skills?.length && {
            skills: { hasSome: input.skills },
          }),
        },
        include: {
          member: { include: { user: true } },
          availability: { where: { dayOfWeek } },
          jobAssignments: {
            where: {
              job: {
                scheduledAt: {
                  gte: new Date(input.date.setHours(0, 0, 0, 0)),
                  lt: new Date(input.date.setHours(23, 59, 59, 999)),
                },
                status: { notIn: ["CANCELLED"] },
              },
            },
            include: { job: { select: { scheduledAt: true, estimatedDurationMins: true, propertyAddress: true } } },
          },
        },
      });

      // Filter by max jobs per day
      return staff.filter(
        (s) => s.jobAssignments.length < s.maxJobsPerDay
      );
    }),

  // ── Payout Calculator ─────────────────────────────────────────────────────

  payouts: workspaceProcedure
    .input(
      z.object({
        dateFrom: z.date(),
        dateTo: z.date(),
        staffId: z.string().optional(), // filter to one photographer
        statusFilter: z
          .array(
            z.enum([
              "CONFIRMED", "ASSIGNED", "IN_PROGRESS", "EDITING",
              "REVIEW", "DELIVERED", "COMPLETED",
            ])
          )
          .default(["DELIVERED", "COMPLETED"]),
      })
    )
    .query(async ({ ctx, input }) => {
      const { dateFrom, dateTo, staffId, statusFilter } = input;

      // Get all staff profiles with active assignments in range
      const staffProfiles = await ctx.prisma.staffProfile.findMany({
        where: {
          workspaceId: ctx.workspace.id,
          isActive: true,
          ...(staffId && { id: staffId }),
          jobAssignments: {
            some: {
              job: {
                scheduledAt: { gte: dateFrom, lte: dateTo },
                status: { in: statusFilter },
              },
            },
          },
        },
        include: {
          member: { include: { user: { select: { fullName: true, email: true } } } },
          jobAssignments: {
            where: {
              job: {
                scheduledAt: { gte: dateFrom, lte: dateTo },
                status: { in: statusFilter },
              },
            },
            include: {
              job: {
                select: {
                  id: true,
                  jobNumber: true,
                  propertyAddress: true,
                  scheduledAt: true,
                  totalAmount: true,
                  estimatedDurationMins: true,
                  status: true,
                },
              },
            },
          },
        },
        orderBy: { member: { user: { fullName: "asc" } } },
      });

      // Calculate payout per photographer
      const payouts = staffProfiles.map((sp) => {
        const jobs = sp.jobAssignments.map((a) => a.job);
        const jobCount = jobs.length;
        const totalRevenue = jobs.reduce((sum, j) => sum + (j.totalAmount ?? 0), 0);
        const totalMins = jobs.reduce((sum, j) => sum + (j.estimatedDurationMins ?? 90), 0);
        const totalHours = totalMins / 60;

        let payoutAmount = 0;
        let payoutBreakdown = "";

        switch (sp.payType) {
          case "PER_JOB":
            payoutAmount = (sp.payRate ?? 0) * jobCount;
            payoutBreakdown = `$${sp.payRate ?? 0}/job × ${jobCount} jobs`;
            break;
          case "HOURLY":
            payoutAmount = (sp.payRate ?? 0) * totalHours;
            payoutBreakdown = `$${sp.payRate ?? 0}/hr × ${totalHours.toFixed(1)} hrs`;
            break;
          case "COMMISSION":
            payoutAmount = ((sp.commissionRate ?? 0) / 100) * totalRevenue;
            payoutBreakdown = `${sp.commissionRate ?? 0}% × $${totalRevenue.toFixed(2)} revenue`;
            break;
          case "SALARY":
            payoutAmount = sp.payRate ?? 0;
            payoutBreakdown = `Salary (fixed)`;
            break;
        }

        return {
          staffId: sp.id,
          name: sp.member.user.fullName,
          email: sp.member.user.email,
          payType: sp.payType,
          payRate: sp.payRate,
          commissionRate: sp.commissionRate,
          jobCount,
          totalRevenue,
          totalHours: Math.round(totalHours * 10) / 10,
          payoutAmount: Math.round(payoutAmount * 100) / 100,
          payoutBreakdown,
          jobs: jobs.map((j) => ({
            jobNumber: j.jobNumber,
            propertyAddress: j.propertyAddress,
            scheduledAt: j.scheduledAt,
            totalAmount: j.totalAmount,
            estimatedDurationMins: j.estimatedDurationMins,
            status: j.status,
          })),
        };
      });

      const grandTotal = payouts.reduce((sum, p) => sum + p.payoutAmount, 0);

      return { payouts, grandTotal: Math.round(grandTotal * 100) / 100 };
    }),

  // ── Staff Availability ────────────────────────────────────────────────────

  getAvailability: workspaceProcedure
    .input(z.object({ staffId: z.string() }))
    .query(async ({ ctx, input }) => {
      const staff = await ctx.prisma.staffProfile.findFirst({
        where: { id: input.staffId, workspaceId: ctx.workspace.id },
        select: { id: true },
      });
      if (!staff) throw new TRPCError({ code: "NOT_FOUND" });

      const rows = await ctx.prisma.staffAvailability.findMany({
        where: { staffId: input.staffId },
        orderBy: { dayOfWeek: "asc" },
      });

      const DEFAULT = [
        { dayOfWeek: 0, isAvailable: false, startTime: "09:00", endTime: "17:00" },
        { dayOfWeek: 1, isAvailable: true,  startTime: "09:00", endTime: "17:00" },
        { dayOfWeek: 2, isAvailable: true,  startTime: "09:00", endTime: "17:00" },
        { dayOfWeek: 3, isAvailable: true,  startTime: "09:00", endTime: "17:00" },
        { dayOfWeek: 4, isAvailable: true,  startTime: "09:00", endTime: "17:00" },
        { dayOfWeek: 5, isAvailable: true,  startTime: "09:00", endTime: "17:00" },
        { dayOfWeek: 6, isAvailable: false, startTime: "09:00", endTime: "17:00" },
      ];

      return DEFAULT.map((def) => {
        const row = rows.find((r) => r.dayOfWeek === def.dayOfWeek);
        return row
          ? { dayOfWeek: row.dayOfWeek, isAvailable: row.isAvailable, startTime: row.startTime, endTime: row.endTime }
          : def;
      });
    }),

  saveAvailability: workspaceProcedure
    .input(
      z.object({
        staffId: z.string(),
        availability: z.array(
          z.object({
            dayOfWeek: z.number().int().min(0).max(6),
            isAvailable: z.boolean(),
            startTime: z.string().regex(/^\d{2}:\d{2}$/),
            endTime: z.string().regex(/^\d{2}:\d{2}$/),
          })
        ).length(7),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const staff = await ctx.prisma.staffProfile.findFirst({
        where: { id: input.staffId, workspaceId: ctx.workspace.id },
        select: { id: true },
      });
      if (!staff) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.prisma.$transaction(
        input.availability.map((day) =>
          ctx.prisma.staffAvailability.upsert({
            where: { staffId_dayOfWeek: { staffId: input.staffId, dayOfWeek: day.dayOfWeek } },
            create: { staffId: input.staffId, ...day },
            update: { isAvailable: day.isAvailable, startTime: day.startTime, endTime: day.endTime },
          })
        )
      );
      return { ok: true };
    }),
});
