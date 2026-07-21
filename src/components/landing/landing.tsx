"use client";

/**
 * Scalist marketing site v2 — dark, cinematic, product-forward.
 * Hero: kinetic headline synced to a living product demo, with a parallax
 * cloud of floating product moments around it. Everything below reveals on
 * scroll. No images required — every visual is built from the product's UI.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";
import {
  Camera,
  CalendarDays,
  MapPin,
  CreditCard,
  ImageIcon,
  Users,
  Smartphone,
  BellRing,
  ArrowRight,
  CheckCircle2,
  Zap,
  Building2,
  Route,
  Star,
  ShieldCheck,
  Clock4,
} from "lucide-react";
import { LiveDemo, DEMO_PHASES } from "./live-demo";

const PHASE_MS = 2800;

// ─── Shared helpers ──────────────────────────────────────────────────────────

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.6, delay, ease: [0.21, 0.65, 0.32, 0.95] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: React.ReactNode;
  sub?: string;
}) {
  return (
    <Reveal className="text-center max-w-2xl mx-auto mb-14">
      <p className="text-xs font-bold tracking-[0.2em] uppercase text-blue-400/90 mb-3">{eyebrow}</p>
      <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight">{title}</h2>
      {sub && <p className="text-gray-400 mt-4 leading-relaxed">{sub}</p>}
    </Reveal>
  );
}

// ─── Floating parallax chips around the hero demo ────────────────────────────

function FloatingChip({
  mx,
  my,
  depth,
  drift = 10,
  className,
  children,
}: {
  mx: MotionValue<number>;
  my: MotionValue<number>;
  depth: number;
  drift?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const x = useTransform(mx, (v) => v * depth);
  const y = useTransform(my, (v) => v * depth);
  return (
    <motion.div style={{ x, y }} className={`absolute hidden lg:block ${className ?? ""}`}>
      <motion.div
        animate={{ y: [0, -drift, 0] }}
        transition={{ duration: 5 + depth / 14, repeat: Infinity, ease: "easeInOut" }}
        className="rounded-xl border border-white/10 bg-[#0D1117]/90 backdrop-blur px-3.5 py-2.5 shadow-2xl shadow-black/50"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function Hero() {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (reduced) {
      setPhase(3);
      return;
    }
    const id = setInterval(() => setPhase((p) => (p + 1) % DEMO_PHASES.length), PHASE_MS);
    return () => clearInterval(id);
  }, [reduced]);

  // mouse parallax
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const smx = useSpring(mx, { stiffness: 60, damping: 20 });
  const smy = useSpring(my, { stiffness: 60, damping: 20 });
  const heroRef = useRef<HTMLDivElement>(null);

  const onMouseMove = (e: React.MouseEvent) => {
    const el = heroRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width - 0.5) * 30);
    my.set(((e.clientY - r.top) / r.height - 0.5) * 30);
  };

  return (
    <section
      ref={heroRef}
      onMouseMove={onMouseMove}
      className="relative pt-32 pb-20 px-6 overflow-hidden"
    >
      {/* ambient glows */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full bg-blue-600/[0.14] blur-[140px]" />
      <div className="pointer-events-none absolute top-64 -left-40 w-[420px] h-[420px] rounded-full bg-violet-600/[0.1] blur-[120px]" />

      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-14 items-center relative">
        {/* ── copy ── */}
        <div>
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-400/25 bg-blue-500/10 px-3.5 py-1.5 text-xs font-semibold text-blue-300">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Built for real estate photography studios
            </span>
          </Reveal>

          <h1 className="mt-6 text-5xl md:text-6xl font-black tracking-tight leading-[1.05]">
            {DEMO_PHASES.map((word, i) => (
              <motion.span
                key={word}
                animate={{
                  opacity: phase === i ? 1 : 0.35,
                }}
                transition={{ duration: 0.4 }}
                className={
                  phase === i
                    ? "bg-gradient-to-r from-blue-400 via-violet-400 to-blue-300 bg-clip-text text-transparent"
                    : "text-white"
                }
              >
                {word}
                {i < DEMO_PHASES.length - 1 ? " " : ""}
              </motion.span>
            ))}
          </h1>

          <Reveal delay={0.15}>
            <p className="mt-6 text-lg text-gray-400 leading-relaxed max-w-md">
              Scalist runs the bookings, scheduling, delivery, and payments for your
              studio — so the only thing left on your plate is the shoot.
            </p>
          </Reveal>

          <Reveal delay={0.25} className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-900/40 hover:shadow-blue-800/50 transition-shadow"
            >
              Start free — 14 days
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-6 py-3.5 text-sm font-semibold text-gray-300 hover:bg-white/5 transition-colors"
            >
              See how it works
            </a>
          </Reveal>

          <Reveal delay={0.35}>
            <p className="mt-6 text-xs text-gray-600">
              No credit card required · Set up in minutes · Cancel any time
            </p>
          </Reveal>
        </div>

        {/* ── living demo + parallax cloud ── */}
        <div className="relative">
          <motion.div
            initial={{ opacity: 0, y: 30, rotateX: 8 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 0.8, ease: [0.21, 0.65, 0.32, 0.95] }}
            style={{ perspective: 1200 }}
          >
            <LiveDemo phase={phase} />
          </motion.div>

          <FloatingChip mx={smx} my={smy} depth={0.9} className="-top-8 -left-10">
            <div className="flex items-center gap-2 text-[11px] text-gray-300">
              <Route className="w-3.5 h-3.5 text-emerald-400" />
              <span><b className="text-white">12.4 km</b> auto-logged</span>
            </div>
          </FloatingChip>

          <FloatingChip mx={smx} my={smy} depth={1.6} drift={14} className="-bottom-7 -left-6">
            <div className="flex items-center gap-2 text-[11px] text-gray-300">
              <Clock4 className="w-3.5 h-3.5 text-blue-400" />
              <span>Client moved shoot to <b className="text-white">Thu 2:00</b> — no phone call</span>
            </div>
          </FloatingChip>

          <FloatingChip mx={smx} my={smy} depth={1.2} drift={8} className="-top-5 -right-8">
            <div className="flex items-center gap-2 text-[11px] text-gray-300">
              <CalendarDays className="w-3.5 h-3.5 text-violet-400" />
              <span>Google Calendar synced</span>
            </div>
          </FloatingChip>

          <FloatingChip mx={smx} my={smy} depth={2.1} drift={12} className="-bottom-10 -right-4">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-300">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />
              ))}
              <span className="ml-1">same-day delivery</span>
            </div>
          </FloatingChip>
        </div>
      </div>
    </section>
  );
}

