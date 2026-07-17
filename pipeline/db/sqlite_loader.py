"""SQLite schema + loader for local development (no Supabase required)."""

import sqlite3
from pathlib import Path
from typing import Optional

DB_PATH = Path(__file__).parent.parent.parent / "data" / "questions.db"


SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS questions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    school      TEXT,
    department  TEXT,
    year_label  TEXT,
    exam_year   INTEGER,
    question_number TEXT,
    question_text   TEXT NOT NULL,
    question_type   TEXT,   -- essay | short_answer | multiple_choice | calculation
    topic           TEXT,
    subtopic        TEXT,
    difficulty      INTEGER CHECK(difficulty BETWEEN 1 AND 5),
    value_score     REAL,
    source_type     TEXT,   -- pdf_extracted | template
    extraction_confidence REAL,
    verified_status TEXT DEFAULT 'unverified',
    options         TEXT,   -- JSON array of choice strings, null for non-MC
    correct_option  TEXT,   -- 'A'|'B'|'C'|'D', null for non-MC
    source_page_start INTEGER,
    source_page_end   INTEGER,
    created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS solutions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    solution_text TEXT NOT NULL,
    explanation TEXT,
    source_type TEXT,       -- ai_draft | template | human_written
    verified_status TEXT DEFAULT 'unverified',
    created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_attempts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER REFERENCES questions(id),
    answer_text TEXT,
    selected_option TEXT,   -- 'A'|'B'|'C'|'D' for MC questions
    is_correct  INTEGER,    -- 1=correct, 0=wrong, NULL=ungraded
    self_assessment TEXT,   -- 'correct'|'partial'|'wrong' (user self-eval for essay)
    time_spent_seconds INTEGER,
    created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_question_states (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER UNIQUE REFERENCES questions(id),
    status      TEXT DEFAULT 'new',  -- new | learning | wrong | reviewing | mastered
    last_attempt_at TEXT,
    mastery_score REAL DEFAULT 0,
    wrong_count   INTEGER DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_questions_topic       ON questions(topic);
CREATE INDEX IF NOT EXISTS idx_questions_school      ON questions(school);
CREATE INDEX IF NOT EXISTS idx_questions_value_score ON questions(value_score DESC);
CREATE INDEX IF NOT EXISTS idx_questions_source_type ON questions(source_type);
"""


def get_conn(db_path: Path = DB_PATH) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db(db_path: Path = DB_PATH) -> sqlite3.Connection:
    conn = get_conn(db_path)
    conn.executescript(SCHEMA)
    conn.commit()
    return conn


def insert_question(conn: sqlite3.Connection, q: dict) -> int:
    import json as _json
    options_val = q.get("options")
    if isinstance(options_val, list):
        options_val = _json.dumps(options_val, ensure_ascii=False)
    cur = conn.execute(
        """INSERT INTO questions
           (school, department, year_label, exam_year, question_number,
            question_text, question_type, topic, subtopic, difficulty,
            value_score, source_type, extraction_confidence, verified_status,
            options, correct_option, source_page_start, source_page_end)
           VALUES (:school, :department, :year_label, :exam_year, :question_number,
                   :question_text, :question_type, :topic, :subtopic, :difficulty,
                   :value_score, :source_type, :extraction_confidence, :verified_status,
                   :options, :correct_option, :source_page_start, :source_page_end)
        """,
        {
            "school": q.get("school"),
            "department": q.get("department"),
            "year_label": q.get("year_label"),
            "exam_year": q.get("exam_year"),
            "question_number": q.get("question_number", "1"),
            "question_text": q["question_text"],
            "question_type": q.get("question_type", "essay"),
            "topic": q.get("topic"),
            "subtopic": q.get("subtopic"),
            "difficulty": q.get("difficulty", 3),
            "value_score": q.get("value_score", 0.5),
            "source_type": q.get("source_type", "template"),
            "extraction_confidence": q.get("extraction_confidence", 1.0),
            "verified_status": q.get("verified_status", "unverified"),
            "options": options_val,
            "correct_option": q.get("correct_option"),
            "source_page_start": q.get("source_page_start"),
            "source_page_end": q.get("source_page_end"),
        },
    )
    return cur.lastrowid


def insert_solution(conn: sqlite3.Connection, question_id: int, s: dict) -> int:
    cur = conn.execute(
        """INSERT INTO solutions (question_id, solution_text, explanation, source_type, verified_status)
           VALUES (?, ?, ?, ?, ?)""",
        (
            question_id,
            s["solution_text"],
            s.get("explanation", ""),
            s.get("source_type", "template"),
            s.get("verified_status", "unverified"),
        ),
    )
    return cur.lastrowid


def load_questions(conn: sqlite3.Connection, questions_with_solutions: list[dict]) -> int:
    """Bulk insert questions + solutions. Returns count inserted."""
    inserted = 0
    for item in questions_with_solutions:
        qid = insert_question(conn, item)
        for sol in item.get("solutions", []):
            insert_solution(conn, qid, sol)
        inserted += 1
    conn.commit()
    return inserted


def get_stats(conn: sqlite3.Connection) -> dict:
    row = conn.execute("SELECT COUNT(*) as total FROM questions").fetchone()
    topics = conn.execute(
        "SELECT topic, COUNT(*) as cnt FROM questions GROUP BY topic ORDER BY cnt DESC"
    ).fetchall()
    sources = conn.execute(
        "SELECT source_type, COUNT(*) as cnt FROM questions GROUP BY source_type"
    ).fetchall()
    return {
        "total": row["total"],
        "by_topic": [{"topic": r["topic"], "count": r["cnt"]} for r in topics],
        "by_source": [{"source": r["source_type"], "count": r["cnt"]} for r in sources],
    }
