"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getAllFeatureRequestsForAdmin,
  adminUpdateStatus,
  adminUpdateCategory,
  adminTogglePin,
  adminDeleteRequest,
} from "@/lib/feedback-actions";
import { CATEGORY_META, CATEGORY_OPTIONS } from "@/lib/feedback-categories";
import { FeatureRequestStatus, FeatureRequestCategory } from "@prisma/client";
import { Pin, PinOff, Trash2, ChevronDown } from "lucide-react";

type Request = Awaited<ReturnType<typeof getAllFeatureRequestsForAdmin>>[number];

const STATUS_OPTIONS: { value: FeatureRequestStatus; label: string; color: string; dot: string }[] = [
  { value: "PLANNED",     label: "Planned",     color: "bg-blue-500/10 text-blue-400 border-blue-500/20",   dot: "bg-blue-500" },
  { value: "IN_PROGRESS", label: "In Progress", color: "bg-amber-500/10 text-amber-400 border-amber-500/20", dot: "bg-amber-500" },
  { value: "IN_BETA",     label: "In Beta",     color: "bg-green-500/10 text-green-400 border-green-500/20", dot: "bg-green-500" },
  { value: "COMPLETED",   label: "Completed",   color: "bg-slate-500/10 text-slate-400 border-slate-500/20", dot: "bg-slate-500" },
];

function statusMeta(status: FeatureRequestStatus) {
  return STATUS_OPTIONS.find((s) => s.value === status) ?? STATUS_OPTIONS[0];
}

function categoryMeta(category: FeatureRequestCategory) {
  return CATEGORY_META[category] ?? CATEGORY_META.GENERAL;
}

