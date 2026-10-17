import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { sourceLabel, subjectName } from "../lib/labels";
import { stripMarkup } from "../lib/text";
import { colors, spacing } from "../lib/theme";
import type { DailyItem, Slot } from "../lib/types";

export const SLOT_ORDER: Slot[] = ["review", "weak", "unseen", "extra"];
export const SLOT_LABELS: Record<Slot, string> = { review: "複習", weak: "弱點", unseen: "新題", extra: "加練" };
// darker than the theme's warning/danger/info so the 10.5px labels stay readable on their tints
const SLOT_TONES: Record<Slot, { color: string; bg: string }> = {
  review: { color: "#B45309", bg: colors.warningSoft },
  weak: { color: "#B91C1C", bg: colors.dangerSoft },
  unseen: { color: "#1D4ED8", bg: colors.infoSoft },
  extra: { color: colors.ink2, bg: "#F4F4F5" },
};

/** One of today's questions: why it is in today's set, subject · source, and its first line. */
export function TodayRow({ item, divider }: { item: DailyItem; divider?: boolean }) {
  const router = useRouter();
  const source = sourceLabel(item);
  const tone = SLOT_TONES[item.slot];
  return (
    <Pressable
      style={[styles.row, divider && styles.divider]}
      onPress={() =>
        router.push(item.today_attempt_id ? `/question/${item.id}?attempt=${item.today_attempt_id}` : `/question/${item.id}`)
      }
    >
      <View style={styles.body}>
        <View style={styles.meta}>
          <View style={[styles.chip, { backgroundColor: tone.bg }]}>
            <Text style={[styles.chipText, { color: tone.color }]}>{SLOT_LABELS[item.slot]}</Text>
          </View>
          <Text style={styles.metaText} numberOfLines={1}>
            {subjectName(item.topic)}{source ? ` · ${source}` : ""}
          </Text>
        </View>
        <Text style={[styles.text, item.done_today && styles.textDone]} numberOfLines={1}>
          {stripMarkup(item.question_text)}
        </Text>
      </View>
      {item.done_today ? (
        <Text style={styles.check}>✓</Text>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={colors.ink3} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  divider: { borderBottomWidth: 1, borderBottomColor: "#F0F0F2" },
  body: { flex: 1, minWidth: 0 },
  meta: { flexDirection: "row", alignItems: "center", gap: 6 },
  chip: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 999 },
  chipText: { fontSize: 10.5, fontWeight: "700" },
  metaText: { flexShrink: 1, fontSize: 11.5, color: colors.ink2 },
  text: { marginTop: 5, fontSize: 14, color: colors.ink },
  textDone: { color: "#71717A" },
  check: { fontSize: 16, fontWeight: "700", color: colors.success },
});