// ─── Marquee ─────────────────────────────────────────────────────────────────

const MARQUEE = [
  "Travel-aware scheduling",
  "Time-zone correct slots",
  "Double-booking impossible",
  "Invoice on delivery",
  "Client self-reschedule",
  "Protected gallery links",
  "Auto mileage tracking",
  "Stripe payments",
  "Booking pages",
  "Team roles & mobile app",
];

function Marquee() {
  const items = MARQUEE.concat(MARQUEE);
  return (
    <div className="relative py-6 border-y border-white/[0.05] overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#070A0F] to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#070A0F] to-transparent z-10" />
      <motion.div
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 36, repeat: Infinity, ease: "linear" }}
        className="flex gap-10 whitespace-nowrap w-max"
      >
        {items.map((t, i) => (
          <span key={i} className="flex items-center gap-2.5 text-sm text-gray-500">
            <span className="w-1 h-1 rounded-full bg-blue-500/60" />
            {t}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

// ─── How it works ────────────────────────────────────────────────────────────

const STEPS = [
  {
    icon: <Camera className="w-5 h-5" />,
    title: "Share one link",
    body: "Clients book from your branded page. The engine only offers times that actually work — package length, travel between jobs, your hours, your photographers' calendars.",
    accent: "from-blue-500 to-sky-500",
  },
  {
    icon: <MapPin className="w-5 h-5" />,
    title: "Shoot, don't shuffle",
    body: "Assignments, drive buffers, and day plans handle themselves. Your team clocks in from their phone — time and mileage log automatically for payroll.",
    accent: "from-violet-500 to-blue-500",
  },
  {
    icon: <CreditCard className="w-5 h-5" />,
    title: "Deliver and get paid",
    body: "Publish the gallery and the invoice sends itself — downloads unlock when payment lands. No chasing, no spreadsheets, no forgotten invoices.",
    accent: "from-emerald-500 to-blue-500",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="py-28 px-6">
      <div className="max-w-5xl mx-auto">
        <SectionHeading
          eyebrow="How it works"
          title={<>Three steps. Zero admin days.</>}
          sub="The entire job — from a realtor clicking your link to money in your account — runs on one rail."
        />
        <div className="grid md:grid-cols-3 gap-5">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.12}>
              <div className="group relative rounded-2xl border border-white/[0.07] bg-white/[0.02] p-7 h-full hover:border-white/[0.14] transition-colors">
                <span className="absolute top-6 right-7 text-5xl font-black text-white/[0.04] group-hover:text-white/[0.07] transition-colors">
                  {i + 1}
                </span>
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${s.accent} flex items-center justify-center text-white mb-5 shadow-lg shadow-black/40`}>
                  {s.icon}
                </div>
                <h3 className="font-bold text-white text-lg mb-2.5">{s.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Bento feature grid ──────────────────────────────────────────────────────

// One route per photographer: path, colors, timing, stop dots, and one label chip.
const ROUTES = [
  {
    id: "AR",
    d: "M 56 214 L 56 152 Q 56 144 64 144 L 236 144 Q 244 144 244 136 L 244 84 Q 244 76 252 76 L 420 76 Q 428 76 428 68 L 428 48 L 566 48",
    stroke: "url(#routeGradA)",
    glow: "#3B82F6",
    dot: "#60A5FA",
    dur: "7s",
    begin: "0s",
    stops: [
      { cx: 56, cy: 214 },
      { cx: 244, cy: 112 },
      { cx: 566, cy: 48 },
    ],
    chip: { left: "4%", top: "72%", t: "9:30 AM", cls: "border-blue-400/40", icon: "text-blue-400" },
  },
  {
    id: "JM",
    d: "M 92 34 L 92 96 Q 92 104 100 104 L 198 104 Q 206 104 206 112 L 206 190 Q 206 198 214 198 L 332 198",
    stroke: "#34D399",
    glow: "#34D399",
    dot: "#6EE7B7",
    dur: "8.5s",
    begin: "1.4s",
    stops: [
      { cx: 92, cy: 34 },
      { cx: 206, cy: 152 },
      { cx: 332, cy: 198 },
    ],
    chip: { left: "10%", top: "6%", t: "10:00 AM", cls: "border-emerald-400/40", icon: "text-emerald-400" },
  },
  {
    id: "KL",
    d: "M 610 226 L 520 226 Q 512 226 512 218 L 512 150 Q 512 142 504 142 L 380 142 Q 372 142 372 134 L 372 104",
    stroke: "#F59E0B",
    glow: "#F59E0B",
    dot: "#FCD34D",
    dur: "6s",
    begin: "0.7s",
    stops: [
      { cx: 610, cy: 226 },
      { cx: 512, cy: 184 },
      { cx: 372, cy: 104 },
    ],
    chip: { left: "76%", top: "76%", t: "11:45 AM", cls: "border-amber-400/40", icon: "text-amber-400" },
  },
];

function SchedulingVisual() {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  // Dark Mapbox static map of Edmonton — real roads under the routes.
  const mapUrl = token
    ? `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/-113.4938,53.5432,12,0/640x256@2x?access_token=${token}`
    : null;

  return (
    <div className="mt-6 relative h-48 rounded-xl border border-white/[0.06] overflow-hidden bg-[#0A0D13]">
      {/* fallback street grid (visible until/unless the real map loads) */}
      <svg viewBox="0 0 640 256" className="absolute inset-0 w-full h-full opacity-60" fill="none" aria-hidden>
        {[32, 76, 120, 164, 208].map((y) => (
          <line key={`h${y}`} x1="0" y1={y} x2="640" y2={y} stroke="#1a2130" strokeWidth="3" />
        ))}
        {[80, 170, 260, 350, 440, 530].map((x) => (
          <line key={`v${x}`} x1={x} y1="0" x2={x} y2="256" stroke="#1a2130" strokeWidth="3" />
        ))}
        <line x1="0" y1="236" x2="640" y2="150" stroke="#202a3d" strokeWidth="5" />
      </svg>

      {/* real Edmonton roads */}
      {mapUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mapUrl}
          alt="Map of Edmonton with three photographers' routes"
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
      )}
      {/* darken + tint so the routes pop on any map */}
      <div className="absolute inset-0 bg-[#070A0F]/45" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#070A0F] via-transparent to-transparent opacity-70" />

      {/* animated routes — one per photographer, each with its own car */}
      <svg viewBox="0 0 640 256" className="absolute inset-0 w-full h-full" fill="none">
        <defs>
          <linearGradient id="routeGradA" x1="0" y1="256" x2="640" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3B82F6" />
            <stop offset="1" stopColor="#A78BFA" />
          </linearGradient>
        </defs>
        {ROUTES.map((r, ri) => (
          <g key={r.id}>
            <motion.path
              d={r.d}
              stroke={r.glow}
              strokeOpacity="0.3"
              strokeWidth="7"
              strokeLinecap="round"
              filter="blur(4px)"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.6, ease: "easeInOut", delay: 0.3 + ri * 0.45 }}
            />
            <motion.path
              d={r.d}
              stroke={r.stroke}
              strokeWidth="2.5"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.6, ease: "easeInOut", delay: 0.3 + ri * 0.45 }}
            />
            {r.stops.map((s, si) => (
              <motion.circle
                key={si}
                cx={s.cx}
                cy={s.cy}
                r="3.5"
                fill="#0B0E14"
                stroke={r.dot}
                strokeWidth="2"
                initial={{ scale: 0, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 + ri * 0.45 + si * 0.25, type: "spring", stiffness: 320, damping: 16 }}
              />
            ))}
            {/* the photographer, driving their route on loop */}
            <circle r="4" fill="#fff">
              <animateMotion dur={r.dur} begin={r.begin} repeatCount="indefinite" path={r.d} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
            </circle>
            <circle r="8.5" fill={r.dot} opacity="0.25">
              <animateMotion dur={r.dur} begin={r.begin} repeatCount="indefinite" path={r.d} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
            </circle>
          </g>
        ))}
      </svg>

      {/* one next-stop chip per photographer */}
      {ROUTES.map((r, i) => (
        <motion.div
          key={r.id}
          initial={{ scale: 0, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.7 + i * 0.35, type: "spring", stiffness: 300, damping: 18 }}
          style={{ left: r.chip.left, top: r.chip.top }}
          className={`absolute flex items-center gap-1 rounded-full bg-[#0D1320]/95 border px-2 py-0.5 shadow-lg shadow-black/40 ${r.chip.cls}`}
        >
          <MapPin className={`w-2.5 h-2.5 ${r.chip.icon}`} />
          <span className="text-[9px] font-bold text-white whitespace-nowrap">{r.chip.t}</span>
        </motion.div>
      ))}

      {/* captions + photographer legend */}
      <span className="absolute top-2.5 left-3 text-[9px] font-semibold text-gray-400 bg-[#0D1320]/80 border border-white/10 rounded-full px-2 py-0.5">
        Edmonton · today&apos;s routes
      </span>
      <div className="absolute top-2.5 right-3 flex items-center gap-1.5 bg-[#0D1320]/85 border border-white/10 rounded-full pl-1 pr-2.5 py-0.5">
        <div className="flex -space-x-1.5">
          {[
            ["AR", "from-blue-500 to-violet-500"],
            ["JM", "from-emerald-500 to-teal-600"],
            ["KL", "from-amber-500 to-orange-600"],
          ].map(([initials, grad]) => (
            <span
              key={initials}
              className={`w-4 h-4 rounded-full bg-gradient-to-br ${grad} border border-[#0D1320] flex items-center justify-center text-[6.5px] font-bold text-white`}
            >
              {initials}
            </span>
          ))}
        </div>
        <span className="text-[9px] font-semibold text-gray-300">3 photographers · 9 stops</span>
      </div>
      <span className="absolute bottom-2.5 right-3 text-[9px] font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-400/20 rounded-full px-2 py-0.5">
        travel buffers auto-added
      </span>
    </div>
  );
}

