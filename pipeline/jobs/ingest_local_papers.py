# -*- coding: utf-8 -*-
"""Ingest scanned past-exam PDFs from a local folder into the question bank.

Adding a paper = adding one line to PAPERS. Every stage is resumable and
keeps its output under data/ocr/local_papers/<paper-id>/ (gitignored):

  ocr      page_NN.txt     vision OCR, figures transcribed as text structure
  split    split.json      questions with type / topic / multi-select /
                           needs-drawing / figure-missing flags + concepts
  solve    solve.json      AI draft solutions; MC keys need two models to agree
  publish  -> Supabase (source of truth) then mirrored into SQLite, same ids

Free sources only (CURRENT_STATUS.md 6.2.4): Gemini free-tier models are tried
in turn, plus Groq free for the MC cross-check. When everything free is
exhausted the job stops; re-run later to continue. It never uses a paid key.

Quality gates (a question is held back from publishing when it fails one):
  - its text must be found in the OCR transcript (no paraphrased questions)
  - figure_missing: it depends on a figure the transcript doesn't contain
  - it must have a solution

Usage:
  python -m pipeline.jobs.ingest_local_papers --stage ocr|split|solve|report|publish [--paper ID]
"""
import argparse
import base64
import json
import re
import sqlite3
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import fitz  # pymupdf

from pipeline.jobs.generate_draft_solutions import ESSAY_SYSTEM, MC_SYSTEM, parse_mc_answer, repair_json
from pipeline.jobs.fix_multi_select import groq, read_env

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / "data" / "questions.db"
SRC = ROOT.parent / "五大(臺清交成政)"
WORK = ROOT / "data" / "ocr" / "local_papers"

