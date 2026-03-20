import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/resolve-workspace";
import { Header } from "@/components/layout/header";
import { ArrowLeft, Mail, Phone, User, Briefcase } from "lucide-react";
import Link from "next/link";
import { StaffAvailabilityEditor } from "@/components/staff/staff-availability-editor";
import { format } from "date-fns";

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

  const initial = staffUser.fullName?.[0]?.toUpperCase() ?? "S";

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title={staffUser.fullName ?? "Staff Member"}
        description={staff.member.role ?? "Team Member"}
        actions={
          <Link
            href="/staff"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to staff
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left column — profile card */}
          <div className="space-y-5">
            <div className="bg-white rounded-xl border p-5">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="h-16 w-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                  {staff.avatarUrl ? (
                    <img src={staff.avatarUrl} className="h-16 w-16 rounded-full object-cover" alt="" />
                  ) : initial}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{staffUser.fullName}</p>
                  <p className="text-sm text-gray-500">{staff.member.role ?? "Staff"}</p>
                  <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                    staff.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {staff.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-2.5 text-sm">
                {staffUser.email && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{staffUser.email}</span>
                  </div>
                )}
                {staffUser.phone && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span>{staffUser.phone}</span>
                  </div>
                )}
                {staff.bio && (
                  <p className="text-gray-500 text-xs pt-2 border-t">{staff.bio}</p>
                )}
              </div>
            </div>

            {/* Recent jobs */}
            <div className="bg-white rounded-xl border p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-gray-400" /> Recent Jobs
              </h3>
              {staff.jobAssignments.length === 0 ? (
                <p className="text-xs text-gray-400">No jobs assigned yet.</p>
              ) : (
                <div className="space-y-2">
                  {staff.jobAssignments.map(({ job }) => (
                    <Link
                      key={job.id}
                      href={`/jobs/${job.id}`}
                      className="block text-xs hover:bg-gray-50 rounded-lg p-2 -mx-2 transition-colors"
                    >
                      <p className="font-medium text-gray-800 truncate">{job.propertyAddress}</p>
                      <p className="text-gray-400 mt-0.5">
                        #{job.jobNumber}
                        {job.scheduledAt ? ` · ${format(new Date(job.scheduledAt), "MMM d")}` : ""}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right column — availability */}
          <div className="lg:col-span-2">
            <StaffAvailabilityEditor
              staffId={staff.id}
              staffName={staffUser.fullName ?? "Staff"}
              initialAvailability={initialAvailability}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
