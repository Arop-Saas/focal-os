import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { MessagesInbox } from "@/components/messages/messages-inbox";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  // Auth check only — the client component fetches data via tRPC
  await prisma.user.findUnique({
    where: { supabaseId: supabaseUser!.id },
    select: { id: true },
  });

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="h-16 border-b bg-white flex items-center px-6 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Messages</h1>
          <p className="text-xs text-muted-foreground">Client conversations across all jobs</p>
        </div>
      </div>
      <MessagesInbox />
    </div>
  );
}
