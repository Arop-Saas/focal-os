import { Resend } from "resend";
import { format } from "date-fns";
import prisma from "@/lib/prisma";

export const resend = new Resend(process.env.RESEND_API_KEY);

export const EMAIL_FROM =
  process.env.EMAIL_FROM ?? "Scalist <onboarding@resend.dev>";


/**
 * S5: THE email choke point. Every template send goes through here:
 *  - honors workspace notification prefs (SKIPPED rows stay visible)
 *  - writes an EmailOutbox row (PENDING -> SENT/FAILED) with stored HTML
 *    so failures are observable and retryable - no more silent loss (R7).
 */
const TEMPLATE_PREF_GATE: Record<string, string> = {
  sendJobReminderEmail: "jobReminder",
  sendGalleryReadyEmail: "galleryDelivered",
};

export async function trackedSend(
  template: string,
  workspaceId: string | null | undefined,
  payload: { from: string; to: string; subject: string; html: string }
) {
  let outboxId: string | null = null;
  try {
    if (workspaceId) {
      const ws = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { notificationPrefs: true },
      });
      const prefs = (ws?.notificationPrefs as Record<string, boolean> | null) ?? null;
      const gate = TEMPLATE_PREF_GATE[template];
      if (prefs && gate && prefs[gate] === false) {
        await prisma.emailOutbox.create({
          data: { workspaceId, template, toEmail: payload.to, subject: payload.subject, status: "SKIPPED" },
        }).catch(() => {});
        return null;
      }
      const row = await prisma.emailOutbox.create({
        data: {
          workspaceId, template, toEmail: payload.to, subject: payload.subject,
          html: payload.html, status: "PENDING", attempts: 1,
        },
      }).catch(() => null);
      outboxId = row?.id ?? null;
    }
    const res = await resend.emails.send(payload);
    const errMsg = (res as { error?: { message?: string } | null })?.error?.message;
    if (errMsg) throw new Error(errMsg);
    if (outboxId) {
      await prisma.emailOutbox.update({
        where: { id: outboxId },
        data: { status: "SENT", sentAt: new Date() },
      }).catch(() => {});
    }
    return res;
  } catch (e) {
    if (outboxId) {
      await prisma.emailOutbox.update({
        where: { id: outboxId },
        data: { status: "FAILED", lastError: String(e instanceof Error ? e.message : e).slice(0, 500) },
      }).catch(() => {});
    }
    console.error("[email] " + template + " failed:", e);
    return null;
  }
}

