"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import {
  ChevronUp, Plus, Loader2, Lightbulb, X, MessageSquare,
  Send, ChevronRight, Pencil, Trash2, MoreHorizontal, Check,
} from "lucide-react";
import {
  toggleVote, submitFeatureRequest, getComments, addComment,
  updateFeatureRequest, deleteFeatureRequest, CATEGORY_META,
  type FeatureRequestWithMeta, type FeatureRequestComment,
} from "@/lib/feedback-actions";
import { formatDistanceToNow } from "date-fns";
import { FeatureRequestCategory } from "@prisma/client";

// ─── Column config ─────────────────────────────────────────────────────────────

const COLUMNS = [
  {
    key: "planned" as const, label: "Planned", dot: "bg-violet-500",
    countStyle: "text-violet-300 bg-violet-500/10 border-violet-500/20",
    headerGlow: "from-violet-600/5 to-transparent", borderAccent: "border-violet-500/20",
  },
  {
    key: "inProgress" as const, label: "In Progress", dot: "bg-blue-400",
    countStyle: "text-blue-300 bg-blue-500/10 border-blue-500/20",
    headerGlow: "from-blue-600/5 to-transparent", borderAccent: "border-blue-500/20",
  },
  {
    key: "inBeta" as const, label: "In Beta", dot: "bg-emerald-400",
    countStyle: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
    headerGlow: "from-emerald-600/5 to-transparent", borderAccent: "border-emerald-500/20",
  },
];

const statusLabel: Record<string, string> = {
  PLANNED: "Planned", IN_PROGRESS: "In Progress", IN_BETA: "In Beta", COMPLETED: "Completed",
};
const statusColor: Record<string, string> = {
  PLANNED: "text-violet-300 bg-violet-500/10 border-violet-500/20",
  IN_PROGRESS: "text-blue-300 bg-blue-500/10 border-blue-500/20",
  IN_BETA: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
  COMPLETED: "text-gray-400 bg-gray-500/10 border-gray-500/20",
};

const CATEGORY_OPTIONS = Object.entries(CATEGORY_META).map(([value, meta]) => ({
  value: value as FeatureRequestCategory,
  ...meta,
}));

// ─── Vote button ───────────────────────────────────────────────────────────────

