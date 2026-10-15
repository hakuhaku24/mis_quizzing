import { colors } from "./theme";

const SCHOOL_NAMES: Record<string, string> = {
  NTU: "臺大",
  NCU: "中央",
  NCCU: "政大",
  NCKU: "成大",
  NSYSU: "中山",
  NTHU: "清大",
  NYCU: "陽明交大",
  CCU: "中正",
};

export function schoolName(code: string): string {
  return SCHOOL_NAMES[code] ?? code;
}

/** "113 中央" for real exam questions, "範本題" for templates. */
export function sourceLabel(q: { school: string | null; exam_year?: number | null }): string | null {
  if (!q.school) return null;
  if (q.school === "template") return "範本題";
  const name = SCHOOL_NAMES[q.school] ?? q.school;
  return q.exam_year ? `${q.exam_year} ${name}` : name;
}

export interface AttemptOutcome {
  is_correct: boolean | null;
  ai_score: number | null;
  self_assessment: string | null;
}

export interface Badge {
  bg: string;
  color: string;
  text: string;
}

/** Score / mark badge shared by the history list and question bank. */
export function attemptBadge(a: AttemptOutcome): Badge {
  if (a.is_correct === true) return { bg: colors.successSoft, color: colors.success, text: "✓" };
  if (a.is_correct === false) return { bg: colors.dangerSoft, color: colors.danger, text: "✕" };
  if (a.ai_score != null) {
    const v = a.ai_score;
    const text = `${v}/10`;
    if (v >= 7) return { bg: colors.successSoft, color: colors.success, text };
    if (v >= 4) return { bg: colors.warningSoft, color: colors.warning, text };
    return { bg: colors.dangerSoft, color: colors.danger, text };
  }
  if (a.self_assessment === "correct") return { bg: colors.successSoft, color: colors.success, text: "✓" };
  if (a.self_assessment === "partial") return { bg: colors.warningSoft, color: colors.warning, text: "△" };
  if (a.self_assessment === "wrong") return { bg: colors.dangerSoft, color: colors.danger, text: "✕" };
  return { bg: "#F4F4F5", color: colors.ink3, text: "—" };
}
