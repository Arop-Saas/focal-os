import Link from "next/link";
import {
  Camera,
  Calendar,
  CreditCard,
  Image,
  Smartphone,
  Users,
  ArrowRight,
  CheckCircle,
  Zap,
  Building2,
  Star,
  Mail,
} from "lucide-react";

export const metadata = {
  title: "Scalist — Run your real estate photography business",
  description:
    "Scheduling, gallery delivery, client invoicing, and photographer management — all in one platform built for real estate photography studios.",
};

// ─── Reusable gradient text ───────────────────────────────────────────────────
function GradientText({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-blue-400 bg-clip-text text-transparent">
      {children}
    </span>
  );
}

// ─── Pricing tier card ────────────────────────────────────────────────────────
function PricingCard({
  name,
  price,
  tagline,
  features,
  highlight,
  icon,
}: {
  name: string;
  price: number;
  tagline: string;
  features: string[];
  highlight?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div
      className={`relative rounded-2xl p-px ${
        highlight
          ? "bg-gradient-to-b from-blue-500 via-violet-500 to-blue-600"
          : "bg-white/[0.06]"
      }`}
    >
      <div className="rounded-2xl bg-[#0d0d0d] p-7 h-full flex flex-col">
        {highlight && (
          <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-500 to-violet-500 text-white text-xs font-bold px-3 py-1 rounded-full">
            Most Popular
          </span>
        )}
        <div className="flex items-center gap-3 mb-5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              highlight
                ? "bg-gradient-to-br from-blue-500 to-violet-500 text-white"
                : "bg-white/[0.06] text-gray-400"
            }`}
          >
            {icon}
          </div>
          <div>
            <p className="font-bold text-white">{name}</p>
            <p className="text-xs text-gray-500">{tagline}</p>
          </div>
        </div>

        <div className="mb-6">
          <span className="text-4xl font-extrabold text-white">${price}</span>
          <span className="text-gray-500 text-sm ml-1.5">/ month</span>
        </div>

        <ul className="space-y-3 mb-8 flex-1">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm text-gray-400">
              <CheckCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              {f}
            </li>
          ))}
        </ul>

        <Link
          href="/register"
          className={`block text-center py-3 rounded-xl text-sm font-semibold transition-all ${
            highlight
              ? "bg-gradient-to-r from-blue-500 to-violet-500 text-white hover:opacity-90"
              : "bg-white/[0.06] text-white hover:bg-white/[0.1]"
          }`}
        >
          Start free trial
        </Link>
      </div>
    </div>
  );
}

// ─── Feature card ─────────────────────────────────────────────────────────────
function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group relative rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6 hover:bg-white/[0.05] hover:border-white/[0.1] transition-all">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-blue-500/20 flex items-center justify-center mb-4 text-blue-400">
        {icon}
      </div>
      <h3 className="font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-white font-sans antialiased">

      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06] backdrop-blur-xl bg-[#080808]/80">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
              <Camera className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white tracking-tight">scalist</span>
          </div>

          <div className="hidden md:flex items-center gap-6 text-sm text-gray-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors hidden sm:block">
              Sign in
            </Link>
            <Link
              href="/register"
              className="text-sm font-semibold bg-white text-black px-4 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Start free trial
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-blue-600/20 via-violet-600/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/[0.05] border border-white/[0.08] rounded-full px-4 py-1.5 text-xs text-gray-400 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Built for real estate photographers
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold leading-[1.05] tracking-tight mb-6">
            Run your photography
            <br />
            <GradientText>business on autopilot</GradientText>
          </h1>

          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed mb-10">
            From booking to delivery to getting paid — scalist handles every part of your real estate photography workflow so you can focus on shooting.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="group flex items-center gap-2 bg-gradient-to-r from-blue-500 to-violet-500 text-white font-semibold px-7 py-3.5 rounded-xl hover:opacity-90 transition-all text-sm"
            >
              Start your 14-day free trial
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <a
              href="#how-it-works"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm font-medium"
            >
              See how it works
            </a>
          </div>

          <p className="text-xs text-gray-600 mt-4">No credit card required · Cancel anytime</p>
        </div>

        {/* Mock dashboard preview */}
        <div className="relative max-w-5xl mx-auto mt-16">
          <div className="rounded-2xl border border-white/[0.08] bg-[#0d0d0d] overflow-hidden shadow-2xl shadow-black/60">
            {/* Fake window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-[#111111]">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
              <div className="flex-1 flex justify-center">
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-md px-16 py-1 text-[10px] text-gray-600">
                  app.scalist.io
                </div>
              </div>
            </div>

            {/* Fake dashboard content */}
            <div className="p-6 flex gap-5 min-h-[260px]">
              {/* Fake sidebar */}
              <div className="w-44 shrink-0 space-y-1">
                {["Jobs", "Clients", "Invoices", "Gallery", "Team", "Settings"].map((item, i) => (
                  <div
                    key={item}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs ${
                      i === 0
                        ? "bg-white/[0.08] text-white font-medium"
                        : "text-gray-600"
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${i === 0 ? "bg-blue-400" : "bg-gray-700"}`} />
                    {item}
                  </div>
                ))}
              </div>

              {/* Fake main content */}
              <div className="flex-1 space-y-3">
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Jobs this month", value: "24", color: "from-blue-500/20 to-blue-600/5" },
                    { label: "Pending invoices", value: "$4,200", color: "from-violet-500/20 to-violet-600/5" },
                    { label: "Galleries delivered", value: "18", color: "from-emerald-500/20 to-emerald-600/5" },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className={`rounded-xl bg-gradient-to-br ${stat.color} border border-white/[0.06] p-4`}
                    >
                      <p className="text-[10px] text-gray-500 mb-1">{stat.label}</p>
                      <p className="text-xl font-bold text-white">{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* Fake job list */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-white/[0.05] text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                    Upcoming jobs
                  </div>
                  {[
                    { address: "142 Lakeview Crescent", client: "Sarah M.", time: "Today 10:00 AM", status: "Confirmed" },
                    { address: "88 Birchwood Ave", client: "James R.", time: "Tomorrow 2:00 PM", status: "Scheduled" },
                    { address: "310 Maple Drive", client: "Emma T.", time: "Thu 9:00 AM", status: "Scheduled" },
                  ].map((job) => (
                    <div key={job.address} className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04] last:border-0">
                      <div>
                        <p className="text-[11px] font-medium text-white">{job.address}</p>
                        <p className="text-[10px] text-gray-600">{job.client} · {job.time}</p>
                      </div>
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">
                        {job.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Glow under the mockup */}
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-3/4 h-20 bg-blue-500/10 blur-3xl rounded-full" />
        </div>
      </section>

      {/* ── Social proof strip ─────────────────────────────────────────────── */}
      <section className="py-10 border-y border-white/[0.05] bg-white/[0.01]">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-6">Trusted by real estate photographers across North America</p>
          <div className="flex flex-wrap items-center justify-center gap-10 text-gray-700 text-sm font-semibold">
            {["Toronto", "Vancouver", "Austin", "Miami", "Chicago", "Phoenix"].map((city) => (
              <span key={city}>{city}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3">Everything in one place</p>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
              Stop juggling six different apps
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Scalist replaces your spreadsheets, Google Drive folder, Square invoices, and everything in between.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              icon={<Calendar className="w-5 h-5" />}
              title="Job scheduling"
              description="Book shoots, assign photographers, track status from confirmed to delivered — all in a clean calendar view."
            />
            <FeatureCard
              icon={<Image className="w-5 h-5" />}
              title="Gallery delivery"
              description="Upload photos and deliver a branded gallery link to clients instantly. Password protection, download controls, and payment gating included."
            />
            <FeatureCard
              icon={<CreditCard className="w-5 h-5" />}
              title="Online invoicing"
              description="Send professional invoices by email. Clients pay online via Stripe with a single click — no portal login required."
            />
            <FeatureCard
              icon={<Smartphone className="w-5 h-5" />}
              title="Photographer mobile app"
              description="Your photographers get a mobile app (no App Store needed) to clock in, view job details, upload photos, and add field notes."
            />
            <FeatureCard
              icon={<Users className="w-5 h-5" />}
              title="Team management"
              description="Invite photographers with a branded email, manage roles and access, and track hours per job — all without extra software."
            />
            <FeatureCard
              icon={<Mail className="w-5 h-5" />}
              title="Automated emails"
              description="Booking confirmations, shoot reminders, gallery-ready notifications, and payment receipts — sent automatically with your studio branding."
            />
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3">Simple workflow</p>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              From booking to payment in 3 steps
            </h2>
          </div>

          <div className="relative space-y-6">
            {/* Connector line */}
            <div className="absolute left-[27px] top-14 bottom-14 w-px bg-gradient-to-b from-blue-500/40 via-violet-500/40 to-blue-500/40 hidden md:block" />

            {[
              {
                num: "01",
                title: "Book the shoot",
                description:
                  "Client books through your online booking page or you create the job manually. Photographer gets assigned automatically and receives their schedule in the mobile app.",
                color: "from-blue-500/30 to-blue-600/10",
              },
              {
                num: "02",
                title: "Shoot & deliver",
                description:
                  "Your photographer clocks in on the mobile app, shoots the property, and uploads directly from their phone. You review and publish the gallery — client gets a notification email instantly.",
                color: "from-violet-500/30 to-violet-600/10",
              },
              {
                num: "03",
                title: "Get paid",
                description:
                  "Invoice is created from the job automatically. Send it with one click — the client gets an email with a Pay Now button. Payment hits your Stripe account the same day.",
                color: "from-blue-500/30 to-blue-600/10",
              },
            ].map((step) => (
              <div key={step.num} className="flex gap-6 items-start">
                <div
                  className={`shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br ${step.color} border border-white/[0.08] flex items-center justify-center`}
                >
                  <span className="text-xs font-bold text-white/60">{step.num}</span>
                </div>
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 flex-1">
                  <h3 className="font-bold text-white text-lg mb-2">{step.title}</h3>
                  <p className="text-gray-500 leading-relaxed text-sm">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              quote: "I used to spend 3 hours every Monday just on admin — invoices, emails, chasing payments. Now it's automatic.",
              name: "Marcus T.",
              title: "Solo photographer, Toronto",
            },
            {
              quote: "The gallery delivery alone is worth it. Clients love getting a clean link with their branding, and I love that they can pay right there.",
              name: "Priya S.",
              title: "Photography studio owner, Vancouver",
            },
            {
              quote: "I have 4 photographers on my team. Coordinating schedules used to be a nightmare. Now they just open the app.",
              name: "Derek L.",
              title: "Agency owner, Austin",
            },
          ].map((t) => (
            <div
              key={t.name}
              className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 flex flex-col gap-4"
            >
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-gray-400 text-sm leading-relaxed flex-1">&ldquo;{t.quote}&rdquo;</p>
              <div>
                <p className="text-white text-sm font-semibold">{t.name}</p>
                <p className="text-gray-600 text-xs">{t.title}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3">Simple pricing</p>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
              Start free, grow at your pace
            </h2>
            <p className="text-gray-500">14-day free trial on every plan. No credit card required to start.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
            <PricingCard
              name="Starter"
              price={39}
              tagline="Solo photographers"
              icon={<Zap className="w-4 h-4" />}
              features={[
                "1 photographer account",
                "Up to 50 jobs / month",
                "Client portal & invoicing",
                "Gallery delivery",
                "Mobile app",
                "Email notifications",
              ]}
            />
            <PricingCard
              name="Pro"
              price={79}
              tagline="Growing studios"
              icon={<Camera className="w-4 h-4" />}
              highlight
              features={[
                "Up to 5 photographer accounts",
                "Unlimited jobs",
                "Online invoice payments",
                "Client booking page",
                "Brokerage group discounts",
                "Priority support",
              ]}
            />
            <PricingCard
              name="Agency"
              price={149}
              tagline="Multi-photographer studios"
              icon={<Building2 className="w-4 h-4" />}
              features={[
                "Unlimited photographers",
                "Unlimited jobs",
                "Everything in Pro",
                "Custom branding",
                "Service territories",
                "Dedicated support",
              ]}
            />
          </div>

          <p className="text-center text-gray-600 text-xs mt-8">
            All prices in USD. Billed monthly. Cancel any time.
          </p>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="relative rounded-3xl bg-gradient-to-br from-blue-600/20 via-violet-600/15 to-blue-600/10 border border-white/[0.08] px-8 py-16 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
            <h2 className="relative text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
              Ready to simplify your studio?
            </h2>
            <p className="relative text-gray-400 mb-8 max-w-lg mx-auto">
              Join real estate photographers who replaced 5 different tools with one platform.
            </p>
            <Link
              href="/register"
              className="relative inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-violet-500 text-white font-semibold px-8 py-4 rounded-xl hover:opacity-90 transition-all text-sm"
            >
              Start your 14-day free trial
              <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="relative text-xs text-gray-600 mt-4">No credit card required · Cancel anytime</p>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.06] py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
              <Camera className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-white tracking-tight">scalist</span>
          </div>

          <div className="flex items-center gap-6 text-sm text-gray-600">
            <Link href="/login" className="hover:text-gray-400 transition-colors">Sign in</Link>
            <Link href="/register" className="hover:text-gray-400 transition-colors">Get started</Link>
            <a href="mailto:hello@scalist.io" className="hover:text-gray-400 transition-colors">Contact</a>
          </div>

          <p className="text-xs text-gray-700">© {new Date().getFullYear()} Scalist. All rights reserved.</p>
        </div>
      </footer>

    </div>
  );
}
