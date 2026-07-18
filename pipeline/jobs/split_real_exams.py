# -*- coding: utf-8 -*-
"""Split OCR-transcribed real exams into individual questions and import to DB.

Scope: NCU 計算機概論 (code _02 → topic CS) and 資料結構 (_06 → topic DS).
Only papers whose every page is transcribed are processed.

Method: llama-3.3-70b returns question BOUNDARIES only (number/type/points/
verbatim start_text + optional shared case stems); Python slices the transcript
verbatim between boundaries, parses MC options, then a second small LLM call
tags each question with 1-3 concepts from the existing vocabulary.

Idempotent per paper: rows for (school='NCU', exam_year, topic) are replaced.
"""
import json
import re
import sqlite3
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import fitz  # pymupdf

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / "data" / "questions.db"
MODEL = "llama-3.3-70b-versatile"
SUBJECTS = {"02": ("CS", "計算機概論"), "06": ("DS", "資料結構")}

HEADER_PAT = re.compile(
    r"(學年度碩士班考試入學試題|所\s*別|系所|共\s*\$?\d*\$?\s*頁|第\s*\$?\d+\$?\s*頁"
    r"|科目\s*[:：]|本科考試禁用計算器|注意：背面有試題|請在答案卡上作答|試題卷須繳回)"
)

SPLIT_PROMPT = """你會拿到一份台灣研究所考卷的逐字轉錄全文。找出每一道題目的邊界，只輸出 JSON（無 markdown）：
{"stems": [{"start_text": "題組共用情境文字的開頭15字(逐字)", "applies_to": ["1","2"]}],
 "questions": [{"number": "1", "type": "multiple_choice|essay|short_answer|calculation", "points": 2, "start_text": "該題文字的開頭15字(逐字，含題號)"}]}

規則：
- start_text 必須逐字複製轉錄文中的文字（含題號、標點、空格），我會用它做字串定位，改寫一個字都會失敗。
- 一道題含其所有子題(a)(b)(c)算一題。
- 有共用情境的題組，情境文字放 stems，applies_to 列出使用它的題號。
- points 不明時填 null。type 判斷：有 (A)(B)(C)(D) 選項的是 multiple_choice。"""

TAG_PROMPT = """從這份詞彙表中為每道題目選 1-3 個最合適的知識點標籤，只輸出 JSON（無 markdown）：
{"tags": [{"number": "題號", "concepts": ["標籤1", "標籤2"]}]}
詞彙表（只能用這些，不可自創）：
%s"""


def api_key() -> str:
    env = ROOT / "apps" / "web" / ".env.local"
    for line in env.read_text(encoding="utf-8").splitlines():
        if line.startswith("GROQ_API_KEY="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("GROQ_API_KEY not found")


def llm(key: str, system: str, user: str, max_tokens: int = 4000) -> dict:
    body = {
        "model": MODEL,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "response_format": {"type": "json_object"},
        "temperature": 0,
        "max_tokens": max_tokens,
    }
    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json",
                 "User-Agent": "mis-grad-exam-coach/1.0"},
    )
    for attempt in range(8):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                data = json.load(r)
            return json.loads(data["choices"][0]["message"]["content"])
        except urllib.error.HTTPError as e:
            if e.code in (413, 429, 500, 502, 503):
                wait = min(int(e.headers.get("retry-after") or 2 ** (attempt + 2)) + 5, 900)
                print(f"    HTTP {e.code}, retry in {wait}s", flush=True)
                time.sleep(wait)
                continue
            raise
    raise RuntimeError("llm failed after retries")


def norm(s: str) -> str:
    return re.sub(r"\s+", "", s)


def locate(haystack_norm: str, needle: str, from_pos: int = 0) -> int:
    """Position of needle in normalized haystack, or -1."""
    n = norm(needle)
    if not n:
        return -1
    return haystack_norm.find(n, from_pos)


def build_norm_map(text: str):
    """Map normalized-string indices back to original text indices."""
    idx = []
    for i, ch in enumerate(text):
        if not ch.isspace():
            idx.append(i)
    return idx


def clean_pages(d: Path) -> str:
    pages = []
    for f in sorted(d.glob("page_*.txt")):
        lines = f.read_text(encoding="utf-8").splitlines()
        # strip header/footer boilerplate lines near page boundaries
        kept = [l for j, l in enumerate(lines)
                if not (HEADER_PAT.search(l) and (j < 6 or j > len(lines) - 4))]
        pages.append("\n".join(kept).strip())
    return "\n".join(pages)


def parse_mc_options(body: str):
    """Extract (A)-(E) options; return (question_text_without_options, options list)."""
    m = re.search(r"[\(（]A[\)）]", body)
    if not m:
        return body.strip(), None
    head = body[: m.start()].strip()
    tail = body[m.start():]
    parts = re.split(r"[\(（]([A-E])[\)）]", tail)
    opts = []
    for i in range(1, len(parts) - 1, 2):
        opts.append(parts[i + 1].strip().rstrip("。").strip())
    if len(opts) < 2:
        return body.strip(), None
    return head, opts


