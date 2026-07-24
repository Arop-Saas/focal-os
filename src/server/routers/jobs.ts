import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { assertSlotBookable, SlotUnavailableError } from "@/lib/scheduling/loader";
import { runDeliverySideEffects } from "@/lib/delivery";
import { syncPrimaryAppointment, appointmentStatusForJobStatus, cancelAppointmentsForJob } from "@/lib/orders/appointments";
import { findOrCreateProperty } from "@/lib/orders/property";
import { quoteOrderLines, snapshotAndGenerate, applyOrderAdjustments } from "@/lib/orders/pricing";
import { createInvoiceForJob, InvoiceExistsError } from "@/lib/money/invoice";
import { sendCustomDeliveryEmail, sendInternalEmail } from "@/lib/resend";
import { logOrderActivity } from "@/lib/orders/activity";
import { twilightWindow } from "@/lib/scheduling/solar";
import { z as zod } from "zod";
import { notifyJobRescheduled } from "@/lib/notify";
import { router, workspaceProcedure } from "../trpc";
import { generateJobNumber, generateInvoiceNumber } from "@/lib/utils";
import { storageAdmin, ensurePrivateBucket, PRIVATE_MEDIA_BUCKET, SIGNED_VIEW_TTL_SECONDS } from "@/lib/gallery-security";
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
  clientSource: z.string().max(50).optional(), // "How did you hear about us?" — saved to Client.source if empty
  services: z
    .array(
      z.object({
        serviceId: z.string(),
        quantity: z.number().default(1),
        unitPrice: z.number(),
      })
    )
    .default([]),
  // Catalog-native lines (new order creator). When present they are priced
  // server-side via quoteOrderLines and `services` is ignored.
  catalogLines: z
    .array(
      z.object({
        catalogItemId: z.string(),
        quantity: z.number().int().min(1).default(1),
      })
    )
    .default([]),
  assignedStaffIds: z.array(z.string()).default([]),
});

/** Mirror the invoice's money from the ORDER — the invoice is a live view of
 * the order until paid. Call inside the same tx AFTER the job totals update. */
async function mirrorInvoiceFromJob(tx: Prisma.TransactionClient, jobId: string) {
  const job = await tx.job.findUnique({
    where: { id: jobId },
    select: { subtotal: true, taxAmount: true, discountAmount: true, totalAmount: true },
  });
  const invoice = await tx.invoice.findUnique({ where: { jobId } });
  if (!job || !invoice || invoice.status === "VOID") return;
  const newDue = Math.max(0, job.totalAmount - invoice.amountPaid);
  await tx.invoice.update({
    where: { id: invoice.id },
    data: {
      subtotal: job.subtotal,
      taxAmount: job.taxAmount,
      discountAmount: job.discountAmount,
      totalAmount: job.totalAmount,
      amountDue: newDue,
      status:
        invoice.status === "PAID" && newDue > 0 ? "PARTIAL" :
        (invoice.status === "PARTIAL" || invoice.status === "PAID") && newDue <= 0 ? "PAID" :
        invoice.status,
    },
  });
}

/** Add/remove the matching InvoiceLineItem, then mirror totals from the job.
 * Removals only touch line items the invoice actually carries. */