# id, file (relative to SRC), school code, school name, department, exam year, subject name, default topic
PAPERS = [
    ("ntu113_itintro", "臺灣大學/資管所/113/113_臺大_資訊科技概論.pdf", "NTU", "國立臺灣大學", "資訊管理學系", 113, "資訊科技概論", "CS"),
    ("ntu113_imintro", "臺灣大學/資管所/113/113_臺大_資訊管理導論.pdf", "NTU", "國立臺灣大學", "資訊管理學系", 113, "資訊管理導論", "MIS"),
    ("nccu113_cs_tech", "政治大學/資管所/113/113_政大_科技組_計算機概論.pdf", "NCCU", "國立政治大學", "資訊管理學系（科技組）", 113, "計算機概論", "CS"),
    ("nccu113_cs_mgmt", "政治大學/資管所/113/113_政大_管理組計算機概論.pdf", "NCCU", "國立政治大學", "資訊管理學系（管理組）", 113, "計算機概論", "CS"),
    ("nccu113_mis", "政治大學/資管所/113/113_政大_管理資訊系統.pdf", "NCCU", "國立政治大學", "資訊管理學系", 113, "管理資訊系統", "MIS"),
    ("nccu113_ds", "政治大學/資管所/113/113_政大_資料結構.pdf", "NCCU", "國立政治大學", "資訊管理學系", 113, "資料結構", "DS"),
    ("ncku113_mis", "成功大學/資管所/113/113_成大_管理資訊系統.pdf", "NCKU", "國立成功大學", "資訊管理研究所", 113, "管理資訊系統", "MIS"),
    ("ncku113_cs", "成功大學/資管所/113/113_成大_計算機概論.pdf", "NCKU", "國立成功大學", "資訊管理研究所", 113, "計算機概論", "CS"),
    ("ncku113_ds", "成功大學/資管所/113/113_成大_資料結構.pdf", "NCKU", "國立成功大學", "資訊管理研究所", 113, "資料結構", "DS"),
    ("nthu110_cs", "清華大學/資應所/110/110_清大_計算機概論.pdf", "NTHU", "國立清華大學", "資訊系統與應用研究所", 110, "計算機概論", "CS"),
    ("nycu115_itm", "陽明交大/交大考古/115計概.pdf", "NYCU", "國立陽明交通大學", "資訊管理研究所", 115, "資訊科技與管理", "CS"),
    # 2026-10-16: the remaining years (scope as in CURRENT_STATUS 6.2.7)
    ("ntu112_itintro", "臺灣大學/資管所/112/112_臺大_資訊科技概論.pdf", "NTU", "國立臺灣大學", "資訊管理學系", 112, "資訊科技概論", "CS"),
    ("ntu112_imintro", "臺灣大學/資管所/112/112_臺大_資訊管理導論.pdf", "NTU", "國立臺灣大學", "資訊管理學系", 112, "資訊管理導論", "MIS"),
    ("ntu111_itintro", "臺灣大學/資管所/111/111_臺大_資訊科技概論.pdf", "NTU", "國立臺灣大學", "資訊管理學系", 111, "資訊科技概論", "CS"),
    ("ntu111_imintro", "臺灣大學/資管所/111/111_臺大_資訊管理導論.pdf", "NTU", "國立臺灣大學", "資訊管理學系", 111, "資訊管理導論", "MIS"),
    ("ntu110_itintro", "臺灣大學/資管所/110/110_臺大_資訊科技概論.pdf", "NTU", "國立臺灣大學", "資訊管理學系", 110, "資訊科技概論", "CS"),
    ("ntu110_imintro", "臺灣大學/資管所/110/110_臺大_資訊管理導論.pdf", "NTU", "國立臺灣大學", "資訊管理學系", 110, "資訊管理導論", "MIS"),
    ("ntu109_itintro", "臺灣大學/資管所/109/109_臺大_資訊科技概論.pdf", "NTU", "國立臺灣大學", "資訊管理學系", 109, "資訊科技概論", "CS"),
    ("ntu109_imintro", "臺灣大學/資管所/109/109_臺大_資訊管理導論.pdf", "NTU", "國立臺灣大學", "資訊管理學系", 109, "資訊管理導論", "MIS"),
    ("ntu108_itintro", "臺灣大學/資管所/108/108_臺大_資訊科技概論.pdf", "NTU", "國立臺灣大學", "資訊管理學系", 108, "資訊科技概論", "CS"),
    ("ntu108_imintro", "臺灣大學/資管所/108/108_臺大_資訊管理導論.pdf", "NTU", "國立臺灣大學", "資訊管理學系", 108, "資訊管理導論", "MIS"),
    ("ntu107_itintro", "臺灣大學/資管所/107/107_臺大_資訊科技概論.pdf", "NTU", "國立臺灣大學", "資訊管理學系", 107, "資訊科技概論", "CS"),
    ("ntu107_imintro", "臺灣大學/資管所/107/107_臺大_資訊管理導論.pdf", "NTU", "國立臺灣大學", "資訊管理學系", 107, "資訊管理導論", "MIS"),
    ("ntu106_itintro", "臺灣大學/資管所/106/106_臺大_資訊科技概論.pdf", "NTU", "國立臺灣大學", "資訊管理學系", 106, "資訊科技概論", "CS"),
    ("ntu106_imintro", "臺灣大學/資管所/106/106_臺大_資訊管理導論.pdf", "NTU", "國立臺灣大學", "資訊管理學系", 106, "資訊管理導論", "MIS"),
    ("ntu105_itintro", "臺灣大學/資管所/105/105_臺大_資訊科技概論.pdf", "NTU", "國立臺灣大學", "資訊管理學系", 105, "資訊科技概論", "CS"),
    ("ntu105_imintro", "臺灣大學/資管所/105/105_臺大_資訊管理導論.pdf", "NTU", "國立臺灣大學", "資訊管理學系", 105, "資訊管理導論", "MIS"),
    ("ncku112_mis", "成功大學/資管所/112/112_成大_管理資訊系統.pdf", "NCKU", "國立成功大學", "資訊管理研究所", 112, "管理資訊系統", "MIS"),
    ("ncku112_cs", "成功大學/資管所/112/112_成大_計算機概論.pdf", "NCKU", "國立成功大學", "資訊管理研究所", 112, "計算機概論", "CS"),
    ("ncku112_ds", "成功大學/資管所/112/112_成大_資料結構.pdf", "NCKU", "國立成功大學", "資訊管理研究所", 112, "資料結構", "DS"),
    ("ncku111_mis", "成功大學/資管所/111/111_成大_管理資訊系統.pdf", "NCKU", "國立成功大學", "資訊管理研究所", 111, "管理資訊系統", "MIS"),
    ("ncku111_cs", "成功大學/資管所/111/111_成大_計算機概論.pdf", "NCKU", "國立成功大學", "資訊管理研究所", 111, "計算機概論", "CS"),
    ("ncku111_ds", "成功大學/資管所/111/111_成大_資料結構.pdf", "NCKU", "國立成功大學", "資訊管理研究所", 111, "資料結構", "DS"),
    ("ncku110_mis", "成功大學/資管所/110/110_成大_管理資訊系統.pdf", "NCKU", "國立成功大學", "資訊管理研究所", 110, "管理資訊系統", "MIS"),
    ("ncku110_cs", "成功大學/資管所/110/110_成大_計算機概論.pdf", "NCKU", "國立成功大學", "資訊管理研究所", 110, "計算機概論", "CS"),
    ("ncku110_ds", "成功大學/資管所/110/110_成大_資料結構.pdf", "NCKU", "國立成功大學", "資訊管理研究所", 110, "資料結構", "DS"),
    ("ncku109_mis", "成功大學/資管所/109/109_成大_管理資訊系統.pdf", "NCKU", "國立成功大學", "資訊管理研究所", 109, "管理資訊系統", "MIS"),
    ("ncku109_cs", "成功大學/資管所/109/109_成大_計算機概論.pdf", "NCKU", "國立成功大學", "資訊管理研究所", 109, "計算機概論", "CS"),
    ("ncku109_ds", "成功大學/資管所/109/109_成大_資料結構.pdf", "NCKU", "國立成功大學", "資訊管理研究所", 109, "資料結構", "DS"),
    ("ncku108_mis", "成功大學/資管所/108/108_成大_管理資訊系統.pdf", "NCKU", "國立成功大學", "資訊管理研究所", 108, "管理資訊系統", "MIS"),
    ("ncku108_cs", "成功大學/資管所/108/108_成大_計算機概論.pdf", "NCKU", "國立成功大學", "資訊管理研究所", 108, "計算機概論", "CS"),
    ("ncku108_ds", "成功大學/資管所/108/108_成大_資料結構.pdf", "NCKU", "國立成功大學", "資訊管理研究所", 108, "資料結構", "DS"),
    ("ncku107_mis", "成功大學/資管所/107/107_成大_管理資訊系統.pdf", "NCKU", "國立成功大學", "資訊管理研究所", 107, "管理資訊系統", "MIS"),
    ("ncku107_cs", "成功大學/資管所/107/107_成大_計算機概論.pdf", "NCKU", "國立成功大學", "資訊管理研究所", 107, "計算機概論", "CS"),
    ("ncku107_ds", "成功大學/資管所/107/107_成大_資結.pdf", "NCKU", "國立成功大學", "資訊管理研究所", 107, "資料結構", "DS"),
    ("ncku106_mis", "成功大學/資管所/106/106_成大_管理資訊系統.pdf", "NCKU", "國立成功大學", "資訊管理研究所", 106, "管理資訊系統", "MIS"),
    ("ncku106_cs", "成功大學/資管所/106/106_成大_計算機概論.pdf", "NCKU", "國立成功大學", "資訊管理研究所", 106, "計算機概論", "CS"),
    ("ncku106_ds", "成功大學/資管所/106/106_成大_資料結構.pdf", "NCKU", "國立成功大學", "資訊管理研究所", 106, "資料結構", "DS"),
    ("ncku105_mis", "成功大學/資管所/105/105_成大_管理資訊系統.pdf", "NCKU", "國立成功大學", "資訊管理研究所", 105, "管理資訊系統", "MIS"),
    ("ncku105_cs", "成功大學/資管所/105/105_成大_計算機概論.pdf", "NCKU", "國立成功大學", "資訊管理研究所", 105, "計算機概論", "CS"),
    ("ncku105_ds", "成功大學/資管所/105/105_成大_資料結構.pdf", "NCKU", "國立成功大學", "資訊管理研究所", 105, "資料結構", "DS"),
    ("nccu112_cs_tech", "政治大學/資管所/112/112_政大_科技組_計算機概論.pdf", "NCCU", "國立政治大學", "資訊管理學系（科技組）", 112, "計算機概論", "CS"),
    ("nccu112_cs_mgmt", "政治大學/資管所/112/112_政大_管理組_計算機概論.pdf", "NCCU", "國立政治大學", "資訊管理學系（管理組）", 112, "計算機概論", "CS"),
    ("nccu112_mis", "政治大學/資管所/112/112_政大_管理資訊系統.pdf", "NCCU", "國立政治大學", "資訊管理學系", 112, "管理資訊系統", "MIS"),
    ("nccu112_ds", "政治大學/資管所/112/112_政大_資料結構.pdf", "NCCU", "國立政治大學", "資訊管理學系", 112, "資料結構", "DS"),
    ("nccu111_cs_tech", "政治大學/資管所/111/111_政大_科技組_計算機概論.pdf", "NCCU", "國立政治大學", "資訊管理學系（科技組）", 111, "計算機概論", "CS"),
    ("nccu111_cs_mgmt", "政治大學/資管所/111/111_政大_管理組_計算機概論.pdf", "NCCU", "國立政治大學", "資訊管理學系（管理組）", 111, "計算機概論", "CS"),
    ("nccu111_mis", "政治大學/資管所/111/111_政大_管理資訊系統.pdf", "NCCU", "國立政治大學", "資訊管理學系", 111, "管理資訊系統", "MIS"),
    ("nccu111_ds", "政治大學/資管所/111/111_政大_資料結構.pdf", "NCCU", "國立政治大學", "資訊管理學系", 111, "資料結構", "DS"),
    ("nccu110_cs_tech", "政治大學/資管所/110/110_政大_科技組_計算機概論.pdf", "NCCU", "國立政治大學", "資訊管理學系（科技組）", 110, "計算機概論", "CS"),
    ("nccu110_cs_mgmt", "政治大學/資管所/110/110_政大_管理組_計算機概論.pdf", "NCCU", "國立政治大學", "資訊管理學系（管理組）", 110, "計算機概論", "CS"),
    ("nccu110_mis", "政治大學/資管所/110/110_政大_管理資訊系統.pdf", "NCCU", "國立政治大學", "資訊管理學系", 110, "管理資訊系統", "MIS"),
    ("nccu110_ds", "政治大學/資管所/110/110_政大_資料結構.pdf", "NCCU", "國立政治大學", "資訊管理學系", 110, "資料結構", "DS"),
    ("nccu109_cs_tech", "政治大學/資管所/109/109_政大_科技組_計算機概論.pdf", "NCCU", "國立政治大學", "資訊管理學系（科技組）", 109, "計算機概論", "CS"),
    ("nccu109_cs_mgmt", "政治大學/資管所/109/109_政大_管理組_計算機概論.pdf", "NCCU", "國立政治大學", "資訊管理學系（管理組）", 109, "計算機概論", "CS"),
    ("nccu109_mis", "政治大學/資管所/109/109_政大_管理資訊系統.pdf", "NCCU", "國立政治大學", "資訊管理學系", 109, "管理資訊系統", "MIS"),
    ("nccu109_ds", "政治大學/資管所/109/109_政大_資料結構.pdf", "NCCU", "國立政治大學", "資訊管理學系", 109, "資料結構", "DS"),
    ("nccu108_cs_tech", "政治大學/資管所/108/108_政大_科技組_計算機概論.pdf", "NCCU", "國立政治大學", "資訊管理學系（科技組）", 108, "計算機概論", "CS"),
    ("nccu108_cs_mgmt", "政治大學/資管所/108/108_政大_管理組_計算機概論.pdf", "NCCU", "國立政治大學", "資訊管理學系（管理組）", 108, "計算機概論", "CS"),
    ("nccu108_mis", "政治大學/資管所/108/108_政大_管理資訊系統.pdf", "NCCU", "國立政治大學", "資訊管理學系", 108, "管理資訊系統", "MIS"),
    ("nccu108_ds", "政治大學/資管所/108/108_政大_資料結構.pdf", "NCCU", "國立政治大學", "資訊管理學系", 108, "資料結構", "DS"),
    ("nccu107_cs_tech", "政治大學/資管所/107/107_政大_科技組_計算機概論.pdf", "NCCU", "國立政治大學", "資訊管理學系（科技組）", 107, "計算機概論", "CS"),
    ("nccu107_cs_mgmt", "政治大學/資管所/107/107_政大_管理組_計算機概論.pdf", "NCCU", "國立政治大學", "資訊管理學系（管理組）", 107, "計算機概論", "CS"),
    ("nccu107_mis", "政治大學/資管所/107/107_政大_管理資訊系統.pdf", "NCCU", "國立政治大學", "資訊管理學系", 107, "管理資訊系統", "MIS"),
    ("nccu107_ds", "政治大學/資管所/107/107_政大_資料結構.pdf", "NCCU", "國立政治大學", "資訊管理學系", 107, "資料結構", "DS"),
    ("nccu106_cs_tech", "政治大學/資管所/106/106_政大_科技組_計算機概論.pdf", "NCCU", "國立政治大學", "資訊管理學系（科技組）", 106, "計算機概論", "CS"),
    ("nccu106_cs_mgmt", "政治大學/資管所/106/106_政大_管理組_計算機概論.pdf", "NCCU", "國立政治大學", "資訊管理學系（管理組）", 106, "計算機概論", "CS"),
    ("nccu106_mis", "政治大學/資管所/106/106_政大_管理資訊系統.pdf", "NCCU", "國立政治大學", "資訊管理學系", 106, "管理資訊系統", "MIS"),
    ("nccu106_ds", "政治大學/資管所/106/106_政大_資料結構.pdf", "NCCU", "國立政治大學", "資訊管理學系", 106, "資料結構", "DS"),
    ("nccu105_cs", "政治大學/資管所/105/105_政大_計算機概論.pdf", "NCCU", "國立政治大學", "資訊管理學系", 105, "計算機概論", "CS"),
    ("nccu105_mis", "政治大學/資管所/105/105_政大_管理資訊系統.pdf", "NCCU", "國立政治大學", "資訊管理學系", 105, "管理資訊系統", "MIS"),
    ("nccu105_ds", "政治大學/資管所/105/105_政大_資料結構.pdf", "NCCU", "國立政治大學", "資訊管理學系", 105, "資料結構", "DS"),
    ("nthu109_cs", "清華大學/資應所/109/109_清大_計算機概論.pdf", "NTHU", "國立清華大學", "資訊系統與應用研究所", 109, "計算機概論", "CS"),
    ("nthu108_cs", "清華大學/資應所/108/108_清大_計算機概論.pdf", "NTHU", "國立清華大學", "資訊系統與應用研究所", 108, "計算機概論", "CS"),
    ("nthu107_cs", "清華大學/資應所/107/107_清大_計算機概論.pdf", "NTHU", "國立清華大學", "資訊系統與應用研究所", 107, "計算機概論", "CS"),
    ("nthu106_cs", "清華大學/資應所/106/106_清大_計算機概論.pdf", "NTHU", "國立清華大學", "資訊系統與應用研究所", 106, "計算機概論", "CS"),
    ("nthu105_cs", "清華大學/資應所/105/105_清大_計算機概論.pdf", "NTHU", "國立清華大學", "資訊系統與應用研究所", 105, "計算機概論", "CS"),
    ("nycu114_itm", "陽明交大/交大考古/114計概.pdf", "NYCU", "國立陽明交通大學", "資訊管理研究所", 114, "資訊科技與管理", "CS"),
    ("nycu113_itm", "陽明交大/交大考古/交大113考古題.pdf", "NYCU", "國立陽明交通大學", "資訊管理研究所", 113, "資訊科技與管理", "CS"),
    ("nycu109_mis", "陽明交大/交大考古/交大資管MIS109.pdf", "NYCU", "國立陽明交通大學", "資訊管理研究所（乙組）", 109, "管理資訊系統", "MIS"),
    ("nycu102_cs_a", "陽明交大/資管所/102/102_交大_甲組_計算機概論(1).pdf", "NYCU", "國立陽明交通大學", "資訊管理研究所（甲組）", 102, "計算機概論", "CS"),
    ("nycu102_cs_b", "陽明交大/資管所/102/102_交大_甲組_計算機概論.pdf", "NYCU", "國立陽明交通大學", "資訊管理研究所（乙組）", 102, "計算機概論", "CS"),
    ("nycu102_mis", "陽明交大/資管所/102/102_交大_管理資訊系統.pdf", "NYCU", "國立陽明交通大學", "資訊管理研究所", 102, "管理資訊系統", "MIS"),
    ("nycu102_dsnet", "陽明交大/資管所/102/102_交大_資料結構與網際網路概論.pdf", "NYCU", "國立陽明交通大學", "資訊管理研究所", 102, "資料結構與網際網路概論", "DS"),
]
# The first 11 papers were published (and hand-checked) before the check stage existed.
CHECKED_PAPERS = PAPERS[11:]

