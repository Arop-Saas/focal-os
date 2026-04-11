import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/resolve-workspace";
import { Header } from "@/components/layout/header";
import { AvailabilityTabs } from "@/components/availability/availability-tabs";

export const metadata = { title: "Availability" };
export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  const workspaceId = await resolveWorkspaceId(supabaseUser!.id);

  // Load business hours
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

  // Load buffer mins
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { jobBufferMins: true },
  });
  const initialBufferMins = workspace?.jobBufferMins ?? 15;

  // Load territories
  const [territories, staffProfiles] = await Promise.all([
    prisma.serviceTerritory.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.staffProfile.findMany({
      where: { workspaceId, isActive: true },
      include: { member: { include: { user: { select: { fullName: true, email: true } } } } },
      orderBy: { member: { user: { fullName: "asc" } } },
    }),
  ]);

  const staffMembers = staffProfiles.map((sp) => ({
    id: sp.id,
    name: sp.member.user.fullName,
    email: sp.member.user.email,
    title: sp.title,
  }));

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Availability"
        description="Manage your business hours and service territories"
      />
      <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <AvailabilityTabs
          initialHours={initialHours}
          initialBufferMins={initialBufferMins}
          initialTerritories={territories.map((t) => ({
            id: t.id,
            name: t.name,
            color: t.color,
            description: t.description,
            cities: t.cities,
            travelFee: t.travelFee,
            boundaryType: t.boundaryType,
            polygonCoords: t.polygonCoords as [number, number][] | null,
            centerLat: t.centerLat,
            centerLng: t.centerLng,
            radiusKm: t.radiusKm,
          }))}
          staffMembers={staffMembers}
        />
      </div>
    </div>
  );
}
