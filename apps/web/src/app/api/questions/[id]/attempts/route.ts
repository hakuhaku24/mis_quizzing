import { NextRequest, NextResponse } from "next/server";
import { getWriteDb } from "@/lib/db";
import { applySrs, claimSrsSlot } from "@/lib/srs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { answer_text, selected_option, is_correct, time_spent_seconds, confidence } = body;

  if (confidence != null && !["low", "medium", "high"].includes(confidence)) {
    return NextResponse.json({ error: "invalid confidence" }, { status: 400 });
  }

  const db = getWriteDb();

  const result = db
    .prepare(
      `INSERT INTO user_attempts
         (question_id, answer_text, selected_option, is_correct, time_spent_seconds, confidence)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(id, answer_text ?? null, selected_option ?? null, is_correct ?? null, time_spent_seconds ?? null, confidence ?? null);

  const attemptId = result.lastInsertRowid;

  // Derive status and update counts based on is_correct
  if (is_correct === 1) {
    db.prepare(`
      INSERT INTO user_question_states (question_id, status, last_attempt_at, correct_count, mastery_score)
      VALUES (?, 'reviewing', datetime('now'), 1, 1.0)
      ON CONFLICT(question_id) DO UPDATE SET
        status = 'reviewing',
        last_attempt_at = datetime('now'),
        correct_count = correct_count + 1,
        mastery_score = CAST(correct_count + 1 AS REAL) / (correct_count + wrong_count + 1),
        updated_at = datetime('now')
    `).run(id);
  } else if (is_correct === 0) {
    db.prepare(`
      INSERT INTO user_question_states (question_id, status, last_attempt_at, wrong_count)
      VALUES (?, 'wrong', datetime('now'), 1)
      ON CONFLICT(question_id) DO UPDATE SET
        status = 'wrong',
        last_attempt_at = datetime('now'),
        wrong_count = wrong_count + 1,
        mastery_score = CAST(correct_count AS REAL) / (correct_count + wrong_count + 1),
        updated_at = datetime('now')
    `).run(id);
  } else {
    db.prepare(`
      INSERT INTO user_question_states (question_id, status, last_attempt_at)
      VALUES (?, 'learning', datetime('now'))
      ON CONFLICT(question_id) DO UPDATE SET
        status = CASE WHEN status = 'new' THEN 'learning' ELSE status END,
        last_attempt_at = datetime('now'),
        updated_at = datetime('now')
    `).run(id);
  }

  // MC correctness is known immediately — feed the scheduler now. Essay/short-answer
  // attempts stay unscored here and get picked up by AI grading or self-assessment.
  if (is_correct === 1 || is_correct === 0) {
    if (claimSrsSlot(db, attemptId)) applySrs(db, Number(id), is_correct);
  }

  db.close();

  return NextResponse.json({ id: attemptId }, { status: 201 });
}
