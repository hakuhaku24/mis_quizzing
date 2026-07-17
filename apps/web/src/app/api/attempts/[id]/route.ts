import { NextRequest, NextResponse } from "next/server";
import { getWriteDb } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { self_assessment, error_type } = await req.json();

  if (self_assessment != null && !["correct", "partial", "wrong"].includes(self_assessment)) {
    return NextResponse.json({ error: "invalid self_assessment" }, { status: 400 });
  }
  if (error_type != null && !["concept", "memory", "careless", "unseen"].includes(error_type)) {
    return NextResponse.json({ error: "invalid error_type" }, { status: 400 });
  }
  if (self_assessment == null && error_type == null) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const db = getWriteDb();

  if (error_type != null) {
    db.prepare("UPDATE user_attempts SET error_type = ? WHERE id = ?").run(error_type, id);
  }
  if (self_assessment == null) {
    db.close();
    return NextResponse.json({ ok: true });
  }

  db.prepare("UPDATE user_attempts SET self_assessment = ? WHERE id = ?").run(self_assessment, id);

  // Update question state based on self-assessment
  const attempt = db.prepare("SELECT question_id FROM user_attempts WHERE id = ?").get(id) as
    | { question_id: number }
    | undefined;

  if (attempt) {
    const qid = attempt.question_id;
    if (self_assessment === "correct") {
      db.prepare(`
        INSERT INTO user_question_states (question_id, status, last_attempt_at, correct_count, mastery_score)
        VALUES (?, 'reviewing', datetime('now'), 1, 1.0)
        ON CONFLICT(question_id) DO UPDATE SET
          status = 'reviewing',
          correct_count = correct_count + 1,
          mastery_score = CAST(correct_count + 1 AS REAL) / (correct_count + wrong_count + 1),
          updated_at = datetime('now')
      `).run(qid);
    } else if (self_assessment === "wrong") {
      db.prepare(`
        INSERT INTO user_question_states (question_id, status, last_attempt_at, wrong_count)
        VALUES (?, 'wrong', datetime('now'), 1)
        ON CONFLICT(question_id) DO UPDATE SET
          status = 'wrong',
          wrong_count = wrong_count + 1,
          mastery_score = CAST(correct_count AS REAL) / (correct_count + wrong_count + 1),
          updated_at = datetime('now')
      `).run(qid);
    } else {
      db.prepare(`
        INSERT INTO user_question_states (question_id, status, last_attempt_at)
        VALUES (?, 'learning', datetime('now'))
        ON CONFLICT(question_id) DO UPDATE SET
          status = 'learning',
          updated_at = datetime('now')
      `).run(qid);
    }
  }

  db.close();
  return NextResponse.json({ ok: true });
}
