import { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "../lib/theme";

/**
 * Opening drawing: a book under a graduation cap, drawn in single-weight ink
 * lines, then two pages turn. Design picked 2026-10-17 (version B of
 * https://claude.ai/artifact/3MiSWhkfHWFvANpMC3b4jA). Everything reads one
 * clock that runs 0 → OPENING_MS once, so the words and buttons on the
 * welcome screen can time themselves against the same drawing.
 */
export const OPENING_MS = 3000;

const VIEW_W = 260;
const VIEW_H = 210;
const STROKE = 2;
const PAPER = "#FFFFFF";
const ease = Easing.bezier(0.25, 0.1, 0.25, 1);
const turn = Easing.bezier(0.45, 0.05, 0.35, 1);

const COVER = "M42 178 L42 185 C 70 177, 108 179, 130 193 C 152 179, 190 177, 218 185 L218 178";
const PAGE_LEFT = "M130 118 C 108 104, 70 102, 42 110 L42 178 C 70 170, 108 172, 130 186 Z";
const PAGE_RIGHT = "M130 118 C 152 104, 190 102, 218 110 L218 178 C 190 170, 152 172, 130 186 Z";
const LINES_LEFT = [
  "M114 130 C 98 122, 76 121, 58 125",
  "M114 142 C 98 134, 76 133, 58 137",
  "M114 154 C 98 146, 80 145, 70 146",
];
const LINES_RIGHT = [
  "M146 130 C 162 122, 184 121, 202 125",
  "M146 142 C 162 134, 184 133, 202 137",
  "M146 154 C 162 146, 180 145, 190 146",
];
const CAP_BASE = "M98 56 L98 80 C 114 92, 146 92, 162 80 L162 56";
const CAP_BOARD = "M130 18 L194 44 L130 70 L66 44 Z";
const CORD = "M130 44 L184 50";
/** The part that swings, around the board corner (184, 50). */
const HANG = "M184 50 L184 71";
const TASSEL = "M184 71 L179 87 L189 87 Z";
const SWING_BOX = 80;
const BUTTON_R = 2.2;
const BUTTON_LEN = 2 * Math.PI * BUTTON_R;

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Length of a path made of absolute M / L / C / Z commands (all this drawing uses). */
function pathLength(d: string): number {
  const tokens = d.match(/[MLCZ]|-?\d*\.?\d+/g) ?? [];
  let i = 0;
  let cmd = "";
  let x = 0, y = 0, startX = 0, startY = 0, length = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[MLCZ]/.test(tokens[i])) cmd = tokens[i++];
    if (cmd === "M") {
      x = startX = num();
      y = startY = num();
      cmd = "L"; // further pairs after M are line-tos
    } else if (cmd === "L") {
      const nx = num(), ny = num();
      length += Math.hypot(nx - x, ny - y);
      x = nx; y = ny;
    } else if (cmd === "C") {
      const p = [x, y, num(), num(), num(), num(), num(), num()];
      let px = x, py = y;
      for (let s = 1; s <= 24; s++) {
        const t = s / 24, u = 1 - t;
        const qx = u * u * u * p[0] + 3 * u * u * t * p[2] + 3 * u * t * t * p[4] + t * t * t * p[6];
        const qy = u * u * u * p[1] + 3 * u * u * t * p[3] + 3 * u * t * t * p[5] + t * t * t * p[7];
        length += Math.hypot(qx - px, qy - py);
        px = qx; py = qy;
      }
      x = p[6]; y = p[7];
    } else if (cmd === "Z") {
      length += Math.hypot(startX - x, startY - y);
      x = startX; y = startY;
      cmd = "";
    } else {
      i++; // not a command this drawing uses
    }
  }
  return length;
}

function at(clock: Animated.Value, start: number, duration: number, from: number, to: number, easing = ease) {
  return clock.interpolate({ inputRange: [start, start + duration], outputRange: [from, to], extrapolate: "clamp", easing });
}

/** Starts the clock on mount; with reduced motion on, jumps straight to the end. */
export function useOpeningClock(): Animated.Value {
  const [clock] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) clock.setValue(OPENING_MS);
        else Animated.timing(clock, { toValue: OPENING_MS, duration: OPENING_MS, easing: Easing.linear, useNativeDriver: false }).start();
      });
    return () => {
      cancelled = true;
      clock.stopAnimation();
    };
  }, [clock]);
  return clock;
}

/** Fade-and-rise for whatever sits under the drawing. */
export function riseIn(clock: Animated.Value, start: number) {
  return { opacity: at(clock, start, 600, 0, 1), transform: [{ translateY: at(clock, start, 600, 8, 0) }] };
}

