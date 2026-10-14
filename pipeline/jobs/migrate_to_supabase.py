# -*- coding: utf-8 -*-
"""One-time content migration: data/questions.db -> Supabase Postgres.

Migrates `questions` and `solutions` only — NOT user_attempts or
user_question_states. Those represent practice history tied to the web app's
local-only usage; the mobile app starts that history fresh against its own
Supabase Auth user rather than guessing a user mapping for old rows.

Requires supabase/migrations/002_mobile_schema.sql to already be applied
(via the SQL Editor or `supabase db push`) before running this.

Idempotent-ish: re-running without wiping first will hit the schema's
primary-key collision (ids are preserved from SQLite) and fail loudly rather
than silently duplicating rows — delete via the Supabase SQL Editor
(`truncate questions, solutions cascade;`) before a second run.

Usage: python -m pipeline.jobs.migrate_to_supabase
"""
import json
import sqlite3
import sys
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / "data" / "questions.db"
BATCH = 200


def env() -> dict:
    out = {}
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip()
    return out


def post_batch(url: str, key: str, table: str, rows: list[dict]) -> None:
    if not rows:
        return
    resp = requests.post(
        f"{url}/rest/v1/{table}",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        data=json.dumps(rows, ensure_ascii=False).encode("utf-8"),
        timeout=60,
    )
    if not resp.ok:
        raise RuntimeError(f"{table} batch failed ({resp.status_code}): {resp.text[:500]}")


def chunks(seq: list, n: int):
    for i in range(0, len(seq), n):
        yield seq[i : i + n]


def main() -> None:
    cfg = env()
    url = cfg.get("SUPABASE_URL")
    key = cfg.get("SUPABASE_SECRET_KEY")
    if not url or not key:
        raise SystemExit("SUPABASE_URL / SUPABASE_SECRET_KEY not found in .env")

    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row

    questions = conn.execute("SELECT * FROM questions").fetchall()
    solutions = conn.execute("SELECT * FROM solutions").fetchall()

    q_rows = []
    for q in questions:
        q_rows.append(
            {
                "id": q["id"],
                "school": q["school"],
                "department": q["department"],
                "year_label": q["year_label"],
                "exam_year": q["exam_year"],
                "question_number": q["question_number"],
                "question_text": q["question_text"],
                "question_type": q["question_type"],
                "topic": q["topic"],
                "subtopic": q["subtopic"],
                "difficulty": q["difficulty"],
                "value_score": q["value_score"],
                "source_type": q["source_type"],
                "extraction_confidence": q["extraction_confidence"],
                "verified_status": q["verified_status"],
                "options": json.loads(q["options"]) if q["options"] else None,
                "correct_option": q["correct_option"],
                "concepts": json.loads(q["concepts"]) if q["concepts"] else None,
                "source_page_start": q["source_page_start"],
                "source_page_end": q["source_page_end"],
            }
        )

    s_rows = []
    for s in solutions:
        s_rows.append(
            {
                "id": s["id"],
                "question_id": s["question_id"],
                "solution_text": s["solution_text"],
                "explanation": s["explanation"],
                "source_type": s["source_type"],
                "verified_status": s["verified_status"],
            }
        )

    print(f"migrating {len(q_rows)} questions, {len(s_rows)} solutions to {url}")

    for batch in chunks(q_rows, BATCH):
        post_batch(url, key, "questions", batch)
        print(f"  questions: +{len(batch)}", flush=True)

    for batch in chunks(s_rows, BATCH):
        post_batch(url, key, "solutions", batch)
        print(f"  solutions: +{len(batch)}", flush=True)

    # bump the identity sequences past the migrated ids, so future inserts
    # (new questions added through the app) don't collide with them
    for table, rows in (("questions", q_rows), ("solutions", s_rows)):
        if not rows:
            continue
        max_id = max(r["id"] for r in rows)
        resp = requests.post(
            f"{url}/rest/v1/rpc/exec_sql",
            headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            data=json.dumps({"sql": f"select setval(pg_get_serial_sequence('{table}','id'), {max_id})"}),
            timeout=30,
        )
        if not resp.ok:
            print(f"  NOTE: could not auto-bump {table}'s id sequence via RPC ({resp.status_code}); "
                  f"if you add questions through the app and hit a primary-key collision, run in the "
                  f"SQL Editor: select setval(pg_get_serial_sequence('{table}','id'), {max_id});", flush=True)

    print("done")
    conn.close()


if __name__ == "__main__":
    sys.exit(main())
