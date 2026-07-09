import { z } from "zod";
import { router, workspaceProcedure } from "../trpc";

const DAY_SCHEMA = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isOpen: z.boolean(),
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
});

const DEFAULT_HOURS = [
  { dayOfWeek: 0, isOpen: false, openTime: "09:00", closeTime: "17:00" }, // Sun
  { dayOfWeek: 1, isOpen: true,  openTime: "09:00", closeTime: "17:00" }, // Mon
  { dayOfWeek: 2, isOpen: true,  openTime: "09:00", closeTime: "17:00" }, // Tue
  { dayOfWeek: 3, isOpen: true,  openTime: "09:00", closeTime: "17:00" }, // Wed
  { dayOfWeek: 4, isOpen: true,  openTime: "09:00", closeTime: "17:00" }, // Thu
  { dayOfWeek: 5, isOpen: true,  openTime: "09:00", closeTime: "17:00" }, // Fri
  { dayOfWeek: 6, isOpen: false, openTime: "09:00", closeTime: "17:00" }, // Sat
];

export const availabilityRouter = router({
  // Get workspace hours — returns all 7 days, filling defaults for missing rows
  get: workspaceProcedure.query(async ({ ctx }) => {
    const rows = await ctx.prisma.workspaceHours.findMany({
      where: { workspaceId: ctx.workspace.id },
      orderBy: { dayOfWeek: "asc" },
    });

    // Fill any missing days with defaults
    return DEFAULT_HOURS.map((def) => {
      const row = rows.find((r) => r.dayOfWeek === def.dayOfWeek);
      return row ?? { ...def, id: null, workspaceId: ctx.workspace.id };
    });
  }),

  // Upsert all 7 days at once
  save: workspaceProcedure
    .input(z.object({ hours: z.array(DAY_SCHEMA).length(7) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.$transaction(
        input.hours.map((day) =>
          ctx.prisma.workspaceHours.upsert({
            where: {
              workspaceId_dayOfWeek: {
                workspaceId: ctx.workspace.id,
                dayOfWeek: day.dayOfWeek,
              },
            },
            create: {
              workspaceId: ctx.workspace.id,
              dayOfWeek: day.dayOfWeek,
              isOpen: day.isOpen,
              openTime: day.openTime,
              closeTime: day.closeTime,
            },
            update: {
              isOpen: day.isOpen,
              openTime: day.openTime,
              closeTime: day.closeTime,
            },
          })
        )
      );
      return { ok: true };
    }),

  // Get workspace buffer time between jobs
  getBufferMins: workspaceProcedure.query(async ({ ctx }) => {
    const ws = await ctx.prisma.workspace.findUnique({
      where: { id: ctx.workspace.id },
      select: { jobBufferMins: true },
    });
    return { bufferMins: ws?.jobBufferMins ?? 15 };
  }),

  // Save workspace buffer time between jobs
  saveBufferMins: workspaceProcedure
    .input(z.object({ bufferMins: z.number().int().min(0).max(120) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.workspace.update({
        where: { id: ctx.workspace.id },
        data: { jobBufferMins: input.bufferMins },
      });
      return { ok: true };
    }),

  // ── Staff time off (S1) — consumed by the scheduling engine ─────────────

  listTimeOff: workspaceProcedure
    .input(z.object({ staffProfileId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.prisma.staffTimeOff.findMany({
        where: {
          staff: { workspaceId: ctx.workspace.id },
          ...(input?.staffProfileId ? { staffId: input.staffProfileId } : {}),
          endsAt: { gte: new Date() },
        },
        include: {
          staff: {
            include: { member: { include: { user: { select: { fullName: true } } } } },
          },
        },
        orderBy: { startsAt: "asc" },
      });
    }),

  addTimeOff: workspaceProcedure
    .input(
      z.object({
        staffProfileId: z.string(),
        startsAt: z.date(),
        endsAt: z.date(),
        reason: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.endsAt <= input.startsAt) {
        throw new Error("End must be after start.");
      }
      const staff = await ctx.prisma.staffProfile.findFirst({
        where: { id: input.staffProfileId, workspaceId: ctx.workspace.id },
        select: { id: true },
      });
      if (!staff) throw new Error("Staff member not found.");
      return ctx.prisma.staffTimeOff.create({
        data: {
          staffId: staff.id,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          reason: input.reason,
        },
      });
    }),

  removeTimeOff: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.staffTimeOff.deleteMany({
        where: { id: input.id, staff: { workspaceId: ctx.workspace.id } },
      });
      return { ok: true };
    }),
});