/** Retry failed sends (called from the daily reminders cron). */
export async function retryFailedEmails(maxAttempts = 3): Promise<number> {
  const failed = await prisma.emailOutbox.findMany({
    where: {
      // FAILED sends, plus PENDING rows that never resolved — a serverless
      // function can die between "row created" and "status updated".
      OR: [
        { status: "FAILED" },
        { status: "PENDING", createdAt: { lt: new Date(Date.now() - 10 * 60e3) } },
      ],
      attempts: { lt: maxAttempts },
      html: { not: null },
      createdAt: { gte: new Date(Date.now() - 72 * 3600e3) },
    },
    take: 25,
    orderBy: { createdAt: "asc" },
  });
  let retried = 0;
  for (const row of failed) {
    try {
      const res = await resend.emails.send({
        from: EMAIL_FROM, to: row.toEmail, subject: row.subject ?? "Notification", html: row.html!,
      });
      const errMsg = (res as { error?: { message?: string } | null })?.error?.message;
      if (errMsg) throw new Error(errMsg);
      await prisma.emailOutbox.update({
        where: { id: row.id },
        data: { status: "SENT", sentAt: new Date(), attempts: { increment: 1 } },
      });
      retried++;
    } catch (e) {
      await prisma.emailOutbox.update({
        where: { id: row.id },
        data: { attempts: { increment: 1 }, lastError: String(e instanceof Error ? e.message : e).slice(0, 500) },
      }).catch(() => {});
    }
  }
  return retried;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.scalist.io";

// ─── Shared layout ──────────────────────────────────────────────────────────

interface EmailWrapperOptions {
  workspaceName?: string;
  brandColor?: string;
  emailSubtitle?: string;
  showBranding?: boolean;
}

function emailWrapper(body: string, opts?: string | EmailWrapperOptions) {
  // Backwards-compatible: accept either a string (workspaceName) or options object
  const options: EmailWrapperOptions = typeof opts === "string" ? { workspaceName: opts } : (opts ?? {});
  const brandName = options.workspaceName ?? "Scalist";
  const headerColor = options.brandColor ?? "#1B4F9E";
  const subtitle = options.emailSubtitle ?? "Real Estate Photography";
  const showBranding = options.showBranding ?? true;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:${headerColor};padding:24px 32px;">
          <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">${brandName}</span>
          <span style="color:rgba(255,255,255,0.6);font-size:13px;margin-left:8px;">${subtitle}</span>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">${body}</td></tr>
        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e9ecef;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">
            You're receiving this because you have an appointment with ${brandName}.
            Questions? Reply to this email.
          </p>
          ${showBranding ? `<p style="margin:8px 0 0;color:#c0c8d4;font-size:11px;">Powered by <a href="https://www.scalist.io" style="color:#c0c8d4;">Scalist</a></p>` : ""}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function infoBox(rows: Array<[string, string]>) {
  return `<table width="100%" cellpadding="0" cellspacing="0"
    style="background:#f0f7ff;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid #1B4F9E;">
    ${rows
      .map(
        ([label, value]) =>
          `<tr>
            <td style="padding:4px 0;color:#64748b;font-size:13px;width:130px;vertical-align:top;">${label}</td>
            <td style="padding:4px 0;color:#1e293b;font-size:13px;font-weight:600;">${value}</td>
          </tr>`
      )
      .join("")}
  </table>`;
}

function ctaButton(label: string, href: string) {
  return `<div style="text-align:center;margin:28px 0;">
    <a href="${href}"
      style="display:inline-block;background:#1B4F9E;color:#fff;padding:14px 32px;
             border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
      ${label}
    </a>
  </div>`;
}

// ─── Workspace branding lookup ──────────────────────────────────────────────

async function getWorkspaceBranding(workspaceId?: string): Promise<EmailWrapperOptions> {
  if (!workspaceId) return {};
  try {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, brandColor: true, showBranding: true, emailSubtitle: true } as any,
    }) as any;
    if (!ws) return {};
    return {
      workspaceName: ws.name ?? undefined,
      brandColor: ws.brandColor ?? undefined,
      emailSubtitle: ws.emailSubtitle ?? undefined,
      showBranding: ws.showBranding ?? true,
    };
  } catch {
    return {};
  }
}

// ─── Custom template resolution ─────────────────────────────────────────────

async function resolveTemplate(
  workspaceId: string | undefined,
  eventType: string,
  variables: Record<string, string>,
  fallback: { subject: string; body: string },
): Promise<{ subject: string; body: string; enabled: boolean }> {
  if (!workspaceId) return { ...fallback, enabled: true };
  try {
    const custom = await prisma.emailTemplate.findUnique({
      where: { workspaceId_eventType: { workspaceId, eventType } },
    });
    if (!custom) return { ...fallback, enabled: true };
    if (!custom.enabled) return { subject: "", body: "", enabled: false };

    const replace = (text: string) =>
      text.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);

    return { subject: replace(custom.subject), body: replace(custom.body), enabled: true };
  } catch {
    return { ...fallback, enabled: true };
  }
}

// ─── Templates ───────────────────────────────────────────────────────────────

/** Portal welcome / account created → client */
export async function sendPortalWelcomeEmail({
  to, clientName, workspaceName, portalUrl,
}: {
  to: string; clientName: string; workspaceName?: string; portalUrl: string;
}) {
  const brand = workspaceName ?? "Scalist";
  return trackedSend("sendPortalWelcomeEmail", undefined, {
    from: EMAIL_FROM,
    to,
    subject: `Welcome to your ${brand} client portal`,
    html: emailWrapper(`
      <h2 style="color:#1B4F9E;margin:0 0 8px;">Your account is ready 🎉</h2>
      <p style="color:#475569;margin:0 0 4px;">Hi ${clientName},</p>
      <p style="color:#475569;">
        Your client portal account has been created. You can now sign in to track your orders,
        view and pay invoices, and download your delivered files.
      </p>
      ${ctaButton("Open my portal →", portalUrl)}
      <p style="color:#94a3b8;font-size:12px;text-align:center;">
        If you did not create this account, you can safely ignore this email.
      </p>
    `, workspaceName),
  });
}

