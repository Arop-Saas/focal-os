import { z } from "zod";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { storageAdmin, PRIVATE_MEDIA_BUCKET, SIGNED_VIEW_TTL_SECONDS } from "@/lib/gallery-security";
import { runDeliverySideEffects } from "@/lib/delivery";
import { hashGalleryPassword, verifyGalleryPassword, mediaViewUrl } from "@/lib/gallery-security";
import { router, workspaceProcedure, publicProcedure } from "../trpc";
import { slugify } from "@/lib/utils";
import { notifyJobDelivered } from "@/lib/notify";
import crypto from "crypto";

// ─── Gallery Router ───────────────────────────────────────────────────────────

/** The cover is ALWAYS the first photo in display order. */
async function syncCoverToFirstPhoto(db: Prisma.TransactionClient | typeof prisma, galleryId: string) {
  const first = await db.galleryMedia.findFirst({
    where: { galleryId, mediaType: { in: ["PHOTO", "DRONE_PHOTO"] } },
    orderBy: { sortOrder: "asc" },
    select: { id: true, isCover: true },
  });
  await db.galleryMedia.updateMany({
    where: { galleryId, isCover: true, ...(first ? { id: { not: first.id } } : {}) },
    data: { isCover: false },
  });
  if (first && !first.isCover) {
    await db.galleryMedia.update({ where: { id: first.id }, data: { isCover: true } });
  }
}

