import { supabase } from "./supabase";
import type { Analytics, TopicStat } from "./types";

export async function getAnalytics(): Promise<Analytics> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { totalAttempts: 0, aiGraded: 0, avgAiScore: null, topicStats: [], recentAttempts: [] };

  const { data: attempts } = await supabase
    .from("user_attempts")
    .select("question_id, is_correct, ai_score, self_assessment, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const { data: questions } = await supabase.from("questions").select("id, topic");
  const topicById = new Map((questions ?? []).map((q) => [q.id, q.topic]));

  const rows = attempts ?? [];
  const totalAttempts = rows.length;
  const aiScored = rows.filter((a) => a.ai_score !== null);
  const avgAiScore = aiScored.length
    ? aiScored.reduce((s, a) => s + (a.ai_score ?? 0), 0) / aiScored.length
    : null;

  const byTopic = new Map<string, { total: number; qualities: number[]; aiScores: number[] }>();
  for (const a of rows) {
    const topic = topicById.get(a.question_id) ?? "其他";
    const entry = byTopic.get(topic) ?? { total: 0, qualities: [], aiScores: [] };
    entry.total += 1;
    const quality =
      a.is_correct !== null ? (a.is_correct ? 1 : 0)
      : a.ai_score !== null ? a.ai_score / 10
      : a.self_assessment === "correct" ? 1
      : a.self_assessment === "partial" ? 0.5
      : a.self_assessment === "wrong" ? 0
      : null;
    if (quality !== null) entry.qualities.push(quality);
    if (a.ai_score !== null) entry.aiScores.push(a.ai_score);
    byTopic.set(topic, entry);
  }

  const topicStats: TopicStat[] = [...byTopic.entries()].map(([topic, v]) => ({
    topic,
    total: v.total,
    mastery: v.qualities.length ? v.qualities.reduce((s, x) => s + x, 0) / v.qualities.length : null,
    avg_ai_score: v.aiScores.length ? v.aiScores.reduce((s, x) => s + x, 0) / v.aiScores.length : null,
    ai_graded: v.aiScores.length,
  }));

  return {
    totalAttempts,
    aiGraded: aiScored.length,
    avgAiScore,
    topicStats,
    recentAttempts: rows.slice(0, 20).map((a) => ({ ai_score: a.ai_score, created_at: a.created_at })),
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
  created_at: string;
}

export async function getHistory(topicFilter?: string): Promise<HistoryRow[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  let query = supabase
    .from("user_attempts")
    .select("id, question_id, is_correct, ai_score, self_assessment, created_at, questions(question_text, topic)")
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
    created_at: r.created_at,
  }));
  return topicFilter ? rows.filter((r) => r.topic === topicFilter) : rows;
}