/** Booking confirmation → client */
export async function sendJobConfirmationEmail({
  to, clientName, jobNumber, propertyAddress, scheduledAt, packageName, workspaceName, workspaceId,
}: {
  to: string; clientName: string; jobNumber: string;
  propertyAddress: string; scheduledAt: Date; packageName: string;
  workspaceName?: string; workspaceId?: string;
}) {
  const vars = {
    clientName, jobNumber, propertyAddress, packageName,
    scheduledDate: format(scheduledAt, "EEEE, MMMM d"),
    scheduledTime: format(scheduledAt, "h:mm a"),
    workspaceName: workspaceName ?? "Scalist",
  };
  const defaultSubject = `Booking confirmed — ${propertyAddress}`;
  const defaultBody = `
      <h2 style="color:#1B4F9E;margin:0 0 8px;">Your shoot is confirmed</h2>
      <p style="color:#475569;margin:0 0 4px;">Hi ${clientName},</p>
      <p style="color:#475569;">Your real estate photography shoot has been confirmed and is on our calendar.</p>
      ${infoBox([
        ["Job #", jobNumber],
        ["Property", propertyAddress],
        ["Date & Time", format(scheduledAt, "EEEE, MMMM d 'at' h:mm a")],
        ["Package", packageName],
      ])}
      <p style="color:#475569;">You'll receive a reminder 24 hours before your shoot, and another notification when your media is ready to download.</p>
      <p style="color:#64748b;font-size:13px;">Questions? Reply to this email.</p>`;

  const tpl = await resolveTemplate(workspaceId, "job_confirmation", vars, { subject: defaultSubject, body: defaultBody });
  if (!tpl.enabled) return null;
  const branding = await getWorkspaceBranding(workspaceId);

  return trackedSend("sendJobConfirmationEmail", workspaceId, {
    from: EMAIL_FROM,
    to,
    subject: tpl.subject,
    html: emailWrapper(tpl.body, branding),
  });
}

/** 24-hour reminder → client */
export async function sendJobReminderEmail({
  to, clientName, jobNumber, propertyAddress, scheduledAt, accessNotes, workspaceName, workspaceId,
}: {
  to: string; clientName: string; jobNumber: string;
  propertyAddress: string; scheduledAt: Date; accessNotes?: string | null;
  workspaceName?: string; workspaceId?: string;
}) {
  const vars = {
    clientName, jobNumber, propertyAddress,
    scheduledDate: format(scheduledAt, "EEEE, MMMM d"),
    scheduledTime: format(scheduledAt, "h:mm a"),
    accessNotes: accessNotes ?? "",
    workspaceName: workspaceName ?? "Scalist",
  };
  const defaultSubject = `Reminder: Your shoot is tomorrow — ${propertyAddress}`;
  const defaultBody = `
      <h2 style="color:#1B4F9E;margin:0 0 8px;">Shoot reminder</h2>
      <p style="color:#475569;margin:0 0 4px;">Hi ${clientName},</p>
      <p style="color:#475569;">This is a friendly reminder that your photography shoot is <strong>tomorrow</strong>.</p>
      ${infoBox([
        ["Job #", jobNumber],
        ["Property", propertyAddress],
        ["Date & Time", format(scheduledAt, "EEEE, MMMM d 'at' h:mm a")],
        ...(accessNotes ? [["Access Notes", accessNotes] as [string, string]] : []),
      ])}
      <p style="color:#475569;">Please ensure the property is accessible at the scheduled time. If you need to reschedule, contact us as soon as possible.</p>`;

  const tpl = await resolveTemplate(workspaceId, "job_reminder", vars, { subject: defaultSubject, body: defaultBody });
  if (!tpl.enabled) return null;
  const branding = await getWorkspaceBranding(workspaceId);

  return trackedSend("sendJobReminderEmail", workspaceId, {
    from: EMAIL_FROM,
    to,
    subject: tpl.subject,
    html: emailWrapper(tpl.body, branding),
  });
}

