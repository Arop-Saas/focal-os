"use server";

import prisma from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { FeatureRequestStatus } from "@prisma/client";

async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return prisma.user.findUnique({
    where: { supabaseId: user.id },
    select: { id: true, fullName: true, isSuperAdmin: true },
  });
}

export type FeatureRequestWithMeta = {
  id: string;
  title: string;
  description: string | null;
  status: FeatureRequestStatus;
  authorName: string | null;
  pinned: boolean;
  createdAt: Date;
  _count: { votes: number };
  hasVoted: boolean;
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
      _count: { select: { votes: true } },
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
      authorName: r.authorName,
      pinned: r.pinned,
      createdAt: r.createdAt,
      _count: r._count,
      hasVoted: Array.isArray(r.votes) ? r.votes.length > 0 : false,
    })),
  };
}

export async function submitFeatureRequest(formData: FormData) {
  const user = await getCurrentUser();

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;

  if (!title || title.length < 5) {
    throw new Error("Title must be at least 5 characters.");
  }
  if (title.length > 120) {
    throw new Error("Title must be under 120 characters.");
  }

  await prisma.featureRequest.create({
    data: {
      title,
      description,
      authorId: user?.id ?? null,
      authorName: user?.fullName ?? "Anonymous",
      status: "PLANNED",
    },
  });

  revalidatePath("/feedback");
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
