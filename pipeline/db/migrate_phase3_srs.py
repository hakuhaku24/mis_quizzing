"""Phase 3 migration: spaced-repetition scheduling columns.

- user_question_states.next_review_at : ISO datetime, when this question is due again
- user_question_states.interval_days  : current SM-2-style interval
- user_question_states.ease           : SM-2-style ease factor (starts at 2.5)
- user_question_states.reps           : consecutive "good" reps (resets on a miss)
- user_attempts.srs_applied           : 1 once this attempt has fed the scheduler,
                                         so a later self-assessment doesn't double-count
                                         an attempt already scored by AI grading (or vice versa)

Idempotent: safe to re-run.
"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[2] / "data" / "questions.db"


def column_exists(conn: sqlite3.Connection, table: str, column: str) -> bool:
    return any(r[1] == column for r in conn.execute(f"PRAGMA table_info({table})"))


def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    added = []

    for col, ddl in [
        ("next_review_at", "TEXT"),
        ("interval_days", "REAL DEFAULT 0"),
        ("ease", "REAL DEFAULT 2.5"),
        ("reps", "INTEGER DEFAULT 0"),
    ]:
        if not column_exists(conn, "user_question_states", col):
            conn.execute(f"ALTER TABLE user_question_states ADD COLUMN {col} {ddl}")
            added.append(f"user_question_states.{col}")

    if not column_exists(conn, "user_attempts", "srs_applied"):
        conn.execute("ALTER TABLE user_attempts ADD COLUMN srs_applied INTEGER DEFAULT 0")
        added.append("user_attempts.srs_applied")

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_uqs_next_review ON user_question_states(next_review_at)"
    )

    conn.commit()
    print(f"added columns: {added or 'none (already migrated)'}")
    conn.close()


if __name__ == "__main__":
    main()
