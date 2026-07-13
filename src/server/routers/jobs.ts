import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { assertSlotBookable, SlotUnavailableError } from "@/lib/scheduling/loader";
import { runDeliverySideEffects } from "@/lib/delivery";
import { notifyJobRescheduled } from "@/lib/notify";
import { router, workspaceProcedure } from "../trpc";
import { generateJobNumber, generateInvoiceNumber } from "@/lib/utils";
import {
  notifyJobBooked,
  notifyJobConfirmed,
  notifyJobAssigned,
  notifyJobCancelled,
  notifyJobDelivered,
} from "@/lib/notify";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "@/lib/gcal";

const JobCreateSchema = z.object({
  clientId: z.string(),
  packageId: z.string().optional(),
  propertyAddress: z.string().min(5),
  propertyUnit: z.string().optional(),
  propertyCity: z.string(),
  propertyState: z.string(),
  propertyZip: z.string().optional(),
  propertyType: z
    .enum([
      "RESIDENTIAL",
      "COMMERCIAL",
      "LAND",
      "MULTI_FAMILY",
      "RENTAL",
      "NEW_CONSTRUCTION",
    ])
    .default("RESIDENTIAL"),
  squareFootage: z.number().optional(),
  bedrooms: z.number().optional(),
  bathrooms: z.number().optional(),
  mlsNumber: z.string().optional(),
  listingUrl: z.string().url().optional().or(z.literal("")),
  accessNotes: z.string().optional(),
  scheduledAt: z.date().optional(),
  estimatedDurationMins: z.number().default(90),
  internalNotes: z.string().optional(),
  clientNotes: z.string().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  priorityFee: z.number().default(0),
  services: z
    .array(
      z.object({
        serviceId: z.string(),
        quantity: z.number().default(1),
        unitPrice: z.number(),
      })
    )
    .default([]),
  assignedStaffIds: z.array(z.string()).default([]),
});

