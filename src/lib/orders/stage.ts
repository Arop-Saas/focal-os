import type { AppointmentStatus, InvoiceStatus, JobStatus, ProductionStatus } from "@prisma/client";

/**
 * Derived order stage — the single "where is this order?" answer shown in
 * lists and headers. NEVER stored: always computed from the underlying
 * status dimensions (order, appointments, production, payment, delivery),
 * per the orders architecture. See docs/orders-architecture.md.
 */

export type OrderStage =
  | "NEEDS_SCHEDULING"
  | "SCHEDULED"
  | "CAPTURE"      // shoot day underway
  | "PRODUCTION"   // files being edited / waiting on files
  | "QA"           // production done pending review
  | "READY"        // deliverables ready, not yet delivered (may be payment-blocked)
  | "DELIVERED"
  | "CLOSED"
  | "ON_HOLD"
  | "CANCELLED";

export const ORDER_STAGE_LABELS: Record<OrderStage, string> = {
  NEEDS_SCHEDULING: "Needs scheduling",
  SCHEDULED: "Scheduled",
  CAPTURE: "Shoot day",
  PRODUCTION: "In production",
  QA: "QA",
  READY: "Ready",
  DELIVERED: "Delivered",
  CLOSED: "Closed",
  ON_HOLD: "On hold",
  CANCELLED: "Cancelled",
};

export const ORDER_STAGE_COLORS: Record<OrderStage, string> = {
  NEEDS_SCHEDULING: "bg-amber-50 text-amber-700 border-amber-200",
  SCHEDULED: "bg-blue-50 text-blue-700 border-blue-200",
  CAPTURE: "bg-violet-50 text-violet-700 border-violet-200",
  PRODUCTION: "bg-indigo-50 text-indigo-700 border-indigo-200",
  QA: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  READY: "bg-teal-50 text-teal-700 border-teal-200",
  DELIVERED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CLOSED: "bg-gray-100 text-gray-600 border-gray-200",
  ON_HOLD: "bg-orange-50 text-orange-700 border-orange-200",
  CANCELLED: "bg-gray-100 text-gray-400 border-gray-200",
};

export interface StageInput {
  jobStatus: JobStatus;
  scheduledAt: Date | null;
  appointments?: { status: AppointmentStatus; scheduledAt: Date | null }[];
  productionTasks?: { status: ProductionStatus }[];
  invoiceStatus?: InvoiceStatus | null;
  deliveredAt?: Date | null;
}

export function computeOrderStage(input: StageInput): OrderStage {
  const { jobStatus } = input;

  // Terminal / explicit states win outright
  if (jobStatus === "CANCELLED") return "CANCELLED";
  if (jobStatus === "ON_HOLD") return "ON_HOLD";
  if (jobStatus === "COMPLETED") return "CLOSED";
  if (jobStatus === "DELIVERED" || input.deliveredAt) return "DELIVERED";

  // Production dimension (most specific available signal)
  const tasks = input.productionTasks ?? [];
  if (tasks.length > 0) {
    const active = tasks.filter((t) => t.status !== "READY");
    if (active.length === 0) return "READY";
    if (active.some((t) => t.status === "QA")) return "QA";
    return "PRODUCTION";
  }

  // Legacy production signal from the job lifecycle
  if (jobStatus === "EDITING") return "PRODUCTION";
  if (jobStatus === "REVIEW") return "QA";

  // Capture dimension
  const appts = input.appointments ?? [];
  const anyLive = appts.some((a) => a.status === "EN_ROUTE" || a.status === "ARRIVED");
  if (anyLive || jobStatus === "IN_PROGRESS") return "CAPTURE";
  const allCaptured = appts.length > 0 && appts.every((a) => a.status === "CAPTURED" || a.status === "CANCELLED");
  if (allCaptured && appts.some((a) => a.status === "CAPTURED")) return "PRODUCTION";

  // Scheduling dimension
  const hasTime = input.scheduledAt != null || appts.some((a) => a.scheduledAt != null && a.status !== "CANCELLED");
  return hasTime ? "SCHEDULED" : "NEEDS_SCHEDULING";
}
