/**
 * Central notification service for Scalist.
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
  sendJobRescheduledEmail,
  sendJobConfirmationEmail,
  sendJobReminderEmail,
  sendJobAssignedEmail,
  sendJobCancelledEmail,
  sendGalleryReadyEmail,
  sendInvoiceEmail,
  sendInvoiceReminderEmail,
  sendInvoiceOverdueEmail,
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
  const bellOn = await ownerPref(workspaceId, "newBooking");
  await Promise.allSettled([
    // In-app notification (for workspace admins) — honors owner prefs (S5)
    !bellOn ? Promise.resolve(null) : prisma.notification.create({
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
      to: clientEmail, clientName, jobNumber, propertyAddress, scheduledAt, packageName, workspaceId,
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
      to: clientEmail, clientName, jobNumber, propertyAddress, scheduledAt, packageName, workspaceId,
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
      to: photographerEmail, photographerName, jobId: jobId!, jobNumber,
      propertyAddress, scheduledAt, clientName, accessNotes, workspaceId,
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
      to: clientEmail, clientName, jobNumber, propertyAddress, scheduledAt, accessNotes, workspaceId,
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
      to: clientEmail, clientName, jobNumber, propertyAddress, galleryUrl, workspaceId,
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
      to: clientEmail, clientName, jobNumber, propertyAddress, reason, workspaceId,
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
      to: clientEmail, clientName, invoiceNumber, amount, dueDate, paymentLink, workspaceId,
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
  const bellOn = await ownerPref(workspaceId, "invoicePaid");
  await Promise.allSettled([
    !bellOn ? Promise.resolve(null) : prisma.notification.create({
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
      to: clientEmail, clientName, invoiceNumber, amount, paidAt, workspaceId,
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

// ─── Invoice: Payment Reminder (before due date) ────────────────────────────

export async function notifyInvoiceReminder({
  workspaceId, jobId, userId,
  clientEmail, clientName, invoiceNumber, amount, dueDate, paymentLink, daysUntilDue,
}: BaseNotifyInput & {
  clientEmail: string; clientName: string; invoiceNumber: string;
  amount: number; dueDate: Date; paymentLink: string; daysUntilDue: number;
}) {
  await Promise.allSettled([
    prisma.notification.create({
      data: {
        workspaceId, jobId, userId,
        type: "INVOICE_REMINDER" as any,
        channel: "IN_APP",
        status: "DELIVERED",
        title: `Payment reminder sent — ${invoiceNumber}`,
        body: `$${amount.toFixed(2)} due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`,
        sentAt: new Date(),
      },
    }),
    sendInvoiceReminderEmail({
      to: clientEmail, clientName, invoiceNumber, amount, dueDate, paymentLink,
      daysUntilDue, workspaceId,
    }).then(() =>
      prisma.notification.create({
        data: {
          workspaceId, jobId,
          type: "INVOICE_REMINDER" as any,
          channel: "EMAIL",
          status: "SENT",
          title: `Payment reminder email sent to ${clientName}`,
          body: `Sent to ${clientEmail} — due in ${daysUntilDue} days`,
          sentAt: new Date(),
        },
      })
    ),
  ]).catch((err) => console.error("[notify] notifyInvoiceReminder error:", err));
}

// ─── Invoice: Overdue Reminder ──────────────────────────────────────────────

export async function notifyInvoiceOverdue({
  workspaceId, jobId, userId,
  clientEmail, clientName, invoiceNumber, amount, dueDate, paymentLink, daysOverdue,
}: BaseNotifyInput & {
  clientEmail: string; clientName: string; invoiceNumber: string;
  amount: number; dueDate: Date; paymentLink: string; daysOverdue: number;
}) {
  await Promise.allSettled([
    sendInvoiceOverdueEmail({
      to: clientEmail, clientName, invoiceNumber, amount, dueDate, paymentLink,
      daysOverdue, workspaceId,
    }).then(() =>
      prisma.notification.create({
        data: {
          workspaceId, jobId,
          type: "INVOICE_OVERDUE" as any,
          channel: "EMAIL",
          status: "SENT",
          title: `Overdue notice sent to ${clientName}`,
          body: `Sent to ${clientEmail} — ${daysOverdue} days overdue`,
          sentAt: new Date(),
        },
      })
    ),
  ]).catch((err) => console.error("[notify] notifyInvoiceOverdue error:", err));
}


// ─── S5 additions ────────────────────────────────────────────────────────────

async function ownerPref(workspaceId: string, key: string): Promise<boolean> {
  try {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { notificationPrefs: true },
    });
    const prefs = (ws?.notificationPrefs as Record<string, boolean> | null) ?? null;
    return !prefs || prefs[key] !== false;
  } catch { return true; }
}

/** Job rescheduled → client email + in-app bell (C3) */
export async function notifyJobRescheduled({
  workspaceId, jobId, userId,
  clientEmail, clientName, jobNumber, propertyAddress, oldTime, newTime,
}: BaseNotifyInput & {
  clientEmail: string | null; clientName: string; jobNumber: string;
  propertyAddress: string; oldTime: Date; newTime: Date;
}) {
  await Promise.allSettled([
    prisma.notification.create({
      data: {
        workspaceId, jobId, userId,
        type: "JOB_RESCHEDULED",
        channel: "IN_APP",
        status: "DELIVERED",
        title: `Rescheduled — ${jobNumber}`,
        body: `${propertyAddress} → ${newTime.toLocaleString()}`,
        sentAt: new Date(),
      },
    }),
    clientEmail
      ? sendJobRescheduledEmail({
          to: clientEmail, clientName, jobNumber, propertyAddress, oldTime, newTime, workspaceId,
        })
      : Promise.resolve(null),
  ]);
}

/** New portal message from a client → owner bell (R13) */
export async function notifyNewClientMessage({
  workspaceId, jobId,
  clientName, preview,
}: BaseNotifyInput & { clientName: string; preview: string }) {
  // Client messages always surface — no pref gate on direct communication.
  await prisma.notification.create({
    data: {
      workspaceId, jobId,
      type: "NEW_MESSAGE",
      channel: "IN_APP",
      status: "DELIVERED",
      title: `New message from ${clientName}`,
      body: preview.slice(0, 140),
      sentAt: new Date(),
    },
  }).catch(() => {});
}
