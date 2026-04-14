import { View, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/lib/store";
import { trpc } from "@/lib/trpc";
import { COLORS } from "@/constants/config";

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAppStore((s) => s.user);
  const logout = useAppStore((s) => s.logout);

  const { data: profile } = trpc.mobile.getProfile.useQuery(undefined);

  async function handleLogout() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
          logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }

  const initials =
    (user?.name ?? "")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

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
        <Text style={{ fontSize: 24, fontWeight: "800", color: COLORS.gray900 }}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Avatar + Name Card */}
        <View
          style={{
            backgroundColor: COLORS.white,
            borderRadius: 16,
            padding: 24,
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: COLORS.primary,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            <Text style={{ fontSize: 28, fontWeight: "800", color: COLORS.white }}>
              {initials}
            </Text>
          </View>
          <Text style={{ fontSize: 18, fontWeight: "700", color: COLORS.gray900 }}>
            {user?.name ?? "Staff Member"}
          </Text>
          <Text style={{ fontSize: 13, color: COLORS.gray400, marginTop: 2 }}>
            {user?.email ?? ""}
          </Text>
          {(profile as any)?.title && (
            <View
              style={{
                backgroundColor: COLORS.primaryLight,
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderRadius: 20,
                marginTop: 8,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: COLORS.primary }}>
                {(profile as any).title}
              </Text>
            </View>
          )}
        </View>

        {/* Info Section */}
        <View
          style={{
            backgroundColor: COLORS.white,
            borderRadius: 16,
            overflow: "hidden",
            marginBottom: 16,
          }}
        >
          <InfoRow label="Phone" value={(profile as any)?.phone ?? "Not set"} />
          <InfoRow label="Role" value={(profile as any)?.role ?? "Photographer"} />
          <InfoRow label="Home Territory" value={(profile as any)?.homeTerritoryName ?? "All territories"} last />
        </View>

        {/* Actions */}
        <View
          style={{
            backgroundColor: COLORS.white,
            borderRadius: 16,
            overflow: "hidden",
            marginBottom: 32,
          }}
        >
          <TouchableOpacity
            onPress={handleLogout}
            activeOpacity={0.7}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 18 }}>🚪</Text>
            <Text style={{ fontSize: 15, fontWeight: "600", color: COLORS.danger }}>
              Sign Out
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={{ textAlign: "center", fontSize: 11, color: COLORS.gray400 }}>
          Scalist v1.0.0
        </Text>
      </ScrollView>
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
        paddingVertical: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: COLORS.gray100,
      }}
    >
      <Text style={{ fontSize: 14, color: COLORS.gray500 }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: "500", color: COLORS.gray900 }}>{value}</Text>
    </View>
  );
}
