import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import Link from "next/link";
import { formatDistanceToNow, isToday, isYesterday, format } from "date-fns";
import {
  Briefcase,
  Users,
  Receipt,
  CheckCircle,
  Send,
  Ban,
  CreditCard,
  Edit3,
  Bell,
  ArrowUpRight,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { MarkReadOnMount } from "@/components/notifications/mark-read-on-mount";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications" };

// ─── Action config: icon, colour, human label ─────────────────────────────────

type ActionMeta = {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  label: (meta: Record<string, unknown>) => string;
  href?: (entityId: string, meta: Record<string, unknown>) => string | null;
};

const ACTION_MAP: Record<string, ActionMeta> = {
  "job.created": {
    icon: Briefcase,
    color: "bg-blue-100 text-blue-600",
    label: (m) =>
      `New job created · ${m.propertyAddress ?? ""}${m.jobNumber ? ` (#${m.jobNumber})` : ""}`,
    href: (id) => `/jobs/${id}`,
  },
  "job.updated": {
    icon: Edit3,
    color: "bg-indigo-100 text-indigo-600",
    label: (m) => {
      const changes = Array.isArray(m.changes) ? (m.changes as string[]) : [];
      if (changes.includes("status")) return `Job status updated`;
      if (changes.length > 0)
        return `Job updated · ${changes.slice(0, 3).join(", ")}`;
      return "Job updated";
    },
    href: (id) => `/jobs/${id}`,
  },
  "client.created": {
    icon: Users,
    color: "bg-purple-100 text-purple-600",
    label: (m) => `New client added · ${m.email ?? ""}`,
    href: (id) => `/clients/${id}`,
  },
  "invoice.created": {
    icon: Receipt,
    color: "bg-yellow-100 text-yellow-600",
    label: (m) =>
      `Invoice created · ${m.invoiceNumber ?? ""}${
        m.totalAmount != null
          ? ` · ${formatCurrency(m.totalAmount as number)}`
          : ""
      }`,
    href: (id) => `/invoices/${id}`,
  },
  "invoice.sent": {
    icon: Send,
    color: "bg-blue-100 text-blue-600",
    label: (m) =>
      `Invoice sent to ${m.clientName ?? "client"} · ${m.invoiceNumber ?? ""}`,
    href: (id) => `/invoices/${id}`,
  },
  "invoice.paid": {
    icon: CheckCircle,
    color: "bg-green-100 text-green-600",
    label: (m) =>
      `Invoice paid · ${m.invoiceNumber ?? ""}${
        m.amount != null
          ? ` · ${formatCurrency(m.amount as number)}`
          : ""
      }`,
    href: (id) => `/invoices/${id}`,
  },
  "invoice.partial": {
    icon: CreditCard,
    color: "bg-teal-100 text-teal-600",
    label: (m) =>
      `Partial payment · ${m.invoiceNumber ?? ""}${
        m.amount != null
          ? ` · ${formatCurrency(m.amount as number)} received`
          : ""
      }`,
    href: (id) => `/invoices/${id}`,
  },
  "invoice.voided": {
    icon: Ban,
    color: "bg-red-100 text-red-500",
    label: (m) => `Invoice voided · ${m.invoiceNumber ?? ""}`,
    href: (id) => `/invoices/${id}`,
  },
  "invoice.overdue": {
    icon: AlertTriangle,
    color: "bg-red-100 text-red-600",
    label: (m) =>
      `Invoice overdue · ${m.invoiceNumber ?? ""}${
        m.amountDue != null
          ? ` · ${formatCurrency(m.amountDue as number)} past due`
          : ""
      }`,
    href: (id) => `/invoices/${id}`,
  },
  "invoice.resent": {
    icon: RefreshCw,
    color: "bg-blue-100 text-blue-600",
    label: (m) =>
      `Invoice resent to ${m.clientName ?? "client"} · ${m.invoiceNumber ?? ""}`,
    href: (id) => `/invoices/${id}`,
  },
};

const FALLBACK: ActionMeta = {
  icon: Bell,
  color: "bg-gray-100 text-gray-500",
  label: (m) => String(m.description ?? "Workspace activity"),
  href: () => null,
};

// ─── Date group label ─────────────────────────────────────────────────────────

function groupLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEEE, MMMM d");
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser!.id },
    include: { workspaces: { include: { workspace: true }, take: 1 } },
  });
  const workspaceId = user!.workspaces[0].workspace.id;

  const logs = await prisma.activityLog.findMany({
    where: { workspaceId },
    include: {
      user: { select: { fullName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Group by calendar day
  const groups: { label: string; items: typeof logs }[] = [];
  let currentLabel = "";

  for (const log of logs) {
    const label = groupLabel(new Date(log.createdAt));
    if (label !== currentLabel) {
      currentLabel = label;
      groups.push({ label, items: [] });
    }
    groups[groups.length - 1].items.push(log);
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <MarkReadOnMount />
      <Header
        title="Activity Feed"
        description={`${logs.length} recent event${logs.length !== 1 ? "s" : ""}`}
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 mb-4">
                <Bell className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="text-[15px] font-semibold text-gray-900 mb-1">
                No activity yet
              </h3>
              <p className="text-[13px] text-gray-400 max-w-xs leading-relaxed">
                When you create jobs, send invoices, or add clients, activity will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {groups.map((group) => (
                <div key={group.label}>
                  {/* Date header */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {group.label}
                    </span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>

                  {/* Events */}
                  <div className="bg-white rounded-xl border overflow-hidden divide-y divide-gray-50">
                    {group.items.map((log) => {
                      const meta = (log.metadata ?? {}) as Record<string, unknown>;
                      const cfg = ACTION_MAP[log.action] ?? FALLBACK;
                      const Icon = cfg.icon;
                      const href = cfg.href?.(log.entityId, meta) ?? null;
                      const label = cfg.label(meta);
                      const actor = log.user?.fullName ?? log.user?.email ?? "System";
                      const timeAgo = formatDistanceToNow(new Date(log.createdAt), { addSuffix: true });

                      const content = (
                        <div
                          className={cn(
                            "flex items-start gap-3.5 px-4 py-3.5 transition-colors",
                            href && "hover:bg-gray-50 group"
                          )}
                        >
                          {/* Icon */}
                          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5", cfg.color)}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>

                          {/* Text */}
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] text-gray-800 leading-snug font-medium">
                              {label}
                            </p>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              {actor} · {timeAgo}
                            </p>
                          </div>

                          {/* Arrow */}
                          {href && (
                            <ArrowUpRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500 shrink-0 mt-1 transition-colors" />
                          )}
                        </div>
                      );

                      return href ? (
                        <Link key={log.id} href={href}>
                          {content}
                        </Link>
                      ) : (
                        <div key={log.id}>{content}</div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {logs.length === 100 && (
                <p className="text-center text-xs text-gray-400 py-2">
                  Showing the 100 most recent events
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
