"""Acquire the raw files used to build ``public/data/census/census-2025.json``.

The files are kept outside Git.  ``source.json`` records the URL, SHA-256 and
acquisition time of each workbook; normalization refuses files whose hash
differs from it.  An existing snapshot is verified, never re-downloaded.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

from census_sources import INDEX_URL, RAW_ROOT, REFERENCE_DATE, SOURCES, TITLE


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def fetch(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": "machi-metrics-jp census pipeline"})
    with urlopen(request, timeout=120) as response:
        return response.read()


def validate_payload(path: Path, payload: bytes) -> None:
    """Reject an HTML error page saved in place of a workbook."""

    if not payload.startswith(b"PK"):
        raise ValueError(f"Excel原本ではない応答です: {path}")


def write_download(path: Path, url: str) -> None:
    payload = fetch(url)
    validate_payload(path, payload)
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as temporary:
        temporary.write(payload)
        temporary_path = Path(temporary.name)
    temporary_path.replace(path)


def verify_manifest(raw_root: Path, manifest: dict) -> None:
    expected = {item["file"]: item for item in SOURCES}
    actual = {item["file"]: item for item in manifest.get("sources", [])}
    if set(actual) != set(expected):
        raise ValueError("既存manifestの原本一覧が現行定義と一致しません")
    for relative, item in actual.items():
        if item.get("url") != expected[relative]["url"]:
            raise ValueError(f"manifestの原本URLが定義と一致しません: {relative}")
        path = raw_root / relative
        if not path.is_file() or sha256(path) != item.get("sha256"):
            raise ValueError(f"原本のハッシュがmanifestと一致しません: {path}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw-root", type=Path, default=RAW_ROOT)
    args = parser.parse_args()
    raw_root = args.raw_root.resolve()
    manifest_path = raw_root / "source.json"

    if manifest_path.exists():
        verify_manifest(raw_root, json.loads(manifest_path.read_text(encoding="utf-8")))
        print(f"取得済み原本を検証しました: {len(SOURCES)}ファイル ({manifest_path})")
        return

    acquired_at = (
        datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    )
    sources: list[dict[str, str]] = []
    for definition in SOURCES:
        path = raw_root / definition["file"]
        if path.exists():
            validate_payload(path, path.read_bytes())
        else:
            write_download(path, definition["url"])
        sources.append({**definition, "sha256": sha256(path)})

    manifest = {
        "schema_version": "1.0",
        "title": TITLE,
        "reference_date": REFERENCE_DATE,
        "index_url": INDEX_URL,
        "acquired_at": acquired_at,
        "sources": sources,
    }
    raw_root.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"原本を取得しました: {len(sources)}ファイル ({manifest_path})")


if __name__ == "__main__":
    main()
