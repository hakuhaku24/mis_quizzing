import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import Svg, { Line, Polygon } from "react-native-svg";
import { colors, radius, spacing } from "../lib/theme";

const SIZE = 240;
const CENTER = SIZE / 2;
/** One tick per 2.5%. */
const TICKS = 40;
const TICK_IN = 88;
const TICK_OUT = 104;
const TICK_DELAY_MS = 22;
const MARK = "#B45309";

const AnimatedLine = Animated.createAnimatedComponent(Line);

function polar(deg: number, r: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [CENTER + r * Math.cos(a), CENTER + r * Math.sin(a)];
}

const tickAngle = (i: number) => -90 + (i * 360) / TICKS;

/**
 * 考前準備度 as an instrument dial rather than a progress donut: lit ticks
 * come on one by one, and the all-users average is a small notch outside
 * the scale. Deliberately plain — ink on white, no gradients or glow.
 */
function Dial({ percent, average }: { percent: number | null; average: number | null }) {
  const lit = percent === null ? 0 : Math.round((percent / 100) * TICKS);
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    progress.setValue(0);
    if (lit === 0) return;
    Animated.timing(progress, { toValue: 1, duration: lit * TICK_DELAY_MS, easing: Easing.linear, useNativeDriver: false }).start();
  }, [lit, progress]);

  const notch =
    average === null
      ? null
      : [polar(-90 + average * 3.6, 108), polar(-90 + average * 3.6 - 3.2, 119), polar(-90 + average * 3.6 + 3.2, 119)]
          .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
          .join(" ");

  return (
    <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      {Array.from({ length: TICKS }, (_, i) => {
        const [x1, y1] = polar(tickAngle(i), TICK_IN);
        const [x2, y2] = polar(tickAngle(i), TICK_OUT);
        return <Line key={`base-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={colors.line} strokeWidth={3.5} strokeLinecap="round" />;
      })}
      {Array.from({ length: lit }, (_, i) => {
        const [x1, y1] = polar(tickAngle(i), TICK_IN);
        const [x2, y2] = polar(tickAngle(i), TICK_OUT);
        const opacity = progress.interpolate({ inputRange: [i / lit, (i + 1) / lit], outputRange: [0, 1], extrapolate: "clamp" });
        return (
          <AnimatedLine key={`lit-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={colors.ink} strokeWidth={3.5} strokeLinecap="round" opacity={opacity} />
        );
      })}
      {notch && <Polygon points={notch} fill={MARK} />}
    </Svg>
  );
}

export interface ReadinessCardProps {
  percent: number | null;
  /** how many more scored questions until placement */
  missing: number;
  average: number | null;
  questionsAnswered: number;
  totalAttempts: number;
  aiGraded: number;
  avgAiScore: number | null;
}

export function ReadinessCard(p: ReadinessCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.dialBox}>
        <Dial percent={p.percent} average={p.percent === null ? null : p.average} />
        <View style={styles.center} pointerEvents="none">
          {p.percent === null ? (
            <Text style={styles.unplaced}>未定位</Text>
          ) : (
            <View style={styles.numberRow}>
              <Text style={styles.number}>{p.percent}</Text>
              <Text style={styles.percentSign}>%</Text>
            </View>
          )}
          <Text style={styles.centerLabel}>考前準備度</Text>
        </View>
      </View>

      {p.percent === null ? (
        <Text style={styles.caption}>寫任意 5 題就會出現（還差 {p.missing} 題）</Text>
      ) : (
        <View style={styles.captionRow}>
          {p.average !== null && (
            <>
              <Svg width={10} height={9} viewBox="0 0 10 9">
                <Polygon points="5,9 0,0 10,0" fill={MARK} />
              </Svg>
              <Text style={styles.caption}>
                全體平均 <Text style={styles.captionStrong}>{p.average}%</Text>
              </Text>
              <Text style={styles.captionSep}>|</Text>
            </>
          )}
          <Text style={styles.caption}>答對就會往上</Text>
        </View>
      )}

      <View style={styles.divider} />

      <View style={styles.stats}>
        <Stat value={String(p.questionsAnswered)} label="寫過的題目" />
        <Stat value={String(p.totalAttempts)} label="總作答" divided />
        <Stat value={String(p.aiGraded)} label="AI 批改" divided />
        <Stat value={p.avgAiScore !== null ? p.avgAiScore.toFixed(1) : "—"} label="AI 平均" divided />
      </View>
    </View>
  );
}

function Stat({ value, label, divided }: { value: string; label: string; divided?: boolean }) {
  return (
    <View style={[styles.stat, divided && styles.statDivided]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.xl, paddingTop: spacing.xl, paddingHorizontal: spacing.lg, paddingBottom: 18, alignItems: "center", gap: 10 },
  dialBox: { width: SIZE, height: SIZE },
  center: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
  numberRow: { flexDirection: "row", alignItems: "baseline" },
  number: { fontSize: 64, fontWeight: "800", letterSpacing: -2, color: colors.ink, fontVariant: ["tabular-nums"], includeFontPadding: false },
  percentSign: { fontSize: 22, fontWeight: "700", color: colors.ink2, marginLeft: 2 },
  unplaced: { fontSize: 28, fontWeight: "800", color: colors.ink },
  centerLabel: { marginTop: 6, fontSize: 12.5, fontWeight: "500", color: colors.ink2 },
  captionRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  caption: { fontSize: 12.5, color: colors.ink2 },
  captionStrong: { fontWeight: "800", color: colors.ink, fontVariant: ["tabular-nums"] },
  captionSep: { fontSize: 12.5, color: "#D4D4D8" },
  divider: { alignSelf: "stretch", height: 1, backgroundColor: "#F0F0F2", marginTop: spacing.sm, marginBottom: spacing.xs },
  stats: { alignSelf: "stretch", flexDirection: "row" },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statDivided: { borderLeftWidth: 1, borderLeftColor: "#F0F0F2" },
  statValue: { fontSize: 20, fontWeight: "800", color: colors.ink, fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 11.5, color: colors.ink2 },
});
