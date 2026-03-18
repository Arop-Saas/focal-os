"use server";

import prisma from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function assertSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
    select: { isSuperAdmin: true },
  });
  if (!dbUser?.isSuperAdmin) throw new Error("Forbidden");
}

export async function sendBroadcast(formData: FormData): Promise<{ count: number }> {
  await assertSuperAdmin();

  const title = (formData.get("title") as string).trim();
  const body = (formData.get("body") as string).trim();
  const targetStatus = (formData.get("targetStatus") as string) || null;

  if (!title || !body) throw new Error("Title and body are required.");

  const workspaces = await prisma.workspace.findMany({
    where: targetStatus ? { subscriptionStatus: targetStatus as never } : undefined,
    select: { id: true },
  });

  if (workspaces.length === 0) return { count: 0 };

  await prisma.notification.createMany({
    data: workspaces.map((ws) => ({
      workspaceId: ws.id,
      userId: null,
      type: "SYSTEM" as const,
      channel: "IN_APP" as const,
      status: "SENT" as const,
      title,
      body,
      sentAt: new Date(),
    })),
  });

  revalidatePath("/admin/broadcast");
  return { count: workspaces.length };
}
