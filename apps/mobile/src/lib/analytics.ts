import { supabase } from "./supabase";
import { fetchAll } from "./fetchAll";
import { compareSubjects } from "./labels";
import { attemptScore, GRADUATE_AT, latestScores, readiness, type ScorableAttempt } from "./scoring";
import type { Analytics, BlindSpot, SubjectMap, TopicStat, UnitStat } from "./types";

const BLIND_SPOT_LIMIT = 5;
/** Below this an answer counts as wrong — the same cut-off srs.ts uses. */
const WRONG_BELOW = 0.4;
/** Units with fewer bank questions don't get their own tile on the 知識地圖. */
const MIN_UNIT_QUESTIONS = 3;
/** One wrong answer isn't enough to call a unit the one to fix first. */
const FOCUS_MIN_ANSWERED = 2;
const PENDING_LIMIT = 3;

type BankRow = { id: number; topic: string | null; subtopic: string | null };
type LatestAttempt = ScorableAttempt & { id: number };

/**
 * 知識地圖: every unit of every subject, built from the bank itself so any
 * department's subjects work unchanged. Mastery is the mean latest score of
 * the unit's answered questions; the focus unit is the one where improving
 * pays most — weak mastery weighted by how many questions the unit has.
 */
function buildKnowledgeMap(bank: BankRow[], latestAttempt: Map<number, LatestAttempt>): SubjectMap[] {
  const units = new Map<string, UnitStat & { scoreSum: number }>();
  for (const q of bank) {
    if (!q.topic || !q.subtopic) continue;
    const key = `${q.topic}\u0000${q.subtopic}`;
    let u = units.get(key);
    if (!u) {
      u = { topic: q.topic, unit: q.subtopic, questionCount: 0, answered: 0, correct: 0, mastery: null, pending: [], scoreSum: 0 };
      units.set(key, u);
    }
    u.questionCount += 1;
    const a = latestAttempt.get(q.id);
    const score = a ? attemptScore(a) : null;
    if (!a || score === null) continue;
    u.answered += 1;
    u.scoreSum += score;
    if (score >= GRADUATE_AT) u.correct += 1;
    else u.pending.push({ questionId: q.id, attemptId: a.id, outcome: { is_correct: a.is_correct, ai_score: a.ai_score, self_assessment: a.self_assessment } });
  }

  const bySubject = new Map<string, UnitStat[]>();
  for (const { scoreSum, ...u } of units.values()) {
    if (u.questionCount < MIN_UNIT_QUESTIONS) continue;
    u.mastery = u.answered ? scoreSum / u.answered : null;
    u.pending = u.pending.sort((x, y) => y.attemptId - x.attemptId).slice(0, PENDING_LIMIT);
    bySubject.set(u.topic, [...(bySubject.get(u.topic) ?? []), u]);
  }

  return [...bySubject.entries()]
    .sort(([a], [b]) => compareSubjects(a, b))
    .map(([topic, list]) => {
      list.sort((a, b) => b.questionCount - a.questionCount || a.unit.localeCompare(b.unit));
      const weak = list.filter((u) => u.answered >= FOCUS_MIN_ANSWERED && u.mastery !== null && u.mastery < GRADUATE_AT);
      const priority = (u: UnitStat) => (1 - (u.mastery ?? 1)) * u.questionCount;
      const focus = weak.sort((a, b) => priority(b) - priority(a))[0] ?? null;
      return { topic, units: list, focus };
    });
}