function Stroke({ clock, d, start, duration, paper }: {
  clock: Animated.Value;
  d: string;
  start: number;
  duration: number;
  /** [start, duration] of the white page fill coming in under the line */
  paper?: [number, number];
}) {
  const length = useMemo(() => pathLength(d), [d]);
  const offset = useMemo(() => at(clock, start, duration, length, 0), [clock, start, duration, length]);
  const fillOpacity = useMemo(() => (paper ? at(clock, paper[0], paper[1], 0, 1) : undefined), [clock, paper]);
  return (
    <AnimatedPath
      d={d}
      stroke={colors.ink}
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={paper ? PAPER : "none"}
      fillOpacity={fillOpacity}
      strokeDasharray={[length, length]}
      strokeDashoffset={offset}
    />
  );
}

/** A page that has already been drawn, for the two that turn. */
function TurningPage({ clock, start, width, height }: { clock: Animated.Value; start: number; width: number; height: number }) {
  const style = useMemo(
    () => ({
      // appears exactly over the drawn right page once it is finished, then turns about the spine (the centre)
      opacity: clock.interpolate({ inputRange: [1349, 1350], outputRange: [0, 1], extrapolate: "clamp" }),
      transform: [{ scaleX: at(clock, start, 750, 1, -1, turn) }],
    }),
    [clock, start]
  );
  return (
    <Animated.View style={[styles.cover, style]} pointerEvents="none">
      <Svg width={width} height={height} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
        <Path d={PAGE_RIGHT} fill={PAPER} stroke={colors.ink} strokeWidth={STROKE} strokeLinejoin="round" />
        {LINES_RIGHT.map((d) => (
          <Path key={d} d={d} fill="none" stroke={colors.ink} strokeWidth={STROKE} strokeLinecap="round" />
        ))}
      </Svg>
    </Animated.View>
  );
}

const PAGE_PAPER: [number, number] = [600, 400];
const BOARD_PAPER: [number, number] = [950, 300];

export function OnboardingArt({ clock, width = 280 }: { clock: Animated.Value; width?: number }) {
  const scale = width / VIEW_W;
  const height = VIEW_H * scale;
  const box = SWING_BOX * scale;

  const buttonOffset = useMemo(() => at(clock, 1150, 200, BUTTON_LEN, 0), [clock]);
  const swing = useMemo(
    () => ({
      transform: [{
        rotate: clock.interpolate({
          inputRange: [1600, 1950, 2300, 2650, 3000],
          outputRange: ["0deg", "10deg", "-6deg", "3deg", "0deg"],
          extrapolate: "clamp",
        }),
      }],
    }),
    [clock]
  );

  return (
    <View style={{ width, height }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={height} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
        <Stroke clock={clock} d={COVER} start={100} duration={900} />
        <Stroke clock={clock} d={PAGE_LEFT} start={100} duration={900} paper={PAGE_PAPER} />
        <Stroke clock={clock} d={PAGE_RIGHT} start={100} duration={900} paper={PAGE_PAPER} />
        {[...LINES_LEFT, ...LINES_RIGHT].map((d, i) => (
          <Stroke key={d} clock={clock} d={d} start={750 + (i % 3) * 100} duration={350} />
        ))}
        <Stroke clock={clock} d={CAP_BASE} start={450} duration={600} />
        <Stroke clock={clock} d={CAP_BOARD} start={550} duration={700} paper={BOARD_PAPER} />
        <AnimatedCircle
          cx={130} cy={44} r={BUTTON_R} fill="none" stroke={colors.ink} strokeWidth={STROKE}
          strokeDasharray={[BUTTON_LEN, BUTTON_LEN]} strokeDashoffset={buttonOffset}
        />
        <Stroke clock={clock} d={CORD} start={1150} duration={250} />
      </Svg>

      {/* tassel: its own small box centred on the board corner, so rotating the box swings it from there */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.swingBox,
          { left: (184 - SWING_BOX / 2) * scale, top: (50 - SWING_BOX / 2) * scale, width: box, height: box },
          swing,
        ]}
      >
        <Svg width={box} height={box} viewBox={`${184 - SWING_BOX / 2} ${50 - SWING_BOX / 2} ${SWING_BOX} ${SWING_BOX}`}>
          <Stroke clock={clock} d={HANG} start={1400} duration={150} />
          <Stroke clock={clock} d={TASSEL} start={1450} duration={300} />
        </Svg>
      </Animated.View>

      <TurningPage clock={clock} start={1700} width={width} height={height} />
      <TurningPage clock={clock} start={2150} width={width} height={height} />
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  swingBox: { position: "absolute" },
});
