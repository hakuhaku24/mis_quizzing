"""題目分類：依科目 keyword 初判，可選呼叫 Claude API 精分類。"""

import re
from typing import Optional

TAXONOMY = {
    "MIS": [
        "資訊系統", "ERP", "CRM", "SCM", "電子商務", "資訊安全", "SDLC",
        "系統開發", "IT governance", "雲端", "數位轉型", "big data", "BI",
        "競爭優勢", "管理資訊", "MIS", "決策支援", "DSS", "知識管理",
    ],
    "DS": [
        "array", "linked list", "stack", "queue", "tree", "heap", "hash",
        "graph", "dfs", "bfs", "sort", "search", "complexity", "O(n)",
        "binary", "recursion", "資料結構", "b-tree", "avl", "dijkstra",
    ],
    "CS": [
        "cpu", "memory", "os", "process", "thread", "deadlock", "network",
        "tcp", "udp", "http", "dns", "database", "sql", "軟體工程",
        "計算機", "number system", "binary", "gate", "flip-flop",
    ],
    "STAT": [
        "統計", "probability", "regression", "hypothesis", "confidence",
        "distribution", "normal", "t-test", "chi-square", "anova",
    ],
}

_COMPILED: dict[str, list[re.Pattern]] = {
    subj: [re.compile(kw, re.IGNORECASE) for kw in kws]
    for subj, kws in TAXONOMY.items()
}


def classify_by_keyword(text: str) -> tuple[str, float]:
    """Return (topic, confidence) using keyword matching."""
    scores: dict[str, int] = {}
    lower = text.lower()
    for subj, patterns in _COMPILED.items():
        scores[subj] = sum(1 for p in patterns if p.search(lower))

    best = max(scores, key=lambda k: scores[k])
    best_score = scores[best]
    total = sum(scores.values())

    if best_score == 0:
        return "unknown", 0.0

    confidence = best_score / max(total, 1)
    return best, round(min(confidence * 2, 1.0), 2)  # scale up slightly


def classify_question(text: str, subject_hint: Optional[str] = None) -> dict:
    """Classify a question text. subject_hint can bias the result."""
    topic, confidence = classify_by_keyword(text)

    # If subject_hint is provided and keyword match is weak, trust the hint
    if subject_hint and confidence < 0.4:
        topic = subject_hint
        confidence = 0.5

    return {
        "topic": topic,
        "confidence": confidence,
        "needs_review": confidence < 0.6,
    }