/** Photographer assigned → staff member */
export async function sendJobAssignedEmail({
  to, photographerName, jobId, jobNumber, propertyAddress, scheduledAt, clientName, accessNotes, workspaceName, workspaceId,
}: {
  to: string; photographerName: string; jobId: string; jobNumber: string; propertyAddress: string;
  scheduledAt: Date; clientName: string; accessNotes?: string | null;
  workspaceName?: string; workspaceId?: string;
}) {
  const vars = {
    photographerName, jobNumber, clientName, propertyAddress,
    scheduledDate: format(scheduledAt, "EEEE, MMMM d"),
    scheduledTime: format(scheduledAt, "h:mm a"),
    accessNotes: accessNotes ?? "", jobUrl: `${APP_URL}/jobs/${jobId}`,
    workspaceName: workspaceName ?? "Scalist",
  };
  const defaultSubject = `New job assigned — ${jobNumber}`;
  const defaultBody = `
      <h2 style="color:#1B4F9E;margin:0 0 8px;">You've been assigned a job</h2>
      <p style="color:#475569;margin:0 0 4px;">Hi ${photographerName},</p>
      <p style="color:#475569;">A new job has been assigned to you. Here are the details:</p>
      ${infoBox([
        ["Job #", jobNumber],
        ["Client", clientName],
        ["Property", propertyAddress],
        ["Date & Time", format(scheduledAt, "EEEE, MMMM d 'at' h:mm a")],
        ...(accessNotes ? [["Access Notes", accessNotes] as [string, string]] : []),
      ])}
      ${ctaButton("View Job Details", `${APP_URL}/jobs/${jobId}`)}`;

  const tpl = await resolveTemplate(workspaceId, "job_assigned", vars, { subject: defaultSubject, body: defaultBody });
  if (!tpl.enabled) return null;
  const branding = await getWorkspaceBranding(workspaceId);

  return trackedSend("sendJobAssignedEmail", workspaceId, {
    from: EMAIL_FROM,
    to,
    subject: tpl.subject,
    html: emailWrapper(tpl.body, branding),
  });
}

/** Job cancelled → client */
export async function sendJobCancelledEmail({
  to, clientName, jobNumber, propertyAddress, reason, workspaceName, workspaceId,
}: {
  to: string; clientName: string; jobNumber: string;
  propertyAddress: string; reason?: string | null;
  workspaceName?: string; workspaceId?: string;
}) {
  const vars = {
    clientName, jobNumber, propertyAddress, reason: reason ?? "",
    workspaceName: workspaceName ?? "Scalist",
  };
  const defaultSubject = `Appointment cancelled — ${jobNumber}`;
  const defaultBody = `
      <h2 style="color:#dc2626;margin:0 0 8px;">Appointment cancelled</h2>
      <p style="color:#475569;margin:0 0 4px;">Hi ${clientName},</p>
      <p style="color:#475569;">Your photography appointment for <strong>${propertyAddress}</strong> (${jobNumber}) has been cancelled.</p>
      ${reason ? `<p style="color:#475569;"><strong>Reason:</strong> ${reason}</p>` : ""}
      <p style="color:#475569;">To reschedule, please contact us and we'll be happy to find a new time.</p>`;

  const tpl = await resolveTemplate(workspaceId, "job_cancelled", vars, { subject: defaultSubject, body: defaultBody });
  if (!tpl.enabled) return null;
  const branding = await getWorkspaceBranding(workspaceId);

  return trackedSend("sendJobCancelledEmail", workspaceId, {
    from: EMAIL_FROM,
    to,
    subject: tpl.subject,
    html: emailWrapper(tpl.body, branding),
  });
}

