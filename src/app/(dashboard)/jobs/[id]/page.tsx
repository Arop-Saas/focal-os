import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/resolve-workspace";
import { formatCurrency, JOB_STATUS_COLORS, JOB_STATUS_LABELS, cn } from "@/lib/utils";
import { fmtInTz } from "@/lib/scheduling/tz";
import { computeOrderAttention } from "@/lib/orders/attention";
import type { OrderStage } from "@/lib/orders/stage";
import {
  Bath, BedDouble, Building2, Calendar, Camera, ChevronRight, Clock, FileText,
  Home, KeyRound, Mail, Package, Phone, Receipt, Ruler, Sunset, User,
} from "lucide-react";
import { OrderTabs, type OrderDimension } from "@/components/orders/order-tabs";
import { ProductionTaskList, type ProductionTaskRow } from "@/components/orders/production-task-list";
import { OrderNotes, type OrderNoteRow } from "@/components/orders/order-notes";
import { DIM_BADGE, APPOINTMENT_STATUS_META, PRODUCTION_TASK_TYPE_LABELS } from "@/components/orders/status-meta";
import { JobStatusUpdater } from "@/components/jobs/job-status-updater";
import { JobDeleteButton } from "@/components/jobs/job-delete-button";
import { JobGalleryCard } from "@/components/jobs/job-gallery-card";
import { JobAssignmentPicker } from "@/components/jobs/job-assignment-picker";
import { JobMessageThread } from "@/components/messages/job-message-thread";
import { JobChecklist } from "@/components/jobs/job-checklist";
import { JobAutoInvoiceButton } from "@/components/invoices/job-auto-invoice-button";
import { JobScheduleEditor } from "@/components/jobs/job-schedule-editor";
import { JobPropertyMap } from "@/components/jobs/job-property-map";
import { JobWeatherCard } from "@/components/jobs/job-weather-card";

export const dynamic = "force-dynamic";

const PROGRESS_STEPS = ["Scheduled", "Captured", "Editing", "QA", "Ready", "Delivered"];

const STAGE_TO_STEP: Record<OrderStage, number> = {
  NEEDS_SCHEDULING: -1,
  SCHEDULED: 0,
  CAPTURE: 1,
  PRODUCTION: 2,
  QA: 3,
  READY: 4,
  DELIVERED: 5,
  CLOSED: 5,
  ON_HOLD: -1,
  CANCELLED: -1,
};

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "files", label: "Files & Delivery" },
  { key: "production", label: "Production" },
  { key: "billing", label: "Billing" },
  { key: "messages", label: "Messages" },
  { key: "activity", label: "Activity" },
];

const TIME_FMT: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
const DATE_FMT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
const FULL_FMT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };

/** Reasons whose fix lives on another tab get a jump link; the rest are fixed right on Overview. */
function attentionLink(reason: string, jobId: string): { label: string; href: string } | null {
  const r = reason.toLowerCase();
  if (r.includes("invoice") || r.includes("payment")) return { label: "Open billing", href: `/jobs/${jobId}?tab=billing` };
  if (r.includes("qa") || r.includes("production")) return { label: "Open production", href: `/jobs/${jobId}?tab=production` };
  if (r.includes("deliver")) return { label: "Open delivery", href: `/jobs/${jobId}?tab=files` };
  return null;
}

