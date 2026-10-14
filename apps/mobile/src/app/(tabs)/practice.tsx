import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";
import { getDailyTasks } from "../../lib/daily";
import { stripMarkup } from "../../lib/text";
import { colors, radius, spacing, typography } from "../../lib/theme";
import type { DailyItem } from "../../lib/types";

const SLOT_META: Record<string, { label: string; color: string; bg: string }> = {
  review: { label: "複習", color: "#D97706", bg: colors.warningSoft },
  weak: { label: "弱點", color: colors.danger, bg: colors.dangerSoft },
  unseen: { label: "新題", color: colors.info, bg: colors.infoSoft },
  extra: { label: "加練", color: colors.ink3, bg: "#F4F4F5" },
};

export default function PracticeListScreen() {
  const router = useRouter();
  const [items, setItems] = useState<DailyItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => setItems(await getDailyTasks()), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <Text style={styles.title}>今日練習</Text>
      <FlatList
        data={items ?? []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />
        }
        ListEmptyComponent={
          items === null ? <Text style={styles.empty}>載入中…</Text> : <Text style={styles.empty}>今日任務是空的</Text>
        }
        renderItem={({ item }) => {
          const meta = SLOT_META[item.slot] ?? SLOT_META.extra;
          return (
            <Pressable
              style={[styles.row, item.done_today && styles.rowDone]}
              onPress={() =>
                router.push(item.today_attempt_id ? `/question/${item.id}?attempt=${item.today_attempt_id}` : `/question/${item.id}`)
              }
            >
              <View style={[styles.chip, { backgroundColor: meta.bg }]}>
                <Text style={[styles.chipText, { color: meta.color }]}>{meta.label}</Text>
              </View>
              <Text style={[styles.rowText, item.done_today && styles.rowTextDone]} numberOfLines={1}>
                {stripMarkup(item.question_text)}
              </Text>
              {item.done_today ? (
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              ) : (
                <Ionicons name="chevron-forward" size={16} color={colors.ink3} />
              )}
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  title: { ...typography.h1, paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.sm },
  empty: { textAlign: "center", color: colors.ink3, paddingVertical: spacing.xxl },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.md, padding: spacing.md,
  },
  rowDone: { opacity: 0.5 },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full },
  chipText: { fontSize: 10.5, fontWeight: "700" },
  rowText: { flex: 1, fontSize: 13, color: colors.ink },
  rowTextDone: { textDecorationLine: "line-through" },
});
