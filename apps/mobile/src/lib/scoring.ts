/**
 * Single source of truth for how an answer is scored and how the
 * 考前準備度 (readiness) is derived. Design decided by the developer —
 * see CURRENT_STATUS.md §6.2.2 before changing anything here.
 */

export const PLACEMENT_QUESTIONS = 5;
/** Score at or above which a question "graduates" (no more review). */
export const GRADUATE_AT = 0.7;

export interface ScorableAttempt {
  question_id: number;
  is_correct: boolean | null;
  ai_score: number | null;
  self_assessment: string | null;
  created_at: string;
}

/** 0–1, or null if the attempt hasn't been scored yet. Self-assessment
 *  overrides the AI score: the student has the final say. */
export function attemptScore(a: Pick<ScorableAttempt, "is_correct" | "ai_score" | "self_assessment">): number | null {
  if (a.is_correct !== null) return a.is_correct ? 1 : 0;
  if (a.self_assessment === "correct") return 1;
  if (a.self_assessment === "partial") return 0.5;
  if (a.self_assessment === "wrong") return 0;
  if (a.ai_score !== null) return a.ai_score / 10;
  return null;
}

/** question_id -> score of its most recent *scored* attempt. */
export function latestScores(attempts: ScorableAttempt[]): Map<number, number> {
  const sorted = [...attempts].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const out = new Map<number, number>();
  for (const a of sorted) {
    if (out.has(a.question_id)) continue;
    const s = attemptScore(a);
    if (s !== null) out.set(a.question_id, s);
  }
  return out;
}

export interface Readiness {
  /** 0–100, or null while still in placement (fewer than 5 scored questions). */
  percent: number | null;
  scoredQuestions: number;
}

export function readiness(latest: Map<number, number>): Readiness {
  const scores = [...latest.values()];
  if (scores.length < PLACEMENT_QUESTIONS) return { percent: null, scoredQuestions: scores.length };
  const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
  return { percent: Math.round(avg * 100), scoredQuestions: scores.length };
}

/** YYYY-MM-DD in Taiwan time (UTC+8, no DST), so "today" flips at local midnight. */
export function taiwanDate(at: string | number | Date = Date.now()): string {
  return new Date(new Date(at).getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}
