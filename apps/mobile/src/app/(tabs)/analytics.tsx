import { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { getAnalytics } from "../../lib/analytics";
import { colors, radius, spacing, typography, masteryColor } from "../../lib/theme";
import type { Analytics } from "../../lib/types";

const TOPIC_LABELS: Record<string, string> = { MIS: "管理資訊系統", DS: "資料結構", CS: "計算機概論" };

export default function AnalyticsScreen() {
  const [stats, setStats] = useState<Analytics | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
                      <Text style={styles.barLabel}>{TOPIC_LABELS[t.topic] ?? t.topic}</Text>
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
    </SafeAreaView>
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
  empty: { color: colors.ink3, fontSize: 13 },
  barRow: { gap: 5 },
  barHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  barLabel: { fontSize: 13.5, fontWeight: "700", color: colors.ink },
  barCount: { fontSize: 11, color: colors.ink3 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: "#F0F0F2" },
  barFill: { height: "100%", borderRadius: 4 },
});
