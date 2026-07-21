import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "../trpc";

export const clientsRouter = router({
  list: workspaceProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(20),
        search: z.string().optional(),
        status: z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]).optional(),
        type: z
          .enum([
            "AGENT",
            "BROKER",
            "BUILDER",
            "HOMEOWNER",
            "PROPERTY_MANAGER",
            "OTHER",
          ])
          .optional(),
        sortBy: z
          .enum(["createdAt", "lastName", "totalRevenue", "totalJobs", "lastJobAt"])
          .default("createdAt"),
        sortDir: z.enum(["asc", "desc"]).default("desc"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, limit, search, status, type, sortBy, sortDir } = input;
      const skip = (page - 1) * limit;

      const where = {
        workspaceId: ctx.workspace.id,
        ...(status && { status }),
        ...(type && { type }),
        ...(search && {
          OR: [
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { company: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search, mode: "insensitive" as const } },
          ],
        }),
      };

      const [clients, total] = await Promise.all([
        ctx.prisma.client.findMany({
          where,
          include: {
            _count: { select: { jobs: true, invoices: true } },
          },
          orderBy: { [sortBy]: sortDir },
          skip,
          take: limit,
        }),
        ctx.prisma.client.count({ where }),
      ]);

      return {
        clients,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }),

  getById: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const client = await ctx.prisma.client.findFirst({
        where: { id: input.id, workspaceId: ctx.workspace.id },
        include: {
          jobs: {
            include: {
              package: { select: { name: true } },
              invoice: { select: { status: true, totalAmount: true } },
            },
            orderBy: { scheduledAt: "desc" },
            take: 10,
          },
          invoices: {
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
      });

      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
      }

      return client;
    }),

  create: workspaceProcedure
    .input(
      z.object({
        type: z
          .enum([
            "AGENT",
            "BROKER",
            "BUILDER",
            "HOMEOWNER",
            "PROPERTY_MANAGER",
            "OTHER",
          ])
          .default("AGENT"),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        company: z.string().optional(),
        addressLine1: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        postalCode: z.string().optional(),
        country: z.string().optional(),
        source: z.string().optional(),
        notes: z.string().optional(),
        tags: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check for duplicate email in this workspace
      const existing = await ctx.prisma.client.findFirst({
        where: { workspaceId: ctx.workspace.id, email: input.email },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A client with this email already exists.",
        });
      }

      const client = await ctx.prisma.client.create({
        data: {
          workspaceId: ctx.workspace.id,
          ...input,
        },
      });

      await ctx.prisma.activityLog.create({
        data: {
          workspaceId: ctx.workspace.id,
          userId: ctx.user.id,
          action: "client.created",
          entityType: "client",
          entityId: client.id,
          metadata: { email: input.email },
        },
      });

      return client;
    }),

  update: workspaceProcedure
    .input(
      z.object({
        id: z.string(),
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        company: z.string().optional(),
        status: z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]).optional(),
        source: z.string().optional(),
        notes: z.string().optional(),
        tags: z.array(z.string()).optional(),
        addressLine1: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        postalCode: z.string().optional(),
        country: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const client = await ctx.prisma.client.findFirst({
        where: { id, workspaceId: ctx.workspace.id },
      });
      if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });

      return ctx.prisma.client.update({ where: { id }, data });
    }),

  importCsv: workspaceProcedure
    .input(
      z.array(
        z.object({
          firstName: z.string().min(1),
          lastName: z.string().min(1),
          email: z.string().email(),
          phone: z.string().optional(),
          company: z.string().optional(),
          notes: z.string().optional(),
          type: z
            .enum(["AGENT", "BROKER", "BUILDER", "HOMEOWNER", "PROPERTY_MANAGER", "OTHER"])
            .default("AGENT"),
        })
      ).min(1).max(500)
    )
    .mutation(async ({ ctx, input }) => {
      // Find emails that already exist in this workspace
      const existingRecords = await ctx.prisma.client.findMany({
        where: {
          workspaceId: ctx.workspace.id,
          email: { in: input.map((r) => r.email.toLowerCase()) },
        },
        select: { email: true },
      });
      const existingEmails = new Set(existingRecords.map((e) => e.email.toLowerCase()));

      const toCreate = input.filter((r) => !existingEmails.has(r.email.toLowerCase()));

      if (toCreate.length > 0) {
        await ctx.prisma.client.createMany({
          data: toCreate.map((r) => ({
            workspaceId: ctx.workspace.id,
            firstName: r.firstName.trim(),
            lastName: r.lastName.trim(),
            email: r.email.toLowerCase().trim(),
            phone: r.phone?.trim() || null,
            company: r.company?.trim() || null,
            notes: r.notes?.trim() || null,
            type: r.type,
          })),
        });

        await ctx.prisma.activityLog.create({
          data: {
            workspaceId: ctx.workspace.id,
            userId: ctx.user.id,
            action: "client.imported",
            entityType: "client",
            entityId: ctx.workspace.id,
            metadata: { imported: toCreate.length, skipped: input.length - toCreate.length },
          },
        });
      }

      return {
        imported: toCreate.length,
        skipped: input.length - toCreate.length,
      };
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const client = await ctx.prisma.client.findFirst({
        where: { id: input.id, workspaceId: ctx.workspace.id },
      });
      if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });

      // Check for active jobs
      const activeJobs = await ctx.prisma.job.count({
        where: {
          clientId: input.id,
          status: { notIn: ["COMPLETED", "CANCELLED"] },
        },
      });
      if (activeJobs > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Cannot delete client with ${activeJobs} active jobs.`,
        });
      }

      return ctx.prisma.client.delete({ where: { id: input.id } });
    }),
  // ── S8 (R8): portal session visibility + revocation ──────────────────────

  listPortalSessions: workspaceProcedure
    .input(z.object({ clientId: z.string() }))
    .query(async ({ ctx, input }) => {
      const client = await ctx.prisma.client.findFirst({
        where: { id: input.clientId, workspaceId: ctx.workspace.id },
        select: { id: true, portalRevokedAt: true, portalAccessedAt: true },
      });
      if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });

      const sessions = await ctx.prisma.portalSession.findMany({
        where: { clientId: client.id, workspaceId: ctx.workspace.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          createdAt: true,
          lastSeenAt: true,
          expiresAt: true,
          revokedAt: true,
          userAgent: true,
        },
      });

      const now = Date.now();
      return {
        portalRevokedAt: client.portalRevokedAt,
        portalAccessedAt: client.portalAccessedAt,
        sessions: sessions.map((s) => ({
          ...s,
          active: !s.revokedAt && s.expiresAt.getTime() > now,
        })),
      };
    }),

  revokePortalAccess: workspaceProcedure
    .input(z.object({ clientId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const client = await ctx.prisma.client.findFirst({
        where: { id: input.clientId, workspaceId: ctx.workspace.id },
      });
      if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });

      const now = new Date();
      const [revoked] = await ctx.prisma.$transaction([
        ctx.prisma.portalSession.updateMany({
          where: { clientId: client.id, workspaceId: ctx.workspace.id, revokedAt: null },
          data: { revokedAt: now },
        }),
        // Cutoff also kills any legacy stateless cookies still in the wild.
        ctx.prisma.client.update({
          where: { id: client.id },
          data: { portalRevokedAt: now },
        }),
        ctx.prisma.activityLog.create({
          data: {
            workspaceId: ctx.workspace.id,
            userId: ctx.user.id,
            action: "client.portal_access_revoked",
            entityType: "client",
            entityId: client.id,
            metadata: {},
          },
        }),
      ]);

      return { revokedSessions: revoked.count };
    }),

  // ── S8 (B9): client credit ledger ─────────────────────────────────────────

  grantCredit: workspaceProcedure
    .input(
      z.object({
        clientId: z.string(),
        // Positive = grant, negative = manual adjustment down. Never zero.
        amount: z.number().refine((n) => n !== 0, "Amount cannot be zero"),
        reason: z.string().trim().min(1).max(300),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const client = await ctx.prisma.client.findFirst({
        where: { id: input.clientId, workspaceId: ctx.workspace.id },
      });
      if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });

      const newBalance = Math.round((client.creditBalance + input.amount) * 100) / 100;
      if (newBalance < 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Balance cannot go negative (current: $${client.creditBalance.toFixed(2)}).`,
        });
      }

      await ctx.prisma.$transaction([
        ctx.prisma.clientCredit.create({
          data: {
            workspaceId: ctx.workspace.id,
            clientId: client.id,
            amount: input.amount,
            reason: input.reason,
            createdById: ctx.user.id,
          },
        }),
        ctx.prisma.client.update({
          where: { id: client.id },
          data: { creditBalance: newBalance },
        }),
        ctx.prisma.activityLog.create({
          data: {
            workspaceId: ctx.workspace.id,
            userId: ctx.user.id,
            action: input.amount > 0 ? "client.credit_granted" : "client.credit_adjusted",
            entityType: "client",
            entityId: client.id,
            metadata: { amount: input.amount, reason: input.reason, newBalance },
          },
        }),
      ]);

      return { balance: newBalance };
    }),

  listCredits: workspaceProcedure
    .input(z.object({ clientId: z.string(), limit: z.number().min(1).max(100).default(25) }))
    .query(async ({ ctx, input }) => {
      const client = await ctx.prisma.client.findFirst({
        where: { id: input.clientId, workspaceId: ctx.workspace.id },
        select: { creditBalance: true },
      });
      if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });

      const entries = await ctx.prisma.clientCredit.findMany({
        where: { clientId: input.clientId, workspaceId: ctx.workspace.id },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });

      return { balance: client.creditBalance, entries };
    }),
});

