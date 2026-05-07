"use client";

import { useState, useRef, useEffect } from "react";
import { CircleHelp, Lightbulb, ExternalLink } from "lucide-react";
import Link from "next/link";

const MENU_ITEMS = [
  {
    label: "Feature Requests",
    description: "Vote & submit ideas",
    href: "/feedback",
    icon: Lightbulb,
    internal: true,
  },
  {
    label: "Support Center",
    description: "Docs & guides",
    href: "mailto:support@scalist.io",
    icon: ExternalLink,
    internal: false,
  },
];

export function HelpButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      {/* The "?" button — silver glow, noticeable */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Help & Feedback"
        style={{
          boxShadow: open
            ? "0 0 0 1px rgba(148,163,184,0.5), 0 0 10px rgba(148,163,184,0.25), 0 0 20px rgba(148,163,184,0.1)"
            : "0 0 0 1px rgba(100,116,139,0.3), 0 0 8px rgba(148,163,184,0.10)",
        }}
        className={`
          h-7 w-7 rounded-lg flex items-center justify-center transition-all duration-200
          ${open
            ? "bg-slate-300/15 text-white"
            : "bg-slate-400/10 text-slate-300 hover:bg-slate-300/15 hover:text-white"
          }
        `}
      >
        <CircleHelp className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 z-50 w-56 bg-[#0c0c1a] border border-white/[0.10] rounded-xl shadow-2xl overflow-hidden"
          style={{ boxShadow: "0 20px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(148,163,184,0.08)" }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
            <p className="text-[10px] font-bold tracking-widest uppercase text-slate-500">Help & Feedback</p>
          </div>

          {/* Items */}
          <div className="p-2 space-y-0.5">
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              const inner = (
                <div
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer group"
                  onClick={() => setOpen(false)}
                >
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-blue-500/15 flex items-center justify-center shrink-0">
                    <Icon className="h-3.5 w-3.5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-slate-200 group-hover:text-white transition-colors leading-tight">
                      {item.label}
                    </p>
                    <p className="text-[10px] text-slate-600 leading-tight mt-0.5">{item.description}</p>
                  </div>
                </div>
              );

              return item.internal ? (
                <Link key={item.label} href={item.href}>{inner}</Link>
              ) : (
                <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer">{inner}</a>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-white/[0.06]">
            <p className="text-[9px] text-slate-700 font-mono tracking-wide">scalist.io · platform feedback</p>
          </div>
        </div>
      )}
    </div>
  );
}
