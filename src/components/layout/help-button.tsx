"use client";

import { useState, useRef, useEffect } from "react";
import { HelpCircle, Lightbulb, ExternalLink } from "lucide-react";
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

  // Close on outside click
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
      <button
        onClick={() => setOpen((v) => !v)}
        title="Help & Feedback"
        className={`h-6 w-6 rounded-md flex items-center justify-center transition-all border
          ${open
            ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
            : "bg-white/[0.04] border-white/[0.08] text-slate-500 hover:bg-white/[0.08] hover:text-slate-300 hover:border-white/[0.15]"
          }`}
      >
        <HelpCircle className="h-3 w-3" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-52 bg-[#0d0d1e] border border-white/[0.10] rounded-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-3.5 py-2.5 border-b border-white/[0.06]">
            <p className="text-[10px] font-bold tracking-widest uppercase text-slate-500">Help & Feedback</p>
          </div>

          {/* Items */}
          <div className="p-1.5 space-y-px">
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              const inner = (
                <div
                  className="flex items-start gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/[0.05] transition-colors cursor-pointer group"
                  onClick={() => setOpen(false)}
                >
                  <div className="h-6 w-6 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="h-3 w-3 text-blue-400" />
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

          {/* Footer tag */}
          <div className="px-3.5 py-2 border-t border-white/[0.06]">
            <p className="text-[9px] text-slate-700 font-mono">scalist.io · platform feedback</p>
          </div>
        </div>
      )}
    </div>
  );
}