function VoteButton({ id, count, hasVoted, loggedIn }: {
  id: string; count: number; hasVoted: boolean; loggedIn: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [optCount, setOptCount] = useState(count);
  const [optVoted, setOptVoted] = useState(hasVoted);

  function handleVote(e: React.MouseEvent) {
    e.stopPropagation();
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
        ${optVoted ? "bg-blue-500/15 border-blue-500/40 text-blue-300" : "bg-white/[0.03] border-white/[0.08] text-gray-500 hover:border-white/[0.18] hover:text-gray-300"}
        ${!loggedIn ? "cursor-default opacity-50" : "cursor-pointer"}`}
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronUp className={`h-3.5 w-3.5 ${optVoted ? "text-blue-400" : "text-gray-500"}`} />}
      <span className="text-[11px] font-bold leading-none">{optCount}</span>
    </button>
  );
}

// ─── Comment section ───────────────────────────────────────────────────────────

function CommentSection({ requestId, userId }: { requestId: string; userId: string | null }) {
  const [comments, setComments] = useState<FeatureRequestComment[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [body, setBody] = useState("");
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    getComments(requestId).then((c) => { setComments(c); setLoading(false); });
  }, [requestId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setError(null);
    const snapshot = body;
    setBody("");
    startSubmit(async () => {
      try {
        await addComment(requestId, snapshot);
        const fresh = await getComments(requestId);
        setComments(fresh);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to post.");
        setBody(snapshot);
      }
    });
  }

  return (
    <div className="mt-6 border-t border-white/[0.06] pt-5">
      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
        <MessageSquare className="h-3.5 w-3.5" />
        Discussion
        {comments && <span className="text-gray-700 font-normal normal-case tracking-normal">({comments.length})</span>}
      </h3>

      <div className="space-y-3 max-h-60 overflow-y-auto pr-1 mb-4">
        {loading && <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-gray-600" /></div>}
        {!loading && comments?.length === 0 && (
          <p className="text-sm text-gray-700 text-center py-6">No comments yet — be the first to share your thoughts!</p>
        )}
        {!loading && comments?.map((c) => (
          <div key={c.id} className="flex gap-3">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500/30 to-violet-500/30 border border-white/[0.08] flex items-center justify-center shrink-0 text-[11px] font-bold text-gray-400">
              {(c.authorName ?? "A")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[12px] font-semibold text-gray-300">{c.authorName ?? "Anonymous"}</span>
                <span className="text-[10px] text-gray-700 font-mono">{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</span>
              </div>
              <p className="text-[13px] text-gray-400 leading-relaxed whitespace-pre-wrap break-words">{c.body}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {userId ? (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share your thoughts…"
            maxLength={1000}
            className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-colors"
          />
          <button
            type="submit"
            disabled={submitting || !body.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-violet-500 hover:opacity-90 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-all shrink-0"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      ) : (
        <p className="text-xs text-gray-600 text-center py-3 bg-white/[0.02] rounded-xl border border-white/[0.05]">
          Log in to join the discussion
        </p>
      )}
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}

// ─── Request detail modal ─────────────────────────────────────────────────────

function RequestModal({
  request, userId, onClose, onDeleted,
}: {
  request: FeatureRequestWithMeta;
  userId: string | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const isOwner = !!userId && userId === request.authorId;
  const cat = CATEGORY_META[request.category] ?? CATEGORY_META.GENERAL;

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(request.title);
  const [editDesc, setEditDesc] = useState(request.description ?? "");
  const [saving, startSave] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  // Delete state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, startDelete] = useTransition();

  // Menu state
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === "Escape") { if (editing) setEditing(false); else onClose(); } }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [editing, onClose]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  function handleSave() {
    setSaveError(null);
    startSave(async () => {
      try {
        await updateFeatureRequest(request.id, editTitle, editDesc || null);
        setEditing(false);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Failed to save.");
      }
    });
  }

  function handleDelete() {
    startDelete(async () => {
      await deleteFeatureRequest(request.id);
      onDeleted();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative rounded-2xl p-px bg-gradient-to-b from-white/[0.10] to-white/[0.03] w-full max-w-xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.7)" }}
      >
        <div className="bg-[#0d0d0d] rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">

          {/* Header */}
          <div className="flex items-start justify-between px-6 py-5 border-b border-white/[0.06] shrink-0">
            <div className="flex-1 min-w-0 pr-3">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor[request.status]}`}>
                  {statusLabel[request.status]}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cat.color}`}>
                  {cat.label}
                </span>
              </div>
              {editing ? (
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  maxLength={120}
                  className="w-full bg-white/[0.05] border border-white/[0.12] rounded-lg px-3 py-1.5 text-base font-bold text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
                />
              ) : (
                <h2 className="text-base font-bold text-white leading-snug">{request.title}</h2>
              )}
              <p className="text-[11px] text-gray-600 mt-1 font-mono">
                by {request.authorName ?? "Anonymous"} · {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Owner actions menu */}
              {isOwner && !editing && (
                <div ref={menuRef} className="relative">
                  <button
                    onClick={() => setMenuOpen((v) => !v)}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-gray-600 hover:text-gray-300 hover:bg-white/[0.06] transition-colors"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-40 bg-[#141420] border border-white/[0.10] rounded-xl shadow-xl overflow-hidden z-10">
                      <button
                        onClick={() => { setEditing(true); setMenuOpen(false); }}
                        className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-gray-300 hover:bg-white/[0.06] hover:text-white transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5 text-blue-400" />
                        Edit
                      </button>
                      <button
                        onClick={() => { setConfirmDelete(true); setMenuOpen(false); }}
                        className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Save / cancel when editing */}
              {editing && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 text-xs font-semibold rounded-lg transition-colors"
                  >
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Save
                  </button>
                  <button
                    onClick={() => { setEditing(false); setEditTitle(request.title); setEditDesc(request.description ?? ""); setSaveError(null); }}
                    className="px-3 py-1.5 text-gray-600 hover:text-gray-300 text-xs font-semibold rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}

              <button onClick={onClose} className="h-7 w-7 rounded-lg flex items-center justify-center text-gray-600 hover:text-gray-300 hover:bg-white/[0.06] transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Delete confirmation banner */}
          {confirmDelete && (
            <div className="px-6 py-3 bg-red-500/10 border-b border-red-500/20 flex items-center justify-between shrink-0">
              <p className="text-sm text-red-300">Delete this feature request permanently?</p>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-xs font-bold rounded-lg transition-colors"
                >
                  {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  Delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 text-gray-500 hover:text-gray-300 text-xs font-semibold rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 px-6 py-5">
            {saveError && <p className="text-xs text-red-400 mb-3">{saveError}</p>}

            <div className="flex gap-4">
              <VoteButton id={request.id} count={request._count.votes} hasVoted={request.hasVoted} loggedIn={!!userId} />
              <div className="flex-1 min-w-0">
                {editing ? (
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    rows={3}
                    placeholder="Add a description…"
                    className="w-full bg-white/[0.04] border border-white/[0.10] rounded-xl px-3 py-2.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-colors resize-none"
                  />
                ) : request.description ? (
                  <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">{request.description}</p>
                ) : (
                  <p className="text-sm text-gray-700 italic">No description provided.</p>
                )}
              </div>
            </div>

            <CommentSection requestId={request.id} userId={userId} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function RequestCard({ request, userId, onDeleted }: {
  request: FeatureRequestWithMeta; userId: string | null; onDeleted: (id: string) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const cat = CATEGORY_META[request.category] ?? CATEGORY_META.GENERAL;

  return (
    <>
      {modalOpen && (
        <RequestModal
          request={request}
          userId={userId}
          onClose={() => setModalOpen(false)}
          onDeleted={() => onDeleted(request.id)}
        />
      )}
      <div
        className="group bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 flex gap-3 hover:bg-white/[0.05] hover:border-white/[0.10] transition-all cursor-pointer"
        onClick={() => setModalOpen(true)}
      >
        <VoteButton id={request.id} count={request._count.votes} hasVoted={request.hasVoted} loggedIn={!!userId} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-gray-200 leading-snug group-hover:text-white transition-colors">
            {request.title}
          </p>
          {request.description && (
            <p className="text-[12px] text-gray-500 mt-1.5 leading-relaxed line-clamp-2">{request.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <p className="text-[10px] text-gray-700 font-mono">
              {request.authorName ?? "Anonymous"} · {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
            </p>
            {/* Category pill */}
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${cat.color}`}>
              {cat.label}
            </span>
            {request._count.comments > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-gray-600">
                <MessageSquare className="h-2.5 w-2.5" />
                {request._count.comments}
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-gray-700 group-hover:text-gray-500 transition-colors shrink-0 self-center" />
      </div>
    </>
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
      try { await submitFeatureRequest(fd); onClose(); }
      catch (err) { setError(err instanceof Error ? err.message : "Something went wrong."); }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative rounded-2xl p-px bg-gradient-to-b from-white/[0.1] to-white/[0.03] w-full max-w-lg">
        <div className="bg-[#0d0d0d] rounded-2xl overflow-hidden shadow-2xl">
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
            {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
                Category
              </label>
              <select
                name="category"
                defaultValue="GENERAL"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-colors"
              >
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat.value} value={cat.value} className="bg-[#0d0d0d]">
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                name="title" required maxLength={120}
                placeholder="e.g. Bulk invoice download as PDF"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
                Details <span className="text-gray-700">(optional)</span>
              </label>
              <textarea
                name="description" rows={3}
                placeholder="Describe why this would be useful…"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-colors resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-200 transition-colors">Cancel</button>
              <button type="submit" disabled={pending}
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
  const [catFilter, setCatFilter] = useState<FeatureRequestCategory | "ALL">("ALL");

  // Local state so delete removes card instantly without full page reload
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const hide = (id: string) => setHidden((s) => new Set([...s, id]));

  function applyFilters(items: FeatureRequestWithMeta[]) {
    return items
      .filter((r) => !hidden.has(r.id))
      .filter((r) => catFilter === "ALL" || r.category === catFilter);
  }

  const data = {
    planned: applyFilters(planned),
    inProgress: applyFilters(inProgress),
    inBeta: applyFilters(inBeta),
  };
  const total = data.planned.length + data.inProgress.length + data.inBeta.length;

  return (
    <>
      {showModal && <SubmitModal onClose={() => setShowModal(false)} />}

      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-gray-600">
          <span className="text-gray-300 font-semibold">{total}</span> idea{total !== 1 ? "s" : ""} · click a card to discuss
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-violet-500 hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-all"
        >
          <Plus className="h-4 w-4" />
          Submit Idea
        </button>
      </div>

      {/* Category filter bar */}
      <div className="flex items-center gap-2 mb-8 flex-wrap">
        <button
          onClick={() => setCatFilter("ALL")}
          className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${
            catFilter === "ALL"
              ? "bg-white/10 border-white/20 text-white"
              : "bg-transparent border-white/[0.08] text-gray-500 hover:text-gray-300 hover:border-white/[0.15]"
          }`}
        >
          All
        </button>
        {CATEGORY_OPTIONS.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCatFilter(cat.value === catFilter ? "ALL" : cat.value)}
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              catFilter === cat.value
                ? `${cat.color}`
                : "bg-transparent border-white/[0.08] text-gray-500 hover:text-gray-300 hover:border-white/[0.15]"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {COLUMNS.map((col) => {
          const requests = data[col.key];
          return (
            <div key={col.key} className={`rounded-2xl border bg-white/[0.02] overflow-hidden ${col.borderAccent}`}>
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
              <div className="p-4 space-y-3 min-h-[200px]">
                {requests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <p className="text-sm text-gray-700">Nothing here yet</p>
                    <p className="text-xs text-gray-800 mt-1">Submit an idea to get started</p>
                  </div>
                ) : (
                  requests.map((req) => (
                    <RequestCard key={req.id} request={req} userId={userId} onDeleted={hide} />
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
