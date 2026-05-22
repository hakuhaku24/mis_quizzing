"""
Job: 處理 PDF → 抽文字 → 拆題 → 分類 → 打分數。
用法: python -m pipeline.jobs.process_asset --pdf data/downloads/ncku/ncku_115_0.pdf --subject MIS
"""

import argparse
import json
from pathlib import Path

from pipeline.extract.pdf_text import extract_pdf
from pipeline.extract.split_questions import split_questions, quality_gate
from pipeline.classify.tag_question import classify_question
from pipeline.classify.score_value import score_question


def process(pdf_path: str, subject_hint: str = "", exam_year: int = 115) -> dict:
    path = Path(pdf_path)
    print(f"Extracting: {path.name}")
    result = extract_pdf(path)
    print(f"  strategy={result.strategy}, chars={result.total_chars}, ocr_pages={result.ocr_page_count}")

    if result.needs_manual_review:
        print("  WARNING: needs manual review (low text quality)")

    questions = split_questions(result.full_text)
    metrics = quality_gate(questions)
    print(f"  split: {metrics}")

    output = []
    for q in questions:
        cls = classify_question(q.question_text, subject_hint=subject_hint or None)
        scoring = score_question(
            exam_year=exam_year,
            topic=cls["topic"],
            extraction_confidence=q.confidence,
        )
        output.append({
            "question_number": q.question_number,
            "question_text": q.question_text[:200] + "..." if len(q.question_text) > 200 else q.question_text,
            "topic": cls["topic"],
            "topic_confidence": cls["confidence"],
            "value_score": scoring["value_score"],
            "grade": scoring["grade"],
            "split_strategy": q.split_strategy,
            "split_confidence": q.confidence,
        })

    return {
        "pdf": str(path),
        "extraction": {"strategy": result.strategy, "total_chars": result.total_chars},
        "quality": metrics,
        "questions": output,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", required=True)
    parser.add_argument("--subject", default="")
    parser.add_argument("--year", type=int, default=115)
    args = parser.parse_args()

    result = process(args.pdf, args.subject, args.year)
    out_path = Path(args.pdf).with_suffix(".processed.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"\nOutput: {out_path}")


if __name__ == "__main__":
    main()
