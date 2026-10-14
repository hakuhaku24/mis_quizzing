import { supabase } from "./supabase";
import { GRADUATE_AT, latestScores } from "./scoring";

const DAY_MS = 86_400_000;

/**
 * "答對就畢業，答錯才進複習": a question's review state is derived from its
 * most recent scored attempt — score >= GRADUATE_AT clears the schedule,
 * otherwise it comes back (wrong: 1 day, partial: 3 days). Recomputed from
 * the attempts table each time, so it's safe to call after any change
 * (MC submit, AI grade, self-assessment, editing an older attempt).
 */
export async function syncReview(questionId: number): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;

  const { data: attempts } = await supabase
    .from("user_attempts")
    .select("question_id, is_correct, ai_score, self_assessment, created_at")
    .eq("user_id", userId)
    .eq("question_id", questionId);

  const score = latestScores(attempts ?? []).get(questionId);
  if (score === undefined) return;

  const nextReviewAt =
    score >= GRADUATE_AT ? null : new Date(Date.now() + (score < 0.4 ? 1 : 3) * DAY_MS).toISOString();

  await supabase.from("user_question_states").upsert(
    {
      user_id: userId,
      question_id: questionId,
      next_review_at: nextReviewAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,question_id" }
  );
}
