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
          contacts: true,
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
});
