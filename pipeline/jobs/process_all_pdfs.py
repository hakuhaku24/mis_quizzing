"""
Job: 批量處理所有下載的 PDF → SQLite
讀 data/ncku_asset_manifest.json + nccu_asset_manifest.json，
逐一抽文字 → 拆題 → 分類 → 打分 → 寫入 data/questions.db

Usage: python -m pipeline.jobs.process_all_pdfs
"""

import json
import re
import sys
from pathlib import Path

from pipeline.extract.pdf_text import extract_pdf
from pipeline.extract.split_questions import split_questions, quality_gate
from pipeline.classify.tag_question import classify_question
from pipeline.classify.score_value import score_question
from pipeline.db.sqlite_loader import init_db, insert_question, insert_solution, get_stats, DB_PATH

DATA_DIR = Path(__file__).parent.parent.parent / "data"

# NCKU subject name → topic code
NCKU_SUBJECT_MAP: dict[str, str] = {
    "管理資訊系統": "MIS",
    "資料結構":     "DS",
    "計算機概論":   "CS",
    "統計學":       "STAT",
    "考試科目":     "MIS",   # 綜合題冊 — 主要是MIS
}


def _subject_hint(subject_name: str, school: str) -> str:
    if school == "NCKU":
        return NCKU_SUBJECT_MAP.get(subject_name, "MIS")
    # NCCU PDFs are integrated; use keyword detection
    return ""


def process_pdf(asset: dict, conn) -> int:
    """Process one PDF asset. Returns number of questions inserted."""
    storage_path = asset.get("storage_path")
    if not storage_path or not Path(storage_path).exists():
        print(f"  [SKIP] no file: {storage_path}")
        return 0

    school   = asset.get("school", "")
    dept     = asset.get("department", "")
    year     = asset.get("exam_year", 115)
    year_lbl = asset.get("year_label", f"{year}學年度")
    subject  = asset.get("subject", "")
    hint     = _subject_hint(subject, school)

    path = Path(storage_path)
    print(f"  processing: {path.name} ({year_lbl} {subject})")

    # Extract
    try:
        result = extract_pdf(path)
    except Exception as e:
        print(f"    extraction error: {e}")
        return 0

    print(f"    chars={result.total_chars} strategy={result.strategy}")

    if result.total_chars < 100:
        print("    too few chars, likely scanned — skip")
        return 0

    # Split
    questions = split_questions(result.full_text)
    metrics = quality_gate(questions)
    print(f"    split: {metrics['question_count']} questions, conf={metrics['avg_confidence']}")

    if metrics["question_count"] == 0:
        return 0

    # Insert
    count = 0
    for i, q in enumerate(questions):
        cls = classify_question(q.question_text, subject_hint=hint or None)
        scoring = score_question(
            exam_year=year,
            topic=cls["topic"],
            extraction_confidence=q.confidence,
        )

        row = {
            "school":          school,
            "department":      dept,
            "year_label":      year_lbl,
            "exam_year":       year,
            "question_number": str(i + 1),
            "question_text":   q.question_text,
            "question_type":   "essay",
            "topic":           cls["topic"],
            "difficulty":      3,
            "value_score":     round(scoring["value_score"] / 100, 4),  # normalize 0-1
            "source_type":     "pdf_extracted",
            "extraction_confidence": q.confidence,
            "verified_status": "unverified",
            "source_page_start": q.source_page_start,
            "source_page_end":   q.source_page_end,
        }
        qid = insert_question(conn, row)

        # No solution for extracted questions (no answer key in PDF)
        _ = qid  # used below if we had solutions
        count += 1

    conn.commit()
    return count


def main():
    conn = init_db(DB_PATH)

    # Check if pdf_extracted rows already exist to avoid duplication
    existing = conn.execute(
        "SELECT COUNT(*) FROM questions WHERE source_type = 'pdf_extracted'"
    ).fetchone()[0]
    if existing > 0:
        print(f"Already have {existing} pdf_extracted questions. Delete questions.db to re-process.")
        stats = get_stats(conn)
        print(f"DB stats: {stats}")
        conn.close()
        return

    manifests = [
        DATA_DIR / "ncku_asset_manifest.json",
        DATA_DIR / "nccu_asset_manifest.json",
    ]

    total_inserted = 0
    for manifest_path in manifests:
        if not manifest_path.exists():
            print(f"[SKIP] manifest not found: {manifest_path}")
            continue
        with open(manifest_path, encoding="utf-8") as f:
            assets = json.load(f)

        print(f"\n=== Processing {manifest_path.name} ({len(assets)} assets) ===")
        for asset in assets:
            n = process_pdf(asset, conn)
            total_inserted += n
            print(f"    → {n} questions inserted")

    stats = get_stats(conn)
    conn.close()

    print(f"\nDone. Total pdf_extracted inserted: {total_inserted}")
    print(f"DB stats: {stats}")


if __name__ == "__main__":
    main()
