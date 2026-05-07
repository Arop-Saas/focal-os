"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { format, differenceInMinutes } from "date-fns";
import { MapboxMap } from "@/components/shared/mapbox-map";
import BottomNav from "../../_components/BottomNav";

function elapsed(startAt: Date | string): string {
  const mins = differenceInMinutes(new Date(), new Date(startAt));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING:     { label: "Pending",     color: "bg-gray-700 text-gray-300" },
  CONFIRMED:   { label: "Confirmed",   color: "bg-blue-900/60 text-blue-300" },
  ASSIGNED:    { label: "Assigned",    color: "bg-indigo-900/60 text-indigo-300" },
  IN_PROGRESS: { label: "In Progress", color: "bg-green-900/60 text-green-300" },
  EDITING:     { label: "Editing",     color: "bg-yellow-900/60 text-yellow-300" },
};

export default function MobileJobDetailPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;

  const utils = trpc.useUtils();
  const { data: job, isLoading, error } = trpc.mobile.getJob.useQuery({ jobId }, { retry: false });

  const clockInMutation = trpc.mobile.clockIn.useMutation({
    onSuccess: () => utils.mobile.getJob.invalidate({ jobId }),
  });
  const clockOutMutation = trpc.mobile.clockOut.useMutation({
    onSuccess: () => utils.mobile.getJob.invalidate({ jobId }),
  });
  const completeJobMutation = trpc.mobile.completeJob.useMutation({
    onSuccess: () => {
      utils.mobile.getJob.invalidate({ jobId });
      utils.mobile.getMyJobs.invalidate();
    },
  });
  const saveNoteMutation = trpc.mobile.saveNote.useMutation();

  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [elapsed_, setElapsed] = useState("");

  useEffect(() => {
    if (job?.internalNotes) setNote(job.internalNotes);
  }, [job?.internalNotes]);

  // Live clock-in timer
  useEffect(() => {
    if (!job?.actualStartAt) return;
    setElapsed(elapsed(job.actualStartAt));
    const interval = setInterval(() => setElapsed(elapsed(job.actualStartAt!)), 30_000);
    return () => clearInterval(interval);
  }, [job?.actualStartAt]);

  if (error?.data?.code === "UNAUTHORIZED" || error?.data?.code === "FORBIDDEN") {
    router.replace("/mobile/login");
    return null;
  }

  async function handleSaveNote() {
    await saveNoteMutation.mutateAsync({ jobId, note });
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  }

  async function handleClockIn() {
    await clockInMutation.mutateAsync({ jobId });
  }

  async function handleClockOut() {
    await clockOutMutation.mutateAsync({ jobId });
  }

  async function handleComplete() {
    if (!confirm("Mark this job as complete? This will notify your team.")) return;
    await completeJobMutation.mutateAsync({ jobId });
    router.push("/mobile/jobs");
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400">Job not found.</p>
        <button onClick={() => router.back()} className="text-blue-400 text-sm">Go back</button>
      </div>
    );
  }

  const status = STATUS_CONFIG[job.status] ?? { label: job.status, color: "bg-gray-700 text-gray-300" };
  const isClockedIn = !!job.actualStartAt && !job.actualEndAt;
  const isClockedOut = !!job.actualStartAt && !!job.actualEndAt;
  const canClockIn = !job.actualStartAt && job.status !== "EDITING" && job.status !== "COMPLETED";
  const canComplete = isClockedIn || isClockedOut;

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 pt-safe-top">
        <div className="flex items-center gap-3 py-4">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 active:bg-gray-700 shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white truncate">{job.propertyAddress}</h1>
          </div>
          <span className={`shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full ${status.color}`}>
            {status.label}
          </span>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* Clock-in banner */}
        {isClockedIn && (
          <div className="bg-green-900/30 border border-green-800/50 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse shrink-0" />
            <div>
              <p className="text-green-300 font-semibold text-sm">Clocked In</p>
              <p className="text-green-400/70 text-xs">
                Since {format(new Date(job.actualStartAt!), "h:mm a")} · {elapsed_} elapsed
              </p>
            </div>
          </div>
        )}

        {isClockedOut && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4">
            <p className="text-gray-300 font-semibold text-sm">Shoot Complete</p>
            <p className="text-gray-500 text-xs mt-0.5">
              {format(new Date(job.actualStartAt!), "h:mm a")} – {format(new Date(job.actualEndAt!), "h:mm a")}
              {" · "}
              {differenceInMinutes(new Date(job.actualEndAt!), new Date(job.actualStartAt!))} min
            </p>
          </div>
        )}

        {/* Details card */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Details</p>
          </div>
          <div className="divide-y divide-gray-800">
            {/* Scheduled time */}
            {job.scheduledAt && (
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                  </svg>
                </div>
                <div>
                  <p className="text-white text-sm font-medium">
                    {format(new Date(job.scheduledAt), "EEEE, MMMM d")}
                  </p>
                  <p className="text-gray-500 text-xs">{format(new Date(job.scheduledAt), "h:mm a")}</p>
                </div>
              </div>
            )}

            {/* Address */}
            <div className="px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium leading-snug">{job.propertyAddress}</p>
              </div>
              <a
                href={`https://maps.apple.com/?q=${encodeURIComponent(job.propertyAddress)}`}
                className="shrink-0 text-blue-400 text-xs font-medium py-1 px-2 bg-blue-900/30 rounded-lg"
              >
                Maps
              </a>
            </div>

            {/* Property map */}
            {job.propertyLat && job.propertyLng && (
              <div className="px-4 pb-2">
                <MapboxMap
                  center={{ lat: job.propertyLat, lng: job.propertyLng }}
                  markers={[{ lat: job.propertyLat, lng: job.propertyLng, color: "#3B82F6" }]}
                  height={160}
                  zoom={14}
                  interactive={false}
                  showControls={false}
                />
              </div>
            )}

            {/* Client */}
            {job.client && (
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                    <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">
                    {job.client.firstName} {job.client.lastName}
                  </p>
                  {job.client.phone && (
                    <p className="text-gray-500 text-xs">{job.client.phone}</p>
                  )}
                </div>
                {job.client.phone && (
                  <a
                    href={`tel:${job.client.phone}`}
                    className="shrink-0 text-green-400 text-xs font-medium py-1 px-2 bg-green-900/30 rounded-lg"
                  >
                    Call
                  </a>
                )}
              </div>
            )}

            {/* Package */}
            {job.package && (
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                    <path d="m7.5 4.27 9 5.15M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>
                  </svg>
                </div>
                <p className="text-white text-sm font-medium">{job.package.name}</p>
              </div>
            )}
          </div>
        </div>

        {/* Services */}
        {job.services && job.services.length > 0 && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Services</p>
            </div>
            <div className="px-4 py-3 flex flex-wrap gap-2">
              {job.services.map((s: { service: { id: string; name: string } }) => (
                <span key={s.service.id} className="text-xs bg-gray-800 text-gray-300 px-3 py-1 rounded-full">
                  {s.service.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Field notes */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Field Notes</p>
          </div>
          <div className="p-4">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add notes from the field…"
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <button
              onClick={handleSaveNote}
              disabled={saveNoteMutation.isPending}
              className="mt-2 w-full py-2.5 bg-gray-700 hover:bg-gray-600 active:bg-gray-700 text-gray-200 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              {noteSaved ? "✓ Saved" : saveNoteMutation.isPending ? "Saving…" : "Save Note"}
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-3 pb-4">
          {/* Upload photos */}
          <button
            onClick={() => router.push(`/mobile/jobs/${jobId}/upload`)}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-2xl font-semibold text-base transition-colors flex items-center justify-center gap-2"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Upload Photos
          </button>

          {/* Clock in/out */}
          {canClockIn && (
            <button
              onClick={handleClockIn}
              disabled={clockInMutation.isPending}
              className="w-full py-4 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-2xl font-semibold text-base transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              {clockInMutation.isPending ? "Clocking in…" : "Clock In"}
            </button>
          )}

          {isClockedIn && (
            <button
              onClick={handleClockOut}
              disabled={clockOutMutation.isPending}
              className="w-full py-4 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white rounded-2xl font-semibold text-base transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><rect x="9" y="9" width="6" height="6"/>
              </svg>
              {clockOutMutation.isPending ? "Clocking out…" : "Clock Out"}
            </button>
          )}

          {/* Mark complete */}
          {canComplete && (
            <button
              onClick={handleComplete}
              disabled={completeJobMutation.isPending}
              className="w-full py-4 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-gray-200 rounded-2xl font-semibold text-base transition-colors disabled:opacity-50 flex items-center justify-center gap-2 border border-gray-700"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6 9 17l-5-5"/>
              </svg>
              {completeJobMutation.isPending ? "Completing…" : "Mark Complete"}
            </button>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
