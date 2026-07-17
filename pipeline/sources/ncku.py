"""
NCKU 成功大學資訊管理研究所考古題 connector

列表頁：https://exam.lib.ncku.edu.tw/master_subject.php?department_code=BC08
HTML 結構（UTF-8）：
  <div class='table'>
    <div class='row header'><div class='cell'>115學年度</div>...</div>
    <div class='row'><div class='cell'>科目名稱</div><div class='cell'><a href='...BC08_115_1.pdf'></div>
    ...
  </div>
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
SCHOOL = "NCKU"
DEPARTMENT = "資訊管理研究所"
RECENT_YEARS = 5  # 只抓近 5 年


def discover_assets(session: Optional[requests.Session] = None,
                    years: int = RECENT_YEARS) -> list[ExamAsset]:
    s = session or _session()
    resp = s.get(LIST_URL, timeout=20)
    resp.encoding = "utf-8"
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "lxml")

    assets: list[ExamAsset] = []
    seen_years: set[int] = set()

    for table in soup.find_all("div", class_="table"):
        # Year from header row
        header = table.find("div", class_="row")
        year_text = header.find("div", class_="cell").get_text(strip=True) if header else ""
        m = re.search(r"(\d+)\s*學年度", year_text)
        if not m:
            continue
        exam_year = int(m.group(1))

        seen_years.add(exam_year)
        if len(seen_years) > years:
            break  # stop after collecting `years` distinct years

        # Data rows (skip header row)
        for row in table.find_all("div", class_="row"):
            if "header" in row.get("class", []):
                continue
            cells = row.find_all("div", class_="cell")
            if len(cells) < 2:
                continue
            subject_name = cells[0].get_text(strip=True)
            link = cells[1].find("a", href=True)
            if not link:
                continue
            pdf_url = link["href"]
            if not pdf_url.endswith(".pdf"):
                continue

            assets.append(ExamAsset(
                school=SCHOOL,
                department=DEPARTMENT,
                year_label=f"{exam_year}學年度",
                exam_year=exam_year,
                subject=subject_name,
                source_url=LIST_URL,
                asset_url=pdf_url,
                fetch_strategy="direct_html_parse",
                notes=f"year={exam_year}",
            ))

    return assets


def download_all(assets: list[ExamAsset],
                 session: Optional[requests.Session] = None) -> list[ExamAsset]:
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
            asset.notes += f" | error: {e}"
            print(f"  FAILED: {filename} — {e}")

    return assets


def run_survey() -> list[dict]:
    assets = discover_assets()
    return [a.__dict__ for a in assets]


if __name__ == "__main__":
    assets = discover_assets()
    print(f"Found {len(assets)} NCKU assets")
    for a in assets:
        print(f"  {a.year_label} {a.subject}: {a.asset_url}")
    manifest_path = Path(__file__).parent.parent.parent / "data" / "ncku_asset_manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump([a.__dict__ for a in assets], f, ensure_ascii=False, indent=2)
    print(f"\nManifest → {manifest_path}")
