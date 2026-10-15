import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { ERROR_TYPE_LABELS } from "../lib/labels";
import { colors, radius, spacing } from "../lib/theme";
import type { ErrorReasons, ErrorType } from "../lib/types";

/** Darkest for the most common reason; differs in lightness, not just hue. */
const SHADES = ["#312E81", "#6366F1", "#A5B4FC", "#E0E7FF"];

/** One concrete next step for the most common reason. */
const ADVICE: Record<ErrorType, string> = {
  memory: "觀念其實懂，只是忘了。每日練習裡的複習題就是為這個設計的。",
  concept: "先把詳解看懂，再用「再練一次」自己重寫一遍，比一直寫新題更有效。",
  careless: "送出前多看一眼題目要求和自己的答案，這些分數其實拿得回來。",
  unseen: "有些單元還沒碰過，可以從知識地圖上的虛線格子開始補。",
};

/** 失分原因 — shown only once there are enough recorded reasons (see analytics.ts). */
export function ErrorReasonsCard({ data }: { data: ErrorReasons }) {
  const [grow] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(grow, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, [grow]);

  const pct = (n: number) => Math.round((n / data.total) * 100);
  const top = data.items[0];

  return (
    <View style={styles.card}>
      <View style={{ gap: 4 }}>
        <Text style={styles.title}>失分原因</Text>
        <Text style={styles.hint}>整理自你答錯後選的錯誤原因，共 {data.total} 次。</Text>
      </View>

      <Animated.View style={[styles.bar, { transform: [{ scaleX: grow }], transformOrigin: "left" }]}>
        {data.items.map((it, i) => (
          <View key={it.type} style={{ flex: it.count, backgroundColor: SHADES[i] }} />
        ))}
      </Animated.View>

      <View style={styles.legend}>
        {data.items.map((it, i) => (
          <View key={it.type} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: SHADES[i] }, i === SHADES.length - 1 && styles.swatchLight]} />
            <Text style={styles.legendLabel}>{ERROR_TYPE_LABELS[it.type]}</Text>
            <Text style={styles.legendPct}>{pct(it.count)}%</Text>
          </View>
        ))}
      </View>

      <Text style={styles.advice}>
        你最常見的失分原因是「{ERROR_TYPE_LABELS[top.type]}」（{pct(top.count)}%）：{ADVICE[top.type]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.xl, padding: spacing.xl, gap: 14 },
  title: { fontSize: 16, fontWeight: "800", color: colors.ink },
  hint: { fontSize: 12.5, lineHeight: 20, color: colors.ink2 },
  bar: { flexDirection: "row", height: 16, borderRadius: 8, overflow: "hidden", gap: 2 },
  legend: { flexDirection: "row", flexWrap: "wrap", rowGap: 10 },
  legendItem: { width: "50%", flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingRight: spacing.md },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  swatchLight: { borderWidth: 1, borderColor: "#C7D2FE" },
  legendLabel: { fontSize: 13, color: colors.ink },
  legendPct: { marginLeft: "auto", fontSize: 13, fontWeight: "800", color: colors.ink },
  advice: { backgroundColor: colors.accentSoft, borderRadius: 14, paddingVertical: spacing.md, paddingHorizontal: 14, fontSize: 13, lineHeight: 21, color: "#3730A3" },
});
