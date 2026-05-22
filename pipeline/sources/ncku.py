"""
NCKU 成功大學資訊管理研究所考古題 connector

列表頁：https://exam.lib.ncku.edu.tw/master_subject.php?department_code=BC08
PDF URL 規律：https://exam.lib.ncku.edu.tw/exam/BC08_{year}_{index}.pdf

科目 index 因年度而異，需先解析列表頁取得 mapping。
"""

import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import requests
from bs4 import BeautifulSoup

from pipeline.config import DOWNLOADS_DIR, REQUEST_DELAY_SECONDS
from pipeline.sources.base import ExamAsset, _session, download_pdf

LIST_URL = "https://exam.lib.ncku.edu.tw/master_subject.php?department_code=BC08"
PDF_BASE = "https://exam.lib.ncku.edu.tw/exam"
DEPT_CODE = "BC08"
SCHOOL = "NCKU"
DEPARTMENT = "資訊管理研究所"


def _parse_subject_index(img_src: str) -> Optional[int]:
    """Extract subject index from icon image src like 'icon_0.gif' → 0."""
    m = re.search(r"icon_(\d+)", img_src)
    return int(m.group(1)) if m else None


def discover_assets(session: Optional[requests.Session] = None) -> list[ExamAsset]:
    """Parse the NCKU listing page and return all discoverable exam assets."""
    s = session or _session()
    resp = s.get(LIST_URL, timeout=20)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "lxml")

    assets: list[ExamAsset] = []

    # The page groups by 學年度. Each group has an H3 heading like "115學年度"
    # followed by subject links/icons.
    current_year_label = ""
    current_year = 0

    for tag in soup.find_all(["h3", "a"]):
        if tag.name == "h3":
            text = tag.get_text(strip=True)
            m = re.search(r"(\d+)\s*學年度", text)
            if m:
                current_year_label = f"{m.group(1)}學年度"
                current_year = int(m.group(1))
            continue

        if tag.name == "a" and current_year_label:
            href = tag.get("href", "")
            # href looks like: exam/BC08_115_0.pdf
            pdf_match = re.search(r"BC08_(\d+)_(\d+)\.pdf", href)
            if not pdf_match:
                continue

            year_from_href = int(pdf_match.group(1))
            idx = int(pdf_match.group(2))

            # Subject name is the link text or alt text
            subject_name = tag.get_text(strip=True)
            if not subject_name:
                img = tag.find("img")
                subject_name = img.get("alt", f"科目{idx}") if img else f"科目{idx}"

            asset_url = f"{PDF_BASE}/BC08_{year_from_href}_{idx}.pdf"
            storage_name = f"ncku_{year_from_href}_{idx}.pdf"

            assets.append(ExamAsset(
                school=SCHOOL,
                department=DEPARTMENT,
                year_label=f"{year_from_href}學年度",
                exam_year=year_from_href,
                subject=subject_name,
                source_url=LIST_URL,
                asset_url=asset_url,
                fetch_strategy="direct_html_parse",
                notes=f"subject_index={idx}",
            ))
            time.sleep(0)  # no delay for discovery

    return assets


def download_all(assets: list[ExamAsset], session: Optional[requests.Session] = None) -> list[ExamAsset]:
    """Download PDFs for all assets and update storage_path / sha256_hash."""
    s = session or _session()
    school_dir = DOWNLOADS_DIR / "ncku"
    school_dir.mkdir(parents=True, exist_ok=True)

    for asset in assets:
        filename = Path(asset.asset_url).name
        dest = school_dir / filename
        if dest.exists():
            print(f"  skip (exists): {filename}")
            asset.storage_path = str(dest)
            continue

        try:
            print(f"  downloading: {filename}")
            sha = download_pdf(asset.asset_url, dest, session=s)
            asset.storage_path = str(dest)
            asset.sha256_hash = sha
            asset.mime_type = "application/pdf"
            asset.downloaded_at = datetime.now(timezone.utc).isoformat()
            time.sleep(REQUEST_DELAY_SECONDS)
        except PermissionError:
            asset.extraction_status = "manual_import_required"
            print(f"  403 - manual import required: {filename}")
        except Exception as e:
            asset.extraction_status = "download_failed"
            asset.notes += f" | download_error: {e}"
            print(f"  FAILED: {filename} — {e}")

    return assets


def run_survey() -> list[dict]:
    """Discover assets without downloading. Returns list of dicts for JSON output."""
    assets = discover_assets()
    return [a.__dict__ for a in assets]


if __name__ == "__main__":
    print("Discovering NCKU assets...")
    assets = discover_assets()
    print(f"Found {len(assets)} assets")
    for a in assets[:5]:
        print(f"  {a.year_label} {a.subject}: {a.asset_url}")

    manifest_path = Path(__file__).parent.parent.parent / "data" / "ncku_asset_manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump([a.__dict__ for a in assets], f, ensure_ascii=False, indent=2)
    print(f"\nManifest written to {manifest_path}")
