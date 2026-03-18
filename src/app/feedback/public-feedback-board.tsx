"use client";

import { useState, useTransition } from "react";
import { ChevronUp, Plus, Loader2, Lightbulb, X } from "lucide-react";
import { toggleVote, submitFeatureRequest, type FeatureRequestWithMeta } from "@/lib/feedback-actions";
import { formatDistanceToNow } from "date-fns";

// ─── Column config ─────────────────────────────────────────────────────────────

const COLUMNS = [
  {
    key: "planned" as const,
    label: "Planned",
    dot: "bg-violet-500",
    countStyle: "text-violet-300 bg-violet-500/10 border-violet-500/20",
    headerGlow: "from-violet-600/5 to-transparent",
    borderAccent: "border-violet-500/20",
  },
  {
    key: "inProgress" as const,
    label: "In Progress",
    dot: "bg-blue-400",
    countStyle: "text-blue-300 bg-blue-500/10 border-blue-500/20",
    headerGlow: "from-blue-600/5 to-transparent",
    borderAccent: "border-blue-500/20",
  },
  {
    key: "inBeta" as const,
    label: "In Beta",
    dot: "bg-emerald-400",
    countStyle: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
    headerGlow: "from-emerald-600/5 to-transparent",
    borderAccent: "border-emerald-500/20",
  },
];

// ─── Vote button ───────────────────────────────────────────────────────────────

function VoteButton({ id, count, hasVoted, loggedIn }: {
  id: string; count: number; hasVoted: boolean; loggedIn: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [optCount, setOptCount] = useState(count);
  const [optVoted, setOptVoted] = useState(hasVoted);

  function handleVote() {
    if (!loggedIn) return;
    const next = !optVoted;
    setOptVoted(next);
    setOptCount((c) => (next ? c + 1 : c - 1));
    startTransition(() => toggleVote(id));
  }

  return (
    <button
      onClick={handleVote}
      disabled={!loggedIn || pending}
      title={loggedIn ? (optVoted ? "Remove vote" : "Upvote") : "Log in to vote"}
      className={`flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-xl border transition-all shrink-0 min-w-[44px]
        ${optVoted
          ? "bg-blue-500/15 border-blue-500/40 text-blue-300"
          : "bg-white/[0.03] border-white/[0.08] text-gray-500 hover:border-white/[0.18] hover:text-gray-300"
        }
        ${!loggedIn ? "cursor-default opacity-50" : "cursor-pointer"}
      `}
    >
      {pending
        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
        : <ChevronUp className={`h-3.5 w-3.5 ${optVoted ? "text-blue-400" : "text-gray-500"}`} />
      }
      <span className="text-[11px] font-bold leading-none">{optCount}</span>
    </button>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function RequestCard({ request, userId }: { request: FeatureRequestWithMeta; userId: string | null }) {
  return (
    <div className="group bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 flex gap-3 hover:bg-white/[0.05] hover:border-white/[0.10] transition-all">
      <VoteButton id={request.id} count={request._count.votes} hasVoted={request.hasVoted} loggedIn={!!userId} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-gray-200 leading-snug group-hover:text-white transition-colors">
          {request.title}
        </p>
        {request.description && (
          <p className="text-[12px] text-gray-500 mt-1.5 leading-relaxed line-clamp-2">
            {request.description}
          </p>
        )}
        <p className="text-[10px] text-gray-700 mt-2 font-mono">
          {request.authorName ?? "Anonymous"} · {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}

// ─── Submit modal ──────────────────────────────────────────────────────────────

function SubmitModal({ onClose }: { onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await submitFeatureRequest(fd);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative rounded-2xl p-px bg-gradient-to-b from-white/[0.1] to-white/[0.03] w-full max-w-lg">
        <div className="bg-[#0d0d0d] rounded-2xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-blue-500/20 flex items-center justify-center">
                <Lightbulb className="h-4 w-4 text-blue-400" />
              </div>
              <span className="text-sm font-bold text-white">Submit a Feature Request</span>
            </div>
            <button onClick={onClose} className="text-gray-600 hover:text-gray-300 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                name="title"
                required
                maxLength={120}
                placeholder="e.g. Bulk invoice download as PDF"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
                Details <span className="text-gray-700">(optional)</span>
              </label>
              <textarea
                name="description"
                rows={3}
                placeholder="Describe why this would be useful and how you'd use it…"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-colors resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-violet-500 hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit Idea
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Main board ───────────────────────────────────────────────────────────────

interface Props {
  planned: FeatureRequestWithMeta[];
  inProgress: FeatureRequestWithMeta[];
  inBeta: FeatureRequestWithMeta[];
  userId: string | null;
}

export function PublicFeedbackBoard({ planned, inProgress, inBeta, userId }: Props) {
  const [showModal, setShowModal] = useState(false);
  const data = { planned, inProgress, inBeta };
  const total = planned.length + inProgress.length + inBeta.length;

  return (
    <>
      {showModal && <SubmitModal onClose={() => setShowModal(false)} />}

      {/* Stats + submit */}
      <div className="flex items-center justify-between mb-8">
        <p className="text-sm text-gray-600">
          <span className="text-gray-300 font-semibold">{total}</span> idea{total !== 1 ? "s" : ""} on the board · click ▲ to upvote
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-violet-500 hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-all"
        >
          <Plus className="h-4 w-4" />
          Submit Idea
        </button>
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {COLUMNS.map((col) => {
          const requests = data[col.key];
          return (
            <div
              key={col.key}
              className={`rounded-2xl border bg-white/[0.02] overflow-hidden ${col.borderAccent}`}
            >
              {/* Column header */}
              <div className={`px-5 py-4 border-b border-white/[0.06] bg-gradient-to-b ${col.headerGlow}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                    <span className="text-sm font-bold text-white">{col.label}</span>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${col.countStyle}`}>
                    {requests.length}
                  </span>
                </div>
              </div>

              {/* Cards */}
              <div className="p-4 space-y-3 min-h-[200px]">
                {requests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <p className="text-sm text-gray-700">Nothing here yet</p>
                    <p className="text-xs text-gray-800 mt-1">Submit an idea to get started</p>
                  </div>
                ) : (
                  requests.map((req) => (
                    <RequestCard key={req.id} request={req} userId={userId} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
