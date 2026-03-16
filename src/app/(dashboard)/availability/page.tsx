import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { AvailabilityEditor } from "@/components/availability/availability-editor";

export const metadata = { title: "Availability" };
export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser!.id },
    include: { workspaces: { include: { workspace: true }, take: 1 } },
  });

  const workspaceId = user!.workspaces[0].workspace.id;

  const rows = await prisma.workspaceHours.findMany({
    where: { workspaceId },
    orderBy: { dayOfWeek: "asc" },
  });

  const DEFAULT_HOURS = [
    { dayOfWeek: 0, isOpen: false, openTime: "09:00", closeTime: "17:00" },
    { dayOfWeek: 1, isOpen: true,  openTime: "09:00", closeTime: "17:00" },
    { dayOfWeek: 2, isOpen: true,  openTime: "09:00", closeTime: "17:00" },
    { dayOfWeek: 3, isOpen: true,  openTime: "09:00", closeTime: "17:00" },
    { dayOfWeek: 4, isOpen: true,  openTime: "09:00", closeTime: "17:00" },
    { dayOfWeek: 5, isOpen: true,  openTime: "09:00", closeTime: "17:00" },
    { dayOfWeek: 6, isOpen: false, openTime: "09:00", closeTime: "17:00" },
  ];

  const initialHours = DEFAULT_HOURS.map((def) => {
    const row = rows.find((r) => r.dayOfWeek === def.dayOfWeek);
    return {
      dayOfWeek: def.dayOfWeek,
      isOpen: row ? row.isOpen : def.isOpen,
      openTime: row ? row.openTime : def.openTime,
      closeTime: row ? row.closeTime : def.closeTime,
    };
  });

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Availability"
        description="Set your studio's weekly business hours"
      />
      <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <AvailabilityEditor initialHours={initialHours} />
      </div>
    </div>
  );
}
