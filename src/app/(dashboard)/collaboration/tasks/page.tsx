import { CollabTabs } from "@/components/collaboration/collab-tabs";
import { TeamTasksBoard } from "@/components/collaboration/team-tasks-board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tasks" };

export default function CollaborationTasksPage() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Collaboration</h1>
          <p className="text-xs text-muted-foreground">Messages, notes and teamwork in one place</p>
        </div>
      </div>
      <CollabTabs active="tasks" />
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <TeamTasksBoard />
      </div>
    </div>
  );
}