/** Media ready → client */
export async function sendGalleryReadyEmail({
  to, clientName, jobNumber, propertyAddress, galleryUrl, workspaceName, workspaceId,
}: {
  to: string; clientName: string; jobNumber: string;
  propertyAddress: string; galleryUrl: string;
  workspaceName?: string; workspaceId?: string;
}) {
  const vars = {
    clientName, jobNumber, propertyAddress, galleryUrl,
    workspaceName: workspaceName ?? "Scalist",
  };
  const defaultSubject = `Your media is ready — ${propertyAddress}`;
  const defaultBody = `
      <h2 style="color:#1B4F9E;margin:0 0 8px;">Your media is ready!</h2>
      <p style="color:#475569;margin:0 0 4px;">Hi ${clientName},</p>
      <p style="color:#475569;">The photos for your property at <strong>${propertyAddress}</strong> (Job #${jobNumber}) are ready to view and download.</p>
      ${ctaButton("View & Download Gallery", galleryUrl)}
      <p style="color:#94a3b8;font-size:12px;">Gallery link expires in 30 days. Download your files before then.</p>`;

  const tpl = await resolveTemplate(workspaceId, "gallery_ready", vars, { subject: defaultSubject, body: defaultBody });
  if (!tpl.enabled) return null;
  const branding = await getWorkspaceBranding(workspaceId);

  return trackedSend("sendGalleryReadyEmail", workspaceId, {
    from: EMAIL_FROM,
    to,
    subject: tpl.subject,
    html: emailWrapper(tpl.body, branding),
  });
}

/** Invoice sent → client */
export async function sendInvoiceEmail({
  to, clientName, invoiceNumber, amount, dueDate, paymentLink, workspaceName, workspaceId,
}: {
  to: string; clientName: string; invoiceNumber: string;
  amount: number; dueDate: Date; paymentLink: string;
  workspaceName?: string; workspaceId?: string;
}) {
  const vars = {
    clientName, invoiceNumber, amount: `$${amount.toFixed(2)}`,
    dueDate: format(dueDate, "MMMM d, yyyy"), paymentLink,
    workspaceName: workspaceName ?? "Scalist",
  };
  const defaultSubject = `Invoice ${invoiceNumber} — $${amount.toFixed(2)} due`;
  const defaultBody = `
      <h2 style="color:#1B4F9E;margin:0 0 8px;">Invoice ${invoiceNumber}</h2>
      <p style="color:#475569;margin:0 0 4px;">Hi ${clientName},</p>
      <p style="color:#475569;">Please find your invoice details below.</p>
      ${infoBox([
        ["Invoice #", invoiceNumber],
        ["Amount Due", `$${amount.toFixed(2)}`],
        ["Due Date", format(dueDate, "MMMM d, yyyy")],
      ])}
      ${ctaButton("Pay Invoice", paymentLink)}
      <p style="color:#475569;font-size:13px;">Payment methods accepted: credit card, ACH bank transfer.</p>`;

  const tpl = await resolveTemplate(workspaceId, "invoice_sent", vars, { subject: defaultSubject, body: defaultBody });
  if (!tpl.enabled) return null;
  const branding = await getWorkspaceBranding(workspaceId);

  return trackedSend("sendInvoiceEmail", workspaceId, {
    from: EMAIL_FROM,
    to,
    subject: tpl.subject,
    html: emailWrapper(tpl.body, branding),
  });
}

/** Invoice payment reminder → client */
export async function sendInvoiceReminderEmail({
  to, clientName, invoiceNumber, amount, dueDate, paymentLink, daysUntilDue, workspaceName, workspaceId,
}: {
  to: string; clientName: string; invoiceNumber: string;
  amount: number; dueDate: Date; paymentLink: string;
  daysUntilDue: number; workspaceName?: string; workspaceId?: string;
}) {
  const vars = {
    clientName, invoiceNumber, amount: `$${amount.toFixed(2)}`,
    dueDate: format(dueDate, "MMMM d, yyyy"), paymentLink,
    daysUntilDue: daysUntilDue.toString(),
    workspaceName: workspaceName ?? "Scalist",
  };
  const urgency = daysUntilDue <= 1 ? "Tomorrow" : `in ${daysUntilDue} days`;
  const defaultSubject = `Reminder: Invoice ${invoiceNumber} — $${amount.toFixed(2)} due ${urgency}`;
  const defaultBody = `
      <h2 style="color:#f59e0b;margin:0 0 8px;">Payment reminder</h2>
      <p style="color:#475569;margin:0 0 4px;">Hi ${clientName},</p>
      <p style="color:#475569;">This is a friendly reminder that your invoice is due <strong>${urgency}</strong>.</p>
      ${infoBox([
        ["Invoice #", invoiceNumber],
        ["Amount Due", `$${amount.toFixed(2)}`],
        ["Due Date", format(dueDate, "MMMM d, yyyy")],
      ])}
      ${ctaButton("Pay Invoice", paymentLink)}
      <p style="color:#475569;font-size:13px;">Payment methods accepted: credit card, ACH bank transfer.</p>`;

  const tpl = await resolveTemplate(workspaceId, "invoice_reminder", vars, { subject: defaultSubject, body: defaultBody });
  if (!tpl.enabled) return null;
  const branding = await getWorkspaceBranding(workspaceId);

  return trackedSend("sendInvoiceReminderEmail", workspaceId, {
    from: EMAIL_FROM,
    to,
    subject: tpl.subject,
    html: emailWrapper(tpl.body, branding),
  });
}

