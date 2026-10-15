# -*- coding: utf-8 -*-
"""Generate AI draft solutions for imported real-exam questions.

For every NCU question without a solution:
- essay/short_answer/calculation → reference answer written as scoring points
  (this text becomes the AI grader's baseline, so quality > cost)
- multiple_choice → correct option + per-option analysis; questions.correct_option
  is filled so the app can auto-judge (clearly labelled as AI draft in the UI)

Model: Gemini 2.5 Flash-Lite. Deliberately a different model from the OCR job
(gemini-2.5-flash) so the two background jobs don't fight over the same daily
quota bucket — and separate from Groq entirely, which this job used to run on
until its gpt-oss-120b daily token quota (200k/day) got exhausted.
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
MODEL = "gemini-3.5-flash-lite"

ESSAY_SYSTEM = """你是台灣資管所研究所入學考試的解題老師。為考題撰寫參考詳解，繁體中文（專有名詞保留英文），只輸出 JSON（無 markdown 圍欄）：
{"solution_text": "完整參考答案：依題目要求逐點作答，每個得分點一行、開頭用「・」。要具體到考場上照抄可拿滿分的程度：該畫圖的用文字描述圖的結構，該寫程式的寫出完整程式碼，該計算的列出計算過程與最終答案。",
 "explanation": "1-3 句補充：常見錯誤或延伸考點，無則空字串"}
數學式用 $...$ LaTeX，程式碼用 markdown 程式碼區塊。"""

MC_SYSTEM = """你是台灣資管所研究所入學考試的解題老師。判斷選擇題的正確答案，繁體中文，只輸出 JSON（無 markdown 圍欄）：
{"multi_select": true|false,
 "correct_options": ["A", ...],
 "solution_text": "先一句話說明正確答案與理由，再逐一簡短說明每個選項為何對或錯（每個選項一行、開頭用「・」）",
 "confidence": "high|medium|low"}
題目若要求選出所有正確選項（例如 "Select all that apply"、複選），multi_select 為 true，correct_options 列出全部正確選項；否則為單選，correct_options 只放一個。
不確定時仍要選出最可能的答案並把 confidence 設為 low。"""


def parse_mc_answer(out: dict, letters: list[str]) -> tuple[list[str], bool] | None:
    """Normalize the model's answer to (sorted letters, is_multi_select).
    Accepts the legacy single "correct_option" field too. Returns None when
    the answer isn't usable."""
    raw = out.get("correct_options")
    if raw is None:
        raw = [out.get("correct_option", "")]
    if isinstance(raw, str):
        raw = re.findall(r"[A-Z]", raw.upper())
    picked = sorted({str(x).strip().upper() for x in raw if str(x).strip()})
    if not picked or any(p not in letters for p in picked):
        return None
    multi = bool(out.get("multi_select")) or len(picked) > 1
    return picked, multi


def repair_json(text: str) -> dict:
    """Gemini's JSON mode isn't always strict — despite responseMimeType
    being set to application/json, it sometimes still wraps the object in a
    ```json fence, or leaves raw control characters / lone backslashes
    (e.g. literal "\\frac") inside string values that break json.loads.
    Try a straight parse first; only repair on failure.

    The repair walks the text tracking whether we're inside a string literal
    — whitespace *between* fields (e.g. the newline after a field's closing
    comma) is valid JSON as-is and must be left alone; only raw control
    characters and stray backslashes *inside* a string value are illegal and
    need escaping. An earlier version escaped newlines everywhere, which
    broke the separator between fields."""
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

    out = []
    in_string = False
    i, n = 0, len(stripped)
    while i < n:
        ch = stripped[i]
        if in_string:
            if ch == "\\" and i + 1 < n and stripped[i + 1] in '"\\/bfnrtu':
                out.append(ch)
                out.append(stripped[i + 1])
                i += 2
                continue
            if ch == "\\":
                out.append("\\\\")  # lone backslash, not a valid escape
                i += 1
                continue
            if ch == '"':
                in_string = False
                out.append(ch)
                i += 1
                continue
            if ch in "\n\r\t":
                out.append({"\n": "\\n", "\r": "\\r", "\t": "\\t"}[ch])
                i += 1
                continue
            if ord(ch) < 0x20:
                i += 1  # drop other illegal raw control chars
                continue
            out.append(ch)
            i += 1
        else:
            if ch == '"':
                in_string = True
            out.append(ch)
            i += 1
    return json.loads("".join(out))


