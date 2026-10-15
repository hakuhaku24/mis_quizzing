import { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ErrorReasonsCard } from "../../components/ErrorReasonsCard";
import { KnowledgeMap } from "../../components/KnowledgeMap";
import { UnitSheet } from "../../components/UnitSheet";
import { getAnalytics } from "../../lib/analytics";
import { attemptBadge, subjectName } from "../../lib/labels";
import { stripMarkup } from "../../lib/text";
import { colors, radius, spacing, typography, masteryColor } from "../../lib/theme";
import type { Analytics, BlindSpot, UnitStat } from "../../lib/types";

export default function AnalyticsScreen() {
  const [stats, setStats] = useState<Analytics | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [openUnit, setOpenUnit] = useState<UnitStat | null>(null);
  const openUnitIsFocus = !!openUnit && stats?.knowledgeMap.find((s) => s.topic === openUnit.topic)?.focus === openUnit;

  const load = useCallback(async () => setStats(await getAnalytics()), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <Text style={styles.title}>弱點分析</Text>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <View style={styles.summaryRow}>
          <Summary label="總作答" value={String(stats?.totalAttempts ?? "—")} />
          <Summary label="AI 批改" value={String(stats?.aiGraded ?? "—")} />
          <Summary label="AI 平均" value={stats?.avgAiScore != null ? stats.avgAiScore.toFixed(1) : "—"} accent />
        </View>

        {stats && <KnowledgeMap subjects={stats.knowledgeMap} onOpenUnit={setOpenUnit} />}

        {stats && <BlindSpotCard items={stats.blindSpots} total={stats.blindSpotTotal} />}

        {stats?.errorReasons && <ErrorReasonsCard data={stats.errorReasons} />}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>各科掌握度</Text>
          {(stats?.topicStats ?? []).length === 0 ? (
            <Text style={styles.empty}>開始作答後顯示</Text>
          ) : (
            stats!.topicStats
              .slice()
              .sort((a, b) => (a.mastery ?? 1) - (b.mastery ?? 1))
              .map((t) => {
                const pct = Math.round((t.mastery ?? 0) * 100);
                return (
                  <View key={t.topic} style={styles.barRow}>
                    <View style={styles.barHeader}>
                      <Text style={styles.barLabel}>{subjectName(t.topic)}</Text>
                      <Text style={styles.barCount}>{t.total} 次作答 · {pct}%</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: masteryColor(pct) }]} />
                    </View>
                  </View>
                );
              })
          )}
        </View>
      </ScrollView>
      <UnitSheet unit={openUnit} isFocus={openUnitIsFocus} onClose={() => setOpenUnit(null)} />
    </SafeAreaView>
  );
}

/** 很有把握卻答錯 — the questions most likely to cost points on exam day. */
function BlindSpotCard({ items, total }: { items: BlindSpot[]; total: number }) {
  const router = useRouter();
  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.cardTitle}>很有把握卻答錯</Text>
        {total > 0 && (
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{total}</Text>
          </View>
        )}
      </View>
      {items.length === 0 ? (
        <Text style={styles.cardHint}>
          目前沒有。送出前選了「很有把握」、結果卻答錯的題目會出現在這裡，方便你考前優先複習。
        </Text>
      ) : (
        <>
          <Text style={styles.cardHint}>送出前你選了「很有把握」，結果卻答錯。這種題目考試時最容易失分，值得先複習。</Text>
          {items.map((b) => {
            // self-assessment overrides the AI score (as in scoring.ts), so show that mark
            const badge = attemptBadge({ ...b, ai_score: b.self_assessment ? null : b.ai_score });
            const where = [b.topic && subjectName(b.topic), b.subtopic].filter(Boolean).join(" · ");
            return (
              <Pressable
                key={b.questionId}
                style={styles.blindRow}
                onPress={() => router.push(`/question/${b.questionId}?attempt=${b.attemptId}`)}
              >
                <View style={{ flex: 1, gap: 3 }}>
                  {!!where && <Text style={styles.blindWhere}>{where}</Text>}
                  <Text style={styles.blindText} numberOfLines={2}>{stripMarkup(b.questionText)}</Text>
                </View>
                <View style={[styles.blindBadge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.blindBadgeText, { color: badge.color }]}>{badge.text}</Text>
                </View>
              </Pressable>
            );
          })}
          {total > items.length && <Text style={styles.cardFoot}>另外還有 {total - items.length} 題</Text>}
          <Text style={styles.blindFoot}>✓ 重寫答對，這題就會從清單移除</Text>
        </>
      )}
    </View>
  );
}

function Summary({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, accent && { color: colors.accent }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  title: { ...typography.h1, paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  content: { padding: spacing.xl, paddingTop: 0, gap: spacing.lg, paddingBottom: spacing.xxl },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg },
  summaryItem: { gap: 2 },
  summaryLabel: { fontSize: 11, color: colors.ink3 },
  summaryValue: { fontSize: 19, fontWeight: "800", color: colors.ink },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.xl, padding: spacing.xl, gap: spacing.md },
  cardTitle: { ...typography.h2 },
  cardHint: { fontSize: 12.5, lineHeight: 20, color: colors.ink2 },
  cardFoot: { fontSize: 12, color: colors.ink2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  countPill: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: radius.full, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  countPillText: { fontSize: 12, fontWeight: "800", color: "#fff" },
  blindRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 44, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: 14 },
  blindWhere: { fontSize: 11.5, fontWeight: "700", color: colors.accent },
  blindText: { fontSize: 13.5, lineHeight: 21, color: colors.ink },
  blindBadge: { minWidth: 40, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignItems: "center" },
  blindBadgeText: { fontSize: 13, fontWeight: "800" },
  blindFoot: { fontSize: 12, fontWeight: "500", color: "#15803D" },
  empty: { color: colors.ink3, fontSize: 13 },
  barRow: { gap: 5 },
  barHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  barLabel: { fontSize: 13.5, fontWeight: "700", color: colors.ink },
  barCount: { fontSize: 11, color: colors.ink3 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: "#F0F0F2" },
  barFill: { height: "100%", borderRadius: 4 },
});
