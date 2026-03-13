/**
 * Central notification service for Focal OS.
 *
 * Every notification does two things atomically-ish:
 *  1. Creates a Notification record (drives the in-app bell)
 *  2. Sends an email via Resend
 *
 * IMPORTANT: All functions are fire-and-forget — they never throw.
 * Errors are logged but never propagate to the caller. This means
 * a broken Resend key or missing email address will never cause a
 * mutation to fail.
 */

import prisma from "@/lib/prisma";
import {
  sendJobConfirmationEmail,
  sendJobReminderEmail,
  sendJobAssignedEmail,
  sendJobCancelledEmail,
  sendGalleryReadyEmail,
  sendInvoiceEmail,
  sendPaymentReceiptEmail,
} from "@/lib/resend";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BaseNotifyInput {
  workspaceId: string;
  jobId?: string;
  /** The workspace userId who should see this in the in-app bell (null = no in-app) */
  userId?: string;
}

// ─── Job: Booked (new job created) ───────────────────────────────────────────

export async function notifyJobBooked({
  workspaceId, jobId, userId,
  clientEmail, clientName, jobNumber, propertyAddress, scheduledAt, packageName,
}: BaseNotifyInput & {
  clientEmail: string; clientName: string; jobNumber: string;
  propertyAddress: string; scheduledAt: Date; packageName: string;
}) {
  await Promise.allSettled([
    // In-app notification (for workspace admins)
    prisma.notification.create({
      data: {
        workspaceId, jobId, userId,
        type: "JOB_BOOKED",
        channel: "IN_APP",
        status: "DELIVERED",
        title: `New job booked — ${jobNumber}`,
        body: `${clientName} · ${propertyAddress}`,
        sentAt: new Date(),
      },
    }),
    // Email to client
    sendJobConfirmationEmail({
      to: clientEmail, clientName, jobNumber, propertyAddress, scheduledAt, packageName,
    }).then(() =>
      prisma.notification.create({
        data: {
          workspaceId, jobId,
          type: "JOB_BOOKED",
          channel: "EMAIL",
          status: "SENT",
          title: `Booking confirmation sent to ${clientName}`,
          body: `Sent to ${clientEmail}`,
          sentAt: new Date(),
        },
      })
    ),
  ]).catch((err) => console.error("[notify] notifyJobBooked error:", err));
}

// ─── Job: Confirmed ──────────────────────────────────────────────────────────

export async function notifyJobConfirmed({
  workspaceId, jobId, userId,
  clientEmail, clientName, jobNumber, propertyAddress, scheduledAt, packageName,
}: BaseNotifyInput & {
  clientEmail: string; clientName: string; jobNumber: string;
  propertyAddress: string; scheduledAt: Date; packageName: string;
}) {
  await Promise.allSettled([
    prisma.notification.create({
      data: {
        workspaceId, jobId, userId,
        type: "JOB_CONFIRMED",
        channel: "IN_APP",
        status: "DELIVERED",
        title: `Job confirmed — ${jobNumber}`,
        body: `${clientName} · ${propertyAddress}`,
        sentAt: new Date(),
      },
    }),
    sendJobConfirmationEmail({
      to: clientEmail, clientName, jobNumber, propertyAddress, scheduledAt, packageName,
    }).then(() =>
      prisma.notification.create({
        data: {
          workspaceId, jobId,
          type: "JOB_CONFIRMED",
          channel: "EMAIL",
          status: "SENT",
          title: `Confirmation email sent to ${clientName}`,
          body: `Sent to ${clientEmail}`,
          sentAt: new Date(),
        },
      })
    ),
  ]).catch((err) => console.error("[notify] notifyJobConfirmed error:", err));
}

// ─── Job: Assigned to photographer ───────────────────────────────────────────

export async function notifyJobAssigned({
  workspaceId, jobId, userId,
  photographerEmail, photographerName, jobNumber, propertyAddress,
  scheduledAt, clientName, accessNotes,
}: BaseNotifyInput & {
  photographerEmail: string; photographerName: string; jobNumber: string;
  propertyAddress: string; scheduledAt: Date; clientName: string;
  accessNotes?: string | null;
}) {
  await Promise.allSettled([
    // In-app for the photographer
    ...(userId
      ? [
          prisma.notification.create({
            data: {
              workspaceId, jobId, userId,
              type: "JOB_ASSIGNED",
              channel: "IN_APP",
              status: "DELIVERED",
              title: `New job assigned — ${jobNumber}`,
              body: `${propertyAddress} · ${scheduledAt.toLocaleDateString()}`,
              sentAt: new Date(),
            },
          }),
        ]
      : []),
    // Email to photographer
    sendJobAssignedEmail({
      to: photographerEmail, photographerName, jobNumber,
      propertyAddress, scheduledAt, clientName, accessNotes,
    }).then(() =>
      prisma.notification.create({
        data: {
          workspaceId, jobId,
          type: "JOB_ASSIGNED",
          channel: "EMAIL",
          status: "SENT",
          title: `Assignment email sent to ${photographerName}`,
          body: `Sent to ${photographerEmail}`,
          sentAt: new Date(),
        },
      })
    ),
  ]).catch((err) => console.error("[notify] notifyJobAssigned error:", err));
}

// ─── Job: Reminder (24h before) ──────────────────────────────────────────────

