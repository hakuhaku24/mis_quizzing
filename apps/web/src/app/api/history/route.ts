import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = 20;
    const offset = (page - 1) * limit;
    const topic = searchParams.get("topic") ?? "";

    const db = getDb();

    const SELECT = `
      SELECT
        a.id, a.answer_text, a.selected_option, a.is_correct,
        a.self_assessment, a.time_spent_seconds, a.created_at,
        q.id AS question_id, q.question_text, q.question_type,
        q.topic, q.subtopic, q.correct_option, q.difficulty
      FROM user_attempts a
      JOIN questions q ON a.question_id = q.id
    `;

    let total: number;
    let items: unknown[];

    if (topic) {
      total = (db.prepare(
        "SELECT COUNT(*) as cnt FROM user_attempts a JOIN questions q ON a.question_id = q.id WHERE q.topic = ?"
      ).get(topic) as { cnt: number }).cnt;
      items = db.prepare(`${SELECT} WHERE q.topic = ? ORDER BY a.created_at DESC LIMIT ? OFFSET ?`)
        .all(topic, limit, offset);
    } else {
      total = (db.prepare(
        "SELECT COUNT(*) as cnt FROM user_attempts a JOIN questions q ON a.question_id = q.id"
      ).get() as { cnt: number }).cnt;
      items = db.prepare(`${SELECT} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`).all(limit, offset);
    }

    return NextResponse.json({ items, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("/api/history error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
