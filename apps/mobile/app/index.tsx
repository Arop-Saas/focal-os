import { Redirect } from "expo-router";
import { useAppStore } from "@/lib/store";

export default function Index() {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/jobs" />;
  }

  return <Redirect href="/(auth)/login" />;
}
