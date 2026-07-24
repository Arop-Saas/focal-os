import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../trpc";
import { generateJobNumber } from "@/lib/utils";
import { notifyJobBooked } from "@/lib/notify";
import { assertSlotBookable, getDayAvailability, takeSchedulingLock, SlotUnavailableError } from "@/lib/scheduling/loader";
import { utcToWallDateISO } from "@/lib/scheduling/tz";
import { verifyPortalToken, PORTAL_COOKIE } from "@/lib/portal-auth";
import { syncPrimaryAppointment } from "@/lib/orders/appointments";
import { findOrCreateProperty } from "@/lib/orders/property";
import { quoteOrderLines, snapshotAndGenerate, applyOrderAdjustments } from "@/lib/orders/pricing";
import { createInvoiceForJob, InvoiceExistsError } from "@/lib/money/invoice";

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
              minBookingNoticeHours: true,
              maxAdvanceBookingDays: true,
              paymentMode: true,
              depositType: true,
              depositPercent: true,
              depositFixed: true,
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
              minBookingNoticeHours: true,
              maxAdvanceBookingDays: true,
              paymentMode: true,
              depositType: true,
              depositPercent: true,
              depositFixed: true,
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
      // Catalog offerings take over the form's selection when any exist for it
      // (opt-in per form via Services & Pricing → "Offered on"); otherwise the
      // legacy formIds filter keeps working unchanged.
      let packages = filterByForm(allPackages as any[]) as typeof allPackages;
      let services = filterByForm(allServices as any[]) as typeof allServices;
      if (input.formId) {
        const offerings = await ctx.prisma.offering.findMany({
          where: {
            orderFormId: input.formId,
            visible: true,
            item: { state: "PUBLISHED" },
          },
          select: { item: { select: { legacyServiceId: true, legacyPackageId: true } } },
        });
        if (offerings.length > 0) {
          const offeredServiceIds = new Set(offerings.map((o) => o.item.legacyServiceId).filter(Boolean));
          const offeredPackageIds = new Set(offerings.map((o) => o.item.legacyPackageId).filter(Boolean));
          packages = allPackages.filter((pk) => offeredPackageIds.has(pk.id));
          services = allServices.filter((sv) => offeredServiceIds.has(sv.id));
        }
      }

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

  // Server-computed availability from the ONE scheduling engine.
  // Honors: staff windows, time off, existing jobs + buffers, travel
  // feasibility from home base / previous job, package duration, form
  // notice/advance windows, slot interval, workspace timezone.
  getAvailableSlots: publicProcedure
    .input(
      z.object({
        slug: z.string(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        formId: z.string().optional(),
        packageId: z.string().optional(),
        serviceIds: z.array(z.string()).optional(),
        territoryId: z.string().optional(),
        staffProfileId: z.string().optional(),
        address: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const workspace = await ctx.prisma.workspace.findUnique({
        where: { slug: input.slug },
        select: { id: true },
      });
      if (!workspace) {
        return { timezone: "UTC", durationMins: 60, slotIntervalMins: 30, staffSlots: [] };
      }
      return getDayAvailability(ctx.prisma, {
        workspaceId: workspace.id,
        dateISO: input.date,
        formId: input.formId,
        packageId: input.packageId,
        serviceIds: input.serviceIds,
        territoryId: input.territoryId,
        staffProfileId: input.staffProfileId,
        targetAddress: input.address ?? null,
      });
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
        couponCode: z.string().max(40).optional(),
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

      // ── Scheduling engine enforcement (S1) — full check incl. travel ──
      const targetAddress = [input.propertyAddress, input.propertyCity, input.propertyState, input.propertyZip]
        .filter(Boolean)
        .join(", ");
      try {
        await assertSlotBookable(ctx.prisma, {
          workspaceId: workspace.id,
          scheduledAt,
          staffProfileId: input.staffProfileId,
          packageId: input.packageId,
          serviceIds: input.serviceIds,
          formId: input.formId,
          targetAddress,
        });
      } catch (e) {
        if (e instanceof SlotUnavailableError) {
          throw new TRPCError({ code: "CONFLICT", message: e.message });
        }
        throw e;
      }

      const result = await ctx.prisma.$transaction(async (tx) => {
        // Serialize concurrent bookings for this photographer (or workspace
        // day), then revalidate on fresh data INSIDE the transaction — this
        // is what makes double-booking impossible. Travel was validated
        // pre-transaction; the in-tx pass skips it to stay fast.
        const lockKey =
          input.staffProfileId ??
          `ws:${workspace.id}:${utcToWallDateISO(scheduledAt, workspace.timezone)}`;
        await takeSchedulingLock(tx, lockKey);
        try {
          await assertSlotBookable(tx, {
            workspaceId: workspace.id,
            scheduledAt,
            staffProfileId: input.staffProfileId,
            packageId: input.packageId,
            serviceIds: input.serviceIds,
            formId: input.formId,
            targetAddress: null,
          });
        } catch (e) {
          if (e instanceof SlotUnavailableError) {
            throw new TRPCError({ code: "CONFLICT", message: e.message });
          }
          throw e;
        }

        // Upsert client by email within this workspace
        let client = await tx.client.findFirst({
          where: { workspaceId: workspace.id, email: input.email },
        });

        // L3: the client record was auto-created from a booking form —
        // keep its contact details in sync with what the client just typed.
        // CRM-managed records (any other source) are never overwritten.
        if (client && client.source === "booking_form") {
          const patch: Record<string, string> = {};
          if (input.firstName && input.firstName !== client.firstName) patch.firstName = input.firstName;
          if (input.lastName && input.lastName !== client.lastName) patch.lastName = input.lastName;
          if (input.phone && !client.phone) patch.phone = input.phone;
          if (input.company && !client.company) patch.company = input.company;
          if (Object.keys(patch).length > 0) {
            client = await tx.client.update({ where: { id: client.id }, data: patch });
          }
        }

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

        // Atomic JOB counter — separate sequence from invoices (R11).
        const wsCounter = await tx.workspace.update({
          where: { id: workspace.id },
          data: { jobNextNumber: { increment: 1 } },
          select: { jobNextNumber: true, jobPrefix: true },
        });
        const jobNumber = generateJobNumber(
          wsCounter.jobPrefix ?? "JOB",
          wsCounter.jobNextNumber - 1
        );

        // Price through THE pricing service (sqft rules + explanations).
        // If any line has no catalog identity (unbridged), fall back to the
        // legacy sum so a half-migrated catalog can never misprice a booking.
        const quoted = await quoteOrderLines(tx, {
          workspaceId: workspace.id,
          squareFootage: input.squareFootage ?? null,
          clientId: client.id,
          lines: input.packageId
            ? [{ packageId: input.packageId, quantity: 1 }]
            : alaCarteServices.map((svc) => ({ serviceId: svc.id, quantity: 1 })),
        });
        const quoteResolved = quoted.lines.length > 0 && quoted.lines.every((l) => l.source !== "CUSTOM");
        const baseSubtotal = quoteResolved
          ? quoted.subtotal
          : (pkg?.price ?? alaCarteServices.reduce((sum, s) => sum + s.basePrice, 0));
        // Order-level adjustments (after-hours / weekend / minimum order)
        const adjusted = await applyOrderAdjustments(tx, {
          workspaceId: workspace.id,
          subtotal: baseSubtotal,
          scheduledAt,
        });
        const subtotal = adjusted.adjustedSubtotal;

        // Coupon (validated + atomically counted; silently skipped if invalid
        // so a stale code never blocks a booking — the form validates upfront)
        let discountAmount = 0;
        if (input.couponCode) {
          const coupon = await tx.coupon.findUnique({
            where: { workspaceId_code: { workspaceId: workspace.id, code: input.couponCode.trim().toUpperCase() } },
          });
          const valid =
            coupon &&
            coupon.isActive &&
            (!coupon.expiresAt || coupon.expiresAt > new Date()) &&
            (coupon.maxUses == null || coupon.usedCount < coupon.maxUses);
          if (valid && coupon) {
            discountAmount =
              coupon.discountType === "PERCENTAGE"
                ? Math.round(subtotal * coupon.discountValue) / 100
                : Math.min(coupon.discountValue, subtotal);
            await tx.coupon.update({
              where: { id: coupon.id },
              data: { usedCount: { increment: 1 } },
            });
          }
        }

        // Auto-calculate estimated duration: prefer package.durationMins, fallback to sum of service durations
        let estimatedDurationMins = 60; // default fallback
        if (pkg && input.packageId) {
          const pkgForDuration = await tx.package.findUnique({
            where: { id: input.packageId },
            include: { items: { include: { service: { select: { durationMins: true } } } } },
          });
          // Use package-level duration if set, otherwise sum individual service durations
          if (pkgForDuration?.durationMins && pkgForDuration.durationMins > 0) {
            estimatedDurationMins = pkgForDuration.durationMins;
          } else if (pkgForDuration?.items?.length) {
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
        // Rule-adjusted durations from the quote win when fully resolved
        if (quoteResolved) {
          const quotedMins = quoted.lines
            .filter((l) => l.visitMode === "SAME_VISIT" && l.fulfillmentMode !== "PRODUCTION_ONLY")
            .reduce((sum, l) => sum + l.durationMins, 0);
          if (quotedMins > 0) estimatedDurationMins = quotedMins;
        }

        const property = await findOrCreateProperty(tx, {
          workspaceId: workspace.id,
          address: input.propertyAddress,
          city: input.propertyCity,
          state: input.propertyState,
          zip: input.propertyZip,
          propertyType: input.propertyType,
          squareFootage: input.squareFootage,
          bedrooms: input.bedrooms,
          bathrooms: input.bathrooms,
          mlsNumber: input.mlsNumber,
          accessNotes: input.accessNotes,
          lat: input.propertyLat,
          lng: input.propertyLng,
        });

        // Create job
        const job = await tx.job.create({
          data: {
            workspaceId: workspace.id,
            jobNumber,
            propertyId: property.id,
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
            discountAmount,
            totalAmount: Math.max(0, subtotal - discountAmount),
          },
        });

        if (discountAmount > 0 && input.couponCode) {
          const coupon = await tx.coupon.findUnique({
            where: { workspaceId_code: { workspaceId: workspace.id, code: input.couponCode.trim().toUpperCase() } },
            select: { id: true },
          });
          if (coupon) {
            await tx.couponUsage.create({
              data: { couponId: coupon.id, orderId: job.id, email: client.email },
            });
          }
        }

        // Mirror into the primary Appointment (orders architecture invariant)
        await syncPrimaryAppointment(tx, {
          workspaceId: workspace.id,
          jobId: job.id,
          scheduledAt: job.scheduledAt,
          durationMins: job.estimatedDurationMins,
        });

        // Frozen order lines + generated work (tasks / separate visits)
        if (quoteResolved) {
          await snapshotAndGenerate(tx, {
            workspaceId: workspace.id,
            jobId: job.id,
            lines: quoted.lines,
          });
        }

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

        // Assign photographer if selected — linked to the primary appointment
        // so the command center's appointment rows show the crew.
        if (input.staffProfileId) {
          const primaryAppt = await tx.appointment.findFirst({
            where: { jobId: job.id, isPrimary: true },
            select: { id: true },
          });
          await tx.jobAssignment.create({
            data: {
              jobId: job.id,
              staffId: input.staffProfileId,
              appointmentId: primaryAppt?.id ?? null,
              role: "PHOTOGRAPHER",
              isPrimary: true,
            },
          });
        }

        return { job, client };
      }, { timeout: 15000 });

      // Every order gets an invoice up front (draft until sent).
      try {
        await createInvoiceForJob(ctx.prisma, { workspaceId: workspace.id, jobId: result.job.id });
      } catch (e) {
        if (!(e instanceof InvoiceExistsError)) console.error("Auto-invoice on booking failed:", e);
      }

      const clientName = `${input.firstName} ${input.lastName}`;
      const pkgName = pkg?.name ?? (alaCarteServices.length > 0 ? alaCarteServices.map((s) => s.name).join(", ") : "");

      // ── S7 (B6): client bookings now land on the photographer's Google
      // Calendar immediately (previously only admin-assigned jobs did).
      if (input.staffProfileId) {
        void (async () => {
          try {
            const staff = await ctx.prisma.staffProfile.findUnique({
              where: { id: input.staffProfileId! },
              include: { member: { include: { user: { select: { googleRefreshToken: true, googleCalendarId: true } } } } },
            });
            const token = staff?.member?.user?.googleRefreshToken;
            if (!token) return;
            const { createCalendarEvent } = await import("@/lib/gcal");
            const durationMins = result.job.estimatedDurationMins ?? 60;
            const eventId = await createCalendarEvent(token, {
              title: `📷 Shoot — ${input.propertyAddress}`,
              description: `Job ${result.job.jobNumber} · booked online by ${input.firstName} ${input.lastName}`,
              startAt: scheduledAt,
              endAt: new Date(scheduledAt.getTime() + durationMins * 60000),
              location: targetAddress,
              calendarId: staff?.member?.user?.googleCalendarId ?? undefined,
            });
            if (eventId) {
              await ctx.prisma.jobAssignment.updateMany({
                where: { jobId: result.job.id, staffId: input.staffProfileId! },
                data: { gcalEventId: String(eventId) },
              });
            }
          } catch (e) {
            console.error("booking gcal push failed:", e);
          }
        })();
      }

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
