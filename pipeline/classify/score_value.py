"""
題目價值評分。
公式 (spec §11.2)：
  value_score =
    frequency_score * 0.25 +
    target_school_relevance * 0.20 +
    core_concept_score * 0.15 +
    discrimination_score * 0.15 +
    extensibility_score * 0.10 +
    recency_score * 0.10 +
    extraction_quality_score * 0.05
"""

CURRENT_YEAR = 115  # 民國年

CORE_TOPICS = {
    "MIS": {"ERP", "資訊系統策略", "資安", "SDLC", "數位轉型", "CRM", "SCM"},
    "DS":  {"graph", "tree", "heap", "sort", "complexity"},
    "CS":  {"os", "network", "database", "cpu", "security"},
}


def recency_score(exam_year: int) -> float:
    diff = CURRENT_YEAR - exam_year
    if diff <= 2:   return 95.0
    if diff <= 5:   return 80.0
    if diff <= 10:  return 65.0
    return 40.0


def extraction_quality_score(confidence: float, ocr: bool = False) -> float:
    if not ocr and confidence >= 0.85: return 95.0
    if not ocr and confidence >= 0.70: return 80.0
    if ocr and confidence >= 0.80:     return 70.0
    if ocr and confidence >= 0.65:     return 55.0
    return 30.0


def core_concept_score(topic: str, subtopic: str = "") -> float:
    for subj, keywords in CORE_TOPICS.items():
        combined = f"{topic} {subtopic}".lower()
        if any(k.lower() in combined for k in keywords):
            return 85.0
    return 50.0


def score_question(
    exam_year: int,
    topic: str,
    subtopic: str = "",
    extraction_confidence: float = 0.8,
    is_ocr: bool = False,
    frequency: float = 60.0,
    school_relevance: float = 70.0,
    discrimination: float = 65.0,
    extensibility: float = 60.0,
) -> dict:
    r = recency_score(exam_year)
    eq = extraction_quality_score(extraction_confidence, is_ocr)
    cc = core_concept_score(topic, subtopic)

    raw = (
        frequency       * 0.25 +
        school_relevance * 0.20 +
        cc               * 0.15 +
        discrimination   * 0.15 +
        extensibility    * 0.10 +
        r                * 0.10 +
        eq               * 0.05
    )
    score = round(min(max(raw, 0), 100), 1)

    if score >= 85:   grade = "S"
    elif score >= 70: grade = "A"
    elif score >= 50: grade = "B"
    elif score >= 30: grade = "C"
    else:             grade = "D"

    return {
        "value_score": score,
        "grade": grade,
        "components": {
            "frequency":         frequency,
            "school_relevance":  school_relevance,
            "core_concept":      cc,
            "discrimination":    discrimination,
            "extensibility":     extensibility,
            "recency":           r,
            "extraction_quality": eq,
        },
    }
