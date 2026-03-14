import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "../trpc";
import { generateJobNumber } from "@/lib/utils";
import {
  notifyJobBooked,
  notifyJobConfirmed,
  notifyJobAssigned,
  notifyJobCancelled,
  notifyJobDelivered,
} from "@/lib/notify";
import { createCalendarEvent } from "@/lib/gcal";

const JobCreateSchema = z.object({
  clientId: z.string(),
  packageId: z.string().optional(),
  propertyAddress: z.string().min(5),
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
  isRush: z.boolean().default(false),
  rushFee: z.number().default(0),
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

      // Calculate totals
      let subtotal = 0;
      const serviceItems = await Promise.all(
        services.map(async (s) => {
          const service = await ctx.prisma.service.findFirst({
            where: { id: s.serviceId, workspaceId: ctx.workspace.id },
          });
          if (!service) throw new TRPCError({ code: "NOT_FOUND", message: `Service ${s.serviceId} not found` });
          const totalPrice = s.unitPrice * s.quantity;
          subtotal += totalPrice;
          return { ...s, totalPrice };
        })
      );

      // If package selected, add package price
      if (jobData.packageId) {
        const pkg = await ctx.prisma.package.findFirst({
          where: { id: jobData.packageId, workspaceId: ctx.workspace.id },
        });
        if (pkg) subtotal = pkg.price;
      }

      const taxAmount = (subtotal * (ctx.workspace.defaultTaxRate ?? 0)) / 100;
      const totalAmount = subtotal + taxAmount + (jobData.rushFee ?? 0);

      // Get next job number
      const ws = await ctx.prisma.workspace.findUnique({
        where: { id: ctx.workspace.id },
        select: { invoiceNextNumber: true, invoicePrefix: true },
      });
      const jobNumber = generateJobNumber(
        ws?.invoicePrefix ?? "JOB",
        ws?.invoiceNextNumber ?? 1001
      );

      const job = await ctx.prisma.$transaction(async (tx) => {
        // Increment job counter
        await tx.workspace.update({
          where: { id: ctx.workspace.id },
          data: { invoiceNextNumber: { increment: 1 } },
        });

        const newJob = await tx.job.create({
          data: {
            workspaceId: ctx.workspace.id,
            jobNumber,
            clientId: jobData.clientId,
            packageId: jobData.packageId,
            propertyAddress: jobData.propertyAddress,
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
            estimatedDurationMins: jobData.estimatedDurationMins,
            internalNotes: jobData.internalNotes,
            clientNotes: jobData.clientNotes,
            priority: jobData.priority,
            isRush: jobData.isRush,
            rushFee: jobData.rushFee,
            subtotal,
            taxAmount,
            totalAmount,
            amountDue: totalAmount,
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

      return job;
    }),

  // Update job
  update: workspaceProcedure
    .input(
      z.object({
        id: z.string(),
        scheduledAt: z.date().optional(),
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
        isRush: z.boolean().optional(),
        rushFee: z.number().optional(),
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
          void notifyJobDelivered({
            workspaceId: ctx.workspace.id,
            jobId: id,
            userId: ctx.user.id,
            clientEmail,
            clientName,
            jobNumber: fullJob.jobNumber,
            propertyAddress: fullJob.propertyAddress,
            galleryUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://focal-os.vercel.app"}/gallery/${id}`,
          });
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

      return cancelled;
    }),
});