function PortalVisual() {
  return (
    <div className="mt-6 rounded-xl bg-white/[0.02] border border-white/[0.05] p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[11px] font-semibold text-white">128 Maple Ave NW</p>
          <p className="text-[9px] text-gray-500">Thu · 9:30 AM · Confirmed</p>
        </div>
        <motion.span
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="text-[10px] font-semibold text-gray-200 border border-white/15 rounded-lg px-2.5 py-1.5"
        >
          Reschedule
        </motion.span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
        <motion.div
          initial={{ width: "0%" }}
          whileInView={{ width: "72%" }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, delay: 0.4, ease: "easeOut" }}
          className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full"
        />
      </div>
      <p className="text-[9px] text-gray-500 mt-1.5">Booked → Shoot → Delivery</p>
    </div>
  );
}

const FEATURES: {
  icon: React.ReactNode;
  title: string;
  body: string;
  span?: string;
  visual?: React.ReactNode;
}[] = [
  {
    icon: <CalendarDays className="w-[18px] h-[18px]" />,
    title: "A scheduling engine that knows the map",
    body: "Slots account for package duration, drive time between properties, photographer territories, time off, and calendar conflicts — before a client ever sees them. Double-booking isn't a risk you manage; it's a thing that can't happen.",
    span: "md:col-span-2",
    visual: <SchedulingVisual />,
  },
  {
    icon: <Users className="w-[18px] h-[18px]" />,
    title: "A portal clients actually use",
    body: "Realtors track shoots, pay invoices, download photos, message you, and reschedule themselves — within the rules you set.",
    visual: <PortalVisual />,
  },
  {
    icon: <Camera className="w-[18px] h-[18px]" />,
    title: "Branded booking pages",
    body: "Your services, packages, and add-ons on a page that sells for you — with deposits and territory rules built in.",
  },
  {
    icon: <ImageIcon className="w-[18px] h-[18px]" />,
    title: "Galleries with a paywall",
    body: "Password-protected delivery with signed links. Downloads unlock when the invoice is paid — automatically.",
  },
  {
    icon: <CreditCard className="w-[18px] h-[18px]" />,
    title: "Invoices that send themselves",
    body: "Deliver a job and the invoice goes out at the agreed package price, with a one-click Stripe pay link.",
  },
  {
    icon: <Smartphone className="w-[18px] h-[18px]" />,
    title: "A field app for your team",
    body: "Photographers see their day, clock in and out, and mileage logs itself from job to job. Payroll-ready records, zero data entry.",
  },
  {
    icon: <BellRing className="w-[18px] h-[18px]" />,
    title: "Comms on autopilot",
    body: "Confirmations, reminders, reschedules, delivery notices — tracked in an outbox with retries, so nothing silently fails.",
  },
  {
    icon: <ShieldCheck className="w-[18px] h-[18px]" />,
    title: "Roles & access control",
    body: "Owners, editors, photographers, drone pilots — everyone sees exactly what they should, including revocable client access.",
  },
];

