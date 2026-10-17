import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";
import { TodayRow } from "../components/TodayRow";
import { getDailyTasks } from "../lib/daily";
import { colors, radius, spacing, typography } from "../lib/theme";
import type { DailyItem } from "../lib/types";

/** All of today's questions; home lists only the next few. Was the 練習 tab until 2026-10-17. */
export default function TodayScreen() {
  const router = useRouter();
  const [items, setItems] = useState<DailyItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => setItems(await getDailyTasks()), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.iconButton} onPress={() => router.back()} accessibilityLabel="返回">
          <Ionicons name="chevron-back" size={18} color={colors.ink2} />
        </Pressable>
        <Text style={styles.topBarTitle}>今日練習</Text>
        <View style={{ width: 34 }} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />
        }
      >
        {items === null ? (
          <Text style={styles.empty}>載入中…</Text>
        ) : items.length === 0 ? (
          <Text style={styles.empty}>今天沒有題目</Text>
        ) : (
          <View style={styles.list}>
            {items.map((item, i) => (
              <TodayRow key={item.id} item={item} divider={i < items.length - 1} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, height: 56 },
  topBarTitle: { ...typography.h2, color: colors.ink },
  iconButton: { width: 34, height: 34, borderRadius: radius.full, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.xl, paddingTop: spacing.xs, paddingBottom: spacing.xxl },
  list: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, overflow: "hidden" },
  empty: { textAlign: "center", color: colors.ink3, paddingVertical: spacing.xxl },
});
