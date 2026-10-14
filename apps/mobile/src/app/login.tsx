import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { Redirect } from "expo-router";
import { useSession } from "../lib/useSession";
import { supabase } from "../lib/supabase";
import { colors, radius, spacing, typography } from "../lib/theme";

export default function LoginScreen() {
  const session = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "forgot_sent">("signin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Redirect href="/(tabs)" />;

  const submit = async () => {
    setError(null);
    setBusy(true);
    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "misgradcoach://reset-password",
      });
      setBusy(false);
      if (error) setError(error.message);
      else setMode("forgot_sent");
      return;
    }
    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) setError(error.message);
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground, justifyContent: "center", padding: spacing.xl },
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
});
