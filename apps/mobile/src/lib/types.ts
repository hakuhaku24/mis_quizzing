import type { Readiness } from "./scoring";

export type QuestionType = "essay" | "short_answer" | "multiple_choice" | "calculation";
export type Confidence = "low" | "medium" | "high";
export type SelfAssessment = "correct" | "partial" | "wrong";
export type ErrorType = "concept" | "memory" | "careless" | "unseen";
export type Slot = "weak" | "review" | "unseen" | "extra";

export interface Question {
  id: number;
  school: string | null;
  department: string | null;
  year_label: string | null;
  exam_year: number | null;
  question_number: string | null;
  question_text: string;
  question_type: QuestionType | null;
  topic: string | null;
  subtopic: string | null;
  difficulty: number | null;
  value_score: number | null;
  options: string[] | null;
  /** comma-separated letters; more than one for multi-select (see lib/choices.ts) */
  correct_option: string | null;
  concepts: string[] | null;
  is_multi_select?: boolean | null;
  needs_drawing?: boolean | null;
}

export interface Solution {
  id: number;
  question_id: number;
  solution_text: string;
  explanation: string | null;
  source_type: string | null;
  verified_status: string | null;
}

export interface DailyItem extends Question {
  slot: Slot;
  done_today: boolean;
  today_attempt_id: number | null;
}

export interface AiGradePoint {
  point: string;
  quote?: string;
}

export interface AiGrade {
  score: number;
  verdict: "correct" | "partial" | "wrong";
  got_points: (AiGradePoint | string)[];
  missing_points: string[];
  wrong_points: string[];
  feedback: string;
}

export interface TopicStat {
  topic: string;
  total: number;
  mastery: number | null;
  avg_ai_score: number | null;
  ai_graded: number;
}

export interface Analytics {
  totalAttempts: number;
  aiGraded: number;
  avgAiScore: number | null;
  topicStats: TopicStat[];
  recentAttempts: { ai_score: number | null; created_at: string }[];
  readiness: Readiness;
  /** All placed users' average readiness (0–100), null until enough users. */
  readinessAverage: number | null;
}
