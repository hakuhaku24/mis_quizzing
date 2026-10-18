import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { fetchAll } from "./fetchAll";
import { GRADUATE_AT, latestScores, taiwanDate, type ScorableAttempt } from "./scoring";
import { loadExcludedSources, sourceAllowed } from "./sources";
import type { DailyItem, Question, Slot } from "./types";

/**
 * Daily task selection, done client-side: review (due, not yet answered
 * right) → weak concepts → unseen. Computed once per Taiwan day and cached,
 * so finishing a question marks it done instead of swapping a new one in.
 * New users are not pushed into a placement set; readiness appears once any
 * 5 questions are scored (see scoring.ts). Sources turned off in 我的 ›
 * 首頁的題目來源 are never handed out, but every answer still counts when
 * finding weak concepts.
 */
const DAILY_TOPICS = ["CS", "DS"];
type Quota = { review: number; weak: number; unseen: number };
const SLOTS: Quota = { review: 2, weak: 6, unseen: 2 };
const SLOT_ORDER: Slot[] = ["review", "weak", "unseen", "extra"];
const DAY_MS = 86_400_000;
const QUESTION_COLUMNS = "id, question_text, question_type, topic, subtopic, concepts, difficulty, correct_option, school, exam_year";

type PlanItem = { id: number; slot: Slot };
type StateRow = { question_id: number; next_review_at: string | null };

interface CachedDaily {
  date: string;
  items: PlanItem[];
  /** sources turned off when the plan was made, sorted and comma-joined */
  off?: string;
}

const cacheKey = (userId: string) => `daily:${userId}`;

export async function getDailyTasks(): Promise<DailyItem[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  const today = taiwanDate();
  const attempts = await fetchAll<ScorableAttempt & { id: number }>((from, to) =>
    supabase
      .from("user_attempts")
      .select("id, question_id, is_correct, ai_score, self_assessment, created_at")
      .eq("user_id", userId)
      .order("id")
      .range(from, to)
      .returns<(ScorableAttempt & { id: number })[]>()
  );
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

  const questions = await fetchAll<Question>((from, to) =>
    supabase.from("questions").select(QUESTION_COLUMNS).in("topic", DAILY_TOPICS).order("id").range(from, to).returns<Question[]>()
  );
  const byId = new Map(questions.map((q) => [q.id, q]));

  const excluded = await loadExcludedSources(userId);
  const off = [...excluded].sort().join(",");
  const allowed = (q: Question) => sourceAllowed(excluded, q.school);

  let cached: CachedDaily | null = null;
  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId));
    cached = raw ? (JSON.parse(raw) as CachedDaily) : null;
  } catch {
    cached = null;
  }

  let plan = cached?.date === today ? cached.items : null;
  if (plan && (cached?.off ?? "") !== off) {
    // the sources changed today: swap out what is now turned off and not done
    // yet, into the same slots where possible; done questions keep their ✓
    const kept = plan.filter(({ id }) => {
      const q = byId.get(id);
      return attemptedToday.has(id) || (q !== undefined && allowed(q));
    });
    const dropped = plan.filter((item) => !kept.includes(item));
    if (dropped.length > 0) {
      const quota: Quota = { review: 0, weak: 0, unseen: 0 };
      for (const { slot } of dropped) quota[slot === "extra" ? "unseen" : slot] += 1;
      const fill = planDay(questions, attempts, latest, await fetchStates(userId), allowed, quota, new Set(kept.map(({ id }) => id)));
      const merged = [...kept, ...fill];
      plan = SLOT_ORDER.flatMap((slot) => merged.filter((item) => item.slot === slot));
    }
    await saveCache(userId, { date: today, items: plan, off });
  }
  if (!plan) {
    plan = planDay(questions, attempts, latest, await fetchStates(userId), allowed, SLOTS);
    await saveCache(userId, { date: today, items: plan, off });
  }

  return plan.flatMap(({ id, slot }) => {
    const q = byId.get(id);
    return q ? [toItem(q, slot)] : [];
  });
}

function fetchStates(userId: string): Promise<StateRow[]> {
  return fetchAll<StateRow>((from, to) =>
    supabase
      .from("user_question_states")
      .select("question_id, next_review_at")
      .eq("user_id", userId)
      .order("id")
      .range(from, to)
      .returns<StateRow[]>()
  );
}

async function saveCache(userId: string, cache: CachedDaily): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey(userId), JSON.stringify(cache));
  } catch {
    // cache is an optimization; without it the list is just recomputed
  }
}

/** Picks `quota` questions (review → weak → unseen, shortfalls filled from
 *  what is left) among those `allowed`, never one already in `reserved`. */
function planDay(
  questions: Question[],
  attempts: ScorableAttempt[],
  latest: Map<number, number>,
  states: StateRow[],
  allowed: (q: Question) => boolean,
  quota: Quota,
  reserved: Set<number> = new Set()
): PlanItem[] {
  const total = quota.review + quota.weak + quota.unseen;
  const dayNum = Math.floor((Date.now() + 8 * 3_600_000) / DAY_MS);
  const shuffleKey = (id: number) => (id * 48271 + dayNum * 1009) % 9973;
  const graduated = (id: number) => (latest.get(id) ?? -1) >= GRADUATE_AT;
  const attempted = new Set(attempts.map((a) => a.question_id));
  const stateById = new Map(states.map((s) => [s.question_id, s.next_review_at]));
  const used = new Set<number>(reserved);
  const now = Date.now();
  // only these may be handed out; weak concepts below still look at every answer
  const pool = questions.filter(allowed);

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
  const due = pool
    .filter((q) => {
      const at = stateById.get(q.id);
      return at && new Date(at).getTime() <= now && !graduated(q.id);
    })
    .sort((a, b) => stateById.get(a.id)!.localeCompare(stateById.get(b.id)!));
  let review = take(due, quota.review);
  if (review.length < quota.review) {
    // attempts from before review scheduling existed: low score, never scheduled
    const lastAt = new Map<number, string>();
    for (const a of attempts) if ((lastAt.get(a.question_id) ?? "") < a.created_at) lastAt.set(a.question_id, a.created_at);
    const legacy = pool
      .filter((q) => latest.has(q.id) && !graduated(q.id) && !stateById.has(q.id))
      .sort((a, b) => (lastAt.get(a.id) ?? "").localeCompare(lastAt.get(b.id) ?? ""));
    review = review.concat(take(legacy, quota.review - review.length));
  }

  // 2) weak: concepts whose questions average below the graduation bar, over every answer
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
    shuffled(pool.filter((q) => !graduated(q.id) && q.concepts?.some((c) => weakConcepts.includes(c)))),
    quota.weak
  );

  // 3) unseen, then fill any shortfall with anything not yet answered right
  const unseenPool = shuffled(pool.filter((q) => !attempted.has(q.id)));
  let unseen = take(unseenPool, quota.unseen);
  const shortfall = total - (review.length + weak.length + unseen.length);
  if (shortfall > 0) unseen = unseen.concat(take(unseenPool, shortfall));
  const rest = total - (review.length + weak.length + unseen.length);
  const extra = rest > 0 ? take(shuffled(pool.filter((q) => !graduated(q.id))), rest) : [];

  return [
    ...review.map((q) => ({ id: q.id, slot: "review" as Slot })),
    ...weak.map((q) => ({ id: q.id, slot: "weak" as Slot })),
    ...unseen.map((q) => ({ id: q.id, slot: "unseen" as Slot })),
    ...extra.map((q) => ({ id: q.id, slot: "extra" as Slot })),
  ];
}
