import { z } from "zod";
import { router, ownerProcedure, workspaceProcedure } from "../trpc";

// ─── Available template event types and their dynamic variables ──────────────

export const EMAIL_EVENT_TYPES = {
  job_confirmation: {
    label: "Booking Confirmation",
    description: "Sent to the client when a booking is confirmed",
    variables: ["clientName", "jobNumber", "propertyAddress", "scheduledDate", "scheduledTime", "packageName", "workspaceName"],
    defaultSubject: "Booking confirmed — {{propertyAddress}}",
    defaultBody: `<h2 style="color:#1B4F9E;margin:0 0 8px;">Your shoot is confirmed</h2>
<p>Hi {{clientName}},</p>
<p>Your real estate photography shoot has been confirmed and is on our calendar.</p>
<p><strong>Job #:</strong> {{jobNumber}}<br/>
<strong>Property:</strong> {{propertyAddress}}<br/>
<strong>Date & Time:</strong> {{scheduledDate}} at {{scheduledTime}}<br/>
<strong>Package:</strong> {{packageName}}</p>
<p>You'll receive a reminder 24 hours before your shoot, and another notification when your media is ready to download.</p>
<p style="color:#64748b;font-size:13px;">Questions? Reply to this email.</p>`,
  },
  job_reminder: {
    label: "24-Hour Reminder",
    description: "Sent to the client 24 hours before the shoot",
    variables: ["clientName", "jobNumber", "propertyAddress", "scheduledDate", "scheduledTime", "accessNotes", "workspaceName"],
    defaultSubject: "Reminder: Your shoot is tomorrow — {{propertyAddress}}",
    defaultBody: `<h2 style="color:#1B4F9E;margin:0 0 8px;">Shoot reminder</h2>
<p>Hi {{clientName}},</p>
<p>This is a friendly reminder that your photography shoot is <strong>tomorrow</strong>.</p>
<p><strong>Job #:</strong> {{jobNumber}}<br/>
<strong>Property:</strong> {{propertyAddress}}<br/>
<strong>Date & Time:</strong> {{scheduledDate}} at {{scheduledTime}}</p>
<p>Please ensure the property is accessible at the scheduled time. If you need to reschedule, contact us as soon as possible.</p>`,
  },
  job_assigned: {
    label: "Job Assigned to Photographer",
    description: "Sent to a staff member when they are assigned a job",
    variables: ["photographerName", "jobNumber", "clientName", "propertyAddress", "scheduledDate", "scheduledTime", "accessNotes", "jobUrl", "workspaceName"],
    defaultSubject: "New job assigned — {{jobNumber}}",
    defaultBody: `<h2 style="color:#1B4F9E;margin:0 0 8px;">You've been assigned a job</h2>
<p>Hi {{photographerName}},</p>
<p>A new job has been assigned to you. Here are the details:</p>
<p><strong>Job #:</strong> {{jobNumber}}<br/>
<strong>Client:</strong> {{clientName}}<br/>
<strong>Property:</strong> {{propertyAddress}}<br/>
<strong>Date & Time:</strong> {{scheduledDate}} at {{scheduledTime}}</p>`,
  },
  job_cancelled: {
    label: "Booking Cancelled",
    description: "Sent to the client when an appointment is cancelled",
    variables: ["clientName", "jobNumber", "propertyAddress", "reason", "workspaceName"],
    defaultSubject: "Appointment cancelled — {{jobNumber}}",
    defaultBody: `<h2 style="color:#dc2626;margin:0 0 8px;">Appointment cancelled</h2>
<p>Hi {{clientName}},</p>
<p>Your photography appointment for <strong>{{propertyAddress}}</strong> ({{jobNumber}}) has been cancelled.</p>
<p>To reschedule, please contact us and we'll be happy to find a new time.</p>`,
  },
  gallery_ready: {
    label: "Media Ready / Gallery Delivered",
    description: "Sent to the client when their photos are ready to download",
    variables: ["clientName", "jobNumber", "propertyAddress", "galleryUrl", "workspaceName"],
    defaultSubject: "Your media is ready — {{propertyAddress}}",
    defaultBody: `<h2 style="color:#1B4F9E;margin:0 0 8px;">Your media is ready!</h2>
<p>Hi {{clientName}},</p>
<p>The photos for your property at <strong>{{propertyAddress}}</strong> (Job #{{jobNumber}}) are ready to view and download.</p>
<p style="color:#94a3b8;font-size:12px;">Gallery link expires in 30 days. Download your files before then.</p>`,
  },
  invoice_sent: {
    label: "Invoice Sent",
    description: "Sent to the client when an invoice is published / emailed",
    variables: ["clientName", "invoiceNumber", "amount", "dueDate", "paymentLink", "workspaceName"],
    defaultSubject: "Invoice {{invoiceNumber}} — {{amount}} due",
    defaultBody: `<h2 style="color:#1B4F9E;margin:0 0 8px;">Invoice {{invoiceNumber}}</h2>
<p>Hi {{clientName}},</p>
<p>Please find your invoice details below.</p>
<p><strong>Invoice #:</strong> {{invoiceNumber}}<br/>
<strong>Amount Due:</strong> {{amount}}<br/>
<strong>Due Date:</strong> {{dueDate}}</p>
<p style="font-size:13px;">Payment methods accepted: credit card, ACH bank transfer.</p>`,
  },
  payment_receipt: {
    label: "Payment Receipt",
    description: "Sent to the client after a payment is received",
    variables: ["clientName", "invoiceNumber", "amount", "paidDate", "workspaceName"],
    defaultSubject: "Payment received — Invoice {{invoiceNumber}}",
    defaultBody: `<h2 style="color:#16a34a;margin:0 0 8px;">Payment received</h2>
<p>Hi {{clientName}},</p>
<p>We've received your payment. Thank you!</p>
<p><strong>Invoice #:</strong> {{invoiceNumber}}<br/>
<strong>Amount Paid:</strong> {{amount}}<br/>
<strong>Date:</strong> {{paidDate}}</p>
<p style="font-size:13px;">This email serves as your payment receipt. Please save it for your records.</p>`,
  },
  portal_welcome: {
    label: "Client Portal Welcome",
    description: "Sent to the client when their portal account is created",
    variables: ["clientName", "portalUrl", "workspaceName"],
    defaultSubject: "Welcome to your {{workspaceName}} client portal",
    defaultBody: `<h2 style="color:#1B4F9E;margin:0 0 8px;">Your account is ready</h2>
<p>Hi {{clientName}},</p>
<p>Your client portal account has been created. You can now sign in to track your orders, view and pay invoices, and download your delivered files.</p>
<p style="color:#94a3b8;font-size:12px;">If you did not create this account, you can safely ignore this email.</p>`,
  },
} as const;

