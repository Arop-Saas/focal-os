import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Briefcase, DollarSign, CheckCircle, XCircle, FileText,
  UserPlus, Send, Image, AlertCircle, Activity
} from "lucide-react";

type Log = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: unknown;
  createdAt: Date;
  user: { fullName: string } | null;
};

type ActionMeta = {
  icon: React.ElementType;
  bg: string;
  color: string;
  label: (m: Record<string, string>) => string;
  href?: (id: string) => string;
};

const ACTION_MAP: Record<string, ActionMeta> = {
  "job.created":    { icon: Briefcase,   bg: "bg-blue-50",    color: "text-blue-600",    label: (m) => `New job booked${m.propertyAddress ? ` · ${m.propertyAddress}` : ""}`,  href: (id) => `/jobs/${id}` },
  "job.updated":    { icon: Briefcase,   bg: "bg-gray-50",    color: "text-gray-500",    label: (m) => `Job updated${m.status ? ` → ${m.status}` : ""}`,                       href: (id) => `/jobs/${id}` },
  "job.completed":  { icon: CheckCircle, bg: "bg-emerald-50", color: "text-emerald-600", label: (m) => `Job completed${m.propertyAddress ? ` · ${m.propertyAddress}` : ""}`,   href: (id) => `/jobs/${id}` },
  "job.cancelled":  { icon: XCircle,     bg: "bg-red-50",     color: "text-red-500",     label: (m) => `Job cancelled${m.propertyAddress ? ` · ${m.propertyAddress}` : ""}`,   href: (id) => `/jobs/${id}` },
  "invoice.created":{ icon: FileText,    bg: "bg-gray-50",    color: "text-gray-500",    label: (m) => `Invoice created${m.invoiceNumber ? ` · ${m.invoiceNumber}` : ""}`,      href: (id) => `/invoices/${id}` },
  "invoice.sent":   { icon: Send,        bg: "bg-blue-50",    color: "text-blue-600",    label: (m) => `Invoice sent${m.invoiceNumber ? ` · ${m.invoiceNumber}` : ""}`,         href: (id) => `/invoices/${id}` },
  "invoice.paid":   { icon: DollarSign,  bg: "bg-emerald-50", color: "text-emerald-600", label: (m) => `Payment received${m.invoiceNumber ? ` · ${m.invoiceNumber}` : ""}${m.amount ? ` · $${Number(m.amount).toLocaleString()}` : ""}`, href: (id) => `/invoices/${id}` },
  "invoice.partial":{ icon: DollarSign,  bg: "bg-amber-50",   color: "text-amber-600",   label: (m) => `Partial payment${m.invoiceNumber ? ` · ${m.invoiceNumber}` : ""}`,      href: (id) => `/invoices/${id}` },
  "invoice.voided": { icon: XCircle,     bg: "bg-red-50",     color: "text-red-500",     label: (m) => `Invoice voided${m.invoiceNumber ? ` · ${m.invoiceNumber}` : ""}`,       href: (id) => `/invoices/${id}` },
  "client.created": { icon: UserPlus,    bg: "bg-violet-50",  color: "text-violet-600",  label: (m) => `New client${m.clientName ? ` · ${m.clientName}` : ""}`,                 href: (id) => `/clients/${id}` },
  "gallery.created":{ icon: Image,       bg: "bg-indigo-50",  color: "text-indigo-600",  label: () => "Gallery created",                                                         href: (id) => `/gallery/${id}` },
};

const FALLBACK: ActionMeta = {
  icon: AlertCircle,
  bg: "bg-gray-50",
  color: "text-gray-400",
  label: (_, action) => action.replace(".", " "),
};

export function ActivityFeed({ logs }: { logs: Log[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50 shrink-0">
        <h2 className="text-[13px] font-semibold text-gray-900 flex items-center gap-2">
          Activity
        </h2>
        <Link href="/notifications" className="text-[11px] font-medium text-blue-600 hover:text-blue-700 transition-colors">
          See all
        </Link>
      </div>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-10 text-center px-4">
          <div className="h-9 w-9 rounded-full bg-gray-50 flex items-center justify-center mb-2">
            <Activity className="h-4 w-4 text-gray-300" />
          </div>
          <p className="text-xs text-gray-400">No activity yet</p>
        </div>
      ) : (
        <div className="overflow-y-auto flex-1">
          {logs.map((log) => {
            const meta = ACTION_MAP[log.action] ?? { ...FALLBACK, label: () => log.action };
            const Icon = meta.icon;
            const m = (log.metadata as Record<string, string>) ?? {};
            const href = meta.href?.(log.entityId);

            const inner = (
              <div className="flex items-start gap-3 px-4 py-3 group hover:bg-gray-50/60 transition-colors">
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg shrink-0 mt-0.5 ${meta.bg}`}>
                  <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-gray-800 leading-snug group-hover:text-gray-900 transition-colors">
                    {meta.label(m, log.action as never)}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {log.user?.fullName ?? "System"}
                    {" · "}
                    {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );

            return href ? (
              <Link key={log.id} href={href} className="block border-b border-gray-50 last:border-0">
                {inner}
              </Link>
            ) : (
              <div key={log.id} className="border-b border-gray-50 last:border-0">
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
