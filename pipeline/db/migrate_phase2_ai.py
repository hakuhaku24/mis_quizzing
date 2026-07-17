"""Phase 2 migration: AI grading columns on user_attempts.

- ai_score    : 0-10 integer given by the grading model
- ai_feedback : full JSON grade (verdict, got/missing/wrong points, feedback)

Idempotent: safe to re-run.
"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[2] / "data" / "questions.db"


def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    cols = {r[1] for r in conn.execute("PRAGMA table_info(user_attempts)")}
    added = []
    if "ai_score" not in cols:
        conn.execute("ALTER TABLE user_attempts ADD COLUMN ai_score INTEGER")
        added.append("ai_score")
    if "ai_feedback" not in cols:
        conn.execute("ALTER TABLE user_attempts ADD COLUMN ai_feedback TEXT")
        added.append("ai_feedback")
    conn.commit()
    conn.close()
    print(f"added: {added or 'none (already migrated)'}")


if __name__ == "__main__":
    main()
