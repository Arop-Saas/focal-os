import { FeatureRequestCategory } from "@prisma/client";

export const CATEGORY_META: Record<FeatureRequestCategory, { label: string; color: string; dot: string }> = {
  GENERAL:       { label: "General",       color: "bg-slate-500/10 text-slate-400 border-slate-500/20",   dot: "bg-slate-400" },
  DASHBOARD:     { label: "Dashboard",     color: "bg-violet-500/10 text-violet-400 border-violet-500/20", dot: "bg-violet-400" },
  CLIENT_PORTAL: { label: "Client Portal", color: "bg-blue-500/10 text-blue-400 border-blue-500/20",       dot: "bg-blue-400" },
  JOBS:          { label: "Jobs",          color: "bg-amber-500/10 text-amber-400 border-amber-500/20",    dot: "bg-amber-400" },
  INVOICING:     { label: "Invoicing",     color: "bg-green-500/10 text-green-400 border-green-500/20",    dot: "bg-green-400" },
  CALENDAR:      { label: "Calendar",      color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",       dot: "bg-cyan-400" },
  MOBILE_APP:    { label: "Mobile App",    color: "bg-pink-500/10 text-pink-400 border-pink-500/20",       dot: "bg-pink-400" },
  INTEGRATIONS:  { label: "Integrations",  color: "bg-orange-500/10 text-orange-400 border-orange-500/20", dot: "bg-orange-400" },
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_META).map(([value, meta]) => ({
  value: value as FeatureRequestCategory,
  ...meta,
}));