export async function notifyJobReminder({
  workspaceId, jobId,
  clientEmail, clientName, jobNumber, propertyAddress, scheduledAt, accessNotes,
}: BaseNotifyInput & {
  clientEmail: string; clientName: string; jobNumber: string;
  propertyAddress: string; scheduledAt: Date; accessNotes?: string | null;
}) {
  await Promise.allSettled([
    sendJobReminderEmail({
      to: clientEmail, clientName, jobNumber, propertyAddress, scheduledAt, accessNotes,
    }).then(() =>
      prisma.notification.create({
        data: {
          workspaceId, jobId,
          type: "JOB_REMINDER",
          channel: "EMAIL",
          status: "SENT",
          title: `24h reminder sent to ${clientName}`,
          body: `Sent to ${clientEmail}`,
          sentAt: new Date(),
        },
      })
    ),
  ]).catch((err) => console.error("[notify] notifyJobReminder error:", err));
}

// ─── Job: Delivered (gallery ready) ──────────────────────────────────────────

export async function notifyJobDelivered({
  workspaceId, jobId, userId,
  clientEmail, clientName, jobNumber, propertyAddress, galleryUrl,
}: BaseNotifyInput & {
  clientEmail: string; clientName: string; jobNumber: string;
  propertyAddress: string; galleryUrl: string;
}) {
  await Promise.allSettled([
    prisma.notification.create({
      data: {
        workspaceId, jobId, userId,
        type: "JOB_DELIVERED",
        channel: "IN_APP",
        status: "DELIVERED",
        title: `Media delivered — ${jobNumber}`,
        body: `Gallery ready for ${clientName}`,
        sentAt: new Date(),
      },
    }),
    sendGalleryReadyEmail({
      to: clientEmail, clientName, jobNumber, propertyAddress, galleryUrl,
    }).then(() =>
      prisma.notification.create({
        data: {
          workspaceId, jobId,
          type: "JOB_DELIVERED",
          channel: "EMAIL",
          status: "SENT",
          title: `Delivery email sent to ${clientName}`,
          body: `Sent to ${clientEmail}`,
          sentAt: new Date(),
        },
      })
    ),
  ]).catch((err) => console.error("[notify] notifyJobDelivered error:", err));
}

// ─── Job: Cancelled ──────────────────────────────────────────────────────────

export async function notifyJobCancelled({
  workspaceId, jobId, userId,
  clientEmail, clientName, jobNumber, propertyAddress, reason,
}: BaseNotifyInput & {
  clientEmail: string; clientName: string; jobNumber: string;
  propertyAddress: string; reason?: string | null;
}) {
  await Promise.allSettled([
    prisma.notification.create({
      data: {
        workspaceId, jobId, userId,
        type: "JOB_CANCELLED",
        channel: "IN_APP",
        status: "DELIVERED",
        title: `Job cancelled — ${jobNumber}`,
        body: `${clientName} · ${propertyAddress}`,
        sentAt: new Date(),
      },
    }),
    sendJobCancelledEmail({
      to: clientEmail, clientName, jobNumber, propertyAddress, reason,
    }).then(() =>
      prisma.notification.create({
        data: {
          workspaceId, jobId,
          type: "JOB_CANCELLED",
          channel: "EMAIL",
          status: "SENT",
          title: `Cancellation email sent to ${clientName}`,
          body: `Sent to ${clientEmail}`,
          sentAt: new Date(),
        },
      })
    ),
  ]).catch((err) => console.error("[notify] notifyJobCancelled error:", err));
}

// ─── Invoice: Sent ────────────────────────────────────────────────────────────

export async function notifyInvoiceSent({
  workspaceId, jobId, userId,
  clientEmail, clientName, invoiceNumber, amount, dueDate, paymentLink,
}: BaseNotifyInput & {
  clientEmail: string; clientName: string; invoiceNumber: string;
  amount: number; dueDate: Date; paymentLink: string;
}) {
  await Promise.allSettled([
    prisma.notification.create({
      data: {
        workspaceId, jobId, userId,
        type: "INVOICE_SENT",
        channel: "IN_APP",
        status: "DELIVERED",
        title: `Invoice sent — ${invoiceNumber}`,
        body: `$${amount.toFixed(2)} sent to ${clientName}`,
        sentAt: new Date(),
      },
    }),
    sendInvoiceEmail({
      to: clientEmail, clientName, invoiceNumber, amount, dueDate, paymentLink,
    }).then(() =>
      prisma.notification.create({
        data: {
          workspaceId, jobId,
          type: "INVOICE_SENT",
          channel: "EMAIL",
          status: "SENT",
          title: `Invoice email sent to ${clientName}`,
          body: `Sent to ${clientEmail}`,
          sentAt: new Date(),
        },
      })
    ),
  ]).catch((err) => console.error("[notify] notifyInvoiceSent error:", err));
}

// ─── Invoice: Paid ────────────────────────────────────────────────────────────

export async function notifyInvoicePaid({
  workspaceId, jobId, userId,
  clientEmail, clientName, invoiceNumber, amount, paidAt,
}: BaseNotifyInput & {
  clientEmail: string; clientName: string; invoiceNumber: string;
  amount: number; paidAt: Date;
}) {
  await Promise.allSettled([
    prisma.notification.create({
      data: {
        workspaceId, jobId, userId,
        type: "INVOICE_PAID",
        channel: "IN_APP",
        status: "DELIVERED",
        title: `Payment received — ${invoiceNumber}`,
        body: `$${amount.toFixed(2)} from ${clientName}`,
        sentAt: new Date(),
      },
    }),
    sendPaymentReceiptEmail({
      to: clientEmail, clientName, invoiceNumber, amount, paidAt,
    }).then(() =>
      prisma.notification.create({
        data: {
          workspaceId, jobId,
          type: "INVOICE_PAID",
          channel: "EMAIL",
          status: "SENT",
          title: `Receipt email sent to ${clientName}`,
          body: `Sent to ${clientEmail}`,
          sentAt: new Date(),
        },
      })
    ),
  ]).catch((err) => console.error("[notify] notifyInvoicePaid error:", err));
}