export default function AdminFeatureRequestsPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [filter, setFilter] = useState<FeatureRequestStatus | "ALL">("ALL");
  const [catFilter, setCatFilter] = useState<FeatureRequestCategory | "ALL">("ALL");
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function load() {
    const data = await getAllFeatureRequestsForAdmin();
    setRequests(data);
  }

  useEffect(() => { load(); }, []);

  function handleStatus(id: string, status: FeatureRequestStatus) {
    startTransition(async () => {
      await adminUpdateStatus(id, status);
      await load();
    });
  }

  function handleCategory(id: string, category: FeatureRequestCategory) {
    startTransition(async () => {
      await adminUpdateCategory(id, category);
      await load();
    });
  }

  function handlePin(id: string, pinned: boolean) {
    startTransition(async () => {
      await adminTogglePin(id, pinned);
      await load();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await adminDeleteRequest(id);
      setConfirmDelete(null);
      await load();
    });
  }

  const filtered = requests
    .filter((r) => filter === "ALL" || r.status === filter)
    .filter((r) => catFilter === "ALL" || r.category === catFilter);

  const counts = {
    ALL:         requests.length,
    PLANNED:     requests.filter((r) => r.status === "PLANNED").length,
    IN_PROGRESS: requests.filter((r) => r.status === "IN_PROGRESS").length,
    IN_BETA:     requests.filter((r) => r.status === "IN_BETA").length,
    COMPLETED:   requests.filter((r) => r.status === "COMPLETED").length,
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">Feature Requests</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">{requests.length} total requests from users</p>
        </div>
        <a
          href="/feedback"
          target="_blank"
          className="text-[11px] text-violet-400 hover:text-violet-300 border border-violet-500/20 rounded px-3 py-1.5 transition-colors"
        >
          View public board ↗
        </a>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 border-b border-white/[0.06] pb-0">
        {[
          { key: "ALL", label: "All" },
          { key: "PLANNED",     label: "Planned" },
          { key: "IN_PROGRESS", label: "In Progress" },
          { key: "IN_BETA",     label: "In Beta" },
          { key: "COMPLETED",   label: "Completed" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as FeatureRequestStatus | "ALL")}
            className={`px-3 py-2 text-[11px] font-medium border-b-2 transition-colors -mb-px ${
              filter === tab.key
                ? "border-violet-500 text-white"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-[10px] text-slate-600">
              {counts[tab.key as keyof typeof counts]}
            </span>
          </button>
        ))}
      </div>

      {/* Category filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[9px] font-bold tracking-widest uppercase text-slate-600">Category:</span>
        <button
          onClick={() => setCatFilter("ALL")}
          className={`text-[10px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
            catFilter === "ALL"
              ? "bg-white/10 border-white/20 text-white"
              : "bg-transparent border-white/[0.06] text-slate-500 hover:text-slate-300"
          }`}
        >
          All
        </button>
        {CATEGORY_OPTIONS.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCatFilter(cat.value)}
            className={`text-[10px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
              catFilter === cat.value
                ? `${cat.color} font-bold`
                : "bg-transparent border-white/[0.06] text-slate-500 hover:text-slate-300"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Requests list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-600 text-[12px]">No requests in this category</div>
        )}

        {filtered.map((req) => {
          const meta = statusMeta(req.status);
          const cat = categoryMeta(req.category);
          return (
            <div
              key={req.id}
              className={`rounded-lg border bg-[#0a0a14] p-4 flex items-start gap-4 transition-opacity ${
                isPending ? "opacity-60" : ""
              } ${req.pinned ? "border-violet-500/30" : "border-white/[0.06]"}`}
            >
              {/* Pin indicator */}
              {req.pinned && (
                <div className="shrink-0 mt-0.5">
                  <div className="w-1 h-full min-h-[40px] rounded-full bg-violet-500/60" />
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 flex-wrap">
                  <p className="text-[13px] font-semibold text-white leading-snug">{req.title}</p>
                  {req.pinned && (
                    <span className="text-[10px] bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded px-1.5 py-0.5 font-medium">
                      Pinned
                    </span>
                  )}
                  {/* Category pill */}
                  <span className={`text-[10px] border rounded px-1.5 py-0.5 font-medium ${cat.color}`}>
                    {cat.label}
                  </span>
                </div>
                {req.description && (
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed line-clamp-2">{req.description}</p>
                )}
                <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-600">
                  <span>👤 {req.authorName ?? "Anonymous"}</span>
                  <span>▲ {req._count.votes} votes</span>
                  <span>💬 {req._count.comments} comments</span>
                  <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Category dropdown */}
                <div className="relative group">
                  <button className={`flex items-center gap-1.5 text-[11px] font-medium border rounded px-2.5 py-1.5 transition-colors ${cat.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`} />
                    {cat.label}
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </button>
                  <div className="absolute right-0 top-full mt-1 w-40 bg-[#0f0f1a] border border-white/[0.08] rounded-lg shadow-xl z-10 overflow-hidden hidden group-hover:block">
                    {CATEGORY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleCategory(req.id, opt.value)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] hover:bg-white/[0.04] transition-colors text-left ${
                          req.category === opt.value ? "text-white font-semibold" : "text-slate-400"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${opt.dot}`} />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status dropdown */}
                <div className="relative group">
                  <button className={`flex items-center gap-1.5 text-[11px] font-medium border rounded px-2.5 py-1.5 transition-colors ${meta.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                    {meta.label}
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </button>
                  <div className="absolute right-0 top-full mt-1 w-36 bg-[#0f0f1a] border border-white/[0.08] rounded-lg shadow-xl z-10 overflow-hidden hidden group-hover:block">
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleStatus(req.id, opt.value)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] hover:bg-white/[0.04] transition-colors text-left ${
                          req.status === opt.value ? "text-white font-semibold" : "text-slate-400"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${opt.dot}`} />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pin toggle */}
                <button
                  onClick={() => handlePin(req.id, !req.pinned)}
                  title={req.pinned ? "Unpin" : "Pin to top"}
                  className="p-1.5 rounded text-slate-600 hover:text-violet-400 hover:bg-violet-500/10 transition-colors"
                >
                  {req.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                </button>

                {/* Delete */}
                {confirmDelete === req.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(req.id)}
                      className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 rounded px-2 py-1 hover:bg-red-500/20 transition-colors"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="text-[10px] text-slate-500 hover:text-slate-300 px-1"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(req.id)}
                    className="p-1.5 rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
