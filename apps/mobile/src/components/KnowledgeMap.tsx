import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, Animated, type LayoutChangeEvent } from "react-native";
import { subjectShortName } from "../lib/labels";
import { GRADUATE_AT } from "../lib/scoring";
import { colors, radius, spacing } from "../lib/theme";
import type { SubjectMap, UnitStat } from "../lib/types";

const COLUMNS = 3;
const GAP = 8;
/** The biggest units get a double-width tile, so the map shows what's tested most. */
const BIG_TILES = 4;
const BIG_MIN_QUESTIONS = 10;
/** Same cut-off as "wrong" elsewhere (srs.ts, analytics.ts). */
const WEAK_BELOW = 0.4;

export interface MasteryLevel {
  label: string;
  symbol: string;
  bg: string;
  border: string;
  fg: string;
  dashed: boolean;
}

// Text colors are a shade darker than the theme's so small text keeps 4.5:1 contrast on the soft fills.
export function masteryLevel(mastery: number | null): MasteryLevel {
  if (mastery === null) return { label: "還沒寫過", symbol: "", bg: "#FAFAFA", border: "#D4D4D8", fg: "#71717A", dashed: true };
  if (mastery >= GRADUATE_AT) return { label: "熟練", symbol: "✓", bg: colors.successSoft, border: "#BBF7D0", fg: "#15803D", dashed: false };
  if (mastery >= WEAK_BELOW) return { label: "半熟", symbol: "△", bg: colors.warningSoft, border: colors.warningLine, fg: "#B45309", dashed: false };
  return { label: "待加強", symbol: "✕", bg: colors.dangerSoft, border: colors.dangerLine, fg: "#B91C1C", dashed: false };
}

type Cell = { unit: UnitStat; span: 1 | 2 };

/** Rows of three cells: each big tile shares a row with one small tile
 *  (alternating sides), the remaining small tiles fill rows of three. */
function packRows(units: UnitStat[]): Cell[][] {
  const big = units.slice(0, BIG_TILES).filter((u) => u.questionCount >= BIG_MIN_QUESTIONS);
  const small = units.filter((u) => !big.includes(u));
  const rows: Cell[][] = big.map((u, i) => {
    const partner = small.shift();
    const row: Cell[] = partner ? [{ unit: u, span: 2 }, { unit: partner, span: 1 }] : [{ unit: u, span: 2 }];
    return i % 2 === 0 ? row : row.reverse();
  });
  while (small.length) rows.push(small.splice(0, COLUMNS).map((u) => ({ unit: u, span: 1 })));
  return rows;
}

function defaultTopic(subjects: SubjectMap[]): string | null {
  const priority = (u: UnitStat) => (1 - (u.mastery ?? 1)) * u.questionCount;
  const withFocus = subjects.filter((s) => s.focus).sort((a, b) => priority(b.focus!) - priority(a.focus!));
  return (withFocus[0] ?? subjects.find((s) => s.units.some((u) => u.answered > 0)) ?? subjects[0])?.topic ?? null;
}