# Free-tier Gemini models, each with its own daily quota on the same project.
# Ordered fastest-first (2026-10-15 timing: 3-flash-preview ~5s/page, 3.1-flash-lite ~4s;
# 3.6-flash and 2.5-flash were returning 503 "high demand" after ~55s).
VISION_MODELS = ["gemini-3-flash-preview", "gemini-3.1-flash-lite", "gemini-3.6-flash", "gemini-2.5-flash"]
TEXT_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3-flash-preview", "gemini-3.6-flash"]
TARGET_WIDTH_PX = 1600

OCR_PROMPT = (
    "這是台灣研究所入學考試考卷的掃描頁（可能是手機拍攝）。請逐字轉錄頁面上的所有文字，繁體中文與英文照原文抄錄，"
    "保留題號、配分、段落結構，以及大題說明（例如「單選」「複選」「答錯倒扣」「全對才給分」要完整保留）。"
    "數學式用 LaTeX，以 $...$ 包住；程式碼用 ``` 程式碼區塊。"
    "題目中的圖不可以只寫「圖略」：樹請寫出完整結構（例如逐層列出：第1層 8；第2層 3, 10；並說明誰是誰的子節點），"
    "圖（graph）請列出所有節點與每一條邊及權重（例如 a-b:3, a-c:5），表格用 markdown 表格。"
    "真的無法用文字表達時，才以〔圖：盡量詳細的描述〕代替。只輸出轉錄內容，不要任何評論或翻譯。"
)

