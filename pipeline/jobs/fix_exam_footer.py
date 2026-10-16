# -*- coding: utf-8 -*-
"""Remove exam-paper header/footer lines (e.g. "※本考試禁止使用計算器") that
OCR glued onto question text or MC options. Uses the same pattern as
ingest_local_papers.strip_page_furniture, which now cleans new papers too.

Supabase is the source of truth; the SQLite mirror is updated for the same ids.

Usage: python -m pipeline.jobs.fix_exam_footer [--apply]
"""
import argparse
import json
import sqlite3
import sys
import urllib.request
from pathlib import Path

from pipeline.jobs.fix_multi_select import read_env
from pipeline.jobs.ingest_local_papers import strip_page_furniture

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / "data" / "questions.db"


def rest(env: dict, method: str, path: str, body=None):
    req = urllib.request.Request(
        f"{env['SUPABASE_URL']}/rest/v1/{path}",
        data=json.dumps(body).encode() if body is not None else None, method=method,
        headers={"apikey": env["SUPABASE_SECRET_KEY"], "Authorization": f"Bearer {env['SUPABASE_SECRET_KEY']}",
                 "Content-Type": "application/json", "Prefer": "return=representation"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    env = read_env(ROOT / ".env")

    changes = []
    for q in rest(env, "GET", "questions?select=id,question_text,options&order=id&limit=5000"):
        text = q["question_text"] or ""
        opts = q["options"]
        new_text = strip_page_furniture(text)
        new_opts = [strip_page_furniture(str(o)) for o in opts] if isinstance(opts, list) else opts
        if new_text != text or new_opts != opts:
            changes.append((q["id"], new_text, new_opts))
            print(f"q{q['id']}: text {'changed' if new_text != text else 'ok'}, "
                  f"options {'changed' if new_opts != opts else 'ok'}")
    if not args.apply:
        print(f"{len(changes)} questions would change (dry run)")
        return

    conn = sqlite3.connect(DB)
    for qid, text, opts in changes:
        n = len(rest(env, "PATCH", f"questions?id=eq.{qid}", {"question_text": text, "options": opts}))
        if n != 1:
            raise RuntimeError(f"q{qid}: supabase updated {n} rows")
        conn.execute("UPDATE questions SET question_text = ?, options = ? WHERE id = ?",
                     (text, json.dumps(opts, ensure_ascii=False) if opts else None, qid))
    conn.commit()
    print(f"applied to {len(changes)} questions in Supabase and SQLite")


if __name__ == "__main__":
    main()
