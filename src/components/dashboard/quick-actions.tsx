import Link from "next/link";
import { Plus, UserPlus, FileText, Package } from "lucide-react";

const actions = [
  { label: "New Job", href: "/jobs/new", icon: Plus, color: "bg-blue-500 hover:bg-blue-600" },
  { label: "New Client", href: "/clients?new=1", icon: UserPlus, color: "bg-violet-500 hover:bg-violet-600" },
  { label: "New Invoice", href: "/invoices?new=1", icon: FileText, color: "bg-green-500 hover:bg-green-600" },
  { label: "Add Package", href: "/packages?new=1", icon: Package, color: "bg-orange-500 hover:bg-orange-600" },
];

export function QuickActions() {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {actions.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors shadow-sm ${action.color}`}
        >
          <action.icon className="h-4 w-4" />
          {action.label}
        </Link>
      ))}
    </div>
  );
}
