import { MessagesInbox } from "@/components/messages/messages-inbox";
import { CollabTabs } from "@/components/collaboration/collab-tabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Collaboration" };

/**
 * Collaboration hub. "Order Notes" (client conversations per order) is live;
 * Channels, DMs, Tasks, Announcements, Recognition and the Team Feed ship on
 * this page as they come online.
 */
export default function CollaborationPage() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Collaboration</h1>
          <p className="text-xs text-muted-foreground">Messages, notes and teamwork in one place</p>
        </div>
      </div>
      <CollabTabs active="order-notes" />
      <MessagesInbox />
    </div>
  );
}
