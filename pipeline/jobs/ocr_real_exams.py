# -*- coding: utf-8 -*-
"""Transcribe scanned real-exam PDFs with a vision LLM (Gemini 2.5 Flash).

Input : data/downloads/{ncu_central,nsysu}/*.pdf  (scanned images)
Output: data/ocr/{source}/{pdf-stem}/page_{nn}.txt (verbatim transcription)

Idempotent + resumable: pages with an existing non-empty .txt are skipped,
so the job can be re-run after rate limits or interruptions.

Usage:
  python -m pipeline.jobs.ocr_real_exams              # everything
  python -m pipeline.jobs.ocr_real_exams --limit 1    # first missing PDF only
  python -m pipeline.jobs.ocr_real_exams --file MA02_115_02.pdf
"""
import argparse
import base64
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import fitz  # pymupdf

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ["ncu_central", "nsysu"]
# Switched off Groq: qwen3.6-27b and llama-4-scout both got pulled mid-run
# (Groq rotates preview/free models). gemini-2.5-flash's free tier turned out
# to be 20 requests/DAY (not per-minute) and got exhausted fast — moved to
# gemini-3.5-flash, a fresh quota bucket with the same quality.
MODEL = "gemini-3.5-flash"
RENDER_SCALE = 1.4
PAGE_SLEEP = 7

PROMPT = (
    "這是台灣研究所入學考試考卷的掃描頁。請逐字轉錄頁面上的所有文字，繁體中文與英文照原文抄錄，"
    "保留題號、配分與段落結構。數學式與程式碼用純文字表示。"
    "若頁面含表頭（學年度、校系所、組別、科目名稱），放在第一行完整轉錄。"
    "圖表無法轉錄時以〔圖：簡述〕代替。只輸出轉錄內容，不要任何評論或翻譯。"
)


def api_key() -> str:
    env = ROOT / "apps" / "web" / ".env.local"
    for line in env.read_text(encoding="utf-8").splitlines():
        if line.startswith("GEMINI_API_KEY="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("GEMINI_API_KEY not found in apps/web/.env.local")


class BlockedPage(Exception):
    """Gemini declined the page (RECITATION/SAFETY) after all retries."""


def transcribe_page(key: str, img: bytes) -> str:
    recitation_retries = 0
    for attempt in range(10):
        # RECITATION triggers at temperature 0 when the page text closely
        # matches something in training data; nudging temperature up usually
        # gets past it without hurting verbatim transcription quality.
        temperature = min(0.4, recitation_retries * 0.2)
        body = {
            "contents": [{
                "parts": [
                    {"text": PROMPT},
                    {"inline_data": {"mime_type": "image/jpeg", "data": base64.b64encode(img).decode()}},
                ],
            }],
            "generationConfig": {"temperature": temperature, "maxOutputTokens": 3500},
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
                recitation_retries += 1
                if recitation_retries >= 3:
                    raise BlockedPage(reason)
                print(f"    blocked ({reason}), retry with temperature={temperature + 0.2}", flush=True)
                continue
            return candidate["content"]["parts"][0]["text"]
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
            continue
    raise RuntimeError("transcription failed after retries")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="max PDFs to process this run")
    ap.add_argument("--file", default="", help="process only this pdf filename")
    args = ap.parse_args()

    key = api_key()
    done_pdfs = 0
    for source in SOURCES:
        for pdf in sorted((ROOT / "data" / "downloads" / source).glob("*.pdf")):
            if args.file and pdf.name != args.file:
                continue
            outdir = ROOT / "data" / "ocr" / source / pdf.stem
            doc = fitz.open(pdf)
            missing = [i for i in range(len(doc))
                       if not (outdir / f"page_{i+1:02d}.txt").exists()
                       or (outdir / f"page_{i+1:02d}.txt").stat().st_size == 0]
            if not missing:
                doc.close()
                continue
            if args.limit and done_pdfs >= args.limit:
                doc.close()
                break
            outdir.mkdir(parents=True, exist_ok=True)
            print(f"{source}/{pdf.name}: {len(missing)}/{len(doc)} pages to do", flush=True)
            for i in missing:
                img = doc[i].get_pixmap(matrix=fitz.Matrix(RENDER_SCALE, RENDER_SCALE)).tobytes("jpeg")
                try:
                    text = transcribe_page(key, img)
                except BlockedPage as e:
                    print(f"    page {i+1}/{len(doc)} BLOCKED ({e}), skipped", flush=True)
                    time.sleep(PAGE_SLEEP)
                    continue
                (outdir / f"page_{i+1:02d}.txt").write_text(text, encoding="utf-8")
                print(f"    page {i+1}/{len(doc)} ok ({len(text)} chars)", flush=True)
                time.sleep(PAGE_SLEEP)
            doc.close()
            done_pdfs += 1
    print("done")


if __name__ == "__main__":
    sys.exit(main())
