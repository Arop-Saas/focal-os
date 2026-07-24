import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure, workspaceProcedure, adminProcedure, ownerProcedure } from "../trpc";
import { slugify } from "@/lib/utils";
import { sendWelcomeEmail } from "@/lib/resend";
import { type BookingFormSettings, type PortalSettings, DEFAULT_BOOKING_FORM_SETTINGS, DEFAULT_PORTAL_SETTINGS } from "@/lib/booking-form-types";

// Subdomain-style slugs that can never be claimed by a workspace
const RESERVED_SLUGS = new Set([
  "www", "app", "api", "admin", "mail", "email", "portal", "book", "booking",
  "help", "support", "status", "blog", "docs", "dashboard", "billing",
  "staging", "dev", "test", "demo", "assets", "cdn", "static", "scalist",
]);

export const workspaceRouter = router({
  // Get current workspace
  getCurrent: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.prisma.workspace.findUnique({
      where: { id: ctx.workspace.id },
      include: {
        _count: {
          select: {
            members: true,
            clients: true,
            jobs: true,
            staff: true,
          },
        },
      },
    });
  }),

  // Is a workspace slug (future subdomain) still available?
  slugAvailable: protectedProcedure
    .input(z.object({ slug: z.string().min(2).max(50) }))
    .query(async ({ ctx, input }) => {
      const slug = input.slug.toLowerCase();
      if (RESERVED_SLUGS.has(slug)) return { available: false };
      const existing = await ctx.prisma.workspace.findUnique({ where: { slug } });
      return { available: !existing };
    }),

  // Create workspace (during onboarding)
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(100),
        slug: z.string().min(2).max(50).optional(),
        phone: z.string().min(7, "Phone number is required"),
        email: z.string().email().optional(),
        timezone: z.string().default("America/New_York"),
        currency: z.string().default("USD"),
        country: z.string().default("US"),
        addressLine1: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        postalCode: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const slug = (input.slug ?? slugify(input.name)).toLowerCase();

      if (RESERVED_SLUGS.has(slug)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This workspace address is reserved. Try a different company name.",
        });
      }

      // Check slug uniqueness
      const existing = await ctx.prisma.workspace.findUnique({
        where: { slug },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A workspace with this address already exists. Add your city or region to the name to make it unique.",
        });
      }

      // Create workspace + add current user as owner
      const workspace = await ctx.prisma.$transaction(async (tx) => {
        const ws = await tx.workspace.create({
          data: {
            name: input.name,
            slug,
            phone: input.phone,
            email: input.email,
            timezone: input.timezone,
            currency: input.currency,
            country: input.country,
            addressLine1: input.addressLine1,
            city: input.city,
            state: input.state,
            postalCode: input.postalCode,
            trialEndsAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days (3-month free trial)
          },
        });

        // Add user as owner member
        const member = await tx.workspaceMember.create({
          data: {
            workspaceId: ws.id,
            userId: ctx.user.id,
            role: "OWNER",
            isOwner: true,
          },
        });

        // Create staff profile for owner
        await tx.staffProfile.create({
          data: {
            workspaceId: ws.id,
            memberId: member.id,
            skills: [],
            serviceRegions: [],
          },
        });

        // Onboarding completed in a separate step after services/team setup

        return ws;
      });

      // Send welcome email (non-blocking — don't fail signup if email errors)
      sendWelcomeEmail({
        to: ctx.user.email,
        ownerName: ctx.user.fullName ?? ctx.user.email,
        workspaceName: workspace.name,
        workspaceSlug: workspace.slug,
      }).catch((err) => console.error("[workspace.create] welcome email failed:", err));

      return workspace;
    }),

  // Returns the current user's WorkspaceMember record (role, id, isOwner)
  getMyMembership: workspaceProcedure.query(async ({ ctx }) => {
    const member = await ctx.prisma.workspaceMember.findFirst({
      where: { workspaceId: ctx.workspace.id, userId: ctx.user.id },
      select: { id: true, role: true, isOwner: true },
    });
    return member;
  }),

  // Update workspace settings (ADMIN+ only)
  update: adminProcedure
    .input(
      z.object({
        name: z.string().min(2).max(100).optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        website: z.string().url().optional(),
        timezone: z.string().optional(),
        currency: z.string().optional(),
        addressLine1: z.string().optional(),
        addressLine2: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        postalCode: z.string().optional(),
        defaultTaxRate: z.number().min(0).max(100).optional(),
        invoicePrefix: z.string().max(10).optional(),
        brandColor: z.string().optional(),
        logoUrl: z.string().url().optional(),
        autoCreateInvoice: z.boolean().optional(),
        invoiceDueDays: z.number().int().min(0).max(365).optional(),
        lockDownloads: z.boolean().optional(),
        reminderEnabled: z.boolean().optional(),
        reminderDaysBefore: z.string().max(50).optional(),
        reminderOverdueRepeat: z.number().int().min(0).max(90).optional(),
        showBranding: z.boolean().optional(),
        emailSubtitle: z.string().max(100).optional(),
        estimatedShootsPerMonth: z.string().max(20).optional(),
        pricingRulesEnabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.workspace.update({
        where: { id: ctx.workspace.id },
        data: input,
      });
    }),

  // Get workspace stats for dashboard
  getStats: workspaceProcedure.query(async ({ ctx }) => {
    const workspaceId = ctx.workspace.id;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalJobs,
      jobsThisMonth,
      jobsLastMonth,
      revenueThisMonth,
      revenueLastMonth,
      pendingInvoices,
      activeClients,
      upcomingJobs,
    ] = await Promise.all([
      // Total jobs
      ctx.prisma.job.count({ where: { workspaceId } }),

      // Jobs this month
      ctx.prisma.job.count({
        where: {
          workspaceId,
          scheduledAt: { gte: startOfMonth },
          status: { not: "CANCELLED" },
        },
      }),

      // Jobs last month
      ctx.prisma.job.count({
        where: {
          workspaceId,
          scheduledAt: { gte: startOfLastMonth, lte: endOfLastMonth },
          status: { not: "CANCELLED" },
        },
      }),

      // Revenue this month (paid invoices)
      ctx.prisma.invoice.aggregate({
        where: {
          workspaceId,
          status: "PAID",
          paidAt: { gte: startOfMonth },
        },
        _sum: { totalAmount: true },
      }),

      // Revenue last month
      ctx.prisma.invoice.aggregate({
        where: {
          workspaceId,
          status: "PAID",
          paidAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
        _sum: { totalAmount: true },
      }),

      // Pending invoice total
      ctx.prisma.invoice.aggregate({
        where: {
          workspaceId,
          status: { in: ["SENT", "VIEWED", "PARTIAL", "OVERDUE"] },
        },
        _sum: { amountDue: true },
      }),

      // Active clients
      ctx.prisma.client.count({
        where: { workspaceId, status: "ACTIVE" },
      }),

      // Upcoming jobs (next 7 days)
      ctx.prisma.job.findMany({
        where: {
          workspaceId,
          scheduledAt: {
            gte: now,
            lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          },
          status: { in: ["CONFIRMED", "ASSIGNED"] },
        },
        include: {
          client: { select: { firstName: true, lastName: true } },
          assignments: {
            include: { staff: { include: { member: { include: { user: true } } } } },
            where: { isPrimary: true },
          },
        },
        orderBy: { scheduledAt: "asc" },
        take: 10,
      }),
    ]);

    const revenueThisMonthVal = revenueThisMonth._sum.totalAmount ?? 0;
    const revenueLastMonthVal = revenueLastMonth._sum.totalAmount ?? 0;
    const revenueDelta =
      revenueLastMonthVal === 0
        ? 100
        : ((revenueThisMonthVal - revenueLastMonthVal) / revenueLastMonthVal) * 100;

    const jobsDelta =
      jobsLastMonth === 0
        ? 100
        : ((jobsThisMonth - jobsLastMonth) / jobsLastMonth) * 100;

    return {
      totalJobs,
      jobsThisMonth,
      jobsDelta: Math.round(jobsDelta),
      revenueThisMonth: revenueThisMonthVal,
      revenueDelta: Math.round(revenueDelta),
      pendingInvoicesTotal: pendingInvoices._sum.amountDue ?? 0,
      activeClients,
      upcomingJobs,
    };
  }),

  // ── Integrations ─────────────────────────────────────────────────────────

  // Get integration status (masked keys)
  getIntegrations: workspaceProcedure.query(async ({ ctx }) => {
    const ws = await ctx.prisma.workspace.findUnique({
      where: { id: ctx.workspace.id },
      select: {
        stripePublishableKey: true,
        stripeSecretKey: true,
        stripeAccountId: true,
        googleCalendarConnected: true,
        googleCalendarEmail: true,
      },
    });
    if (!ws) throw new TRPCError({ code: "NOT_FOUND" });
    return {
      stripe: {
        // Connect is the real integration; pasted keys are legacy.
        connected: !!(ws as { stripeAccountId?: string | null }).stripeAccountId || !!(ws.stripePublishableKey && ws.stripeSecretKey),
        connectAccountId: (ws as { stripeAccountId?: string | null }).stripeAccountId ?? null,
        legacyKeys: !!ws.stripeSecretKey,
        publishableKey: ws.stripePublishableKey ?? null,
        // never return the secret key to the client — just presence
        hasSecretKey: !!ws.stripeSecretKey,
      },
      googleCalendar: {
        connected: ws.googleCalendarConnected,
        email: ws.googleCalendarEmail ?? null,
      },
    };
  }),

  // ── S5: owner notification prefs + email visibility ─────────────────────
  getNotificationPrefs: workspaceProcedure.query(async ({ ctx }) => {
    const ws = await ctx.prisma.workspace.findUnique({
      where: { id: ctx.workspace.id },
      select: { notificationPrefs: true },
    });
    const defaults = { newBooking: true, invoicePaid: true, jobCompleted: true, galleryDelivered: true, jobReminder: true };
    return { ...defaults, ...((ws?.notificationPrefs as Record<string, boolean> | null) ?? {}) };
  }),

  saveNotificationPrefs: ownerProcedure
    .input(
      z.object({
        newBooking: z.boolean(),
        invoicePaid: z.boolean(),
        jobCompleted: z.boolean(),
        galleryDelivered: z.boolean(),
        jobReminder: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.workspace.update({
        where: { id: ctx.workspace.id },
        data: { notificationPrefs: input },
      });
      return { ok: true };
    }),

  listRecentEmails: workspaceProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.prisma.emailOutbox.findMany({
        where: { workspaceId: ctx.workspace.id },
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 20,
        select: {
          id: true, template: true, toEmail: true, subject: true,
          status: true, attempts: true, lastError: true, sentAt: true, createdAt: true,
        },
      });
    }),

  // ── Stripe Connect (S3) — the proper multi-tenant integration ──────────
  connectStripe: ownerProcedure.mutation(async ({ ctx }) => {
    const { platformStripe } = await import("@/lib/money/stripe");
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.scalist.io";

    let accountId = (ctx.workspace as { stripeAccountId?: string | null }).stripeAccountId ?? null;
    if (!accountId) {
      const ws = await ctx.prisma.workspace.findUnique({
        where: { id: ctx.workspace.id },
        select: { stripeAccountId: true, name: true, email: true },
      });
      accountId = ws?.stripeAccountId ?? null;
      if (!accountId) {
        const account = await platformStripe.accounts.create({
          type: "standard",
          email: ws?.email ?? undefined,
          business_profile: { name: ws?.name ?? undefined },
          metadata: { workspaceId: ctx.workspace.id },
        });
        accountId = account.id;
        await ctx.prisma.workspace.update({
          where: { id: ctx.workspace.id },
          data: { stripeAccountId: accountId },
        });
      }
    }

    const link = await platformStripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${baseUrl}/integrations?stripe=refresh`,
      return_url: `${baseUrl}/integrations?stripe=connected`,
    });
    return { url: link.url };
  }),

  saveStripeKeys: ownerProcedure
    .input(
      z.object({
        publishableKey: z.string().min(1).startsWith("pk_"),
        // secretKey is optional when editing — blank = keep existing
        secretKey: z.string().optional(),
        webhookSecret: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate secret key format only when provided
      if (input.secretKey && !input.secretKey.startsWith("sk_")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Secret key must start with sk_" });
      }

      const data: Record<string, string | null> = {
        stripePublishableKey: input.publishableKey,
      };
      if (input.secretKey) data.stripeSecretKey = input.secretKey;
      if (input.webhookSecret !== undefined) {
        data.stripeWebhookSecret = input.webhookSecret || null;
      }

      await ctx.prisma.workspace.update({
        where: { id: ctx.workspace.id },
        data,
      });
      return { ok: true };
    }),

  disconnectStripe: ownerProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.workspace.update({
      where: { id: ctx.workspace.id },
      data: {
        stripePublishableKey: null,
        stripeSecretKey: null,
        stripeWebhookSecret: null,
      },
    });
    return { ok: true };
  }),

  // Mark onboarding complete — called at end of onboarding wizard
  completeOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.user.update({
      where: { id: ctx.user.id },
      data: { onboardingCompleted: true },
    });
    return { ok: true };
  }),

  // ─── Order Form Settings ───────────────────────────────────────────────────

  getBookingFormSettings: workspaceProcedure.query(async ({ ctx }) => {
    const ws = await ctx.prisma.workspace.findUnique({
      where: { id: ctx.workspace.id },
      select: { bookingFormSettings: true, slug: true },
    });
    return {
      settings: (ws?.bookingFormSettings ?? null) as BookingFormSettings | null,
      slug: ws?.slug ?? "",
    };
  }),

  saveBookingFormSettings: ownerProcedure
    .input(z.object({
      welcomeMessage: z.string().max(500).optional(),
      fields: z.object({
        propertyType: z.object({ visible: z.boolean(), required: z.boolean() }),
        sqft:         z.object({ visible: z.boolean(), required: z.boolean() }),
        beds:         z.object({ visible: z.boolean(), required: z.boolean() }),
        baths:        z.object({ visible: z.boolean(), required: z.boolean() }),
        mlsNumber:    z.object({ visible: z.boolean(), required: z.boolean() }),
        accessNotes:  z.object({ visible: z.boolean(), required: z.boolean() }),
        phone:        z.object({ visible: z.boolean(), required: z.boolean() }),
        company:      z.object({ visible: z.boolean(), required: z.boolean() }),
        clientNotes:  z.object({ visible: z.boolean(), required: z.boolean() }),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.workspace.update({
        where: { id: ctx.workspace.id },
        data: { bookingFormSettings: input },
      });
      return { ok: true };
    }),
  // ─── Portal Settings ────────────────────────────────────────────────────────

  getPortalSettings: workspaceProcedure.query(async ({ ctx }) => {
    const ws = await ctx.prisma.workspace.findUnique({
      where: { id: ctx.workspace.id },
      select: { portalSettings: true, slug: true, logoUrl: true, name: true, brandColor: true },
    });
    return {
      settings: (ws?.portalSettings ?? null) as PortalSettings | null,
      slug: ws?.slug ?? "",
      logoUrl: ws?.logoUrl ?? null,
      name: ws?.name ?? "",
      brandColor: ws?.brandColor ?? "#1B4F9E",
    };
  }),

  savePortalSettings: ownerProcedure
    .input(z.object({
      heroImageUrl:        z.string().max(2000).optional(),
      welcomeTitle:        z.string().max(200).optional(),
      welcomeText:         z.string().max(500).optional(),
      contactPhone:        z.string().max(30).optional(),
      contactEmail:        z.string().max(200).optional(),
      layout:              z.enum(["split", "centered", "fullHero"]).optional(),
      showLogin:           z.boolean().optional(),
      showRegister:        z.boolean().optional(),
      showOrderForms:      z.boolean().optional(),
      visibleOrderFormIds: z.array(z.string()).optional(),
      featureBullets:      z.array(z.string().max(100)).max(8).optional(),
      portalCardStyle:     z.enum(["list", "imageGrid"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.workspace.update({
        where: { id: ctx.workspace.id },
        data: { portalSettings: input },
      });
      return { ok: true };
    }),

  /** Public endpoint — returns portal settings for the portal landing page */
  getPublicPortalSettings: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const ws = await ctx.prisma.workspace.findUnique({
        where: { slug: input.slug },
        select: {
          id: true, name: true, slug: true, logoUrl: true, brandColor: true,
          phone: true, email: true, portalSettings: true,
          orderForms: {
            where: { isPublic: true },
            select: { id: true, title: true, description: true, coverImage: true },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      });
      if (!ws) return null;
      return {
        ...ws,
        portalSettings: (ws.portalSettings ?? null) as PortalSettings | null,
      };
    }),
});

// Re-export from shared types file so existing imports still work
export type { BookingFormSettings, PortalSettings } from "@/lib/booking-form-types";
export { DEFAULT_BOOKING_FORM_SETTINGS, DEFAULT_PORTAL_SETTINGS } from "@/lib/booking-form-types";
