import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/lib/store";
import { COLORS } from "@/constants/config";

export default function LoginScreen() {
  const router = useRouter();
  const setAuth = useAppStore((s) => s.setAuth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        Alert.alert("Login failed", error.message);
        return;
      }

      if (data.session && data.user) {
        setAuth(data.session.access_token, {
          id: data.user.id,
          email: data.user.email ?? "",
          name: data.user.user_metadata?.name ?? data.user.email ?? "",
        });
        router.replace("/(tabs)/jobs");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: COLORS.white }}
    >
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 32 }}>
        {/* Logo / Title */}
        <View style={{ alignItems: "center", marginBottom: 48 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              backgroundColor: COLORS.primary,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Text style={{ color: COLORS.white, fontSize: 28, fontWeight: "800" }}>S</Text>
          </View>
          <Text style={{ fontSize: 26, fontWeight: "700", color: COLORS.gray900 }}>
            Scalist
          </Text>
          <Text style={{ fontSize: 14, color: COLORS.gray400, marginTop: 4 }}>
            Staff Portal
          </Text>
        </View>

        {/* Email */}
        <Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.gray700, marginBottom: 6 }}>
          Email
        </Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@company.com"
          placeholderTextColor={COLORS.gray400}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            borderWidth: 1,
            borderColor: COLORS.gray200,
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 15,
            color: COLORS.gray900,
            backgroundColor: COLORS.gray50,
            marginBottom: 16,
          }}
        />

        {/* Password */}
        <Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.gray700, marginBottom: 6 }}>
          Password
        </Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          placeholderTextColor={COLORS.gray400}
          secureTextEntry
          style={{
            borderWidth: 1,
            borderColor: COLORS.gray200,
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 15,
            color: COLORS.gray900,
            backgroundColor: COLORS.gray50,
            marginBottom: 24,
          }}
        />

        {/* Login Button */}
        <TouchableOpacity
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
          style={{
            backgroundColor: loading ? COLORS.gray300 : COLORS.primary,
            borderRadius: 10,
            paddingVertical: 14,
            alignItems: "center",
          }}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={{ color: COLORS.white, fontSize: 15, fontWeight: "700" }}>
              Sign In
            </Text>
          )}
        </TouchableOpacity>

        <Text
          style={{
            textAlign: "center",
            fontSize: 12,
            color: COLORS.gray400,
            marginTop: 24,
            lineHeight: 18,
          }}
        >
          Sign in with the account your company provided.{"\n"}
          Contact your admin if you need access.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