SPLIT_SYSTEM = """你會拿到一份台灣資管所研究所考卷的逐字轉錄全文，請拆成一道道題目，只輸出 JSON（無 markdown 圍欄）：
{"questions": [{
  "number": "題號字串",
  "topic": "CS|DS|MIS",
  "type": "multiple_choice|essay|short_answer|calculation",
  "multi_select": false,
  "points": 數字或 null,
  "text": "題目全文（逐字照抄，不含選項）",
  "options": ["選項A內容", "選項B內容"] 或 null,
  "needs_drawing": false,
  "figure_missing": false,
  "concepts": ["知識點"]
}]}

規則：
- text 必須逐字照抄轉錄文（數學式、程式碼也照抄），不可改寫、摘要或翻譯；我會檢查它是否出現在原文中。
- 一道題含其所有子題 (a)(b)(c) 或 (1)(2) 算一題，子題留在 text 裡。
- 只有真正的選擇題（有 (A)(B)(C)(D) 等選項讓考生選）才是 multiple_choice，options 依序放選項內容（不含 (A) 等標號）；申論題的 (a)(b) 子題不是選項。
- 注意大寫標號 (A)(B) 也常是子題：後面帶配分（例如「(A) (5%)」「(B) 10 分」），或內容是要考生作答的要求（說明、解釋、計算、寫出、畫出、比較、Explain、Compute、Write…），就是申論題的子題，整段留在 text，type 不是 multiple_choice。
- 考卷頁首頁尾的固定文字（例如「※本考試禁止使用計算器」「第 1 頁，共 3 頁」「背面尚有試題」）不要放進 text 或 options。
- multi_select：大題說明或題目寫明複選、「全對才給分」或 select all that apply 時為 true。
- 題組（多題共用一段情境）時，把情境原文放在每一題 text 的開頭，前面加「【題組情境】」。
- needs_drawing：考生必須畫圖才能作答（畫樹、畫圖、畫 UML／流程圖等）時為 true。
- figure_missing：題目需要看一張圖才能作答，但轉錄文中只有「圖略」或沒有圖的內容（例如沒有列出樹的結構或圖的邊）時為 true。
- topic：計算機概論類（作業系統、網路、資料庫、計算機組織、軟體工程、資安、程式語言）為 CS；資料結構與演算法為 DS；管理資訊系統、資訊管理、電子商務、ERP/CRM/SCM、IT 治理、數位轉型等為 MIS。
- concepts：從下方詞彙表中選 1-3 個（必須和 topic 相符），詞彙表沒有合適的就給空陣列，不可自創。
- 不要輸出封面、注意事項、答案卷說明等非題目內容。"""


def gemini(key: str, model: str, parts: list, system: str | None = None, json_mode: bool = False,
           max_tokens: int = 8000, temperature: float = 0.0, low_thinking: bool = False) -> str:
    body = {"contents": [{"role": "user", "parts": parts}],
            "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens}}
    if low_thinking:  # transcription needs no reasoning; thinking only adds latency
        body["generationConfig"]["thinkingConfig"] = (
            {"thinkingBudget": 0} if model.startswith("gemini-2.5") else {"thinkingLevel": "low"})
    if system:
        body["system_instruction"] = {"parts": [{"text": system}]}
    if json_mode:
        body["generationConfig"]["responseMimeType"] = "application/json"
    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "User-Agent": "mis-grad-exam-coach/1.0"},
    )
    with urllib.request.urlopen(req, timeout=150) as r:
        data = json.load(r)
    cand = data["candidates"][0]
    parts_out = (cand.get("content") or {}).get("parts") or []
    text = "".join(p.get("text", "") for p in parts_out)
    if not text:
        if cand.get("finishReason") == "STOP":
            return ""  # the model saw nothing to output (e.g. a blank page)
        raise RuntimeError(f"no output: {cand.get('finishReason')}")
    return text


class FreeExhausted(Exception):
    """Every free model failed right now (out of quota, overloaded, or blocked)."""


OPENROUTER_VISION_MODELS = ["google/gemma-4-31b-it:free", "google/gemma-4-26b-a4b-it:free",
                            "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"]
OPENROUTER_VISION_MODEL = "openrouter-free-vision"


