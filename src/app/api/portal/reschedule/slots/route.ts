/**
 * GET /api/portal/reschedule/slots?slug=&jobId=&date=YYYY-MM-DD (S8)
 *
 * Engine-computed slots for rescheduling THIS job: same duration resolution
 * (package/services) and the same travel/conflict rules as every other
 * surface. Assigned jobs intersect availability across all assigned
 * photographers; unassigned jobs take the union across active staff.
 */
import { NextRequest, NextResponse } from "next/server";
import { getPortalSession } from "@/lib/portal-session";
import prisma from "@/lib/prisma";
import { getDayAvailability } from "@/lib/scheduling/loader";

export const dynamic = "force-dynamic";

const MIN_NOTICE_HOURS = 24; // keep in lockstep with ../route.ts

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const slug = searchParams.get("slug");
    const jobId = searchParams.get("jobId");
    const date = searchParams.get("date");

    if (!slug || !jobId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const session = await getPortalSession(slug);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        workspaceId: session.workspace.id,
        clientId: session.client.id,
      },
      include: {
        services: { select: { serviceId: true } },
        assignments: { select: { staffId: true } },
      },
    });
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const address = [job.propertyAddress, job.propertyCity, job.propertyState, job.propertyZip]
      .filter(Boolean)
      .join(", ");
    const serviceIds = job.services.map((s) => s.serviceId);
    const staffIds = job.assignments.map((a) => a.staffId);

    const baseArgs = {
      workspaceId: session.workspace.id,
      dateISO: date,
      packageId: job.packageId ?? undefined,
      serviceIds: serviceIds.length ? serviceIds : undefined,
      targetAddress: address || null,
    };

    let timezone = session.workspace.timezone;
    let durationMins = job.estimatedDurationMins ?? 60;
    let instants: string[] = [];

    if (staffIds.length > 0) {
      // New time must work for EVERY assigned photographer → intersect.
      // (Set.forEach only — the tsconfig target predates Set iteration.)
      let intersection: Set<string> | null = null;
      for (const staffId of staffIds) {
        const day = await getDayAvailability(prisma, { ...baseArgs, staffProfileId: staffId });
        timezone = day.timezone;
        durationMins = day.durationMins;
        const mine = new Set<string>();
        day.staffSlots.forEach((s) => s.slots.forEach((d) => mine.add(d.toISOString())));
        if (intersection === null) {
          intersection = mine;
        } else {
          const next = new Set<string>();
          intersection.forEach((iso) => {
            if (mine.has(iso)) next.add(iso);
          });
          intersection = next;
        }
        if (intersection.size === 0) break;
      }
      (intersection ?? new Set<string>()).forEach((iso) => instants.push(iso));
    } else {
      const day = await getDayAvailability(prisma, baseArgs);
      timezone = day.timezone;
      durationMins = day.durationMins;
      const seen = new Set<string>();
      day.staffSlots.forEach((s) => s.slots.forEach((d) => seen.add(d.toISOString())));
      seen.forEach((iso) => instants.push(iso));
    }

    const cutoff = Date.now() + MIN_NOTICE_HOURS * 3600e3;
    const slots = instants
      .filter((iso) => new Date(iso).getTime() >= cutoff)
      .sort();

    return NextResponse.json({ timezone, durationMins, slots });
  } catch (err) {
    console.error("[portal reschedule slots] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
