import { View, Text, StyleSheet } from "react-native";
import Svg, { Polygon } from "react-native-svg";
import { colors } from "../lib/theme";

/** One tick per 2.5%, the same scale as the analytics dial. */
const TICKS = 40;
/** The all-users average, same amber as the dial's notch. */
const MARK = "#B45309";

/**
 * 考前準備度 as a row of ticks with the all-users average as a small notch
 * above it (home screen, design C of
 * https://claude.ai/artifact/Kk4nQvpw9tjDdKSHbhDL5L). Not placed yet: an
 * empty scale and no average.
 */
export function ReadinessRuler({ percent, average }: { percent: number | null; average: number | null }) {
  const lit = percent === null ? 0 : Math.round((percent / 100) * TICKS);
  return (
    <View>
      <View style={styles.scale}>
        <View style={styles.ticks}>
          {Array.from({ length: TICKS }, (_, i) => (
            <View key={i} style={[styles.tick, { backgroundColor: i < lit ? colors.ink : colors.line }]} />
          ))}
        </View>
        {average !== null && (
          <Svg width={8} height={6} viewBox="0 0 8 6" style={[styles.notch, { left: `${average}%` }]}>
            <Polygon points="0,0 8,0 4,6" fill={MARK} />
          </Svg>
        )}
      </View>
      {average !== null && (
        <View style={styles.caption}>
          <Svg width={9} height={8} viewBox="0 0 10 9">
            <Polygon points="5,9 0,0 10,0" fill={MARK} />
          </Svg>
          <Text style={styles.captionText}>全體平均 {average}%</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scale: { marginTop: 12 },
  ticks: { flexDirection: "row", justifyContent: "space-between", height: 12 },
  tick: { width: 3, height: 12, borderRadius: 2 },
  notch: { position: "absolute", top: -9, marginLeft: -4 },
  caption: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 9 },
  captionText: { fontSize: 12, color: colors.ink2 },
});
