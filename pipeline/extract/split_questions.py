"""
題目拆分 — 多策略：
  A: 題號 regex (一、二、 / 1. / (1) / 第N題)
  B: 分數 pattern (10%) [10分] （10分）
  C: 科目特殊規則 (MIS 申論 / 資料結構)
  D: LLM validation (可選)
"""

import re
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class CandidateQuestion:
    question_number: str
    question_text: str
    source_page_start: Optional[int] = None
    source_page_end: Optional[int] = None
    split_strategy: str = ""
    confidence: float = 1.0
    raw_chunk: str = ""


# ── Regex patterns ──────────────────────────────────────────────────────────

_PATTERNS_A = [
    # 一、二、三 (Chinese numbering)
    re.compile(r"(?m)^(?P<num>[一二三四五六七八九十]+)[、．。]\s*"),
    # 1. or 1、
    re.compile(r"(?m)^(?P<num>\d{1,2})[\.、]\s+"),
    # (1) or （1）
    re.compile(r"(?m)^[（(](?P<num>\d{1,2})[）)]\s*"),
    # 第 N 題
    re.compile(r"(?m)^第\s*(?P<num>\d{1,2})\s*題[:：]?\s*"),
]

_PATTERN_SCORE = re.compile(
    r"[（(]\s*\d{1,2}\s*[%％分]\s*[）)]"
)

_ZH_NUMS = {"一":1,"二":2,"三":3,"四":4,"五":5,"六":6,"七":7,"八":8,"九":9,"十":10}


def _zh_to_int(s: str) -> int:
    return _ZH_NUMS.get(s, 0)


def strategy_a(text: str) -> list[CandidateQuestion]:
    """Split by question-number patterns."""
    best: list[tuple[int, str, str]] = []  # (start_pos, num_str, matched_text)

    for pat in _PATTERNS_A:
        matches = list(pat.finditer(text))
        if len(matches) >= 2:
            for m in matches:
                best.append((m.start(), m.group("num"), m.group(0)))
            break

    if not best:
        return []

    best.sort(key=lambda x: x[0])
    questions = []
    for i, (start, num_str, header) in enumerate(best):
        end = best[i + 1][0] if i + 1 < len(best) else len(text)
        body = text[start:end].strip()
        questions.append(CandidateQuestion(
            question_number=str(num_str),
            question_text=body,
            split_strategy="strategy_a",
            confidence=0.85,
            raw_chunk=body,
        ))
    return questions


def strategy_b(text: str) -> list[CandidateQuestion]:
    """Split by score markers as section boundaries."""
    lines = text.split("\n")
    sections: list[tuple[int, str]] = []
    for i, line in enumerate(lines):
        if _PATTERN_SCORE.search(line):
            sections.append((i, line.strip()))

    if len(sections) < 2:
        return []

    questions = []
    for i, (line_i, header) in enumerate(sections):
        end_line = sections[i + 1][0] if i + 1 < len(sections) else len(lines)
        body = "\n".join(lines[line_i:end_line]).strip()
        questions.append(CandidateQuestion(
            question_number=str(i + 1),
            question_text=body,
            split_strategy="strategy_b",
            confidence=0.70,
            raw_chunk=body,
        ))
    return questions


def split_questions(text: str) -> list[CandidateQuestion]:
    """Try strategies in order; return first that yields >= 2 questions."""
    for strategy in [strategy_a, strategy_b]:
        result = strategy(text)
        if len(result) >= 2:
            return result

    # Fallback: whole text as one question (manual review required)
    return [CandidateQuestion(
        question_number="1",
        question_text=text.strip(),
        split_strategy="fallback_whole",
        confidence=0.3,
        raw_chunk=text.strip(),
    )]


def quality_gate(questions: list[CandidateQuestion]) -> dict:
    """Return quality metrics for a split result."""
    q_count = len(questions)
    avg_len = sum(len(q.question_text) for q in questions) / max(q_count, 1)
    avg_conf = sum(q.confidence for q in questions) / max(q_count, 1)
    needs_review = (
        q_count == 0
        or avg_len < 20
        or avg_conf < 0.5
        or (q_count == 1 and questions[0].split_strategy == "fallback_whole")
    )
    return {
        "question_count": q_count,
        "avg_question_length": round(avg_len, 1),
        "avg_confidence": round(avg_conf, 2),
        "needs_manual_review": needs_review,
    }
