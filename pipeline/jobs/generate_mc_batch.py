# -*- coding: utf-8 -*-
"""Generate a batch of new multiple-choice questions via AI, scoped to one
topic, spread evenly across its most-used concept tags — written to close
the gap found 2026-10-10: NCU real exams have zero multiple_choice DS
questions (資結 is all essay/calculation there), so DS practice was
essay-heavy with very little quick-check MC.

These are clearly-labeled synthetic content (source_type='template',
verified_status='ai_draft'), not real past-exam questions — same honesty
convention as generate_draft_solutions.py's ai_draft solutions.

Inserts into both data/questions.db (SQLite) and the live Supabase tables,
since they're two independently-migrated copies (see migrate_to_supabase.py).

Usage: python -m pipeline.jobs.generate_mc_batch --topic DS --per-concept 2
"""
import argparse
import json
import re
import sqlite3
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / "data" / "questions.db"
MODEL = "gemini-3.5-flash-lite"

SYSTEM = """你是台灣資訊管理研究所碩士班入學考試的出題委員。請出一題單選題（multiple choice），
難度、用詞、風格要貼近台灣頂尖大學（中央、政大、中山、成大）資管所碩士班入學考試的真實水準——
不是送分題，要有鑑別度，干擾選項要有道理但明確錯誤，不能一眼看出答案。
只輸出 JSON（無 markdown 圍欄）：
{"question_text": "題目敘述（可用 LaTeX $...$ 表示數學式/程式碼用 markdown code block）",
 "options": ["選項A文字（不含A.前綴）", "選項B文字", "選項C文字", "選項D文字"],
 "correct_option": "A|B|C|D",
 "explanation": "為什麼正確答案對、其他選項各自錯在哪裡，2-4 句",
 "difficulty": 1-5的整數（3=中央資管所碩士班正常難度，5=最難）}"""


