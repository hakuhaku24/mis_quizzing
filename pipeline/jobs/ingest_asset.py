"""
Job: 下載 PDF assets 並更新 manifest。
用法: python -m pipeline.jobs.ingest_asset --source ncku
"""

import argparse
import json
from pathlib import Path
from pipeline.sources import ncku, nccu

DATA_DIR = Path(__file__).parent.parent.parent / "data"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", choices=["ncku", "nccu", "all"], default="ncku")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    sources = []
    if args.source in ("ncku", "all"):
        sources.append(("ncku", ncku))
    if args.source in ("nccu", "all"):
        sources.append(("nccu", nccu))

    for name, mod in sources:
        print(f"\n=== Ingesting {name.upper()} ===")
        assets = mod.discover_assets()
        print(f"  Discovered {len(assets)} assets")
        if not args.dry_run:
            assets = mod.download_all(assets)
        manifest_path = DATA_DIR / f"{name}_asset_manifest.json"
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump([a.__dict__ for a in assets], f, ensure_ascii=False, indent=2)
        downloaded = sum(1 for a in assets if a.storage_path)
        failed = sum(1 for a in assets if "failed" in a.extraction_status)
        print(f"  Downloaded: {downloaded}, Failed: {failed}")
        print(f"  Manifest updated: {manifest_path}")


if __name__ == "__main__":
    main()