export const jobsRouter = router({
  // List jobs with pagination and filters
  list: workspaceProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(20),
        status: z
          .enum([
            "PENDING",
            "CONFIRMED",
            "ASSIGNED",
            "IN_PROGRESS",
            "EDITING",
            "REVIEW",
            "DELIVERED",
            "COMPLETED",
            "CANCELLED",
            "ON_HOLD",
          ])
          .optional(),
        clientId: z.string().optional(),
        staffId: z.string().optional(),
        search: z.string().optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
        sortBy: z
          .enum(["scheduledAt", "createdAt", "totalAmount", "status"])
          .default("scheduledAt"),
        sortDir: z.enum(["asc", "desc"]).default("desc"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, limit, status, clientId, staffId, search, dateFrom, dateTo, sortBy, sortDir } = input;
      const skip = (page - 1) * limit;

      const where = {
        workspaceId: ctx.workspace.id,
        ...(status && { status }),
        ...(clientId && { clientId }),
        ...(search && {
          OR: [
            { jobNumber: { contains: search, mode: "insensitive" as const } },
            { propertyAddress: { contains: search, mode: "insensitive" as const } },
            {
              client: {
                OR: [
                  { firstName: { contains: search, mode: "insensitive" as const } },
                  { lastName: { contains: search, mode: "insensitive" as const } },
                  { email: { contains: search, mode: "insensitive" as const } },
                ],
              },
            },
          ],
        }),
        ...(dateFrom || dateTo
          ? {
              scheduledAt: {
                ...(dateFrom && { gte: dateFrom }),
                ...(dateTo && { lte: dateTo }),
              },
            }
          : {}),
        ...(staffId && {
          assignments: { some: { staffId } },
        }),
      };

      const [jobs, total] = await Promise.all([
        ctx.prisma.job.findMany({
          where,
          include: {
            client: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                company: true,
              },
            },
            package: { select: { id: true, name: true } },
            assignments: {
              include: {
                staff: {
                  include: {
                    member: {
                      include: {
                        user: { select: { id: true, fullName: true, avatarUrl: true } },
                      },
                    },
                  },
                },
              },
            },
            gallery: { select: { id: true, status: true, slug: true } },
            invoice: { select: { id: true, status: true, totalAmount: true } },
            _count: { select: { services: true } },
          },
          orderBy: { [sortBy]: sortDir },
          skip,
          take: limit,
        }),
        ctx.prisma.job.count({ where }),
      ]);

      return {
        jobs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: skip + jobs.length < total,
        },
      };
    }),

  // Get single job with full details
  getById: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findFirst({
        where: { id: input.id, workspaceId: ctx.workspace.id },
        include: {
          client: true,
          package: { include: { items: { include: { service: true } } } },
          services: { include: { service: true } },
          assignments: {
            include: {
              staff: {
                include: {
                  member: { include: { user: true } },
                },
              },
            },
          },
          gallery: { include: { media: { orderBy: { sortOrder: "asc" } } } },
          invoice: { include: { lineItems: true, payments: true } },
          order: { include: { items: true } },
          statusHistory: { orderBy: { createdAt: "desc" } },
          notifications: { orderBy: { createdAt: "desc" }, take: 10 },
        },
      });

      if (!job) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      }

      return job;
    }),

  // Create job
  create: workspaceProcedure
    .input(JobCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const { services, assignedStaffIds, ...jobData } = input;

      // Calculate totals and auto-calculate duration from services
      let subtotal = 0;
      let calculatedDurationMins = 0;
      const serviceItems = await Promise.all(
        services.map(async (s) => {
          const service = await ctx.prisma.service.findFirst({
            where: { id: s.serviceId, workspaceId: ctx.workspace.id },
          });
          if (!service) throw new TRPCError({ code: "NOT_FOUND", message: `Service ${s.serviceId} not found` });
          const totalPrice = s.unitPrice * s.quantity;
          subtotal += totalPrice;
          calculatedDurationMins += (service.durationMins ?? 0) * s.quantity;
          return { ...s, totalPrice };
        })
      );

      // If package selected, add package price and use package duration if set
      let packageDurationMins: number | null = null;
      if (jobData.packageId) {
        const pkg = await ctx.prisma.package.findFirst({
          where: { id: jobData.packageId, workspaceId: ctx.workspace.id },
        });
        if (pkg) {
          subtotal = pkg.price;
          if (pkg.durationMins && pkg.durationMins > 0) packageDurationMins = pkg.durationMins;
        }
      }

      const taxAmount = (subtotal * (ctx.workspace.defaultTaxRate ?? 0)) / 100;
      const totalAmount = subtotal + taxAmount + (jobData.priorityFee ?? 0);

      const job = await ctx.prisma.$transaction(async (tx) => {
        // Atomic JOB counter — separate from invoices (R11), race-free:
        // update-with-increment returns the post-value in one statement.
        const wsCounter = await tx.workspace.update({
          where: { id: ctx.workspace.id },
          data: { jobNextNumber: { increment: 1 } },
          select: { jobNextNumber: true, jobPrefix: true },
        });
        const jobNumber = generateJobNumber(
          wsCounter.jobPrefix ?? "JOB",
          wsCounter.jobNextNumber - 1
        );

        const newJob = await tx.job.create({
          data: {
            workspaceId: ctx.workspace.id,
            jobNumber,
            clientId: jobData.clientId,
            packageId: jobData.packageId || null,
            propertyAddress: jobData.propertyAddress,
            propertyUnit: jobData.propertyUnit || null,
            propertyCity: jobData.propertyCity,
            propertyState: jobData.propertyState,
            propertyZip: jobData.propertyZip,
            propertyType: jobData.propertyType,
            squareFootage: jobData.squareFootage,
            bedrooms: jobData.bedrooms,
            bathrooms: jobData.bathrooms,
            mlsNumber: jobData.mlsNumber,
            listingUrl: jobData.listingUrl || null,
            accessNotes: jobData.accessNotes,
            scheduledAt: jobData.scheduledAt,
            estimatedDurationMins: packageDurationMins
              ?? (calculatedDurationMins > 0 ? calculatedDurationMins : jobData.estimatedDurationMins),
            internalNotes: jobData.internalNotes,
            clientNotes: jobData.clientNotes,
            priority: jobData.priority,
            priorityFee: jobData.priorityFee,
            subtotal,
            taxAmount,
            totalAmount,
            status: "PENDING",
            services: {
              create: serviceItems.map((s) => ({
                serviceId: s.serviceId,
                quantity: s.quantity,
                unitPrice: s.unitPrice,
                totalPrice: s.totalPrice,
              })),
            },
          },
          include: { client: true, services: { include: { service: true } } },
        });

        // Assign staff
        if (assignedStaffIds.length > 0) {
          await tx.jobAssignment.createMany({
            data: assignedStaffIds.map((staffId, i) => ({
              jobId: newJob.id,
              staffId,
              isPrimary: i === 0,
            })),
          });

          // Update status to ASSIGNED
          await tx.job.update({
            where: { id: newJob.id },
            data: { status: "ASSIGNED" },
          });
        }

        // Activity log
        await tx.activityLog.create({
          data: {
            workspaceId: ctx.workspace.id,
            userId: ctx.user.id,
            action: "job.created",
            entityType: "job",
            entityId: newJob.id,
            metadata: { jobNumber, propertyAddress: jobData.propertyAddress },
          },
        });

        // Update client stats
        await tx.client.update({
          where: { id: jobData.clientId },
          data: { totalJobs: { increment: 1 } },
        });

        return newJob;
      });

      // Fire-and-forget: booking confirmation email to client
      if (job.client.email && job.scheduledAt) {
        void notifyJobBooked({
          workspaceId: ctx.workspace.id,
          jobId: job.id,
          userId: ctx.user.id,
          clientEmail: job.client.email,
          clientName: `${job.client.firstName} ${job.client.lastName}`,
          jobNumber: job.jobNumber,
          propertyAddress: job.propertyAddress,
          scheduledAt: job.scheduledAt,
          packageName: job.services[0]?.service?.name ?? "Photography",
        });
      }

      // NOTE (S3): invoices are created on DELIVERY (see the DELIVERED hook
      // in `update`), not at job creation — Build Brief W6.

      return job;
    }),

  // Update job
  update: workspaceProcedure
    .input(
      z.object({
        id: z.string(),
        scheduledAt: z.date().nullable().optional(),
        status: z
          .enum([
            "PENDING",
            "CONFIRMED",
            "ASSIGNED",
            "IN_PROGRESS",
            "EDITING",
            "REVIEW",
            "DELIVERED",
            "COMPLETED",
            "CANCELLED",
            "ON_HOLD",
          ])
          .optional(),
        internalNotes: z.string().optional(),
        clientNotes: z.string().optional(),
        accessNotes: z.string().optional(),
        priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
        priorityFee: z.number().optional(),
        mlsNumber: z.string().optional(),
        listingUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, status, ...data } = input;

      const job = await ctx.prisma.job.findFirst({
        where: { id, workspaceId: ctx.workspace.id },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });

      // Fetch full job for notification context
      const fullJob = await ctx.prisma.job.findFirst({
        where: { id, workspaceId: ctx.workspace.id },
        include: {
          client: true,
          services: { include: { service: true } },
        },
      });
      if (!fullJob) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });

      // ── Scheduling engine enforcement (S1): a reschedule must work for
      // every assigned photographer (past times skip validation).
      if (
        input.scheduledAt &&
        input.scheduledAt > new Date() &&
        (!job.scheduledAt || input.scheduledAt.getTime() !== job.scheduledAt.getTime())
      ) {
        const assignments = await ctx.prisma.jobAssignment.findMany({
          where: { jobId: id },
          select: { staffId: true },
        });
        for (const a of assignments) {
          try {
            await assertSlotBookable(ctx.prisma, {
              workspaceId: ctx.workspace.id,
              scheduledAt: input.scheduledAt,
              durationMins: job.estimatedDurationMins,
              staffProfileId: a.staffId,
              targetAddress: [
                job.propertyAddress,
                job.propertyCity,
                job.propertyState,
                job.propertyZip,
              ].filter(Boolean).join(", "),
              excludeJobId: id,
            });
          } catch (e) {
            if (e instanceof SlotUnavailableError) {
              throw new TRPCError({ code: "CONFLICT", message: e.message });
            }
            throw e;
          }
        }
      }

      const updated = await ctx.prisma.$transaction(async (tx) => {
        const result = await tx.job.update({
          where: { id },
          data: {
            ...data,
            ...(status && { status }),
          },
        });

        // Track status change
        if (status && status !== job.status) {
          await tx.jobStatusHistory.create({
            data: {
              jobId: id,
              status,
              changedBy: ctx.user.id,
            },
          });
        }

        await tx.activityLog.create({
          data: {
            workspaceId: ctx.workspace.id,
            userId: ctx.user.id,
            action: "job.updated",
            entityType: "job",
            entityId: id,
            metadata: { changes: Object.keys(input) },
          },
        });

        return result;
      });

      // Fire-and-forget notifications on status transitions
      const clientEmail = fullJob.client.email;
      const clientName = `${fullJob.client.firstName} ${fullJob.client.lastName}`;

      if (status && status !== job.status && clientEmail) {
        if (status === "CONFIRMED" && fullJob.scheduledAt) {
          void notifyJobConfirmed({
            workspaceId: ctx.workspace.id,
            jobId: id,
            userId: ctx.user.id,
            clientEmail,
            clientName,
            jobNumber: fullJob.jobNumber,
            propertyAddress: fullJob.propertyAddress,
            scheduledAt: fullJob.scheduledAt,
            packageName: fullJob.services[0]?.service?.name ?? "Photography",
          });
        } else if (status === "DELIVERED") {
          // ONE delivery pipeline for every path (also used by gallery.publish):
          // deliveredAt SLA stamp + delivery email + invoice-on-delivery.
          void runDeliverySideEffects(ctx.prisma, {
            workspaceId: ctx.workspace.id,
            jobId: id,
            userId: ctx.user.id,
          });
        } else if (status === "CANCELLED") {
          // C4: cancellations made via the status dropdown never emailed
          // anyone — the notify only lived on an unused procedure.
          void notifyJobCancelled({
            workspaceId: ctx.workspace.id,
            jobId: id,
            userId: ctx.user.id,
            clientEmail,
            clientName,
            jobNumber: fullJob.jobNumber,
            propertyAddress: fullJob.propertyAddress,
          });
        }
      }

      // Fire-and-forget: update Google Calendar events if scheduledAt changed
      if (input.scheduledAt && input.scheduledAt.getTime() !== job.scheduledAt?.getTime()) {
        // C3: tell the client — a silent reschedule is a missed appointment.
        if (job.scheduledAt && fullJob.client?.email) {
          void notifyJobRescheduled({
            workspaceId: ctx.workspace.id,
            jobId: id,
            userId: ctx.user.id,
            clientEmail: fullJob.client.email,
            clientName: `${fullJob.client.firstName} ${fullJob.client.lastName}`,
            jobNumber: fullJob.jobNumber,
            propertyAddress: fullJob.propertyAddress,
            oldTime: job.scheduledAt,
            newTime: input.scheduledAt,
          });
        }
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore – gcalEventId added via migration, Prisma client not yet regenerated
        const assignments = await ctx.prisma.jobAssignment.findMany({
          // @ts-ignore
          where: { jobId: id, gcalEventId: { not: null } },
          include: {
            staff: {
              include: {
                member: { include: { user: { select: { googleRefreshToken: true, googleCalendarId: true } } } },
              },
            },
          },
        });

        for (const assignment of assignments) {
          const refreshToken = (assignment as any).staff.member.user.googleRefreshToken;
          const calendarId = (assignment as any).staff.member.user.googleCalendarId ?? "primary";
          const gcalEventId = (assignment as any).gcalEventId;
          if (refreshToken && gcalEventId) {
            const startAt = input.scheduledAt;
            const endAt = new Date(
              startAt.getTime() + (updated.estimatedDurationMins ?? 90) * 60_000
            );
            updateCalendarEvent(refreshToken, gcalEventId, {
              title: `📷 Shoot — ${updated.propertyAddress}`,
              startAt,
              endAt,
              calendarId,
            }).catch(console.error);
          }
        }
      }

      return updated;
    }),

  // Assign photographer to job
  assign: workspaceProcedure
    .input(
      z.object({
        jobId: z.string(),
        staffId: z.string(),
        isPrimary: z.boolean().default(true),
        role: z
          .enum([
            "PHOTOGRAPHER",
            "VIDEOGRAPHER",
            "DRONE_PILOT",
            "EDITOR",
            "COORDINATOR",
          ])
          .default("PHOTOGRAPHER"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch job + staff details for notification and calendar
      const [jobForNotify, staffForNotify] = await Promise.all([
        ctx.prisma.job.findFirst({
          where: { id: input.jobId, workspaceId: ctx.workspace.id },
          include: { client: { select: { firstName: true, lastName: true } } },
          // estimatedDurationMins, accessNotes, propertyAddress already on Job
        }),
        ctx.prisma.staffProfile.findFirst({
          where: { id: input.staffId, workspaceId: ctx.workspace.id },
          include: { member: { include: { user: { select: { id: true, fullName: true, email: true } } } } },
        }),
      ]);

      if (!jobForNotify || !staffForNotify) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job or photographer not found." });
      }

      // ── Scheduling engine enforcement (S1): block assignments that create
      // impossible days (double-booked or unreachable). Past jobs skip
      // validation (record-keeping assignments are legitimate).
      if (jobForNotify.scheduledAt && jobForNotify.scheduledAt > new Date()) {
        try {
          await assertSlotBookable(ctx.prisma, {
            workspaceId: ctx.workspace.id,
            scheduledAt: jobForNotify.scheduledAt,
            durationMins: jobForNotify.estimatedDurationMins,
            staffProfileId: input.staffId,
            targetAddress: [
              jobForNotify.propertyAddress,
              jobForNotify.propertyCity,
              jobForNotify.propertyState,
              jobForNotify.propertyZip,
            ].filter(Boolean).join(", "),
            excludeJobId: jobForNotify.id,
          });
        } catch (e) {
          if (e instanceof SlotUnavailableError) {
            throw new TRPCError({ code: "CONFLICT", message: e.message });
          }
          throw e;
        }
      }

      // Upsert assignment
      const assignment = await ctx.prisma.jobAssignment.upsert({
        where: {
          jobId_staffId: { jobId: input.jobId, staffId: input.staffId },
        },
        update: { isPrimary: input.isPrimary, role: input.role },
        create: {
          jobId: input.jobId,
          staffId: input.staffId,
          isPrimary: input.isPrimary,
          role: input.role,
        },
      });

      // Update job status to ASSIGNED
      await ctx.prisma.job.update({
        where: { id: input.jobId },
        data: {
          status: "ASSIGNED",
          statusHistory: {
            create: { status: "ASSIGNED", changedBy: ctx.user.id },
          },
        },
      });

      // Fire-and-forget: push to Google Calendar if photographer has connected
      if (jobForNotify?.scheduledAt && staffForNotify) {
        const photographerUser = await ctx.prisma.user.findUnique({
          where: { id: staffForNotify.member.user.id },
          select: { googleRefreshToken: true, googleCalendarId: true },
        });
        if (photographerUser?.googleRefreshToken) {
          const startAt = jobForNotify.scheduledAt;
          const endAt = new Date(
            startAt.getTime() + (jobForNotify.estimatedDurationMins ?? 90) * 60_000
          );
          // Create the event and store its ID on the assignment so we can update/delete it later
          createCalendarEvent(photographerUser.googleRefreshToken, {
            title: `📷 Shoot — ${jobForNotify.propertyAddress}`,
            description: [
              `Job #${jobForNotify.jobNumber}`,
              `Client: ${jobForNotify.client.firstName} ${jobForNotify.client.lastName}`,
              jobForNotify.accessNotes ? `Access: ${jobForNotify.accessNotes}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
            location: jobForNotify.propertyAddress,
            startAt,
            endAt,
            calendarId: photographerUser.googleCalendarId ?? "primary",
          }).then(async (eventId) => {
            if (eventId) {
              await (ctx.prisma.jobAssignment.update as any)({
                where: { jobId_staffId: { jobId: input.jobId, staffId: input.staffId } },
                // @ts-ignore – gcalEventId added via migration, Prisma client not yet regenerated
                data: { gcalEventId: eventId },
              }).catch(console.error);
            }
          }).catch(console.error);
        }
      }

      // Fire-and-forget: notify the photographer
      if (jobForNotify && staffForNotify?.member.user.email && jobForNotify.scheduledAt) {
        void notifyJobAssigned({
          workspaceId: ctx.workspace.id,
          jobId: input.jobId,
          userId: staffForNotify.member.user.id,
          photographerEmail: staffForNotify.member.user.email,
          photographerName: staffForNotify.member.user.fullName,
          jobNumber: jobForNotify.jobNumber,
          propertyAddress: jobForNotify.propertyAddress,
          scheduledAt: jobForNotify.scheduledAt,
          clientName: `${jobForNotify.client.firstName} ${jobForNotify.client.lastName}`,
          accessNotes: jobForNotify.accessNotes,
        });
      }

      return assignment;
    }),

  // Get today's schedule
  getTodaySchedule: workspaceProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    return ctx.prisma.job.findMany({
      where: {
        workspaceId: ctx.workspace.id,
        scheduledAt: { gte: startOfDay, lt: endOfDay },
        status: { notIn: ["CANCELLED"] },
      },
      include: {
        client: { select: { firstName: true, lastName: true, phone: true } },
        assignments: {
          include: {
            staff: { include: { member: { include: { user: true } } } },
          },
          where: { isPrimary: true },
        },
        package: { select: { name: true } },
      },
      orderBy: { scheduledAt: "asc" },
    });
  }),

  // Delete (soft delete / cancel)
  cancel: workspaceProcedure
    .input(z.object({ id: z.string(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findFirst({
        where: { id: input.id, workspaceId: ctx.workspace.id },
        include: { client: { select: { email: true, firstName: true, lastName: true } } },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });

      const cancelled = await ctx.prisma.job.update({
        where: { id: input.id },
        data: {
          status: "CANCELLED",
          internalNotes: input.reason
            ? `${job.internalNotes ?? ""}\n\nCancellation reason: ${input.reason}`
            : job.internalNotes,
          statusHistory: {
            create: { status: "CANCELLED", notes: input.reason, changedBy: ctx.user.id },
          },
        },
      });

      // Fire-and-forget: notify client
      if (job.client.email) {
        void notifyJobCancelled({
          workspaceId: ctx.workspace.id,
          jobId: input.id,
          userId: ctx.user.id,
          clientEmail: job.client.email,
          clientName: `${job.client.firstName} ${job.client.lastName}`,
          jobNumber: job.jobNumber,
          propertyAddress: job.propertyAddress,
          reason: input.reason,
        });
      }

      // Fire-and-forget: delete Google Calendar events for all assigned photographers
      // @ts-ignore – gcalEventId added via migration, Prisma client not yet regenerated
      const assignments = await ctx.prisma.jobAssignment.findMany({
        // @ts-ignore
        where: { jobId: input.id, gcalEventId: { not: null } },
        include: {
          staff: {
            include: {
              member: { include: { user: { select: { googleRefreshToken: true, googleCalendarId: true } } } },
            },
          },
        },
      });

      for (const assignment of assignments) {
        const refreshToken = (assignment as any).staff.member.user.googleRefreshToken;
        const calendarId = (assignment as any).staff.member.user.googleCalendarId ?? "primary";
        const gcalEventId = (assignment as any).gcalEventId;
        if (refreshToken && gcalEventId) {
          deleteCalendarEvent(refreshToken, gcalEventId, calendarId).catch(console.error);
        }
      }

      return cancelled;
    }),

  // Hard delete — permanently removes a job and all related records
  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findFirst({
        where: { id: input.id, workspaceId: ctx.workspace.id },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });

      // Delete in correct order to respect foreign keys
      await ctx.prisma.$transaction(async (tx) => {
        // Delete related records that may not have cascade
        await tx.jobMessage.deleteMany({ where: { jobId: input.id } });
        await tx.jobChecklistItem.deleteMany({ where: { jobId: input.id } });
        await tx.notification.deleteMany({ where: { jobId: input.id } });

        // Delete invoice if linked
        await tx.invoice.deleteMany({ where: { jobId: input.id } });

        // Delete order if linked
        await tx.order.deleteMany({ where: { jobId: input.id } });

        // Cascade-handled: assignments, services, gallery, statusHistory
        // Delete the job itself (cascades take care of the rest)
        await tx.job.delete({ where: { id: input.id } });
      });

      return { success: true, deletedJobNumber: job.jobNumber };
    }),

  // Bulk delete — permanently removes multiple jobs
  bulkDelete: workspaceProcedure
    .input(z.object({ ids: z.array(z.string()).min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      // Verify all jobs belong to this workspace
      const jobs = await ctx.prisma.job.findMany({
        where: { id: { in: input.ids }, workspaceId: ctx.workspace.id },
        select: { id: true, jobNumber: true },
      });

      if (jobs.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No matching jobs found" });
      }

      const jobIds = jobs.map(j => j.id);

      await ctx.prisma.$transaction(async (tx) => {
        await tx.jobMessage.deleteMany({ where: { jobId: { in: jobIds } } });
        await tx.jobChecklistItem.deleteMany({ where: { jobId: { in: jobIds } } });
        await tx.notification.deleteMany({ where: { jobId: { in: jobIds } } });
        await tx.invoice.deleteMany({ where: { jobId: { in: jobIds } } });
        await tx.order.deleteMany({ where: { jobId: { in: jobIds } } });
        await tx.job.deleteMany({ where: { id: { in: jobIds } } });
      });

      return { success: true, deletedCount: jobs.length };
    }),
});
