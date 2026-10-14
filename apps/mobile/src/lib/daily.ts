import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { GRADUATE_AT, PLACEMENT_QUESTIONS, latestScores, taiwanDate, type ScorableAttempt } from "./scoring";
import type { DailyItem, Question, Slot } from "./types";

/**
 * Daily task selection, done client-side. Two phases:
 *  - placement: fewer than PLACEMENT_QUESTIONS scored questions → serve
 *    multiple-choice questions round-robin across subjects, stable per user;
 *  - normal: review (due, not yet answered right) → weak concepts → unseen.
 *    Computed once per Taiwan day and cached, so finishing a question marks
 *    it done instead of swapping a new one in.
 */
const DAILY_TOPICS = ["CS", "DS"];
const PLACEMENT_TOPICS = ["CS", "DS", "MIS"];
const SLOTS = { review: 2, weak: 6, unseen: 2 };
const TOTAL = SLOTS.review + SLOTS.weak + SLOTS.unseen;
const DAY_MS = 86_400_000;
const QUESTION_COLUMNS = "id, question_text, question_type, topic, subtopic, concepts, difficulty, correct_option";

interface CachedDaily {
  date: string;
  items: { id: number; slot: Slot }[];
}

const cacheKey = (userId: string) => `daily:${userId}`;

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973;
  return h;
}

export async function getDailyTasks(): Promise<DailyItem[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  const today = taiwanDate();
  const { data: attemptRows } = await supabase
    .from("user_attempts")
    .select("id, question_id, is_correct, ai_score, self_assessment, created_at")
    .eq("user_id", userId);
  const attempts = (attemptRows ?? []) as (ScorableAttempt & { id: number })[];
  const latest = latestScores(attempts);

  // question_id -> latest attempt id made today (Taiwan time)
  const attemptedToday = new Map<number, number>();
  for (const a of attempts) {
    if (taiwanDate(a.created_at) !== today) continue;
    const prev = attemptedToday.get(a.question_id);
    if (prev === undefined || a.id > prev) attemptedToday.set(a.question_id, a.id);
  }
  const toItem = (q: Question, slot: Slot): DailyItem => ({
    ...q,
    slot,
    done_today: attemptedToday.has(q.id),
    today_attempt_id: attemptedToday.get(q.id) ?? null,
  });

  if (latest.size < PLACEMENT_QUESTIONS) {
    return placementTasks(userId, latest, PLACEMENT_QUESTIONS - latest.size).then((qs) => qs.map((q) => toItem(q, "placement")));
  }

  const { data: questionRows } = await supabase.from("questions").select(QUESTION_COLUMNS).in("topic", DAILY_TOPICS);
  const questions = (questionRows ?? []) as Question[];
  const byId = new Map(questions.map((q) => [q.id, q]));

  let cached: CachedDaily | null = null;
  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId));
    cached = raw ? (JSON.parse(raw) as CachedDaily) : null;
  } catch {
    cached = null;
  }

  let plan = cached?.date === today ? cached.items : null;
  if (!plan) {
    const { data: states } = await supabase
      .from("user_question_states")
      .select("question_id, next_review_at")
      .eq("user_id", userId);
    plan = planDay(questions, attempts, latest, states ?? []);
    try {
      await AsyncStorage.setItem(cacheKey(userId), JSON.stringify({ date: today, items: plan } satisfies CachedDaily));
    } catch {
      // cache is an optimization; without it the list is just recomputed
    }
  }

  return plan.flatMap(({ id, slot }) => {
    const q = byId.get(id);
    return q ? [toItem(q, slot)] : [];
  });
}

async function placementTasks(userId: string, latest: Map<number, number>, needed: number): Promise<Question[]> {
  const { data } = await supabase
    .from("questions")
    .select(QUESTION_COLUMNS)
    .eq("question_type", "multiple_choice")
    .not("correct_option", "is", null)
    .in("topic", PLACEMENT_TOPICS);
  const seed = hashSeed(userId);
  const key = (id: number) => (id * 48271 + seed * 1009) % 9973;
  const pools = PLACEMENT_TOPICS.map((t) =>
    ((data ?? []) as Question[]).filter((q) => q.topic === t && !latest.has(q.id)).sort((a, b) => key(a.id) - key(b.id))
  );
  // round-robin across subjects so the 5 placement questions cover all three
  const out: Question[] = [];
  for (let i = 0; out.length < needed && pools.some((p) => p.length); i++) {
    const q = pools[i % pools.length].shift();
    if (q) out.push(q);
  }
  return out;
}

