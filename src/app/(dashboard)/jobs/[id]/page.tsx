import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/resolve-workspace";
import { format } from "date-fns";
import { formatCurrency, JOB_STATUS_COLORS, JOB_STATUS_LABELS, cn } from "@/lib/utils";
import {
  MapPin, Calendar, Package, User, Clock, FileText,
  ArrowLeft, Receipt, Phone, Mail, Building2, Zap, Home,
  BedDouble, Bath, Ruler, Hash,
} from "lucide-react";
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

export default async function JobDetailPage({ params }: { params: { id: string } }) {
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
      gallery: { select: { id: true, slug: true, status: true, mediaCount: true } },
      invoice: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true, amountDue: true } },
      statusHistory: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  if (!job) notFound();

  const primaryAssignment = job.assignments.find((a) => a.isPrimary);
  const primaryPhotographer = primaryAssignment?.staff.member.user;
  const primaryStaffProfileId = primaryAssignment?.staff.id;

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-gray-50">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/jobs"
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              Jobs
            </Link>
            <span className="text-gray-300">/</span>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-gray-900 truncate">{job.propertyAddress}</h1>
              <p className="text-xs text-gray-400">Job #{job.jobNumber}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {job.isRush && (
              <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700 border border-red-200">
                <Zap className="w-3 h-3 fill-red-500" /> RUSH
              </span>
            )}
            <span className={cn(
              "text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-full border",
              JOB_STATUS_COLORS[job.status]
            )}>
              {JOB_STATUS_LABELS[job.status] ?? job.status}
            </span>
            <JobDeleteButton jobId={job.id} jobNumber={job.jobNumber} />
            <JobStatusUpdater jobId={job.id} currentStatus={job.status} />
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6">

          {/* Hero stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-400 mb-0.5">Scheduled</p>
              <p className="text-sm font-semibold text-gray-900">
                {job.scheduledAt ? format(new Date(job.scheduledAt), "MMM d, yyyy") : <span className="text-gray-400 font-normal">Not set</span>}
              </p>
              {job.scheduledAt && (
                <p className="text-xs text-gray-500">{format(new Date(job.scheduledAt), "h:mm a")}</p>
              )}
            </div>
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-400 mb-0.5">Photographer</p>
              <p className="text-sm font-semibold text-gray-900 truncate">
                {primaryPhotographer?.fullName ?? <span className="text-gray-400 font-normal">Unassigned</span>}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-400 mb-0.5">Total</p>
              <p className="text-sm font-bold text-gray-900">{formatCurrency(job.totalAmount)}</p>
              {job.invoice?.amountDue != null && job.invoice.amountDue > 0 && (
                <p className="text-xs text-amber-600">{formatCurrency(job.invoice.amountDue)} due</p>
              )}
            </div>
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-400 mb-0.5">Priority</p>
              <p className="text-sm font-semibold text-gray-900">{job.priority}</p>
              <p className="text-xs text-gray-400">Created {format(new Date(job.createdAt), "MMM d")}</p>
            </div>
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-3 gap-5">

            {/* ── Left / main column ───────────────────────────────────────── */}
            <div className="col-span-2 space-y-5">

              {/* Property */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 pt-5 pb-4">
                  <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Home className="w-4 h-4 text-gray-400" /> Property
                  </h2>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Address</p>
                      <p className="font-medium text-gray-900 leading-snug">{job.propertyAddress}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{job.propertyCity}, {job.propertyState} {job.propertyZip ?? ""}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Type</p>
                      <p className="text-gray-700">{job.propertyType.replace(/_/g, " ")}</p>
                    </div>
                  </div>

                  {(job.bedrooms || job.bathrooms || job.squareFootage || job.mlsNumber) && (
                    <div className="flex flex-wrap gap-4 py-3 border-t border-gray-100 text-sm text-gray-600">
                      {job.squareFootage && (
                        <span className="flex items-center gap-1.5"><Ruler className="w-3.5 h-3.5 text-gray-400" />{job.squareFootage.toLocaleString()} sq ft</span>
                      )}
                      {job.bedrooms && (
                        <span className="flex items-center gap-1.5"><BedDouble className="w-3.5 h-3.5 text-gray-400" />{job.bedrooms} bed</span>
                      )}
                      {job.bathrooms && (
                        <span className="flex items-center gap-1.5"><Bath className="w-3.5 h-3.5 text-gray-400" />{job.bathrooms} bath</span>
                      )}
                      {job.mlsNumber && (
                        <span className="flex items-center gap-1.5"><Hash className="w-3.5 h-3.5 text-gray-400" />MLS {job.mlsNumber}</span>
                      )}
                    </div>
                  )}

                  {job.accessNotes && (
                    <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mt-3">
                      <p className="text-xs font-semibold text-amber-700 mb-0.5">Access Notes</p>
                      <p className="text-sm text-amber-800">{job.accessNotes}</p>
                    </div>
                  )}
                </div>

                <JobPropertyMap
                  lat={job.propertyLat}
                  lng={job.propertyLng}
                  address={`${job.propertyAddress}, ${job.propertyCity}, ${job.propertyState}`}
                />
              </div>

              {/* Weather */}
              {job.propertyLat && job.propertyLng && job.scheduledAt && (
                <JobWeatherCard
                  lat={job.propertyLat}
                  lng={job.propertyLng}
                  scheduledDate={format(new Date(job.scheduledAt), "yyyy-MM-dd")}
                />
              )}

              {/* Schedule */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" /> Schedule
                </h2>
                <JobScheduleEditor
                  jobId={job.id}
                  scheduledAt={job.scheduledAt}
                  estimatedDurationMins={job.estimatedDurationMins ?? 90}
                />
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-1.5">Photographer</p>
                  <JobAssignmentPicker
                    jobId={job.id}
                    currentStaffProfileId={primaryStaffProfileId}
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

              {/* Package / Services */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Package className="w-4 h-4 text-gray-400" /> Package & Services
                </h2>
                {job.package ? (
                  <div className="mb-3">
                    <p className="font-semibold text-gray-900">{job.package.name}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Includes: {job.package.items.map((i) => i.service.name).join(", ")}
                    </p>
                  </div>
                ) : job.services.length > 0 ? (
                  <div className="space-y-2 mb-3">
                    {job.services.map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                        <span className="text-gray-700">{s.service.name} × {s.quantity}</span>
                        <span className="text-gray-900 font-medium">{formatCurrency(s.totalPrice)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic mb-3">No package or services added</p>
                )}

                <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-3 gap-3 text-sm mt-2">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Subtotal</p>
                    <p className="font-medium text-gray-900">{formatCurrency(job.subtotal)}</p>
                  </div>
                  {job.taxAmount > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Tax</p>
                      <p className="font-medium text-gray-900">{formatCurrency(job.taxAmount)}</p>
                    </div>
                  )}
                  {job.rushFee > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Rush Fee</p>
                      <p className="font-medium text-red-600">{formatCurrency(job.rushFee)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Total</p>
                    <p className="text-base font-bold text-gray-900">{formatCurrency(job.totalAmount)}</p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {(job.internalNotes || job.clientNotes) && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" /> Notes
                  </h2>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {job.internalNotes && (
                      <div>
                        <p className="text-xs text-gray-400 mb-1.5">Internal</p>
                        <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{job.internalNotes}</p>
                      </div>
                    )}
                    {job.clientNotes && (
                      <div>
                        <p className="text-xs text-gray-400 mb-1.5">Client-facing</p>
                        <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{job.clientNotes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Right sidebar ─────────────────────────────────────────────── */}
            <div className="space-y-5">

              {/* Client */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" /> Client
                </h2>
                <Link href={`/clients/${job.clientId}`} className="group block mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                      {job.client.firstName?.[0]}{job.client.lastName?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors leading-tight">
                        {job.client.firstName} {job.client.lastName}
                      </p>
                      {job.client.company && (
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3" /> {job.client.company}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
                <div className="space-y-2 text-xs text-gray-600 border-t border-gray-100 pt-3">
                  <a href={`mailto:${job.client.email}`} className="flex items-center gap-2 hover:text-blue-600 transition-colors">
                    <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{job.client.email}</span>
                  </a>
                  {job.client.phone && (
                    <a href={`tel:${job.client.phone}`} className="flex items-center gap-2 hover:text-blue-600 transition-colors">
                      <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" /> {job.client.phone}
                    </a>
                  )}
                </div>
              </div>

              {/* Invoice */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-gray-400" /> Invoice
                </h2>
                {job.invoice ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono text-gray-500">#{job.invoice.invoiceNumber}</span>
                      <span className={cn(
                        "text-xs font-semibold px-2 py-0.5 rounded-full",
                        job.invoice.status === "PAID"    ? "bg-green-100 text-green-700" :
                        job.invoice.status === "OVERDUE" ? "bg-red-100 text-red-700"    :
                        "bg-blue-100 text-blue-700"
                      )}>
                        {job.invoice.status}
                      </span>
                    </div>
                    <p className="text-xl font-bold text-gray-900 mb-1">{formatCurrency(job.invoice.totalAmount)}</p>
                    {job.invoice.amountDue > 0 && (
                      <p className="text-xs text-amber-600 mb-3">{formatCurrency(job.invoice.amountDue)} outstanding</p>
                    )}
                    <Link
                      href={`/invoices/${job.invoice.id}`}
                      className="block text-center text-xs font-semibold text-blue-600 hover:text-blue-700 py-2 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors"
                    >
                      View Invoice →
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
                )}
              </div>

              {/* Gallery */}
              <JobGalleryCard
                jobId={job.id}
                propertyAddress={job.propertyAddress}
                gallery={job.gallery}
              />

              {/* Checklist */}
              <JobChecklist jobId={job.id} />

              {/* Messages */}
              <JobMessageThread jobId={job.id} />

              {/* Status history */}
              {job.statusHistory.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" /> History
                  </h2>
                  <div className="space-y-2.5">
                    {job.statusHistory.map((h) => (
                      <div key={h.id} className="flex items-center gap-2 text-xs">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded font-semibold shrink-0",
                          JOB_STATUS_COLORS[h.status] ?? "bg-gray-100 text-gray-600"
                        )}>
                          {JOB_STATUS_LABELS[h.status] ?? h.status}
                        </span>
                        <span className="text-gray-400">{format(new Date(h.createdAt), "MMM d, h:mm a")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
