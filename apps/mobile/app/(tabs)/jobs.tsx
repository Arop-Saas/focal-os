import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { format, isToday, isTomorrow, isThisWeek, parseISO } from "date-fns";
import { trpc } from "@/lib/trpc";
import { COLORS, JOB_STATUS } from "@/constants/config";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Job {
  id: string;
  jobNumber: string;
  status: string;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  scheduledAt: string;
  estimatedDurationMins: number | null;
  services: { name: string }[];
  client: { firstName: string; lastName: string; company: string | null } | null;
}

type DateGroup = "Today" | "Tomorrow" | "This Week" | "Upcoming";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupJobs(jobs: Job[]): { title: DateGroup; data: Job[] }[] {
  const groups: Record<DateGroup, Job[]> = {
    Today: [],
    Tomorrow: [],
    "This Week": [],
    Upcoming: [],
  };

  for (const job of jobs) {
    const date = parseISO(job.scheduledAt);
    if (isToday(date)) groups.Today.push(job);
    else if (isTomorrow(date)) groups.Tomorrow.push(job);
    else if (isThisWeek(date, { weekStartsOn: 1 })) groups["This Week"].push(job);
    else groups.Upcoming.push(job);
  }

  return (Object.entries(groups) as [DateGroup, Job[]][])
    .filter(([, data]) => data.length > 0)
    .map(([title, data]) => ({ title, data }));
}

// ─── Job Card Component ───────────────────────────────────────────────────────

function JobCard({ job, onPress }: { job: Job; onPress: () => void }) {
  const status = JOB_STATUS[job.status] ?? JOB_STATUS.PENDING;
  const scheduledDate = parseISO(job.scheduledAt);
  const timeStr = format(scheduledDate, "h:mm a");
  const dateStr = isToday(scheduledDate) ? "Today" : format(scheduledDate, "EEE, MMM d");

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        backgroundColor: COLORS.white,
        borderRadius: 14,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      {/* Top row: job number + status badge */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <Text style={{ fontSize: 12, fontWeight: "700", color: COLORS.gray400 }}>
          {job.jobNumber}
        </Text>
        <View
          style={{
            backgroundColor: status.bg,
            paddingHorizontal: 10,
            paddingVertical: 3,
            borderRadius: 20,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: "700", color: status.color }}>
            {status.label}
          </Text>
        </View>
      </View>

      {/* Address */}
      <Text style={{ fontSize: 15, fontWeight: "600", color: COLORS.gray900, marginBottom: 2 }} numberOfLines={1}>
        {job.propertyAddress}
      </Text>
      <Text style={{ fontSize: 13, color: COLORS.gray500, marginBottom: 10 }}>
        {job.propertyCity}{job.propertyState ? `, ${job.propertyState}` : ""}
      </Text>

      {/* Bottom row: time + services count */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 18 }}>🕐</Text>
          <Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.gray700 }}>
            {dateStr} at {timeStr}
          </Text>
        </View>
        {job.services.length > 0 && (
          <Text style={{ fontSize: 12, color: COLORS.gray400 }}>
            {job.services.length} service{job.services.length !== 1 ? "s" : ""}
          </Text>
        )}
      </View>

      {/* Client name */}
      {job.client && (
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, gap: 6 }}>
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: COLORS.primaryLight,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: "700", color: COLORS.primary }}>
              {job.client.firstName?.[0]}{job.client.lastName?.[0]}
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: COLORS.gray500 }}>
            {job.client.firstName} {job.client.lastName}
            {job.client.company ? ` · ${job.client.company}` : ""}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function JobsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = trpc.mobile.getMyJobs.useQuery(undefined, {
    refetchInterval: 1000 * 60 * 2, // refresh every 2 min
  });

  const jobs: Job[] = (data as Job[]) ?? [];
  const grouped = groupJobs(jobs);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Build flat list data with section headers
  const flatData: ({ type: "header"; title: string } | { type: "job"; job: Job })[] = [];
  for (const group of grouped) {
    flatData.push({ type: "header", title: group.title });
    for (const job of group.data) {
      flatData.push({ type: "job", job });
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.gray50, paddingTop: insets.top }}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 16,
          backgroundColor: COLORS.white,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.gray100,
        }}
      >
        <Text style={{ fontSize: 24, fontWeight: "800", color: COLORS.gray900 }}>My Jobs</Text>
        <Text style={{ fontSize: 13, color: COLORS.gray400, marginTop: 2 }}>
          {jobs.length} upcoming job{jobs.length !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* Loading state */}
      {isLoading && !refreshing ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : jobs.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40 }}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>📷</Text>
          <Text style={{ fontSize: 16, fontWeight: "600", color: COLORS.gray700, textAlign: "center" }}>
            No upcoming jobs
          </Text>
          <Text style={{ fontSize: 13, color: COLORS.gray400, textAlign: "center", marginTop: 6 }}>
            When you're assigned to a shoot, it'll show up here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={flatData}
          keyExtractor={(item, i) => (item.type === "header" ? `h-${item.title}` : `j-${item.job.id}`)}
          renderItem={({ item }) => {
            if (item.type === "header") {
              return (
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: COLORS.gray500,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    paddingHorizontal: 20,
                    paddingTop: 20,
                    paddingBottom: 8,
                  }}
                >
                  {item.title}
                </Text>
              );
            }
            return (
              <JobCard
                job={item.job}
                onPress={() => router.push(`/job/${item.job.id}`)}
              />
            );
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      )}
    </View>
  );
}
