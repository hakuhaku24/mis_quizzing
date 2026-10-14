// Design tokens — carried over from the UI/UX v2 design pass
// (https://claude.ai/artifact/CjcxCfQPS4Ywy8bC2dmwoy)
export const colors = {
  accent: "#4338CA",
  accent2: "#4F46E5",
  accentSoft: "#EEF2FF",
  ink: "#18181B",
  ink2: "#52525B",
  ink3: "#A1A1AA",
  ground: "#FAFAFA",
  surface: "#FFFFFF",
  line: "#E4E4E7",
  success: "#16A34A",
  successSoft: "#F0FDF4",
  warning: "#D97706",
  warningSoft: "#FFFBEB",
  warningLine: "#FDE68A",
  danger: "#DC2626",
  dangerSoft: "#FEF2F2",
  dangerLine: "#FECACA",
  info: "#2563EB",
  infoSoft: "#EFF6FF",
  infoLine: "#BFDBFE",
  aiAccent: "#7C3AED",
  aiSoft: "#F5F3FF",
  aiLine: "#DDD6FE",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 };

export const radius = { sm: 10, md: 14, lg: 18, xl: 20, xxl: 24, full: 999 };

export const typography = {
  h1: { fontSize: 22, fontWeight: "800" as const },
  h2: { fontSize: 15, fontWeight: "800" as const },
  body: { fontSize: 14, fontWeight: "400" as const },
  bodyBold: { fontSize: 14, fontWeight: "700" as const },
  small: { fontSize: 12, fontWeight: "500" as const },
  tiny: { fontSize: 11, fontWeight: "600" as const },
};

export function masteryColor(pct: number): string {
  if (pct >= 70) return colors.success;
  if (pct >= 40) return colors.warning;
  return colors.danger;
}
