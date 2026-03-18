"use client";

import { useState, useTransition } from "react";
import { ChevronUp, Plus, Loader2, Lightbulb, X } from "lucide-react";
import { toggleVote, submitFeatureRequest, type FeatureRequestWithMeta } from "./actions";
import { formatDistanceToNow } from "date-fns";

// ─── Column config ─────────────────────────────────────────────────────────────

const COLUMNS = [
  {
    key: "planned" as const,
    label: "Planned",
    dot: "bg-violet-500",
    badge: "text-violet-300 bg-violet-500/10 border-violet-500/20",
    glow: "shadow-[0_0_20px_rgba(139,92,246,0.08)]",
  },
  {
    key: "inProgress" as const,
    label: "In Progress",
    dot: "bg-blue-400",
    badge: "text-blue-300 bg-blue-500/10 border-blue-500/20",
    glow: "shadow-[0_0_20px_rgba(59,130,246,0.08)]",
  },
  {
    key: "inBeta" as const,
    label: "In Beta",
    dot: "bg-emerald-400",
    badge: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
    glow: "shadow-[0_0_20px_rgba(52,211,153,0.08)]",
  },
];

// ─── Vote button ───────────────────────────────────────────────────────────────

function VoteButton({
  id,
  count,
  hasVoted,
  loggedIn,
}: {
  id: string;
  count: number;
  hasVoted: boolean;
  loggedIn: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [optimisticCount, setOptimisticCount] = useState(count);
  const [optimisticVoted, setOptimisticVoted] = useState(hasVoted);

  function handleVote() {
    if (!loggedIn) return;
    const next = !optimisticVoted;
    setOptimisticVoted(next);
    setOptimisticCount((c) => (next ? c + 1 : c - 1));
    startTransition(() => toggleVote(id));
  }

  return (
    <button
      onClick={handleVote}
      disabled={!loggedIn || pending}
      title={loggedIn ? (optimisticVoted ? "Remove vote" : "Upvote") : "Log in to vote"}
      className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg border transition-all shrink-0 min-w-[40px]
        ${optimisticVoted
          ? "bg-blue-500/15 border-blue-500/40 text-blue-300"
          : "bg-white/[0.03] border-white/[0.06] text-slate-500 hover:border-white/[0.15] hover:text-slate-300"
        }
        ${!loggedIn ? "cursor-default opacity-60" : "cursor-pointer"}
      `}
    >
      {pending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <ChevronUp className={`h-3 w-3 ${optimisticVoted ? "text-blue-400" : "text-slate-500"}`} />
      )}
      <span className="text-[10px] font-bold leading-none">{optimisticCount}</span>
    </button>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function RequestCard({
  request,
  userId,
}: {
  request: FeatureRequestWithMeta;
  userId: string | null;
}) {
  return (
    <div className="bg-[#0a0a18] border border-white/[0.06] rounded-lg p-3.5 flex gap-3 hover:border-white/[0.12] transition-all group">
      <VoteButton
        id={request.id}
        count={request._count.votes}
        hasVoted={request.hasVoted}
        loggedIn={!!userId}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-slate-200 leading-snug group-hover:text-white transition-colors">
          {request.title}
        </p>
        {request.description && (
          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed line-clamp-2">
            {request.description}
          </p>
        )}
        <p className="text-[10px] text-slate-600 mt-1.5 font-mono">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0d0d1a] border border-white/[0.08] rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-bold text-white">Submit a Feature Request</span>
          </div>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-300 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div>
            <label className="block text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-1.5">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              name="title"
              required
              maxLength={120}
              placeholder="e.g. Bulk invoice download as PDF"
              className="w-full bg-[#080810] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-colors font-mono"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-1.5">
              Details <span className="text-slate-700">(optional)</span>
            </label>
            <textarea
              name="description"
              rows={3}
              placeholder="Describe why this would be useful and how you'd use it…"
              className="w-full bg-[#080810] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-colors font-mono resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold tracking-wider uppercase rounded-lg transition-colors"
            >
              {pending && <Loader2 className="h-3 w-3 animate-spin" />}
              Submit Request
            </button>
          </div>
        </form>
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

export function FeedbackBoard({ planned, inProgress, inBeta, userId }: Props) {
  const [showModal, setShowModal] = useState(false);

  const data = { planned, inProgress, inBeta };
  const total = planned.length + inProgress.length + inBeta.length;

  return (
    <>
      {showModal && <SubmitModal onClose={() => setShowModal(false)} />}

      {/* Actions bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500 font-mono">
          {total} idea{total !== 1 ? "s" : ""} · click ▲ to upvote
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold tracking-wider uppercase rounded-lg transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Submit Idea
        </button>
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-3 gap-5">
        {COLUMNS.map((col) => {
          const requests = data[col.key];
          return (
            <div key={col.key} className={`rounded-xl border border-white/[0.06] bg-[#080813] ${col.glow} overflow-hidden`}>
              {/* Column header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${col.dot}`} />
                  <span className="text-xs font-bold text-slate-200">{col.label}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${col.badge}`}>
                  {requests.length}
                </span>
              </div>

              {/* Cards */}
              <div className="p-3 space-y-2.5 min-h-[200px]">
                {requests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <p className="text-[11px] text-slate-600 font-mono">Nothing here yet</p>
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