export const galleryRouter = router({
  // ── Internal (authenticated) ────────────────────────────────────────────────

  list: workspaceProcedure.query(async ({ ctx }) => {
    const galleries = await ctx.prisma.gallery.findMany({
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
          select: { cdnUrl: true, thumbnailKey: true, storageKey: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Sign private-bucket cover previews for the grid
    const coverKeys = galleries
      .map((g) => g.media[0])
      .filter((c) => c && !c.cdnUrl)
      .map((c) => c!.thumbnailKey ?? c!.storageKey)
      .filter((k): k is string => !!k);
    if (coverKeys.length > 0) {
      const { data: signed } = await storageAdmin()
        .storage.from(PRIVATE_MEDIA_BUCKET)
        .createSignedUrls(coverKeys, SIGNED_VIEW_TTL_SECONDS);
      const byPath = new Map((signed ?? []).filter((x) => x.path && x.signedUrl).map((x) => [x.path as string, x.signedUrl]));
      for (const g of galleries) {
        const cover = g.media[0];
        if (cover && !cover.cdnUrl) {
          cover.cdnUrl = byPath.get(cover.thumbnailKey ?? cover.storageKey) ?? null;
        }
      }
    }
    return galleries;
  }),

  /** Persist a new media order; the cover follows the first photo. */
  reorderMedia: workspaceProcedure
    .input(z.object({ galleryId: z.string(), orderedIds: z.array(z.string()).min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const gallery = await ctx.prisma.gallery.findFirst({
        where: { id: input.galleryId, workspaceId: ctx.workspace.id },
        select: { id: true },
      });
      if (!gallery) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.prisma.$transaction(async (tx) => {
        await Promise.all(
          input.orderedIds.map((id, i) =>
            tx.galleryMedia.updateMany({
              where: { id, galleryId: gallery.id },
              data: { sortOrder: i },
            })
          )
        );
        await syncCoverToFirstPhoto(tx, gallery.id);
      });
      return { ok: true };
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
          media: { orderBy: { sortOrder: "asc" } },
        },
      });
      if (!gallery) throw new TRPCError({ code: "NOT_FOUND" });

      // Private-bucket media has no public cdnUrl — the dashboard views
      // through short-lived signed URLs, minted in one batch call.
      const keys = gallery.media.filter((m) => !m.cdnUrl).map((m) => m.storageKey);
      if (keys.length > 0) {
        const { data: signed } = await storageAdmin()
          .storage.from(PRIVATE_MEDIA_BUCKET)
          .createSignedUrls(keys, SIGNED_VIEW_TTL_SECONDS);
        const byPath = new Map((signed ?? []).filter((x) => x.path && x.signedUrl).map((x) => [x.path as string, x.signedUrl]));
        gallery.media = gallery.media.map((m) =>
          m.cdnUrl ? m : { ...m, cdnUrl: byPath.get(m.storageKey) ?? null }
        );
      }
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
          password: null,
          passwordHash: input.password ? hashGalleryPassword(input.password) : null,
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
        requirePaymentForDownload: z.boolean().optional(),
        watermarkEnabled: z.boolean().optional(),
        expiresAt: z.date().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, password, ...rest } = input;
      // S4: passwords are stored hashed; plaintext column stays null.
      const data: typeof rest & { password?: null; passwordHash?: string | null } = { ...rest };
      if (password !== undefined) {
        data.password = null;
        data.passwordHash = password ? hashGalleryPassword(password) : null;
      }
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
        cdnUrl: z.string().nullish(), // null for private-bucket media (S4)
        mediaType: z
          .enum(["PHOTO", "VIDEO", "DRONE_PHOTO", "DRONE_VIDEO", "FLOOR_PLAN", "VIRTUAL_TOUR", "DOCUMENT"])
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
          cdnUrl: input.cdnUrl ?? null,
          mediaType: input.mediaType,
          isCover: input.isCover,
          sortOrder: count,
        },
      });

      await syncCoverToFirstPhoto(ctx.prisma, input.galleryId);

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

      await syncCoverToFirstPhoto(ctx.prisma, input.galleryId);

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

      await ctx.prisma.job.update({
        where: { id: gallery.jobId },
        data: {
          status: "DELIVERED",
          statusHistory: { create: { status: "DELIVERED", changedBy: ctx.user.id } },
        },
      });

      // ONE delivery pipeline (same as jobs.update → DELIVERED):
      // deliveredAt SLA stamp + delivery email + invoice-on-delivery.
      void runDeliverySideEffects(ctx.prisma, {
        workspaceId: ctx.workspace.id,
        jobId: gallery.jobId,
        userId: ctx.user.id,
      });

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
          workspace: { select: { name: true, logoUrl: true, brandColor: true, stripeSecretKey: true, stripeAccountId: true, showBranding: true } as any },
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
              storageKey: true,
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

      // Password check — hashed (S4); legacy plaintext verifies once and
      // upgrades itself in place.
      const storedHash = (gallery as { passwordHash?: string | null }).passwordHash;
      if (storedHash || gallery.password) {
        if (!input.password) {
          return { requiresPassword: true as const, gallery: null };
        }
        if (storedHash) {
          if (!verifyGalleryPassword(input.password, storedHash)) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Incorrect password." });
          }
        } else if (gallery.password) {
          if (input.password !== gallery.password) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Incorrect password." });
          }
          // lazy upgrade to hash
          void ctx.prisma.gallery.update({
            where: { slug: input.slug },
            data: { password: null, passwordHash: hashGalleryPassword(input.password) },
          }).catch(() => {});
        }
      }

      // Check invoice payment gate
      const invoice = gallery.job.invoice;
      const isPaid = !invoice || invoice.status === "PAID";
      const requiresPayment = !isPaid && gallery.requirePaymentForDownload;

      // Increment view count (fire-and-forget)
      ctx.prisma.gallery.update({
        where: { slug: input.slug },
        data: { viewCount: { increment: 1 } },
      }).catch(() => {});

      // Strip secret key from workspace before returning
      const { stripeSecretKey: _secret, stripeAccountId: _acct, ...workspacePublic } = gallery.workspace as typeof gallery.workspace & { stripeAccountId?: string | null };

      return {
        requiresPassword: false as const,
        requiresPayment,
        paymentInfo: requiresPayment && invoice ? {
          invoiceId: invoice.id,
          amountDue: invoice.amountDue,
          totalAmount: invoice.totalAmount,
          hasStripe: !!_secret || !!(gallery.workspace as { stripeAccountId?: string | null }).stripeAccountId,
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
          // S4: private-bucket media is served via short-lived SIGNED view
          // URLs (legacy public media passes through). Downloads never use
          // these — they go through /api/gallery/download, which re-checks
          // password + payment server-side.
          media: await Promise.all(
            gallery.media.map(async (m) => ({
              ...m,
              cdnUrl: await mediaViewUrl(m),
            }))
          ),
        },
      };
    }),
});