export type EmailEventType = keyof typeof EMAIL_EVENT_TYPES;

// ─── Router ──────────────────────────────────────────────────────────────────

export const emailTemplatesRouter = router({

  // List all templates for the workspace (returns defaults merged with custom)
  list: workspaceProcedure.query(async ({ ctx }) => {
    const customs = await ctx.prisma.emailTemplate.findMany({
      where: { workspaceId: ctx.workspace.id },
    });
    const customMap = new Map(customs.map((t) => [t.eventType, t]));

    return Object.entries(EMAIL_EVENT_TYPES).map(([eventType, meta]) => {
      const custom = customMap.get(eventType);
      return {
        eventType,
        label: meta.label,
        description: meta.description,
        variables: meta.variables,
        subject: custom?.subject ?? meta.defaultSubject,
        body: custom?.body ?? meta.defaultBody,
        enabled: custom?.enabled ?? true,
        isCustom: !!custom,
        id: custom?.id ?? null,
      };
    });
  }),

  // Get a single template (custom or default)
  get: workspaceProcedure
    .input(z.object({ eventType: z.string() }))
    .query(async ({ ctx, input }) => {
      const meta = EMAIL_EVENT_TYPES[input.eventType as EmailEventType];
      if (!meta) return null;

      const custom = await ctx.prisma.emailTemplate.findUnique({
        where: {
          workspaceId_eventType: {
            workspaceId: ctx.workspace.id,
            eventType: input.eventType,
          },
        },
      });

      return {
        eventType: input.eventType,
        label: meta.label,
        description: meta.description,
        variables: [...meta.variables],
        subject: custom?.subject ?? meta.defaultSubject,
        body: custom?.body ?? meta.defaultBody,
        enabled: custom?.enabled ?? true,
        isCustom: !!custom,
        id: custom?.id ?? null,
      };
    }),

  // Save (upsert) a template
  save: ownerProcedure
    .input(z.object({
      eventType: z.string(),
      subject: z.string().min(1).max(500),
      body: z.string().min(1).max(50000),
      enabled: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.emailTemplate.upsert({
        where: {
          workspaceId_eventType: {
            workspaceId: ctx.workspace.id,
            eventType: input.eventType,
          },
        },
        create: {
          workspaceId: ctx.workspace.id,
          eventType: input.eventType,
          subject: input.subject,
          body: input.body,
          enabled: input.enabled ?? true,
        },
        update: {
          subject: input.subject,
          body: input.body,
          enabled: input.enabled,
        },
      });
    }),

  // Toggle enabled/disabled
  toggle: ownerProcedure
    .input(z.object({ eventType: z.string(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.emailTemplate.upsert({
        where: {
          workspaceId_eventType: {
            workspaceId: ctx.workspace.id,
            eventType: input.eventType,
          },
        },
        create: {
          workspaceId: ctx.workspace.id,
          eventType: input.eventType,
          subject: EMAIL_EVENT_TYPES[input.eventType as EmailEventType]?.defaultSubject ?? "",
          body: EMAIL_EVENT_TYPES[input.eventType as EmailEventType]?.defaultBody ?? "",
          enabled: input.enabled,
        },
        update: { enabled: input.enabled },
      });
    }),

  // Reset to default (delete custom template)
  reset: ownerProcedure
    .input(z.object({ eventType: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.emailTemplate.deleteMany({
        where: {
          workspaceId: ctx.workspace.id,
          eventType: input.eventType,
        },
      });
      return { success: true };
    }),
});
