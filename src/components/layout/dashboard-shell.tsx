"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, Aperture } from "lucide-react";
import { Sidebar } from "./sidebar";

interface DashboardShellProps {
  children: React.ReactNode;
  workspaceName?: string;
  userEmail?: string;
  isSuperAdmin?: boolean;
}

export function DashboardShell({
  children,
  workspaceName,
  userEmail,
  isSuperAdmin,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* ── Desktop sidebar (always visible at md+) ── */}
      <div className="hidden md:flex md:shrink-0">
        <Sidebar
          workspaceName={workspaceName}
          userEmail={userEmail}
          isSuperAdmin={isSuperAdmin}
        />
      </div>

      {/* ── Mobile sidebar drawer ── */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer panel */}
          <div className="fixed inset-y-0 left-0 z-50 flex md:hidden">
            <Sidebar
              workspaceName={workspaceName}
              userEmail={userEmail}
              isSuperAdmin={isSuperAdmin}
            />
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 text-slate-400 hover:text-white p-1 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </>
      )}

      {/* ── Main content ── */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Mobile top bar */}
        <div className="flex md:hidden items-center gap-3 h-12 px-4 bg-[#0c1e3d] border-b border-white/[0.06] shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-slate-400 hover:text-white transition-colors p-1 -ml-1 rounded"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-500 shrink-0">
              <Aperture className="h-3 w-3 text-white" />
            </div>
            <span className="text-sm font-semibold text-white truncate">{workspaceName ?? "Focal OS"}</span>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
