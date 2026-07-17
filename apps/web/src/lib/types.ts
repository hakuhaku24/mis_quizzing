export type QuestionStatus = "new" | "learning" | "wrong" | "reviewing" | "mastered" | "skipped";
export type SolutionSourceType = "ai_draft" | "human_written" | "human_verified" | "teacher_verified" | "template";
export type VerifiedStatus = "unverified" | "ai_draft" | "template" | "human_reviewed" | "human_verified" | "teacher_verified";

/** Flat SQLite row — no nested joins */
export interface Question {
  id: number;
  school: string | null;
  department: string | null;
  year_label: string | null;
  exam_year: number | null;
  question_number: string | null;
  question_text: string;
  question_type: string | null;
  topic: string | null;
  subtopic: string | null;
  difficulty: number | null;
  value_score: number | null;
  source_type: string | null;
  verified_status: VerifiedStatus | null;
  options: string | null;        // JSON array string for MC questions
  correct_option: string | null; // 'A'|'B'|'C'|'D' for MC questions
  created_at: string;
}

export interface Solution {
  id: number;
  question_id: number;
  solution_text: string;
  explanation: string | null;
  source_type: SolutionSourceType | null;
  verified_status: VerifiedStatus | null;
}

export interface QuestionsFilter {
  school?: string;
  topic?: string;
  year?: string;
  min_value_score?: number;
  source_type?: string;
  page?: number;
  limit?: number;
}
