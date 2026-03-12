import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { ScheduleView } from "@/components/scheduling/schedule-view";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Scheduling" };

export default async function SchedulingPage() {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser!.id },
    include: { workspaces: { include: { workspace: true }, take: 1 } },
  });

  const workspaceId = user!.workspaces[0].workspace.id;

  // Fetch jobs for the next 30 days
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const jobs = await prisma.job.findMany({
    where: {
      workspaceId,
      scheduledAt: {
        gte: now,
        lte: thirtyDaysFromNow,
      },
      status: { notIn: ["CANCELLED"] },
    },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      assignments: {
        where: { isPrimary: true },
        include: {
          staff: {
            include: {
              member: {
                include: {
                  user: { select: { id: true, fullName: true, avatarUrl: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { scheduledAt: "asc" },
  });

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Scheduling"
        description="Manage and view scheduled jobs"
        actions={
          <Button size="sm" asChild>
            <Link href="/jobs/new">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Schedule Job
            </Link>
          </Button>
        }
      />
      <div className="flex-1 overflow-hidden p-6">
        <ScheduleView jobs={jobs} />
      </div>
    </div>
  );
}
