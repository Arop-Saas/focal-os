import type { AppointmentStatus, InvoiceStatus, JobStatus } from "@prisma/client";
import { utcToWallDateISO, wallTimeToUtc } from "@/lib/scheduling/tz";

/**
 * Derived order stage — the single "where is this order?" answer shown in
 * lists and the order progress bar. NEVER stored: always computed from real
 * signals, so the bar moves automatically:
 *
 *   Scheduled      — an appointment has a time
 *   Captured       — the last appointment's end time has passed
 *   Editing        — raw files uploaded, OR 2h after the last appointment
 *                    ends (capped at 10 PM local on the shoot day)
 *   Quality Check  — anything uploaded to Files & Delivery
 *   Delivered      — delivered (deliveredAt / DELIVERED status)
 *
 * Only terminal/administrative statuses (cancelled, on hold, completed)
 * still come from the legacy Job.status. See docs/orders-architecture.md.
 */

export type OrderStage =
  | "NEEDS_SCHEDULING"
  | "SCHEDULED"
  | "CAPTURE"      // shoot done — awaiting files
  | "PRODUCTION"   // editing
  | "QA"           // deliverables uploaded, pending review
  | "DELIVERED"
  | "CLOSED"
  | "ON_HOLD"
  | "CANCELLED";

export const ORDER_STAGE_LABELS: Record<OrderStage, string> = {
  NEEDS_SCHEDULING: "Needs scheduling",
  SCHEDULED: "Scheduled",
  CAPTURE: "Captured",
  PRODUCTION: "Editing",
  QA: "Quality Check",
  DELIVERED: "Delivered",
  CLOSED: "Closed",
  ON_HOLD: "On hold",
  CANCELLED: "Cancelled",
};

export const ORDER_STAGE_COLORS: Record<OrderStage, string> = {
  NEEDS_SCHEDULING: "bg-amber-50 text-amber-700 border-amber-200",
  SCHEDULED: "bg-blue-50 text-blue-700 border-blue-200",
  CAPTURE: "bg-gray-100 text-gray-600 border-gray-200",
  PRODUCTION: "bg-gray-100 text-gray-600 border-gray-200",
  QA: "bg-blue-50 text-blue-700 border-blue-200",
  DELIVERED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CLOSED: "bg-gray-100 text-gray-600 border-gray-200",
  ON_HOLD: "bg-amber-50 text-amber-700 border-amber-200",
  CANCELLED: "bg-gray-100 text-gray-400 border-gray-200",
};

export interface StageInput {
  jobStatus: JobStatus;
  scheduledAt: Date | null;
  appointments?: {
    status: AppointmentStatus;
    scheduledAt: Date | string | null;
    durationMins?: number | null;
  }[];
  /** raw capture files uploaded against the order */
  rawFileCount?: number;
  /** media uploaded to the listing (Files & Delivery) */
  galleryMediaCount?: number;
  invoiceStatus?: InvoiceStatus | null;
  deliveredAt?: Date | string | null;
  /** workspace IANA timezone — used for the 10 PM local editing cutoff */
  timeZone?: string;
  now?: Date;
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export function computeOrderStage(input: StageInput): OrderStage {
  const { jobStatus } = input;
  const now = input.now ?? new Date();

  // Terminal / administrative states win outright
  if (jobStatus === "CANCELLED") return "CANCELLED";
  if (jobStatus === "ON_HOLD") return "ON_HOLD";
  if (jobStatus === "COMPLETED") return "CLOSED";
  if (jobStatus === "DELIVERED" || input.deliveredAt) return "DELIVERED";

  // Quality Check — deliverables exist on the listing
  if ((input.galleryMediaCount ?? 0) > 0) return "QA";

  // Appointment end times (active appointments only)
  const appts = (input.appointments ?? []).filter((a) => a.status !== "CANCELLED");
  const ends = appts
    .filter((a) => a.scheduledAt != null)
    .map((a) => new Date(a.scheduledAt as Date | string).getTime() + (a.durationMins ?? 90) * 60000);
  const lastEnd = ends.length > 0 ? Math.max(...ends) : null;
  const anyEndPassed = ends.some((e) => e <= now.getTime());

  // Editing — raw files arrived, or the shoot has clearly wrapped:
  // 2h after the last appointment ends, capped at 10 PM local on the shoot
  // day (but never before the appointment actually ends).
  if ((input.rawFileCount ?? 0) > 0) return "PRODUCTION";
  if (lastEnd != null) {
    let editingAtMs = lastEnd + TWO_HOURS_MS;
    if (input.timeZone) {
      try {
        const dayISO = utcToWallDateISO(new Date(lastEnd), input.timeZone);
        const tenPm = wallTimeToUtc(dayISO, "22:00", input.timeZone).getTime();
        editingAtMs = Math.max(lastEnd, Math.min(editingAtMs, tenPm));
      } catch {
        // bad tz — keep the 2h rule
      }
    }
    if (now.getTime() >= editingAtMs) return "PRODUCTION";
  }

  // Captured — an appointment's end time has passed
  if (anyEndPassed) return "CAPTURE";

  // Scheduling dimension
  const hasTime = input.scheduledAt != null || appts.some((a) => a.scheduledAt != null);
  return hasTime ? "SCHEDULED" : "NEEDS_SCHEDULING";
}