/** Invoice overdue notice → client */
export async function sendInvoiceOverdueEmail({
  to, clientName, invoiceNumber, amount, dueDate, paymentLink, daysOverdue, workspaceName, workspaceId,
}: {
  to: string; clientName: string; invoiceNumber: string;
  amount: number; dueDate: Date; paymentLink: string;
  daysOverdue: number; workspaceName?: string; workspaceId?: string;
}) {
  const vars = {
    clientName, invoiceNumber, amount: `$${amount.toFixed(2)}`,
    dueDate: format(dueDate, "MMMM d, yyyy"), paymentLink,
    daysOverdue: daysOverdue.toString(),
    workspaceName: workspaceName ?? "Scalist",
  };
  const defaultSubject = `Overdue: Invoice ${invoiceNumber} — $${amount.toFixed(2)} was due ${format(dueDate, "MMMM d")}`;
  const defaultBody = `
      <h2 style="color:#dc2626;margin:0 0 8px;">Invoice overdue</h2>
      <p style="color:#475569;margin:0 0 4px;">Hi ${clientName},</p>
      <p style="color:#475569;">Your invoice is now <strong>${daysOverdue} days past due</strong>. Please submit payment as soon as possible.</p>
      ${infoBox([
        ["Invoice #", invoiceNumber],
        ["Amount Due", `$${amount.toFixed(2)}`],
        ["Due Date", format(dueDate, "MMMM d, yyyy")],
      ])}
      ${ctaButton("Pay Now", paymentLink)}
      <p style="color:#475569;font-size:13px;">If you've already sent payment, please disregard this notice.</p>`;

  const tpl = await resolveTemplate(workspaceId, "invoice_overdue", vars, { subject: defaultSubject, body: defaultBody });
  if (!tpl.enabled) return null;
  const branding = await getWorkspaceBranding(workspaceId);

  return trackedSend("sendInvoiceOverdueEmail", workspaceId, {
    from: EMAIL_FROM,
    to,
    subject: tpl.subject,
    html: emailWrapper(tpl.body, branding),
  });
}

/** Payment receipt → client */
export async function sendPaymentReceiptEmail({
  to, clientName, invoiceNumber, amount, paidAt, workspaceName, workspaceId,
}: {
  to: string; clientName: string; invoiceNumber: string;
  amount: number; paidAt: Date;
  workspaceName?: string; workspaceId?: string;
}) {
  const vars = {
    clientName, invoiceNumber, amount: `$${amount.toFixed(2)}`,
    paidDate: format(paidAt, "MMMM d, yyyy"),
    workspaceName: workspaceName ?? "Scalist",
  };
  const defaultSubject = `Payment received — Invoice ${invoiceNumber}`;
  const defaultBody = `
      <h2 style="color:#16a34a;margin:0 0 8px;">Payment received</h2>
      <p style="color:#475569;margin:0 0 4px;">Hi ${clientName},</p>
      <p style="color:#475569;">We've received your payment. Thank you!</p>
      ${infoBox([
        ["Invoice #", invoiceNumber],
        ["Amount Paid", `$${amount.toFixed(2)}`],
        ["Date", format(paidAt, "MMMM d, yyyy")],
      ])}
      <p style="color:#475569;font-size:13px;">This email serves as your payment receipt. Please save it for your records.</p>`;

  const tpl = await resolveTemplate(workspaceId, "payment_receipt", vars, { subject: defaultSubject, body: defaultBody });
  if (!tpl.enabled) return null;
  const branding = await getWorkspaceBranding(workspaceId);

  return trackedSend("sendPaymentReceiptEmail", workspaceId, {
    from: EMAIL_FROM,
    to,
    subject: tpl.subject,
    html: emailWrapper(tpl.body, branding),
  });
}

