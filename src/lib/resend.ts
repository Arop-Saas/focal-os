import { Resend } from "resend";
import { format } from "date-fns";

export const resend = new Resend(process.env.RESEND_API_KEY);

export const EMAIL_FROM =
  process.env.EMAIL_FROM ?? "Focal OS <noreply@focal-os.app>";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://focal-os.vercel.app";

// ─── Shared layout ──────────────────────────────────────────────────────────

function emailWrapper(body: string) {
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
          <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">Focal OS</span>
          <span style="color:rgba(255,255,255,0.6);font-size:13px;margin-left:8px;">Real Estate Media Platform</span>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">${body}</td></tr>
        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e9ecef;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">
            You're receiving this because you have an appointment with a Focal OS member.
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

/** Booking confirmation → client */
export async function sendJobConfirmationEmail({
  to, clientName, jobNumber, propertyAddress, scheduledAt, packageName,
}: {
  to: string; clientName: string; jobNumber: string;
  propertyAddress: string; scheduledAt: Date; packageName: string;
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
    `),
  });
}

/** 24-hour reminder → client */
export async function sendJobReminderEmail({
  to, clientName, jobNumber, propertyAddress, scheduledAt, accessNotes,
}: {
  to: string; clientName: string; jobNumber: string;
  propertyAddress: string; scheduledAt: Date; accessNotes?: string | null;
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
    `),
  });
}

/** Photographer assigned → staff member */
export async function sendJobAssignedEmail({
  to, photographerName, jobNumber, propertyAddress, scheduledAt, clientName, accessNotes,
}: {
  to: string; photographerName: string; jobNumber: string; propertyAddress: string;
  scheduledAt: Date; clientName: string; accessNotes?: string | null;
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
      ${ctaButton("View Job Details", `${APP_URL}/jobs/${encodeURIComponent(jobNumber)}`)}
    `),
  });
}

/** Job cancelled → client */
export async function sendJobCancelledEmail({
  to, clientName, jobNumber, propertyAddress, reason,
}: {
  to: string; clientName: string; jobNumber: string;
  propertyAddress: string; reason?: string | null;
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
    `),
  });
}

/** Media ready → client */
export async function sendGalleryReadyEmail({
  to, clientName, jobNumber, propertyAddress, galleryUrl,
}: {
  to: string; clientName: string; jobNumber: string;
  propertyAddress: string; galleryUrl: string;
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
    `),
  });
}

/** Invoice sent → client */
export async function sendInvoiceEmail({
  to, clientName, invoiceNumber, amount, dueDate, paymentLink,
}: {
  to: string; clientName: string; invoiceNumber: string;
  amount: number; dueDate: Date; paymentLink: string;
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
    `),
  });
}

/** Payment receipt → client */
export async function sendPaymentReceiptEmail({
  to, clientName, invoiceNumber, amount, paidAt,
}: {
  to: string; clientName: string; invoiceNumber: string;
  amount: number; paidAt: Date;
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
    `),
  });
}