async function syncInvoiceLine(
  tx: Prisma.TransactionClient,
  args: {
    jobId: string;
    mode: "ADD" | "REMOVE";
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }
) {
  const invoice = await tx.invoice.findUnique({
    where: { jobId: args.jobId },
    include: { lineItems: { orderBy: { sortOrder: "asc" } } },
  });
  if (!invoice || invoice.status === "VOID") return;

  if (args.mode === "ADD") {
    await tx.invoiceLineItem.create({
      data: {
        invoiceId: invoice.id,
        description: args.description,
        quantity: args.quantity,
        unitPrice: args.unitPrice,
        totalPrice: args.totalPrice,
        sortOrder: (invoice.lineItems.at(-1)?.sortOrder ?? -1) + 1,
      },
    });
  } else {
    const match = invoice.lineItems.find(
      (li) => li.description === args.description && Math.abs(li.totalPrice - args.totalPrice) < 0.005
    );
    if (match) await tx.invoiceLineItem.delete({ where: { id: match.id } });
  }
  await mirrorInvoiceFromJob(tx, args.jobId);
}

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
      const { services, catalogLines, assignedStaffIds, ...jobData } = input;

      // Catalog-native path: price entirely on the server (rules, plans,
      // manual edits happen in the catalog — the client sends no prices).
      const catalogQuote = catalogLines.length
        ? await quoteOrderLines(ctx.prisma, {
            workspaceId: ctx.workspace.id,
            squareFootage: jobData.squareFootage ?? null,
            clientId: jobData.clientId,
            lines: catalogLines,
          })
        : null;

      // Legacy JobService bridge rows + Job.packageId for catalog lines whose
      // items are bridged, so invoices and older list readers keep working.
      let bridgedServiceItems: { serviceId: string; quantity: number; unitPrice: number; totalPrice: number }[] = [];
      if (catalogQuote) {
        const quotedItemIds = catalogQuote.lines.map((l) => l.catalogItemId).filter((id): id is string => !!id);
        const bridgeItems = quotedItemIds.length
          ? await ctx.prisma.catalogItem.findMany({
              where: { id: { in: quotedItemIds }, workspaceId: ctx.workspace.id },
              select: { id: true, legacyServiceId: true, legacyPackageId: true },
            })
          : [];
        const byId = new Map(bridgeItems.map((b) => [b.id, b]));
        for (const line of catalogQuote.lines) {
          const bridge = line.catalogItemId ? byId.get(line.catalogItemId) : undefined;
          if (bridge?.legacyServiceId) {
            bridgedServiceItems.push({
              serviceId: bridge.legacyServiceId,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              totalPrice: line.totalPrice,
            });
          }
          if (bridge?.legacyPackageId && !jobData.packageId) {
            jobData.packageId = bridge.legacyPackageId;
          }
        }
      }

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

      if (catalogQuote) {
        subtotal = catalogQuote.subtotal;
        // Primary-visit duration = same-visit lines only; separate-visit
        // lines get their own generated appointment with their own length.
        // The quote's rule-adjusted duration wins over any bridged legacy
        // package duration.
        packageDurationMins = null;
        calculatedDurationMins = catalogQuote.lines
          .filter((l) => l.visitMode === "SAME_VISIT" && l.fulfillmentMode !== "PRODUCTION_ONLY")
          .reduce((sum, l) => sum + l.durationMins, 0);
      }

      // Order-level adjustments (rush / after-hours / weekend / minimum order)
      // before tax; manual priorityFee still adds on top when set.
      const adjusted = await applyOrderAdjustments(ctx.prisma, {
        workspaceId: ctx.workspace.id,
        subtotal,
        scheduledAt: jobData.scheduledAt ?? null,
        isRush: jobData.priority === "URGENT",
      });
      const adjustedSubtotal = adjusted.adjustedSubtotal;
      const taxAmount = (adjustedSubtotal * (ctx.workspace.defaultTaxRate ?? 0)) / 100;
      const totalAmount = adjustedSubtotal + taxAmount + (jobData.priorityFee ?? 0);

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

        const property = await findOrCreateProperty(tx, {
          workspaceId: ctx.workspace.id,
          address: jobData.propertyAddress,
          unit: jobData.propertyUnit,
          city: jobData.propertyCity,
          state: jobData.propertyState,
          zip: jobData.propertyZip,
          propertyType: jobData.propertyType,
          squareFootage: jobData.squareFootage,
          bedrooms: jobData.bedrooms,
          bathrooms: jobData.bathrooms,
          mlsNumber: jobData.mlsNumber,
          listingUrl: jobData.listingUrl || null,
          accessNotes: jobData.accessNotes,
        });

        const newJob = await tx.job.create({
          data: {
            workspaceId: ctx.workspace.id,
            jobNumber,
            propertyId: property.id,
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
              create: (catalogQuote ? bridgedServiceItems : serviceItems).map((s) => ({
                serviceId: s.serviceId,
                quantity: s.quantity,
                unitPrice: s.unitPrice,
                totalPrice: s.totalPrice,
              })),
            },
          },
          include: { client: true, services: { include: { service: true } } },
        });

        // Mirror into the primary Appointment (orders architecture invariant)
        await syncPrimaryAppointment(tx, {
          workspaceId: ctx.workspace.id,
          jobId: newJob.id,
          scheduledAt: newJob.scheduledAt,
          durationMins: newJob.estimatedDurationMins,
        });

        // Snapshot the purchased lines with explained pricing, and generate
        // downstream work (production tasks, separate-visit appointments).
        // Admin-entered prices win but the computed price is recorded.
        const quoted = catalogQuote ?? await quoteOrderLines(tx, {
          workspaceId: ctx.workspace.id,
          squareFootage: jobData.squareFootage ?? null,
          clientId: jobData.clientId,
          lines: [
            ...(jobData.packageId
              ? [{ packageId: jobData.packageId, quantity: 1 }]
              : []),
            ...serviceItems.map((s) => ({
              serviceId: s.serviceId,
              quantity: s.quantity,
              unitPriceOverride: s.unitPrice,
            })),
          ],
        });
        await snapshotAndGenerate(tx, {
          workspaceId: ctx.workspace.id,
          jobId: newJob.id,
          lines: quoted.lines,
        });

        // "How did you hear about us?" — first answer sticks to the client
        if (jobData.clientSource) {
          await tx.client.updateMany({
            where: {
              id: jobData.clientId,
              workspaceId: ctx.workspace.id,
              OR: [{ source: null }, { source: "" }],
            },
            data: { source: jobData.clientSource },
          });
        }

        // Assign staff — linked to the primary appointment so the command
        // center's appointment rows show the crew.
        if (assignedStaffIds.length > 0) {
          const primaryAppt = await tx.appointment.findFirst({
            where: { jobId: newJob.id, isPrimary: true },
            select: { id: true },
          });
          await tx.jobAssignment.createMany({
            data: assignedStaffIds.map((staffId, i) => ({
              jobId: newJob.id,
              staffId,
              appointmentId: primaryAppt?.id ?? null,
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

      // Every order gets an invoice up front (draft until sent); the
      // on-delivery hook remains as a safety net for older orders.
      try {
        await createInvoiceForJob(ctx.prisma, { workspaceId: ctx.workspace.id, jobId: job.id });
      } catch (e) {
        if (!(e instanceof InvoiceExistsError)) console.error("Auto-invoice on create failed:", e);
      }

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

        // Keep the primary Appointment mirrored (orders architecture invariant)
        await syncPrimaryAppointment(tx, {
          workspaceId: ctx.workspace.id,
          jobId: id,
          scheduledAt: result.scheduledAt,
          durationMins: result.estimatedDurationMins,
          ...(status && { status: appointmentStatusForJobStatus(status) }),
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
            // Admin assignment overrides availability for now — warn-only.
            // TODO(booking-permissions): permission-gated override + warning.
            console.warn(`Assignment despite availability: ${e.message}`);
          } else {
            throw e;
          }
        }
      }

      // Upsert assignment — linked to the primary appointment so the command
      // center's appointment rows show the crew.
      const primaryApptForAssign = await ctx.prisma.appointment.findFirst({
        where: { jobId: input.jobId, isPrimary: true },
        select: { id: true },
      });
      const assignment = await ctx.prisma.jobAssignment.upsert({
        where: {
          jobId_staffId: { jobId: input.jobId, staffId: input.staffId },
        },
        update: { isPrimary: input.isPrimary, role: input.role, appointmentId: primaryApptForAssign?.id ?? null },
        create: {
          jobId: input.jobId,
          staffId: input.staffId,
          appointmentId: primaryApptForAssign?.id ?? null,
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

      const assignedStaff = await ctx.prisma.staffProfile.findUnique({
        where: { id: input.staffId },
        select: { member: { select: { user: { select: { fullName: true } } } } },
      });
      await logOrderActivity(ctx.prisma, {
        workspaceId: ctx.workspace.id,
        jobId: input.jobId,
        userId: ctx.user.id,
        message: `Photographer assigned — ${assignedStaff?.member.user.fullName ?? "team member"}`,
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
  /** Golden-hour window for a job's property on a date (twilight scheduling). */
  twilightWindow: workspaceProcedure
    .input(zod.object({ jobId: zod.string(), dateISO: zod.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findFirst({
        where: { id: input.jobId, workspaceId: ctx.workspace.id },
        select: {
          propertyLat: true,
          propertyLng: true,
          property: { select: { lat: true, lng: true } },
          appointments: { select: { isPrimary: true, timeConstraint: true } },
        },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });

      const solarAppts = job.appointments.filter((a) => a.timeConstraint === "SOLAR");
      const lat = job.propertyLat ?? job.property?.lat ?? null;
      const lng = job.propertyLng ?? job.property?.lng ?? null;
      if (solarAppts.length === 0 || lat == null || lng == null) {
        return { hasSolar: false as const };
      }
      const w = twilightWindow(input.dateISO, lat, lng);
      if (!w) return { hasSolar: false as const };
      return {
        hasSolar: true as const,
        primaryIsSolar: solarAppts.some((a) => a.isPrimary),
        sunset: w.sunset.toISOString(),
        suggestedStart: w.suggestedStart.toISOString(),
        windowEnd: w.windowEnd.toISOString(),
      };
    }),

  /** Apply a coupon to the order — totals and invoice update live. */
  applyCoupon: workspaceProcedure
    .input(zod.object({ jobId: zod.string(), code: zod.string().min(1).max(40) }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findFirst({
        where: { id: input.jobId, workspaceId: ctx.workspace.id },
        include: { client: { select: { email: true } } },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      const coupon = await ctx.prisma.coupon.findUnique({
        where: { workspaceId_code: { workspaceId: ctx.workspace.id, code: input.code.trim().toUpperCase() } },
      });
      const valid =
        coupon &&
        coupon.isActive &&
        (!coupon.expiresAt || coupon.expiresAt > new Date()) &&
        (coupon.maxUses == null || coupon.usedCount < coupon.maxUses);
      if (!valid) throw new TRPCError({ code: "BAD_REQUEST", message: "That coupon code isn't valid" });

      const discount =
        coupon.discountType === "PERCENTAGE"
          ? Math.round(job.subtotal * coupon.discountValue) / 100
          : Math.min(coupon.discountValue, job.subtotal);

      await ctx.prisma.$transaction(async (tx) => {
        await tx.job.update({
          where: { id: job.id },
          data: {
            discountAmount: job.discountAmount + discount,
            totalAmount: Math.max(0, job.totalAmount - discount),
          },
        });
        await tx.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } });
        await tx.couponUsage.create({
          data: { couponId: coupon.id, orderId: job.id, email: job.client.email },
        });
        await mirrorInvoiceFromJob(tx, job.id);
        await logOrderActivity(tx, {
          workspaceId: ctx.workspace.id,
          jobId: job.id,
          userId: ctx.user.id,
          message: `Coupon ${coupon.code} applied — $${discount.toFixed(2)} off`,
        });
      });
      return { discount };
    }),

  /** Clear the order's discount (coupon usage stays counted). */
  removeOrderDiscount: workspaceProcedure
    .input(zod.object({ jobId: zod.string() }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findFirst({
        where: { id: input.jobId, workspaceId: ctx.workspace.id },
        select: { id: true, discountAmount: true, totalAmount: true },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      if (job.discountAmount <= 0) return { ok: true };
      await ctx.prisma.$transaction(async (tx) => {
        await tx.job.update({
          where: { id: job.id },
          data: { discountAmount: 0, totalAmount: job.totalAmount + job.discountAmount },
        });
        await mirrorInvoiceFromJob(tx, job.id);
        await logOrderActivity(tx, {
          workspaceId: ctx.workspace.id,
          jobId: job.id,
          userId: ctx.user.id,
          message: "Discount removed",
        });
      });
      return { ok: true };
    }),

  /** Toggle tax on the order at the workspace default rate.
   * TODO(tax-rules): territory/order-form specific tax rates. */
  setOrderTax: workspaceProcedure
    .input(zod.object({ jobId: zod.string(), apply: zod.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findFirst({
        where: { id: input.jobId, workspaceId: ctx.workspace.id },
        select: { id: true, subtotal: true, taxAmount: true, discountAmount: true, priorityFee: true },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      const rate = ctx.workspace.defaultTaxRate ?? 0;
      const newTax = input.apply ? Math.round(job.subtotal * rate) / 100 : 0;
      const newTotal = Math.max(0, job.subtotal + job.priorityFee - job.discountAmount + newTax);
      await ctx.prisma.$transaction(async (tx) => {
        await tx.job.update({
          where: { id: job.id },
          data: { taxAmount: newTax, totalAmount: newTotal },
        });
        await mirrorInvoiceFromJob(tx, job.id);
        await logOrderActivity(tx, {
          workspaceId: ctx.workspace.id,
          jobId: job.id,
          userId: ctx.user.id,
          message: input.apply ? `Tax applied (${rate}%)` : "Tax removed",
        });
      });
      return { ok: true };
    }),

  /** Dismiss the Needs Attention card for the current set of reasons —
   * it reappears automatically when the reasons change. */
  dismissAttention: workspaceProcedure
    .input(zod.object({ jobId: zod.string(), key: zod.string().max(500) }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findFirst({
        where: { id: input.jobId, workspaceId: ctx.workspace.id }, select: { id: true },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.prisma.job.update({
        where: { id: job.id },
        data: { attentionDismissedKey: input.key },
      });
      return { ok: true };
    }),

  /** Prefill data for the deliver modal. */
  deliveryPreview: workspaceProcedure
    .input(zod.object({ jobId: zod.string() }))
    .query(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findFirst({
        where: { id: input.jobId, workspaceId: ctx.workspace.id },
        include: {
          client: { select: { firstName: true, lastName: true, email: true } },
          additionalClients: { include: { client: { select: { email: true } } } },
          gallery: { select: { slug: true, mediaCount: true } },
          invoice: { select: { invoiceNumber: true, amountDue: true, status: true } },
        },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      const orderNo = job.jobNumber.replace(/^JOB-?/i, "");
      return {
        subject: `Your media is ready — ${job.propertyAddress}`,
        message:
          `Hi ${job.client.firstName},\n` +
          `The media for ${job.propertyAddress} (Order #${orderNo}) is ready to view and download.`,
        to: job.client.email,
        defaultCc: job.additionalClients.map((x) => x.client.email).filter(Boolean),
        mediaCount: job.gallery?.mediaCount ?? 0,
        hasGallery: !!job.gallery,
        amountDue: job.invoice?.amountDue ?? 0,
        invoiceNumber: job.invoice?.invoiceNumber ?? null,
        alreadyDelivered: !!job.deliveredAt || job.status === "DELIVERED",
      };
    }),

  /** THE delivery action: publishes the listing, stamps the order, optionally
   * emails the client (custom subject/message/cc) and marks the invoice paid. */
  deliver: workspaceProcedure
    .input(zod.object({
      jobId: zod.string(),
      silent: zod.boolean().default(false),
      subject: zod.string().max(300).optional(),
      message: zod.string().max(5000).optional(),
      cc: zod.array(zod.string().email()).max(10).default([]),
      markPaid: zod.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findFirst({
        where: { id: input.jobId, workspaceId: ctx.workspace.id },
        include: {
          client: { select: { firstName: true, lastName: true, email: true } },
          gallery: { select: { id: true, slug: true, isPublic: true, status: true } },
          invoice: true,
        },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.prisma.$transaction(async (tx) => {
        if (job.gallery && (!job.gallery.isPublic || job.gallery.status !== "DELIVERED")) {
          await tx.gallery.update({
            where: { id: job.gallery.id },
            data: { isPublic: true, status: "DELIVERED" },
          });
        }
        await tx.job.update({
          where: { id: job.id },
          data: {
            status: "DELIVERED",
            ...(job.deliveredAt ? {} : { deliveredAt: new Date() }),
            statusHistory: { create: { status: "DELIVERED", changedBy: ctx.user.id } },
          },
        });
        if (input.markPaid && job.invoice && job.invoice.amountDue > 0) {
          await tx.invoice.update({
            where: { id: job.invoice.id },
            data: {
              amountPaid: job.invoice.totalAmount,
              amountDue: 0,
              status: "PAID",
              paidAt: new Date(),
            },
          });
          await tx.payment.create({
            data: {
              invoiceId: job.invoice.id,
              amount: job.invoice.amountDue,
              method: "OTHER",
              status: "SUCCEEDED",
              notes: "Marked paid at delivery",
            },
          });
        }
        await tx.activityLog.create({
          data: {
            workspaceId: ctx.workspace.id,
            userId: ctx.user.id,
            action: input.silent ? "Order delivered silently" : "Order delivered — client emailed",
            entityType: "job",
            entityId: job.id,
          },
        });
      });

      if (!input.silent && job.client.email) {
        const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.scalist.io";
        const galleryUrl = job.gallery?.slug ? `${base}/g/${job.gallery.slug}` : `${base}/portal`;
        void sendCustomDeliveryEmail({
          workspaceId: ctx.workspace.id,
          to: job.client.email,
          cc: input.cc,
          subject: input.subject?.trim() || `Your media is ready — ${job.propertyAddress}`,
          messageText:
            input.message?.trim() ||
            `Hi ${job.client.firstName},\nThe media for ${job.propertyAddress} is ready to view and download.`,
          galleryUrl,
        });
        void ctx.prisma.notification.create({
          data: {
            workspaceId: ctx.workspace.id,
            jobId: job.id,
            type: "JOB_DELIVERED",
            channel: "IN_APP",
            status: "DELIVERED",
            title: `Media delivered — ${job.jobNumber}`,
            body: `Delivery email sent to ${job.client.email}`,
          },
        }).catch(() => {});
      }

      return { ok: true };
    }),

  /** Additional clients on an order (primary stays Job.clientId). */
  addOrderClient: workspaceProcedure
    .input(zod.object({ jobId: zod.string(), clientId: zod.string() }))
    .mutation(async ({ ctx, input }) => {
      const [job, client] = await Promise.all([
        ctx.prisma.job.findFirst({ where: { id: input.jobId, workspaceId: ctx.workspace.id }, select: { id: true, clientId: true } }),
        ctx.prisma.client.findFirst({ where: { id: input.clientId, workspaceId: ctx.workspace.id }, select: { id: true } }),
      ]);
      if (!job || !client) throw new TRPCError({ code: "NOT_FOUND" });
      if (job.clientId === input.clientId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Already the primary client on this order" });
      }
      const row = await ctx.prisma.jobClient.upsert({
        where: { jobId_clientId: { jobId: job.id, clientId: client.id } },
        update: {},
        create: { jobId: job.id, clientId: client.id },
      });
      const c = await ctx.prisma.client.findUnique({
        where: { id: client.id }, select: { firstName: true, lastName: true },
      });
      await logOrderActivity(ctx.prisma, {
        workspaceId: ctx.workspace.id,
        jobId: job.id,
        userId: ctx.user.id,
        message: `Client added — ${c?.firstName ?? ""} ${c?.lastName ?? ""}`.trim(),
      });
      return row;
    }),

  removeOrderClient: workspaceProcedure
    .input(zod.object({ jobId: zod.string(), clientId: zod.string() }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findFirst({
        where: { id: input.jobId, workspaceId: ctx.workspace.id }, select: { id: true },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.prisma.jobClient.deleteMany({ where: { jobId: job.id, clientId: input.clientId } });
      const c = await ctx.prisma.client.findUnique({
        where: { id: input.clientId }, select: { firstName: true, lastName: true },
      });
      await logOrderActivity(ctx.prisma, {
        workspaceId: ctx.workspace.id,
        jobId: job.id,
        userId: ctx.user.id,
        message: `Client removed — ${c?.firstName ?? ""} ${c?.lastName ?? ""}`.trim(),
      });
      return { ok: true };
    }),

  /** Attach/detach a client team to the order. */
  setOrderTeam: workspaceProcedure
    .input(zod.object({ jobId: zod.string(), customerTeamId: zod.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findFirst({
        where: { id: input.jobId, workspaceId: ctx.workspace.id }, select: { id: true },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      if (input.customerTeamId) {
        const team = await ctx.prisma.customerTeam.findFirst({
          where: { id: input.customerTeamId, workspaceId: ctx.workspace.id }, select: { id: true },
        });
        if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
      }
      const updated = await ctx.prisma.job.update({
        where: { id: job.id },
        data: { customerTeamId: input.customerTeamId },
      });
      const teamName = input.customerTeamId
        ? (await ctx.prisma.customerTeam.findUnique({ where: { id: input.customerTeamId }, select: { name: true } }))?.name
        : null;
      await logOrderActivity(ctx.prisma, {
        workspaceId: ctx.workspace.id,
        jobId: job.id,
        userId: ctx.user.id,
        message: teamName ? `Team attached — ${teamName}` : "Team detached",
      });
      return updated;
    }),

  /** Notify a workspace member that raw files are ready for editing. */
  sendRawsToEditor: workspaceProcedure
    .input(zod.object({
      jobId: zod.string(),
      userId: zod.string(),
      note: zod.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [job, member] = await Promise.all([
        ctx.prisma.job.findFirst({
          where: { id: input.jobId, workspaceId: ctx.workspace.id },
          select: { id: true, jobNumber: true, propertyAddress: true, _count: { select: { rawFiles: true } } },
        }),
        ctx.prisma.workspaceMember.findFirst({
          where: { workspaceId: ctx.workspace.id, userId: input.userId },
          include: { user: { select: { id: true, email: true, fullName: true, firstName: true } } },
        }),
      ]);
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      if (!member) throw new TRPCError({ code: "NOT_FOUND", message: "Team member not found" });
      if (job._count.rawFiles === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No raw files uploaded yet" });
      }

      const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.scalist.io";
      const orderNo = job.jobNumber.replace(/^JOB-?/i, "");
      void sendInternalEmail({
        workspaceId: ctx.workspace.id,
        to: member.user.email,
        subject: `Raw files ready for editing — ${job.propertyAddress}`,
        messageText:
          `Hi ${member.user.firstName ?? member.user.fullName},\n` +
          `${job._count.rawFiles} raw file${job._count.rawFiles === 1 ? "" : "s"} for Order #${orderNo} (${job.propertyAddress}) ${job._count.rawFiles === 1 ? "is" : "are"} ready for editing.` +
          (input.note?.trim() ? `\nNote: ${input.note.trim()}` : ""),
        ctaLabel: "Open raw files",
        ctaUrl: `${base}/jobs/${job.id}?tab=raw`,
      });
      await ctx.prisma.activityLog.create({
        data: {
          workspaceId: ctx.workspace.id,
          userId: ctx.user.id,
          action: `raw files sent to ${member.user.fullName}`,
          entityType: "job",
          entityId: job.id,
        },
      });
      return { ok: true };
    }),

  /** Remove an order line — totals and the invoice stay in sync. */
  removeOrderLine: workspaceProcedure
    .input(zod.object({ lineId: zod.string() }))
    .mutation(async ({ ctx, input }) => {
      const line = await ctx.prisma.orderLineSnapshot.findFirst({
        where: { id: input.lineId, workspaceId: ctx.workspace.id },
        include: { job: { select: { id: true, subtotal: true, taxAmount: true, totalAmount: true } } },
      });
      if (!line) throw new TRPCError({ code: "NOT_FOUND" });
      const taxRate = ctx.workspace.defaultTaxRate ?? 0;
      const lineTax = (line.totalPrice * taxRate) / 100;

      await ctx.prisma.$transaction(async (tx) => {
        await tx.orderLineSnapshot.delete({ where: { id: line.id } });
        await tx.job.update({
          where: { id: line.job.id },
          data: {
            subtotal: Math.max(0, line.job.subtotal - line.totalPrice),
            taxAmount: Math.max(0, line.job.taxAmount - lineTax),
            totalAmount: Math.max(0, line.job.totalAmount - line.totalPrice - lineTax),
          },
        });
        await syncInvoiceLine(tx, {
          jobId: line.job.id,
          mode: "REMOVE",
          description: line.name,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          totalPrice: line.totalPrice,
        });
        await logOrderActivity(tx, {
          workspaceId: ctx.workspace.id,
          jobId: line.job.id,
          userId: ctx.user.id,
          message: `Service removed — ${line.name}`,
        });
      });
      return { ok: true };
    }),

  /** Edit order identity details — address, client, property facts. Address
   * changes re-link the deduped Property and clear coords for re-geocode. */
  updateDetails: workspaceProcedure
    .input(zod.object({
      jobId: zod.string(),
      clientId: zod.string().optional(),
      propertyAddress: zod.string().min(5).optional(),
      propertyUnit: zod.string().nullable().optional(),
      propertyCity: zod.string().min(1).optional(),
      propertyState: zod.string().min(1).optional(),
      propertyZip: zod.string().nullable().optional(),
      propertyType: zod.enum(["RESIDENTIAL", "COMMERCIAL", "LAND", "MULTI_FAMILY", "RENTAL", "NEW_CONSTRUCTION"]).optional(),
      squareFootage: zod.number().int().min(0).nullable().optional(),
      bedrooms: zod.number().int().min(0).nullable().optional(),
      bathrooms: zod.number().min(0).nullable().optional(),
      accessNotes: zod.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { jobId, clientId, ...fields } = input;
      const job = await ctx.prisma.job.findFirst({
        where: { id: jobId, workspaceId: ctx.workspace.id },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });

      if (clientId) {
        const client = await ctx.prisma.client.findFirst({
          where: { id: clientId, workspaceId: ctx.workspace.id },
          select: { id: true },
        });
        if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
      }

      const addressChanged =
        (fields.propertyAddress != null && fields.propertyAddress !== job.propertyAddress) ||
        (fields.propertyCity != null && fields.propertyCity !== job.propertyCity) ||
        (fields.propertyState != null && fields.propertyState !== job.propertyState) ||
        (fields.propertyZip !== undefined && fields.propertyZip !== job.propertyZip);

      return ctx.prisma.$transaction(async (tx) => {
        let propertyId = job.propertyId;
        if (addressChanged) {
          const property = await findOrCreateProperty(tx, {
            workspaceId: ctx.workspace.id,
            address: fields.propertyAddress ?? job.propertyAddress,
            unit: fields.propertyUnit === undefined ? job.propertyUnit ?? undefined : fields.propertyUnit ?? undefined,
            city: fields.propertyCity ?? job.propertyCity,
            state: fields.propertyState ?? job.propertyState,
            zip: (fields.propertyZip === undefined ? job.propertyZip : fields.propertyZip) ?? undefined,
            propertyType: fields.propertyType ?? job.propertyType,
            squareFootage: (fields.squareFootage === undefined ? job.squareFootage : fields.squareFootage) ?? undefined,
            bedrooms: (fields.bedrooms === undefined ? job.bedrooms : fields.bedrooms) ?? undefined,
            bathrooms: (fields.bathrooms === undefined ? job.bathrooms : fields.bathrooms) ?? undefined,
            accessNotes: (fields.accessNotes === undefined ? job.accessNotes : fields.accessNotes) ?? undefined,
          });
          propertyId = property.id;
        }

        await logOrderActivity(tx, {
          workspaceId: ctx.workspace.id,
          jobId: job.id,
          userId: ctx.user.id,
          message: clientId ? "Primary client changed" : addressChanged ? "Property address updated" : "Order details updated",
        });
        return tx.job.update({
          where: { id: job.id },
          data: {
            ...(clientId && { clientId }),
            ...(fields.propertyAddress != null && { propertyAddress: fields.propertyAddress }),
            ...(fields.propertyUnit !== undefined && { propertyUnit: fields.propertyUnit }),
            ...(fields.propertyCity != null && { propertyCity: fields.propertyCity }),
            ...(fields.propertyState != null && { propertyState: fields.propertyState }),
            ...(fields.propertyZip !== undefined && { propertyZip: fields.propertyZip }),
            ...(fields.propertyType != null && { propertyType: fields.propertyType }),
            ...(fields.squareFootage !== undefined && { squareFootage: fields.squareFootage }),
            ...(fields.bedrooms !== undefined && { bedrooms: fields.bedrooms }),
            ...(fields.bathrooms !== undefined && { bathrooms: fields.bathrooms }),
            ...(fields.accessNotes !== undefined && { accessNotes: fields.accessNotes }),
            ...(addressChanged && { propertyId, propertyLat: null, propertyLng: null }),
          },
        });
      });
    }),

  /** Per-appointment scheduling actions. Primary appointments keep the
   * Job.scheduledAt mirror in sync (orders architecture invariant). */
  updateAppointment: workspaceProcedure
    .input(zod.object({
      appointmentId: zod.string(),
      action: zod.enum(["RESCHEDULE", "POSTPONE", "CANCEL"]),
      scheduledAt: zod.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const appt = await ctx.prisma.appointment.findFirst({
        where: { id: input.appointmentId, workspaceId: ctx.workspace.id },
        select: { id: true, jobId: true, isPrimary: true, durationMins: true },
      });
      if (!appt) throw new TRPCError({ code: "NOT_FOUND" });
      if (input.action === "RESCHEDULE" && !input.scheduledAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "scheduledAt required to reschedule" });
      }

      await ctx.prisma.$transaction(async (tx) => {
        if (appt.isPrimary) {
          const scheduledAt = input.action === "RESCHEDULE" ? input.scheduledAt! : null;
          await tx.job.update({ where: { id: appt.jobId }, data: { scheduledAt } });
          await syncPrimaryAppointment(tx, {
            workspaceId: ctx.workspace.id,
            jobId: appt.jobId,
            scheduledAt,
            status:
              input.action === "CANCEL" ? "CANCELLED" :
              input.action === "POSTPONE" ? "POSTPONED" : "SCHEDULED",
          });
        } else {
          await tx.appointment.update({
            where: { id: appt.id },
            data:
              input.action === "RESCHEDULE"
                ? { scheduledAt: input.scheduledAt!, status: "SCHEDULED" }
                : input.action === "POSTPONE"
                ? { scheduledAt: null, status: "POSTPONED" }
                : { status: "CANCELLED" },
          });
        }
      });
      await logOrderActivity(ctx.prisma, {
        workspaceId: ctx.workspace.id,
        jobId: appt.jobId,
        userId: ctx.user.id,
        message:
          input.action === "RESCHEDULE"
            ? `Appointment rescheduled${input.scheduledAt ? ` — ${input.scheduledAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}`
            : input.action === "POSTPONE"
            ? "Appointment postponed"
            : "Appointment cancelled",
      });
      return { ok: true };
    }),

  /** Add a catalog service/product to an existing order (Services & Billing).
   * Priced server-side; totals updated additively; the caller decides how the
   * line maps to appointments. Existing invoices are not modified. */
  addOrderLine: workspaceProcedure
    .input(zod.object({
      jobId: zod.string(),
      catalogItemId: zod.string().optional(),
      quantity: zod.number().int().min(1).default(1),
      appointmentMode: zod.enum(["NONE", "EXISTING", "NEW"]).default("NONE"),
      appointmentId: zod.string().optional(),
      /** custom one-off item for this order only (used when catalogItemId is "CUSTOM") */
      custom: zod.object({
        name: zod.string().min(1).max(160),
        unitPrice: zod.number().min(0),
        durationMins: zod.number().int().min(0).max(720).default(0),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!input.custom && !input.catalogItemId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Pick a catalog item or enter a custom one" });
      }
      const job = await ctx.prisma.job.findFirst({
        where: { id: input.jobId, workspaceId: ctx.workspace.id },
        select: {
          id: true, clientId: true, squareFootage: true,
          subtotal: true, taxAmount: true, totalAmount: true, estimatedDurationMins: true,
        },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });

      const quote = await quoteOrderLines(ctx.prisma, {
        workspaceId: ctx.workspace.id,
        squareFootage: job.squareFootage ?? null,
        clientId: job.clientId,
        lines: [
          input.custom
            ? { customName: input.custom.name, unitPriceOverride: input.custom.unitPrice, quantity: input.quantity }
            : { catalogItemId: input.catalogItemId, quantity: input.quantity },
        ],
      });
      const line = quote.lines[0];
      if (!line) throw new TRPCError({ code: "NOT_FOUND", message: "Catalog item not found" });
      if (input.custom && input.custom.durationMins > 0) {
        line.durationMins = input.custom.durationMins;
      }

      const taxRate = ctx.workspace.defaultTaxRate ?? 0;
      const lineTax = (line.totalPrice * taxRate) / 100;

      await ctx.prisma.$transaction(async (tx) => {
        await tx.orderLineSnapshot.create({
          data: {
            workspaceId: ctx.workspace.id,
            jobId: job.id,
            catalogItemId: line.catalogItemId,
            versionId: line.versionId,
            source: line.source,
            name: line.name,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            totalPrice: line.totalPrice,
            durationMins: line.durationMins,
            visitMode: line.visitMode,
            fulfillmentMode: line.fulfillmentMode,
            explanation: line.explanation,
          },
        });

        if (line.productionTaskType && line.fulfillmentMode !== "ON_SITE") {
          const last = await tx.productionTask.findFirst({
            where: { jobId: job.id },
            orderBy: { sortOrder: "desc" },
            select: { sortOrder: true },
          });
          await tx.productionTask.create({
            data: {
              workspaceId: ctx.workspace.id,
              jobId: job.id,
              title: line.name,
              type: line.productionTaskType,
              sortOrder: (last?.sortOrder ?? -1) + 1,
            },
          });
        }

        if (input.appointmentMode === "NEW") {
          await tx.appointment.create({
            data: {
              workspaceId: ctx.workspace.id,
              jobId: job.id,
              title: line.name,
              scheduledAt: null,
              durationMins: line.durationMins > 0 ? line.durationMins : 60,
              status: "SCHEDULED",
              isPrimary: false,
              timeConstraint: line.solarConstraint ? "SOLAR" : null,
            },
          });
        } else if (input.appointmentMode === "EXISTING" && input.appointmentId && line.durationMins > 0) {
          const appt = await tx.appointment.findFirst({
            where: { id: input.appointmentId, jobId: job.id },
            select: { id: true, isPrimary: true, durationMins: true },
          });
          if (appt) {
            await tx.appointment.update({
              where: { id: appt.id },
              data: { durationMins: appt.durationMins + line.durationMins },
            });
            if (appt.isPrimary) {
              await tx.job.update({
                where: { id: job.id },
                data: { estimatedDurationMins: (job.estimatedDurationMins ?? 90) + line.durationMins },
              });
            }
          }
        }

        await tx.job.update({
          where: { id: job.id },
          data: {
            subtotal: job.subtotal + line.totalPrice,
            taxAmount: job.taxAmount + lineTax,
            totalAmount: job.totalAmount + line.totalPrice + lineTax,
          },
        });
        await syncInvoiceLine(tx, {
          jobId: job.id,
          mode: "ADD",
          description: line.name,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          totalPrice: line.totalPrice,
        });
        await logOrderActivity(tx, {
          workspaceId: ctx.workspace.id,
          jobId: job.id,
          userId: ctx.user.id,
          message: `Service added — ${line.name} ($${line.totalPrice.toFixed(2)})`,
        });
      });

      return { line };
    }),

  /** Raw capture files — list with short-lived signed download URLs. */
  listRawFiles: workspaceProcedure
    .input(zod.object({ jobId: zod.string() }))
    .query(async ({ ctx, input }) => {
      const files = await ctx.prisma.rawFile.findMany({
        where: { jobId: input.jobId, workspaceId: ctx.workspace.id },
        include: { uploadedBy: { select: { fullName: true } } },
        orderBy: { createdAt: "desc" },
      });
      const admin = storageAdmin();
      const withUrls = await Promise.all(
        files.map(async (f) => {
          const { data } = await admin.storage
            .from(PRIVATE_MEDIA_BUCKET)
            .createSignedUrl(f.storageKey, SIGNED_VIEW_TTL_SECONDS, { download: f.originalName });
          return { ...f, downloadUrl: data?.signedUrl ?? null };
        })
      );
      return withUrls;
    }),

  /** Register a raw file after direct-to-storage upload. */
  registerRawFile: workspaceProcedure
    .input(zod.object({
      jobId: zod.string(),
      fileName: zod.string(),
      originalName: zod.string(),
      mimeType: zod.string(),
      fileSize: zod.number().int().min(0),
      storageKey: zod.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findFirst({
        where: { id: input.jobId, workspaceId: ctx.workspace.id },
        select: { id: true },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      const created = await ctx.prisma.rawFile.create({
        data: { ...input, workspaceId: ctx.workspace.id, uploadedByUserId: ctx.user.id },
      });
      await logOrderActivity(ctx.prisma, {
        workspaceId: ctx.workspace.id,
        jobId: input.jobId,
        userId: ctx.user.id,
        message: `Raw file uploaded — ${input.originalName}`,
        collapseKey: "raw-upload",
        plural: (n) => `${n} raw files uploaded`,
      });
      return created;
    }),

  deleteRawFile: workspaceProcedure
    .input(zod.object({ fileId: zod.string() }))
    .mutation(async ({ ctx, input }) => {
      const file = await ctx.prisma.rawFile.findFirst({
        where: { id: input.fileId, workspaceId: ctx.workspace.id },
      });
      if (!file) throw new TRPCError({ code: "NOT_FOUND" });
      await storageAdmin().storage.from(PRIVATE_MEDIA_BUCKET).remove([file.storageKey]);
      await ctx.prisma.rawFile.delete({ where: { id: file.id } });
      return { ok: true };
    }),

  /** Manually add a production task to an order (command center Production tab). */
  createProductionTask: workspaceProcedure
    .input(zod.object({
      jobId: zod.string(),
      title: zod.string().min(1).max(200),
      type: zod.enum(["PHOTO_EDITING", "VIDEO_EDITING", "FLOOR_PLAN", "VIRTUAL_TOUR", "QA", "OTHER"]).default("OTHER"),
      assigneeStaffId: zod.string().nullable().optional(),
      dueAt: zod.date().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findFirst({
        where: { id: input.jobId, workspaceId: ctx.workspace.id },
        select: { id: true },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      if (input.assigneeStaffId) {
        const staff = await ctx.prisma.staffProfile.findFirst({
          where: { id: input.assigneeStaffId, workspaceId: ctx.workspace.id },
          select: { id: true },
        });
        if (!staff) throw new TRPCError({ code: "NOT_FOUND", message: "Staff member not found" });
      }
      const last = await ctx.prisma.productionTask.findFirst({
        where: { jobId: input.jobId },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      return ctx.prisma.productionTask.create({
        data: {
          workspaceId: ctx.workspace.id,
          jobId: input.jobId,
          title: input.title.trim(),
          type: input.type,
          assigneeStaffId: input.assigneeStaffId ?? null,
          dueAt: input.dueAt ?? null,
          sortOrder: (last?.sortOrder ?? -1) + 1,
        },
      });
    }),

  /** Move a production task through its lifecycle (command center Production tab). */
  updateProductionTask: workspaceProcedure
    .input(zod.object({
      taskId: zod.string(),
      status: zod.enum(["WAITING_FILES", "QUEUED", "IN_PROGRESS", "QA", "REVISION", "READY"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.prisma.productionTask.findFirst({
        where: { id: input.taskId, workspaceId: ctx.workspace.id },
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.prisma.productionTask.update({
        where: { id: task.id },
        data: { status: input.status },
      });
    }),

  /** Typed order note (docs/orders-architecture.md notes taxonomy). */
  addNote: workspaceProcedure
    .input(zod.object({
      jobId: zod.string(),
      kind: zod.enum(["CUSTOMER_INSTRUCTIONS", "INTERNAL", "FIELD", "EDITOR", "QA_REVISION"]),
      body: zod.string().min(1).max(4000),
    }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findFirst({
        where: { id: input.jobId, workspaceId: ctx.workspace.id }, select: { id: true },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.prisma.jobNote.create({
        data: {
          workspaceId: ctx.workspace.id,
          jobId: input.jobId,
          kind: input.kind,
          body: input.body.trim(),
          authorUserId: ctx.user.id,
        },
      });
    }),

  cancel: workspaceProcedure
    .input(z.object({ id: z.string(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findFirst({
        where: { id: input.id, workspaceId: ctx.workspace.id },
        include: { client: { select: { email: true, firstName: true, lastName: true } } },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });

      await cancelAppointmentsForJob(ctx.prisma, input.id);
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
        await tx.job.deleteMany({ where: { id: { in: jobIds } } });
      });

      return { success: true, deletedCount: jobs.length };
    }),
});
