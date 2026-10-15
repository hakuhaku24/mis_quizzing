# -*- coding: utf-8 -*-
"""Mark existing questions whose ANSWER requires a drawing (tree, graph, UML,
diagram...), so the app can tell students a text representation is fine.

The id list was reviewed by hand on 2026-10-15 from keyword hits; excluded
false positives where "illustrate" meant "explain with an example" (223, 346,
354). New papers get this flag from ingest_local_papers.py's split stage.

Usage: python -m pipeline.jobs.flag_drawing_questions [--apply]
"""
import argparse
import json
import sqlite3
import sys
import urllib.request
from pathlib import Path

from pipeline.jobs.fix_multi_select import read_env

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / "data" / "questions.db"
DRAWING_IDS = [232, 233, 253, 265, 278, 284, 285, 306, 309, 319, 322, 326, 328, 333, 340, 360, 361, 362, 365, 397]


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    conn = sqlite3.connect(DB)
    for qid in DRAWING_IDS:
        row = conn.execute("SELECT school, exam_year, substr(question_text, 1, 60) FROM questions WHERE id = ?", (qid,)).fetchone()
        print(qid, row)
    if not args.apply:
        print("dry run; add --apply to write")
        return

    env = read_env(ROOT / ".env")
    ids = ",".join(map(str, DRAWING_IDS))
    conn.execute(f"UPDATE questions SET needs_drawing = 1 WHERE id IN ({ids})")
    conn.commit()
    req = urllib.request.Request(
        f"{env['SUPABASE_URL']}/rest/v1/questions?id=in.({ids})",
        data=json.dumps({"needs_drawing": True}).encode(),
        method="PATCH",
        headers={"apikey": env["SUPABASE_SECRET_KEY"], "Authorization": f"Bearer {env['SUPABASE_SECRET_KEY']}",
                 "Content-Type": "application/json", "Prefer": "return=representation"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        n = len(json.load(r))
    print(f"flagged: sqlite={conn.execute('SELECT count(*) FROM questions WHERE needs_drawing = 1').fetchone()[0]} supabase_rows={n}")


if __name__ == "__main__":
    main()
