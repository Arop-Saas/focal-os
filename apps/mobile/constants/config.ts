// ─── API Configuration ────────────────────────────────────────────────────────
// Update these to match your production/staging URLs

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://scalist.io";
export const TRPC_URL = `${API_URL}/api/trpc`;

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

// ─── Theme ────────────────────────────────────────────────────────────────────

export const COLORS = {
  primary: "#1B4F9E",
  primaryLight: "#E8EEF7",
  success: "#16a34a",
  successLight: "#dcfce7",
  warning: "#ea580c",
  warningLight: "#fff7ed",
  danger: "#dc2626",
  dangerLight: "#fef2f2",
  gray50: "#f9fafb",
  gray100: "#f3f4f6",
  gray200: "#e5e7eb",
  gray300: "#d1d5db",
  gray400: "#9ca3af",
  gray500: "#6b7280",
  gray600: "#4b5563",
  gray700: "#374151",
  gray800: "#1f2937",
  gray900: "#111827",
  white: "#ffffff",
} as const;

export const FONTS = {
  regular: "System",
  medium: "System",
  semibold: "System",
  bold: "System",
} as const;

// ─── Job Status Labels & Colors ───────────────────────────────────────────────

export const JOB_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: "Pending", color: "#ea580c", bg: "#fff7ed" },
  CONFIRMED: { label: "Confirmed", color: "#1B4F9E", bg: "#E8EEF7" },
  IN_PROGRESS: { label: "In Progress", color: "#16a34a", bg: "#dcfce7" },
  COMPLETED: { label: "Completed", color: "#6b7280", bg: "#f3f4f6" },
  CANCELLED: { label: "Cancelled", color: "#dc2626", bg: "#fef2f2" },
  EDITING: { label: "Editing", color: "#7c3aed", bg: "#f5f3ff" },
  DELIVERED: { label: "Delivered", color: "#0891b2", bg: "#ecfeff" },
};
