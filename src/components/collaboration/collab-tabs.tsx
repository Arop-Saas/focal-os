import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Tab bar for the Collaboration hub. Tabs are added here as their features
 * come online — never ship a dead tab.
 */
const TABS: { key: string; label: string; href: string }[] = [
  { key: "order-notes", label: "Order Notes", href: "/collaboration" },
];

export function CollabTabs({ active }: { active: string }) {
  if (TABS.length < 2) return null;
  return (
    <div className="flex shrink-0 items-center gap-1 border-b bg-white px-6">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cn(
            "-mb-px border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors",
            active === t.key
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-gray-500 hover:text-gray-800"
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
