import { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  getDay,
  parseISO,
} from "date-fns";
import { trpc } from "@/lib/trpc";
import { COLORS, JOB_STATUS } from "@/constants/config";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function ScheduleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  // Fetch jobs for the month
  const { data: jobs, isLoading } = trpc.mobile.getMyJobs.useQuery(undefined);
  const allJobs: any[] = (jobs as any[]) ?? [];

  // Map jobs to days
  const jobsByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const job of allJobs) {
      if (!job.scheduledAt) continue;
      const key = format(parseISO(job.scheduledAt), "yyyy-MM-dd");
      if (!map[key]) map[key] = [];
      map[key].push(job);
    }
    return map;
  }, [allJobs]);

  // Calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Offset for first day (Mon = 0)
  const firstDayOffset = (getDay(monthStart) + 6) % 7;
  const paddingDays = Array.from({ length: firstDayOffset }, (_, i) => null);

  // Jobs for selected date
  const selectedKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
  const selectedJobs = selectedKey ? (jobsByDay[selectedKey] ?? []) : [];

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
        <Text style={{ fontSize: 24, fontWeight: "800", color: COLORS.gray900 }}>Schedule</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Month navigation */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingVertical: 16,
          }}
        >
          <TouchableOpacity onPress={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <Text style={{ fontSize: 20, color: COLORS.primary }}>←</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: "700", color: COLORS.gray900 }}>
            {format(currentMonth, "MMMM yyyy")}
          </Text>
          <TouchableOpacity onPress={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <Text style={{ fontSize: 20, color: COLORS.primary }}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Weekday headers */}
        <View style={{ flexDirection: "row", paddingHorizontal: 12 }}>
          {WEEKDAYS.map((d) => (
            <View key={d} style={{ flex: 1, alignItems: "center", paddingBottom: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: COLORS.gray400 }}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12 }}>
          {paddingDays.map((_, i) => (
            <View key={`pad-${i}`} style={{ width: "14.28%", height: 52 }} />
          ))}
          {calendarDays.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const count = (jobsByDay[key] ?? []).length;
            const selected = selectedDate && isSameDay(day, selectedDate);
            const today = isToday(day);

            return (
              <TouchableOpacity
                key={key}
                onPress={() => setSelectedDate(day)}
                style={{
                  width: "14.28%",
                  height: 52,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: selected ? COLORS.primary : "transparent",
                    borderWidth: today && !selected ? 2 : 0,
                    borderColor: COLORS.primary,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: today || selected ? "700" : "400",
                      color: selected ? COLORS.white : today ? COLORS.primary : COLORS.gray700,
                    }}
                  >
                    {format(day, "d")}
                  </Text>
                </View>
                {count > 0 && (
                  <View style={{ flexDirection: "row", gap: 2, marginTop: 2 }}>
                    {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                      <View
                        key={i}
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: selected ? COLORS.primary : COLORS.primaryLight,
                        }}
                      />
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected day's jobs */}
        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: COLORS.gray600, marginBottom: 10 }}>
            {selectedDate ? format(selectedDate, "EEEE, MMMM d") : "Select a day"}
          </Text>

          {isLoading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
          ) : selectedJobs.length === 0 ? (
            <View
              style={{
                backgroundColor: COLORS.white,
                borderRadius: 12,
                padding: 24,
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 14, color: COLORS.gray400 }}>No jobs scheduled</Text>
            </View>
          ) : (
            selectedJobs.map((job: any) => {
              const status = JOB_STATUS[job.status] ?? JOB_STATUS.PENDING;
              return (
                <TouchableOpacity
                  key={job.id}
                  onPress={() => router.push(`/job/${job.id}`)}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: COLORS.white,
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 8,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 4,
                      height: 40,
                      borderRadius: 2,
                      backgroundColor: status.color,
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ fontSize: 14, fontWeight: "600", color: COLORS.gray900 }}
                      numberOfLines={1}
                    >
                      {job.propertyAddress}
                    </Text>
                    <Text style={{ fontSize: 12, color: COLORS.gray400, marginTop: 2 }}>
                      {format(parseISO(job.scheduledAt), "h:mm a")} · {status.label}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 16, color: COLORS.gray300 }}>›</Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}
