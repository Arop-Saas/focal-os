"use client";

/**
 * Stick-figure theater for the auth panel — an original, hand-drawn SVG loop
 * of two characters acting out the Scalist workflow in front of a listing:
 *   0 Booked    — the realtor taps a booking on her phone
 *   1 Shoot     — the photographer fires the camera, flash pops
 *   2 Delivered — photos fly across to the realtor
 *   3 Paid      — a coin arcs back, photographer does a happy hop
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const PHASE_MS = 3000;
const CAPTIONS = [
  "New booking — 128 Maple Ave",
  "Shoot day",
  "24 photos delivered",
  "Invoice paid — $399",
];

const STICK = "#E2E8F0"; // stick-figure stroke
const FAINT = "rgba(148,163,184,0.35)"; // house stroke

export function StickFigureStory() {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setPhase((p) => (p + 1) % 4), PHASE_MS);
    return () => clearInterval(id);
  }, [reduced]);

  return (
    <div className="relative">
      {/* soft stage glow */}
      <div className="absolute inset-x-8 bottom-4 h-24 bg-blue-600/10 blur-3xl rounded-full pointer-events-none" />

      <svg viewBox="0 0 400 210" className="w-full" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* ── ground ── */}
        <line x1="16" y1="176" x2="384" y2="176" stroke="rgba(255,255,255,0.12)" strokeWidth="2" strokeDasharray="1 7" />

        {/* ── the listing (house) ── */}
        <g stroke={FAINT} strokeWidth="2">
          <path d="M 156 176 L 156 118 L 200 88 L 244 118 L 244 176 Z" />
          <path d="M 156 118 L 200 88 L 244 118" strokeWidth="2.5" />
          <rect x="190" y="146" width="20" height="30" rx="1.5" />
          <rect x="166" y="126" width="16" height="13" rx="1.5" />
          <rect x="218" y="126" width="16" height="13" rx="1.5" />
        </g>
        {/* window lights up when the flash fires */}
        <motion.rect
          x="166" y="126" width="16" height="13" rx="1.5"
          fill="#FDE68A"
          animate={{ opacity: phase === 1 ? [0, 0.5, 0] : 0 }}
          transition={{ duration: 1, times: [0, 0.4, 1] }}
        />

        {/* ── REALTOR (left) — walks in from off-screen on first load ── */}
        <motion.g
          initial={{ x: -95, y: 0, opacity: 0 }}
          animate={{ x: 0, y: [0, -2.5, 0, -2.5, 0, -2.5, 0], opacity: 1 }}
          transition={{ duration: 1.3, ease: "easeOut", y: { duration: 1.3, times: [0, 0.16, 0.33, 0.5, 0.66, 0.83, 1] } }}
        >
        <g stroke={STICK} strokeWidth="2.5">
          <circle cx="72" cy="106" r="7.5" />
          <line x1="72" y1="114" x2="72" y2="144" />
          {/* tie */}
          <line x1="72" y1="118" x2="72" y2="127" stroke="#60A5FA" strokeWidth="3" />
          {/* legs */}
          <line x1="72" y1="144" x2="63" y2="168" />
          <line x1="72" y1="144" x2="81" y2="168" />
          {/* back arm */}
          <line x1="72" y1="121" x2="59" y2="134" />
          {/* phone arm — taps during Booked */}
          <g>
            {phase === 0 && !reduced && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                values="0 72 121; -14 72 121; 0 72 121; -14 72 121; 0 72 121"
                dur="1.6s"
                repeatCount="indefinite"
              />
            )}
            <line x1="72" y1="121" x2="88" y2="128" />
            <rect x="86" y="121" width="8" height="13" rx="2" fill="#0B0E14" stroke="#60A5FA" strokeWidth="2" />
          </g>
        </g>
        </motion.g>

        {/* booking chip above the phone */}
        <AnimatePresence>
          {phase === 0 && (
            <motion.g
              initial={{ opacity: 0, y: 8, scale: 0.7 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 280, damping: 18 }}
            >
              <rect x="58" y="66" width="66" height="24" rx="7" fill="#0D1320" stroke="rgba(96,165,250,0.5)" strokeWidth="1.5" />
              <path d="M 68 78 l 3.5 3.5 l 6 -7" stroke="#34D399" strokeWidth="2.5" />
              <text x="84" y="82" fill="#E2E8F0" fontSize="8.5" fontWeight="700" fontFamily="Inter, sans-serif">
                Booked
              </text>
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── PHOTOGRAPHER (right, facing the house) ── */}
        <motion.g
          animate={phase === 3 && !reduced ? { y: [0, -8, 0, -5, 0] } : { y: 0 }}
          transition={{ duration: 0.9, times: [0, 0.25, 0.5, 0.75, 1] }}
        >
          <g stroke={STICK} strokeWidth="2.5">
            <circle cx="330" cy="104" r="7.5" />
            <line x1="330" y1="112" x2="330" y2="143" />
            {/* legs */}
            <line x1="330" y1="143" x2="322" y2="168" />
            <line x1="330" y1="143" x2="339" y2="168" />
            {/* back arm resting */}
            <line x1="330" y1="119" x2="342" y2="132" />
            {/* shutter arm — presses during Shoot */}
            <g>
              {phase === 1 && !reduced && (
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  values="0 330 119; 16 330 119; 0 330 119"
                  dur="0.7s"
                  repeatCount="2"
                />
              )}
              <line x1="330" y1="119" x2="314" y2="124" />
            </g>
          </g>

          {/* tripod + camera */}
          <g stroke={STICK} strokeWidth="2">
            <line x1="305" y1="132" x2="297" y2="168" />
            <line x1="305" y1="132" x2="305" y2="168" />
            <line x1="305" y1="132" x2="313" y2="168" />
          </g>
          <rect x="295" y="118" width="20" height="13" rx="3" fill="#0B0E14" stroke="#A78BFA" strokeWidth="2.5" />
          <circle cx="302" cy="124.5" r="3" stroke="#A78BFA" strokeWidth="2" />
        </motion.g>

        {/* drone sweeping the roofline during the shoot */}
        <AnimatePresence>
          {phase === 1 && !reduced && (
            <motion.g
              key="drone"
              initial={{ x: 95, y: 0, opacity: 0 }}
              animate={{ x: [95, 30, -30, -95], y: [0, -5, 3, -4], opacity: [0, 1, 1, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.6, times: [0, 0.3, 0.7, 1], ease: "easeInOut" }}
            >
              {/* body + camera */}
              <rect x="192" y="56" width="16" height="6" rx="2" fill="#0B0E14" stroke="#A78BFA" strokeWidth="2" />
              <line x1="198" y1="62" x2="198" y2="65" stroke="#A78BFA" strokeWidth="1.5" />
              <circle cx="200" cy="66.5" r="1.8" stroke="#A78BFA" strokeWidth="1.5" />
              {/* arms */}
              <line x1="192" y1="58" x2="184" y2="54" stroke={STICK} strokeWidth="1.8" />
              <line x1="208" y1="58" x2="216" y2="54" stroke={STICK} strokeWidth="1.8" />
              {/* spinning props (flicker blur) */}
              <motion.ellipse
                cx="184" cy="53" rx="6" ry="1.6" stroke={STICK} strokeWidth="1.2"
                animate={{ opacity: [0.25, 0.9, 0.25] }}
                transition={{ duration: 0.18, repeat: Infinity }}
              />
              <motion.ellipse
                cx="216" cy="53" rx="6" ry="1.6" stroke={STICK} strokeWidth="1.2"
                animate={{ opacity: [0.9, 0.25, 0.9] }}
                transition={{ duration: 0.18, repeat: Infinity }}
              />
            </motion.g>
          )}
        </AnimatePresence>

        {/* camera flash */}
        {phase === 1 && !reduced && (
          <motion.g key={`flash-${phase}`}>
            <motion.circle
              cx="292" cy="124" r="10"
              fill="#FFFFFF"
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: [0, 0.9, 0], scale: [0.3, 1.8, 2.6] }}
              transition={{ duration: 0.7, delay: 0.25, times: [0, 0.3, 1] }}
            />
            {[0, 45, 90, 135].map((a) => (
              <motion.line
                key={a}
                x1="292" y1="124" x2="292" y2="106"
                stroke="#FFFFFF"
                strokeWidth="2"
                transform={`rotate(${a} 292 124)`}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.8, 0] }}
                transition={{ duration: 0.5, delay: 0.3 }}
              />
            ))}
          </motion.g>
        )}

        {/* photos flying to the realtor during Delivered */}
        {phase === 2 &&
          [0, 1, 2].map((i) => (
            <motion.g
              key={`photo-${i}`}
              initial={{ x: 0, y: 0, opacity: 0 }}
              animate={{
                x: [0, -70, -150, -204],
                y: [0, -34, -30, 4],
                opacity: [0, 1, 1, 0],
                rotate: [0, -8, 6, 0],
              }}
              transition={{ duration: 1.7, delay: 0.15 + i * 0.3, times: [0, 0.35, 0.75, 1], ease: "easeInOut" }}
            >
              <rect x="296" y="112" width="15" height="11" rx="2" fill="#0D1320" stroke="#60A5FA" strokeWidth="1.5" />
              <circle cx="300.5" cy="116" r="1.5" fill="#60A5FA" />
              <path d="M 297.5 120.5 l 4 -3.5 l 3 2.5 l 3 -4 l 3 5" stroke="#60A5FA" strokeWidth="1.2" />
            </motion.g>
          ))}

        {/* coin arcing back during Paid */}
        {phase === 3 && (
          <motion.g
            key="coin"
            initial={{ x: 0, y: 0, opacity: 0 }}
            animate={{ x: [0, 90, 180, 228], y: [0, -46, -40, 0], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.1, delay: 0.1, times: [0, 0.35, 0.75, 1], ease: "easeInOut" }}
          >
            <circle cx="90" cy="122" r="7" fill="#0D1320" stroke="#FBBF24" strokeWidth="2" />
            <text x="90" y="125.5" textAnchor="middle" fill="#FBBF24" fontSize="9" fontWeight="800" fontFamily="Inter, sans-serif">
              $
            </text>
          </motion.g>
        )}

        {/* SOLD sign plants in the yard once the money lands */}
        <AnimatePresence>
          {phase === 3 && (
            <motion.g
              key="sold"
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ type: "spring", stiffness: 240, damping: 15, delay: 0.85 }}
            >
              <line x1="134" y1="176" x2="134" y2="150" stroke={STICK} strokeWidth="2.5" />
              <rect x="114" y="130" width="40" height="20" rx="2.5" fill="#0D1320" stroke="#34D399" strokeWidth="2" />
              <text
                x="134" y="144" textAnchor="middle"
                fill="#34D399" fontSize="10" fontWeight="800" letterSpacing="1.5"
                fontFamily="Inter, sans-serif"
              >
                SOLD
              </text>
            </motion.g>
          )}
        </AnimatePresence>

        {/* PAID chip above the photographer */}
        <AnimatePresence>
          {phase === 3 && (
            <motion.g
              initial={{ opacity: 0, y: 8, scale: 0.7 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 280, damping: 18, delay: 0.85 }}
            >
              <rect x="306" y="66" width="50" height="24" rx="7" fill="#0D1320" stroke="rgba(52,211,153,0.55)" strokeWidth="1.5" />
              <text x="331" y="82" textAnchor="middle" fill="#6EE7B7" fontSize="9" fontWeight="800" fontFamily="Inter, sans-serif">
                PAID
              </text>
            </motion.g>
          )}
        </AnimatePresence>
      </svg>

      {/* caption */}
      <div className="flex items-center justify-center mt-1 h-7">
        <AnimatePresence mode="wait">
          <motion.span
            key={reduced ? "static" : phase}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="text-sm font-semibold text-gray-400 bg-white/[0.04] border border-white/[0.08] rounded-full px-4 py-1.5"
          >
            {reduced ? "Booked → Shoot → Delivered → Paid" : CAPTIONS[phase]}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* progress dots */}
      <div className="flex items-center justify-center gap-2 mt-3">
        {CAPTIONS.map((_, i) => (
          <motion.span
            key={i}
            animate={{
              scale: phase === i ? 1.3 : 1,
              backgroundColor: phase === i ? "rgba(96,165,250,0.9)" : "rgba(255,255,255,0.15)",
            }}
            transition={{ duration: 0.3 }}
            className="w-2 h-2 rounded-full"
          />
        ))}
      </div>
    </div>
  );
}
