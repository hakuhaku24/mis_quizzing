import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";


export async function GET() {
  try {
  const db = getDb();

  const totalAttempts = (db.prepare("SELECT COUNT(*) as cnt FROM user_attempts").get() as { cnt: number }).cnt;

  const topicStats = db.prepare(`
    SELECT
      q.topic,
      COUNT(a.id)                                              AS total,
      SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END)       AS mc_correct,
      SUM(CASE WHEN a.is_correct = 0 THEN 1 ELSE 0 END)       AS mc_wrong,
      SUM(CASE WHEN a.self_assessment = 'correct' THEN 1 ELSE 0 END) AS self_correct,
      SUM(CASE WHEN a.self_assessment = 'partial'  THEN 1 ELSE 0 END) AS self_partial,
      SUM(CASE WHEN a.self_assessment = 'wrong'    THEN 1 ELSE 0 END) AS self_wrong
    FROM user_attempts a
    JOIN questions q ON a.question_id = q.id
    GROUP BY q.topic
    ORDER BY total DESC
  `).all() as {
    topic: string;
    total: number;
    mc_correct: number;
    mc_wrong: number;
    self_correct: number;
    self_partial: number;
    self_wrong: number;
  }[];

  const recentAttempts = db.prepare(`
    SELECT
      a.id, a.answer_text, a.selected_option, a.is_correct,
      a.self_assessment, a.time_spent_seconds, a.created_at,
      q.id AS question_id, q.question_text, q.question_type,
      q.topic, q.subtopic, q.correct_option, q.difficulty
    FROM user_attempts a
    JOIN questions q ON a.question_id = q.id
    ORDER BY a.created_at DESC
    LIMIT 15
  `).all();

  const weakTopics = topicStats
    .filter((t) => t.total >= 3)
    .map((t) => {
      const graded = t.mc_correct + t.mc_wrong + t.self_correct + t.self_partial + t.self_wrong;
      const correct = t.mc_correct + t.self_correct;
      const rate = graded > 0 ? correct / graded : null;
      return { ...t, correct_rate: rate };
    })
    .filter((t) => t.correct_rate !== null)
    .sort((a, b) => (a.correct_rate ?? 1) - (b.correct_rate ?? 1));

  return NextResponse.json({ totalAttempts, topicStats, recentAttempts, weakTopics });
  } catch (err) {
    console.error("/api/analytics error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
