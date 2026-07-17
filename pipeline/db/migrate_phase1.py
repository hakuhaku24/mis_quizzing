"""Phase 1 migration: attempt telemetry columns + multi-concept tags.

- user_attempts.confidence   : 'low' | 'medium' | 'high'  (asked before submitting)
- user_attempts.error_type   : 'concept' | 'memory' | 'careless' | 'unseen'
- questions.concepts         : JSON array of fine-grained concept tags,
                               seeded from subtopic; refined by tag_concepts.py

Idempotent: safe to re-run.
"""
import json
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[2] / "data" / "questions.db"


def column_exists(conn: sqlite3.Connection, table: str, column: str) -> bool:
    return any(r[1] == column for r in conn.execute(f"PRAGMA table_info({table})"))


def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    added = []

    if not column_exists(conn, "user_attempts", "confidence"):
        conn.execute("ALTER TABLE user_attempts ADD COLUMN confidence TEXT")
        added.append("user_attempts.confidence")
    if not column_exists(conn, "user_attempts", "error_type"):
        conn.execute("ALTER TABLE user_attempts ADD COLUMN error_type TEXT")
        added.append("user_attempts.error_type")
    if not column_exists(conn, "questions", "concepts"):
        conn.execute("ALTER TABLE questions ADD COLUMN concepts TEXT")
        added.append("questions.concepts")

    seeded = conn.execute(
        """
        UPDATE questions
        SET concepts = json_array(subtopic)
        WHERE concepts IS NULL AND subtopic IS NOT NULL
        """
    ).rowcount

    conn.commit()

    missing = [
        r[0]
        for r in conn.execute("SELECT id FROM questions WHERE concepts IS NULL")
    ]
    print(f"added columns: {added or 'none (already migrated)'}")
    print(f"seeded concepts from subtopic: {seeded}")
    print(f"questions still without concepts: {json.dumps(missing)}")
    conn.close()


if __name__ == "__main__":
    main()
