import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../trpc";
import { generateJobNumber } from "@/lib/utils";
import { notifyJobBooked } from "@/lib/notify";
import { verifyPortalToken, PORTAL_COOKIE } from "@/lib/portal-auth";

// ─── Public Booking Router ────────────────────────────────────────────────────
// No auth required — used by the client-facing booking form at /book/[slug]

export const bookingRouter = router({
  // Get currently signed-in portal client (from cookie)
  getCurrentClient: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const cookieHeader = ctx.req?.headers.get("cookie") ?? "";
      const match = cookieHeader.match(new RegExp(`${PORTAL_COOKIE}=([^;]+)`));
      const token = match?.[1];
      if (!token) return { client: null };

      const session = verifyPortalToken(token);
      if (!session || session.workspaceSlug !== input.slug) return { client: null };

      const client = await ctx.prisma.client.findUnique({
        where: { id: session.clientId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          company: true,
        },
      });

      return { client };
    }),

  // List available order forms for the selection page
  listOrderForms: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const workspace = await ctx.prisma.workspace.findUnique({
        where: { slug: input.slug },
        select: {
          id: true,
          name: true,
          logoUrl: true,
          brandColor: true,
        },
      });
      if (!workspace) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Workspace not found." });
      }

      const orderForms = await ctx.prisma.orderForm.findMany({
        where: { workspaceId: workspace.id, isPublic: true },
        select: {
          id: true,
          title: true,
          description: true,
          coverImage: true,
        },
        orderBy: { createdAt: "asc" },
      });

      return { workspace, orderForms };
    }),

  // Fetch workspace info + active packages for the booking form
  getWorkspaceInfo: publicProcedure
    .input(z.object({ slug: z.string(), formId: z.string().optional() }))
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
          hours: {
            select: { dayOfWeek: true, isOpen: true, openTime: true, closeTime: true },
            orderBy: { dayOfWeek: "asc" },
          },
          bookingFormSettings: true,
        },
      });

      if (!workspace) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Booking page not found." });
      }

      // If a specific order form was requested, load its settings
      let orderForm: any = null;
      if (input.formId) {
        try {
          // Try with territoryIds first (works once prisma db push has been run)
          orderForm = await ctx.prisma.orderForm.findFirst({
            where: { id: input.formId, workspaceId: workspace.id },
            select: {
              id: true,
              title: true,
              welcomeMessage: true,
              fieldSettings: true,
              confirmationMode: true,
              assignmentStrategy: true,
              allowCustomerChoice: true,
              timeSlotInterval: true,
              paymentMode: true,
              depositPercent: true,
              customFields: true,
              territoryIds: true,
            },
          });
        } catch {
          // Fallback: column doesn't exist yet — load without territoryIds
          orderForm = await ctx.prisma.orderForm.findFirst({
            where: { id: input.formId, workspaceId: workspace.id },
            select: {
              id: true,
              title: true,
              welcomeMessage: true,
              fieldSettings: true,
              confirmationMode: true,
              assignmentStrategy: true,
              allowCustomerChoice: true,
              timeSlotInterval: true,
              paymentMode: true,
              depositPercent: true,
              customFields: true,
            },
          });
          if (orderForm) orderForm.territoryIds = [];
        }
      }

      const allPackages = await ctx.prisma.package.findMany({
        where: { workspaceId: workspace.id, isActive: true },
        include: {
          items: {
            include: { service: true },
            orderBy: { service: { name: "asc" } },
          },
        },
        orderBy: [{ isPopular: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      });

      const allServices = await ctx.prisma.service.findMany({
        where: { workspaceId: workspace.id, isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });

      // Filter by form: items with null/empty formIds show in all forms; others only in their linked forms
      const filterByForm = <T extends { formIds?: unknown }>(items: T[]): T[] => {
        if (!input.formId) return items;
        return items.filter((item) => {
          const ids = item.formIds as string[] | null | undefined;
          return !ids || ids.length === 0 || ids.includes(input.formId!);
        });
      };
      const packages = filterByForm(allPackages as any[]) as typeof allPackages;
      const services = filterByForm(allServices as any[]) as typeof allServices;

      // Load territories relevant to this form (all workspace territories, or filtered by form's territoryIds)
      const formTerritoryIds = orderForm?.territoryIds as string[] | null | undefined;
      const territories = await ctx.prisma.serviceTerritory.findMany({
        where: {
          workspaceId: workspace.id,
          ...(formTerritoryIds && formTerritoryIds.length > 0
            ? { id: { in: formTerritoryIds } }
            : {}),
        },
        select: { id: true, name: true, color: true, travelFee: true, description: true, cities: true },
        orderBy: { createdAt: "asc" },
      });

      return { workspace, orderForm, packages, services, territories };
    }),

  // Get available photographers for a given date
  // Optional territoryId: when provided, only photographers whose homeTerritory matches
  // (or who have no homeTerritory set — meaning they're available everywhere) are returned.
  getAvailablePhotographers: publicProcedure
    .input(z.object({
      slug: z.string(),
      date: z.string(),
      territoryId: z.string().optional(), // detected territory from the booking address
    }))
    .query(async ({ ctx, input }) => {
      const workspace = await ctx.prisma.workspace.findUnique({
        where: { slug: input.slug },
        select: { id: true },
      });
      if (!workspace) return { photographers: [] };

      const date = new Date(input.date + "T12:00:00");
      const dayOfWeek = date.getDay(); // 0=Sun ... 6=Sat
      const dayStart = new Date(input.date + "T00:00:00");
      const dayEnd = new Date(input.date + "T23:59:59");

      const members = await ctx.prisma.workspaceMember.findMany({
        where: {
          workspaceId: workspace.id,
          staffProfile: {
            isActive: true,
            availability: { some: { dayOfWeek, isAvailable: true } },
          },
        },
        include: {
          user: { select: { fullName: true, avatarUrl: true, email: true } },
          staffProfile: {
            include: {
              availability: { where: { dayOfWeek } },
              jobAssignments: {
                where: {
                  job: {
                    scheduledAt: { gte: dayStart, lte: dayEnd },
                    status: { not: "CANCELLED" },
                  },
                },
                select: { id: true },
              },
            },
          },
        },
      });

      const available = members
        .filter((m) => {
          if (!m.staffProfile) return false;
          // Territory filter: if a territoryId is provided, only show photographers
          // whose homeTerritoryId matches OR who have no homeTerritory (global availability)
          if (input.territoryId) {
            const homeTerritory = (m.staffProfile as any).homeTerritoryId as string | null;
            if (homeTerritory && homeTerritory !== input.territoryId) return false;
          }
          const jobCount = m.staffProfile.jobAssignments.length;
          const max = m.staffProfile.maxJobsPerDay ?? 99;
          return jobCount < max;
        })
        .map((m) => ({
          staffProfileId: m.staffProfile!.id,
          name: m.user.fullName ?? m.user.email,
          avatarUrl: m.user.avatarUrl,
          startTime: m.staffProfile!.availability[0]?.startTime ?? "08:00",
          endTime: m.staffProfile!.availability[0]?.endTime ?? "18:00",
          jobsBooked: m.staffProfile!.jobAssignments.length,
        }));

      return { photographers: available };
    }),

  // Get booked time slots for a given date to block them in the calendar
  getBookedSlots: publicProcedure
    .input(
      z.object({
        slug: z.string(),
        date: z.string(), // ISO date string "YYYY-MM-DD"
        staffProfileId: z.string().optional(), // filter to a specific photographer
      })
    )
    .query(async ({ ctx, input }) => {
      const workspace = await ctx.prisma.workspace.findUnique({
        where: { slug: input.slug },
        select: { id: true, timezone: true, jobBufferMins: true },
      });
      if (!workspace) return { bookedSlots: [], bufferMins: 15 };

      const dayStart = new Date(`${input.date}T00:00:00`);
      const dayEnd = new Date(`${input.date}T23:59:59`);

      const jobs = await ctx.prisma.job.findMany({
        where: {
          workspaceId: workspace.id,
          scheduledAt: { gte: dayStart, lte: dayEnd },
          status: { notIn: ["CANCELLED"] },
          ...(input.staffProfileId
            ? { assignments: { some: { staffProfileId: input.staffProfileId } } }
            : {}),
        },
        select: { scheduledAt: true, estimatedDurationMins: true },
      });

      return {
        bookedSlots: jobs.map((j) => ({
          scheduledAt: j.scheduledAt,
          durationMins: j.estimatedDurationMins,
        })),
        bufferMins: workspace.jobBufferMins,
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
        propertyLat: z.number().optional(),
        propertyLng: z.number().optional(),

        // Booking
        packageId: z.string().optional(),
        serviceIds: z.array(z.string()).optional(), // à la carte service selection
        staffProfileId: z.string().optional(), // assigned photographer
        scheduledAt: z.string(), // ISO datetime string
        clientNotes: z.string().optional(),
        formId: z.string().optional(), // order form ID to check confirmation mode
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

      // Check confirmation mode from order form (default: IMMEDIATE = auto-confirm)
      let confirmationMode = "IMMEDIATE";
      if (input.formId) {
        const orderForm = await ctx.prisma.orderForm.findFirst({
          where: { id: input.formId, workspaceId: workspace.id },
          select: { confirmationMode: true },
        });
        if (orderForm) confirmationMode = orderForm.confirmationMode;
      }

      // Validate package belongs to this workspace if provided
      let pkg = null;
      if (input.packageId) {
        pkg = await ctx.prisma.package.findFirst({
          where: { id: input.packageId, workspaceId: workspace.id, isActive: true },
        });
        if (!pkg) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid package." });
      }

      // Validate à la carte services if provided
      let alaCarteServices: { id: string; name: string; basePrice: number; durationMins: number }[] = [];
      if (!input.packageId && input.serviceIds && input.serviceIds.length > 0) {
        alaCarteServices = await ctx.prisma.service.findMany({
          where: { id: { in: input.serviceIds }, workspaceId: workspace.id, isActive: true },
          select: { id: true, name: true, basePrice: true, durationMins: true },
        });
        if (alaCarteServices.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid services selected." });
        }
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

        // Determine financials from package or à la carte services
        const subtotal = pkg?.price ?? alaCarteServices.reduce((sum, s) => sum + s.basePrice, 0);

        // Auto-calculate estimated duration from service durations
        let estimatedDurationMins = 60; // default fallback
        if (pkg && input.packageId) {
          const pkgForDuration = await tx.package.findUnique({
            where: { id: input.packageId },
            include: { items: { include: { service: { select: { durationMins: true } } } } },
          });
          if (pkgForDuration?.items?.length) {
            const totalServiceMins = pkgForDuration.items.reduce(
              (sum, item) => sum + (item.service.durationMins * item.quantity),
              0
            );
            if (totalServiceMins > 0) estimatedDurationMins = totalServiceMins;
          }
        } else if (alaCarteServices.length > 0) {
          const totalServiceMins = alaCarteServices.reduce(
            (sum, s) => sum + s.durationMins,
            0
          );
          if (totalServiceMins > 0) estimatedDurationMins = totalServiceMins;
        }

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
            propertyLat: input.propertyLat,
            propertyLng: input.propertyLng,
            scheduledAt,
            estimatedDurationMins,
            clientNotes: input.clientNotes,
            status: confirmationMode === "IMMEDIATE" ? "CONFIRMED" : "PENDING",
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

        // If à la carte services selected, add them to the job
        if (alaCarteServices.length > 0) {
          await tx.jobService.createMany({
            data: alaCarteServices.map((svc) => ({
              jobId: job.id,
              serviceId: svc.id,
              quantity: 1,
              unitPrice: svc.basePrice,
              totalPrice: svc.basePrice,
            })),
          });
        }

        // Assign photographer if selected
        if (input.staffProfileId) {
          await tx.jobAssignment.create({
            data: {
              jobId: job.id,
              staffId: input.staffProfileId,
              role: "PHOTOGRAPHER",
              isPrimary: true,
            },
          });
        }

        return { job, client };
      });

      const clientName = `${input.firstName} ${input.lastName}`;
      const pkgName = pkg?.name ?? (alaCarteServices.length > 0 ? alaCarteServices.map((s) => s.name).join(", ") : "");

      if (confirmationMode === "IMMEDIATE") {
        // Auto-confirm: send confirmation email to client + in-app notification
        notifyJobBooked({
          workspaceId: workspace.id,
          jobId: result.job.id,
          clientEmail: input.email,
          clientName,
          jobNumber: result.job.jobNumber,
          propertyAddress: input.propertyAddress,
          scheduledAt,
          packageName: pkgName,
        }).catch(console.error);
      } else {
        // Manual confirmation: notify workspace owner to review, send pending notice to client
        // In-app notification for workspace owner
        ctx.prisma.notification.create({
          data: {
            workspaceId: workspace.id,
            jobId: result.job.id,
            type: "JOB_BOOKED",
            channel: "IN_APP",
            status: "DELIVERED",
            title: `New booking request — ${result.job.jobNumber}`,
            body: `${clientName} is requesting a booking at ${input.propertyAddress}. Review and confirm.`,
            sentAt: new Date(),
          },
        }).catch(console.error);

        // Also send the standard notification so emails still go out
        notifyJobBooked({
          workspaceId: workspace.id,
          jobId: result.job.id,
          clientEmail: input.email,
          clientName,
          jobNumber: result.job.jobNumber,
          propertyAddress: input.propertyAddress,
          scheduledAt,
          packageName: pkgName,
        }).catch(console.error);
      }

      return {
        jobId: result.job.id,
        jobNumber: result.job.jobNumber,
        clientName,
        propertyAddress: input.propertyAddress,
        scheduledAt: input.scheduledAt,
        packageName: pkg?.name ?? null,
        confirmed: confirmationMode === "IMMEDIATE",
      };
    }),
});