def openrouter_vision(or_key: str, prompt: str, img: bytes) -> str:
    """Last-resort OCR: open models have no RECITATION filter. Uses the
    OpenRouter free allowance (50 requests/day without credits); a busy
    upstream (429) just moves on to the next free vision model."""
    last = None
    for model in OPENROUTER_VISION_MODELS:
        body = {"model": model, "temperature": 0.1, "messages": [{"role": "user", "content": [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + base64.b64encode(img).decode()}},
        ]}]}
        req = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", data=json.dumps(body).encode(),
                                     headers={"Authorization": f"Bearer {or_key}", "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                data = json.load(r)
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as e:
            last = e
            continue
        # OpenRouter can answer 200 with an error object instead of choices
        # (daily free limit, busy upstream): count it as this model failing
        if "choices" not in data:
            last = RuntimeError(f"{model}: {str(data.get('error') or data)[:200]}")
            continue
        text = data["choices"][0]["message"].get("content") or ""
        if text.strip():
            return text
    raise RuntimeError(f"no OpenRouter vision model returned text ({last})")


def free_chain(key: str, models: list[str], call) -> tuple[str, str]:
    """Run call(model) on each free model until one succeeds; quota errors
    move on to the next model instead of waiting. Returns (text, model)."""
    errors = []
    for model in models:
        for attempt in range(3):
            try:
                return call(model), model
            except urllib.error.HTTPError as e:
                # 429 = this model's free quota is gone; 5xx = overloaded. Either way
                # another model is usually available right now, so don't wait here.
                errors.append(f"{model}:HTTP{e.code}")
                break
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                time.sleep(5 * (attempt + 1))
                errors.append(f"{model}:{e}")
            except RuntimeError as e:  # blocked (RECITATION etc.): same settings won't help, next model
                errors.append(f"{model}:{e}")
                break
    raise FreeExhausted("; ".join(errors[-6:]))


# ---------------------------------------------------------------- ocr
def stage_ocr(key: str, or_key: str, paper: tuple) -> None:
    pid, rel = paper[0], paper[1]
    out = WORK / pid
    out.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(SRC / rel)
    for i, page in enumerate(doc):
        f = out / f"page_{i + 1:02d}.txt"
        if f.exists() and f.stat().st_size > 0:
            continue
        scale = min(2.0, TARGET_WIDTH_PX / page.rect.width)
        img = page.get_pixmap(matrix=fitz.Matrix(scale, scale)).tobytes("jpeg")
        parts = [{"text": OCR_PROMPT},
                 {"inline_data": {"mime_type": "image/jpeg", "data": base64.b64encode(img).decode()}}]
        try:
            text, model = free_chain(key, VISION_MODELS, lambda m: gemini(key, m, parts, max_tokens=6000, temperature=0.2,
                                                                          low_thinking=True))
        except FreeExhausted as e:
            if "RECITATION" not in str(e):
                raise
            # Gemini refuses verbatim text it has seen online; warmer sampling
            # usually gets through, otherwise fall back to an open model.
            try:
                text, model = free_chain(key, VISION_MODELS[:2], lambda m: gemini(key, m, parts, max_tokens=6000,
                                                                                  temperature=0.9, low_thinking=True))
            except FreeExhausted:
                try:
                    text, model = openrouter_vision(or_key, OCR_PROMPT, img), OPENROUTER_VISION_MODEL
                except RuntimeError as e:
                    # leave the page missing: split waits for a complete transcript,
                    # and the next run retries just this page
                    print(f"  {pid} page {i + 1}/{len(doc)} SKIPPED (RECITATION, {e})", flush=True)
                    continue
        f.write_text(text or "（本頁無文字）", encoding="utf-8")
        print(f"  {pid} page {i + 1}/{len(doc)} ok via {model} ({len(text)} chars)", flush=True)
        time.sleep(4)


def transcript(pid: str) -> str:
    return "\n\n".join(f.read_text(encoding="utf-8") for f in sorted((WORK / pid).glob("page_*.txt")))


# ---------------------------------------------------------------- split
# The split model under-flags needs_drawing, so keyword evidence also counts.
# "illustrate" alone is excluded: it usually means "explain with an example".
DRAW_RE = re.compile(
    r"\b(re)?draw\b|\bsketch\b|illustrate (the|a|an|its|your) [^.。\n]{0,30}(tree|graph|diagram|heap|list)"
    r"|\b(build|construct|show)\b[^.。\n]{0,80}\b(tree|heap|graph|diagram|b-tree|avl|spanning)"
    r"|(畫出|繪出|請畫|畫圖|繪製|作圖|建構|建立|圖示)[^。\n]{0,20}(樹|堆積|圖|鏈結串列|雜湊表|生成樹|結構)",
    re.I,
)


def needs_drawing(q: dict) -> bool:
    return bool(q.get("needs_drawing")) or bool(DRAW_RE.search(q.get("text") or ""))


def stage_reflag(paper: tuple) -> None:
    f = WORK / paper[0] / "split.json"
    if not f.exists():
        return
    data = json.loads(f.read_text(encoding="utf-8"))
    before = sum(1 for q in data["questions"] if q.get("needs_drawing"))
    for q in data["questions"]:
        q["needs_drawing"] = needs_drawing(q)
    after = sum(1 for q in data["questions"] if q["needs_drawing"])
    f.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"  {paper[0]}: needs_drawing {before} -> {after}")


def norm(s: str) -> str:
    return re.sub(r"[\s$\\{}`*_，,。.:：;；()（）\[\]「」'\"]", "", s or "").lower()


def found_in_transcript(text: str, hay_norm: str) -> float:
    """Share of the question's 6-char shingles that occur in the transcript."""
    n = norm(text)
    if len(n) < 6:
        return 1.0 if n and n in hay_norm else 0.0
    grams = [n[i:i + 6] for i in range(0, len(n) - 5, 3)]
    return sum(g in hay_norm for g in grams) / len(grams)


def vocabulary() -> dict[str, list[str]]:
    conn = sqlite3.connect(DB)
    vocab = {}
    for topic in ("CS", "DS", "MIS"):
        vocab[topic] = [r[0] for r in conn.execute(
            "SELECT DISTINCT j.value FROM questions q, json_each(q.concepts) j WHERE q.topic = ? ORDER BY 1", (topic,))]
    conn.close()
    return vocab


SUBPART_DEMAND = re.compile(
    r"^\s*([（(]?\s*\d+\s*(%|分|points?)\s*[)）]?|說明|解釋|試述|試|請|計算|寫出|畫出|列出|比較|為何|何謂|"
    r"explain|describe|write|draw|compute|calculate|find|show|give|list|discuss|define|what|why|how)", re.I)
SUBPART_POINTS = re.compile(r"[（(]\s*\d+\s*(%|分|points?)\s*[)）]", re.I)


def looks_like_subparts(options: list) -> bool:
    """MC 'options' that are really the (A)(B) sub-questions of an essay
    question: they carry points or ask the student to do something."""
    opts = [str(o or "") for o in options or []]
    hits = sum(1 for o in opts if SUBPART_DEMAND.search(o) or SUBPART_POINTS.search(o))
    return bool(opts) and hits * 2 >= len(opts)