def process_paper(key: str, conn: sqlite3.Connection, vocab: list[str],
                  stem_dir: Path, year: int, topic: str, subj_name: str) -> int:
    text = clean_pages(stem_dir)
    boundaries = llm(key, SPLIT_PROMPT, text, max_tokens=3500)
    qs = boundaries.get("questions", [])
    stems = boundaries.get("stems", [])
    if not qs:
        print("    no questions found, skipping", flush=True)
        return 0

    hay_norm = norm(text)
    pos_map = build_norm_map(text)

    # locate stems
    stem_for = {}
    stem_bodies = {}
    for s in stems:
        p = locate(hay_norm, s.get("start_text", ""))
        if p >= 0:
            stem_bodies[s["start_text"]] = p
            for qn in s.get("applies_to", []):
                stem_for[str(qn)] = s["start_text"]

    # locate all question starts (in order)
    located = []
    search_from = 0
    for q in qs:
        p = locate(hay_norm, q.get("start_text", ""), search_from)
        if p < 0:
            p = locate(hay_norm, q.get("start_text", ""))  # fallback: global
        if p < 0:
            print(f"    WARN: cannot locate q{q.get('number')} ({q.get('start_text','')[:20]})", flush=True)
            continue
        located.append((p, q))
        search_from = p + 1
    located.sort(key=lambda t: t[0])

    # slice bodies
    rows = []
    for i, (p, q) in enumerate(located):
        end_norm = located[i + 1][0] if i + 1 < len(located) else len(hay_norm)
        start_orig = pos_map[p]
        end_orig = pos_map[end_norm - 1] + 1 if end_norm - 1 < len(pos_map) else len(text)
        body = text[start_orig:end_orig].strip()
        body = re.sub(r"^\s*\d+[\.、]\s*", "", body)  # drop leading question number
        qtext, options = parse_mc_options(body)
        qtype = q.get("type") or ("multiple_choice" if options else "essay")
        if options and qtype != "multiple_choice":
            qtype = "multiple_choice"
        stem_key = stem_for.get(str(q.get("number")))
        if stem_key:
            # prepend a trimmed version of the shared case stem
            sp = stem_bodies.get(stem_key)
            if sp is not None:
                sp_orig = pos_map[sp]
                stem_end = min((pp for pp, _ in located if pp > sp), default=len(hay_norm))
                stem_text = text[sp_orig: pos_map[stem_end - 1] + 1].strip()
                qtext = f"【題組情境】{stem_text}\n\n【第 {q.get('number')} 題】{qtext}"
        rows.append((q.get("number"), qtext, qtype, q.get("points"), options))

    # concept tagging (batch, question head only)
    heads = [{"number": r[0], "text": r[1][:180]} for r in rows]
    tags = {}
    try:
        tagged = llm(key, TAG_PROMPT % "、".join(vocab),
                     json.dumps(heads, ensure_ascii=False), max_tokens=2500)
        for t in tagged.get("tags", []):
            cs = [c for c in t.get("concepts", []) if c in vocab][:3]
            if cs:
                tags[str(t.get("number"))] = cs
    except Exception as e:
        print(f"    WARN concept tagging failed: {e}", flush=True)

    cur = conn.cursor()
    cur.execute("DELETE FROM questions WHERE school='NCU' AND exam_year=? AND topic=?", (year, topic))
    n = 0
    for number, qtext, qtype, points, options in rows:
        if len(norm(qtext)) < 8:
            continue
        concepts = tags.get(str(number))
        cur.execute(
            """INSERT INTO questions
               (school, department, year_label, exam_year, question_number, question_text,
                question_type, topic, subtopic, concepts, value_score, source_type,
                verified_status, options, correct_option)
               VALUES ('NCU', '資訊管理學系', ?, ?, ?, ?, ?, ?, ?, ?, 0.9, 'pdf_extracted',
                       'unverified', ?, NULL)""",
            (f"{year}學年度", year, str(number), qtext, qtype, topic,
             (concepts or [None])[0], json.dumps(concepts, ensure_ascii=False) if concepts else None,
             json.dumps(options, ensure_ascii=False) if options else None),
        )
        n += 1
    conn.commit()
    print(f"    imported {n} questions ({subj_name})", flush=True)
    return n


def main() -> None:
    key = api_key()
    conn = sqlite3.connect(DB)
    vocab = [r[0] for r in conn.execute(
        "SELECT DISTINCT j.value FROM questions q, json_each(q.concepts) j WHERE q.topic IN ('CS','DS')")]
    total = 0
    for d in sorted((ROOT / "data" / "ocr" / "ncu_central").iterdir()):
        m = re.match(r"MA02_(\d+)_(\d+)$", d.name)
        if not m or m.group(2) not in SUBJECTS:
            continue
        year, code = int(m.group(1)), m.group(2)
        pdf = ROOT / "data" / "downloads" / "ncu_central" / (d.name + ".pdf")
        if len(list(d.glob("page_*.txt"))) != len(fitz.open(pdf)):
            print(f"{d.name}: incomplete transcription, skipped", flush=True)
            continue
        topic, subj = SUBJECTS[code]
        print(f"{d.name}: {year} {subj}", flush=True)
        total += process_paper(key, conn, vocab, d, year, topic, subj)
        time.sleep(3)
    print(f"TOTAL imported: {total}")
    conn.close()


if __name__ == "__main__":
    sys.exit(main())
