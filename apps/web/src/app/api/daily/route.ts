import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * Today's practice set: 10 questions, deterministic for a given date.
 *  - 6 from weakest concepts (attempted, mastery < 0.7)
 *  - 2 review (previously answered badly, least recently attempted first)
 *  - 2 unseen (never attempted)
 * Shortfalls in any slot are filled from unseen, then from anything left.
 *
 * Scope: CS + DS only — the user's target exam combo (科技組: 計概+資結).
 */
const DAILY_TOPICS = ["CS", "DS"];
const SLOTS = { weak: 6, review: 2, unseen: 2 };
const TOTAL = SLOTS.weak + SLOTS.review + SLOTS.unseen;

const MASTERY_CASE = `
  CASE
    WHEN a.is_correct IS NOT NULL THEN CAST(a.is_correct AS REAL)
    WHEN a.ai_score IS NOT NULL THEN a.ai_score / 10.0
    WHEN a.self_assessment = 'correct' THEN 1.0
    WHEN a.self_assessment = 'partial' THEN 0.5
    WHEN a.self_assessment = 'wrong' THEN 0.0
    ELSE NULL
  END`;

export async function GET() {
  try {
    const db = getDb();
    const topicsIn = DAILY_TOPICS.map(() => "?").join(",");

    // Day number for deterministic daily shuffle
    const dayNum = Math.floor(Date.now() / 86_400_000);

    const weakConcepts = (db.prepare(`
      SELECT j.value AS concept, AVG(${MASTERY_CASE}) AS mastery
      FROM user_attempts a
      JOIN questions q ON q.id = a.question_id, json_each(q.concepts) j
      WHERE q.topic IN (${topicsIn})
      GROUP BY j.value
      HAVING mastery IS NOT NULL AND mastery < 0.7
      ORDER BY mastery ASC
      LIMIT 8
    `).all(...DAILY_TOPICS) as { concept: string; mastery: number }[]).map((r) => r.concept);

    const attemptedToday = new Set(
      (db.prepare(
        "SELECT DISTINCT question_id FROM user_attempts WHERE date(created_at) = date('now')"
      ).all() as { question_id: number }[]).map((r) => r.question_id)
    );

    const pick = (sql: string, params: unknown[], n: number, exclude: Set<number>) => {
      const rows = db.prepare(sql).all(...params) as { id: number }[];
      const out: number[] = [];
      for (const r of rows) {
        if (out.length >= n) break;
        if (!exclude.has(r.id)) { out.push(r.id); exclude.add(r.id); }
      }
      return out;
    };

    const used = new Set<number>();
    const shuffle = `(q.id * 48271 + ${dayNum} * 1009) % 9973`;

    // 1) weak-concept questions (not attempted today)
    let weak: number[] = [];
    if (weakConcepts.length) {
      const cIn = weakConcepts.map(() => "?").join(",");
      weak = pick(`
        SELECT q.id FROM questions q
        WHERE q.topic IN (${topicsIn})
          AND EXISTS (SELECT 1 FROM json_each(q.concepts) j WHERE j.value IN (${cIn}))
        ORDER BY ${shuffle}
      `, [...DAILY_TOPICS, ...weakConcepts], SLOTS.weak, used);
    }

    // 2) review: due per the spaced-repetition schedule (most overdue first).
    // Falls back to "answered badly before" for questions attempted before this
    // scheduler existed (no next_review_at yet).
    let review = pick(`
      SELECT q.id FROM questions q
      JOIN user_question_states s ON s.question_id = q.id
      WHERE q.topic IN (${topicsIn}) AND s.next_review_at IS NOT NULL
        AND s.next_review_at <= datetime('now')
      ORDER BY s.next_review_at ASC
    `, DAILY_TOPICS, SLOTS.review, used);

    if (review.length < SLOTS.review) {
      const fallback = pick(`
        SELECT q.id FROM questions q
        JOIN (
          SELECT a.question_id, MAX(a.created_at) AS last_at, AVG(${MASTERY_CASE}) AS m
          FROM user_attempts a GROUP BY a.question_id
        ) s ON s.question_id = q.id
        LEFT JOIN user_question_states st ON st.question_id = q.id
        WHERE q.topic IN (${topicsIn}) AND s.m IS NOT NULL AND s.m < 0.7
          AND st.next_review_at IS NULL
        ORDER BY s.last_at ASC
      `, DAILY_TOPICS, SLOTS.review - review.length, used);
      review = review.concat(fallback);
    }

    // 3) unseen
    const pickUnseen = (n: number) => pick(`
      SELECT q.id FROM questions q
      WHERE q.topic IN (${topicsIn})
        AND q.id NOT IN (SELECT DISTINCT question_id FROM user_attempts)
      ORDER BY ${shuffle}
    `, DAILY_TOPICS, n, used);

    let unseen = pickUnseen(SLOTS.unseen);

    // fill shortfall from unseen, then from any CS/DS question
    let shortfall = TOTAL - (weak.length + review.length + unseen.length);
    if (shortfall > 0) unseen = unseen.concat(pickUnseen(shortfall));
    shortfall = TOTAL - (weak.length + review.length + unseen.length);
    let filler: number[] = [];
    if (shortfall > 0) {
      filler = pick(
        `SELECT q.id FROM questions q WHERE q.topic IN (${topicsIn}) ORDER BY ${shuffle}`,
        DAILY_TOPICS, shortfall, used
      );
    }

    const slotOf = (id: number) =>
      weak.includes(id) ? "weak" : review.includes(id) ? "review" : unseen.includes(id) ? "unseen" : "extra";

    const ids = [...weak, ...review, ...unseen, ...filler];
    let items: unknown[] = [];
    if (ids.length) {
      const qIn = ids.map(() => "?").join(",");
      const rows = db.prepare(`
        SELECT id, question_text, question_type, topic, subtopic, concepts, difficulty
        FROM questions WHERE id IN (${qIn})
      `).all(...ids) as { id: number }[];
      const byId = new Map(rows.map((r) => [r.id, r]));
      items = ids.filter((id) => byId.has(id)).map((id) => ({
        ...byId.get(id),
        slot: slotOf(id),
        done_today: attemptedToday.has(id),
      }));
    }

    return NextResponse.json({ date: new Date().toISOString().slice(0, 10), items, weakConcepts });
  } catch (err) {
    console.error("/api/daily error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
