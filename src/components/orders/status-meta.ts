/**
 * Shared visual metadata for the order command center's status dimensions.
 * Plain module (no "use client") so both the server-rendered page and the
 * client components read the same maps.
 */

export const DIM_BADGE =
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide";

export const APPOINTMENT_STATUS_META: Record<string, { label: string; cls: string }> = {
  SCHEDULED: { label: "Scheduled", cls: "border-blue-200 bg-blue-50 text-blue-700" },
  EN_ROUTE:  { label: "En route",  cls: "border-blue-200 bg-blue-50 text-blue-700" },
  ARRIVED:   { label: "On site",   cls: "border-blue-200 bg-blue-50 text-blue-700" },
  CAPTURED:  { label: "Completed", cls: "border-gray-200 bg-gray-100 text-gray-600" },
  POSTPONED: { label: "Postponed", cls: "border-amber-200 bg-amber-50 text-amber-700" },
  CANCELLED: { label: "Cancelled", cls: "border-gray-200 bg-gray-100 text-gray-400" },
};

export const PRODUCTION_TASK_TYPE_LABELS: Record<string, string> = {
  PHOTO_EDITING: "Photo editing",
  VIDEO_EDITING: "Video editing",
  FLOOR_PLAN: "Floor plan",
  VIRTUAL_TOUR: "Virtual tour",
  QA: "QA",
  OTHER: "Production",
};
