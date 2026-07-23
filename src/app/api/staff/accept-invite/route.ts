import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json() as { token: string; password: string };

    if (!token || !password || password.length < 8) {
      return NextResponse.json({ error: "Token and a password of at least 8 characters are required." }, { status: 400 });
    }

    // Look up the invite
    const invite = await prisma.staffInvite.findUnique({ where: { token } });

    if (!invite) {
      return NextResponse.json({ error: "Invalid invite link." }, { status: 404 });
    }
    if (invite.usedAt) {
      return NextResponse.json({ error: "This invite has already been used." }, { status: 410 });
    }
    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "This invite has expired. Ask your manager to resend it." }, { status: 410 });
    }

    const adminSupabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if a Supabase user already exists with this email
    const { data: existingList } = await adminSupabase.auth.admin.listUsers();
    const existingAuthUser = existingList?.users.find((u) => u.email === invite.email);

    let supabaseUserId: string;

    if (existingAuthUser) {
      // User exists — just update their password
      const { error } = await adminSupabase.auth.admin.updateUserById(existingAuthUser.id, {
        password,
        user_metadata: { full_name: invite.fullName },
      });
      if (error) throw error;
      supabaseUserId = existingAuthUser.id;
    } else {
      // Create brand new Supabase auth user
      const { data: newUser, error } = await adminSupabase.auth.admin.createUser({
        email: invite.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: invite.fullName },
      });
      if (error || !newUser.user) throw error ?? new Error("Failed to create user");
      supabaseUserId = newUser.user.id;
    }

    // Upsert Prisma user
    let user = await prisma.user.findUnique({ where: { email: invite.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          supabaseId: supabaseUserId,
          email: invite.email,
          fullName: invite.fullName,
          firstName: invite.fullName.split(" ")[0] ?? null,
          lastName: invite.fullName.split(" ").slice(1).join(" ") || null,
          phone: invite.phone ?? null,
        },
      });
    } else {
      // Ensure supabaseId is linked
      if (!user.supabaseId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { supabaseId: supabaseUserId, fullName: invite.fullName },
        });
      }
    }

    // Check if already a member (edge case: re-invited)
    const existingMember = await prisma.workspaceMember.findFirst({
      where: { workspaceId: invite.workspaceId, userId: user.id },
    });

    if (!existingMember) {
      await prisma.$transaction(async (tx) => {
        const member = await tx.workspaceMember.create({
          data: {
            workspaceId: invite.workspaceId,
            userId: user!.id,
            role: invite.role as "OWNER" | "ADMIN" | "MANAGER" | "PHOTOGRAPHER" | "EDITOR" | "VA" | "VIEWER",
          },
        });

        await tx.staffProfile.create({
          data: {
            workspaceId: invite.workspaceId,
            memberId: member.id,
            skills: [],
            serviceRegions: [],
          },
        });
      });
    }

    // Mark invite as used
    await prisma.staffInvite.update({
      where: { token },
      data: { usedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Accept invite error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
