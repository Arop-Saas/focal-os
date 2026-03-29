import prisma from "@/lib/prisma";
import { WindowViewClient } from "./window-view-client";

export const metadata = { title: "Window View" };

export default async function WindowViewPage() {
  const workspaces = await prisma.workspace.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <WindowViewClient workspaces={workspaces} />
    </div>
  );
}
