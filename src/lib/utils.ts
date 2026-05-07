import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "MMM d, yyyy");
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "MMM d, yyyy 'at' h:mm a");
}

export function formatRelative(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function generateJobNumber(prefix: string, next: number): string {
  return `${prefix}-${String(next).padStart(4, "0")}`;
}

export function generateInvoiceNumber(prefix: string, next: number): string {
  return `${prefix}-${String(next).padStart(4, "0")}`;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "…";
}

export const JOB_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  EDITING: "Editing",
  REVIEW: "Under Review",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  ON_HOLD: "On Hold",
};

export const JOB_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
  CONFIRMED: "bg-blue-100 text-blue-800 border-blue-200",
  ASSIGNED: "bg-indigo-100 text-indigo-800 border-indigo-200",
  IN_PROGRESS: "bg-purple-100 text-purple-800 border-purple-200",
  EDITING: "bg-orange-100 text-orange-800 border-orange-200",
  REVIEW: "bg-pink-100 text-pink-800 border-pink-200",
  DELIVERED: "bg-teal-100 text-teal-800 border-teal-200",
  COMPLETED: "bg-green-100 text-green-800 border-green-200",
  CANCELLED: "bg-red-100 text-red-800 border-red-200",
  ON_HOLD: "bg-gray-100 text-gray-800 border-gray-200",
};

export const INVOICE_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  SENT: "bg-blue-100 text-blue-800",
  VIEWED: "bg-indigo-100 text-indigo-800",
  PARTIAL: "bg-yellow-100 text-yellow-800",
  PAID: "bg-green-100 text-green-800",
  OVERDUE: "bg-red-100 text-red-800",
  VOID: "bg-gray-100 text-gray-500",
};