def stage_split(key: str, paper: tuple, vocab: dict) -> None:
    pid, _rel, _code, school_name, _dept, year, subject, default_topic = paper
    out = WORK / pid / "split.json"
    if out.exists():
        return
    text = transcript(pid)
    pages_expected = len(fitz.open(SRC / paper[1]))
    if len(list((WORK / pid).glob("page_*.txt"))) != pages_expected:
        print(f"  {pid}: OCR incomplete, skip split", flush=True)
        return
    vocab_text = "\n".join(f"{t}: {'、'.join(v)}" for t, v in vocab.items())
    user = (f"考卷：{school_name} {year} 學年度 資管所 {subject}（預設科目 {default_topic}，但請逐題判斷 topic）\n"
            f"詞彙表：\n{vocab_text}\n\n=== 轉錄全文 ===\n{text}")
    def split_with(m: str) -> list:
        raw = gemini(key, m, [{"text": user}], system=SPLIT_SYSTEM, json_mode=True, max_tokens=32000)
        try:
            parsed = repair_json(raw)
        except json.JSONDecodeError as e:
            raise RuntimeError(f"unparsable JSON ({e})")  # free_chain moves on to the next model
        # some models return the bare array instead of {"questions": [...]}
        return parsed if isinstance(parsed, list) else parsed.get("questions", [])

    qs, model = free_chain(key, TEXT_MODELS, split_with)
    hay = norm(text)
    for i, q in enumerate(qs):
        # papers restart numbering per section, so the printed number isn't unique
        q["idx"] = str(i + 1)
        q["fidelity"] = round(found_in_transcript(q.get("text", ""), hay), 3)
        if q.get("topic") not in ("CS", "DS", "MIS"):
            q["topic"] = default_topic
        q["concepts"] = [c for c in (q.get("concepts") or []) if c in vocab.get(q["topic"], [])][:3]
        if q.get("type") == "multiple_choice" and not q.get("options"):
            q["type"] = "short_answer"  # no parsable options: don't pretend it's MC
        if q.get("type") == "multiple_choice" and looks_like_subparts(q["options"]):
            # a (A)(B) sub-question set read as options: put the parts back into the text
            q["text"] = q.get("text", "") + "\n" + "\n".join(f"({chr(65 + i)}) {o}" for i, o in enumerate(q["options"]))
            q["type"] = "essay"
        if q.get("type") != "multiple_choice":
            q["options"] = None
            q["multi_select"] = False
        q["needs_drawing"] = needs_drawing(q)
    out.write_text(json.dumps({"model": model, "questions": qs}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"  {pid}: {len(qs)} questions via {model}", flush=True)


# ---------------------------------------------------------------- solve
COMBO_OPTION = re.compile(r"^(敘述\s*)?[A-E](\s*[、,]?\s*[A-E])+$")


def is_combo(options: list) -> bool:
    """Statement-combination MC (stem lists statements A-E, options are sets
    like "AB", "BCD"), as in NCCU's 計算機概論: still single-select."""
    return bool(options) and all(COMBO_OPTION.match((o or "").replace("&", "").strip()) for o in options)


def combo_label(option: str) -> str:
    letters = re.findall(r"[A-E]", option.replace("敘述", ""))
    return "敘述 " + "、".join(letters)


GROQ_CROSS_CHECK = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]  # separate free quotas per model


