import type { Readiness } from "./scoring";
import type { AttemptOutcome } from "./labels";

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

/** One unit (questions.subtopic) of one subject on the 知識地圖. */
export interface UnitStat {
  topic: string;
  unit: string;
  /** questions in the bank — decides tile size, never shown as a number */
  questionCount: number;
  /** questions with a scored latest attempt */
  answered: number;
  /** of those, latest score at or above GRADUATE_AT */
  correct: number;
  /** mean latest score (0–1), null when nothing answered yet */
  mastery: number | null;
  /** answered but not yet right, newest first (a few, for the unit sheet) */
  pending: { questionId: number; attemptId: number; outcome: AttemptOutcome }[];
}

export interface SubjectMap {
  topic: string;
  /** biggest units first */
  units: UnitStat[];
  /** the unit most worth fixing in this subject, if any */
  focus: UnitStat | null;
}

/** How the student loses points, from the 錯誤原因 they picked after wrong answers. */
export interface ErrorReasons {
  total: number;
  /** most common first; reasons never picked are left out */
  items: { type: ErrorType; count: number }[];
}

/** A question answered "很有把握" whose latest scored attempt was still wrong. */
export interface BlindSpot {
  questionId: number;
  attemptId: number;
  topic: string | null;
  subtopic: string | null;
  questionText: string;
  is_correct: boolean | null;
  ai_score: number | null;
  self_assessment: string | null;
}

export interface Analytics {
  totalAttempts: number;
  /** distinct questions attempted at least once */
  questionsAnswered: number;
  aiGraded: number;
  avgAiScore: number | null;
  topicStats: TopicStat[];
  recentAttempts: { ai_score: number | null; created_at: string }[];
  readiness: Readiness;
  /** All placed users' average readiness (0–100), null until enough users. */
  readinessAverage: number | null;
  /** Most recent first, capped for display; blindSpotTotal is the full count. */
  blindSpots: BlindSpot[];
  blindSpotTotal: number;
  knowledgeMap: SubjectMap[];
  /** null until enough reasons are recorded to say anything */
  errorReasons: ErrorReasons | null;
}
