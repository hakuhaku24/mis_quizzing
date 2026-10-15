import { supabase } from "./supabase";
import { fetchAll } from "./fetchAll";
import { attemptScore, latestScores, readiness } from "./scoring";
import type { Analytics, BlindSpot, TopicStat } from "./types";

const BLIND_SPOT_LIMIT = 5;
/** Below this an answer counts as wrong — the same cut-off srs.ts uses. */
const WRONG_BELOW = 0.4;

export async function getAnalytics(): Promise<Analytics> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) {
    return {
      totalAttempts: 0, aiGraded: 0, avgAiScore: null, topicStats: [], recentAttempts: [],
      readiness: readiness(new Map()), readinessAverage: null, blindSpots: [], blindSpotTotal: 0,
    };
  }

  type AttemptRow = {
    id: number; question_id: number; is_correct: boolean | null; ai_score: number | null;
    self_assessment: string | null; confidence: string | null; created_at: string;
    questions: { topic: string | null } | null;
  };
  const [rows, { data: average }] = await Promise.all([
    // topic comes along via the join, so the whole question bank is never fetched
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
  };
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
