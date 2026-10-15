# -*- coding: utf-8 -*-
"""Restore LaTeX commands whose first letter was eaten as a JSON escape.

A model writing "\\frac" with a single backslash inside JSON produced a form
feed + "rac" once parsed (likewise \\b, \\t, \\r, \\n for \\beta, \\theta,
\\rightarrow, \\neq ...). repair_json() now prevents it; this repairs data
written before that, in SQLite + Supabase or in local staging JSON files.

Usage:
  python -m pipeline.jobs.fix_latex_escapes [--apply]          # database
  python -m pipeline.jobs.fix_latex_escapes --files GLOB ...   # staging json
"""
import argparse
import glob
import json
import re
import sqlite3
import sys
import urllib.request
from pathlib import Path

from pipeline.jobs.fix_multi_select import read_env

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / "data" / "questions.db"
RESTORE = [
    (re.compile(r"\x0c(?=rac|orall|lat|loor)"), "\\\\f"),
    (re.compile(r"\x08(?=eta|egin|ar|inom|ig|mod|oldsymbol|ot)"), "\\\\b"),
    (re.compile(r"\t(?=heta|imes|ext|au\b|o\b|op\b|ilde|riangle|frac|an\b)"), "\\\\t"),
    (re.compile(r"\r(?=ightarrow|ight|ho\b|ceil|floor|angle|m\b|brace)"), "\\\\r"),
    (re.compile(r"\n(?=eq\b|abla|ot\b|u\b|eg\b|subseteq|exists)"), "\\\\n"),
]


def restore(text):
    if not isinstance(text, str):
        return text
    for pat, rep in RESTORE:
        text = pat.sub(rep, text)
    return text


def walk(obj):
    if isinstance(obj, dict):
        return {k: walk(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [walk(v) for v in obj]
    return restore(obj)


def fix_files(patterns: list[str]) -> None:
    for pattern in patterns:
        for f in glob.glob(pattern):
            data = json.loads(Path(f).read_text(encoding="utf-8"))
            fixed = walk(data)
            if fixed != data:
                Path(f).write_text(json.dumps(fixed, ensure_ascii=False, indent=1), encoding="utf-8")
                print(f"fixed {f}")


def fix_db(apply: bool) -> None:
    conn = sqlite3.connect(DB)
    sol = [(q, t, restore(t)) for q, t in conn.execute("SELECT question_id, solution_text FROM solutions") if restore(t) != t]
    qst = [(q, t, restore(t)) for q, t in conn.execute("SELECT id, question_text FROM questions") if restore(t) != t]
    print("solutions:", [q for q, _, _ in sol], "| questions:", [q for q, _, _ in qst])
    if not apply:
        return
    env = read_env(ROOT / ".env")
    hdr = {"apikey": env["SUPABASE_SECRET_KEY"], "Authorization": f"Bearer {env['SUPABASE_SECRET_KEY']}",
           "Content-Type": "application/json", "Prefer": "return=representation"}

    def patch(path, body):
        req = urllib.request.Request(f"{env['SUPABASE_URL']}/rest/v1/{path}", data=json.dumps(body).encode(),
                                     method="PATCH", headers=hdr)
        with urllib.request.urlopen(req, timeout=60) as r:
            if len(json.load(r)) != 1:
                raise RuntimeError(f"{path}: expected 1 row")

    for q, _, new in sol:
        conn.execute("UPDATE solutions SET solution_text = ? WHERE question_id = ?", (new, q))
        patch(f"solutions?question_id=eq.{q}", {"solution_text": new})
    for q, _, new in qst:
        conn.execute("UPDATE questions SET question_text = ? WHERE id = ?", (new, q))
        patch(f"questions?id=eq.{q}", {"question_text": new})
    conn.commit()
    print(f"applied: {len(sol)} solutions, {len(qst)} questions")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--files", nargs="*")
    args = ap.parse_args()
    if args.files:
        fix_files(args.files)
    else:
        fix_db(args.apply)


if __name__ == "__main__":
    main()