function planDay(
  questions: Question[],
  attempts: ScorableAttempt[],
  latest: Map<number, number>,
  states: { question_id: number; next_review_at: string | null }[]
): { id: number; slot: Slot }[] {
  const dayNum = Math.floor((Date.now() + 8 * 3_600_000) / DAY_MS);
  const shuffleKey = (id: number) => (id * 48271 + dayNum * 1009) % 9973;
  const graduated = (id: number) => (latest.get(id) ?? -1) >= GRADUATE_AT;
  const attempted = new Set(attempts.map((a) => a.question_id));
  const stateById = new Map(states.map((s) => [s.question_id, s.next_review_at]));
  const used = new Set<number>();
  const now = Date.now();

  const take = (candidates: Question[], n: number): Question[] => {
    const out: Question[] = [];
    for (const q of candidates) {
      if (out.length >= n) break;
      if (!used.has(q.id)) {
        out.push(q);
        used.add(q.id);
      }
    }
    return out;
  };
  const shuffled = (qs: Question[]) => [...qs].sort((a, b) => shuffleKey(a.id) - shuffleKey(b.id));

  // 1) review: due and not yet answered right, most overdue first
  const due = questions
    .filter((q) => {
      const at = stateById.get(q.id);
      return at && new Date(at).getTime() <= now && !graduated(q.id);
    })
    .sort((a, b) => stateById.get(a.id)!.localeCompare(stateById.get(b.id)!));
  let review = take(due, SLOTS.review);
  if (review.length < SLOTS.review) {
    // attempts from before review scheduling existed: low score, never scheduled
    const lastAt = new Map<number, string>();
    for (const a of attempts) if ((lastAt.get(a.question_id) ?? "") < a.created_at) lastAt.set(a.question_id, a.created_at);
    const legacy = questions
      .filter((q) => latest.has(q.id) && !graduated(q.id) && !stateById.has(q.id))
      .sort((a, b) => (lastAt.get(a.id) ?? "").localeCompare(lastAt.get(b.id) ?? ""));
    review = review.concat(take(legacy, SLOTS.review - review.length));
  }

  // 2) weak: concepts whose questions average below the graduation bar
  const conceptScores = new Map<string, number[]>();
  for (const q of questions) {
    const s = latest.get(q.id);
    if (s === undefined) continue;
    for (const c of q.concepts ?? []) conceptScores.set(c, [...(conceptScores.get(c) ?? []), s]);
  }
  const weakConcepts = [...conceptScores.entries()]
    .map(([c, ss]) => ({ c, m: ss.reduce((x, y) => x + y, 0) / ss.length }))
    .filter((x) => x.m < GRADUATE_AT)
    .sort((a, b) => a.m - b.m)
    .slice(0, 8)
    .map((x) => x.c);
  const weak = take(
    shuffled(questions.filter((q) => !graduated(q.id) && q.concepts?.some((c) => weakConcepts.includes(c)))),
    SLOTS.weak
  );

  // 3) unseen, then fill any shortfall with anything not yet answered right
  const unseenPool = shuffled(questions.filter((q) => !attempted.has(q.id)));
  let unseen = take(unseenPool, SLOTS.unseen);
  const shortfall = TOTAL - (review.length + weak.length + unseen.length);
  if (shortfall > 0) unseen = unseen.concat(take(unseenPool, shortfall));
  const rest = TOTAL - (review.length + weak.length + unseen.length);
  const extra = rest > 0 ? take(shuffled(questions.filter((q) => !graduated(q.id))), rest) : [];

  return [
    ...review.map((q) => ({ id: q.id, slot: "review" as Slot })),
    ...weak.map((q) => ({ id: q.id, slot: "weak" as Slot })),
    ...unseen.map((q) => ({ id: q.id, slot: "unseen" as Slot })),
    ...extra.map((q) => ({ id: q.id, slot: "extra" as Slot })),
  ];
}