def ensure_question_flag_columns(conn: sqlite3.Connection) -> None:
    """Mirror supabase/migrations/005_question_flags.sql in the local SQLite copy."""
    cols = {r[1] for r in conn.execute("PRAGMA table_info(questions)")}
    for col in ("is_multi_select", "needs_drawing"):
        if col not in cols:
            conn.execute(f"ALTER TABLE questions ADD COLUMN {col} INTEGER NOT NULL DEFAULT 0")
    conn.commit()


def api_key() -> str:
    env = ROOT / "apps" / "web" / ".env.local"
    for line in env.read_text(encoding="utf-8").splitlines():
        if line.startswith("GEMINI_API_KEY="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("GEMINI_API_KEY not found")


def llm(key: str, system: str, user: str, model: str = MODEL, attempts: int = 8) -> dict:
    # Algorithm-heavy questions (recursive implementations, DFS, heap
    # construction, Java tracing...) need more completion budget than a quick
    # answer — start generous and bump it once if the model gets cut off
    # mid-JSON (finishReason MAX_TOKENS) instead of failing outright.
    max_tokens = 8000

    def build_req():
        body = {
            "system_instruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": max_tokens,
                "responseMimeType": "application/json",
            },
        }
        return urllib.request.Request(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}",
            data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json", "User-Agent": "mis-grad-exam-coach/1.0"},
        )

    truncation_retried = False
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(build_req(), timeout=180) as r:
                data = json.load(r)
            candidate = data["candidates"][0]
            if "content" not in candidate:
                reason = candidate.get("finishReason", "unknown")
                if reason == "MAX_TOKENS" and not truncation_retried:
                    truncation_retried = True
                    max_tokens = 16000
                    print("    truncated before valid JSON, retrying with maxOutputTokens=16000", flush=True)
                    continue
                raise RuntimeError(f"blocked ({reason})")
            text = candidate["content"]["parts"][0]["text"]
            return repair_json(text)
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503):
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
    ap.add_argument("--id", type=int, default=0, help="only this question id")
    args = ap.parse_args()

    key = api_key()
    conn = sqlite3.connect(DB)
    ensure_question_flag_columns(conn)
    rows = conn.execute(
        """SELECT q.id, q.question_text, q.question_type, q.options, q.topic, q.exam_year
           FROM questions q
           WHERE q.school = 'NCU'
             AND NOT EXISTS (SELECT 1 FROM solutions s WHERE s.question_id = q.id)
           ORDER BY q.exam_year DESC, q.id"""
    ).fetchall()
    if args.id:
        rows = [r for r in rows if r[0] == args.id]
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
                parsed = parse_mc_answer(out, letters)
                if not parsed:
                    print(f"  q{qid}: invalid answer {out.get('correct_options')!r}, skipped", flush=True)
                    continue
                picked, multi = parsed
                sol = out.get("solution_text", "").strip()
                conf = out.get("confidence", "")
                expl = f"AI 判斷信心：{conf}" if conf else None
                answer_label = "".join(f"({p})" for p in picked) + ("（複選）" if multi else "")
                conn.execute(
                    "UPDATE questions SET correct_option = ?, is_multi_select = ? WHERE id = ?",
                    (",".join(picked), int(multi), qid),
                )
                conn.execute(
                    """INSERT INTO solutions (question_id, solution_text, explanation,
                       source_type, verified_status) VALUES (?, ?, ?, 'ai_draft', 'ai_draft')""",
                    (qid, f"正確答案：{answer_label}\n{sol}", expl),
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
