import { useCallback, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl, Alert } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";
import { ReadinessRuler } from "../../components/ReadinessRuler";
import { SLOT_LABELS, SLOT_ORDER, TodayRow } from "../../components/TodayRow";
import { getDailyTasks } from "../../lib/daily";
import { getAnalytics } from "../../lib/analytics";
import { PLACEMENT_QUESTIONS } from "../../lib/scoring";
import { supabase } from "../../lib/supabase";
import { randomQuestionId } from "../../lib/random";
import { colors, radius, spacing, typography } from "../../lib/theme";
import type { Analytics, DailyItem } from "../../lib/types";

const EXAM_DATE = new Date("2027-02-01T00:00:00+08:00");
/** Upcoming questions listed on home; the whole day is behind 看今天全部. */
const LIST_LIMIT = 4;

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

/**
 * Home, design C (2026-10-17, https://claude.ai/artifact/Kk4nQvpw9tjDdKSHbhDL5L):
 * readiness on a tick ruler, then today's next few questions to pick from,
 * one main button, and 隨機一題. No explanatory captions.
 */
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

  const [now] = useState(() => Date.now());
  const daysLeft = Math.max(0, Math.ceil((EXAM_DATE.getTime() - now) / 86_400_000));

  const undone = daily?.filter((d) => !d.done_today) ?? [];
  // the next few still to do; once everything is done, the day's first few with their ✓
  const listed = (undone.length > 0 ? undone : daily ?? []).slice(0, LIST_LIMIT);
  const composition = SLOT_ORDER
    .map((slot) => ({ slot, count: daily?.filter((d) => d.slot === slot).length ?? 0 }))
    .filter((c) => c.count > 0);

  const readiness = stats?.readiness;
  const placing = readiness ? readiness.percent === null : false;
  const placedCount = Math.min(readiness?.scoredQuestions ?? 0, PLACEMENT_QUESTIONS);

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
        {/* 登出 / 刪除帳號 live on the account page, where a guest gets 建立帳號 instead of 登出 */}
        <Pressable style={styles.iconButton} onPress={() => router.push("/account")} accessibilityLabel="帳號">
          <Ionicons name="person-outline" size={17} color={colors.ink2} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroMain}>
              <Text style={styles.heroLabel}>考前準備度</Text>
              {readiness?.percent != null ? (
                <View style={styles.numberRow}>
                  <Text style={styles.number}>{readiness.percent}</Text>
                  <Text style={styles.percentSign}>%</Text>
                </View>
              ) : (
                <Text style={styles.unplaced}>{readiness ? `寫任意 ${PLACEMENT_QUESTIONS} 題就會出現` : " "}</Text>
              )}
            </View>
            <View style={styles.heroSide}>
              {stats && (
                <Text style={styles.heroSideText}>
                  {placing ? `還差 ${PLACEMENT_QUESTIONS - placedCount} 題` : `寫過 ${stats.questionsAnswered} 題`}
                </Text>
              )}
              <Text style={styles.heroSideText}>距筆試 {daysLeft} 天</Text>
            </View>
          </View>
          <ReadinessRuler
            percent={readiness?.percent ?? null}
            average={placing ? null : stats?.readinessAverage ?? null}
          />
        </View>

        <View style={styles.today}>
          <View style={styles.todayHeader}>
            <Text style={styles.todayTitle}>今天練什麼</Text>
            {composition.length > 0 && (
              <Text style={styles.composition}>
                {composition.map((c, i) => (
                  <Text key={c.slot}>
                    {i > 0 ? " · " : ""}
                    {SLOT_LABELS[c.slot]} <Text style={styles.compositionCount}>{c.count}</Text>
                  </Text>
                ))}
              </Text>
            )}
          </View>

          {daily === null ? (
            <Text style={styles.loadingText}>載入中…</Text>
          ) : daily.length === 0 ? (
            <Text style={styles.loadingText}>今天沒有題目</Text>
          ) : (
            <>
              <View style={styles.list}>
                {listed.map((item) => (
                  <TodayRow key={item.id} item={item} divider />
                ))}
                <Pressable style={styles.listFooter} onPress={() => router.push("/today")}>
                  <Text style={styles.listFooterText}>看今天全部 {daily.length} 題</Text>
                </Pressable>
              </View>
              {undone.length > 0 ? (
                <Pressable style={styles.cta} onPress={() => router.push(`/question/${undone[0].id}`)}>
                  <Text style={styles.ctaText}>從第一題開始</Text>
                </Pressable>
              ) : (
                <View style={styles.doneRow}>
                  <Text style={styles.doneCheck}>✓</Text>
                  <Text style={styles.doneText}>今天的 {daily.length} 題都寫完了</Text>
                </View>
              )}
            </>
          )}
        </View>

        <Pressable style={styles.randomRow} onPress={openRandom} disabled={drawing}>
          <View style={styles.randomIcon}>
            <Ionicons name="shuffle" size={16} color={colors.accent} />
          </View>
          <Text style={styles.randomTitle}>{drawing ? "抽題中…" : "隨機一題"}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.ink3} />
        </Pressable>
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
  hero: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.xl, paddingTop: spacing.lg, paddingHorizontal: spacing.xl, paddingBottom: 18 },
  heroTop: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: spacing.md },
  heroMain: { flexShrink: 1 },
  heroLabel: { fontSize: 12.5, fontWeight: "600", color: colors.ink2 },
  numberRow: { flexDirection: "row", alignItems: "baseline", marginTop: 2 },
  number: { fontSize: 34, lineHeight: 40, fontWeight: "800", letterSpacing: -1, color: colors.ink, fontVariant: ["tabular-nums"] },
  percentSign: { fontSize: 16, fontWeight: "700", color: colors.ink2, marginLeft: 2 },
  unplaced: { marginTop: 8, fontSize: 15, lineHeight: 22, fontWeight: "700", color: colors.ink },
  heroSide: { alignItems: "flex-end" },
  heroSideText: { fontSize: 12, lineHeight: 19, color: colors.ink2 },
  today: { gap: 10 },
  todayHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 2 },
  todayTitle: { ...typography.h2, color: colors.ink },
  composition: { fontSize: 12, color: colors.ink2 },
  compositionCount: { fontWeight: "700", color: colors.ink },
  list: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, overflow: "hidden" },
  listFooter: { minHeight: 44, alignItems: "center", justifyContent: "center", paddingVertical: spacing.md },
  listFooterText: { fontSize: 13.5, fontWeight: "600", color: colors.accent },
  loadingText: { textAlign: "center", color: colors.ink3, paddingVertical: spacing.xl },
  cta: { height: 48, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  ctaText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  doneRow: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  doneCheck: { fontSize: 15, fontWeight: "700", color: colors.success },
  doneText: { fontSize: 15, fontWeight: "700", color: colors.ink },
  randomRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: spacing.lg },
  randomIcon: { width: 32, height: 32, borderRadius: radius.full, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  randomTitle: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.ink },
});
