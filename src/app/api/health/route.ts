import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Quick DB ping
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ok", timestamp: new Date().toISOString() },
      { status: 200 }
    );
  } catch (err) {
    console.error("[health] DB check failed:", err);
    return NextResponse.json(
      { status: "error", message: "Database unreachable" },
      { status: 503 }
    );
  }
}
