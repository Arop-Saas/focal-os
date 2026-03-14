"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Briefcase,
  Receipt,
  Image,
  LogOut,
  Aperture,
  ShoppingCart,
  UserCircle,
} from "lucide-react";

interface PortalNavProps {
  workspaceSlug: string;
  workspaceName: string;
  clientName: string;
  brandColor?: string;
}

export function PortalNav({
  workspaceSlug,
  workspaceName,
  clientName,
  brandColor = "#1B4F9E",
}: PortalNavProps) {
  const pathname = usePathname();
  const base = `/portal/${workspaceSlug}`;

  const navItems = [
    { label: "Dashboard", href: `${base}/dashboard`, icon: LayoutDashboard },
    { label: "Orders", href: `${base}/orders`, icon: Briefcase },
    { label: "Invoices", href: `${base}/invoices`, icon: Receipt },
    { label: "Galleries", href: `${base}/galleries`, icon: Image },
    { label: "My Profile", href: `${base}/profile`, icon: UserCircle },
  ];

  return (
    <aside className="flex h-screen w-56 flex-col bg-white border-r border-gray-100 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-gray-100">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: brandColor }}
        >
          <Aperture className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-sm font-semibold text-gray-900 truncate">{workspaceName}</span>
      </div>

      {/* Client greeting */}
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">Signed in as</p>
        <p className="text-sm font-medium text-gray-800 truncate mt-0.5">{clientName}</p>
      </div>

      {/* Place Order CTA */}
      <div className="px-3 py-3 border-b border-gray-100">
        <Link
          href={`/book/${workspaceSlug}`}
          className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: brandColor }}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          Place Order
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-px overflow-y-auto">
        <p className="px-2.5 mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-gray-400">
          General
        </p>
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors",
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
              )}
            >
              <item.icon className={cn("w-[15px] h-[15px] shrink-0", active ? "text-blue-600" : "text-gray-400")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="border-t border-gray-100 p-3">
        <a
          href={`/api/portal/logout?slug=${workspaceSlug}`}
          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors w-full"
        >
          <LogOut className="w-[15px] h-[15px]" />
          Sign out
        </a>
      </div>
    </aside>
  );
}
