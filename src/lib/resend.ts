import { Resend } from "resend";
import { format } from "date-fns";

export const resend = new Resend(process.env.RESEND_API_KEY);

export const EMAIL_FROM =
  process.env.EMAIL_FROM ?? "Scalist <onboarding@resend.dev>";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.scalist.io";

// ─── Shared layout ──────────────────────────────────────────────────────────

function emailWrapper(body: string, workspaceName?: string) {
  const brandName = workspaceName ?? "Scalist";
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
        <tr><td style="background:#1B4F9E;padding:24px 32px;">
          <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">${brandName}</span>
          <span style="color:rgba(255,255,255,0.6);font-size:13px;margin-left:8px;">Real Estate Photography</span>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">${body}</td></tr>
        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e9ecef;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">
            You're receiving this because you have an appointment with ${brandName}.
            Questions? Reply to this email.
          </p>
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

// ─── Templates ───────────────────────────────────────────────────────────────

/** Portal welcome / account created → client */
export async function sendPortalWelcomeEmail({
  to, clientName, workspaceName, portalUrl,
}: {
  to: string; clientName: string; workspaceName?: string; portalUrl: string;
}) {
  const brand = workspaceName ?? "Scalist";
  return resend.emails.send({
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
  to, clientName, jobNumber, propertyAddress, scheduledAt, packageName, workspaceName,
}: {
  to: string; clientName: string; jobNumber: string;
  propertyAddress: string; scheduledAt: Date; packageName: string;
  workspaceName?: string;
}) {
  return resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: `Booking confirmed — ${propertyAddress}`,
    html: emailWrapper(`
      <h2 style="color:#1B4F9E;margin:0 0 8px;">Your shoot is confirmed ✅</h2>
      <p style="color:#475569;margin:0 0 4px;">Hi ${clientName},</p>
      <p style="color:#475569;">Your real estate photography shoot has been confirmed and is on our calendar.</p>
      ${infoBox([
        ["Job #", jobNumber],
        ["Property", propertyAddress],
        ["Date & Time", format(scheduledAt, "EEEE, MMMM d 'at' h:mm a")],
        ["Package", packageName],
      ])}
      <p style="color:#475569;">You'll receive a reminder 24 hours before your shoot, and another notification when your media is ready to download.</p>
      <p style="color:#64748b;font-size:13px;">Questions? Reply to this email.</p>
    `, workspaceName),
  });
}

/** 24-hour reminder → client */
export async function sendJobReminderEmail({
  to, clientName, jobNumber, propertyAddress, scheduledAt, accessNotes, workspaceName,
}: {
  to: string; clientName: string; jobNumber: string;
  propertyAddress: string; scheduledAt: Date; accessNotes?: string | null;
  workspaceName?: string;
}) {
  return resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: `Reminder: Your shoot is tomorrow — ${propertyAddress}`,
    html: emailWrapper(`
      <h2 style="color:#1B4F9E;margin:0 0 8px;">Shoot reminder 📅</h2>
      <p style="color:#475569;margin:0 0 4px;">Hi ${clientName},</p>
      <p style="color:#475569;">This is a friendly reminder that your photography shoot is <strong>tomorrow</strong>.</p>
      ${infoBox([
        ["Job #", jobNumber],
        ["Property", propertyAddress],
        ["Date & Time", format(scheduledAt, "EEEE, MMMM d 'at' h:mm a")],
        ...(accessNotes ? [["Access Notes", accessNotes] as [string, string]] : []),
      ])}
      <p style="color:#475569;">Please ensure the property is accessible at the scheduled time. If you need to reschedule, contact us as soon as possible.</p>
    `, workspaceName),
  });
}

/** Photographer assigned → staff member */
export async function sendJobAssignedEmail({
  to, photographerName, jobId, jobNumber, propertyAddress, scheduledAt, clientName, accessNotes, workspaceName,
}: {
  to: string; photographerName: string; jobId: string; jobNumber: string; propertyAddress: string;
  scheduledAt: Date; clientName: string; accessNotes?: string | null;
  workspaceName?: string;
}) {
  return resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: `New job assigned — ${jobNumber}`,
    html: emailWrapper(`
      <h2 style="color:#1B4F9E;margin:0 0 8px;">You've been assigned a job 📷</h2>
      <p style="color:#475569;margin:0 0 4px;">Hi ${photographerName},</p>
      <p style="color:#475569;">A new job has been assigned to you. Here are the details:</p>
      ${infoBox([
        ["Job #", jobNumber],
        ["Client", clientName],
        ["Property", propertyAddress],
        ["Date & Time", format(scheduledAt, "EEEE, MMMM d 'at' h:mm a")],
        ...(accessNotes ? [["Access Notes", accessNotes] as [string, string]] : []),
      ])}
      ${ctaButton("View Job Details", `${APP_URL}/jobs/${jobId}`)}
    `, workspaceName),
  });
}

