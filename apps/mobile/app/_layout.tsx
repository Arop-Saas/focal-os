import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ApiProvider } from "@/lib/api-provider";
import { useAppStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { COLORS } from "@/constants/config";

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const setAuth = useAppStore((s) => s.setAuth);
  const logout = useAppStore((s) => s.logout);

  // Restore session on app launch
  useEffect(() => {
    async function restoreSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.access_token && session.user) {
        setAuth(session.access_token, {
          id: session.user.id,
          email: session.user.email ?? "",
          name: session.user.user_metadata?.name ?? session.user.email ?? "",
        });
      }
      setReady(true);
    }

    restoreSession();

    // Listen for auth state changes (token refresh, sign out, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token && session.user) {
        setAuth(session.access_token, {
          id: session.user.id,
          email: session.user.email ?? "",
          name: session.user.user_metadata?.name ?? session.user.email ?? "",
        });
      } else {
        logout();
      }
    });

    return () => subscription.unsubscribe();
  }, [setAuth, logout]);

  if (!ready) return null;

  return (
    <ApiProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.gray50 },
        }}
      />
    </ApiProvider>
  );
}
