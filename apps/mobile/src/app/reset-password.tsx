import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { colors, radius, spacing, typography } from "../lib/theme";

/** Lands here from the "misgradcoach://reset-password?code=..." link in the
 *  password-recovery email (PKCE flow — see supabase.ts). Exchanges the code
 *  for a session, then lets the user pick a new password. */
export default function ResetPasswordScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const router = useRouter();
  const [exchanging, setExchanging] = useState(true);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!code) {
      // Deferred to a microtask — React's compiler flags a setState call
      // that's a direct statement in an effect body (same fix as bank.tsx).
      Promise.resolve().then(() => {
        setError("連結不完整，請重新點信裡的連結");
        setExchanging(false);
      });
      return;
    }
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      setExchanging(false);
      if (error) setError("連結已失效，請重新申請重設密碼");
      else setReady(true);
    });
  }, [code]);

  const submit = async () => {
    if (password.length < 6) {
      setError("密碼至少 6 個字元");
      return;
    }
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setError(error.message);
    else setDone(true);
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.card}>
        <Text style={styles.title}>設定新密碼</Text>

        {exchanging ? (
          <ActivityIndicator color={colors.accent} />
        ) : done ? (
          <>
            <Text style={styles.subtitle}>密碼已更新！</Text>
            <Pressable style={styles.button} onPress={() => router.replace("/(tabs)")}>
              <Text style={styles.buttonText}>回到 App</Text>
            </Pressable>
          </>
        ) : ready ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="新密碼"
              placeholderTextColor={colors.ink3}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <Pressable style={styles.button} onPress={submit} disabled={busy}>
              <Text style={styles.buttonText}>{busy ? "處理中…" : "更新密碼"}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.error}>{error}</Text>
            <Pressable style={styles.button} onPress={() => router.replace("/login")}>
              <Text style={styles.buttonText}>回登入畫面</Text>
            </Pressable>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground, justifyContent: "center", padding: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xxl, gap: spacing.md },
  title: { ...typography.h1, textAlign: "center", color: colors.ink },
  subtitle: { ...typography.small, textAlign: "center", color: colors.ink2 },
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
});
