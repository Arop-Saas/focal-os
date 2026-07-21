"use client";

/**
 * Animated brand panel for the auth screens (login/register/forgot/confirm).
 * Drifting ambient glows, staggered copy, and stat tiles whose numbers count
 * up on load. The form side stays snappy — motion lives on the brand side.
 */
import { useEffect } from "react";
import Link from "next/link";
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  useReducedMotion,
} from "framer-motion";
import { Camera } from "lucide-react";
import { StickFigureStory } from "./stick-figure-story";

const EASE = [0.21, 0.65, 0.32, 0.95] as const;

function StatCounter({
  target,
  decimals = 0,
  suffix,
  label,
  delay,
}: {
  target: number;
  decimals?: number;
  suffix: string;
  label: string;
  delay: number;
}) {
  const reduced = useReducedMotion();
  const mv = useMotionValue(reduced ? target : 0);
  const text = useTransform(mv, (v) => {
    const fixed = v.toFixed(decimals);
    return decimals === 0 ? Number(fixed).toLocaleString("en-US") : fixed;
  });

  useEffect(() => {
    if (reduced) return;
    const controls = animate(mv, target, {
      duration: 1.6,
      delay: delay + 0.35,
      ease: "easeOut",
    });
    return controls.stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: EASE }}
      whileHover={{ y: -3, borderColor: "rgba(96,165,250,0.25)" }}
      className="border border-white/[0.08] rounded-xl bg-white/[0.03] p-4"
    >
      <p className="text-[22px] font-extrabold text-white leading-none tabular-nums">
        <motion.span>{text}</motion.span>
        {suffix}
      </p>
      <p className="text-[11px] text-gray-600 mt-1.5 leading-tight">{label}</p>
    </motion.div>
  );
}

const STATS = [
  { target: 2400, suffix: "+", label: "Jobs managed / month" },
  { target: 12, suffix: " hrs", label: "Average time saved" },
  { target: 340, suffix: "+", label: "Photographer teams" },
  { target: 1.2, decimals: 1, suffix: "M+", label: "Photos delivered" },
];

export function AuthBrandPanel() {
  return (
    <div className="hidden lg:flex flex-col bg-[#080808] text-white p-10 relative overflow-hidden">
      {/* drifting ambient glows */}
      <motion.div
        aria-hidden
        animate={{ x: [0, 60, -20, 0], y: [0, 40, 80, 0], scale: [1, 1.15, 0.95, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-24 -left-24 w-[600px] h-[500px] bg-gradient-to-br from-blue-600/20 via-violet-600/10 to-transparent rounded-full blur-3xl pointer-events-none"
      />
      <motion.div
        aria-hidden
        animate={{ x: [0, -50, 30, 0], y: [0, -30, 20, 0] }}
        transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-0 right-0 w-[420px] h-[380px] bg-gradient-to-tl from-violet-600/[0.12] to-transparent rounded-full blur-3xl pointer-events-none"
      />

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="relative w-fit"
      >
        <Link href="/" className="flex items-center gap-2.5 w-fit">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
            <Camera className="h-4 w-4 text-white" />
          </div>
          <span className="text-[15px] font-bold text-white tracking-tight">Scalist</span>
        </Link>
      </motion.div>

      {/* Stick-figure theater — big and centered in the open space right of the copy */}
      <div className="pointer-events-none absolute inset-y-0 left-[430px] right-6 z-0 hidden xl:flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.5, ease: EASE }}
          className="w-full max-w-[720px]"
        >
          <StickFigureStory />
        </motion.div>
      </div>

      {/* Hero text */}
      <div className="relative z-10 flex-1 flex flex-col justify-center max-w-sm">
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
          className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-4"
        >
          Real Estate Photography Platform
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18, ease: EASE }}
          className="text-[32px] font-extrabold leading-tight text-white mb-4 tracking-tight"
        >
          Run your entire photography business from{" "}
          <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-blue-300 bg-clip-text text-transparent">
            one place
          </span>
          .
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.28, ease: EASE }}
          className="text-gray-500 text-[15px] leading-relaxed"
        >
          Scheduling, delivery, invoicing, and team management — built
          specifically for real estate media companies.
        </motion.p>

        <div className="mt-10 grid grid-cols-2 gap-4">
          {STATS.map((s, i) => (
            <StatCounter
              key={s.label}
              target={s.target}
              decimals={s.decimals}
              suffix={s.suffix}
              label={s.label}
              delay={0.4 + i * 0.12}
            />
          ))}
        </div>
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1 }}
        className="relative text-[11px] text-gray-700"
      >
        © {new Date().getFullYear()} Scalist. All rights reserved.
      </motion.p>
    </div>
  );
}

/** Gentle rise-in for the form card on the right. */
export function AuthFormReveal({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.15, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
