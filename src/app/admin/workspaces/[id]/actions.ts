"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
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

export async function impersonateWorkspace(workspaceId: string) {
  await assertSuperAdmin();
  const cookieStore = await cookies();
  cookieStore.set("admin_impersonating", workspaceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 8, // 8 hours
    path: "/",
  });
  redirect("/");
}

export async function exitImpersonation() {
  await assertSuperAdmin();
  const cookieStore = await cookies();
  cookieStore.delete("admin_impersonating");
  redirect("/admin");
}

export async function deleteWorkspace(workspaceId: string) {
  await assertSuperAdmin();

  // All child models have onDelete: Cascade in the schema, so a single
  // delete is sufficient — Postgres handles the cascade automatically.
  await prisma.workspace.delete({ where: { id: workspaceId } });

  // Return instead of redirect() — calling redirect() from a Server Action
  // invoked via useTransition in a Client Component causes a client-side crash.
  // Navigation is handled in the component after the action resolves.
  return { success: true };
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
