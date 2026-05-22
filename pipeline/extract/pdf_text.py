"""PDF 文字抽取 — PyMuPDF 優先，pdfplumber 備用，掃描圖片 fallback OCR。"""

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import fitz  # PyMuPDF
import pdfplumber

MIN_CHARS_PER_PAGE = 50  # 低於此值判斷為掃描頁


@dataclass
class PageText:
    page_num: int
    text: str
    char_count: int
    is_ocr: bool = False
    ocr_confidence: Optional[float] = None


@dataclass
class ExtractionResult:
    pages: list[PageText]
    full_text: str
    total_chars: int
    ocr_page_count: int
    avg_confidence: Optional[float]
    strategy: str  # "pymupdf" | "pdfplumber" | "ocr"
    needs_manual_review: bool = False


def extract_with_pymupdf(pdf_path: Path) -> list[PageText]:
    pages = []
    doc = fitz.open(str(pdf_path))
    for i, page in enumerate(doc):
        text = page.get_text("text")
        pages.append(PageText(page_num=i + 1, text=text, char_count=len(text.strip())))
    doc.close()
    return pages


def extract_with_pdfplumber(pdf_path: Path) -> list[PageText]:
    pages = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            pages.append(PageText(page_num=i + 1, text=text, char_count=len(text.strip())))
    return pages


def extract_pdf(pdf_path: Path) -> ExtractionResult:
    """Main entry: tries PyMuPDF, falls back to pdfplumber, marks scanned pages for OCR."""
    path = Path(pdf_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {path}")

    # Strategy 1: PyMuPDF
    pages = extract_with_pymupdf(path)
    total = sum(p.char_count for p in pages)

    if total < MIN_CHARS_PER_PAGE * len(pages):
        # Strategy 2: pdfplumber
        pages2 = extract_with_pdfplumber(path)
        total2 = sum(p.char_count for p in pages2)
        if total2 > total:
            pages = pages2
            total = total2
            strategy = "pdfplumber"
        else:
            strategy = "pymupdf_low"
    else:
        strategy = "pymupdf"

    # Identify scanned pages
    scanned = [p for p in pages if p.char_count < MIN_CHARS_PER_PAGE]
    needs_review = len(scanned) > len(pages) * 0.5

    full_text = "\n\n".join(p.text for p in pages if p.text.strip())

    return ExtractionResult(
        pages=pages,
        full_text=full_text,
        total_chars=total,
        ocr_page_count=len(scanned),
        avg_confidence=None,
        strategy=strategy,
        needs_manual_review=needs_review,
    )