/** Job cancelled → client */
export async function sendJobCancelledEmail({
  to, clientName, jobNumber, propertyAddress, reason, workspaceName,
}: {
  to: string; clientName: string; jobNumber: string;
  propertyAddress: string; reason?: string | null;
  workspaceName?: string;
}) {
  return resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: `Appointment cancelled — ${jobNumber}`,
    html: emailWrapper(`
      <h2 style="color:#dc2626;margin:0 0 8px;">Appointment cancelled</h2>
      <p style="color:#475569;margin:0 0 4px;">Hi ${clientName},</p>
      <p style="color:#475569;">Your photography appointment for <strong>${propertyAddress}</strong> (${jobNumber}) has been cancelled.</p>
      ${reason ? `<p style="color:#475569;"><strong>Reason:</strong> ${reason}</p>` : ""}
      <p style="color:#475569;">To reschedule, please contact us and we'll be happy to find a new time.</p>
    `, workspaceName),
  });
}

/** Media ready → client */
export async function sendGalleryReadyEmail({
  to, clientName, jobNumber, propertyAddress, galleryUrl, workspaceName,
}: {
  to: string; clientName: string; jobNumber: string;
  propertyAddress: string; galleryUrl: string;
  workspaceName?: string;
}) {
  return resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: `Your media is ready — ${propertyAddress}`,
    html: emailWrapper(`
      <h2 style="color:#1B4F9E;margin:0 0 8px;">Your media is ready! 📸</h2>
      <p style="color:#475569;margin:0 0 4px;">Hi ${clientName},</p>
      <p style="color:#475569;">The photos for your property at <strong>${propertyAddress}</strong> (Job #${jobNumber}) are ready to view and download.</p>
      ${ctaButton("View & Download Gallery", galleryUrl)}
      <p style="color:#94a3b8;font-size:12px;">Gallery link expires in 30 days. Download your files before then.</p>
    `, workspaceName),
  });
}

/** Invoice sent → client */
export async function sendInvoiceEmail({
  to, clientName, invoiceNumber, amount, dueDate, paymentLink, workspaceName,
}: {
  to: string; clientName: string; invoiceNumber: string;
  amount: number; dueDate: Date; paymentLink: string;
  workspaceName?: string;
}) {
  return resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: `Invoice ${invoiceNumber} — $${amount.toFixed(2)} due`,
    html: emailWrapper(`
      <h2 style="color:#1B4F9E;margin:0 0 8px;">Invoice ${invoiceNumber}</h2>
      <p style="color:#475569;margin:0 0 4px;">Hi ${clientName},</p>
      <p style="color:#475569;">Please find your invoice details below.</p>
      ${infoBox([
        ["Invoice #", invoiceNumber],
        ["Amount Due", `$${amount.toFixed(2)}`],
        ["Due Date", format(dueDate, "MMMM d, yyyy")],
      ])}
      ${ctaButton("Pay Invoice", paymentLink)}
      <p style="color:#475569;font-size:13px;">Payment methods accepted: credit card, ACH bank transfer.</p>
    `, workspaceName),
  });
}

/** Payment receipt → client */
export async function sendPaymentReceiptEmail({
  to, clientName, invoiceNumber, amount, paidAt, workspaceName,
}: {
  to: string; clientName: string; invoiceNumber: string;
  amount: number; paidAt: Date;
  workspaceName?: string;
}) {
  return resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: `Payment received — Invoice ${invoiceNumber}`,
    html: emailWrapper(`
      <h2 style="color:#16a34a;margin:0 0 8px;">Payment received ✅</h2>
      <p style="color:#475569;margin:0 0 4px;">Hi ${clientName},</p>
      <p style="color:#475569;">We've received your payment. Thank you!</p>
      ${infoBox([
        ["Invoice #", invoiceNumber],
        ["Amount Paid", `$${amount.toFixed(2)}`],
        ["Date", format(paidAt, "MMMM d, yyyy")],
      ])}
      <p style="color:#475569;font-size:13px;">This email serves as your payment receipt. Please save it for your records.</p>
    `, workspaceName),
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
  return resend.emails.send({
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
