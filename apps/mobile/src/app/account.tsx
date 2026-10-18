import { Fragment, useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";
import { LegalLinks } from "../components/LegalLinks";
import {
  countOwnAttempts, deleteAccount, isEmailTaken, isGuest, linkAccount, logout, switchToAccount,
} from "../lib/account";
import { getBankSchools } from "../lib/bank";
import { schoolName } from "../lib/labels";
import { loadExcludedSources, saveExcludedSources } from "../lib/sources";
import { useSession } from "../lib/useSession";
import { colors, radius, spacing, typography } from "../lib/theme";

type Form = "none" | "link" | "signin";

/**
 * 我的: a guest can create an account (keeps every record), sign in to an
 * existing one, or delete what is on this phone — never "log out", which
 * would strand the guest's records. A registered user gets 登出 / 刪除帳號.
 * Both get 首頁的題目來源: the schools (and 範本題) that 每日練習 and 隨機一題
 * draw from; at least one stays on.
 */
export default function AccountScreen() {
  const router = useRouter();
  const session = useSession();
  const [form, setForm] = useState<Form>("none");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);
  const [busy, setBusy] = useState(false);

  const userId = session?.user.id;
  const [sources, setSources] = useState<string[] | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    Promise.all([getBankSchools(), loadExcludedSources(userId)])
      .then(([schools, off]) => {
        if (!alive) return;
        setSources([...schools, "template"]);
        setExcluded(off);
      })
      .catch(() => undefined); // without the list the section just doesn't show
    return () => {
      alive = false;
    };
  }, [userId]);

  const toggleSource = (code: string) => {
    if (!userId || !sources) return;
    const on = !excluded.has(code);
    if (on && sources.filter((c) => !excluded.has(c)).length <= 1) return; // keep at least one on
    const next = new Set(excluded);
    if (on) next.add(code);
    else next.delete(code);
    setExcluded(next);
    saveExcludedSources(userId, next).catch(() => undefined);
  };

  // back to the opening screen once there is no account on this phone any more
  const leave = () => {
    if (router.canDismiss()) router.dismissAll();
    router.replace("/login");
  };

  const openForm = (next: Form) => {
    setError(null);
    setEmailTaken(false);
    setForm(next);
  };

  const fail = (e: unknown) => {
    setBusy(false);
    setEmailTaken(isEmailTaken(e));
    setError((e as Error).message);
  };

  const signIn = async () => {
    setBusy(true);
    try {
      await switchToAccount(email, password);
      router.back();
    } catch (e) {
      fail(e);
    }
  };

  const submit = async () => {
    if (!email.trim() || !password) {
      setError("請輸入 email 和密碼");
      return;
    }
    setError(null);
    setEmailTaken(false);
    if (form === "link") {
      setBusy(true);
      try {
        await linkAccount(email, password);
        setBusy(false);
        setPassword("");
        setForm("none");
        Alert.alert("帳號建立好了", "換手機時用這個 email 登入，紀錄都還在。");
      } catch (e) {
        fail(e);
      }
      return;
    }
    const left = await countOwnAttempts().catch(() => 0);
    if (left === 0) return signIn();
    Alert.alert(
      "這支手機上的紀錄不會帶過去",
      `目前有 ${left} 筆作答紀錄，登入其他帳號後就找不回來。`,
      [
        { text: "取消", style: "cancel" },
        { text: "登入", style: "destructive", onPress: signIn },
      ]
    );
  };

  const confirmDelete = (title: string, message: string) =>
    Alert.alert(title, message, [
      { text: "取消", style: "cancel" },
      {
        text: "永久刪除",
        style: "destructive",
        onPress: () => deleteAccount().then(leave).catch((e: Error) => Alert.alert("刪除失敗", e.message)),
      },
    ]);

  const guest = isGuest(session);

  const sourceSection = sources && (
    <View>
      <Text style={styles.sectionTitle}>首頁的題目來源</Text>
      <View style={styles.list}>
        {sources.map((code, i) => {
          const on = !excluded.has(code);
          const label = code === "template" ? "範本題" : schoolName(code);
          return (
            <Fragment key={code}>
              {i > 0 && <View style={styles.rowDivider} />}
              <Pressable
                style={styles.sourceRow}
                onPress={() => toggleSource(code)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={label}
              >
                <Text style={[styles.rowText, !on && styles.sourceOff]}>{label}</Text>
                {on && <Text style={styles.sourceCheck}>✓</Text>}
              </Pressable>
            </Fragment>
          );
        })}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.iconButton} onPress={() => router.back()} accessibilityLabel="返回">
          <Ionicons name="chevron-back" size={18} color={colors.ink2} />
        </Pressable>
        <Text style={styles.topBarTitle}>我的</Text>
        <View style={{ width: 34 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {!session ? null : guest ? (
            <>
              <View style={styles.card}>
                <Text style={styles.heading}>還沒有帳號</Text>
                <Text style={styles.note}>紀錄只存在這支手機，刪掉 App 或換手機就找不回來。</Text>

                {form === "none" ? (
                  <>
                    <Pressable style={styles.primary} onPress={() => openForm("link")}>
                      <Text style={styles.primaryText}>建立帳號，保留紀錄</Text>
                    </Pressable>
                    <Pressable style={styles.textButton} onPress={() => openForm("signin")}>
                      <Text style={styles.textButtonText}>我已經有帳號</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <TextInput
                      style={styles.input}
                      placeholder="Email"
                      placeholderTextColor={colors.ink3}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      value={email}
                      onChangeText={setEmail}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder={form === "link" ? "密碼（至少 6 個字）" : "密碼"}
                      placeholderTextColor={colors.ink3}
                      secureTextEntry
                      value={password}
                      onChangeText={setPassword}
                    />
                    {error && <Text style={styles.error}>{error}</Text>}
                    {emailTaken && form === "link" && (
                      <Pressable style={styles.textButton} onPress={() => openForm("signin")}>
                        <Text style={styles.textButtonText}>改用這個 email 登入</Text>
                      </Pressable>
                    )}
                    <Pressable style={styles.primary} onPress={submit} disabled={busy}>
                      <Text style={styles.primaryText}>
                        {busy ? "處理中…" : form === "link" ? "建立帳號" : "登入"}
                      </Text>
                    </Pressable>
                    <Pressable style={styles.textButton} onPress={() => openForm("none")} disabled={busy}>
                      <Text style={styles.cancelText}>取消</Text>
                    </Pressable>
                  </>
                )}
              </View>

              {sourceSection}

              <Pressable
                style={styles.dangerRow}
                onPress={() => confirmDelete("刪除這支手機上的紀錄", "所有作答紀錄會永久刪除，無法復原。確定要刪除嗎？")}
              >
                <Text style={styles.dangerText}>刪除這支手機上的紀錄</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.card}>
                <Text style={styles.label}>目前登入</Text>
                <Text style={styles.email}>{session.user.email}</Text>
              </View>

              {sourceSection}

              <View style={styles.list}>
                <Pressable style={styles.row} onPress={() => logout().then(leave).catch((e: Error) => Alert.alert("登出失敗", e.message))}>
                  <Text style={styles.rowText}>登出</Text>
                </Pressable>
                <View style={styles.rowDivider} />
                <Pressable
                  style={styles.row}
                  onPress={() => confirmDelete("刪除帳號", "你的帳號和所有作答紀錄會永久刪除，無法復原。確定要刪除嗎？")}
                >
                  <Text style={styles.dangerText}>刪除帳號</Text>
                </Pressable>
              </View>
            </>
          )}

          <LegalLinks />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, height: 56 },
  topBarTitle: { ...typography.h2, color: colors.ink },
  iconButton: { width: 34, height: 34, borderRadius: radius.full, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.xl, paddingTop: spacing.xs, gap: spacing.lg },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.xl, padding: spacing.xl, gap: spacing.md },
  heading: { ...typography.h2, color: colors.ink },
  note: { fontSize: 13, lineHeight: 20, color: colors.ink2 },
  label: { fontSize: 12, color: colors.ink2 },
  email: { fontSize: 15, fontWeight: "700", color: colors.ink },
  input: {
    borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: 14, color: colors.ink,
  },
  error: { color: colors.danger, fontSize: 12 },
  primary: { height: 48, borderRadius: 12, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", marginTop: spacing.xs },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  textButton: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  textButtonText: { color: colors.accent, fontSize: 14, fontWeight: "600" },
  cancelText: { color: colors.ink2, fontSize: 14, fontWeight: "600" },
  list: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.xl },
  row: { minHeight: 52, paddingHorizontal: spacing.xl, justifyContent: "center" },
  rowDivider: { height: 1, backgroundColor: colors.line, marginLeft: spacing.xl },
  rowText: { fontSize: 15, color: colors.ink },
  sectionTitle: { fontSize: 12.5, fontWeight: "600", color: colors.ink2, paddingHorizontal: spacing.xs, marginBottom: spacing.sm },
  sourceRow: { minHeight: 44, paddingHorizontal: spacing.xl, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sourceOff: { color: "#71717A" },
  sourceCheck: { fontSize: 16, fontWeight: "700", color: colors.accent },
  dangerRow: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  dangerText: { fontSize: 14, color: colors.danger, fontWeight: "600" },
});