export async function getAnalytics(): Promise<Analytics> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) {
    return {
      totalAttempts: 0, aiGraded: 0, avgAiScore: null, topicStats: [], recentAttempts: [],
      readiness: readiness(new Map()), readinessAverage: null, blindSpots: [], blindSpotTotal: 0, knowledgeMap: [],
    };
  }

  type AttemptRow = {
    id: number; question_id: number; is_correct: boolean | null; ai_score: number | null;
    self_assessment: string | null; confidence: string | null; created_at: string;
    questions: { topic: string | null } | null;
  };
  const [rows, bank, { data: average }] = await Promise.all([
    // topic comes along via the join
    fetchAll<AttemptRow>((from, to) =>
      supabase
        .from("user_attempts")
        .select("id, question_id, is_correct, ai_score, self_assessment, confidence, created_at, questions(topic)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to)
        .returns<AttemptRow[]>()
    ),
    // just id/topic/subtopic of every question, for the 知識地圖's units
    fetchAll<BankRow>((from, to) =>
      supabase.from("questions").select("id, topic, subtopic").order("id").range(from, to).returns<BankRow[]>()
    ),
    // null until enough users are placed (see migration 004)
    supabase.rpc("readiness_average"),
  ]);
  const topicById = new Map(rows.map((a) => [a.question_id, a.questions?.topic ?? null]));

  const totalAttempts = rows.length;
  const aiScored = rows.filter((a) => a.ai_score !== null);
  const avgAiScore = aiScored.length
    ? aiScored.reduce((s, a) => s + (a.ai_score ?? 0), 0) / aiScored.length
    : null;

  const latest = latestScores(rows);

  // mastery per subject = mean of each question's latest score (one vote per question)
  const byTopic = new Map<string, { total: number; scores: number[]; aiScores: number[] }>();
  for (const a of rows) {
    const topic = topicById.get(a.question_id) ?? "其他";
    const entry = byTopic.get(topic) ?? { total: 0, scores: [], aiScores: [] };
    entry.total += 1;
    if (a.ai_score !== null) entry.aiScores.push(a.ai_score);
    byTopic.set(topic, entry);
  }
  for (const [questionId, score] of latest) {
    byTopic.get(topicById.get(questionId) ?? "其他")?.scores.push(score);
  }

  const topicStats: TopicStat[] = [...byTopic.entries()].map(([topic, v]) => ({
    topic,
    total: v.total,
    mastery: v.scores.length ? v.scores.reduce((s, x) => s + x, 0) / v.scores.length : null,
    avg_ai_score: v.aiScores.length ? v.aiScores.reduce((s, x) => s + x, 0) / v.aiScores.length : null,
    ai_graded: v.aiScores.length,
  }));

  // 很有把握卻答錯: the latest scored attempt of a question was submitted as
  // "很有把握" yet scored as wrong. Answering it right later replaces the
  // latest attempt, so the question drops off the list by itself.
  const latestAttempt = new Map<number, AttemptRow>();
  for (const a of rows) {
    // rows are newest first
    if (!latestAttempt.has(a.question_id) && attemptScore(a) !== null) latestAttempt.set(a.question_id, a);
  }
  const blindRows = [...latestAttempt.values()].filter(
    (a) => a.confidence === "high" && (attemptScore(a) ?? 1) < WRONG_BELOW
  );
  const shown = blindRows.slice(0, BLIND_SPOT_LIMIT);
  const questionInfo = new Map<number, { question_text: string; subtopic: string | null }>();
  if (shown.length) {
    const { data } = await supabase
      .from("questions")
      .select("id, question_text, subtopic")
      .in("id", shown.map((a) => a.question_id))
      .returns<{ id: number; question_text: string; subtopic: string | null }[]>();
    for (const q of data ?? []) questionInfo.set(q.id, q);
  }
  const blindSpots: BlindSpot[] = shown.map((a) => ({
    questionId: a.question_id,
    attemptId: a.id,
    topic: a.questions?.topic ?? null,
    subtopic: questionInfo.get(a.question_id)?.subtopic ?? null,
    questionText: questionInfo.get(a.question_id)?.question_text ?? "",
    is_correct: a.is_correct,
    ai_score: a.ai_score,
    self_assessment: a.self_assessment,
  }));

  return {
    totalAttempts,
    aiGraded: aiScored.length,
    avgAiScore,
    topicStats,
    recentAttempts: rows.slice(0, 20).map((a) => ({ ai_score: a.ai_score, created_at: a.created_at })),
    readiness: readiness(latest),
    readinessAverage: typeof average === "number" ? average : null,
    blindSpots,
    blindSpotTotal: blindRows.length,
    knowledgeMap: buildKnowledgeMap(bank, latestAttempt),
  };
}

/** Question text for the unit sheet's list, fetched only when it opens. */
export async function getQuestionTexts(ids: number[]): Promise<Map<number, string>> {
  const texts = new Map<number, string>();
  if (!ids.length) return texts;
  const { data } = await supabase
    .from("questions")
    .select("id, question_text")
    .in("id", ids)
    .returns<{ id: number; question_text: string }[]>();
  for (const q of data ?? []) texts.set(q.id, q.question_text);
  return texts;
}

export interface HistoryRow {
  id: number;
  question_id: number;
  question_text: string;
  topic: string | null;
  is_correct: boolean | null;
  ai_score: number | null;
  self_assessment: string | null;
  error_type: string | null;
  created_at: string;
}

export async function getHistory(topicFilter?: string): Promise<HistoryRow[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  let query = supabase
    .from("user_attempts")
    .select("id, question_id, is_correct, ai_score, self_assessment, error_type, created_at, questions(question_text, topic)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  const { data } = await query;
  const rows = (data ?? []).map((r: any) => ({
    id: r.id,
    question_id: r.question_id,
    question_text: r.questions?.question_text ?? "",
    topic: r.questions?.topic ?? null,
    is_correct: r.is_correct,
    ai_score: r.ai_score,
    self_assessment: r.self_assessment,
    error_type: r.error_type,
    created_at: r.created_at,
  }));
  return topicFilter ? rows.filter((r) => r.topic === topicFilter) : rows;
}
