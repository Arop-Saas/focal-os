"use client";

import { useState } from "react";
import {
  LayoutDashboard, Briefcase, Users, CalendarDays, MessageCircle,
  Package, Receipt, Image, Clock, Puzzle, Settings, Bell, CreditCard,
  BookOpen, Globe, LogIn, UserPlus, ExternalLink, ChevronRight,
  Monitor, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

interface WindowViewClientProps {
  workspaces: Workspace[];
}

const APP_PAGES = [
  {
    group: "Operations",
    pages: [
      { label: "Dashboard", path: "/overview", icon: LayoutDashboard },
      { label: "Jobs", path: "/jobs", icon: Briefcase },
      { label: "Clients", path: "/clients", icon: Users },
      { label: "Schedule", path: "/scheduling", icon: CalendarDays },
      { label: "Messages", path: "/messages", icon: MessageCircle },
    ],
  },
  {
    group: "Business",
    pages: [
      { label: "Products", path: "/packages", icon: Package },
      { label: "Invoices", path: "/invoices", icon: Receipt },
      { label: "Listings", path: "/gallery", icon: Image },
      { label: "Availability", path: "/availability", icon: Clock },
      { label: "Integrations", path: "/integrations", icon: Puzzle },
      { label: "Settings", path: "/settings", icon: Settings },
      { label: "Notifications", path: "/notifications", icon: Bell },
      { label: "Billing", path: "/billing", icon: CreditCard },
    ],
  },
  {
    group: "Public / Client-Facing",
    pages: [
      { label: "Booking Page", path: "/book/{slug}", icon: BookOpen, needsSlug: true },
      { label: "Client Portal", path: "/portal/{slug}", icon: Globe, needsSlug: true },
      { label: "Login", path: "/login", icon: LogIn },
      { label: "Onboarding", path: "/onboarding", icon: UserPlus },
    ],
  },
];

export function WindowViewClient({ workspaces }: WindowViewClientProps) {
  const [selectedPath, setSelectedPath] = useState("/overview");
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(
    workspaces[0] ?? null
  );
  const [iframeKey, setIframeKey] = useState(0);

  function resolvePath(path: string) {
    if (path.includes("{slug}") && selectedWorkspace) {
      return path.replace("{slug}", selectedWorkspace.slug);
    }
    return path;
  }

  const resolvedUrl = resolvePath(selectedPath);
  const needsSlug = selectedPath.includes("{slug}");

  function handleSelect(path: string) {
    setSelectedPath(path);
    setIframeKey((k) => k + 1);
  }

  function handleRefresh() {
    setIframeKey((k) => k + 1);
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left nav ── */}
      <div className="w-52 shrink-0 border-r border-[#ffffff08] bg-[#05050d] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#ffffff08]">
          <div className="flex items-center gap-2">
            <Monitor className="h-3.5 w-3.5 text-violet-400" />
            <span className="text-[11px] font-bold text-white tracking-widest uppercase">Window View</span>
          </div>
          <p className="text-[9px] text-slate-600 mt-0.5 tracking-wide">Live app preview</p>
        </div>

        {/* Workspace picker — shown when a slug-based page is active */}
        {needsSlug && workspaces.length > 0 && (
          <div className="px-3 py-2 border-b border-[#ffffff08] bg-violet-950/30">
            <p className="text-[9px] text-violet-400 uppercase tracking-widest mb-1.5 font-bold">Workspace</p>
            <select
              value={selectedWorkspace?.id ?? ""}
              onChange={(e) => {
                const ws = workspaces.find((w) => w.id === e.target.value);
                if (ws) { setSelectedWorkspace(ws); setIframeKey((k) => k + 1); }
              }}
              className="w-full bg-[#0a0a18] border border-violet-500/30 text-slate-300 text-[11px] rounded px-2 py-1 focus:outline-none focus:border-violet-400"
            >
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>{ws.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Page list */}
        <nav className="flex-1 overflow-y-auto py-2">
          {APP_PAGES.map((group) => (
            <div key={group.group} className="mb-3">
              <p className="px-4 py-1 text-[9px] font-bold uppercase tracking-widest text-slate-600">
                {group.group}
              </p>
              {group.pages.map((page) => {
                const isActive = selectedPath === page.path;
                return (
                  <button
                    key={page.path}
                    onClick={() => handleSelect(page.path)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-4 py-1.5 text-[12px] font-medium transition-colors text-left",
                      isActive
                        ? "bg-violet-600/20 text-violet-300 border-l-2 border-violet-400"
                        : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.03] border-l-2 border-transparent"
                    )}
                  >
                    <page.icon className={cn("h-3 w-3 shrink-0", isActive ? "text-violet-400" : "text-slate-600")} />
                    <span className="truncate">{page.label}</span>
                    {isActive && <ChevronRight className="h-2.5 w-2.5 ml-auto shrink-0 text-violet-400" />}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* ── Right: iframe panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#080810]">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 h-10 border-b border-[#ffffff08] shrink-0">
          <div className="flex items-center gap-1.5 flex-1 min-w-0 bg-[#0d0d1a] border border-[#ffffff0a] rounded px-3 py-1">
            <span className="text-[10px] text-slate-600 shrink-0">scalist.io</span>
            <span className="text-[10px] text-slate-400 truncate font-mono">{resolvedUrl}</span>
          </div>
          <button
            onClick={handleRefresh}
            title="Refresh"
            className="text-slate-600 hover:text-slate-300 transition-colors p-1 rounded hover:bg-white/[0.04]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <a
            href={resolvedUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in new tab"
            className="text-slate-600 hover:text-slate-300 transition-colors p-1 rounded hover:bg-white/[0.04]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* iframe */}
        <div className="flex-1 relative overflow-hidden">
          <iframe
            key={iframeKey}
            src={resolvedUrl}
            className="absolute inset-0 w-full h-full border-0 bg-white"
            title="App Preview"
          />
        </div>
      </div>
    </div>
  );
}
