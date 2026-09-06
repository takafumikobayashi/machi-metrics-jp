"""Acquire the MIC originals without overwriting an existing acquisition."""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[2]
DIRECTORY = ROOT / "data/raw/furusato/mic-2026"
SOURCES = [
    ("history", "001084990.xlsx", "各自治体のふるさと納税受入額及び受入件数（平成20年度～令和7年度）"),
    ("receipts", "001084989.xlsx", "各自治体の令和7年度受入額等"),
    ("deductions", "001085012.xlsx", "各自治体の令和8年度課税における住民税控除額等"),
]


def main():
    DIRECTORY.mkdir(parents=True, exist_ok=True)
    for source_id, filename, title in SOURCES:
        path = DIRECTORY / filename
        metadata_path = DIRECTORY / f"{source_id}.source.json"
        if path.exists() or metadata_path.exists():
            if not (path.exists() and metadata_path.exists()):
                raise ValueError(f"Incomplete acquisition: {path}")
            metadata = json.loads(metadata_path.read_text())
            if hashlib.sha256(path.read_bytes()).hexdigest() != metadata["sha256"]:
                raise ValueError(f"Checksum mismatch: {path}")
            print(f"Preserved {filename}")
            continue
        url = f"https://www.soumu.go.jp/main_content/{filename}"
        with urlopen(url, timeout=60) as response:
            content = response.read()
        if not content.startswith(b"PK"):
            raise ValueError(f"Not an XLSX: {url}")
        metadata = {
            "id": source_id,
            "statistic": "ふるさと納税に関する現況調査（令和8年度調査）",
            "title": title,
            "url": url,
            "acquired_at": datetime.now(timezone.utc).isoformat(),
            "sha256": hashlib.sha256(content).hexdigest(),
            "file": filename,
            "license_url": "https://www.soumu.go.jp/menu_kyotsuu/policy/tyosaku.html",
        }
        path.write_bytes(content)
        metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n")
        print(f"Acquired {filename}: {len(content)} bytes")


if __name__ == "__main__":
    main()
