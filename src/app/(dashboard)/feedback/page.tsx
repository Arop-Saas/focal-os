import { getFeatureRequests } from "@/lib/feedback-actions";
import { FeedbackBoard } from "./feedback-board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Feature Requests · Scalist" };

export default async function FeedbackPage() {
  const { items, userId } = await getFeatureRequests();

  const planned    = items.filter((r) => r.status === "PLANNED");
  const inProgress = items.filter((r) => r.status === "IN_PROGRESS");
  const inBeta     = items.filter((r) => r.status === "IN_BETA");

  return (
    <div className="p-8 space-y-8 min-h-screen">
      {/* Header */}
      <div>
        <p className="text-[10px] tracking-widest uppercase text-blue-400 mb-1 font-bold">◈ FEEDBACK</p>
        <h1 className="text-2xl font-bold text-white tracking-tight">Feature Requests</h1>
        <p className="text-xs text-slate-500 mt-0.5 font-mono">
          Vote for features you want to see, or submit a new idea.
        </p>
      </div>

      <FeedbackBoard
        planned={planned}
        inProgress={inProgress}
        inBeta={inBeta}
        userId={userId}
      />
    </div>
  );
}
