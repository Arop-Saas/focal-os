import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "../trpc";

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

  invite: workspaceProcedure
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
      // Check if user already exists
      let user = await ctx.prisma.user.findUnique({
        where: { email: input.email },
      });

      // Check if already a member
      if (user) {
        const existing = await ctx.prisma.workspaceMember.findFirst({
          where: { workspaceId: ctx.workspace.id, userId: user.id },
        });
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This person is already a team member.",
          });
        }
      }

      // TODO: Send invitation email via Resend
      // For now, if user exists, add them directly
      // In production, implement invite token flow

      if (!user) {
        // Create placeholder user (they'll sign up later)
        const { createAdminClient } = await import("@/lib/supabase/server");
        const adminSupabase = await createAdminClient();

        const { data: authUser, error } = await adminSupabase.auth.admin.inviteUserByEmail(
          input.email,
          { data: { full_name: input.fullName } }
        );

        if (error) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        }

        user = await ctx.prisma.user.create({
          data: {
            supabaseId: authUser.user.id,
            email: input.email,
            fullName: input.fullName,
          },
        });
      }

      const member = await ctx.prisma.$transaction(async (tx) => {
        const m = await tx.workspaceMember.create({
          data: {
            workspaceId: ctx.workspace.id,
            userId: user!.id,
            role: input.role,
          },
        });

        await tx.staffProfile.create({
          data: {
            workspaceId: ctx.workspace.id,
            memberId: m.id,
          },
        });

        return m;
      });

      return member;
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
          data: { workspaceId: ctx.workspace.id, memberId, ...data },
        });
      }
    }),

  updateRole: workspaceProcedure
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

  remove: workspaceProcedure
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
});
