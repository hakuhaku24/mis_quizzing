import { supabase } from "./supabase";
import { applySrs, claimSrsSlot } from "./srs";
import type { AiGrade, Confidence, ErrorType, Question, SelfAssessment, Solution } from "./types";

export async function getQuestion(id: number): Promise<{ question: Question; solution: Solution | null }> {
  const [{ data: question, error }, { data: solutions }] = await Promise.all([
    supabase.from("questions").select("*").eq("id", id).single(),
    supabase.from("solutions").select("*").eq("question_id", id).limit(1),
  ]);
  if (error || !question) throw error ?? new Error("找不到題目");
  return { question: question as Question, solution: (solutions?.[0] as Solution) ?? null };
}

export interface SavedAttempt {
  id: number;
  answer_text: string | null;
  selected_option: string | null;
  is_correct: boolean | null;
  confidence: Confidence | null;
  self_assessment: SelfAssessment | null;
  error_type: ErrorType | null;
  ai_feedback: AiGrade | null;
  created_at: string;
}

export async function getAttempt(attemptId: number): Promise<SavedAttempt | null> {
  const { data } = await supabase
    .from("user_attempts")
    .select("id, answer_text, selected_option, is_correct, confidence, self_assessment, error_type, ai_feedback, created_at")
    .eq("id", attemptId)
    .single();
  return (data as SavedAttempt) ?? null;
}

export interface SubmitAttemptInput {
  question_id: number;
  answer_text?: string;
  selected_option?: string;
  is_correct?: boolean;
  time_spent_seconds?: number;
  confidence: Confidence;
}

export async function submitAttempt(input: SubmitAttemptInput): Promise<number> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("not signed in");

  const { data, error } = await supabase
    .from("user_attempts")
    .insert({
      user_id: userId,
      question_id: input.question_id,
      answer_text: input.answer_text ?? null,
      selected_option: input.selected_option ?? null,
      is_correct: input.is_correct ?? null,
      time_spent_seconds: input.time_spent_seconds ?? null,
      confidence: input.confidence,
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("送出失敗");

  // MC correctness is known immediately — feed the scheduler now.
  if (input.is_correct === true || input.is_correct === false) {
    if (await claimSrsSlot(data.id)) {
      await applySrs(input.question_id, input.is_correct ? 1 : 0);
    }
  }

  return data.id as number;
}

export async function setSelfAssessment(attemptId: number, assessment: SelfAssessment): Promise<void> {
  const { data: attempt } = await supabase
    .from("user_attempts")
    .select("question_id")
    .eq("id", attemptId)
    .single();
  await supabase.from("user_attempts").update({ self_assessment: assessment }).eq("id", attemptId);
  if (attempt && (await claimSrsSlot(attemptId))) {
    const quality = assessment === "correct" ? 1 : assessment === "partial" ? 0.5 : 0;
    await applySrs(attempt.question_id, quality);
  }
}

export async function setErrorType(attemptId: number, errorType: ErrorType): Promise<void> {
  await supabase.from("user_attempts").update({ error_type: errorType }).eq("id", attemptId);
}

/** Calls the grade-attempt Edge Function, which holds the Groq API key —
 *  never call the grading API directly from the client. Throws an Error
 *  whose message is the server's own explanation (e.g. the daily-limit
 *  message), not a generic failure string — supabase-js doesn't surface
 *  the response body on a non-2xx by itself, so it has to be read here. */
export async function gradeAttempt(attemptId: number): Promise<AiGrade> {
  const { data, error } = await supabase.functions.invoke("grade-attempt", {
    body: { attempt_id: attemptId },
  });
  if (error) {
    const context = (error as { context?: Response }).context;
    let serverMessage: string | undefined;
    if (context) {
      try {
        const body = await context.json();
        serverMessage = body?.error;
      } catch {
        // response wasn't JSON — fall through to the generic error
      }
    }
    throw serverMessage ? new Error(serverMessage) : error;
  }
  return data.grade as AiGrade;
}