export function KnowledgeMap({ subjects, onOpenUnit }: { subjects: SubjectMap[]; onOpenUnit: (unit: UnitStat) => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const [fade] = useState(() => new Animated.Value(0));

  const fallback = useMemo(() => defaultTopic(subjects), [subjects]);
  const topic = picked && subjects.some((s) => s.topic === picked) ? picked : fallback;
  const subject = subjects.find((s) => s.topic === topic) ?? null;
  const rows = useMemo(() => (subject ? packRows(subject.units) : []), [subject]);

  // tiles fade up whenever the subject changes
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, [topic, fade]);

  if (!subject) return null;
  const cell = width > 0 ? (width - GAP * (COLUMNS - 1)) / COLUMNS : 0;
  const focus = subject.focus;

  return (
    <View style={styles.card}>
      <View style={{ gap: 4 }}>
        <Text style={styles.title}>知識地圖</Text>
        <Text style={styles.hint}>每一格是一個單元，越大格的單元考越多。寫過的單元會亮起來。</Text>
      </View>

      {subjects.length > 1 && (
        <View style={styles.tabs}>
          {subjects.map((s) => {
            const active = s.topic === topic;
            return (
              <Pressable
                key={s.topic}
                onPress={() => setPicked(s.topic)}
                style={[styles.tab, active && styles.tabActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{subjectShortName(s.topic)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Animated.View
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        style={{ gap: GAP, opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }}
      >
        {cell > 0 &&
          rows.map((row, i) => (
            <View key={i} style={styles.row}>
              {row.map(({ unit, span }) => {
                const lv = masteryLevel(unit.mastery);
                const pct = unit.mastery === null ? null : Math.round(unit.mastery * 100);
                return (
                  <Pressable
                    key={unit.unit}
                    onPress={() => onOpenUnit(unit)}
                    accessibilityRole="button"
                    accessibilityLabel={`${unit.unit}，${lv.label}${pct === null ? "" : `，${pct}%`}`}
                    style={({ pressed }) => [
                      styles.tile,
                      {
                        width: span === 2 ? cell * 2 + GAP : cell,
                        minHeight: span === 2 ? 76 : 68,
                        backgroundColor: lv.bg,
                        borderColor: lv.border,
                        borderStyle: lv.dashed ? "dashed" : "solid",
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <View style={styles.tileTop}>
                      <Text style={[styles.tileName, { color: lv.fg }]} numberOfLines={2}>{unit.unit}</Text>
                      {!!lv.symbol && <Text style={[styles.tileSymbol, { color: lv.fg }]}>{lv.symbol}</Text>}
                    </View>
                    {pct === null ? (
                      <Text style={[styles.tileEmpty, { color: lv.fg }]}>還沒寫過</Text>
                    ) : (
                      <Text style={[styles.tilePct, { color: lv.fg, fontSize: span === 2 ? 22 : 18 }]}>{pct}%</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
      </Animated.View>

      <View style={styles.legend}>
        <Text style={styles.legendItem}><Text style={{ color: "#15803D", fontWeight: "800" }}>✓</Text> 熟練 70% 以上</Text>
        <Text style={styles.legendItem}><Text style={{ color: "#B45309", fontWeight: "800" }}>△</Text> 半熟</Text>
        <Text style={styles.legendItem}><Text style={{ color: "#B91C1C", fontWeight: "800" }}>✕</Text> 待加強（未滿 40%）</Text>
        <Text style={styles.legendItem}>虛線框：還沒寫過</Text>
      </View>

      {focus && (
        <View style={styles.focus}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.focusLabel}>最值得先補的單元</Text>
            <Text style={styles.focusName}>{focus.unit} · {Math.round((focus.mastery ?? 0) * 100)}%</Text>
            <Text style={styles.focusWhy}>題目多、目前掌握度偏低</Text>
          </View>
          <Pressable style={styles.focusBtn} onPress={() => onOpenUnit(focus)} accessibilityRole="button">
            <Text style={styles.focusBtnText}>去練習</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.xl, padding: spacing.xl, gap: 14 },
  title: { fontSize: 16, fontWeight: "800", color: colors.ink },
  hint: { fontSize: 12.5, lineHeight: 20, color: colors.ink2 },
  tabs: { flexDirection: "row", gap: 4, backgroundColor: "#F4F4F5", borderRadius: 12, padding: 4 },
  tab: { flex: 1, minHeight: 40, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  tabActive: { backgroundColor: colors.surface, shadowColor: "#18181B", shadowOpacity: 0.1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  tabText: { fontSize: 13.5, fontWeight: "500", color: colors.ink2 },
  tabTextActive: { fontWeight: "800", color: "#312E81" },
  row: { flexDirection: "row", gap: GAP },
  tile: { borderWidth: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, justifyContent: "space-between", gap: 6 },
  tileTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 4 },
  tileName: { flexShrink: 1, fontSize: 13.5, fontWeight: "700", lineHeight: 18 },
  tileSymbol: { fontSize: 13, fontWeight: "800" },
  tilePct: { fontWeight: "900", letterSpacing: -0.5 },
  tileEmpty: { fontSize: 11.5, fontWeight: "500" },
  legend: { flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 6 },
  legendItem: { fontSize: 11.5, color: colors.ink2 },
  focus: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.dangerLine, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16 },
  focusLabel: { fontSize: 11.5, fontWeight: "700", color: "#B91C1C" },
  focusName: { fontSize: 16, fontWeight: "800", color: colors.ink },
  focusWhy: { fontSize: 12, color: colors.ink2 },
  focusBtn: { minHeight: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "#312E81", alignItems: "center", justifyContent: "center" },
  focusBtnText: { fontSize: 13.5, fontWeight: "700", color: "#fff" },
});
