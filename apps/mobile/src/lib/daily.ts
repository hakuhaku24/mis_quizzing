import { supabase } from "./supabase";
import type { DailyItem, Slot } from "./types";

/**
 * Port of apps/web/src/app/api/daily/route.ts's selection logic — done
 * client-side here because the original leans on SQLite-specific SQL
 * (json_each, a modulo-based shuffle expression) that's awkward to keep
 * byte-for-byte in PostgREST. Same algorithm, same slot quotas.
 */
const DAILY_TOPICS = ["CS", "DS"];
const SLOTS = { weak: 6, review: 2, unseen: 2 };
const TOTAL = SLOTS.weak + SLOTS.review + SLOTS.unseen;

function attemptQuality(a: {
  is_correct: boolean | null;
  ai_score: number | null;
  self_assessment: string | null;
}): number | null {
  if (a.is_correct !== null) return a.is_correct ? 1 : 0;
  if (a.ai_score !== null) return a.ai_score / 10;
  if (a.self_assessment === "correct") return 1;
  if (a.self_assessment === "partial") return 0.5;
  if (a.self_assessment === "wrong") return 0;
  return null;
}

export async function getDailyTasks(): Promise<DailyItem[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  const dayNum = Math.floor(Date.now() / 86_400_000);
  const todayStart = new Date().toISOString().slice(0, 10);

  const [{ data: questions }, { data: attempts }, { data: states }] = await Promise.all([
    supabase
      .from("questions")
      .select("id, question_text, question_type, topic, subtopic, concepts, difficulty")
      .in("topic", DAILY_TOPICS),
    supabase
      .from("user_attempts")
      .select("question_id, is_correct, ai_score, self_assessment, created_at")
      .eq("user_id", userId),
    supabase
      .from("user_question_states")
      .select("question_id, next_review_at")
      .eq("user_id", userId)
      .not("next_review_at", "is", null),
  ]);

  if (!questions) return [];

  const attemptsByQ = new Map<number, typeof attempts>();
  for (const a of attempts ?? []) {
    const list = attemptsByQ.get(a.question_id) ?? [];
    list.push(a);
    attemptsByQ.set(a.question_id, list);
  }

  const attemptedToday = new Set(
    (attempts ?? []).filter((a) => a.created_at.slice(0, 10) === todayStart).map((a) => a.question_id)
  );

  // weakest concepts across attempted CS/DS questions, mastery < 0.7
  const conceptScores = new Map<string, number[]>();
  for (const q of questions) {
    const qAttempts = attemptsByQ.get(q.id) ?? [];
    const qualities = qAttempts.map(attemptQuality).filter((v): v is number => v !== null);
    if (!qualities.length || !q.concepts) continue;
    const avg = qualities.reduce((s, v) => s + v, 0) / qualities.length;
    for (const concept of q.concepts as string[]) {
      const list = conceptScores.get(concept) ?? [];
      list.push(avg);
      conceptScores.set(concept, list);
    }
  }
  const weakConcepts = [...conceptScores.entries()]
    .map(([concept, scores]) => ({ concept, mastery: scores.reduce((s, v) => s + v, 0) / scores.length }))
    .filter((c) => c.mastery < 0.7)
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, 8)
    .map((c) => c.concept);

  const dueQuestionIds = new Set((states ?? []).filter((s) => new Date(s.next_review_at!) <= new Date()).map((s) => s.question_id));

  const used = new Set<number>();
  const shuffleKey = (id: number) => (id * 48271 + dayNum * 1009) % 9973;

  const pick = (candidates: typeof questions, n: number): typeof questions => {
    const sorted = [...candidates].sort((a, b) => shuffleKey(a.id) - shuffleKey(b.id));
    const out: typeof questions = [];
    for (const q of sorted) {
      if (out.length >= n) break;
      if (!used.has(q.id)) {
        out.push(q);
        used.add(q.id);
      }
    }
    return out;
  };

  // 1) weak-concept questions
  const weakCandidates = questions.filter((q) => q.concepts?.some((c: string) => weakConcepts.includes(c)));
  const weak = weakConcepts.length ? pick(weakCandidates, SLOTS.weak) : [];

  // 2) due-for-review (sorted most-overdue first), falling back to
  // "answered badly, no schedule yet" for pre-SRS attempts
  const reviewDue = questions
    .filter((q) => dueQuestionIds.has(q.id) && !used.has(q.id))
    .sort((a, b) => {
      const sa = (states ?? []).find((s) => s.question_id === a.id)?.next_review_at ?? "";
      const sb = (states ?? []).find((s) => s.question_id === b.id)?.next_review_at ?? "";
      return sa.localeCompare(sb);
    });
  let review = reviewDue.slice(0, SLOTS.review);
  review.forEach((q) => used.add(q.id));

  if (review.length < SLOTS.review) {
    const fallback = questions
      .filter((q) => {
        if (used.has(q.id) || dueQuestionIds.has(q.id)) return false;
        const qAttempts = attemptsByQ.get(q.id) ?? [];
        if (!qAttempts.length) return false;
        const qualities = qAttempts.map(attemptQuality).filter((v): v is number => v !== null);
        if (!qualities.length) return false;
        return qualities.reduce((s, v) => s + v, 0) / qualities.length < 0.7;
      })
      .sort((a, b) => {
        const la = Math.max(...(attemptsByQ.get(a.id) ?? []).map((x) => new Date(x.created_at).getTime()));
        const lb = Math.max(...(attemptsByQ.get(b.id) ?? []).map((x) => new Date(x.created_at).getTime()));
        return la - lb;
      })
      .slice(0, SLOTS.review - review.length);
    fallback.forEach((q) => used.add(q.id));
    review = review.concat(fallback);
  }

  // 3) unseen
  const unseenCandidates = questions.filter((q) => !attemptsByQ.has(q.id));
  let unseen = pick(unseenCandidates, SLOTS.unseen);

  let shortfall = TOTAL - (weak.length + review.length + unseen.length);
  if (shortfall > 0) unseen = unseen.concat(pick(unseenCandidates, shortfall));
  shortfall = TOTAL - (weak.length + review.length + unseen.length);
  const filler = shortfall > 0 ? pick(questions, shortfall) : [];

  const slotOf = (id: number): Slot =>
    weak.some((q) => q.id === id) ? "weak" : review.some((q) => q.id === id) ? "review" : unseen.some((q) => q.id === id) ? "unseen" : "extra";

  const ordered = [...weak, ...review, ...unseen, ...filler];
  return ordered.map((q) => ({
    ...(q as DailyItem),
    slot: slotOf(q.id),
    done_today: attemptedToday.has(q.id),
  }));
}
