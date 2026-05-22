export type QuestionStatus = "new" | "learning" | "wrong" | "reviewing" | "mastered" | "skipped";
export type SolutionSourceType = "ai_draft" | "human_written" | "human_verified" | "teacher_verified" | "official_if_available";
export type VerifiedStatus = "unverified" | "ai_draft" | "human_reviewed" | "human_verified" | "teacher_verified";

export interface School {
  id: string;
  code: string;
  name_zh: string;
  name_en: string | null;
}

export interface Subject {
  id: string;
  code: string;
  name_zh: string;
  name_en: string | null;
}

export interface Question {
  id: string;
  year_label: string | null;
  question_number: string | null;
  question_text: string;
  question_type: string | null;
  topic: string | null;
  subtopic: string | null;
  difficulty: number | null;
  value_score: number | null;
  value_score_reason: string | null;
  verified_status: VerifiedStatus;
  school?: School;
  subject?: Subject;
}

export interface Solution {
  id: string;
  question_id: string;
  solution_text: string;
  explanation: string | null;
  source_type: SolutionSourceType;
  verified_status: VerifiedStatus;
}

export interface QuestionsFilter {
  school?: string;
  subject?: string;
  topic?: string;
  year?: string;
  difficulty?: number;
  min_value_score?: number;
  verified_status?: string;
  page?: number;
  limit?: number;
}