function humanizeAction(action: string): string {
  const label = action.replace(/[._]/g, " ").trim();
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { tab?: string };
}) {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  const workspaceId = await resolveWorkspaceId(supabaseUser!.id);

  const job = await prisma.job.findFirst({
    where: { id: params.id, workspaceId },
    include: {
      client: { include: { brokerageGroup: { select: { name: true, discountType: true, discountValue: true, isActive: true } } } },
      package: { include: { items: { include: { service: true } } } },
      services: { include: { service: true } },
      assignments: {
        include: {
          staff: { include: { member: { include: { user: { select: { fullName: true, email: true } } } } } },
        },
      },
      appointments: {
        orderBy: [{ isPrimary: "desc" }, { scheduledAt: "asc" }],
        include: {
          assignments: {
            include: { staff: { include: { member: { include: { user: { select: { fullName: true } } } } } } },
          },
        },
      },
      productionTasks: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: { assignee: { include: { member: { include: { user: { select: { fullName: true } } } } } } },
      },
      orderLines: { orderBy: { createdAt: "asc" } },
      orderNotes: { orderBy: { createdAt: "desc" }, take: 50, include: { author: { select: { fullName: true } } } },
      gallery: { select: { id: true, slug: true, status: true, mediaCount: true } },
      invoice: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true, amountDue: true } },
      statusHistory: { orderBy: { createdAt: "desc" }, take: 15 },
    },
  });

  if (!job) notFound();

  const [workspace, activityLog, clientOrderCount] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { timezone: true } }),
    prisma.activityLog.findMany({
      where: { workspaceId, entityType: "job", entityId: job.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { user: { select: { fullName: true } } },
    }),
    prisma.job.count({ where: { workspaceId, clientId: job.clientId } }),
  ]);
  const tz = workspace?.timezone ?? "America/New_York";
  const now = new Date();

  // ── Derived state ────────────────────────────────────────────────────────
  const { stage, nextAction, attention } = computeOrderAttention({
    jobStatus: job.status,
    scheduledAt: job.scheduledAt,
    appointments: job.appointments.map((a) => ({ status: a.status, scheduledAt: a.scheduledAt })),
    productionTasks: job.productionTasks.map((t) => ({ status: t.status, dueAt: t.dueAt })),
    invoiceStatus: job.invoice?.status ?? null,
    deliveredAt: job.deliveredAt,
    hasAssignment: job.assignments.length > 0,
    accessNotes: job.accessNotes,
    createdAt: job.createdAt,
    now,
  });

  const primaryAssignment = job.assignments.find((a) => a.isPrimary);
  const primaryPhotographer = primaryAssignment?.staff.member.user;
  const isRush = job.priority === "URGENT";

  // ── Status dimensions ────────────────────────────────────────────────────
  const activeAppts = job.appointments.filter((a) => a.status !== "CANCELLED");
  const capturedCount = activeAppts.filter((a) => a.status === "CAPTURED").length;
  const unscheduledCount = activeAppts.filter((a) => !a.scheduledAt).length;

  let apptDim: OrderDimension;
  if (activeAppts.length === 0) {
    apptDim = { label: "Appointments", value: "None yet", cls: "border-gray-200 bg-gray-50 text-gray-500" };
  } else if (unscheduledCount > 0) {
    apptDim = { label: "Appointments", value: `${unscheduledCount} unscheduled`, cls: "border-amber-200 bg-amber-50 text-amber-700" };
  } else if (capturedCount === activeAppts.length) {
    apptDim = { label: "Appointments", value: activeAppts.length > 1 ? "All captured" : "Captured", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  } else if (capturedCount > 0) {
    apptDim = { label: "Appointments", value: `${capturedCount} of ${activeAppts.length} captured`, cls: "border-violet-200 bg-violet-50 text-violet-700" };
  } else {
    apptDim = { label: "Appointments", value: `${activeAppts.length} scheduled`, cls: "border-blue-200 bg-blue-50 text-blue-700" };
  }

  const tasks = job.productionTasks;
  let prodDim: OrderDimension;
  if (tasks.length === 0) {
    prodDim = { label: "Production", value: "No tasks", cls: "border-gray-200 bg-gray-50 text-gray-500" };
  } else if (tasks.every((t) => t.status === "READY")) {
    prodDim = { label: "Production", value: "Ready", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  } else if (tasks.some((t) => t.status === "QA")) {
    prodDim = { label: "Production", value: "QA", cls: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700" };
  } else if (tasks.some((t) => t.status === "REVISION")) {
    prodDim = { label: "Production", value: "Revision", cls: "border-amber-200 bg-amber-50 text-amber-700" };
  } else if (tasks.some((t) => t.status === "IN_PROGRESS")) {
    prodDim = { label: "Production", value: "Editing", cls: "border-indigo-200 bg-indigo-50 text-indigo-700" };
  } else if (tasks.some((t) => t.status === "QUEUED")) {
    prodDim = { label: "Production", value: "Queued", cls: "border-blue-200 bg-blue-50 text-blue-700" };
  } else {
    prodDim = { label: "Production", value: "Waiting files", cls: "border-gray-200 bg-gray-50 text-gray-500" };
  }

  let payDim: OrderDimension;
  if (!job.invoice) {
    payDim = { label: "Payment", value: "Unbilled", cls: "border-gray-200 bg-gray-50 text-gray-500" };
  } else if (job.invoice.status === "PAID") {
    payDim = { label: "Payment", value: "Paid", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  } else if (job.invoice.status === "OVERDUE") {
    payDim = { label: "Payment", value: `Overdue · ${formatCurrency(job.invoice.amountDue)}`, cls: "border-red-200 bg-red-50 text-red-700" };
  } else if (job.invoice.status === "DRAFT") {
    payDim = { label: "Payment", value: "Draft invoice", cls: "border-gray-200 bg-gray-50 text-gray-500" };
  } else if (job.invoice.status === "VOID" || job.invoice.status === "UNCOLLECTIBLE") {
    payDim = { label: "Payment", value: job.invoice.status === "VOID" ? "Void" : "Uncollectible", cls: "border-gray-200 bg-gray-50 text-gray-500" };
  } else {
    payDim = { label: "Payment", value: `Due · ${formatCurrency(job.invoice.amountDue)}`, cls: "border-amber-200 bg-amber-50 text-amber-700" };
  }

  let deliveryDim: OrderDimension;
  if (job.deliveredAt || job.status === "DELIVERED") {
    deliveryDim = {
      label: "Delivery",
      value: job.deliveredAt ? `Delivered ${fmtInTz(job.deliveredAt, tz, DATE_FMT)}` : "Delivered",
      cls: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  } else if (stage === "READY") {
    deliveryDim = { label: "Delivery", value: "Ready", cls: "border-teal-200 bg-teal-50 text-teal-700" };
  } else if (job.gallery && job.gallery.mediaCount > 0) {
    deliveryDim = { label: "Delivery", value: "In progress", cls: "border-indigo-200 bg-indigo-50 text-indigo-700" };
  } else {
    deliveryDim = { label: "Delivery", value: "Not ready", cls: "border-gray-200 bg-gray-50 text-gray-500" };
  }

  const dimensions: OrderDimension[] = [
    { label: "Order", value: JOB_STATUS_LABELS[job.status] ?? job.status, cls: JOB_STATUS_COLORS[job.status] ?? "border-gray-200 bg-gray-50 text-gray-500" },
    apptDim,
    prodDim,
    payDim,
    deliveryDim,
  ];

  // ── Serialized rows for client components ────────────────────────────────
  const taskRows: ProductionTaskRow[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    typeLabel: PRODUCTION_TASK_TYPE_LABELS[t.type] ?? "Production",
    status: t.status,
    assigneeName: t.assignee?.member.user.fullName ?? null,
    dueLabel: t.dueAt ? fmtInTz(t.dueAt, tz, DATE_FMT) : null,
    overdue: t.status !== "READY" && t.dueAt != null && t.dueAt.getTime() < now.getTime(),
  }));

  const noteRows: OrderNoteRow[] = job.orderNotes.map((n) => ({
    id: n.id,
    kind: n.kind,
    body: n.body,
    authorName: n.author?.fullName ?? null,
    whenLabel: fmtInTz(n.createdAt, tz, FULL_FMT),
  }));

  // ── Merged activity timeline ─────────────────────────────────────────────
  const timeline = [
    ...activityLog.map((a) => ({
      when: a.createdAt,
      text: humanizeAction(a.action),
      who: a.user?.fullName ?? null,
    })),
    ...job.statusHistory.map((h) => ({
      when: h.createdAt,
      text: `Status changed to ${JOB_STATUS_LABELS[h.status] ?? h.status}`,
      who: null as string | null,
    })),
  ].sort((a, b) => b.when.getTime() - a.when.getTime());

  // ── Shared card fragments ────────────────────────────────────────────────

  const appointmentsCard = (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-gray-900">
          <Calendar className="h-4 w-4 text-gray-400" /> Appointments
        </h2>
        {job.scheduledAt && (
          <span className="text-[11px] text-gray-400">Times shown in workspace time</span>
        )}
      </div>

      {activeAppts.length === 0 ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2.5 text-[13px] text-amber-800">
          No appointments yet — pick a date and time below to schedule the shoot.
        </p>
      ) : (
        <div className="space-y-2">
          {activeAppts.map((a) => {
            const meta = APPOINTMENT_STATUS_META[a.status] ?? APPOINTMENT_STATUS_META.SCHEDULED;
            const start = a.scheduledAt;
            const end = start ? new Date(start.getTime() + a.durationMins * 60000) : null;
            const crew = a.assignments
              .map((x) => x.staff.member.user.fullName)
              .filter(Boolean)
              .join(", ");
            const unscheduled = !start;
            return (
              <div
                key={a.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2.5",
                  unscheduled ? "border-amber-200 bg-amber-50/40" : "border-gray-100 bg-gray-50/50"
                )}
              >
                <div className="w-16 shrink-0 text-center">
                  {start ? (
                    <>
                      <p className="text-[10px] font-bold uppercase text-gray-400">{fmtInTz(start, tz, { weekday: "short" })}</p>
                      <p className="text-[15px] font-bold text-gray-800">{fmtInTz(start, tz, DATE_FMT)}</p>
                    </>
                  ) : (
                    <p className="text-[13px] font-bold text-amber-600">TBD</p>
                  )}
                </div>
                <div className={cn("w-px self-stretch", unscheduled ? "bg-amber-200" : "bg-gray-200")} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[13px] font-semibold text-gray-900">
                    {a.title ?? (a.isPrimary ? "Primary shoot" : "Appointment")}
                    {a.timeConstraint === "SOLAR" && (
                      <span className={cn(DIM_BADGE, "border-amber-200 bg-amber-50 text-amber-700")}>
                        <Sunset className="h-2.5 w-2.5" /> Twilight
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-500">
                    {start && end ? (
                      <>
                        <Clock className="h-3 w-3" /> {fmtInTz(start, tz, TIME_FMT)} – {fmtInTz(end, tz, TIME_FMT)}
                      </>
                    ) : (
                      <span className="font-medium text-amber-600">Unscheduled</span>
                    )}
                    {crew ? (
                      <>
                        <Camera className="ml-1 h-3 w-3" /> {crew}
                      </>
                    ) : (
                      <span className="font-medium text-amber-600">Unassigned</span>
                    )}
                  </p>
                </div>
                <span className={cn(DIM_BADGE, meta.cls, "shrink-0")}>{meta.label}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 border-t border-gray-100 pt-4">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">Primary appointment</p>
        <JobScheduleEditor
          jobId={job.id}
          scheduledAt={job.scheduledAt}
          estimatedDurationMins={job.estimatedDurationMins ?? 90}
        />
        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="mb-1.5 text-xs text-gray-400">Photographer</p>
          <JobAssignmentPicker
            jobId={job.id}
            currentStaffProfileId={primaryAssignment?.staff.id}
            currentAssigneeName={primaryPhotographer?.fullName}
            schedulingData={job.scheduledAt ? {
              propertyAddress: job.propertyAddress,
              propertyCity: job.propertyCity,
              propertyState: job.propertyState,
              propertyZip: job.propertyZip,
              scheduledAt: new Date(job.scheduledAt),
              estimatedDurationMins: job.estimatedDurationMins ?? 90,
            } : undefined}
          />
        </div>
      </div>
    </section>
  );

  const lineItems = job.orderLines.length > 0 ? (
    <div className="space-y-1.5 text-[12px]">
      {job.orderLines.map((l) => (
        <div key={l.id} className="flex items-center justify-between text-gray-600">
          <span>
            {l.name}
            {l.quantity > 1 && <span className="text-gray-400"> × {l.quantity}</span>}
          </span>
          <span>{formatCurrency(l.totalPrice)}</span>
        </div>
      ))}
    </div>
  ) : job.package ? (
    <div className="text-[12px] text-gray-600">
      <div className="flex items-center justify-between">
        <span>{job.package.name}</span>
        <span>{formatCurrency(job.subtotal)}</span>
      </div>
      <p className="mt-0.5 text-[11px] text-gray-400">
        Includes: {job.package.items.map((i) => i.service.name).join(", ")}
      </p>
    </div>
  ) : job.services.length > 0 ? (
    <div className="space-y-1.5 text-[12px]">
      {job.services.map((s) => (
        <div key={s.id} className="flex items-center justify-between text-gray-600">
          <span>{s.service.name}{s.quantity > 1 && <span className="text-gray-400"> × {s.quantity}</span>}</span>
          <span>{formatCurrency(s.totalPrice)}</span>
        </div>
      ))}
    </div>
  ) : (
    <p className="text-[12px] italic text-gray-400">No services on this order</p>
  );

  const totalsBlock = (
    <div className="mt-2 space-y-1.5 border-t border-gray-100 pt-2 text-[12px]">
      <div className="flex items-center justify-between text-gray-600">
        <span>Subtotal</span><span>{formatCurrency(job.subtotal)}</span>
      </div>
      {job.priorityFee > 0 && (
        <div className="flex items-center justify-between text-gray-600">
          <span>Priority fee</span><span>{formatCurrency(job.priorityFee)}</span>
        </div>
      )}
      {job.discountAmount > 0 && (
        <div className="flex items-center justify-between text-gray-600">
          <span>Discount</span><span>−{formatCurrency(job.discountAmount)}</span>
        </div>
      )}
      {job.taxAmount > 0 && (
        <div className="flex items-center justify-between text-gray-600">
          <span>Tax</span><span>{formatCurrency(job.taxAmount)}</span>
        </div>
      )}
      <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-[13px] font-semibold text-gray-900">
        <span>Total</span><span>{formatCurrency(job.totalAmount)}</span>
      </div>
    </div>
  );

  const invoiceBlock = job.invoice ? (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-xs text-gray-500">#{job.invoice.invoiceNumber}</span>
        <span className={cn(
          "rounded-full px-2 py-0.5 text-xs font-semibold",
          job.invoice.status === "PAID" ? "bg-green-100 text-green-700" :
          job.invoice.status === "OVERDUE" ? "bg-red-100 text-red-700" :
          "bg-blue-100 text-blue-700"
        )}>
          {job.invoice.status}
        </span>
      </div>
      <p className="mb-1 text-xl font-bold text-gray-900">{formatCurrency(job.invoice.totalAmount)}</p>
      {job.invoice.amountDue > 0 && (
        <p className="mb-3 text-xs text-amber-600">{formatCurrency(job.invoice.amountDue)} outstanding</p>
      )}
      <Link
        href={`/invoices/${job.invoice.id}`}
        className="block rounded-lg border border-blue-200 py-2 text-center text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
      >
        View invoice
      </Link>
    </div>
  ) : (
    <JobAutoInvoiceButton
      jobId={job.id}
      packageName={job.package?.name}
      packagePrice={job.package?.price}
      brokerageGroupName={job.client?.brokerageGroup?.isActive ? job.client.brokerageGroup.name : null}
      brokerageDiscountType={job.client?.brokerageGroup?.isActive ? job.client.brokerageGroup.discountType : null}
      brokerageDiscountValue={job.client?.brokerageGroup?.isActive ? job.client.brokerageGroup.discountValue : null}
    />
  );

  // ── Panels ───────────────────────────────────────────────────────────────

  const overviewPanel = (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {attention.length > 0 && (
          <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-amber-900">Needs attention</h2>
              <span className="text-[11px] font-medium text-amber-700">Next: {nextAction}</span>
            </div>
            <div className="space-y-2">
              {attention.map((reason) => {
                const link = attentionLink(reason, job.id);
                return (
                  <div key={reason} className="flex items-center justify-between gap-3 rounded-lg border border-amber-200/70 bg-white px-3 py-2.5">
                    <p className="flex items-center gap-2 text-[13px] text-gray-800">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                      {reason}
                    </p>
                    {link && (
                      <Link
                        href={link.href}
                        className="shrink-0 rounded-lg bg-gray-900 px-2.5 py-1 text-[12px] font-medium text-white transition-colors hover:bg-gray-800"
                      >
                        {link.label}
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {appointmentsCard}

        {/* Billing sits directly under appointments */}
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold text-gray-900">
              <Receipt className="h-4 w-4 text-gray-400" /> Billing
            </h2>
            <span className={cn(DIM_BADGE, payDim.cls)}>{payDim.value}</span>
          </div>
          {lineItems}
          {totalsBlock}
          <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
            {job.invoice ? (
              <Link href={`/invoices/${job.invoice.id}`} className="text-[12px] font-medium text-blue-600 hover:text-blue-700">
                View invoice #{job.invoice.invoiceNumber}
              </Link>
            ) : (
              <span className="text-[12px] text-gray-400">No invoice yet</span>
            )}
            <Link href={`/jobs/${job.id}?tab=billing`} className="flex items-center gap-1 text-[12px] font-medium text-blue-600 hover:text-blue-700">
              Billing details <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold text-gray-900">
              <Package className="h-4 w-4 text-gray-400" /> Production
            </h2>
            <Link href={`/jobs/${job.id}?tab=production`} className="flex items-center gap-1 text-[12px] font-medium text-blue-600 hover:text-blue-700">
              Open production <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <ProductionTaskList tasks={taskRows} />
        </section>
      </div>

      {/* Right column */}
      <div className="space-y-4">
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-gray-900">Customer</h2>
            <Link href={`/clients/${job.clientId}`} className="text-[12px] font-medium text-blue-600 hover:text-blue-700">
              View client
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
              {job.client.firstName?.[0]}{job.client.lastName?.[0]}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-gray-900">
                {job.client.firstName} {job.client.lastName}
              </p>
              {job.client.company && (
                <p className="flex items-center gap-1 text-[11px] text-gray-400">
                  <Building2 className="h-3 w-3" /> {job.client.company}
                </p>
              )}
            </div>
          </div>
          <div className="mt-3 space-y-1.5 text-[12px] text-gray-500">
            <a href={`mailto:${job.client.email}`} className="flex items-center gap-2 transition-colors hover:text-blue-600">
              <Mail className="h-3 w-3 shrink-0 text-gray-300" />
              <span className="truncate">{job.client.email}</span>
            </a>
            {job.client.phone && (
              <a href={`tel:${job.client.phone}`} className="flex items-center gap-2 transition-colors hover:text-blue-600">
                <Phone className="h-3 w-3 text-gray-300" /> {job.client.phone}
              </a>
            )}
            <p className="flex items-center gap-2">
              <User className="h-3 w-3 text-gray-300" />
              {clientOrderCount === 1 ? "First order" : `${clientOrderCount} orders with you`}
            </p>
          </div>
          {job.clientNotes && (
            <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-[11px] leading-relaxed text-gray-500">
              {job.clientNotes}
            </p>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="p-4 pb-3">
            <h2 className="mb-3 text-[13px] font-semibold text-gray-900">Property</h2>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                [job.bedrooms != null ? String(job.bedrooms) : "—", "Beds"],
                [job.bathrooms != null ? String(job.bathrooms) : "—", "Baths"],
                [job.squareFootage != null ? job.squareFootage.toLocaleString() : "—", "Sq ft"],
              ].map(([v, l]) => (
                <div key={l} className="rounded-lg bg-gray-50 py-2">
                  <p className="text-[14px] font-bold text-gray-800">{v}</p>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">{l}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1.5 text-[12px] text-gray-500">
              <p className="flex items-center gap-2">
                <Home className="h-3 w-3 shrink-0 text-gray-300" /> {job.propertyType.replace(/_/g, " ")}
              </p>
              <p className="flex items-start gap-2">
                <KeyRound className="mt-0.5 h-3 w-3 shrink-0 text-gray-300" />
                {job.accessNotes ? (
                  <span className="leading-snug">{job.accessNotes}</span>
                ) : (
                  <span className="italic text-amber-600">No access info yet</span>
                )}
              </p>
            </div>
          </div>
          <JobPropertyMap
            lat={job.propertyLat}
            lng={job.propertyLng}
            address={`${job.propertyAddress}, ${job.propertyCity}, ${job.propertyState}`}
          />
        </section>

        {job.propertyLat && job.propertyLng && job.scheduledAt && (
          <JobWeatherCard
            lat={job.propertyLat}
            lng={job.propertyLng}
            scheduledDate={new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(job.scheduledAt)}
          />
        )}

        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-[13px] font-semibold text-gray-900">Activity</h2>
          {timeline.length === 0 ? (
            <p className="text-[12px] text-gray-400">No activity recorded yet.</p>
          ) : (
            <div className="space-y-2.5">
              {timeline.slice(0, 5).map((e, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-300" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] text-gray-600">{e.text}{e.who ? ` — ${e.who}` : ""}</p>
                    <p className="text-[10px] text-gray-300">{fmtInTz(e.when, tz, FULL_FMT)}</p>
                  </div>
                </div>
              ))}
              <Link href={`/jobs/${job.id}?tab=activity`} className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700">
                Full timeline <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );

  const filesPanel = (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <JobGalleryCard
          jobId={job.id}
          propertyAddress={job.propertyAddress}
          gallery={job.gallery}
        />
      </div>
      <section className="h-fit rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-[13px] font-semibold text-gray-900">Delivery</h2>
        <div className="space-y-2.5 text-[12px]">
          <div className="flex items-center justify-between text-gray-600">
            <span>Status</span>
            <span className={cn(DIM_BADGE, deliveryDim.cls)}>{deliveryDim.value}</span>
          </div>
          <div className="flex items-center justify-between text-gray-600">
            <span>Media files</span>
            <span className="font-medium text-gray-800">{job.gallery?.mediaCount ?? 0}</span>
          </div>
          <div className="flex items-center justify-between text-gray-600">
            <span>Delivered</span>
            <span className="font-medium text-gray-800">
              {job.deliveredAt ? fmtInTz(job.deliveredAt, tz, FULL_FMT) : "Not yet"}
            </span>
          </div>
          {job.invoice && job.invoice.amountDue > 0 && (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-800">
              {formatCurrency(job.invoice.amountDue)} is still outstanding on this order.
            </p>
          )}
        </div>
      </section>
    </div>
  );

  const productionPanel = (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <section className="rounded-xl border border-gray-200 bg-white p-4 lg:col-span-2">
        <h2 className="mb-3 text-[13px] font-semibold text-gray-900">Production tasks</h2>
        <ProductionTaskList tasks={taskRows} />
      </section>
      <div>
        <JobChecklist jobId={job.id} />
      </div>
    </div>
  );

  const billingPanel = (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <section className="rounded-xl border border-gray-200 bg-white p-4 lg:col-span-2">
        <h2 className="mb-3 text-[13px] font-semibold text-gray-900">Line items</h2>
        {job.orderLines.length > 0 ? (
          <div className="space-y-3">
            {job.orderLines.map((l) => {
              const explanation = Array.isArray(l.explanation) ? (l.explanation as unknown[]).map(String) : [];
              return (
                <div key={l.id} className="border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="font-medium text-gray-800">
                      {l.name}
                      {l.quantity > 1 && <span className="font-normal text-gray-400"> × {l.quantity}</span>}
                    </span>
                    <span className="font-medium text-gray-900">{formatCurrency(l.totalPrice)}</span>
                  </div>
                  {explanation.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {explanation.map((line, i) => (
                        <p key={i} className="text-[11px] text-gray-400">{line}</p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            {lineItems}
            {(job.package || job.services.length > 0) && (
              <p className="mt-3 text-[11px] text-gray-400">
                This order predates itemized pricing — the totals below are authoritative.
              </p>
            )}
          </div>
        )}
        {totalsBlock}
      </section>
      <section className="h-fit rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-gray-900">
          <Receipt className="h-4 w-4 text-gray-400" /> Invoice
        </h2>
        {invoiceBlock}
      </section>
    </div>
  );

  const messagesPanel = (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <JobMessageThread jobId={job.id} />
      <div className="space-y-4">
        <OrderNotes jobId={job.id} notes={noteRows} />
        {job.internalNotes && (
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="mb-2 text-[13px] font-semibold text-gray-900">Order form notes</h2>
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-gray-700">{job.internalNotes}</p>
          </section>
        )}
      </div>
    </div>
  );

  const activityPanel = (
    <div className="mx-auto max-w-3xl">
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-[13px] font-semibold text-gray-900">Timeline</h2>
        {timeline.length === 0 ? (
          <p className="text-[13px] text-gray-400">No activity recorded for this order yet.</p>
        ) : (
          <div className="space-y-4">
            {timeline.map((e, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="mt-1 flex flex-col items-center self-stretch">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-gray-300" />
                  {i < timeline.length - 1 && <span className="mt-1 w-px flex-1 bg-gray-100" />}
                </div>
                <div className="min-w-0 flex-1 pb-1">
                  <p className="text-[13px] text-gray-700">{e.text}{e.who ? ` — ${e.who}` : ""}</p>
                  <p className="text-[11px] text-gray-400">{fmtInTz(e.when, tz, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );

  // ── Shell ────────────────────────────────────────────────────────────────
  const metaLine = [
    `${job.propertyCity}, ${job.propertyState}${job.propertyZip ? ` ${job.propertyZip}` : ""}`,
    `Order #${job.jobNumber}`,
    `${job.client.firstName} ${job.client.lastName}${job.client.company ? `, ${job.client.company}` : ""}`,
  ].join(" · ");

  return (
    <OrderTabs
      address={job.propertyAddress}
      metaLine={metaLine}
      isRush={isRush}
      dimensions={dimensions}
      progressStep={STAGE_TO_STEP[stage]}
      progressSteps={PROGRESS_STEPS}
      showProgress={stage !== "ON_HOLD" && stage !== "CANCELLED"}
      tabs={TABS}
      initialTab={searchParams?.tab ?? "overview"}
      panels={{
        overview: overviewPanel,
        files: filesPanel,
        production: productionPanel,
        billing: billingPanel,
        messages: messagesPanel,
        activity: activityPanel,
      }}
      headerActions={
        <>
          <JobStatusUpdater jobId={job.id} currentStatus={job.status} />
          <JobDeleteButton jobId={job.id} jobNumber={job.jobNumber} />
        </>
      }
    />
  );
}
