import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl, ScrollView } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { getHistory, type HistoryRow } from "../../lib/analytics";
import { attemptBadge } from "../../lib/labels";
import { stripMarkup } from "../../lib/text";
import { colors, radius, spacing, typography } from "../../lib/theme";

const FILTERS: { label: string; topic: string | null }[] = [
  { label: "全部", topic: null },
  { label: "計算機概論", topic: "CS" },
  { label: "資料結構", topic: "DS" },
  { label: "管理資訊系統", topic: "MIS" },
];
const ERROR_TYPE_LABELS: Record<string, string> = { concept: "觀念不懂", memory: "記憶模糊", careless: "粗心", unseen: "沒看過" };

export default function HistoryScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => setRows(await getHistory()), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const visible = (rows ?? []).filter((r) => filter === null || r.topic === filter);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <Text style={styles.title}>答題紀錄</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable key={f.label} onPress={() => setFilter(f.topic)} style={[styles.filterChip, filter === f.topic && styles.filterChipActive]}>
            <Text style={[styles.filterText, filter === f.topic && styles.filterTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <FlatList
        data={visible}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListEmptyComponent={<Text style={styles.empty}>{rows === null ? "載入中…" : "還沒有紀錄"}</Text>}
        renderItem={({ item }) => {
          const badge = attemptBadge(item);
          return (
            <Pressable style={styles.row} onPress={() => router.push(`/question/${item.question_id}?attempt=${item.id}`)}>
              <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.badgeText, { color: badge.color }]}>{badge.text}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowText} numberOfLines={1}>{stripMarkup(item.question_text)}</Text>
                <View style={styles.subRow}>
                  <Text style={styles.rowSub}>{new Date(item.created_at).toLocaleDateString("zh-TW")}</Text>
                  {item.error_type && ERROR_TYPE_LABELS[item.error_type] && (
                    <View style={styles.errorChip}>
                      <Text style={styles.errorChipText}>{ERROR_TYPE_LABELS[item.error_type]}</Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  title: { ...typography.h1, paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  filterRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  filterChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { fontSize: 12, fontWeight: "600", color: colors.ink2 },
  filterTextActive: { color: "#fff", fontWeight: "700" },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.sm },
  empty: { textAlign: "center", color: colors.ink3, paddingVertical: spacing.xxl },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md },
  badge: { minWidth: 44, height: 34, paddingHorizontal: 6, borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 12.5, fontWeight: "800" },
  rowText: { fontSize: 13, fontWeight: "600", color: colors.ink },
  subRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 2 },
  rowSub: { fontSize: 11, color: colors.ink3 },
  errorChip: { backgroundColor: colors.warningSoft, borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 1 },
  errorChipText: { fontSize: 10, fontWeight: "700", color: "#B45309" },
});
