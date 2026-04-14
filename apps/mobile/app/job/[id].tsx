import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { format, parseISO, differenceInSeconds } from "date-fns";
import { trpc } from "@/lib/trpc";
import { useAppStore } from "@/lib/store";
import { COLORS, JOB_STATUS } from "@/constants/config";

// ─── Live Timer Component ─────────────────────────────────────────────────────

function LiveTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = parseISO(startedAt);
    const tick = () => setElapsed(differenceInSeconds(new Date(), start));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const hrs = Math.floor(elapsed / 3600);
  const mins = Math.floor((elapsed % 3600) / 60);
  const secs = elapsed % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <Text style={{ fontSize: 32, fontWeight: "800", color: COLORS.success, fontVariant: ["tabular-nums"] }}>
      {pad(hrs)}:{pad(mins)}:{pad(secs)}
    </Text>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const utils = trpc.useUtils();

  const activeJobId = useAppStore((s) => s.activeJobId);
  const clockedInAt = useAppStore((s) => s.clockedInAt);
  const setActiveJob = useAppStore((s) => s.setActiveJob);

  const { data: job, isLoading } = trpc.mobile.getJob.useQuery({ jobId: id! }, { enabled: !!id });

  const clockInMutation = trpc.mobile.clockIn.useMutation({
    onSuccess: (data: any) => {
      setActiveJob(id!, data.actualStartAt ?? new Date().toISOString());
      utils.mobile.getJob.invalidate({ jobId: id! });
    },
    onError: (err: any) => Alert.alert("Error", err.message),
  });

  const clockOutMutation = trpc.mobile.clockOut.useMutation({
    onSuccess: () => {
      setActiveJob(null, null);
      utils.mobile.getJob.invalidate({ jobId: id! });
    },
    onError: (err: any) => Alert.alert("Error", err.message),
  });

  const completeMutation = trpc.mobile.completeJob.useMutation({
    onSuccess: () => {
      utils.mobile.getJob.invalidate({ jobId: id! });
      utils.mobile.getMyJobs.invalidate();
    },
    onError: (err: any) => Alert.alert("Error", err.message),
  });

  // Sync active job from DB data
  useEffect(() => {
    if ((job as any)?.actualStartAt && !(job as any)?.actualEndAt) {
      setActiveJob(id!, (job as any).actualStartAt);
    }
  }, [job, id, setActiveJob]);

  function openNavigation() {
    const j = job as any;
    if (!j?.propertyLat || !j?.propertyLng) {
      Alert.alert("No location", "This job doesn't have GPS coordinates.");
      return;
    }

    const address = encodeURIComponent(j.propertyAddress ?? "");
    const url = Platform.select({
      ios: `maps://?daddr=${j.propertyLat},${j.propertyLng}&q=${address}`,
      android: `google.navigation:q=${j.propertyLat},${j.propertyLng}`,
    });

    if (url) Linking.openURL(url).catch(() => {
      // Fallback to Google Maps web
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${j.propertyLat},${j.propertyLng}`);
    });
  }

  function handleClockIn() {
    Alert.alert("Clock In", "Start working on this job?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clock In", onPress: () => clockInMutation.mutate({ jobId: id! }) },
    ]);
  }

  function handleClockOut() {
    Alert.alert("Clock Out", "Finished on site?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clock Out", onPress: () => clockOutMutation.mutate({ jobId: id! }) },
    ]);
  }

  function handleComplete() {
    Alert.alert("Complete Job", "Mark this job as completed?", [
      { text: "Cancel", style: "cancel" },
      { text: "Complete", onPress: () => completeMutation.mutate({ jobId: id! }) },
    ]);
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.gray50 }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const j = job as any;
  if (!j) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.gray50 }}>
        <Text style={{ color: COLORS.gray500 }}>Job not found</Text>
      </View>
    );
  }

  const status = JOB_STATUS[j.status] ?? JOB_STATUS.PENDING;
  const scheduledDate = j.scheduledAt ? parseISO(j.scheduledAt) : null;
  const isClockedIn = activeJobId === id && !!clockedInAt;
  const isCompleted = j.status === "COMPLETED" || j.status === "DELIVERED";
  const hasClockedOut = !!j.actualEndAt;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.gray50, paddingTop: insets.top }}>
      {/* Top Bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: COLORS.white,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.gray100,
          gap: 12,
        }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ fontSize: 18, color: COLORS.primary }}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <View style={{ backgroundColor: status.bg, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: status.color }}>{status.label}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {/* Job Number */}
        <Text style={{ fontSize: 12, fontWeight: "700", color: COLORS.gray400, marginBottom: 4 }}>
          {j.jobNumber}
        </Text>

        {/* Address */}
        <Text style={{ fontSize: 22, fontWeight: "800", color: COLORS.gray900, marginBottom: 4 }}>
          {j.propertyAddress}
        </Text>
        <Text style={{ fontSize: 14, color: COLORS.gray500, marginBottom: 16 }}>
          {j.propertyCity}{j.propertyState ? `, ${j.propertyState}` : ""} {j.propertyZip ?? ""}
        </Text>

        {/* Navigate Button */}
        <TouchableOpacity
          onPress={openNavigation}
          activeOpacity={0.8}
          style={{
            backgroundColor: COLORS.primary,
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: 8,
            marginBottom: 20,
          }}
        >
          <Text style={{ fontSize: 18 }}>🧭</Text>
          <Text style={{ fontSize: 15, fontWeight: "700", color: COLORS.white }}>Navigate to Property</Text>
        </TouchableOpacity>

        {/* Schedule Card */}
        <SectionCard title="Schedule">
          <InfoRow label="Date" value={scheduledDate ? format(scheduledDate, "EEEE, MMMM d, yyyy") : "TBD"} />
          <InfoRow label="Time" value={scheduledDate ? format(scheduledDate, "h:mm a") : "TBD"} />
          {j.estimatedDurationMins && (
            <InfoRow label="Est. Duration" value={`${j.estimatedDurationMins} min`} last />
          )}
        </SectionCard>

        {/* Property Details */}
        <SectionCard title="Property Details">
          {j.propertyType && <InfoRow label="Type" value={j.propertyType} />}
          {j.squareFootage && <InfoRow label="Sq Ft" value={j.squareFootage.toLocaleString()} />}
          {j.bedrooms && <InfoRow label="Beds" value={j.bedrooms} />}
          {j.bathrooms && <InfoRow label="Baths" value={j.bathrooms} />}
          {j.mlsNumber && <InfoRow label="MLS #" value={j.mlsNumber} last />}
        </SectionCard>

        {/* Services */}
        {j.services && j.services.length > 0 && (
          <SectionCard title="Services">
            {j.services.map((svc: any, i: number) => (
              <View
                key={svc.id ?? i}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderBottomWidth: i < j.services.length - 1 ? 1 : 0,
                  borderBottomColor: COLORS.gray100,
                  gap: 10,
                }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: COLORS.primary,
                  }}
                />
                <Text style={{ fontSize: 14, color: COLORS.gray700, flex: 1 }}>
                  {svc.name ?? svc.service?.name ?? "Service"}
                </Text>
              </View>
            ))}
          </SectionCard>
        )}

        {/* Client */}
        {j.client && (
          <SectionCard title="Client">
            <InfoRow label="Name" value={`${j.client.firstName ?? ""} ${j.client.lastName ?? ""}`} />
            {j.client.email && <InfoRow label="Email" value={j.client.email} />}
            {j.client.phone && <InfoRow label="Phone" value={j.client.phone} />}
            {j.client.company && <InfoRow label="Company" value={j.client.company} last />}
          </SectionCard>
        )}

        {/* Notes */}
        {j.clientNotes && (
          <SectionCard title="Client Notes">
            <View style={{ padding: 16 }}>
              <Text style={{ fontSize: 14, color: COLORS.gray700, lineHeight: 20 }}>
                {j.clientNotes}
              </Text>
            </View>
          </SectionCard>
        )}

        {/* Clock In / Clock Out / Complete */}
        {!isCompleted && (
          <View style={{ marginTop: 8 }}>
            {isClockedIn ? (
              <>
                {/* Live timer */}
                <View
                  style={{
                    backgroundColor: COLORS.successLight,
                    borderRadius: 16,
                    padding: 24,
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: COLORS.success, marginBottom: 8 }}>
                    TIME ON SITE
                  </Text>
                  <LiveTimer startedAt={clockedInAt!} />
                </View>

                <TouchableOpacity
                  onPress={handleClockOut}
                  disabled={clockOutMutation.isPending}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: COLORS.warning,
                    borderRadius: 12,
                    paddingVertical: 16,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: "800", color: COLORS.white }}>
                    {clockOutMutation.isPending ? "Clocking Out..." : "🛑  Clock Out"}
                  </Text>
                </TouchableOpacity>
              </>
            ) : hasClockedOut && !isCompleted ? (
              <TouchableOpacity
                onPress={handleComplete}
                disabled={completeMutation.isPending}
                activeOpacity={0.8}
                style={{
                  backgroundColor: COLORS.success,
                  borderRadius: 12,
                  paddingVertical: 16,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "800", color: COLORS.white }}>
                  {completeMutation.isPending ? "Completing..." : "✅  Mark as Complete"}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleClockIn}
                disabled={clockInMutation.isPending}
                activeOpacity={0.8}
                style={{
                  backgroundColor: COLORS.success,
                  borderRadius: 12,
                  paddingVertical: 16,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "800", color: COLORS.white }}>
                  {clockInMutation.isPending ? "Clocking In..." : "⏱  Clock In"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Reusable UI Pieces ───────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text
        style={{
          fontSize: 13,
          fontWeight: "700",
          color: COLORS.gray500,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          marginBottom: 6,
          paddingHorizontal: 4,
        }}
      >
        {title}
      </Text>
      <View style={{ backgroundColor: COLORS.white, borderRadius: 14, overflow: "hidden" }}>
        {children}
      </View>
    </View>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: COLORS.gray100,
      }}
    >
      <Text style={{ fontSize: 13, color: COLORS.gray500 }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.gray900, maxWidth: "60%", textAlign: "right" }}>
        {value}
      </Text>
    </View>
  );
}
