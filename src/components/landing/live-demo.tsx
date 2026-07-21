"use client";

/**
 * Landing hero — the "living product demo".
 * A dashboard-style frame that plays Scalist's core loop on repeat:
 *   0 Booked → 1 Scheduled → 2 Delivered → 3 Paid
 * Phase state lives in the hero (so the headline can sync); this component
 * is purely presentational for a given phase.
 */
import { motion, AnimatePresence } from "framer-motion";
import { Camera, CheckCircle2, ImageIcon, CalendarDays, CreditCard } from "lucide-react";

export const DEMO_PHASES = ["Booked", "Scheduled", "Delivered", "Paid"] as const;

const spring = { type: "spring", stiffness: 260, damping: 24 } as const;

function FramePanel({
  active,
  icon,
  title,
  children,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      animate={{
        opacity: active ? 1 : 0.38,
        scale: active ? 1 : 0.985,
        borderColor: active ? "rgba(96,165,250,0.35)" : "rgba(255,255,255,0.07)",
      }}
      transition={{ duration: 0.45 }}
      className="rounded-xl border bg-white/[0.02] p-3.5 overflow-hidden"
    >
      <div className="flex items-center gap-2 mb-2.5">
        <span className={active ? "text-blue-400" : "text-gray-600"}>{icon}</span>
        <span className={`text-[11px] font-semibold uppercase tracking-wider ${active ? "text-gray-300" : "text-gray-600"}`}>
          {title}
        </span>
        {active && (
          <motion.span
            layoutId="live-dot"
            className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_2px_rgba(96,165,250,0.6)]"
          />
        )}
      </div>
      {children}
    </motion.div>
  );
}

export function LiveDemo({ phase }: { phase: number }) {
  return (
    <div className="relative rounded-2xl border border-white/10 bg-[#0B0E14]/90 backdrop-blur-xl shadow-[0_24px_80px_-24px_rgba(37,99,235,0.35)] overflow-hidden">
      {/* window chrome */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/[0.06]">
        <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
        <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
        <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
        <span className="ml-3 text-[11px] text-gray-500 font-medium tracking-wide">
          scalist.io — Alphaspace Studio
        </span>
        <span className="ml-auto text-[10px] text-gray-600 font-mono">live</span>
      </div>

      <div className="grid grid-cols-2 gap-3 p-4">
        {/* ── 0: Booking arrives ── */}
        <FramePanel active={phase === 0} icon={<Camera className="w-3.5 h-3.5" />} title="New booking">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={`bk-${phase === 0}`}
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={spring}
              className="flex items-center gap-2.5"
            >
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                SK
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">128 Maple Ave NW</p>
                <p className="text-[10px] text-gray-500 truncate">Sarah K. · Realtor · Deluxe package</p>
              </div>
            </motion.div>
          </AnimatePresence>
          <motion.div
            animate={{ width: phase === 0 ? "100%" : "0%" }}
            transition={{ duration: phase === 0 ? 2.2 : 0.3, ease: "linear" }}
            className="h-0.5 mt-3 rounded-full bg-gradient-to-r from-blue-500 to-violet-500"
          />
        </FramePanel>

        {/* ── 1: Engine schedules it ── */}
        <FramePanel active={phase === 1} icon={<CalendarDays className="w-3.5 h-3.5" />} title="Scheduled">
          <div className="grid grid-cols-5 gap-1">
            {["M", "T", "W", "T", "F"].map((d, i) => (
              <div key={i} className="rounded-md bg-white/[0.03] h-14 relative overflow-hidden">
                <span className="absolute top-1 left-0 right-0 text-center text-[9px] text-gray-600">{d}</span>
                {i === 3 && phase >= 1 && (
                  <motion.div
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={spring}
                    className="absolute inset-x-0.5 bottom-1 top-5 rounded bg-gradient-to-b from-blue-500/80 to-violet-600/80 flex flex-col items-center justify-center"
                  >
                    <span className="text-[8px] font-bold text-white leading-none">9:30</span>
                    <span className="text-[7px] text-blue-100/80 leading-tight mt-0.5">AR</span>
                  </motion.div>
                )}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-500 mt-2">
            {phase >= 1 ? "Travel-checked · assigned to Arop" : "Finding a slot that actually works…"}
          </p>
        </FramePanel>

        {/* ── 2: Gallery delivered ── */}
        <FramePanel active={phase === 2} icon={<ImageIcon className="w-3.5 h-3.5" />} title="Delivered">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                initial={false}
                animate={
                  phase >= 2
                    ? { scale: 1, opacity: 1, y: 0 }
                    : { scale: 0.7, opacity: 0.15, y: 6 }
                }
                transition={{ ...spring, delay: phase >= 2 ? i * 0.12 : 0 }}
                className={`h-12 flex-1 rounded-md bg-gradient-to-br ${
                  ["from-sky-800 to-blue-950", "from-indigo-800 to-slate-950", "from-violet-800 to-blue-950"][i]
                }`}
              />
            ))}
          </div>
          <p className="text-[10px] text-gray-500 mt-2">
            {phase >= 2 ? "24 photos · gallery link sent" : "Editing in progress…"}
          </p>
        </FramePanel>

        {/* ── 3: Invoice paid ── */}
        <FramePanel active={phase === 3} icon={<CreditCard className="w-3.5 h-3.5" />} title="Invoice">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white">INV-1042</p>
              <p className="text-[10px] text-gray-500">$399.00 · net 30</p>
            </div>
            <AnimatePresence mode="popLayout" initial={false}>
              {phase >= 3 ? (
                <motion.span
                  key="paid"
                  initial={{ scale: 0.5, opacity: 0, rotate: -8 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  transition={spring}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-400/30 rounded-full px-2.5 py-1"
                >
                  <CheckCircle2 className="w-3 h-3" /> PAID
                </motion.span>
              ) : (
                <motion.span
                  key="sent"
                  exit={{ scale: 0.6, opacity: 0 }}
                  className="text-[10px] font-bold text-amber-300/90 bg-amber-500/10 border border-amber-400/20 rounded-full px-2.5 py-1"
                >
                  SENT
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          {phase >= 3 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[10px] text-gray-500 mt-2"
            >
              Stripe payment confirmed automatically
            </motion.div>
          )}
        </FramePanel>
      </div>

      {/* step rail */}
      <div className="flex items-center gap-1.5 px-4 pb-4">
        {DEMO_PHASES.map((label, i) => (
          <div key={label} className="flex-1">
            <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <motion.div
                animate={{ width: i < phase ? "100%" : i === phase ? "100%" : "0%" }}
                transition={i === phase ? { duration: 2.4, ease: "linear" } : { duration: 0.2 }}
                className={`h-full rounded-full ${i <= phase ? "bg-gradient-to-r from-blue-500 to-violet-500" : ""}`}
              />
            </div>
            <p className={`text-[9px] mt-1 text-center font-medium ${i === phase ? "text-blue-300" : "text-gray-600"}`}>
              {label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