def api_key() -> str:
    env = ROOT / "apps" / "web" / ".env.local"
    for line in env.read_text(encoding="utf-8").splitlines():
        if line.startswith("GEMINI_API_KEY="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("GEMINI_API_KEY not found")


def repair_json(text: str) -> dict:
    """Same tolerant parser as generate_draft_solutions.py — Gemini's JSON
    mode occasionally leaves a ```json fence or an unescaped backslash."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    stripped = text.strip()
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", stripped, re.S)
    if fence:
        stripped = fence.group(1)
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass
    out, in_string, i, n = [], False, 0, len(stripped)
    while i < n:
        ch = stripped[i]
        if in_string:
            if ch == "\\" and i + 1 < n and stripped[i + 1] in '"\\/bfnrtu':
                out.append(ch); out.append(stripped[i + 1]); i += 2; continue
            if ch == "\\":
                out.append("\\\\"); i += 1; continue
            if ch == '"':
                in_string = False; out.append(ch); i += 1; continue
            if ch in "\n\r\t":
                out.append({"\n": "\\n", "\r": "\\r", "\t": "\\t"}[ch]); i += 1; continue
            if ord(ch) < 0x20:
                i += 1; continue
            out.append(ch); i += 1
        else:
            if ch == '"':
                in_string = True
            out.append(ch); i += 1
    return json.loads("".join(out))


def llm(key: str, user: str) -> dict:
    max_tokens = 4000
    for attempt in range(8):
        body = {
            "system_instruction": {"parts": [{"text": SYSTEM}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {"temperature": 0.9, "maxOutputTokens": max_tokens, "responseMimeType": "application/json"},
        }
        req = urllib.request.Request(
            f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={key}",
            data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json", "User-Agent": "mis-grad-exam-coach/1.0"},
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                data = json.load(r)
            candidate = data["candidates"][0]
            if "content" not in candidate:
                reason = candidate.get("finishReason", "unknown")
                if reason == "MAX_TOKENS":
                    max_tokens = 8000
                    continue
                raise RuntimeError(f"blocked ({reason})")
            return repair_json(candidate["content"]["parts"][0]["text"])
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503):
                wait = min(int(e.headers.get("retry-after") or 2 ** (attempt + 2)) + 5, 900)
                print(f"    HTTP {e.code}, retry in {wait}s", flush=True)
                time.sleep(wait)
                continue
            raise
        except (urllib.error.URLError, OSError, TimeoutError) as e:
            wait = 2 ** (attempt + 2)
            print(f"    network error ({e}), retry in {wait}s", flush=True)
            time.sleep(wait)
    raise RuntimeError("llm failed after retries")


def env() -> dict:
    out = {}
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip()
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--topic", required=True, choices=["CS", "DS", "MIS"])
    ap.add_argument("--concepts", nargs="+", help="override the concept list")
    ap.add_argument("--per-concept", type=int, default=2)
    args = ap.parse_args()

    key = api_key()
    conn = sqlite3.connect(DB)

    if args.concepts:
        concepts = args.concepts
    else:
        rows = conn.execute(
            "SELECT concepts FROM questions WHERE topic=? AND school='NCU'", (args.topic,)
        ).fetchall()
        counts: dict[str, int] = {}
        for (c,) in rows:
            for tag in (json.loads(c) if c else []):
                counts[tag] = counts.get(tag, 0) + 1
        concepts = [c for c, _ in sorted(counts.items(), key=lambda x: -x[1])[:12]]

    # Prefer real NCU exams as the style reference; some topics (MIS) have
    # none yet, so fall back to the existing template question set.
    examples_rows = conn.execute(
        "SELECT question_text FROM questions WHERE topic=? AND school='NCU' ORDER BY RANDOM() LIMIT 3",
        (args.topic,),
    ).fetchall()
    if not examples_rows:
        examples_rows = conn.execute(
            "SELECT question_text FROM questions WHERE topic=? AND school='template' ORDER BY RANDOM() LIMIT 3",
            (args.topic,),
        ).fetchall()
    examples = "\n\n---\n\n".join(r[0] for r in examples_rows)

    subj_name = {"CS": "計算機概論", "DS": "資料結構", "MIS": "管理資訊系統"}[args.topic]

    new_ids = []
    for concept in concepts:
        for i in range(args.per_concept):
            user = (
                f"科目：{subj_name}\n知識點：{concept}\n\n"
                f"以下是這個科目真實考古題的風格參考（不要出一樣的題目，只參考難度與語氣）：\n\n{examples}"
            )
            try:
                q = llm(key, user)
            except Exception as e:
                print(f"  {concept} #{i+1} FAILED: {e}", flush=True)
                continue

            letters = ["A", "B", "C", "D"]
            correct = str(q.get("correct_option", "")).strip().upper()[:1]
            if correct not in letters or len(q.get("options", [])) != 4:
                print(f"  {concept} #{i+1} FAILED: malformed options/correct_option", flush=True)
                continue

            cur = conn.cursor()
            cur.execute(
                """INSERT INTO questions
                   (school, department, year_label, question_text, question_type, topic,
                    subtopic, concepts, difficulty, value_score, source_type, verified_status,
                    options, correct_option)
                   VALUES ('template', '資訊管理研究所', 'AI 出題', ?, 'multiple_choice', ?, ?, ?, ?,
                           0.7, 'template', 'ai_draft', ?, ?)""",
                (
                    q["question_text"], args.topic, concept, json.dumps([concept], ensure_ascii=False),
                    q.get("difficulty", 3), json.dumps(q["options"], ensure_ascii=False), correct,
                ),
            )
            qid = cur.lastrowid
            cur.execute(
                """INSERT INTO solutions (question_id, solution_text, explanation, source_type, verified_status)
                   VALUES (?, ?, NULL, 'ai_draft', 'ai_draft')""",
                (qid, f"正確答案：({correct})\n{q.get('explanation', '')}"),
            )
            conn.commit()
            new_ids.append(qid)
            print(f"  {concept} #{i+1} ok -> q{qid}", flush=True)
            time.sleep(2)

    conn.close()
    print(f"generated {len(new_ids)} questions: {new_ids}")

    if new_ids:
        push_to_supabase(new_ids)


def push_to_supabase(ids: list[int]) -> None:
    cfg = env()
    url, key = cfg["SUPABASE_URL"], cfg["SUPABASE_SECRET_KEY"]
    h = {
        "apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row

    for qid in ids:
        q = conn.execute("SELECT * FROM questions WHERE id=?", (qid,)).fetchone()
        r = requests.post(
            f"{url}/rest/v1/questions",
            headers=h,
            data=json.dumps(
                {
                    "school": q["school"], "department": q["department"], "year_label": q["year_label"],
                    "question_text": q["question_text"], "question_type": q["question_type"], "topic": q["topic"],
                    "subtopic": q["subtopic"], "concepts": json.loads(q["concepts"]) if q["concepts"] else None,
                    "difficulty": q["difficulty"], "value_score": q["value_score"], "source_type": q["source_type"],
                    "verified_status": q["verified_status"],
                    "options": json.loads(q["options"]) if q["options"] else None,
                    "correct_option": q["correct_option"],
                },
                ensure_ascii=False,
            ).encode("utf-8"),
        )
        if not r.ok:
            print(f"  supabase insert q{qid} FAILED: {r.status_code} {r.text[:200]}")
            continue
        new_id = r.json()[0]["id"]

        sol = conn.execute("SELECT * FROM solutions WHERE question_id=?", (qid,)).fetchone()
        r2 = requests.post(
            f"{url}/rest/v1/solutions",
            headers=h,
            data=json.dumps(
                {
                    "question_id": new_id, "solution_text": sol["solution_text"], "explanation": sol["explanation"],
                    "source_type": sol["source_type"], "verified_status": sol["verified_status"],
                },
                ensure_ascii=False,
            ).encode("utf-8"),
        )
        print(f"  supabase q{qid} -> {new_id}: question={r.status_code} solution={r2.status_code}")
    conn.close()


if __name__ == "__main__":
    sys.exit(main())
