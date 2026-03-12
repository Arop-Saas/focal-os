import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

export const EMAIL_FROM = process.env.EMAIL_FROM ?? "noreply@focal-os.app";

// ─── Email Templates ─────────────────────────────────────────────────────────

export async function sendJobConfirmationEmail({
  to,
  clientName,
  jobNumber,
  propertyAddress,
  scheduledAt,
  packageName,
}: {
  to: string;
  clientName: string;
  jobNumber: string;
  propertyAddress: string;
  scheduledAt: Date;
  packageName: string;
}) {
  return resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: `Job Confirmed — ${jobNumber} at ${propertyAddress}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1B4F9E;">Your shoot is confirmed ✅</h2>
        <p>Hi ${clientName},</p>
        <p>Your photography shoot has been confirmed. Here are the details:</p>
        <div style="background: #f5f8ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Job #:</strong> ${jobNumber}</p>
          <p><strong>Property:</strong> ${propertyAddress}</p>
          <p><strong>Date & Time:</strong> ${scheduledAt.toLocaleString()}</p>
          <p><strong>Package:</strong> ${packageName}</p>
        </div>
        <p>You'll receive another notification when your media is ready for download.</p>
        <p>Questions? Reply to this email or contact your coordinator.</p>
        <p style="color: #666; font-size: 12px; margin-top: 40px;">Focal OS — Real Estate Media Platform</p>
      </div>
    `,
  });
}

export async function sendGalleryReadyEmail({
  to,
  clientName,
  jobNumber,
  propertyAddress,
  galleryUrl,
}: {
  to: string;
  clientName: string;
  jobNumber: string;
  propertyAddress: string;
  galleryUrl: string;
}) {
  return resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: `Your media is ready — ${propertyAddress}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1B4F9E;">Your media is ready! 📸</h2>
        <p>Hi ${clientName},</p>
        <p>Your photos for <strong>${propertyAddress}</strong> (Job #${jobNumber}) are ready to download.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${galleryUrl}" style="background: #1B4F9E; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            View & Download Gallery
          </a>
        </div>
        <p style="color: #666; font-size: 12px;">Link expires in 30 days. Download your files before then.</p>
        <p style="color: #666; font-size: 12px; margin-top: 40px;">Focal OS — Real Estate Media Platform</p>
      </div>
    `,
  });
}

export async function sendInvoiceEmail({
  to,
  clientName,
  invoiceNumber,
  amount,
  dueDate,
  paymentLink,
}: {
  to: string;
  clientName: string;
  invoiceNumber: string;
  amount: number;
  dueDate: Date;
  paymentLink: string;
}) {
  return resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: `Invoice ${invoiceNumber} — $${amount.toFixed(2)} due ${dueDate.toLocaleDateString()}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1B4F9E;">Invoice ${invoiceNumber}</h2>
        <p>Hi ${clientName},</p>
        <p>Please find your invoice details below:</p>
        <div style="background: #f5f8ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Invoice #:</strong> ${invoiceNumber}</p>
          <p><strong>Amount Due:</strong> $${amount.toFixed(2)}</p>
          <p><strong>Due Date:</strong> ${dueDate.toLocaleDateString()}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${paymentLink}" style="background: #1B4F9E; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            Pay Invoice
          </a>
        </div>
        <p style="color: #666; font-size: 12px; margin-top: 40px;">Focal OS — Real Estate Media Platform</p>
      </div>
    `,
  });
}
