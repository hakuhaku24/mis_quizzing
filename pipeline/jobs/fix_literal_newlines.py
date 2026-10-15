# -*- coding: utf-8 -*-
"""Turn literal backslash-n sequences that some models wrote into solution
text back into real line breaks.

Only a "\\n" followed by a bullet (・), whitespace or the end of the text is a
formatting artifact. Left untouched: anything inside ``` code fences
(printf("...\\n") is correct code) and LaTeX commands such as \\neq or
\\nsubseteq (followed by letters).

Usage: python -m pipeline.jobs.fix_literal_newlines [--apply]
"""
import argparse
import json
import re
import sqlite3
import sys
import urllib.request
from pathlib import Path

from pipeline.jobs.fix_multi_select import read_env

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / "data" / "questions.db"
# followed by a bullet, whitespace, a CJK character or the end; LaTeX commands continue with ASCII letters
ARTIFACT = re.compile(r"\\n(?=[・\s\u3000-\u9fff\uff00-\uffef]|$)")


def fix(text: str) -> str:
    parts = text.split("```")
    for i in range(0, len(parts), 2):  # even segments are outside code fences
        parts[i] = ARTIFACT.sub("\n", parts[i])
    return "```".join(parts)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    conn = sqlite3.connect(DB)
    changes = []
    for qid, text in conn.execute("SELECT question_id, solution_text FROM solutions"):
        if text and fix(text) != text:
            changes.append((qid, text, fix(text)))
    for qid, old, new in changes:
        print(f"q{qid}: {len(ARTIFACT.findall(old))} artifacts fixed; remaining literal \\n: {new.count(chr(92) + 'n')}")
    if not args.apply:
        print(f"{len(changes)} solutions would change (dry run)")
        return

    env = read_env(ROOT / ".env")
    for qid, _old, new in changes:
        conn.execute("UPDATE solutions SET solution_text = ? WHERE question_id = ?", (new, qid))
        req = urllib.request.Request(
            f"{env['SUPABASE_URL']}/rest/v1/solutions?question_id=eq.{qid}",
            data=json.dumps({"solution_text": new}).encode(), method="PATCH",
            headers={"apikey": env["SUPABASE_SECRET_KEY"], "Authorization": f"Bearer {env['SUPABASE_SECRET_KEY']}",
                     "Content-Type": "application/json", "Prefer": "return=representation"},
        )
        with urllib.request.urlopen(req, timeout=60) as r:
            n = len(json.load(r))
        if n != 1:
            raise RuntimeError(f"q{qid}: supabase updated {n} rows")
    conn.commit()
    print(f"applied to {len(changes)} solutions in SQLite and Supabase")


if __name__ == "__main__":
    main()
