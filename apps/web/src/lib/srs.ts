import type Database from "better-sqlite3";

/**
 * Lightweight SM-2-style spaced repetition.
 *
 * quality: 0–1 score for a finalized attempt (MC correctness, AI score / 10,
 * or self-assessment mapped to 1 / 0.5 / 0).
 *
 *  - quality < 0.4  (wrong)   → reps reset to 0, interval drops to 1 day, ease penalized
 *  - 0.4–0.75       (partial) → reps held, interval halved (min 1 day), ease nudged down
 *  - quality >= 0.75 (good)   → reps + 1, interval grows by `ease`, ease nudged up
 *
 * This is deliberately simple (no SM-2 grade buckets) — the inputs this app has
 * (correct/partial/wrong) don't carry enough signal to justify the full algorithm.
 */
export function applySrs(db: Database.Database, questionId: number, quality: number): void {
  const row = db
    .prepare(
      `SELECT interval_days, ease, reps FROM user_question_states WHERE question_id = ?`
    )
    .get(questionId) as { interval_days: number; ease: number; reps: number } | undefined;

  const prevInterval = row?.interval_days ?? 0;
  const prevEase = row?.ease ?? 2.5;
  const prevReps = row?.reps ?? 0;

  let interval: number;
  let ease: number;
  let reps: number;

  if (quality < 0.4) {
    reps = 0;
    interval = 1;
    ease = Math.max(1.3, prevEase - 0.2);
  } else if (quality < 0.75) {
    reps = prevReps;
    interval = Math.max(1, Math.round(prevInterval * 0.5));
    ease = Math.max(1.3, prevEase - 0.05);
  } else {
    reps = prevReps + 1;
    ease = Math.min(2.8, prevEase + 0.05);
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 3;
    else interval = Math.round(Math.max(prevInterval, 1) * ease);
  }

  db.prepare(
    `INSERT INTO user_question_states (question_id, next_review_at, interval_days, ease, reps, updated_at)
     VALUES (?, datetime('now', '+' || ? || ' days'), ?, ?, ?, datetime('now'))
     ON CONFLICT(question_id) DO UPDATE SET
       next_review_at = datetime('now', '+' || ? || ' days'),
       interval_days = ?,
       ease = ?,
       reps = ?,
       updated_at = datetime('now')`
  ).run(questionId, interval, interval, ease, reps, interval, interval, ease, reps);
}

/** Marks an attempt as having fed the scheduler, so a later signal (e.g. a
 *  self-assessment arriving after AI grading already scored the attempt)
 *  doesn't double-apply. Returns false if it was already applied. */
export function claimSrsSlot(db: Database.Database, attemptId: number | bigint | string): boolean {
  const row = db
    .prepare("SELECT srs_applied FROM user_attempts WHERE id = ?")
    .get(attemptId) as { srs_applied: number } | undefined;
  if (!row || row.srs_applied) return false;
  db.prepare("UPDATE user_attempts SET srs_applied = 1 WHERE id = ?").run(attemptId);
  return true;
}