def groq_call(groq_key: str, model: str, system: str, user: str) -> dict:
    body = {"model": model, "temperature": 0.2, "response_format": {"type": "json_object"},
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
    req = urllib.request.Request("https://api.groq.com/openai/v1/chat/completions", data=json.dumps(body).encode(),
                                 headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json",
                                          "User-Agent": "mis-grad-exam-coach/1.0"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return repair_json(json.load(r)["choices"][0]["message"]["content"])


def cross_check(gem_key: str, groq_key: str, primary_model: str, user: str) -> tuple[dict, str]:
    """Independent second answer for an MC question: Groq models first, then a
    Gemini model different from the one that produced the primary answer."""
    for m in GROQ_CROSS_CHECK:
        try:
            return groq_call(groq_key, m, MC_SYSTEM, user), m
        except Exception:
            continue  # out of free tokens / transient: next source
    others = [m for m in TEXT_MODELS if m != primary_model]
    return free_chain(gem_key, others, lambda mm: gemini_json(gem_key, mm, user, MC_SYSTEM, 8000))


def gemini_json(key: str, model: str, user: str, system: str, max_tokens: int):
    """One model call whose output must parse as JSON; a malformed reply counts
    as that model failing, so free_chain moves on to the next one."""
    raw = gemini(key, model, [{"text": user}], system=system, json_mode=True, max_tokens=max_tokens)
    try:
        return repair_json(raw)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"unparsable JSON ({e})")


def stage_solve(key: str, groq_key: str, paper: tuple) -> None:
    pid, _rel, _code, school_name, _dept, year, subject, _t = paper
    split_f, solve_f = WORK / pid / "split.json", WORK / pid / "solve.json"
    if not split_f.exists():
        return
    qs = json.loads(split_f.read_text(encoding="utf-8"))["questions"]
    done = json.loads(solve_f.read_text(encoding="utf-8")) if solve_f.exists() else {}
    for q in qs:
        num = q["idx"]
        if num in done or q.get("figure_missing"):
            continue
        head = f"【{year} 學年度 {school_name} 資管所 {subject}】\n{q['text']}"
        if q["type"] == "multiple_choice":
            letters = [chr(65 + i) for i in range(len(q["options"]))]
            hint = "\n\n（本題為複選題，請選出所有正確選項）" if q.get("multi_select") else ""
            if is_combo(q["options"]):
                hint += ("\n\n（注意：題幹中的 A)～E) 是「敘述」代號；選項 (A)～(E) 是敘述的組合。"
                         "本題為單選，請以選項代號回答，例如選項 (B)「敘述 B、C」就回答 B。）")
            user = head + "\n\n選項：\n" + "\n".join(f"({l}) {o}" for l, o in zip(letters, q["options"])) + hint
            g, gmodel = free_chain(key, TEXT_MODELS, lambda m: gemini_json(key, m, user, MC_SYSTEM, 8000))
            try:
                k, kmodel = cross_check(key, groq_key, gmodel, user)
            except FreeExhausted as e:  # no second opinion available: keep going, but no key
                print(f"    cross-check unavailable ({e})", flush=True)
                k, kmodel = {}, None
            gp, kp = parse_mc_answer(g, letters), parse_mc_answer(k, letters)
            agree = bool(gp and kp and gp[0] == kp[0])
            # single vs multi comes from the paper's own instructions (split stage), never the model's guess
            multi = bool(q.get("multi_select"))
            key_letters = gp[0] if agree else None
            label = ("".join(f"({p})" for p in key_letters) + ("（複選）" if multi else "")) if key_letters else None
            sol = g.get("solution_text", "").strip()
            done[num] = {
                "correct_option": ",".join(key_letters) if key_letters else None,
                "multi_select": multi,
                "solution_text": (f"正確答案：{label}\n{sol}" if label else
                                  "（兩個 AI 模型對本題答案判斷不一致，暫不提供標準答案，請對照下方分析自評）\n" + sol),
                "explanation": "AI 判斷（兩個不同 AI 模型答案一致）" if agree else "AI 草稿，答案未經交叉確認",
                "models": [gmodel, kmodel], "primary": gp and gp[0], "check": kp and kp[0],
            }
        else:
            out, model = free_chain(key, TEXT_MODELS, lambda m: gemini_json(key, m, head, ESSAY_SYSTEM, 12000))
            sol = (out.get("solution_text") or "").strip()
            if len(sol) < 30:
                print(f"    {pid} q{num}: solution too short, will retry next run", flush=True)
                continue
            done[num] = {"solution_text": sol, "explanation": out.get("explanation") or None, "models": [model]}
        solve_f.write_text(json.dumps(done, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"  {pid} #{num} (q{q.get('number')}) solved", flush=True)
        time.sleep(1)


# ---------------------------------------------------------------- check
# AI-written solutions to computable questions were wrong 5 times out of 13
# when checked by hand (CURRENT_STATUS 6.2.7), and grading uses the solution
# as the answer key. So every computable non-MC solution gets an independent
# review by a different model; ones judged wrong are held back from publishing.
COMPUTABLE = re.compile(
    r"走訪|traversal|DFS|BFS|排序|sort|最短路徑|shortest path|生成樹|spanning tree|Prim|Kruskal|Dijkstra|"
    r"雜湊|hash|heap|堆積|AVL|B-?tree|B\+?樹|二元搜尋樹|binary search tree|複雜度|complexity|Big-?O|"
    r"postfix|prefix|infix|後序|前序|中序|page fault|分頁|頁框|cache|快取|TLB|排程|scheduling|Gantt|"
    r"subnet|子網|補數|complement|浮點|floating|二進位|binary|十六進位|hexadecimal|正規化|normal form|"
    r"\bSQL\b|計算|compute|calculate|多少", re.I)

CHECK_SYSTEM = """你是嚴格的閱卷老師。你會拿到一道台灣資管所研究所考題和一份參考詳解。
請先自己獨立把題目算一遍（走訪順序、排序過程、最短路徑、生成樹、雜湊、複雜度、位址或數值計算等），再逐一比對參考詳解每一小題的最後答案與關鍵步驟。
只輸出 JSON（無 markdown 圍欄）：{"verdict": "correct|incorrect|unsure", "issues": "若為 incorrect：哪一小題、參考詳解寫了什麼、正確應該是什麼；其他情況給空字串"}
規則：只有在你有把握參考詳解的答案是錯的（不是寫法不同、多寫或少寫解釋）時才判 incorrect；題目資訊不足或你自己也不確定時判 unsure。"""


def is_computable(q: dict) -> bool:
    return q.get("type") != "multiple_choice" and (q.get("type") == "calculation" or bool(COMPUTABLE.search(q.get("text", ""))))


def stage_check(key: str, groq_key: str, paper: tuple) -> None:
    pid, _rel, _code, school_name, _dept, year, subject, _t = paper
    split_f, solve_f, check_f = WORK / pid / "split.json", WORK / pid / "solve.json", WORK / pid / "check.json"
    if not (split_f.exists() and solve_f.exists()):
        return
    qs = json.loads(split_f.read_text(encoding="utf-8"))["questions"]
    sols = json.loads(solve_f.read_text(encoding="utf-8"))
    checks = json.loads(check_f.read_text(encoding="utf-8")) if check_f.exists() else {}
    for q in qs:
        num = q["idx"]
        if num in checks or num not in sols or not is_computable(q):
            continue
        user = (f"【{year} 學年度 {school_name} 資管所 {subject}】\n題目：\n{q['text']}\n\n"
                f"參考詳解：\n{sols[num]['solution_text']}")
        solver = (sols[num].get("models") or [None])[0]
        verdict, vmodel = None, None
        for m in GROQ_CROSS_CHECK:  # a different provider from the Gemini solver first
            try:
                verdict, vmodel = groq_call(groq_key, m, CHECK_SYSTEM, user), m
                break
            except Exception:
                continue
        if verdict is None:
            others = [m for m in TEXT_MODELS if m != solver]
            verdict, vmodel = free_chain(key, others, lambda mm: gemini_json(key, mm, user, CHECK_SYSTEM, 12000))
        v = str(verdict.get("verdict", "unsure")).strip().lower()
        checks[num] = {"verdict": v if v in ("correct", "incorrect", "unsure") else "unsure",
                       "issues": str(verdict.get("issues") or "").strip(), "model": vmodel}
        check_f.write_text(json.dumps(checks, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"  {pid} #{num} (q{q.get('number')}) check: {checks[num]['verdict']}", flush=True)
        time.sleep(1)


# ---------------------------------------------------------------- report / publish
def plan(paper: tuple) -> tuple[list, list]:
    pid = paper[0]
    split_f, solve_f = WORK / pid / "split.json", WORK / pid / "solve.json"
    if not split_f.exists():
        return [], []
    qs = json.loads(split_f.read_text(encoding="utf-8"))["questions"]
    sols = json.loads(solve_f.read_text(encoding="utf-8")) if solve_f.exists() else {}
    check_f = WORK / pid / "check.json"
    checks = json.loads(check_f.read_text(encoding="utf-8")) if check_f.exists() else {}
    ready, held = [], []
    for q in qs:
        num = q["idx"]
        reason = None
        if q.get("figure_missing"):
            reason = "figure_missing"
        elif q.get("fidelity", 0) < 0.85:
            reason = f"text not found in transcript (fidelity {q.get('fidelity')})"
        elif num not in sols:
            reason = "no solution yet"
        elif paper in CHECKED_PAPERS and is_computable(q) and num not in checks:
            reason = "computable: not checked yet"
        elif checks.get(num, {}).get("verdict") == "incorrect":
            reason = f"check says solution is wrong ({checks[num]['model']}): {checks[num]['issues'][:160]}"
        (held if reason else ready).append((q, sols.get(num), reason))
    return ready, held


def stage_report(papers: list) -> None:
    tot_ready = tot_held = 0
    for p in papers:
        ready, held = plan(p)
        tot_ready += len(ready)
        tot_held += len(held)
        by_topic = {}
        for q, s, _ in ready:
            by_topic[q["topic"]] = by_topic.get(q["topic"], 0) + 1
        mc = [s for q, s, _ in ready if q["type"] == "multiple_choice"]
        print(f"{p[0]}: ready={len(ready)} {by_topic} | MC keyed={sum(1 for s in mc if s.get('correct_option'))}/{len(mc)}"
              f" | multi={sum(1 for q, _, _ in ready if q.get('multi_select'))}"
              f" | drawing={sum(1 for q, _, _ in ready if q.get('needs_drawing'))} | held={len(held)}")
        for q, _, reason in held:
            print(f"    held #{q['idx']} (q{q.get('number')}): {reason}")
    print(f"TOTAL ready={tot_ready} held={tot_held}")


def rest(env_root: dict, method: str, path: str, body=None, prefer="return=representation"):
    req = urllib.request.Request(
        f"{env_root['SUPABASE_URL']}/rest/v1/{path}",
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={"apikey": env_root["SUPABASE_SECRET_KEY"], "Authorization": f"Bearer {env_root['SUPABASE_SECRET_KEY']}",
                 "Content-Type": "application/json", "Prefer": prefer},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read()
        return json.loads(raw) if raw else None


SECTION_HEADER = re.compile(r"^\s*([一二三四五六七八九十]+、[^\n]*(題|分)[^\n]*|※[^\n]*)\n+")
LEADING_NUMBER = re.compile(r"^\s*\d+\s*[.、]\s*(\[\s*\]\s*)?")


# Page header/footer lines that OCR glues onto a question or option. Lines
# that are never exam content go wherever they appear; looser ones (科目：…,
# the 碩士班 組別 line) only as part of a trailing header block.
FURNITURE_LINE = re.compile(
    r"^\s*[※*]?\s*(?:"
    r"本(?:科)?考?考試(?:禁止|禁|不可|不得)(?:使)?用計算[器機].*"
    r"|請在答案卷.*作答.*"
    r"|(?:(?:註|注意)\s*[:：]?\s*)?[（(]?背面(?:尚|仍|還)?有試題.*"
    r"|第\s*\d+\s*頁\s*[，,]?\s*共\s*\d+\s*頁.*"
    r"|【\s*不可使用計算機\s*】.*"
    r"|[（(]?請翻(?:頁|面).*"
    r")\s*$")
HEADER_LINE = re.compile(r"^\s*(?:科目\s*[:：].*|.*碩士班.*(?:組|生).*)\s*$")


def strip_page_furniture(text: str) -> str:
    lines = [ln for ln in text.split("\n") if not FURNITURE_LINE.match(ln)]
    while lines and (not lines[-1].strip() or HEADER_LINE.match(lines[-1])):
        lines.pop()
    return "\n".join(lines).strip()


def clean_text(text: str) -> str:
    """Drop exam-paper furniture the student doesn't need: leading section
    headers ("二、問答題，共 40 分。", "※ 本大題請於…"), page header/footer
    lines ("※本考試禁止使用計算器") and the printed number / answer box
    ("8. [    ]") — the number is stored in question_number."""
    prev = None
    while prev != text:
        prev = text
        text = SECTION_HEADER.sub("", text, count=1)
    return strip_page_furniture(LEADING_NUMBER.sub("", text, count=1))


def stage_publish(env_root: dict, papers: list) -> None:
    conn = sqlite3.connect(DB)
    for p in papers:
        pid, _rel, code, _sname, dept, year, subject, _t = p
        ready, held = plan(p)
        if not ready:
            continue
        label = f"{year}學年度 {subject}"
        # idempotent per paper: replace rows previously published for it
        # a paper = school + year + subject + department: NCCU has two different
        # 計算機概論 papers (科技組 / 管理組) that differ only by department
        old = rest(env_root, "GET", f"questions?school=eq.{code}&exam_year=eq.{year}"
                                    f"&year_label=eq.{urllib.parse.quote(label)}"
                                    f"&department=eq.{urllib.parse.quote(dept)}&select=id")
        if old:
            ids = ",".join(str(o["id"]) for o in old)
            rest(env_root, "DELETE", f"questions?id=in.({ids})")  # solutions cascade
            conn.execute(f"DELETE FROM solutions WHERE question_id IN ({ids})")
            conn.execute(f"DELETE FROM questions WHERE id IN ({ids})")
        for q, s, _ in ready:
            mc = q["type"] == "multiple_choice"
            row = {
                "school": code, "department": dept, "year_label": label, "exam_year": year,
                "question_number": str(q.get("number")), "question_text": clean_text(q["text"]), "question_type": q["type"],
                "topic": q["topic"], "subtopic": (q.get("concepts") or [None])[0], "concepts": q.get("concepts") or None,
                "value_score": 0.9, "source_type": "pdf_extracted", "verified_status": "unverified",
                "extraction_confidence": q.get("fidelity"),
                "options": [strip_page_furniture(str(o)) for o in q["options"]] if mc else None,
                "correct_option": s.get("correct_option") if mc else None,
                "is_multi_select": bool(mc and s.get("multi_select")),
                "needs_drawing": bool(q.get("needs_drawing")),
            }
            new = rest(env_root, "POST", "questions", row)[0]
            sol = {"question_id": new["id"], "solution_text": s["solution_text"], "explanation": s.get("explanation"),
                   "source_type": "ai_draft", "verified_status": "ai_draft"}
            new_sol = rest(env_root, "POST", "solutions", sol)[0]
            conn.execute(
                """INSERT INTO questions (id, school, department, year_label, exam_year, question_number, question_text,
                   question_type, topic, subtopic, concepts, value_score, source_type, verified_status,
                   extraction_confidence, options, correct_option, is_multi_select, needs_drawing)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (new["id"], code, dept, label, year, row["question_number"], row["question_text"], row["question_type"],
                 row["topic"], row["subtopic"], json.dumps(row["concepts"], ensure_ascii=False) if row["concepts"] else None,
                 0.9, "pdf_extracted", "unverified", row["extraction_confidence"],
                 json.dumps(row["options"], ensure_ascii=False) if row["options"] else None,
                 row["correct_option"], int(row["is_multi_select"]), int(row["needs_drawing"])),
            )
            conn.execute(
                """INSERT INTO solutions (id, question_id, solution_text, explanation, source_type, verified_status)
                   VALUES (?,?,?,?, 'ai_draft', 'ai_draft')""",
                (new_sol["id"], new["id"], s["solution_text"], s.get("explanation")),
            )
        conn.commit()
        print(f"  {pid}: published {len(ready)} (held {len(held)})", flush=True)
    conn.close()


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--stage", required=True, choices=["ocr", "split", "reflag", "solve", "check", "report", "publish"])
    ap.add_argument("--paper", default="")
    args = ap.parse_args()
    papers = [p for p in PAPERS if not args.paper or p[0] == args.paper]
    env_web = read_env(ROOT / "apps" / "web" / ".env.local")
    env_root = read_env(ROOT / ".env")
    key = env_web["GEMINI_API_KEY"]
    try:
        if args.stage == "ocr":
            for p in papers:
                stage_ocr(key, env_root["OPENROUTER_API_KEY"], p)
        elif args.stage == "split":
            vocab = vocabulary()
            for p in papers:
                stage_split(key, p, vocab)
        elif args.stage == "reflag":
            for p in papers:
                stage_reflag(p)
        elif args.stage == "solve":
            for p in papers:
                stage_solve(key, env_web["GROQ_API_KEY"], p)
        elif args.stage == "check":
            for p in papers:
                stage_check(key, env_web["GROQ_API_KEY"], p)
        elif args.stage == "report":
            stage_report(papers)
        elif args.stage == "publish":
            stage_publish(env_root, papers)
    except FreeExhausted as e:
        print(f"\nSTOPPED: no free model could handle this step right now ({e}). "
              f"Nothing paid was used. Re-run the same command later to continue.", flush=True)
        sys.exit(2)


if __name__ == "__main__":
    main()
