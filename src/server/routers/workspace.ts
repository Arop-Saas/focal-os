import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, workspaceProcedure } from "../trpc";
import { slugify } from "@/lib/utils";

export const workspaceRouter = router({
  // Get current workspace
  getCurrent: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.prisma.workspace.findUnique({
      where: { id: ctx.workspace.id },
      include: {
        _count: {
          select: {
            members: true,
            clients: true,
            jobs: true,
            staff: true,
          },
        },
      },
    });
  }),

  // Create workspace (during onboarding)
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(100),
        slug: z.string().min(2).max(50).optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        timezone: z.string().default("America/New_York"),
        currency: z.string().default("USD"),
        country: z.string().default("US"),
        addressLine1: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        postalCode: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const slug = input.slug ?? slugify(input.name);

      // Check slug uniqueness
      const existing = await ctx.prisma.workspace.findUnique({
        where: { slug },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This workspace URL is already taken. Try a different name.",
        });
      }

      // Create workspace + add current user as owner
      const workspace = await ctx.prisma.$transaction(async (tx) => {
        const ws = await tx.workspace.create({
          data: {
            name: input.name,
            slug,
            phone: input.phone,
            email: input.email,
            timezone: input.timezone,
            currency: input.currency,
            country: input.country,
            addressLine1: input.addressLine1,
            city: input.city,
            state: input.state,
            postalCode: input.postalCode,
            trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
          },
        });

        // Add user as owner member
        const member = await tx.workspaceMember.create({
          data: {
            workspaceId: ws.id,
            userId: ctx.user.id,
            role: "OWNER",
            isOwner: true,
          },
        });

        // Create staff profile for owner
        await tx.staffProfile.create({
          data: {
            workspaceId: ws.id,
            memberId: member.id,
          },
        });

        // Mark onboarding as completed
        await tx.user.update({
          where: { id: ctx.user.id },
          data: { onboardingCompleted: true },
        });

        return ws;
      });

      return workspace;
    }),

  // Update workspace settings
  update: workspaceProcedure
    .input(
      z.object({
        name: z.string().min(2).max(100).optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        website: z.string().url().optional(),
        timezone: z.string().optional(),
        currency: z.string().optional(),
        addressLine1: z.string().optional(),
        addressLine2: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        postalCode: z.string().optional(),
        defaultTaxRate: z.number().min(0).max(100).optional(),
        invoicePrefix: z.string().max(10).optional(),
        brandColor: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.workspace.update({
        where: { id: ctx.workspace.id },
        data: input,
      });
    }),

  // Get workspace stats for dashboard
  getStats: workspaceProcedure.query(async ({ ctx }) => {
    const workspaceId = ctx.workspace.id;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalJobs,
      jobsThisMonth,
      jobsLastMonth,
      revenueThisMonth,
      revenueLastMonth,
      pendingInvoices,
      activeClients,
      upcomingJobs,
    ] = await Promise.all([
      // Total jobs
      ctx.prisma.job.count({ where: { workspaceId } }),

      // Jobs this month
      ctx.prisma.job.count({
        where: {
          workspaceId,
          scheduledAt: { gte: startOfMonth },
          status: { not: "CANCELLED" },
        },
      }),

      // Jobs last month
      ctx.prisma.job.count({
        where: {
          workspaceId,
          scheduledAt: { gte: startOfLastMonth, lte: endOfLastMonth },
          status: { not: "CANCELLED" },
        },
      }),

      // Revenue this month (paid invoices)
      ctx.prisma.invoice.aggregate({
        where: {
          workspaceId,
          status: "PAID",
          paidAt: { gte: startOfMonth },
        },
        _sum: { totalAmount: true },
      }),

      // Revenue last month
      ctx.prisma.invoice.aggregate({
        where: {
          workspaceId,
          status: "PAID",
          paidAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
        _sum: { totalAmount: true },
      }),

      // Pending invoice total
      ctx.prisma.invoice.aggregate({
        where: {
          workspaceId,
          status: { in: ["SENT", "VIEWED", "PARTIAL", "OVERDUE"] },
        },
        _sum: { amountDue: true },
      }),

      // Active clients
      ctx.prisma.client.count({
        where: { workspaceId, status: "ACTIVE" },
      }),

      // Upcoming jobs (next 7 days)
      ctx.prisma.job.findMany({
        where: {
          workspaceId,
          scheduledAt: {
            gte: now,
            lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          },
          status: { in: ["CONFIRMED", "ASSIGNED"] },
        },
        include: {
          client: { select: { firstName: true, lastName: true } },
          assignments: {
            include: { staff: { include: { member: { include: { user: true } } } } },
            where: { isPrimary: true },
          },
        },
        orderBy: { scheduledAt: "asc" },
        take: 10,
      }),
    ]);

    const revenueThisMonthVal = revenueThisMonth._sum.totalAmount ?? 0;
    const revenueLastMonthVal = revenueLastMonth._sum.totalAmount ?? 0;
    const revenueDelta =
      revenueLastMonthVal === 0
        ? 100
        : ((revenueThisMonthVal - revenueLastMonthVal) / revenueLastMonthVal) * 100;

    const jobsDelta =
      jobsLastMonth === 0
        ? 100
        : ((jobsThisMonth - jobsLastMonth) / jobsLastMonth) * 100;

    return {
      totalJobs,
      jobsThisMonth,
      jobsDelta: Math.round(jobsDelta),
      revenueThisMonth: revenueThisMonthVal,
      revenueDelta: Math.round(revenueDelta),
      pendingInvoicesTotal: pendingInvoices._sum.amountDue ?? 0,
      activeClients,
      upcomingJobs,
    };
  }),
});
