import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../trpc";
import { generateJobNumber } from "@/lib/utils";
import { notifyJobBooked } from "@/lib/notify";

// ─── Public Booking Router ────────────────────────────────────────────────────
// No auth required — used by the client-facing booking form at /book/[slug]

export const bookingRouter = router({
  // Fetch workspace info + active packages for the booking form
  getWorkspaceInfo: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const workspace = await ctx.prisma.workspace.findUnique({
        where: { slug: input.slug },
        select: {
          id: true,
          name: true,
          logoUrl: true,
          brandColor: true,
          timezone: true,
          phone: true,
          email: true,
        },
      });

      if (!workspace) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Booking page not found." });
      }

      const packages = await ctx.prisma.package.findMany({
        where: { workspaceId: workspace.id, isActive: true },
        include: {
          items: {
            include: { service: true },
            orderBy: { service: { name: "asc" } },
          },
        },
        orderBy: [{ isPopular: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      });

      return { workspace, packages };
    }),

  // Get booked time slots for a given date to block them in the calendar
  getBookedSlots: publicProcedure
    .input(
      z.object({
        slug: z.string(),
        date: z.string(), // ISO date string "YYYY-MM-DD"
      })
    )
    .query(async ({ ctx, input }) => {
      const workspace = await ctx.prisma.workspace.findUnique({
        where: { slug: input.slug },
        select: { id: true, timezone: true },
      });
      if (!workspace) return { bookedSlots: [] };

      const dayStart = new Date(`${input.date}T00:00:00`);
      const dayEnd = new Date(`${input.date}T23:59:59`);

      const jobs = await ctx.prisma.job.findMany({
        where: {
          workspaceId: workspace.id,
          scheduledAt: { gte: dayStart, lte: dayEnd },
          status: {
            notIn: ["CANCELLED"],
          },
        },
        select: { scheduledAt: true, estimatedDurationMins: true },
      });

      return {
        bookedSlots: jobs.map((j) => ({
          scheduledAt: j.scheduledAt,
          durationMins: j.estimatedDurationMins,
        })),
      };
    }),

  // Submit the booking form — creates/finds client, creates job, fires email
  submit: publicProcedure
    .input(
      z.object({
        slug: z.string(),

        // Contact
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        company: z.string().optional(),

        // Property
        propertyAddress: z.string().min(5),
        propertyCity: z.string().min(1),
        propertyState: z.string().min(2),
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
        accessNotes: z.string().optional(),

        // Booking
        packageId: z.string().optional(),
        scheduledAt: z.string(), // ISO datetime string
        clientNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const workspace = await ctx.prisma.workspace.findUnique({
        where: { slug: input.slug },
        select: { id: true, name: true, timezone: true, invoiceNextNumber: true, invoicePrefix: true },
      });

      if (!workspace) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Booking page not found." });
      }

      // Validate package belongs to this workspace if provided
      let pkg = null;
      if (input.packageId) {
        pkg = await ctx.prisma.package.findFirst({
          where: { id: input.packageId, workspaceId: workspace.id, isActive: true },
        });
        if (!pkg) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid package." });
      }

      const scheduledAt = new Date(input.scheduledAt);

      const result = await ctx.prisma.$transaction(async (tx) => {
        // Upsert client by email within this workspace
        let client = await tx.client.findFirst({
          where: { workspaceId: workspace.id, email: input.email },
        });

        if (!client) {
          client = await tx.client.create({
            data: {
              workspaceId: workspace.id,
              firstName: input.firstName,
              lastName: input.lastName,
              email: input.email,
              phone: input.phone,
              company: input.company,
              source: "booking_form",
              status: "ACTIVE",
              type: "AGENT",
            },
          });
        }

        // Generate job number and increment counter
        await tx.workspace.update({
          where: { id: workspace.id },
          data: { invoiceNextNumber: { increment: 1 } },
        });
        const jobNumber = generateJobNumber(
          workspace.invoicePrefix ?? "JOB",
          workspace.invoiceNextNumber
        );

        // Determine financials from package
        const subtotal = pkg?.price ?? 0;

        // Create job
        const job = await tx.job.create({
          data: {
            workspaceId: workspace.id,
            jobNumber,
            clientId: client.id,
            packageId: input.packageId ?? null,
            propertyAddress: input.propertyAddress,
            propertyCity: input.propertyCity,
            propertyState: input.propertyState,
            propertyZip: input.propertyZip,
            propertyType: input.propertyType,
            squareFootage: input.squareFootage,
            bedrooms: input.bedrooms,
            bathrooms: input.bathrooms,
            mlsNumber: input.mlsNumber,
            accessNotes: input.accessNotes,
            scheduledAt,
            clientNotes: input.clientNotes,
            status: "PENDING",
            subtotal,
            totalAmount: subtotal,
          },
        });

        // If package has services, add them to the job
        if (pkg && input.packageId) {
          const pkgWithItems = await tx.package.findUnique({
            where: { id: input.packageId },
            include: { items: { include: { service: true } } },
          });
          if (pkgWithItems?.items?.length) {
            await tx.jobService.createMany({
              data: pkgWithItems.items.map((item) => ({
                jobId: job.id,
                serviceId: item.serviceId,
                quantity: item.quantity,
                unitPrice: item.service.basePrice,
                totalPrice: item.service.basePrice * item.quantity,
              })),
            });
          }
        }

        return { job, client };
      });

      // Fire booking confirmation email (fire-and-forget)
      notifyJobBooked({
        workspaceId: workspace.id,
        jobId: result.job.id,
        clientEmail: input.email,
        clientName: `${input.firstName} ${input.lastName}`,
        jobNumber: result.job.jobNumber,
        propertyAddress: input.propertyAddress,
        scheduledAt,
        packageName: pkg?.name ?? "",
      }).catch(console.error);

      return {
        jobId: result.job.id,
        jobNumber: result.job.jobNumber,
        clientName: `${input.firstName} ${input.lastName}`,
        propertyAddress: input.propertyAddress,
        scheduledAt: input.scheduledAt,
        packageName: pkg?.name ?? null,
      };
    }),
});
