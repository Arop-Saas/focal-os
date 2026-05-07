import Link from "next/link";
import { Camera, ChevronLeft } from "lucide-react";
import { getFeatureRequests } from "@/lib/feedback-actions";
import { PublicFeedbackBoard } from "./public-feedback-board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Feature Requests · Scalist" };

export default async function PublicFeedbackPage() {
  const { items, userId } = await getFeatureRequests();

  const planned    = items.filter((r) => r.status === "PLANNED");
  const inProgress = items.filter((r) => r.status === "IN_PROGRESS");
  const inBeta     = items.filter((r) => r.status === "IN_BETA");

  return (
    <div className="min-h-screen bg-[#080808] text-white font-sans antialiased">

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06] backdrop-blur-xl bg-[#080808]/80">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
              <Camera className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white tracking-tight">Scalist</span>
            <span className="text-white/20 mx-1">/</span>
            <span className="text-sm text-gray-400">Feature Requests</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/overview"
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Back to app
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-6xl mx-auto text-center">
          {/* Glow orb */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-r from-blue-600/10 via-violet-600/10 to-blue-600/10 blur-3xl rounded-full pointer-events-none" />

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs text-gray-400 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Public Roadmap
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
            <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-blue-400 bg-clip-text text-transparent">
              Feature Requests
            </span>
          </h1>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            Vote for what matters most to you, or submit a new idea — we ship based on what you need.
          </p>
        </div>
      </section>

      {/* ── Board ───────────────────────────────────────────────────────── */}
      <section className="pb-24 px-6">
        <div className="max-w-6xl mx-auto">
          <PublicFeedbackBoard
            planned={planned}
            inProgress={inProgress}
            inBeta={inBeta}
            userId={userId}
          />
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.06] py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
              <Camera className="w-2.5 h-2.5 text-white" />
            </div>
            <span>Scalist · Feature Requests</span>
          </div>
          <span>Built for real estate photographers</span>
        </div>
      </footer>
    </div>
  );
}
