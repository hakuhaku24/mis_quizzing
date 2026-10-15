import { useCallback, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl, Alert } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";
import { getDailyTasks } from "../../lib/daily";
import { getAnalytics } from "../../lib/analytics";
import { deleteAccount, logout } from "../../lib/account";
import { PLACEMENT_QUESTIONS } from "../../lib/scoring";
import { supabase } from "../../lib/supabase";
import { randomQuestionId } from "../../lib/random";
import { colors, radius, spacing, typography } from "../../lib/theme";
import type { Analytics, DailyItem } from "../../lib/types";

const EXAM_DATE = new Date("2027-02-01T00:00:00+08:00");
const TOPIC_LABELS: Record<string, string> = { MIS: "管理資訊系統", DS: "資料結構", CS: "計算機概論" };

const SLOT_META: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; line: string }> = {
  review: { label: "到期複習", icon: "refresh-outline", color: "#92400E", bg: colors.warningSoft, line: colors.warningLine },
  weak: { label: "弱點加強", icon: "locate-outline", color: "#991B1B", bg: colors.dangerSoft, line: colors.dangerLine },
  unseen: { label: "新題", icon: "add-circle-outline", color: "#1E40AF", bg: colors.infoSoft, line: colors.infoLine },
  extra: { label: "加練", icon: "ellipsis-horizontal-circle-outline", color: colors.ink2, bg: "#F4F4F5", line: colors.line },
};

/** One-time reveal once any 5 answers have been scored. */
async function announcePlacementOnce(percent: number, average: number | null) {
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return;
    const key = `placement-announced:${userId}`;
    if (await AsyncStorage.getItem(key)) return;
    await AsyncStorage.setItem(key, "1");
    const averageLine = average !== null ? `\n目前所有使用者的平均是 ${average}%。` : "";
    Alert.alert("定位完成", `你的定位是「考前準備度：${percent}%」！\n繼續加油！${averageLine}`);
  } catch {
    // a missed announcement is harmless
  }
}

