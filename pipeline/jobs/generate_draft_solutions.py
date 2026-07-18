# -*- coding: utf-8 -*-
"""Generate AI draft solutions for imported real-exam questions.

For every NCU question without a solution:
- essay/short_answer/calculation → reference answer written as scoring points
  (this text becomes the AI grader's baseline, so quality > cost)
- multiple_choice → correct option + per-option analysis; questions.correct_option
  is filled so the app can auto-judge (clearly labelled as AI draft in the UI)

Model: gpt-oss-120b (strongest reasoner available on this Groq account).
Everything is stored with source_type/verified_status = 'ai_draft'.
Idempotent + resumable: questions that already have a solution are skipped.

Usage: python -m pipeline.jobs.generate_draft_solutions [--limit N]
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

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / "data" / "questions.db"
MODEL = "openai/gpt-oss-120b"

ESSAY_SYSTEM = """你是台灣資管所研究所入學考試的解題老師。為考題撰寫參考詳解，繁體中文（專有名詞保留英文），只輸出 JSON（無 markdown 圍欄）：
{"solution_text": "完整參考答案：依題目要求逐點作答，每個得分點一行、開頭用「・」。要具體到考場上照抄可拿滿分的程度：該畫圖的用文字描述圖的結構，該寫程式的寫出完整程式碼，該計算的列出計算過程與最終答案。",
 "explanation": "1-3 句補充：常見錯誤或延伸考點，無則空字串"}
數學式用 $...$ LaTeX，程式碼用 markdown 程式碼區塊。"""

MC_SYSTEM = """你是台灣資管所研究所入學考試的解題老師。判斷單選題的正確答案，繁體中文，只輸出 JSON（無 markdown 圍欄）：
{"correct_option": "A|B|C|D|E",
 "solution_text": "先一句話說明正確答案與理由，再逐一簡短說明其他選項為何錯誤（每個選項一行、開頭用「・」）",
 "confidence": "high|medium|low"}
不確定時仍要選出最可能的答案並把 confidence 設為 low。"""


def api_key() -> str:
    env = ROOT / "apps" / "web" / ".env.local"
    for line in env.read_text(encoding="utf-8").splitlines():
        if line.startswith("GROQ_API_KEY="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("GROQ_API_KEY not found")


def llm(key: str, system: str, user: str) -> dict:
    body = {
        "model": MODEL,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
        "max_tokens": 4000,
        "reasoning_effort": "high",
    }
    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json",
                 "User-Agent": "mis-grad-exam-coach/1.0"},
    )
    for attempt in range(8):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                data = json.load(r)
            return json.loads(data["choices"][0]["message"]["content"])
        except urllib.error.HTTPError as e:
            if e.code in (413, 429, 500, 502, 503):
                wait = min(int(e.headers.get("retry-after") or 2 ** (attempt + 2)) + 5, 900)
                print(f"    HTTP {e.code}, retry in {wait}s", flush=True)
                time.sleep(wait)
                continue
            raise
        except (urllib.error.URLError, OSError, TimeoutError) as e:
            print(f"    network error ({e}), retry in {2 ** (attempt + 2)}s", flush=True)
            time.sleep(2 ** (attempt + 2))
    raise RuntimeError("llm failed after retries")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    key = api_key()
    conn = sqlite3.connect(DB)
    rows = conn.execute(
        """SELECT q.id, q.question_text, q.question_type, q.options, q.topic, q.exam_year
           FROM questions q
           WHERE q.school = 'NCU'
             AND NOT EXISTS (SELECT 1 FROM solutions s WHERE s.question_id = q.id)
           ORDER BY q.exam_year DESC, q.id"""
    ).fetchall()
    if args.limit:
        rows = rows[: args.limit]
    print(f"{len(rows)} questions to solve", flush=True)

    subj = {"CS": "計算機概論", "DS": "資料結構"}
    done = 0
    for qid, qtext, qtype, options, topic, year in rows:
        head = f"【{year} 學年中央資管所 {subj.get(topic, topic)}】\n{qtext}"
        try:
            if qtype == "multiple_choice" and options:
                opts = json.loads(options)
                letters = [chr(65 + i) for i in range(len(opts))]
                user = head + "\n\n選項：\n" + "\n".join(f"({l}) {o}" for l, o in zip(letters, opts))
                out = llm(key, MC_SYSTEM, user)
                co = str(out.get("correct_option", "")).strip().upper()[:1]
                if co not in letters:
                    print(f"  q{qid}: invalid option {co!r}, skipped", flush=True)
                    continue
                sol = out.get("solution_text", "").strip()
                conf = out.get("confidence", "")
                expl = f"AI 判斷信心：{conf}" if conf else None
                conn.execute("UPDATE questions SET correct_option = ? WHERE id = ?", (co, qid))
                conn.execute(
                    """INSERT INTO solutions (question_id, solution_text, explanation,
                       source_type, verified_status) VALUES (?, ?, ?, 'ai_draft', 'ai_draft')""",
                    (qid, f"正確答案：({co})\n{sol}", expl),
                )
            else:
                out = llm(key, ESSAY_SYSTEM, head)
                sol = out.get("solution_text", "").strip()
                if len(sol) < 30:
                    print(f"  q{qid}: solution too short, skipped", flush=True)
                    continue
                conn.execute(
                    """INSERT INTO solutions (question_id, solution_text, explanation,
                       source_type, verified_status) VALUES (?, ?, ?, 'ai_draft', 'ai_draft')""",
                    (qid, sol, out.get("explanation") or None),
                )
            conn.commit()
            done += 1
            print(f"  q{qid} ok ({done}/{len(rows)})", flush=True)
            time.sleep(2)
        except Exception as e:
            print(f"  q{qid} FAILED: {e}", flush=True)
    print(f"done: {done}/{len(rows)}")
    conn.close()


if __name__ == "__main__":
    sys.exit(main())
