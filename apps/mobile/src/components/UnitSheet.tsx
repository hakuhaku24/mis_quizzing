import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, Modal, Animated } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { getQuestionTexts } from "../lib/analytics";
import { attemptBadge, subjectName } from "../lib/labels";
import { stripMarkup } from "../lib/text";
import { colors, radius, spacing } from "../lib/theme";
import type { UnitStat } from "../lib/types";
import { masteryLevel } from "./KnowledgeMap";

const RING = 84;
const STROKE = 8;
const R = (RING - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

/** Bottom sheet for one 知識地圖 unit: how it's going, what's still wrong, and a way in. */
export function UnitSheet({ unit, isFocus, onClose }: { unit: UnitStat | null; isFocus: boolean; onClose: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [texts, setTexts] = useState<Map<number, string>>(new Map());
  const [slide] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!unit) return;
    slide.setValue(0);
    Animated.spring(slide, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 160 }).start();
    let ignore = false;
    getQuestionTexts(unit.pending.map((p) => p.questionId)).then((t) => {
      if (!ignore) setTexts(t);
    });
    return () => {
      ignore = true;
    };
  }, [unit, slide]);

  if (!unit) return null;
  const lv = masteryLevel(unit.mastery);
  const pct = unit.mastery === null ? null : Math.round(unit.mastery * 100);

  const practice = () => {
    onClose();
    // `at` makes the bank re-apply the filter even when the same unit is picked twice
    router.navigate({ pathname: "/(tabs)/bank", params: { topic: unit.topic, unit: unit.unit, at: String(Date.now()) } });
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="關閉" />
        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.sm },
            { transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }] },
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.subject}>{subjectName(unit.topic)}</Text>
              <Text style={styles.unitName}>{unit.unit}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.close} accessibilityRole="button">
              <Text style={styles.closeText}>關閉</Text>
            </Pressable>
          </View>

          <View style={[styles.status, { backgroundColor: lv.bg, borderColor: lv.border, borderStyle: lv.dashed ? "dashed" : "solid" }]}>
            <View style={styles.ringBox}>
              <Svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`}>
                <Circle cx={RING / 2} cy={RING / 2} r={R} stroke={lv.border} strokeWidth={STROKE} fill="none" />
                {pct !== null && (
                  <Circle
                    cx={RING / 2}
                    cy={RING / 2}
                    r={R}
                    stroke={lv.fg}
                    strokeWidth={STROKE}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${(CIRCUMFERENCE * pct) / 100} ${CIRCUMFERENCE}`}
                    transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
                  />
                )}
              </Svg>
              <Text style={[styles.ringText, { color: lv.fg }]}>{pct === null ? "—" : `${pct}%`}</Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.levelText, { color: lv.fg }]}>{lv.symbol ? `${lv.symbol} ${lv.label}` : lv.label}</Text>
              <Text style={styles.statusText}>
                {unit.answered === 0
                  ? "這個單元還沒寫過，寫一題它就會在地圖上亮起來。"
                  : `寫過 ${unit.answered} 題，其中 ${unit.correct} 題答對。${isFocus ? "\n這個單元題目多，補起來最划算。" : ""}`}
              </Text>
            </View>
          </View>

          {unit.pending.length > 0 && (
            <View style={{ gap: 10 }}>
              <Text style={styles.sectionTitle}>還沒答對的題目</Text>
              {unit.pending.map((p) => {
                // self-assessment overrides the AI score (as in scoring.ts), so show that mark
                const badge = attemptBadge({ ...p.outcome, ai_score: p.outcome.self_assessment ? null : p.outcome.ai_score });
                return (
                  <Pressable
                    key={p.questionId}
                    style={styles.pendingRow}
                    onPress={() => {
                      onClose();
                      router.push(`/question/${p.questionId}?attempt=${p.attemptId}`);
                    }}
                  >
                    <Text style={styles.pendingText} numberOfLines={2}>{stripMarkup(texts.get(p.questionId) ?? "")}</Text>
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.color }]}>{badge.text}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          <View style={{ gap: 8 }}>
            <Pressable style={styles.cta} onPress={practice} accessibilityRole="button">
              <Text style={styles.ctaText}>練這個單元</Text>
            </Pressable>
            <Text style={styles.ctaHint}>會打開題庫，並篩選「{unit.unit}」這個單元</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(24,24,27,0.45)" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingHorizontal: spacing.xl, gap: 18 },
  handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "#D4D4D8" },
  header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  subject: { fontSize: 12, fontWeight: "700", color: colors.accent },
  unitName: { fontSize: 26, fontWeight: "900", color: colors.ink },
  close: { minHeight: 44, paddingHorizontal: spacing.md, justifyContent: "center" },
  closeText: { fontSize: 14, fontWeight: "700", color: colors.ink2 },
  status: { flexDirection: "row", alignItems: "center", gap: spacing.lg, borderWidth: 1, borderRadius: 18, padding: spacing.lg },
  ringBox: { width: RING, height: RING, alignItems: "center", justifyContent: "center" },
  ringText: { position: "absolute", fontSize: 20, fontWeight: "900" },
  levelText: { fontSize: 14, fontWeight: "800" },
  statusText: { fontSize: 13, lineHeight: 21, color: colors.ink2 },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: colors.ink },
  pendingRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 44, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: 14 },
  pendingText: { flex: 1, fontSize: 13.5, lineHeight: 21, color: colors.ink },
  badge: { minWidth: 40, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignItems: "center" },
  badgeText: { fontSize: 13, fontWeight: "800" },
  cta: { minHeight: 52, borderRadius: 16, backgroundColor: "#312E81", alignItems: "center", justifyContent: "center" },
  ctaText: { fontSize: 15, fontWeight: "800", color: "#fff" },
  ctaHint: { textAlign: "center", fontSize: 12, color: colors.ink2 },
});
