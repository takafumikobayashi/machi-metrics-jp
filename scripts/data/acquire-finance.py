"""Acquire the raw files used to build ``public/data/finance/finance.json``.

The files are deliberately kept outside Git.  ``source.json`` is the snapshot
manifest: normalization refuses to read a file whose SHA-256 differs from the
manifest, so a stale/edited CSV cannot be silently attributed to a new release.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

from finance_sources import (
    ESTAT_PAGE_URL,
    FINANCE_TITLE,
    PREFECTURE_PAGE_URL,
    PREFECTURE_XLSX_PATHS,
    RAW_ROOT,
    source_definitions,
)


def read_municipalities(root: Path) -> list[dict[str, str]]:
    path = root / "config/municipalities/hiroshima.json"
    values = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(values, list) or len(values) != 23:
        raise ValueError(f"広島県の自治体設定が23件ではありません: {path}")
    result = [{"code": str(item["code"]), "name": str(item["nameJa"])} for item in values]
    codes = [item["code"] for item in result]
    if set(codes) != set(PREFECTURE_XLSX_PATHS):
        raise ValueError("県のExcelリンク定義と自治体設定のコードが一致しません")
    return result


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def fetch(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": "machi-metrics-jp finance pipeline"})
    with urlopen(request, timeout=60) as response:
        return response.read()


def validate_payload(path: Path, payload: bytes) -> None:
    """Reject an HTML error page saved in place of a source file."""

    suffix = path.suffix.lower()
    if suffix == ".xlsx" and not payload.startswith(b"PK"):
        raise ValueError(f"Excel原本ではない応答です: {path}")
    if suffix == ".pdf" and not payload.startswith(b"%PDF"):
        raise ValueError(f"PDF原本ではない応答です: {path}")
    if suffix == ".csv":
        try:
            text = payload.decode("cp932")
        except UnicodeDecodeError as error:
            raise ValueError(f"CSVをCP932として読めません: {path}") from error
        if "決算年度" not in text.splitlines()[0]:
            raise ValueError(f"e-Stat CSVの見出しを確認できません: {path}")


def verify_prefecture_index() -> None:
    """Make link drift visible before downloading 23 municipality workbooks."""

    html = fetch(PREFECTURE_PAGE_URL).decode("utf-8", errors="replace")
    hrefs = set(re.findall(r"href=[\"']([^\"']+misc\.xlsx)[\"']", html))
    missing = [path for path in PREFECTURE_XLSX_PATHS.values() if path not in hrefs]
    if missing:
        raise ValueError(
            "県の公式一覧に定義済みExcelリンクがありません: " + ", ".join(missing)
        )


def write_download(path: Path, url: str) -> None:
    payload = fetch(url)
    validate_payload(path, payload)
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as temporary:
        temporary.write(payload)
        temporary_path = Path(temporary.name)
    temporary_path.replace(path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw-root", type=Path, default=RAW_ROOT)
    args = parser.parse_args()
    raw_root = args.raw_root.resolve()
    root = Path(__file__).resolve().parents[2]
    municipalities = read_municipalities(root)
    definitions = source_definitions([item["code"] for item in municipalities])
    manifest_path = raw_root / "source.json"

    # A manifest is immutable: rerunning acquisition verifies the snapshot
    # instead of downloading over it or changing its acquisition timestamp.
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        expected = {item["file"]: item for item in definitions}
        actual = {item["file"]: item for item in manifest.get("sources", [])}
        if set(actual) != set(expected):
            raise ValueError("既存manifestのファイル一覧が現行の定義と一致しません")
        for relative, item in actual.items():
            path = raw_root / relative
            if item.get("url") != expected[relative]["url"]:
                raise ValueError(f"manifestの原本URLが定義と一致しません: {relative}")
            if not path.is_file() or sha256(path) != item.get("sha256"):
                raise ValueError(f"原本のハッシュがmanifestと一致しません: {path}")
        print(f"取得済み原本を検証しました: {len(actual)}ファイル ({manifest_path})")
        return

    verify_prefecture_index()
    acquired_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    sources: list[dict[str, str]] = []
    for definition in definitions:
        relative = definition["file"]
        path = raw_root / relative
        if not path.exists():
            write_download(path, definition["url"])
        else:
            payload = path.read_bytes()
            validate_payload(path, payload)
        sources.append(
            {
                **definition,
                "sha256": sha256(path),
            }
        )

    manifest = {
        "schema_version": "1.0",
        "title": FINANCE_TITLE,
        "fiscal_year": "2024",
        "index_url": ESTAT_PAGE_URL,
        "prefecture_index_url": PREFECTURE_PAGE_URL,
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
