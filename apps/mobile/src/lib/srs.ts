import { supabase } from "./supabase";

/**
 * Same simplified SM-2 scheduler as apps/web/src/lib/srs.ts, ported to run
 * against Supabase from the client (no secret needed — just the signed-in
 * user's own row, gated by RLS).
 */
export async function applySrs(questionId: number, quality: number): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;

  const { data: existing } = await supabase
    .from("user_question_states")
    .select("interval_days, ease, reps")
    .eq("question_id", questionId)
    .eq("user_id", userId)
    .maybeSingle();

  const prevInterval = existing?.interval_days ?? 0;
  const prevEase = existing?.ease ?? 2.5;
  const prevReps = existing?.reps ?? 0;

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

  const nextReviewAt = new Date(Date.now() + interval * 86_400_000).toISOString();

  await supabase.from("user_question_states").upsert(
    {
      user_id: userId,
      question_id: questionId,
      next_review_at: nextReviewAt,
      interval_days: interval,
      ease,
      reps,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,question_id" }
  );
}

/** Mirrors apps/web/src/lib/srs.ts claimSrsSlot — only the first finalized
 *  signal for an attempt (MC correctness, AI grade, or self-assessment,
 *  whichever lands first) feeds the scheduler. */
export async function claimSrsSlot(attemptId: number): Promise<boolean> {
  const { data } = await supabase
    .from("user_attempts")
    .select("srs_applied")
    .eq("id", attemptId)
    .maybeSingle();
  if (!data || data.srs_applied) return false;
  await supabase.from("user_attempts").update({ srs_applied: true }).eq("id", attemptId);
  return true;
}
