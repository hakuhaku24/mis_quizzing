# -*- coding: utf-8 -*-
"""Transcribe scanned real-exam PDFs with a vision LLM (Groq llama-4-scout).

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
import urllib.request
from pathlib import Path

import fitz  # pymupdf

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ["ncu_central", "nsysu"]
# llama-4-scout vanished from the account mid-run (Groq rotates preview models);
# qwen3.6-27b takes images too and transcribes at the same quality.
MODEL = "qwen/qwen3.6-27b"
RENDER_SCALE = 2.0

PROMPT = (
    "這是台灣研究所入學考試考卷的掃描頁。請逐字轉錄頁面上的所有文字，繁體中文與英文照原文抄錄，"
    "保留題號、配分與段落結構。數學式與程式碼用純文字表示。"
    "若頁面含表頭（學年度、校系所、組別、科目名稱），放在第一行完整轉錄。"
    "圖表無法轉錄時以〔圖：簡述〕代替。只輸出轉錄內容，不要任何評論或翻譯。"
)


def api_key() -> str:
    env = ROOT / "apps" / "web" / ".env.local"
    for line in env.read_text(encoding="utf-8").splitlines():
        if line.startswith("GROQ_API_KEY="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("GROQ_API_KEY not found in apps/web/.env.local")


def transcribe_page(key: str, png: bytes) -> str:
    body = {
        "model": MODEL,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": PROMPT},
                {"type": "image_url", "image_url": {
                    "url": "data:image/png;base64," + base64.b64encode(png).decode()
                }},
            ],
        }],
        "temperature": 0,
        "max_tokens": 8192,
        "reasoning_format": "hidden",  # qwen3.6 is a reasoning model; drop <think>
    }
    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "User-Agent": "mis-grad-exam-coach/1.0",
        },
    )
    for attempt in range(10):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                data = json.load(r)
            return data["choices"][0]["message"]["content"]
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503):
                wait = int(e.headers.get("retry-after") or 2 ** (attempt + 2))
                wait = min(wait + 5, 900)  # honor retry-after fully (daily/TPM buckets)
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
                png = doc[i].get_pixmap(matrix=fitz.Matrix(RENDER_SCALE, RENDER_SCALE)).tobytes("png")
                text = transcribe_page(key, png)
                (outdir / f"page_{i+1:02d}.txt").write_text(text, encoding="utf-8")
                print(f"    page {i+1}/{len(doc)} ok ({len(text)} chars)", flush=True)
                time.sleep(1.5)  # stay under rate limits
            doc.close()
            done_pdfs += 1
    print("done")


if __name__ == "__main__":
    sys.exit(main())
