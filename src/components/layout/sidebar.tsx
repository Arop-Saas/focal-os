"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  UserCheck,
  Package,
  Receipt,
  Image,
  CalendarDays,
  BarChart3,
  Settings,
  ChevronDown,
  Aperture,
  Bell,
  HelpCircle,
  LogOut,
  Building2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const navGroups = [
  {
    label: null,
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Jobs", href: "/jobs", icon: Briefcase },
      { label: "Schedule", href: "/scheduling", icon: CalendarDays },
      { label: "Clients", href: "/clients", icon: Users },
    ],
  },
  {
    label: "Team",
    items: [
      { label: "Staff", href: "/staff", icon: UserCheck },
    ],
  },
  {
    label: "Business",
    items: [
      { label: "Packages", href: "/packages", icon: Package },
      { label: "Invoices", href: "/invoices", icon: Receipt },
      { label: "Gallery", href: "/gallery", icon: Image },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Reports", href: "/reports", icon: BarChart3 },
    ],
  },
];

interface SidebarProps {
  workspaceName?: string;
  userEmail?: string;
  userAvatar?: string;
}

export function Sidebar({ workspaceName, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside className="flex h-screen w-64 flex-col bg-[#0F2547] text-slate-300 shrink-0">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 px-5 border-b border-white/10">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500">
          <Aperture className="h-4 w-4 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-white leading-tight">Focal OS</span>
          {workspaceName && (
            <span className="text-xs text-slate-400 leading-tight truncate max-w-[140px]">
              {workspaceName}
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navGroups.map((group) => (
          <div key={group.label ?? "main"}>
            {group.label && (
              <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-colors",
                      active
                        ? "bg-blue-600/20 text-white"
                        : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        active ? "text-blue-400" : "text-slate-500"
                      )}
                    />
                    {item.label}
                    {active && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-400" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-white/10 p-3 space-y-0.5">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-colors",
            pathname.startsWith("/settings")
              ? "bg-blue-600/20 text-white"
              : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
          )}
        >
          <Settings className="h-4 w-4 text-slate-500" />
          Settings
        </Link>

        <Link
          href="/notifications"
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-colors"
        >
          <Bell className="h-4 w-4 text-slate-500" />
          Notifications
        </Link>

        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-red-400 transition-colors"
        >
          <LogOut className="h-4 w-4 text-slate-500" />
          {signingOut ? "Signing out…" : "Sign out"}
        </button>

        {userEmail && (
          <div className="mt-2 px-2.5 py-2 rounded-md bg-white/5">
            <p className="text-xs text-slate-500 truncate">{userEmail}</p>
          </div>
        )}
      </div>
    </aside>
  );
}
