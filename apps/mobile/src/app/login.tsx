import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, Alert, Animated, BackHandler } from "react-native";
import { Redirect } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";
import { LegalLinks } from "../components/LegalLinks";
import { OnboardingArt, riseIn, useOpeningClock } from "../components/OnboardingArt";
import { authMessage, startAsGuest } from "../lib/account";
import { useSession } from "../lib/useSession";
import { supabase } from "../lib/supabase";
import { colors, radius, spacing, typography } from "../lib/theme";

type Mode = "welcome" | "signin" | "signup" | "forgot" | "forgot_sent";

/**
 * First screen without a session. 直接開始刷題 makes a guest account (no typing);
 * 登入或建立帳號 opens the email form for people who want their records kept.
 */
export default function LoginScreen() {
  const session = useSession();
  const clock = useOpeningClock();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<Mode>("welcome");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Android back on the email form returns to the opening screen instead of leaving the app
  useEffect(() => {
    if (mode === "welcome") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setError(null);
      setMode("welcome");
      return true;
    });
    return () => sub.remove();
  }, [mode]);

  if (session) return <Redirect href="/(tabs)" />;

  const startNow = async () => {
    setBusy(true);
    try {
      await startAsGuest(); // the new session redirects to the tabs
    } catch (e) {
      setBusy(false);
      Alert.alert("無法開始", (e as Error).message);
    }
  };

  const submit = async () => {
    setError(null);
    setBusy(true);
    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "misgradcoach://reset-password",
      });
      setBusy(false);
      if (error) setError(authMessage(error));
      else setMode("forgot_sent");
      return;
    }
    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) setError(authMessage(error));
  };

  if (mode === "welcome") {
    return (
      <SafeAreaView style={styles.welcome} edges={["top", "bottom"]}>
        <View style={styles.hero}>
          <OnboardingArt clock={clock} />
          <Animated.Text style={[styles.wordmark, riseIn(clock, 1500)]}>考研教練</Animated.Text>
        </View>
        <Animated.View style={[styles.actions, riseIn(clock, 1800)]}>
          <Pressable style={styles.primary} onPress={startNow} disabled={busy}>
            <Text style={styles.primaryText}>{busy ? "處理中…" : "直接開始刷題"}</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => setMode("signin")} disabled={busy}>
            <Text style={styles.secondaryText}>登入或建立帳號</Text>
          </Pressable>
        </Animated.View>
        <Animated.View style={riseIn(clock, 2100)}>
          <LegalLinks />
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <SafeAreaView style={styles.topBar} edges={["top"]}>
        <Pressable
          style={styles.iconButton}
          onPress={() => { setError(null); setMode("welcome"); }}
          accessibilityLabel="返回"
        >
          <Ionicons name="chevron-back" size={18} color={colors.ink2} />
        </Pressable>
      </SafeAreaView>
      <View style={styles.body}>
        <View style={styles.card}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>研</Text>
          </View>
          <Text style={styles.title}>考研教練</Text>
          <Text style={styles.subtitle}>
            {mode === "signin" ? "登入繼續練習"
              : mode === "signup" ? "建立帳號"
              : mode === "forgot" ? "輸入 email，寄送重設密碼連結"
              : "已寄出！點信裡的連結回到 App 設新密碼"}
          </Text>

          {mode !== "forgot_sent" && (
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.ink3}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          )}
          {(mode === "signin" || mode === "signup") && (
            <TextInput
              style={styles.input}
              placeholder="密碼"
              placeholderTextColor={colors.ink3}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          {mode !== "forgot_sent" && (
            <Pressable style={styles.button} onPress={submit} disabled={busy}>
              <Text style={styles.buttonText}>
                {busy ? "處理中…" : mode === "signin" ? "登入" : mode === "signup" ? "註冊" : "寄送重設連結"}
              </Text>
            </Pressable>
          )}

          {mode === "signin" && (
            <Pressable onPress={() => setMode("forgot")}>
              <Text style={styles.switchText}>忘記密碼？</Text>
            </Pressable>
          )}
          {(mode === "forgot" || mode === "forgot_sent") ? (
            <Pressable onPress={() => setMode("signin")}>
              <Text style={styles.switchText}>回登入畫面</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => setMode(mode === "signin" ? "signup" : "signin")}>
              <Text style={styles.switchText}>
                {mode === "signin" ? "還沒有帳號？建立一個" : "已經有帳號？登入"}
              </Text>
            </Pressable>
          )}
        </View>
        <View style={styles.legal}>
          <LegalLinks />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  welcome: { flex: 1, backgroundColor: colors.ground, paddingHorizontal: spacing.xxl, paddingBottom: spacing.md },
  hero: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.xxl, paddingTop: 40 },
  wordmark: { fontSize: 26, fontWeight: "700", letterSpacing: 3, color: colors.ink },
  actions: { alignSelf: "stretch", gap: 6 },
  primary: { height: 52, borderRadius: 12, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  secondary: { height: 44, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: colors.accent, fontSize: 15, fontWeight: "600" },
  root: { flex: 1, backgroundColor: colors.ground },
  topBar: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  iconButton: { width: 34, height: 34, borderRadius: radius.full, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, justifyContent: "center", padding: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xxl, gap: spacing.md },
  logo: {
    width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.accent,
    alignItems: "center", justifyContent: "center", alignSelf: "center",
  },
  logoText: { color: "#fff", fontSize: 20, fontWeight: "800" },
  title: { ...typography.h1, textAlign: "center", color: colors.ink },
  subtitle: { ...typography.small, textAlign: "center", color: colors.ink3, marginBottom: spacing.sm },
  input: {
    borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: 14, color: colors.ink,
  },
  error: { color: colors.danger, fontSize: 12, textAlign: "center" },
  button: {
    backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: spacing.md,
    alignItems: "center", marginTop: spacing.xs,
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  switchText: { color: colors.accent2, fontSize: 12, textAlign: "center", fontWeight: "600" },
  legal: { marginTop: spacing.md },
});
