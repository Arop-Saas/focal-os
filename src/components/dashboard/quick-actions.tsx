import Link from "next/link";
import { Plus, UserPlus, FileText, Package } from "lucide-react";

const actions = [
  {
    label: "New Job",
    href: "/jobs/new",
    icon: Plus,
    description: "Schedule a shoot",
  },
  {
    label: "New Client",
    href: "/clients?new=1",
    icon: UserPlus,
    description: "Add a contact",
  },
  {
    label: "New Invoice",
    href: "/invoices?new=1",
    icon: FileText,
    description: "Bill a client",
  },
  {
    label: "Add Package",
    href: "/packages?new=1",
    icon: Package,
    description: "Create a service",
  },
];

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {actions.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm hover:border-blue-200 hover:shadow-md transition-all duration-150"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 group-hover:bg-blue-50 transition-colors shrink-0">
            <action.icon className="h-3.5 w-3.5 text-gray-500 group-hover:text-blue-600 transition-colors" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-gray-800 leading-tight">{action.label}</p>
            <p className="text-[11px] text-gray-400 leading-tight mt-0.5">{action.description}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
