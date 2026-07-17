import path from "path";
import Database from "better-sqlite3";

const DB_PATH = path.resolve(process.cwd(), "../../data/questions.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH, { readonly: true });
    _db.pragma("journal_mode = WAL");
  }
  return _db;
}

export function getWriteDb(): Database.Database {
  return new Database(DB_PATH);
}

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
  verified_status: string | null;
  created_at: string;
}

export interface Solution {
  id: number;
  question_id: number;
  solution_text: string;
  explanation: string | null;
  source_type: string | null;
  verified_status: string | null;
}

export interface QuestionWithSolutions extends Question {
  solutions: Solution[];
}