// ─── Stick-figure journey strip above the platform heading ───────────────────
// The realtor (left) and photographer (right) trade the job across the line:
// booking travels right → flash → photos travel back left → coin travels right.

const STRIP_PATH = "M 96 84 C 300 58, 600 58, 804 84";
const STRIP_MS = 2600;

function PlatformStrip() {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setPhase((p) => (p + 1) % 4), STRIP_MS);
    return () => clearInterval(id);
  }, [reduced]);

  const stick = "#E2E8F0";

  return (
    <Reveal className="max-w-4xl mx-auto mb-2">
      <svg viewBox="0 0 900 130" className="w-full" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* the line between booked and paid */}
        <path d={STRIP_PATH} stroke="rgba(255,255,255,0.14)" strokeWidth="2" strokeDasharray="1 8" />

        {/* ── realtor (left) ── */}
        <g stroke={stick} strokeWidth="2.2">
          <circle cx="62" cy="58" r="6.5" />
          <line x1="62" y1="65" x2="62" y2="92" />
          <line x1="62" y1="68" x2="62" y2="76" stroke="#60A5FA" strokeWidth="2.6" />
          <line x1="62" y1="92" x2="54" y2="112" />
          <line x1="62" y1="92" x2="70" y2="112" />
          <line x1="62" y1="71" x2="50" y2="82" />
          <g>
            {phase === 0 && !reduced && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                values="0 62 71; -12 62 71; 0 62 71; -12 62 71; 0 62 71"
                dur="1.4s"
                repeatCount="indefinite"
              />
            )}
            <line x1="62" y1="71" x2="76" y2="77" />
            <rect x="74" y="70" width="7" height="11" rx="1.8" fill="#0B0E14" stroke="#60A5FA" strokeWidth="1.8" />
          </g>
        </g>

        {/* ── photographer + tripod (right) ── */}
        <motion.g
          animate={phase === 3 && !reduced ? { y: [0, -7, 0, -4, 0] } : { y: 0 }}
          transition={{ duration: 0.85, times: [0, 0.25, 0.5, 0.75, 1], delay: 0.8 }}
        >
          <g stroke={stick} strokeWidth="2.2">
            <circle cx="842" cy="56" r="6.5" />
            <line x1="842" y1="63" x2="842" y2="91" />
            <line x1="842" y1="91" x2="834" y2="112" />
            <line x1="842" y1="91" x2="850" y2="112" />
            <line x1="842" y1="69" x2="853" y2="80" />
            <g>
              {phase === 1 && !reduced && (
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  values="0 842 69; 15 842 69; 0 842 69"
                  dur="0.65s"
                  repeatCount="2"
                />
              )}
              <line x1="842" y1="69" x2="828" y2="74" />
            </g>
          </g>
          <g stroke={stick} strokeWidth="1.8">
            <line x1="820" y1="80" x2="813" y2="112" />
            <line x1="820" y1="80" x2="820" y2="112" />
            <line x1="820" y1="80" x2="827" y2="112" />
          </g>
          <rect x="811" y="68" width="18" height="12" rx="2.5" fill="#0B0E14" stroke="#A78BFA" strokeWidth="2.2" />
          <circle cx="817.5" cy="74" r="2.6" stroke="#A78BFA" strokeWidth="1.8" />
        </motion.g>

        {/* flash at the photographer */}
        {phase === 1 && !reduced && (
          <motion.circle
            key="strip-flash"
            cx="806" cy="73" r="9"
            fill="#FFFFFF"
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: [0, 0.85, 0], scale: [0.3, 1.7, 2.4] }}
            transition={{ duration: 0.65, delay: 0.2, times: [0, 0.3, 1] }}
          />
        )}

        {/* travelers along the line */}
        {/* 0: booking chip → right */}
        {phase === 0 && !reduced && (
          <g key="t-booking">
            <animateMotion dur="2.3s" fill="freeze" path={STRIP_PATH} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
            <rect x="-16" y="-11" width="32" height="16" rx="5" fill="#0D1320" stroke="rgba(96,165,250,0.55)" strokeWidth="1.4" />
            <path d="M -9 -3.5 l 3 3 l 5 -6" stroke="#34D399" strokeWidth="2" />
            <circle cx="6" cy="-3" r="0.8" fill="#60A5FA" />
          </g>
        )}
        {/* 2: photo prints → left */}
        {phase === 2 &&
          !reduced &&
          [0, 1, 2].map((i) => (
            <g key={`t-photo-${i}`} opacity={1 - i * 0.15}>
              <animateMotion
                dur="2.2s"
                begin={`${i * 0.22}s`}
                fill="freeze"
                path={STRIP_PATH}
                keyPoints="1;0"
                keyTimes="0;1"
                calcMode="linear"
              />
              <rect x="-8" y="-7" width="16" height="12" rx="2" fill="#0D1320" stroke="#60A5FA" strokeWidth="1.4" />
              <path d="M -5 2 l 4 -4 l 3 2.5 l 3 -4" stroke="#60A5FA" strokeWidth="1.2" />
            </g>
          ))}
        {/* 3: coin → right */}
        {phase === 3 && !reduced && (
          <g key="t-coin">
            <animateMotion dur="1.8s" fill="freeze" path={STRIP_PATH} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
            <circle r="7.5" fill="#0D1320" stroke="#FBBF24" strokeWidth="2" />
            <text y="3.5" textAnchor="middle" fill="#FBBF24" fontSize="9.5" fontWeight="800" fontFamily="Inter, sans-serif">
              $
            </text>
          </g>
        )}

        {/* end-of-loop PAID pop */}
        <AnimatePresence>
          {phase === 3 && (
            <motion.g
              key="strip-paid"
              initial={{ opacity: 0, y: 6, scale: 0.7 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: "spring", stiffness: 280, damping: 18, delay: 1.5 }}
            >
              <rect x="818" y="18" width="48" height="22" rx="7" fill="#0D1320" stroke="rgba(52,211,153,0.55)" strokeWidth="1.4" />
              <text x="842" y="33" textAnchor="middle" fill="#6EE7B7" fontSize="9" fontWeight="800" fontFamily="Inter, sans-serif">
                PAID
              </text>
            </motion.g>
          )}
        </AnimatePresence>

        {/* booked chip over the realtor during phase 0 */}
        <AnimatePresence>
          {phase === 0 && (
            <motion.g
              key="strip-booked"
              initial={{ opacity: 0, y: 6, scale: 0.7 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: "spring", stiffness: 280, damping: 18 }}
            >
              <rect x="34" y="20" width="58" height="22" rx="7" fill="#0D1320" stroke="rgba(96,165,250,0.5)" strokeWidth="1.4" />
              <text x="63" y="35" textAnchor="middle" fill="#93C5FD" fontSize="9" fontWeight="800" fontFamily="Inter, sans-serif">
                BOOKED
              </text>
            </motion.g>
          )}
        </AnimatePresence>
      </svg>
    </Reveal>
  );
}

