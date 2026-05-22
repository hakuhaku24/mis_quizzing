"""
NCCU 政治大學資訊管理學系碩士班考古題 connector

系統 A (106-115)：URL 規律 master_mis{YY}.pdf
系統 B (100-109)：已知 URL 清單（來自 NCCUR 機構典藏 survey）
"""

import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import requests

from pipeline.config import DOWNLOADS_DIR, REQUEST_DELAY_SECONDS
from pipeline.sources.base import ExamAsset, _session, download_pdf

SCHOOL = "NCCU"
DEPARTMENT = "資訊管理學系碩士班"

# 系統 A：106-115 年規律 URL
SYSTEM_A_BASE = "https://www.lib.nccu.edu.tw/var/file/0/1000/img/7"
SYSTEM_A_YEARS = list(range(106, 116))

# 系統 B：已知 URL 清單（survey 結果）
SYSTEM_B_KNOWN = [
    {"year": 100, "url": "https://nccur.lib.nccu.edu.tw/bitstream/140.119/106630/1/mis100.pdf"},
    {"year": 101, "url": "https://nccur.lib.nccu.edu.tw/bitstream/140.119/106631/1/mis101.pdf"},
    {"year": 102, "url": "https://nccur.lib.nccu.edu.tw/bitstream/140.119/106632/1/mis102.pdf"},
    {"year": 103, "url": "https://nccur.lib.nccu.edu.tw/bitstream/140.119/106633/1/mis103.pdf"},
    {"year": 104, "url": "https://nccur.lib.nccu.edu.tw/bitstream/140.119/106634/1/mis104.pdf"},
    {"year": 105, "url": "https://nccur.lib.nccu.edu.tw/bitstream/140.119/106635/1/mis105.pdf"},
    {"year": 106, "url": "https://nccur.lib.nccu.edu.tw/bitstream/140.119/134504/1/294.pdf"},
    {"year": 107, "url": "https://nccur.lib.nccu.edu.tw/bitstream/140.119/134505/1/67.pdf"},
    {"year": 108, "url": "https://nccur.lib.nccu.edu.tw/bitstream/140.119/134506/1/68.pdf"},
    {"year": 109, "url": "https://nccur.lib.nccu.edu.tw/bitstream/140.119/134507/1/295.pdf"},
]


def discover_assets() -> list[ExamAsset]:
    assets: list[ExamAsset] = []

    # 系統 A
    for year in SYSTEM_A_YEARS:
        yy = str(year)
        url = f"{SYSTEM_A_BASE}/master_mis{yy}.pdf"
        assets.append(ExamAsset(
            school=SCHOOL,
            department=DEPARTMENT,
            year_label=f"{year}學年度",
            exam_year=year,
            subject="資訊管理（整合）",
            source_url="https://www.lib.nccu.edu.tw/app/index.php?Action=libraryarcheorcgret&AechoPar=43&ArcheoCg=49&ArcheoLevel=Master&Page=1&Plugin=library",
            asset_url=url,
            fetch_strategy="direct_pdf_download",
            notes="系統A 整合PDF，含所有考科",
        ))

    # 系統 B
    for item in SYSTEM_B_KNOWN:
        year = item["year"]
        # skip years already covered by 系統A (106-109 overlap)
        if year >= 106:
            continue
        assets.append(ExamAsset(
            school=SCHOOL,
            department=DEPARTMENT,
            year_label=f"{year}學年度",
            exam_year=year,
            subject="資訊管理（整合）",
            source_url="https://nccur.lib.nccu.edu.tw/handle/140.119/105795",
            asset_url=item["url"],
            fetch_strategy="known_url_list",
            notes="系統B NCCUR機構典藏 整合PDF",
        ))

    return assets


def download_all(assets: list[ExamAsset], session: Optional[requests.Session] = None) -> list[ExamAsset]:
    s = session or _session()
    school_dir = DOWNLOADS_DIR / "nccu"
    school_dir.mkdir(parents=True, exist_ok=True)

    for asset in assets:
        year_str = str(asset.exam_year)
        filename = f"nccu_{year_str}_mis.pdf"
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


if __name__ == "__main__":
    assets = discover_assets()
    print(f"Found {len(assets)} NCCU assets")
    manifest_path = Path(__file__).parent.parent.parent / "data" / "nccu_asset_manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump([a.__dict__ for a in assets], f, ensure_ascii=False, indent=2)
    print(f"Manifest written to {manifest_path}")