/** Welcome email → new workspace owner after signup */
export async function sendWelcomeEmail({
  to, ownerName, workspaceName, workspaceSlug,
}: {
  to: string; ownerName: string; workspaceName: string; workspaceSlug: string;
}) {
  const dashboardUrl = `${APP_URL}/dashboard`;
  const bookingUrl = `${APP_URL}/book/${workspaceSlug}`;
  return trackedSend("sendWelcomeEmail", undefined, {
    from: EMAIL_FROM,
    to,
    subject: `Welcome to Scalist — let's get ${workspaceName} set up 🎉`,
    html: emailWrapper(`
      <h2 style="color:#1B4F9E;margin:0 0 8px;">Welcome to Scalist, ${ownerName}! 👋</h2>
      <p style="color:#475569;margin:0 0 16px;">
        Your studio <strong>${workspaceName}</strong> is live and your 14-day free trial has started. Here's how to hit the ground running:
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
          <span style="color:#1B4F9E;font-weight:600;">1.</span>
          <span style="color:#334155;margin-left:8px;">Add your services &amp; packages under <strong>Products</strong></span>
        </td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
          <span style="color:#1B4F9E;font-weight:600;">2.</span>
          <span style="color:#334155;margin-left:8px;">Set your business hours under <strong>Availability</strong></span>
        </td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
          <span style="color:#1B4F9E;font-weight:600;">3.</span>
          <span style="color:#334155;margin-left:8px;">Share your booking page with clients</span>
        </td></tr>
        <tr><td style="padding:8px 0;">
          <span style="color:#1B4F9E;font-weight:600;">4.</span>
          <span style="color:#334155;margin-left:8px;">Create your first job or let clients book themselves</span>
        </td></tr>
      </table>
      <p style="margin:0 0 8px;">
        <a href="${bookingUrl}" style="color:#94a3b8;font-size:13px;">
          📎 Your booking page: ${bookingUrl}
        </a>
      </p>
      <a href="${dashboardUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#1B4F9E;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
        Go to Dashboard →
      </a>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;">
        Questions? Just reply to this email — we're here to help.
      </p>
    `),
  });
}


/** Reschedule notice → client (S5/C3) */
export async function sendJobRescheduledEmail({
  to, clientName, jobNumber, propertyAddress, oldTime, newTime, workspaceName, workspaceId,
}: {
  to: string; clientName: string; jobNumber: string; propertyAddress: string;
  oldTime: Date; newTime: Date; workspaceName?: string; workspaceId?: string;
}) {
  const vars = {
    clientName, jobNumber, propertyAddress,
    oldTime: format(oldTime, "EEEE, MMMM d 'at' h:mm a"),
    newTime: format(newTime, "EEEE, MMMM d 'at' h:mm a"),
    workspaceName: workspaceName ?? "Scalist",
  };
  const defaultSubject = `New time for your shoot — ${propertyAddress}`;
  const defaultBody = `
      <h2 style="color:#1B4F9E;margin:0 0 8px;">Your shoot has been rescheduled</h2>
      <p style="color:#475569;margin:0 0 4px;">Hi ${clientName},</p>
      <p style="color:#475569;">The appointment for <strong>${propertyAddress}</strong> has a new time.</p>
      ${infoBox([
        ["Job #", jobNumber],
        ["Previous", vars.oldTime],
        ["New time", vars.newTime],
      ])}
      <p style="color:#475569;">If the new time doesn't work for you, just reply to this email.</p>`;
  const tpl = await resolveTemplate(workspaceId, "job_rescheduled", vars, { subject: defaultSubject, body: defaultBody });
  if (!tpl.enabled) return null;
  const branding = await getWorkspaceBranding(workspaceId);
  return trackedSend("sendJobRescheduledEmail", workspaceId, {
    from: EMAIL_FROM,
    to,
    subject: tpl.subject,
    html: emailWrapper(tpl.body, branding),
  });
}
