# -*- coding: utf-8 -*-
"""Repair NCU questions whose figure was lost in the first OCR pass ("圖略").

The original papers are re-transcribed with ingest_local_papers.OCR_PROMPT
(which writes trees / graphs out as text), the missing figure is spliced into
the question text, and the solution is regenerated — the old one was written
without seeing the figure. Free models only.

Usage: python -m pipeline.jobs.refigure_questions --plan PLAN.json [--apply]
"""
import argparse
import base64
import json
import sqlite3
import sys
import urllib.request
from pathlib import Path

import fitz  # pymupdf

from pipeline.jobs.fix_multi_select import read_env
from pipeline.jobs.generate_draft_solutions import ESSAY_SYSTEM
from pipeline.jobs.ingest_local_papers import (
    OCR_PROMPT, OPENROUTER_VISION_MODEL, TARGET_WIDTH_PX, TEXT_MODELS, VISION_MODELS,
    FreeExhausted, free_chain, gemini, gemini_json, openrouter_vision,
)

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / "data" / "questions.db"
CACHE = ROOT / "data" / "ocr" / "refigure"
TARGETS = {254: "MA02_107_06", 256: "MA02_107_06", 285: "MA02_109_06", 286: "MA02_109_06",
           307: "MA02_110_06", 362: "MA02_113_06"}

MERGE_SYSTEM = """你會拿到一道考題「目前的文字」（其中的圖遺失了，只剩「圖略」或簡短描述，或完全沒有），以及整份考卷「重新轉錄的全文」（圖已經用文字寫出來）。
只輸出 JSON（無 markdown 圍欄）：{"question_text": "...", "figure_found": true}
- question_text：保留目前文字的原樣，只把缺圖的地方換成重新轉錄中「這一題」對應的圖的文字內容（樹的結構、圖的節點與邊及權重、表格等）。不要改寫其他文字。
- 重新轉錄裡也找不到這張圖的具體內容時，question_text 原樣輸出，figure_found 為 false。"""


def transcribe_paper(key: str, or_key: str, stem: str) -> str:
    out = CACHE / stem
    out.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(ROOT / "data" / "downloads" / "ncu_central" / f"{stem}.pdf")
    for i, page in enumerate(doc):
        f = out / f"page_{i + 1:02d}.txt"
        if f.exists() and f.stat().st_size > 0:
            continue
        scale = min(2.0, TARGET_WIDTH_PX / page.rect.width)
        img = page.get_pixmap(matrix=fitz.Matrix(scale, scale)).tobytes("jpeg")
        parts = [{"text": OCR_PROMPT}, {"inline_data": {"mime_type": "image/jpeg", "data": base64.b64encode(img).decode()}}]
        try:
            text, model = free_chain(key, VISION_MODELS, lambda m: gemini(key, m, parts, max_tokens=6000,
                                                                          temperature=0.2, low_thinking=True))
        except FreeExhausted as e:
            if "RECITATION" not in str(e):
                raise
            try:  # warmer sampling usually gets past RECITATION
                text, model = free_chain(key, VISION_MODELS[:2], lambda m: gemini(key, m, parts, max_tokens=6000,
                                                                                  temperature=0.9, low_thinking=True))
            except FreeExhausted:
                try:
                    text, model = openrouter_vision(or_key, OCR_PROMPT, img), OPENROUTER_VISION_MODEL
                except Exception as oe:  # OpenRouter free limit hit: leave this page for a later run
                    print(f"  {stem} page {i + 1}: no free model could read it now ({oe})", flush=True)
                    continue
        f.write_text(text, encoding="utf-8")
        print(f"  {stem} page {i + 1} via {model}", flush=True)
    return "\n\n".join(f.read_text(encoding="utf-8") for f in sorted(out.glob("page_*.txt")))


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--plan", required=True)
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--ids", default="", help="only these question ids (dry run)")
    args = ap.parse_args()
    env_web, env_root = read_env(ROOT / "apps" / "web" / ".env.local"), read_env(ROOT / ".env")
    key = env_web["GEMINI_API_KEY"]
    conn = sqlite3.connect(DB)

    if not args.apply:
        plan = []
        only = {int(x) for x in args.ids.split(",") if x}
        for qid, stem in TARGETS.items():
            if only and qid not in only:
                continue
            old, year = conn.execute("SELECT question_text, exam_year FROM questions WHERE id = ?", (qid,)).fetchone()
            try:
                full = transcribe_paper(key, env_root["OPENROUTER_API_KEY"], stem)
                user = f"=== 目前的文字 ===\n{old}\n\n=== 重新轉錄的全文 ===\n{full}"
                merged, _ = free_chain(key, TEXT_MODELS, lambda m: gemini_json(key, m, user, MERGE_SYSTEM, 6000))
                entry = {"id": qid, "old": old, "new": merged.get("question_text", old),
                         "figure_found": bool(merged.get("figure_found"))}
                if entry["figure_found"]:
                    head = f"【{year} 學年中央資管所 資料結構】\n{entry['new']}"
                    sol, _ = free_chain(key, TEXT_MODELS, lambda m: gemini_json(key, m, head, ESSAY_SYSTEM, 12000))
                    entry["solution_text"] = (sol.get("solution_text") or "").strip()
                    entry["explanation"] = sol.get("explanation") or None
            except FreeExhausted as e:
                entry = {"id": qid, "old": old, "new": old, "figure_found": False, "error": str(e)}
            plan.append(entry)
            print(f"q{qid}: figure_found={entry['figure_found']}\n  OLD: {old[:200]!r}\n  NEW: {entry['new'][:500]!r}\n", flush=True)
        Path(args.plan).write_text(json.dumps(plan, ensure_ascii=False, indent=1), encoding="utf-8")
        return

    plan = json.loads(Path(args.plan).read_text(encoding="utf-8"))
    hdr = {"apikey": env_root["SUPABASE_SECRET_KEY"], "Authorization": f"Bearer {env_root['SUPABASE_SECRET_KEY']}",
           "Content-Type": "application/json", "Prefer": "return=representation"}

    def patch(path: str, body: dict) -> int:
        req = urllib.request.Request(f"{env_root['SUPABASE_URL']}/rest/v1/{path}", data=json.dumps(body).encode(),
                                     method="PATCH", headers=hdr)
        with urllib.request.urlopen(req, timeout=60) as r:
            return len(json.load(r))

    for e in plan:
        if not e["figure_found"] or len(e.get("solution_text") or "") < 30:
            print(f"q{e['id']}: skipped (figure not recovered)")
            continue
        conn.execute("UPDATE questions SET question_text = ? WHERE id = ?", (e["new"], e["id"]))
        conn.execute("UPDATE solutions SET solution_text = ?, explanation = ? WHERE question_id = ?",
                     (e["solution_text"], e["explanation"], e["id"]))
        nq = patch(f"questions?id=eq.{e['id']}", {"question_text": e["new"]})
        ns = patch(f"solutions?question_id=eq.{e['id']}", {"solution_text": e["solution_text"], "explanation": e["explanation"]})
        if nq != 1 or ns != 1:
            raise RuntimeError(f"q{e['id']}: supabase rows questions={nq} solutions={ns}")
        conn.commit()
        print(f"q{e['id']}: updated")


if __name__ == "__main__":
    main()
