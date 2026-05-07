import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "../trpc";

const DEFAULT_ITEMS = [
  "Equipment packed",
  "Property access confirmed",
  "Files uploaded",
  "Editing complete",
  "Gallery delivered",
];

export const checklistRouter = router({
  // Get checklist for a job (auto-create defaults if empty)
  list: workspaceProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findFirst({
        where: { id: input.jobId, workspaceId: ctx.workspace.id },
        select: { id: true },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });

      const existing = await ctx.prisma.jobChecklistItem.findMany({
        where: { jobId: input.jobId },
        orderBy: { sortOrder: "asc" },
      });

      if (existing.length > 0) return existing;

      // Seed defaults on first load
      return ctx.prisma.$transaction(
        DEFAULT_ITEMS.map((label, i) =>
          ctx.prisma.jobChecklistItem.create({
            data: { jobId: input.jobId, label, sortOrder: i },
          })
        )
      );
    }),

  // Toggle checked state
  toggle: workspaceProcedure
    .input(z.object({ id: z.string(), checked: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      // verify it belongs to this workspace
      const item = await ctx.prisma.jobChecklistItem.findFirst({
        where: { id: input.id, job: { workspaceId: ctx.workspace.id } },
        select: { id: true },
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.prisma.jobChecklistItem.update({
        where: { id: input.id },
        data: { checked: input.checked },
      });
    }),

  // Add a custom item
  add: workspaceProcedure
    .input(z.object({ jobId: z.string(), label: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findFirst({
        where: { id: input.jobId, workspaceId: ctx.workspace.id },
        select: { id: true },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });

      const count = await ctx.prisma.jobChecklistItem.count({ where: { jobId: input.jobId } });

      return ctx.prisma.jobChecklistItem.create({
        data: { jobId: input.jobId, label: input.label, sortOrder: count },
      });
    }),

  // Delete an item
  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.jobChecklistItem.findFirst({
        where: { id: input.id, job: { workspaceId: ctx.workspace.id } },
        select: { id: true },
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.prisma.jobChecklistItem.delete({ where: { id: input.id } });
      return { ok: true };
    }),
});
