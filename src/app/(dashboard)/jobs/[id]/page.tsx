import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { format } from "date-fns";
import { formatCurrency, JOB_STATUS_COLORS, JOB_STATUS_LABELS, cn } from "@/lib/utils";
import {
  MapPin, Calendar, Package, User, Clock, FileText,
  ArrowLeft, Receipt, Phone, Mail, Building2,
} from "lucide-react";
import { JobStatusUpdater } from "@/components/jobs/job-status-updater";
import { JobGalleryCard } from "@/components/jobs/job-gallery-card";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser!.id },
    include: { workspaces: { include: { workspace: true }, take: 1 } },
  });
  const workspaceId = user!.workspaces[0].workspace.id;

  const job = await prisma.job.findFirst({
    where: { id: params.id, workspaceId },
    include: {
      client: true,
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

  const primaryPhotographer = job.assignments.find((a) => a.isPrimary)?.staff.member.user;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title={job.propertyAddress}
        description={`Job #${job.jobNumber}`}
        actions={
          <Link
            href="/jobs"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to jobs
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl space-y-5">

          {/* Status bar */}
          <div className="bg-white rounded-xl border p-5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <span className={cn(
                "text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-full border",
                JOB_STATUS_COLORS[job.status]
              )}>
                {JOB_STATUS_LABELS[job.status] ?? job.status}
              </span>
              {job.isRush && (
                <span className="text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                  RUSH
                </span>
              )}
              <span className="text-sm text-gray-500">Priority: <strong className="text-gray-700">{job.priority}</strong></span>
            </div>
            <JobStatusUpdater jobId={job.id} currentStatus={job.status} />
          </div>

          <div className="grid grid-cols-3 gap-5">
            {/* Left column */}
            <div className="col-span-2 space-y-5">

              {/* Property */}
              <div className="bg-white rounded-xl border p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400" /> Property
                </h2>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Address</p>
                    <p className="font-medium text-gray-900">{job.propertyAddress}</p>
                    <p className="text-gray-600">{job.propertyCity}, {job.propertyState} {job.propertyZip ?? ""}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Type</p>
                    <p className="text-gray-700">{job.propertyType.replace(/_/g, " ")}</p>
                  </div>
                  {(job.bedrooms || job.bathrooms || job.squareFootage) && (
                    <div className="col-span-2 flex gap-5 pt-1 border-t mt-1">
                      {job.squareFootage && <span className="text-gray-600">{job.squareFootage.toLocaleString()} sq ft</span>}
                      {job.bedrooms && <span className="text-gray-600">{job.bedrooms} bed</span>}
                      {job.bathrooms && <span className="text-gray-600">{job.bathrooms} bath</span>}
                      {job.mlsNumber && <span className="text-gray-500">MLS #{job.mlsNumber}</span>}
                    </div>
                  )}
                  {job.accessNotes && (
                    <div className="col-span-2 bg-amber-50 border border-amber-100 rounded-lg p-3 mt-1">
                      <p className="text-xs font-semibold text-amber-700 mb-0.5">Access Notes</p>
                      <p className="text-sm text-amber-800">{job.accessNotes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Schedule */}
              <div className="bg-white rounded-xl border p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" /> Schedule
                </h2>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Scheduled</p>
                    <p className="font-medium text-gray-900">
                      {job.scheduledAt
                        ? format(new Date(job.scheduledAt), "EEEE, MMM d, yyyy")
                        : <span className="text-gray-400 italic">Not scheduled</span>}
                    </p>
                    {job.scheduledAt && (
                      <p className="text-gray-600">{format(new Date(job.scheduledAt), "h:mm a")}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Duration</p>
                    <p className="text-gray-700">{job.estimatedDurationMins} min estimated</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Photographer</p>
                    {primaryPhotographer
                      ? <p className="font-medium text-gray-900">{primaryPhotographer.fullName}</p>
                      : <p className="text-gray-400 italic text-xs">Unassigned</p>}
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Created</p>
                    <p className="text-gray-600">{format(new Date(job.createdAt), "MMM d, yyyy")}</p>
                  </div>
                </div>
              </div>

              {/* Package / Services */}
              <div className="bg-white rounded-xl border p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Package className="w-4 h-4 text-gray-400" /> Package & Services
                </h2>
                {job.package ? (
                  <div>
                    <p className="font-medium text-gray-900 mb-1">{job.package.name}</p>
                    <p className="text-sm text-gray-500 mb-3">
                      Includes: {job.package.items.map((i) => i.service.name).join(", ")}
                    </p>
                  </div>
                ) : job.services.length > 0 ? (
                  <div className="space-y-2">
                    {job.services.map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{s.service.name} × {s.quantity}</span>
                        <span className="text-gray-900 font-medium">{formatCurrency(s.totalPrice)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No package or services added</p>
                )}

                <div className="border-t mt-4 pt-4 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-400">Subtotal</p>
                    <p className="font-medium">{formatCurrency(job.subtotal)}</p>
                  </div>
                  {job.taxAmount > 0 && (
                    <div>
                      <p className="text-xs text-gray-400">Tax</p>
                      <p className="font-medium">{formatCurrency(job.taxAmount)}</p>
                    </div>
                  )}
                  {job.rushFee > 0 && (
                    <div>
                      <p className="text-xs text-gray-400">Rush Fee</p>
                      <p className="font-medium text-red-600">{formatCurrency(job.rushFee)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-400">Total</p>
                    <p className="text-base font-bold text-gray-900">{formatCurrency(job.totalAmount)}</p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {(job.internalNotes || job.clientNotes) && (
                <div className="bg-white rounded-xl border p-5">
                  <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" /> Notes
                  </h2>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {job.internalNotes && (
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Internal</p>
                        <p className="text-gray-700 whitespace-pre-wrap">{job.internalNotes}</p>
                      </div>
                    )}
                    {job.clientNotes && (
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Client-facing</p>
                        <p className="text-gray-700 whitespace-pre-wrap">{job.clientNotes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right column */}
            <div className="space-y-5">

              {/* Client */}
              <div className="bg-white rounded-xl border p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" /> Client
                </h2>
                <Link href={`/clients/${job.clientId}`} className="group block">
                  <p className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {job.client.firstName} {job.client.lastName}
                  </p>
                  {job.client.company && (
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3 h-3" /> {job.client.company}
                    </p>
                  )}
                </Link>
                <div className="mt-3 space-y-1.5 text-xs text-gray-600">
                  <a href={`mailto:${job.client.email}`} className="flex items-center gap-2 hover:text-blue-600">
                    <Mail className="w-3.5 h-3.5 text-gray-400" /> {job.client.email}
                  </a>
                  {job.client.phone && (
                    <a href={`tel:${job.client.phone}`} className="flex items-center gap-2 hover:text-blue-600">
                      <Phone className="w-3.5 h-3.5 text-gray-400" /> {job.client.phone}
                    </a>
                  )}
                </div>
              </div>

              {/* Invoice */}
              <div className="bg-white rounded-xl border p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-gray-400" /> Invoice
                </h2>
                {job.invoice ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-mono text-gray-600">#{job.invoice.invoiceNumber}</span>
                      <span className={cn(
                        "text-xs font-semibold px-2 py-0.5 rounded-full",
                        job.invoice.status === "PAID" ? "bg-green-100 text-green-700" :
                        job.invoice.status === "OVERDUE" ? "bg-red-100 text-red-700" :
                        "bg-blue-100 text-blue-700"
                      )}>
                        {job.invoice.status}
                      </span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(job.invoice.totalAmount)}</p>
                    {job.invoice.amountDue > 0 && (
                      <p className="text-xs text-amber-600 mt-1">{formatCurrency(job.invoice.amountDue)} due</p>
                    )}
                    <Link
                      href={`/invoices/${job.invoice.id}`}
                      className="mt-3 block text-center text-xs font-semibold text-blue-600 hover:text-blue-700 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors"
                    >
                      View Invoice
                    </Link>
                  </div>
                ) : (
                  <div className="text-center py-3">
                    <p className="text-xs text-gray-400 mb-3">No invoice yet</p>
                    <Link
                      href={`/invoices/new?jobId=${job.id}`}
                      className="block text-center text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 py-1.5 rounded-lg transition-colors"
                    >
                      Create Invoice
                    </Link>
                  </div>
                )}
              </div>

              {/* Gallery */}
              <JobGalleryCard
                jobId={job.id}
                propertyAddress={job.propertyAddress}
                gallery={job.gallery}
              />

              {/* Status history */}
              {job.statusHistory.length > 0 && (
                <div className="bg-white rounded-xl border p-5">
                  <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" /> History
                  </h2>
                  <div className="space-y-2.5">
                    {job.statusHistory.map((h) => (
                      <div key={h.id} className="flex items-start gap-2 text-xs">
                        <span className={cn(
                          "mt-0.5 px-1.5 py-0.5 rounded font-semibold shrink-0",
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
