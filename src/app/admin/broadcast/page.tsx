"use client";

import { useState, useTransition } from "react";
import { Megaphone, Send, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { sendBroadcast } from "./actions";

const TARGET_OPTIONS = [
  { value: "", label: "All workspaces" },
  { value: "TRIALING", label: "Trialing only" },
  { value: "ACTIVE", label: "Active subscribers only" },
  { value: "PAST_DUE", label: "Past due only" },
  { value: "CANCELED", label: "Canceled only" },
];

export default function BroadcastPage() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult(null);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const form = e.currentTarget;
    startTransition(async () => {
      try {
        const res = await sendBroadcast(formData);
        setResult(res);
        form.reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="p-8 space-y-6 min-h-screen max-w-2xl">

      {/* Header */}
      <div>
        <p className="text-[10px] tracking-widest uppercase text-violet-500 mb-1 font-bold">◈ BROADCAST</p>
        <h1 className="text-2xl font-bold text-white tracking-tight">Send Announcement</h1>
        <p className="text-xs text-slate-600 mt-0.5 font-mono">Push an in-app notification to all or filtered workspaces.</p>
      </div>

      {/* Success */}
      {result && (
        <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
          <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
          <p className="text-xs text-emerald-300 font-mono">
            Sent to <span className="font-bold">{result.count}</span> workspace{result.count !== 1 ? "s" : ""}.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-xs text-red-300 font-mono">{error}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-[#0d0d1a] rounded-xl border border-[#ffffff08] p-6 space-y-5">

        {/* Target audience */}
        <div>
          <label className="block text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-2">
            Target Audience
          </label>
          <select
            name="targetStatus"
            className="w-full bg-[#080810] border border-[#ffffff10] rounded-lg px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-colors font-mono"
          >
            {TARGET_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="block text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-2">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            name="title"
            required
            placeholder="e.g. Scheduled maintenance on March 22"
            className="w-full bg-[#080810] border border-[#ffffff10] rounded-lg px-3 py-2.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-colors font-mono"
          />
        </div>

        {/* Body */}
        <div>
          <label className="block text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-2">
            Message <span className="text-red-500">*</span>
          </label>
          <textarea
            name="body"
            required
            rows={4}
            placeholder="We'll be performing maintenance on Saturday March 22 from 2–4 AM UTC. The app will be briefly unavailable."
            className="w-full bg-[#080810] border border-[#ffffff10] rounded-lg px-3 py-2.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-colors font-mono resize-none"
          />
        </div>

        {/* Preview */}
        <div className="bg-[#080810] border border-[#ffffff06] rounded-lg p-4">
          <p className="text-[10px] font-bold tracking-widest uppercase text-slate-600 mb-2">Preview</p>
          <div className="flex items-start gap-2.5">
            <div className="h-7 w-7 rounded bg-violet-900/50 flex items-center justify-center shrink-0 mt-0.5">
              <Megaphone className="h-3.5 w-3.5 text-violet-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-200">Scalist · Platform Announcement</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Appears in the notification bell for all workspace members.</p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-bold tracking-widest uppercase rounded-lg transition-colors"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {pending ? "Sending…" : "Send Broadcast"}
        </button>
      </form>
    </div>
  );
}
