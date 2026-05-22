"""
Job: 執行 source survey，產出 asset manifests。
用法: python -m pipeline.jobs.run_source_survey
"""

import json
from pathlib import Path
from pipeline.sources import ncku, nccu

DATA_DIR = Path(__file__).parent.parent.parent / "data"


def main():
    print("=== Source Survey ===\n")

    # NCKU
    print("[NCKU] Discovering assets...")
    ncku_assets = ncku.discover_assets()
    print(f"  Found {len(ncku_assets)} assets")
    ncku_manifest = DATA_DIR / "ncku_asset_manifest.json"
    with open(ncku_manifest, "w", encoding="utf-8") as f:
        json.dump([a.__dict__ for a in ncku_assets], f, ensure_ascii=False, indent=2)
    print(f"  Manifest: {ncku_manifest}\n")

    # NCCU
    print("[NCCU] Discovering assets...")
    nccu_assets = nccu.discover_assets()
    print(f"  Found {len(nccu_assets)} assets")
    nccu_manifest = DATA_DIR / "nccu_asset_manifest.json"
    with open(nccu_manifest, "w", encoding="utf-8") as f:
        json.dump([a.__dict__ for a in nccu_assets], f, ensure_ascii=False, indent=2)
    print(f"  Manifest: {nccu_manifest}\n")

    # Combined sample manifest
    all_assets = ncku_assets[:5] + nccu_assets[:5]
    sample_manifest = DATA_DIR / "sample_exam_assets_manifest.json"
    with open(sample_manifest, "w", encoding="utf-8") as f:
        json.dump([a.__dict__ for a in all_assets], f, ensure_ascii=False, indent=2)
    print(f"Sample manifest (10 items): {sample_manifest}")
    print("\n=== Survey complete ===")


if __name__ == "__main__":
    main()
