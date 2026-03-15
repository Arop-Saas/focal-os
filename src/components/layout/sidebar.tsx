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
  DollarSign,
  Settings,
  Aperture,
  LogOut,
  ShieldAlert,
} from "lucide-react";
import { NotificationBell } from "./notification-bell";
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
      { label: "Payouts", href: "/reports/payouts", icon: DollarSign },
    ],
  },
];

interface SidebarProps {
  workspaceName?: string;
  userEmail?: string;
  userAvatar?: string;
  isSuperAdmin?: boolean;
}

export function Sidebar({ workspaceName, userEmail, isSuperAdmin }: SidebarProps) {
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

  const initial = userEmail ? userEmail[0].toUpperCase() : "U";

  return (
    <aside className="flex h-screen w-60 flex-col bg-[#0c1e3d] text-slate-300 shrink-0 border-r border-white/[0.06]">
      {/* Logo / workspace */}
      <div className="flex h-14 items-center gap-3 px-4 border-b border-white/[0.06]">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500 shrink-0">
          <Aperture className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="min-w-0">
          <span className="text-sm font-semibold text-white block leading-tight truncate">
            {workspaceName ?? "Focal OS"}
          </span>
          <span className="text-[10px] text-slate-500 block leading-tight">Photography Studio</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {navGroups.map((group) => (
          <div key={group.label ?? "main"}>
            {group.label && (
              <div className="px-2 mb-2 mt-1">
                <span
                  className="inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md"
                  style={{
                    color: "#e0f2fe",
                    background: "rgba(56,189,248,0.18)",
                    border: "1px solid rgba(56,189,248,0.35)",
                    boxShadow: "0 0 8px rgba(56,189,248,0.4), inset 0 0 6px rgba(56,189,248,0.1)",
                  }}
                >
                  {group.label}
                </span>
              </div>
            )}
            <div className="space-y-px">
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-all duration-150",
                      active
                        ? "bg-white/[0.08] text-white"
                        : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-r-full bg-blue-400" />
                    )}
                    <item.icon
                      className={cn(
                        "h-[15px] w-[15px] shrink-0 transition-colors",
                        active ? "text-blue-400" : "text-slate-500"
                      )}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom utilities */}
      <div className="border-t border-white/[0.06] px-2 py-2 space-y-px">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-all",
            pathname.startsWith("/settings")
              ? "bg-white/[0.08] text-white"
              : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
          )}
        >
          <Settings className="h-[15px] w-[15px] text-slate-500" />
          Settings
        </Link>
        <NotificationBell />
      </div>

      {/* Operator Console — superAdmin only */}
      {isSuperAdmin && (
        <div className="px-2 pb-2">
          <Link
            href="/admin"
            className="group relative flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-[12px] font-semibold transition-all duration-200 overflow-hidden
              bg-violet-950/60 border border-violet-500/30 text-violet-300
              hover:bg-violet-900/70 hover:border-violet-400/50 hover:text-violet-100"
          >
            {/* subtle pulse glow */}
            <span className="absolute inset-0 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-violet-500/10" />
            <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-violet-400 group-hover:text-violet-200 transition-colors relative z-10" />
            <span className="relative z-10 tracking-wide uppercase text-[10px]">Operator Console</span>
            <span className="ml-auto relative z-10 h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
          </Link>
        </div>
      )}

      {/* User footer */}
      <div className="border-t border-white/[0.06] p-3">
        <div className="flex items-center gap-2.5 group">
          <div className="h-7 w-7 rounded-full bg-blue-600/80 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-slate-400 truncate leading-tight">{userEmail ?? "—"}</p>
          </div>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            title="Sign out"
            className="text-slate-600 hover:text-red-400 transition-colors shrink-0"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
