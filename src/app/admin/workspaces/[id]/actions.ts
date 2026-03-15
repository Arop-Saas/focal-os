"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type SubscriptionStatus = "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "PAUSED";

async function assertSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
    select: { isSuperAdmin: true },
  });
  if (!dbUser?.isSuperAdmin) throw new Error("Forbidden — superAdmin required");
}

export async function setWorkspaceStatus(workspaceId: string, status: SubscriptionStatus) {
  await assertSuperAdmin();
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { subscriptionStatus: status },
  });
  revalidatePath(`/admin/workspaces/${workspaceId}`);
  revalidatePath("/admin/workspaces");
  revalidatePath("/admin");
}

export async function extendTrial(workspaceId: string, days: number) {
  await assertSuperAdmin();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { trialEndsAt: true },
  });
  const base = ws?.trialEndsAt && ws.trialEndsAt > new Date() ? ws.trialEndsAt : new Date();
  const newEnd = new Date(base);
  newEnd.setDate(newEnd.getDate() + days);

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      trialEndsAt: newEnd,
      subscriptionStatus: "TRIALING",
    },
  });
  revalidatePath(`/admin/workspaces/${workspaceId}`);
}
