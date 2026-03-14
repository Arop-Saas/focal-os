import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual, scryptSync, randomBytes } from "crypto";
import prisma from "@/lib/prisma";

const SECRET = process.env.CRON_SECRET ?? "focal-portal-secret";

interface ResetPayload {
  clientId: string;
  email: string;
  workspaceSlug: string;
  exp: number;
  purpose: string;
}

function verifyResetToken(token: string): ResetPayload | null {
  try {
    const dotIdx = token.lastIndexOf(".");
    if (dotIdx === -1) return null;
    const payload = token.slice(0, dotIdx);
    const sig = token.slice(dotIdx + 1);
    const expectedSig = createHmac("sha256", SECRET + ":reset").update(payload).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;
    const data: ResetPayload = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (data.purpose !== "reset") return null;
    if (data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    const data = verifyResetToken(token);
    if (!data) {
      return NextResponse.json({ error: "Reset link is invalid or has expired." }, { status: 400 });
    }

    await prisma.client.update({
      where: { id: data.clientId },
      data: { passwordHash: hashPassword(password) },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[portal/reset-password]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
