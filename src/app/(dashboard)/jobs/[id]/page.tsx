import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/resolve-workspace";
import { formatCurrency, cn, JOB_STATUS_LABELS } from "@/lib/utils";
import { fmtInTz } from "@/lib/scheduling/tz";
import { computeOrderAttention } from "@/lib/orders/attention";
import type { OrderStage } from "@/lib/orders/stage";
import { geocodeAddress } from "@/lib/geocode";
import {
  Building2, ChevronRight, FileText, Home, KeyRound, Mail, Phone, User,
} from "lucide-react";
import { OrderTabs } from "@/components/orders/order-tabs";
import { OrderNotes, type OrderNoteRow } from "@/components/orders/order-notes";
import { OrderAppointments, type AppointmentRow } from "@/components/orders/order-appointments";
import { ServicesBilling } from "@/components/orders/services-billing";
import { Property3DMap } from "@/components/orders/property-3d-map";
import { RawFilesTab } from "@/components/orders/raw-files-tab";
import { DeliverButton } from "@/components/orders/deliver-button";
import { DIM_BADGE } from "@/components/orders/status-meta";
import { JobStatusUpdater } from "@/components/jobs/job-status-updater";
import { JobDeleteButton } from "@/components/jobs/job-delete-button";
import { JobGalleryCard } from "@/components/jobs/job-gallery-card";
import { ListingManager } from "@/components/gallery/listing-manager";
import { JobAutoInvoiceButton } from "@/components/invoices/job-auto-invoice-button";

export const dynamic = "force-dynamic";

const PROGRESS_STEPS = ["Scheduled", "Captured", "Editing", "Quality Check", "Ready", "Delivered"];

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
  { key: "raw", label: "Raw files" },
  { key: "activity", label: "Activity" },
];

