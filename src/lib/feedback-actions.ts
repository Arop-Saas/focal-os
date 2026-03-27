"use server";

import prisma from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { FeatureRequestStatus, FeatureRequestCategory } from "@prisma/client";

async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return prisma.user.findUnique({
    where: { supabaseId: user.id },
    select: { id: true, fullName: true, isSuperAdmin: true },
  });
}

export const CATEGORY_META: Record<FeatureRequestCategory, { label: string; color: string; dot: string }> = {
  GENERAL:       { label: "General",       color: "bg-slate-500/10 text-slate-400 border-slate-500/20",   dot: "bg-slate-400" },
  DASHBOARD:     { label: "Dashboard",     color: "bg-violet-500/10 text-violet-400 border-violet-500/20", dot: "bg-violet-400" },
  CLIENT_PORTAL: { label: "Client Portal", color: "bg-blue-500/10 text-blue-400 border-blue-500/20",       dot: "bg-blue-400" },
  JOBS:          { label: "Jobs",          color: "bg-amber-500/10 text-amber-400 border-amber-500/20",    dot: "bg-amber-400" },
  INVOICING:     { label: "Invoicing",     color: "bg-green-500/10 text-green-400 border-green-500/20",    dot: "bg-green-400" },
  CALENDAR:      { label: "Calendar",      color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",       dot: "bg-cyan-400" },
  MOBILE_APP:    { label: "Mobile App",    color: "bg-pink-500/10 text-pink-400 border-pink-500/20",       dot: "bg-pink-400" },
  INTEGRATIONS:  { label: "Integrations",  color: "bg-orange-500/10 text-orange-400 border-orange-500/20", dot: "bg-orange-400" },
};

export type FeatureRequestWithMeta = {
  id: string;
  title: string;
  description: string | null;
  status: FeatureRequestStatus;
  category: FeatureRequestCategory;
  authorId: string | null;
  authorName: string | null;
  pinned: boolean;
  createdAt: Date;
  _count: { votes: number; comments: number };
  hasVoted: boolean;
};

export type FeatureRequestComment = {
  id: string;
  body: string;
  authorName: string | null;
  createdAt: Date;
};

export async function getFeatureRequests(): Promise<{
  items: FeatureRequestWithMeta[];
  userId: string | null;
}> {
  const user = await getCurrentUser();

  const requests = await prisma.featureRequest.findMany({
    where: { status: { not: "COMPLETED" } },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { votes: true, comments: true } },
      votes: user ? { where: { userId: user.id }, select: { id: true } } : false,
    },
  });

  return {
    userId: user?.id ?? null,
    items: requests.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      status: r.status,
      category: r.category,
      authorId: r.authorId,
      authorName: r.authorName,
      pinned: r.pinned,
      createdAt: r.createdAt,
      _count: r._count,
      hasVoted: Array.isArray(r.votes) ? r.votes.length > 0 : false,
    })),
  };
}

export async function getComments(featureRequestId: string): Promise<FeatureRequestComment[]> {
  const comments = await prisma.featureRequestComment.findMany({
    where: { featureRequestId },
    orderBy: { createdAt: "asc" },
    select: { id: true, body: true, authorName: true, createdAt: true },
  });
  return comments;
}

export async function addComment(featureRequestId: string, body: string) {
  const user = await getCurrentUser();

  const trimmed = body?.trim();
  if (!trimmed || trimmed.length < 2) throw new Error("Comment is too short.");
  if (trimmed.length > 1000) throw new Error("Comment must be under 1000 characters.");

  await prisma.featureRequestComment.create({
    data: {
      featureRequestId,
      body: trimmed,
      authorId: user?.id ?? null,
      authorName: user?.fullName ?? "Anonymous",
    },
  });

  revalidatePath("/feedback");
}

export async function submitFeatureRequest(formData: FormData) {
  const user = await getCurrentUser();

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const categoryRaw = (formData.get("category") as string) || "GENERAL";
  const category = (categoryRaw in CATEGORY_META ? categoryRaw : "GENERAL") as FeatureRequestCategory;

  if (!title || title.length < 5) throw new Error("Title must be at least 5 characters.");
  if (title.length > 120) throw new Error("Title must be under 120 characters.");

  await prisma.featureRequest.create({
    data: {
      title,
      description,
      category,
      authorId: user?.id ?? null,
      authorName: user?.fullName ?? "Anonymous",
      status: "PLANNED",
    },
  });

  revalidatePath("/feedback");
}

export async function updateFeatureRequest(id: string, title: string, description: string | null) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated.");

  const request = await prisma.featureRequest.findUnique({ where: { id }, select: { authorId: true } });
  if (!request) throw new Error("Feature request not found.");
  if (request.authorId !== user.id && !user.isSuperAdmin) throw new Error("Not authorised to edit this request.");

  const trimTitle = title?.trim();
  if (!trimTitle || trimTitle.length < 5) throw new Error("Title must be at least 5 characters.");
  if (trimTitle.length > 120) throw new Error("Title must be under 120 characters.");

  await prisma.featureRequest.update({
    where: { id },
    data: { title: trimTitle, description: description?.trim() || null },
  });

  revalidatePath("/feedback");
}

export async function deleteFeatureRequest(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated.");

  const request = await prisma.featureRequest.findUnique({ where: { id }, select: { authorId: true } });
  if (!request) throw new Error("Feature request not found.");
  if (request.authorId !== user.id && !user.isSuperAdmin) throw new Error("Not authorised to delete this request.");

  await prisma.featureRequest.delete({ where: { id } });

  revalidatePath("/feedback");
}

export async function adminUpdateStatus(id: string, status: FeatureRequestStatus) {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) throw new Error("Not authorised.");
  await prisma.featureRequest.update({ where: { id }, data: { status } });
  revalidatePath("/feedback");
  revalidatePath("/admin/feature-requests");
}

export async function adminUpdateCategory(id: string, category: FeatureRequestCategory) {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) throw new Error("Not authorised.");
  await prisma.featureRequest.update({ where: { id }, data: { category } });
  revalidatePath("/feedback");
  revalidatePath("/admin/feature-requests");
}

export async function adminTogglePin(id: string, pinned: boolean) {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) throw new Error("Not authorised.");
  await prisma.featureRequest.update({ where: { id }, data: { pinned } });
  revalidatePath("/feedback");
  revalidatePath("/admin/feature-requests");
}

export async function adminDeleteRequest(id: string) {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) throw new Error("Not authorised.");
  await prisma.featureRequest.delete({ where: { id } });
  revalidatePath("/feedback");
  revalidatePath("/admin/feature-requests");
}

export async function getAllFeatureRequestsForAdmin() {
  const requests = await prisma.featureRequest.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { votes: true, comments: true } } },
  });
  return requests;
}

export async function toggleVote(featureRequestId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be logged in to vote.");

  const existing = await prisma.featureRequestVote.findUnique({
    where: { featureRequestId_userId: { featureRequestId, userId: user.id } },
  });

  if (existing) {
    await prisma.featureRequestVote.delete({ where: { id: existing.id } });
  } else {
    await prisma.featureRequestVote.create({
      data: { featureRequestId, userId: user.id },
    });
  }

  revalidatePath("/feedback");
}