function Features() {
  return (
    <section id="features" className="py-28 px-6">
      <div className="max-w-6xl mx-auto">
        <PlatformStrip />
        <SectionHeading
          eyebrow="The platform"
          title={<>Everything between <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">booked</span> and <span className="bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">paid</span></>}
          sub="One system of record for jobs, clients, money, media, and your team — no duct-taped tool stack."
        />
        <div className="grid md:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 0.08} className={f.span}>
              <div className="group relative rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 h-full overflow-hidden hover:border-blue-400/25 transition-colors duration-300">
                <div className="pointer-events-none absolute -top-24 -right-24 w-48 h-48 rounded-full bg-blue-600/0 group-hover:bg-blue-600/[0.07] blur-3xl transition-colors duration-500" />
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-blue-400/20 flex items-center justify-center text-blue-300 mb-4">
                  {f.icon}
                </div>
                <h3 className="font-bold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.body}</p>
                {f.visual}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ─────────────────────────────────────────────────────────────────

const TIERS = [
  {
    name: "Starter",
    price: 39,
    tagline: "Solo photographers",
    icon: <Zap className="w-4 h-4" />,
    features: [
      "1 photographer account",
      "Up to 50 jobs / month",
      "Client portal & invoicing",
      "Gallery delivery",
      "Mobile app",
      "Email notifications",
    ],
  },
  {
    name: "Pro",
    price: 79,
    tagline: "Growing studios",
    icon: <Camera className="w-4 h-4" />,
    highlight: true,
    features: [
      "Up to 5 photographer accounts",
      "Unlimited jobs",
      "Online invoice payments",
      "Client booking page",
      "Brokerage group discounts",
      "Priority support",
    ],
  },
  {
    name: "Agency",
    price: 149,
    tagline: "Multi-photographer studios",
    icon: <Building2 className="w-4 h-4" />,
    features: [
      "Unlimited photographers",
      "Unlimited jobs",
      "Everything in Pro",
      "Custom branding",
      "Service territories",
      "Dedicated support",
    ],
  },
];

function Pricing() {
  return (
    <section id="pricing" className="py-28 px-6">
      <div className="max-w-5xl mx-auto">
        <SectionHeading
          eyebrow="Pricing"
          title="Less than one listing a month"
          sub="Every plan starts with 14 days free — full platform, no credit card."
        />
        <div className="grid md:grid-cols-3 gap-5 items-stretch">
          {TIERS.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.1}>
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className={`relative rounded-2xl p-px h-full ${
                  t.highlight
                    ? "bg-gradient-to-b from-blue-500 via-violet-500 to-blue-600"
                    : "bg-white/[0.07]"
                }`}
              >
                <div className="rounded-2xl bg-[#0B0E14] p-7 h-full flex flex-col">
                  {t.highlight && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-500 to-violet-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                      Most popular
                    </span>
                  )}
                  <div className="flex items-center gap-3 mb-5">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${t.highlight ? "bg-gradient-to-br from-blue-500 to-violet-500 text-white" : "bg-white/[0.06] text-blue-300"}`}>
                      {t.icon}
                    </div>
                    <div>
                      <p className="font-bold text-white">{t.name}</p>
                      <p className="text-xs text-gray-500">{t.tagline}</p>
                    </div>
                  </div>
                  <div className="mb-6">
                    <span className="text-4xl font-extrabold text-white">${t.price}</span>
                    <span className="text-gray-500 text-sm ml-1.5">/ month</span>
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-gray-400">
                        <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/register"
                    className={`text-center rounded-xl py-3 text-sm font-bold transition-colors ${
                      t.highlight
                        ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:opacity-95"
                        : "border border-white/10 text-gray-200 hover:bg-white/5"
                    }`}
                  >
                    Start free trial
                  </Link>
                </div>
              </motion.div>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <p className="text-center text-gray-600 text-xs mt-8">All prices in USD. Billed monthly. Cancel any time.</p>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Final CTA + footer ──────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section className="py-24 px-6">
      <Reveal className="max-w-3xl mx-auto">
        <div className="relative rounded-3xl border border-white/[0.08] px-8 py-16 text-center overflow-hidden">
          <motion.div
            aria-hidden
            animate={{ opacity: [0.55, 0.85, 0.55] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-violet-600/15 to-blue-600/10"
          />
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              Be one of the first studios on Scalist
            </h2>
            <p className="text-gray-400 mt-4 max-w-md mx-auto">
              We&apos;re onboarding a small group of real estate media teams right now —
              and building the roadmap around them.
            </p>
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 mt-8 rounded-xl bg-white text-gray-950 px-7 py-3.5 text-sm font-bold hover:bg-blue-50 transition-colors"
            >
              Claim your workspace
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/[0.05] py-10 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
            <Camera className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-white text-sm tracking-tight">Scalist</span>
          <span className="text-gray-600 text-xs ml-2">© {new Date().getFullYear()} · Made in Edmonton</span>
        </div>
        <div className="flex items-center gap-6 text-xs text-gray-500">
          <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-gray-300 transition-colors">Terms</Link>
          <a href="mailto:contact@scalist.io" className="hover:text-gray-300 transition-colors">contact@scalist.io</a>
          <Link href="/login" className="hover:text-gray-300 transition-colors">Sign in</Link>
        </div>
      </div>
    </footer>
  );
}

// ─── Nav ─────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <motion.nav
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06] backdrop-blur-xl bg-[#070A0F]/80"
    >
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
            <Camera className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white tracking-tight">Scalist</span>
        </Link>
        <div className="hidden md:flex items-center gap-7 text-sm text-gray-400">
          <a href="#how" className="hover:text-white transition-colors">How it works</a>
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors hidden sm:block">
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-white text-gray-950 px-4 py-2 text-sm font-bold hover:bg-blue-50 transition-colors"
          >
            Start free
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function Landing() {
  return (
    <div className="min-h-screen bg-[#070A0F] text-white antialiased selection:bg-blue-500/30">
      <Nav />
      <Hero />
      <Marquee />
      <HowItWorks />
      <Features />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  );
}