const DATE_FMT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
const FULL_FMT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };

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
      productionTasks: { select: { status: true, dueAt: true } },
      orderLines: { orderBy: { createdAt: "asc" } },
      orderNotes: { orderBy: { createdAt: "desc" }, take: 50, include: { author: { select: { fullName: true } } } },
      gallery: { select: { id: true, slug: true, status: true, mediaCount: true } },
      invoice: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true, amountDue: true, payToken: true } },
      statusHistory: { orderBy: { createdAt: "desc" }, take: 15 },
    },
  });

  if (!job) notFound();

  // Lazy coordinate backfill — admin-created orders have no lat/lng until now
  let lat = job.propertyLat;
  let lng = job.propertyLng;
  if (lat == null || lng == null) {
    const geo = await geocodeAddress(
      `${job.propertyAddress}, ${job.propertyCity}, ${job.propertyState} ${job.propertyZip ?? ""}`
    );
    if (geo) {
      lat = geo.lat;
      lng = geo.lng;
      await prisma.job.update({ where: { id: job.id }, data: { propertyLat: lat, propertyLng: lng } });
    }
  }

  const [workspace, activityLog, clientOrderCount, catalogItems] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { timezone: true } }),
    prisma.activityLog.findMany({
      where: { workspaceId, entityType: "job", entityId: job.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { user: { select: { fullName: true } } },
    }),
    prisma.job.count({ where: { workspaceId, clientId: job.clientId } }),
    prisma.catalogItem.findMany({
      where: { workspaceId, state: "PUBLISHED" },
      select: { id: true, currentVersion: { select: { name: true, basePrice: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const tz = workspace?.timezone ?? "America/New_York";
  const now = new Date();

  // ── Derived state ────────────────────────────────────────────────────────
  const { stage, nextAction, attention } = computeOrderAttention({
    jobStatus: job.status,
    scheduledAt: job.scheduledAt,
    appointments: job.appointments.map((a) => ({ status: a.status, scheduledAt: a.scheduledAt })),
    productionTasks: job.productionTasks,
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
  const activeAppts = job.appointments.filter((a) => a.status !== "CANCELLED");

  // Payment chip for Services & Billing
  const payChip = !job.invoice
    ? { value: "Unbilled", cls: "border-gray-200 bg-gray-50 text-gray-500" }
    : job.invoice.status === "PAID"
    ? { value: "Paid", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" }
    : job.invoice.status === "OVERDUE"
    ? { value: `Overdue · ${formatCurrency(job.invoice.amountDue)}`, cls: "border-red-200 bg-red-50 text-red-700" }
    : job.invoice.status === "DRAFT"
    ? { value: "Draft invoice", cls: "border-gray-200 bg-gray-50 text-gray-500" }
    : { value: `Due · ${formatCurrency(job.invoice.amountDue)}`, cls: "border-amber-200 bg-amber-50 text-amber-700" };

  // ── Serialized rows for client components ────────────────────────────────
  const appointmentRows: AppointmentRow[] = activeAppts.map((a) => ({
    id: a.id,
    title: a.title ?? (a.isPrimary ? "Primary shoot" : "Appointment"),
    isPrimary: a.isPrimary,
    solar: a.timeConstraint === "SOLAR",
    status: a.status,
    scheduledAtISO: a.scheduledAt ? a.scheduledAt.toISOString() : null,
    durationMins: a.durationMins,
    crew: a.assignments.map((x) => x.staff.member.user.fullName).filter(Boolean).join(", "),
    dateKey: a.scheduledAt
      ? new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(a.scheduledAt)
      : null,
  }));

  const noteRows: OrderNoteRow[] = [
    ...job.orderNotes.map((n) => ({
      id: n.id,
      kind: n.kind,
      body: n.body,
      authorName: n.author?.fullName ?? null,
      whenLabel: fmtInTz(n.createdAt, tz, FULL_FMT),
    })),
    // Order-form notes surface here too — same section, clearly attributed
    ...(job.clientNotes
      ? [{ id: "form-client", kind: "CUSTOMER_INSTRUCTIONS", body: job.clientNotes, authorName: "Order form", whenLabel: fmtInTz(job.createdAt, tz, DATE_FMT) }]
      : []),
    ...(job.internalNotes
      ? [{ id: "form-internal", kind: "INTERNAL", body: job.internalNotes, authorName: "Order form", whenLabel: fmtInTz(job.createdAt, tz, DATE_FMT) }]
      : []),
  ];

  const billingLines = job.orderLines.map((l) => ({
    id: l.id,
    name: l.name,
    quantity: l.quantity,
    totalPrice: l.totalPrice,
    explanation: Array.isArray(l.explanation) ? (l.explanation as unknown[]).map(String) : [],
  }));
  const legacyLines = job.package
    ? [{ id: "pkg", name: job.package.name, quantity: 1, totalPrice: job.subtotal }]
    : job.services.map((s) => ({ id: s.id, name: s.service.name, quantity: s.quantity, totalPrice: s.totalPrice }));

  const apptOptions = activeAppts.map((a) => ({
    id: a.id,
    label: `${a.title ?? (a.isPrimary ? "Primary shoot" : "Appointment")}${
      a.scheduledAt ? ` — ${fmtInTz(a.scheduledAt, tz, DATE_FMT)}` : " (unscheduled)"
    }`,
  }));

  const catalogOptions = catalogItems
    .filter((c) => c.currentVersion)
    .map((c) => ({ id: c.id, name: c.currentVersion!.name, basePrice: c.currentVersion!.basePrice }));

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
              {attention.map((reason) => (
                <div key={reason} className="flex items-center gap-2 rounded-lg border border-amber-200/70 bg-white px-3 py-2.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <p className="text-[13px] text-gray-800">{reason}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <OrderAppointments
          jobId={job.id}
          appointments={appointmentRows}
          lat={lat}
          lng={lng}
          primaryStaffProfileId={primaryAssignment?.staff.id}
          primaryAssigneeName={primaryPhotographer?.fullName}
          schedulingData={job.scheduledAt ? {
            propertyAddress: job.propertyAddress,
            propertyCity: job.propertyCity,
            propertyState: job.propertyState,
            propertyZip: job.propertyZip,
            scheduledAt: new Date(job.scheduledAt),
            estimatedDurationMins: job.estimatedDurationMins ?? 90,
          } : undefined}
        />

        <ServicesBilling
          jobId={job.id}
          lines={billingLines}
          legacyLines={legacyLines}
          totals={{
            subtotal: job.subtotal,
            priorityFee: job.priorityFee,
            discount: job.discountAmount,
            tax: job.taxAmount,
            total: job.totalAmount,
          }}
          payChip={payChip}
          invoice={job.invoice ? {
            id: job.invoice.id,
            number: job.invoice.invoiceNumber,
            payToken: job.invoice.payToken,
            amountDue: job.invoice.amountDue,
            status: job.invoice.status,
          } : null}
          catalogItems={catalogOptions}
          appointments={apptOptions}
          invoiceAction={
            <JobAutoInvoiceButton
              jobId={job.id}
              packageName={job.package?.name}
              packagePrice={job.package?.price}
              brokerageGroupName={job.client?.brokerageGroup?.isActive ? job.client.brokerageGroup.name : null}
              brokerageDiscountType={job.client?.brokerageGroup?.isActive ? job.client.brokerageGroup.discountType : null}
              brokerageDiscountValue={job.client?.brokerageGroup?.isActive ? job.client.brokerageGroup.discountValue : null}
            />
          }
        />

        {lat != null && lng != null && (
          <Property3DMap
            lat={lat}
            lng={lng}
            address={`${job.propertyAddress}, ${job.propertyCity}, ${job.propertyState}`}
          />
        )}
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
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4">
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
        </section>

        {/* Notes — team notes and order-form notes together */}
        <OrderNotes jobId={job.id} notes={noteRows} />

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

  const filesPanel = job.gallery ? (
    // The whole listing system lives here — uploads, sections, publish,
    // share link — one seamless surface on the order.
    <ListingManager galleryId={job.gallery.id} />
  ) : (
    <div className="mx-auto max-w-xl">
      <JobGalleryCard jobId={job.id} propertyAddress={job.propertyAddress} gallery={null} />
    </div>
  );

  const rawPanel = <RawFilesTab jobId={job.id} />;

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
      progressStep={STAGE_TO_STEP[stage]}
      progressSteps={PROGRESS_STEPS}
      showProgress={stage !== "ON_HOLD" && stage !== "CANCELLED"}
      tabs={TABS}
      initialTab={searchParams?.tab ?? "overview"}
      panels={{
        overview: overviewPanel,
        files: filesPanel,
        raw: rawPanel,
        activity: activityPanel,
      }}
      headerActions={
        <>
          <JobStatusUpdater jobId={job.id} currentStatus={job.status} />
          <DeliverButton jobId={job.id} delivered={!!job.deliveredAt || job.status === "DELIVERED"} />
          <JobDeleteButton jobId={job.id} jobNumber={job.jobNumber} />
        </>
      }
    />
  );
}