export default function HomeScreen() {
  const router = useRouter();
  const [daily, setDaily] = useState<DailyItem[] | null>(null);
  const [stats, setStats] = useState<Analytics | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const announcing = useRef(false);

  const load = useCallback(async () => {
    const [d, a] = await Promise.all([getDailyTasks(), getAnalytics()]);
    setDaily(d);
    setStats(a);
    if (a.readiness.percent !== null && !announcing.current) {
      announcing.current = true;
      announcePlacementOnce(a.readiness.percent, a.readinessAverage);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const confirmDelete = () =>
    Alert.alert("刪除帳號", "你的帳號和所有作答紀錄會永久刪除，無法復原。確定要刪除嗎？", [
      { text: "取消", style: "cancel" },
      {
        text: "永久刪除",
        style: "destructive",
        onPress: () => deleteAccount().catch((e: Error) => Alert.alert("刪除失敗", e.message)),
      },
    ]);

  const openAccountMenu = () =>
    Alert.alert("帳號", undefined, [
      { text: "登出", onPress: () => logout() },
      { text: "刪除帳號", style: "destructive", onPress: confirmDelete },
      { text: "取消", style: "cancel" },
    ]);

  const [now] = useState(() => Date.now());
  const daysLeft = Math.max(0, Math.ceil((EXAM_DATE.getTime() - now) / 86_400_000));
  const doneCount = daily?.filter((d) => d.done_today).length ?? 0;
  const firstUndone = daily?.find((d) => !d.done_today);

  const bySlot = { review: 0, weak: 0, unseen: 0 };
  for (const d of daily ?? []) if (d.slot in bySlot) bySlot[d.slot as keyof typeof bySlot]++;

  const examTopics = (stats?.topicStats ?? []).filter((t) => t.topic === "CS" || t.topic === "DS");
  const readiness = stats?.readiness;
  const placing = readiness ? readiness.percent === null : false;
  const placedCount = Math.min(readiness?.scoredQuestions ?? 0, PLACEMENT_QUESTIONS);

  const ctaText = doneCount === 0 ? "開始今天的練習 →" : `繼續練習（剩 ${(daily?.length ?? 0) - doneCount} 題）→`;

  const [drawing, setDrawing] = useState(false);
  const openRandom = async () => {
    if (drawing) return;
    setDrawing(true);
    const id = await randomQuestionId();
    setDrawing(false);
    if (id) router.push(`/question/${id}?from=random`);
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={styles.logo}><Text style={styles.logoText}>研</Text></View>
          <Text style={styles.brandText}>考研教練</Text>
        </View>
        <Pressable style={styles.iconButton} onPress={openAccountMenu}>
          <Ionicons name="log-out-outline" size={18} color={colors.ink2} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>距筆試（約 2027/2）還有 {daysLeft} 天</Text>
          <View style={styles.heroRow}>
            <View style={styles.ring}>
              {readiness?.percent != null ? (
                <Text style={styles.ringText}>{readiness.percent}%</Text>
              ) : (
                <Text style={styles.ringTextSmall}>{readiness ? "未定位" : "—"}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroSub}>考前準備度</Text>
              <Text style={styles.heroDesc}>
                {!stats
                  ? " "
                  : placing
                    ? `寫任意 ${PLACEMENT_QUESTIONS} 題就會出現你的考前準備度（還差 ${PLACEMENT_QUESTIONS - placedCount} 題）。`
                    : `累積作答 ${stats.totalAttempts} 題，AI 批改 ${stats.aiGraded} 題。`}
              </Text>
              {!placing && stats?.readinessAverage != null && (
                <Text style={styles.heroAverage}>所有使用者平均 {stats.readinessAverage}%</Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View>
            <Text style={styles.cardTitle}>今天練什麼</Text>
            <Text style={styles.cardSub}>依到期複習 → 弱點 → 新題排序，不是隨機出題</Text>
          </View>

          {(["review", "weak", "unseen"] as const).map((slot) => {
            const meta = SLOT_META[slot];
            const count = bySlot[slot];
            if (!count) return null;
            return (
              <Pressable
                key={slot}
                style={[styles.slotRow, { backgroundColor: meta.bg, borderColor: meta.line }]}
                onPress={() => {
                  const item = daily?.find((d) => d.slot === slot && !d.done_today);
                  if (item) router.push(`/question/${item.id}`);
                }}
              >
                <View style={[styles.slotIcon, { backgroundColor: "#fff" }]}>
                  <Ionicons name={meta.icon} size={15} color={meta.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.slotLabel, { color: meta.color }]}>{meta.label} · {count} 題</Text>
                </View>
              </Pressable>
            );
          })}

          {daily === null ? (
            <Text style={styles.loadingText}>載入中…</Text>
          ) : firstUndone ? (
            <Pressable style={styles.cta} onPress={() => router.push(`/question/${firstUndone.id}`)}>
              <Text style={styles.ctaText}>{ctaText}</Text>
            </Pressable>
          ) : (
            <View style={styles.doneBanner}><Text style={styles.doneText}>今日任務完成！</Text></View>
          )}
        </View>

        <Pressable style={styles.randomRow} onPress={openRandom} disabled={drawing}>
          <View style={styles.randomIcon}>
            <Ionicons name="shuffle" size={16} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.randomTitle}>{drawing ? "抽題中…" : "隨機一題"}</Text>
            <Text style={styles.randomSub}>從整個題庫隨機抽，跟每日練習分開</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.ink3} />
        </Pressable>

        {examTopics.length > 0 && (
          <Pressable style={styles.masteryRow} onPress={() => router.push("/(tabs)/analytics")}>
            <View>
              <Text style={styles.masteryText}>
                {examTopics
                  .slice()
                  .sort((a, b) => (a.mastery ?? 0) - (b.mastery ?? 0))
                  .slice(0, 2)
                  .map((t) => `${TOPIC_LABELS[t.topic] ?? t.topic} ${Math.round((t.mastery ?? 0) * 100)}%`)
                  .join(" · ")}
              </Text>
              <Text style={styles.masterySub}>看完整弱點分析</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.ink3} />
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, height: 56 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  logo: { width: 26, height: 26, borderRadius: 8, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  logoText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  brandText: { ...typography.h2 },
  iconButton: { width: 34, height: 34, borderRadius: radius.full, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.xl, paddingTop: spacing.xs, gap: spacing.lg, paddingBottom: spacing.xxl },
  hero: { backgroundColor: colors.accent, borderRadius: radius.xxl, padding: spacing.xl, gap: spacing.lg },
  heroLabel: { color: "rgba(255,255,255,0.75)", fontSize: 12 },
  heroRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  ring: { width: 64, height: 64, borderRadius: radius.full, borderWidth: 4, borderColor: "rgba(255,255,255,0.3)", alignItems: "center", justifyContent: "center" },
  ringText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  randomRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg },
  randomIcon: { width: 32, height: 32, borderRadius: radius.full, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  randomTitle: { fontSize: 14, fontWeight: "800", color: colors.ink },
  randomSub: { fontSize: 11, color: colors.ink3, marginTop: 2 },
  ringTextSmall: { color: "#fff", fontSize: 13, fontWeight: "800" },
  heroSub: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginBottom: 3 },
  heroDesc: { color: "#fff", fontSize: 13, lineHeight: 19 },
  heroAverage: { color: "rgba(255,255,255,0.75)", fontSize: 11.5, marginTop: 4 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.xl, padding: spacing.xl, gap: spacing.md },
  cardTitle: { ...typography.h2 },
  cardSub: { ...typography.tiny, color: colors.ink3, marginTop: 2 },
  slotRow: { flexDirection: "row", alignItems: "center", gap: 11, padding: 11, borderRadius: radius.md, borderWidth: 1 },
  slotIcon: { width: 30, height: 30, borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
  slotLabel: { fontSize: 13.5, fontWeight: "700" },
  loadingText: { textAlign: "center", color: colors.ink3, paddingVertical: spacing.xl },
  cta: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 13, alignItems: "center", marginTop: spacing.xs },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  doneBanner: { backgroundColor: colors.successSoft, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center" },
  doneText: { color: colors.success, fontWeight: "700", fontSize: 14 },
  masteryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg },
  masteryText: { fontSize: 12.5, fontWeight: "700", color: colors.ink },
  masterySub: { fontSize: 11, color: colors.ink3, marginTop: 2 },
});
