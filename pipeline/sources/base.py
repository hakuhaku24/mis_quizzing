import hashlib
import time
import warnings
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional

import requests
import urllib3

from pipeline.config import DOWNLOADS_DIR, MAX_RETRIES, REQUEST_DELAY_SECONDS, USER_AGENT

# Some university servers have non-standard SSL certificates (missing SKID).
# We suppress the warning and proceed; this is an internal research tool on
# publicly accessible exam files.
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


@dataclass
class ExamAsset:
    school: str
    department: str
    year_label: str
    exam_year: int
    subject: str
    source_url: str
    asset_url: str
    fetch_strategy: str
    requires_login: bool = False
    storage_path: Optional[str] = None
    sha256_hash: Optional[str] = None
    mime_type: Optional[str] = None
    downloaded_at: Optional[str] = None
    extraction_status: str = "pending"
    legal_status: str = "public_exam_question_only"
    notes: str = ""


def _session() -> requests.Session:
    s = requests.Session()
    s.headers["User-Agent"] = USER_AGENT
    s.verify = False  # university certs may have non-standard extensions
    return s


def download_pdf(url: str, dest_path: Path, session: Optional[requests.Session] = None) -> str:
    """Download a PDF and return its sha256 hash. Retries up to MAX_RETRIES times."""
    s = session or _session()
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = s.get(url, timeout=30, stream=True, verify=False)
            if resp.status_code == 403:
                raise PermissionError(f"403 Forbidden: {url}")
            if resp.status_code != 200:
                raise IOError(f"HTTP {resp.status_code}: {url}")
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            h = hashlib.sha256()
            with open(dest_path, "wb") as f:
                for chunk in resp.iter_content(8192):
                    f.write(chunk)
                    h.update(chunk)
            return h.hexdigest()
        except (IOError, requests.RequestException) as e:
            if attempt == MAX_RETRIES:
                raise
            time.sleep(REQUEST_DELAY_SECONDS * attempt)
    raise RuntimeError("unreachable")
