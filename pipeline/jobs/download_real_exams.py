# -*- coding: utf-8 -*-
"""Download real past-exam PDFs from official university library archives.

Sources (public, no login):
- NCU  (中央資管所, Jerry's home turf):
  https://rapid.lib.ncu.edu.tw/cexamn/exam/MA02_{year}_{code}.pdf
  Codes 01-06 map to subjects per 組 and vary by era; we fetch all and let
  content classification sort them. Bad SSL cert -> verify=False.
- NSYSU (中山資管系, one integrated PDF per year):
  https://www3.nsysu.edu.tw/exam/master/mana/infom/infom_{year}.pdf

Personal study use only.
"""
import sys
from pathlib import Path

import requests
import urllib3

urllib3.disable_warnings()

ROOT = Path(__file__).resolve().parents[2]
YEARS = range(105, 116)  # 民國 105-115 學年
TIMEOUT = 30

SOURCES = {
    "ncu_central": [
        (f"MA02_{y}_{c:02d}.pdf",
         f"https://rapid.lib.ncu.edu.tw/cexamn/exam/MA02_{y}_{c:02d}.pdf")
        for y in YEARS for c in range(1, 7)
    ],
    "nsysu": [
        (f"infom_{y}.pdf",
         f"https://www3.nsysu.edu.tw/exam/master/mana/infom/infom_{y}.pdf")
        for y in YEARS
    ],
}


def main() -> None:
    total_ok = 0
    for source, files in SOURCES.items():
        outdir = ROOT / "data" / "downloads" / source
        outdir.mkdir(parents=True, exist_ok=True)
        ok = skipped = missing = 0
        for name, url in files:
            dest = outdir / name
            if dest.exists() and dest.stat().st_size > 1000:
                skipped += 1
                continue
            try:
                r = requests.get(url, timeout=TIMEOUT, verify=False)
            except requests.RequestException as e:
                print(f"  ERROR {name}: {e}")
                continue
            if r.status_code == 200 and r.content[:5] == b"%PDF-":
                dest.write_bytes(r.content)
                ok += 1
            else:
                missing += 1
        total_ok += ok
        print(f"{source}: downloaded {ok}, cached {skipped}, missing/not-pdf {missing}")
    print(f"total new PDFs: {total_ok}")


if __name__ == "__main__":
    sys.exit(main())
