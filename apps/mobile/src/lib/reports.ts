import { supabase } from "./supabase";

export type ReportReason = "answer_key" | "solution" | "question_text" | "figure" | "other";

export const REPORT_REASONS: Record<ReportReason, string> = {
  answer_key: "標準答案錯了",
  solution: "詳解有錯或看不懂",
  question_text: "題目文字有誤或缺漏",
  figure: "缺圖或圖有錯",
  other: "其他",
};

export async function submitReport(input: {
  questionId: number;
  attemptId: number | null;
  reason: ReportReason;
  note: string;
}): Promise<void> {
  const { error } = await supabase.from("question_reports").insert({
    question_id: input.questionId,
    attempt_id: input.attemptId,
    reason: input.reason,
    note: input.note.trim() ? input.note.trim().slice(0, 1000) : null,
  });
  if (error) throw error;
}
