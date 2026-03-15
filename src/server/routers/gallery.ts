import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure, publicProcedure } from "../trpc";
import { slugify } from "@/lib/utils";
import { notifyJobDelivered } from "@/lib/notify";
import crypto from "crypto";

// ─── Gallery Router ───────────────────────────────────────────────────────────

export const galleryRouter = router({
  // ── Internal (authenticated) ────────────────────────────────────────────────

  list: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.prisma.gallery.findMany({
      where: { workspaceId: ctx.workspace.id },
      include: {
        job: {
          include: {
            client: { select: { firstName: true, lastName: true, email: true } },
          },
        },
        media: {
          where: { isCover: true },
          take: 1,
          select: { cdnUrl: true, thumbnailKey: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  // Get single gallery for management (internal)
  getById: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const gallery = await ctx.prisma.gallery.findFirst({
        where: { id: input.id, workspaceId: ctx.workspace.id },
        include: {
          job: {
            include: {
              client: { select: { firstName: true, lastName: true, email: true } },
            },
          },
          media: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }] },
        },
      });
      if (!gallery) throw new TRPCError({ code: "NOT_FOUND" });
      return gallery;
    }),

  // Create gallery for a job
  create: workspaceProcedure
    .input(
      z.object({
        jobId: z.string(),
        name: z.string().min(1),
        isPublic: z.boolean().default(false),
        password: z.string().optional(),
        downloadEnabled: z.boolean().default(true),
        watermarkEnabled: z.boolean().default(false),
        expiresAt: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Ensure job belongs to workspace
      const job = await ctx.prisma.job.findFirst({
        where: { id: input.jobId, workspaceId: ctx.workspace.id },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });

      // Ensure no gallery exists yet
      const existing = await ctx.prisma.gallery.findUnique({ where: { jobId: input.jobId } });
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Gallery already exists for this job." });

      // Generate unique slug
      const base = slugify(input.name);
      const token = crypto.randomBytes(4).toString("hex");
      const slug = `${base}-${token}`;

      return ctx.prisma.gallery.create({
        data: {
          workspaceId: ctx.workspace.id,
          jobId: input.jobId,
          name: input.name,
          slug,
          isPublic: input.isPublic,
          password: input.password || null,
          downloadEnabled: input.downloadEnabled,
          watermarkEnabled: input.watermarkEnabled,
          expiresAt: input.expiresAt || null,
          status: "PROCESSING",
        },
      });
    }),

  // Update gallery settings
  update: workspaceProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        isPublic: z.boolean().optional(),
        password: z.string().nullable().optional(),
        downloadEnabled: z.boolean().optional(),
        watermarkEnabled: z.boolean().optional(),
        expiresAt: z.date().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const gallery = await ctx.prisma.gallery.findFirst({
        where: { id, workspaceId: ctx.workspace.id },
      });
      if (!gallery) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.prisma.gallery.update({ where: { id }, data });
    }),

  // Add a media record (called after successful Supabase Storage upload)
  addMedia: workspaceProcedure
    .input(
      z.object({
        galleryId: z.string(),
        fileName: z.string(),
        originalName: z.string(),
        mimeType: z.string(),
        fileSize: z.number(),
        width: z.number().optional(),
        height: z.number().optional(),
        storageKey: z.string(),
        cdnUrl: z.string(),
        mediaType: z
          .enum(["PHOTO", "VIDEO", "DRONE_PHOTO", "DRONE_VIDEO", "FLOOR_PLAN", "VIRTUAL_TOUR"])
          .default("PHOTO"),
        isCover: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const gallery = await ctx.prisma.gallery.findFirst({
        where: { id: input.galleryId, workspaceId: ctx.workspace.id },
      });
      if (!gallery) throw new TRPCError({ code: "NOT_FOUND" });

      // If setting as cover, unset any existing cover
      if (input.isCover) {
        await ctx.prisma.galleryMedia.updateMany({
          where: { galleryId: input.galleryId, isCover: true },
          data: { isCover: false },
        });
      }

      // Get current count for sort order
      const count = await ctx.prisma.galleryMedia.count({
        where: { galleryId: input.galleryId },
      });

      const media = await ctx.prisma.galleryMedia.create({
        data: {
          galleryId: input.galleryId,
          fileName: input.fileName,
          originalName: input.originalName,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          width: input.width,
          height: input.height,
          storageKey: input.storageKey,
          cdnUrl: input.cdnUrl,
          mediaType: input.mediaType,
          isCover: input.isCover,
          sortOrder: count,
        },
      });

      // Update gallery media count and set READY if first photo
      await ctx.prisma.gallery.update({
        where: { id: input.galleryId },
        data: {
          mediaCount: { increment: 1 },
          status: gallery.status === "PROCESSING" ? "READY" : gallery.status,
        },
      });

      return media;
    }),

  // Remove a media item
  removeMedia: workspaceProcedure
    .input(z.object({ mediaId: z.string(), galleryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const gallery = await ctx.prisma.gallery.findFirst({
        where: { id: input.galleryId, workspaceId: ctx.workspace.id },
      });
      if (!gallery) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.prisma.galleryMedia.delete({ where: { id: input.mediaId } });

      await ctx.prisma.gallery.update({
        where: { id: input.galleryId },
        data: { mediaCount: { decrement: 1 } },
      });

      return { success: true };
    }),

  // Add a virtual tour link (Matterport, iGuide, or any iframe-embeddable URL)
  addVirtualTour: workspaceProcedure
    .input(
      z.object({
        galleryId: z.string(),
        url: z.string().url("Please enter a valid URL."),
        label: z.string().optional(), // e.g. "Matterport Tour", "iGuide Tour"
      })
    )
    .mutation(async ({ ctx, input }) => {
      const gallery = await ctx.prisma.gallery.findFirst({
        where: { id: input.galleryId, workspaceId: ctx.workspace.id },
      });
      if (!gallery) throw new TRPCError({ code: "NOT_FOUND" });

      // Detect provider from URL for a friendly label
      let autoLabel = input.label ?? "Virtual Tour";
      const lower = input.url.toLowerCase();
      if (lower.includes("matterport.com")) autoLabel = input.label ?? "Matterport 3D Tour";
      else if (lower.includes("iguide.ca") || lower.includes("iguide.com")) autoLabel = input.label ?? "iGuide Tour";
      else if (lower.includes("kuula.co")) autoLabel = input.label ?? "Kuula Tour";
      else if (lower.includes("my.tour") || lower.includes("360.com")) autoLabel = input.label ?? "360° Tour";

      const count = await ctx.prisma.galleryMedia.count({
        where: { galleryId: input.galleryId },
      });

      const media = await ctx.prisma.galleryMedia.create({
        data: {
          galleryId: input.galleryId,
          fileName: `virtual-tour-${Date.now()}`,
          originalName: autoLabel,
          mimeType: "text/html",
          fileSize: 0,
          storageKey: "",
          cdnUrl: input.url,
          mediaType: "VIRTUAL_TOUR",
          sortOrder: count,
          isCover: false,
        },
      });

      await ctx.prisma.gallery.update({
        where: { id: input.galleryId },
        data: {
          mediaCount: { increment: 1 },
          status: gallery.status === "PROCESSING" ? "READY" : gallery.status,
        },
      });

      return media;
    }),

  // Set cover photo
  setCover: workspaceProcedure
    .input(z.object({ mediaId: z.string(), galleryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const gallery = await ctx.prisma.gallery.findFirst({
        where: { id: input.galleryId, workspaceId: ctx.workspace.id },
      });
      if (!gallery) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.prisma.galleryMedia.updateMany({
        where: { galleryId: input.galleryId },
        data: { isCover: false },
      });
      await ctx.prisma.galleryMedia.update({
        where: { id: input.mediaId },
        data: { isCover: true },
      });

      return { success: true };
    }),

  // Publish gallery — marks DELIVERED, updates job status, fires email
  publish: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const gallery = await ctx.prisma.gallery.findFirst({
        where: { id: input.id, workspaceId: ctx.workspace.id },
        include: {
          job: {
            include: {
              client: { select: { firstName: true, lastName: true, email: true } },
            },
          },
        },
      });
      if (!gallery) throw new TRPCError({ code: "NOT_FOUND" });
      if (gallery.mediaCount === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Upload at least one photo before publishing.",
        });
      }

      // Mark gallery delivered
      const updated = await ctx.prisma.gallery.update({
        where: { id: input.id },
        data: { status: "DELIVERED", isPublic: true },
      });

      // Update job to DELIVERED
      await ctx.prisma.job.update({
        where: { id: gallery.jobId },
        data: { status: "DELIVERED" },
      });

      // Fire delivery notification (fire-and-forget)
      const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/g/${gallery.slug}`;
      notifyJobDelivered({
        workspaceId: ctx.workspace.id,
        jobId: gallery.jobId,
        clientEmail: gallery.job.client.email,
        clientName: `${gallery.job.client.firstName} ${gallery.job.client.lastName}`,
        jobNumber: gallery.job.jobNumber,
        propertyAddress: gallery.job.propertyAddress,
        galleryUrl: shareUrl,
      }).catch(console.error);

      return updated;
    }),

  // Archive gallery
  archive: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const gallery = await ctx.prisma.gallery.findFirst({
        where: { id: input.id, workspaceId: ctx.workspace.id },
      });
      if (!gallery) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.prisma.gallery.update({
        where: { id: input.id },
        data: { status: "ARCHIVED", isPublic: false },
      });
    }),

  // ── Public ──────────────────────────────────────────────────────────────────

  // Get public gallery by slug (no auth) — used by /gallery/[slug]
  getPublic: publicProcedure
    .input(
      z.object({
        slug: z.string(),
        password: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const gallery = await ctx.prisma.gallery.findUnique({
        where: { slug: input.slug },
        include: {
          workspace: { select: { name: true, logoUrl: true, brandColor: true, stripeSecretKey: true } },
          job: {
            select: {
              propertyAddress: true, propertyCity: true, propertyState: true,
              invoice: { select: { id: true, status: true, totalAmount: true, amountDue: true } },
            },
          },
          media: {
            orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
            select: {
              id: true,
              cdnUrl: true,
              originalName: true,
              width: true,
              height: true,
              mediaType: true,
              isCover: true,
              fileSize: true,
              mimeType: true,
            },
          },
        },
      });

      if (!gallery) throw new TRPCError({ code: "NOT_FOUND", message: "Gallery not found." });

      if (gallery.status === "ARCHIVED" || gallery.status === "EXPIRED") {
        throw new TRPCError({ code: "FORBIDDEN", message: "This gallery is no longer available." });
      }

      if (!gallery.isPublic) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This gallery is private." });
      }

      // Check expiry
      if (gallery.expiresAt && new Date() > gallery.expiresAt) {
        await ctx.prisma.gallery.update({ where: { slug: input.slug }, data: { status: "EXPIRED" } });
        throw new TRPCError({ code: "FORBIDDEN", message: "This gallery has expired." });
      }

      // Password check
      if (gallery.password) {
        if (!input.password) {
          return { requiresPassword: true as const, gallery: null };
        }
        if (input.password !== gallery.password) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Incorrect password." });
        }
      }

      // Check invoice payment gate
      const invoice = gallery.job.invoice;
      const isPaid = !invoice || invoice.status === "PAID";
      const requiresPayment = !isPaid;

      // Increment view count (fire-and-forget)
      ctx.prisma.gallery.update({
        where: { slug: input.slug },
        data: { viewCount: { increment: 1 } },
      }).catch(() => {});

      // Strip secret key from workspace before returning
      const { stripeSecretKey: _secret, ...workspacePublic } = gallery.workspace;

      return {
        requiresPassword: false as const,
        requiresPayment,
        paymentInfo: requiresPayment && invoice ? {
          invoiceId: invoice.id,
          amountDue: invoice.amountDue,
          totalAmount: invoice.totalAmount,
          hasStripe: !!_secret,
        } : null,
        gallery: {
          id: gallery.id,
          name: gallery.name,
          slug: gallery.slug,
          downloadEnabled: gallery.downloadEnabled,
          mediaCount: gallery.mediaCount,
          viewCount: gallery.viewCount,
          expiresAt: gallery.expiresAt,
          propertyAddress: gallery.job.propertyAddress,
          propertyCity: gallery.job.propertyCity,
          propertyState: gallery.job.propertyState,
          workspace: workspacePublic,
          // If unpaid: return media for blur preview but flag them
          media: gallery.media,
        },
      };
    }),
});
