import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/resolve-workspace";
import { Header } from "@/components/layout/header";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { TeamMemberSettings } from "@/components/staff/team-member-settings";

export const dynamic = "force-dynamic";

export default async function StaffDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  const workspaceId = await resolveWorkspaceId(supabaseUser!.id);

  const staff = await prisma.staffProfile.findFirst({
    where: { id: params.id, workspaceId },
    include: {
      member: { include: { user: true } },
      availability: { orderBy: { dayOfWeek: "asc" } },
      jobAssignments: {
        include: { job: { select: { id: true, jobNumber: true, propertyAddress: true, scheduledAt: true, status: true } } },
        orderBy: { job: { scheduledAt: "desc" } },
        take: 5,
      },
    },
  });

  if (!staff) notFound();

  const staffUser = staff.member.user;

  const DEFAULT_AVAIL = [
    { dayOfWeek: 0, isAvailable: false, startTime: "09:00", endTime: "17:00" },
    { dayOfWeek: 1, isAvailable: true,  startTime: "09:00", endTime: "17:00" },
    { dayOfWeek: 2, isAvailable: true,  startTime: "09:00", endTime: "17:00" },
    { dayOfWeek: 3, isAvailable: true,  startTime: "09:00", endTime: "17:00" },
    { dayOfWeek: 4, isAvailable: true,  startTime: "09:00", endTime: "17:00" },
    { dayOfWeek: 5, isAvailable: true,  startTime: "09:00", endTime: "17:00" },
    { dayOfWeek: 6, isAvailable: false, startTime: "09:00", endTime: "17:00" },
  ];

  const initialAvailability = DEFAULT_AVAIL.map((def) => {
    const row = staff.availability.find((r) => r.dayOfWeek === def.dayOfWeek);
    return row
      ? { dayOfWeek: row.dayOfWeek, isAvailable: row.isAvailable, startTime: row.startTime, endTime: row.endTime }
      : def;
  });

  const staffData = {
    ...staff,
    member: {
      ...staff.member,
      user: {
        ...staff.member.user,
        phone: (staff.member.user as any).phone ?? null,
      },
    },
    availability: initialAvailability,
    jobAssignments: staff.jobAssignments.map(({ job }) => ({
      job: {
        ...job,
        scheduledAt: job.scheduledAt ? new Date(job.scheduledAt) : null,
      },
    })),
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title={staffUser.fullName ?? "Team Member"}
        description={staff.member.role ?? "Team Member"}
        actions={
          <Link
            href="/staff"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to team
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <TeamMemberSettings staff={staffData as any} initialAvailability={initialAvailability} />
      </div>
    </div>
  );
}
