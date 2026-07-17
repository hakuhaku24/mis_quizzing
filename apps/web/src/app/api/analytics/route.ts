import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * Unified mastery score per attempt, in [0,1]:
 *  - MC: is_correct (1/0)
 *  - essay/short answer: AI score /10 when graded, else self-assessment
 *    (correct=1, partial=0.5, wrong=0)
 */
const SCORED_ATTEMPTS = `
  SELECT
    a.id, a.question_id, a.ai_score, a.created_at,
    CASE
      WHEN a.is_correct IS NOT NULL THEN CAST(a.is_correct AS REAL)
      WHEN a.ai_score IS NOT NULL THEN a.ai_score / 10.0
      WHEN a.self_assessment = 'correct' THEN 1.0
      WHEN a.self_assessment = 'partial' THEN 0.5
      WHEN a.self_assessment = 'wrong' THEN 0.0
      ELSE NULL
    END AS mastery
  FROM user_attempts a
`;

export async function GET() {
  try {
    const db = getDb();

    const totalAttempts = (db.prepare("SELECT COUNT(*) as cnt FROM user_attempts").get() as { cnt: number }).cnt;

    const aiSummary = db.prepare(
      "SELECT COUNT(ai_score) AS graded, AVG(ai_score) AS avg_score FROM user_attempts"
    ).get() as { graded: number; avg_score: number | null };

    const topicStats = db.prepare(`
      SELECT
        q.topic,
        COUNT(s.id)                                                    AS total,
        SUM(CASE WHEN q.question_type = 'multiple_choice' AND s.mastery = 1 THEN 1 ELSE 0 END) AS mc_correct,
        SUM(CASE WHEN q.question_type = 'multiple_choice' AND s.mastery = 0 THEN 1 ELSE 0 END) AS mc_wrong,
        COUNT(s.ai_score)                                              AS ai_graded,
        AVG(s.ai_score)                                                AS avg_ai_score,
        AVG(s.mastery)                                                 AS mastery
      FROM (${SCORED_ATTEMPTS}) s
      JOIN questions q ON s.question_id = q.id
      GROUP BY q.topic
      ORDER BY total DESC
    `).all() as {
      topic: string;
      total: number;
      mc_correct: number;
      mc_wrong: number;
      ai_graded: number;
      avg_ai_score: number | null;
      mastery: number | null;
    }[];

    const conceptStats = db.prepare(`
      SELECT
        j.value            AS concept,
        q.topic            AS topic,
        COUNT(s.id)        AS total,
        COUNT(s.ai_score)  AS ai_graded,
        AVG(s.ai_score)    AS avg_ai_score,
        AVG(s.mastery)     AS mastery
      FROM (${SCORED_ATTEMPTS}) s
      JOIN questions q ON s.question_id = q.id,
      json_each(q.concepts) j
      GROUP BY j.value
      HAVING AVG(s.mastery) IS NOT NULL
      ORDER BY mastery ASC, total DESC
    `).all() as {
      concept: string;
      topic: string;
      total: number;
      ai_graded: number;
      avg_ai_score: number | null;
      mastery: number | null;
    }[];

    const recentAttempts = db.prepare(`
      SELECT
        a.id, a.answer_text, a.selected_option, a.is_correct,
        a.self_assessment, a.time_spent_seconds, a.created_at,
        a.confidence, a.error_type, a.ai_score,
        q.id AS question_id, q.question_text, q.question_type,
        q.topic, q.subtopic, q.correct_option, q.difficulty
      FROM user_attempts a
      JOIN questions q ON a.question_id = q.id
      ORDER BY a.created_at DESC
      LIMIT 15
    `).all();

    const weakTopics = topicStats
      .filter((t) => t.total >= 3 && t.mastery !== null)
      .map((t) => ({ ...t, correct_rate: t.mastery }))
      .sort((a, b) => (a.mastery ?? 1) - (b.mastery ?? 1));

    return NextResponse.json({
      totalAttempts,
      aiGraded: aiSummary.graded,
      avgAiScore: aiSummary.avg_score,
      topicStats,
      conceptStats,
      recentAttempts,
      weakTopics,
    });
  } catch (err) {
    console.error("/api/analytics error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
