"""Normalize the Digital Agency's machine-readable municipal DX table."""
import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data/raw/digital-dx/2024-07-12"
OUTPUT = ROOT / "data/processed/digital-dx-2024.json"


def percent(value):
    if not value or value in {"-", "未回答", "未公表"}:
        return None
    if value.endswith("%"):
        return float(value[:-1]) / 100
    return None


def acquired_at(source, source_sha256):
    """Return the acquisition time recorded for the raw file.

    A sidecar is preferred when one exists.  Older raw snapshots do not have
    one, so use the file's mtime as the documented reproducible fallback rather
    than the time at which normalization happens.
    """
    metadata_candidates = (
        source.parent / "source.json",
        source.with_name(f"{source.name}.source.json"),
    )
    metadata_path = next(
        (path for path in metadata_candidates if path.exists()), None
    )
    if metadata_path is not None:
        try:
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise ValueError(f"Invalid source metadata: {metadata_path}") from error
        if not isinstance(metadata, dict):
            raise ValueError(f"Invalid source metadata: {metadata_path}")

        metadata_sha256 = metadata.get("sha256")
        if metadata_sha256 is not None and metadata_sha256 != source_sha256:
            raise ValueError(f"Checksum mismatch: {source}")

        value = metadata.get("acquired_at")
        if not isinstance(value, str) or not value:
            raise ValueError(f"Missing acquired_at in source metadata: {metadata_path}")
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as error:
            raise ValueError(f"Invalid acquired_at in source metadata: {metadata_path}") from error
        if parsed.tzinfo is None or parsed.utcoffset() is None:
            raise ValueError(f"acquired_at must include a timezone: {metadata_path}")
        return value

    return (
        datetime.fromtimestamp(source.stat().st_mtime, tz=timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def resolve_columns(header, names):
    """Map each municipality to its column, using the prefecture block.

    見出しは市区町村名だけで都道府県名を持たないため、全国に同名の市町がある
    場合（府中市など）に取り違える。広島県の23市町はコード順に連続して並ぶので、
    一意に決まる市町から範囲を求め、その中にある列だけを採る。
    """
    occurrences = {
        name: [index for index, value in enumerate(header) if value == name]
        for name in names
    }
    missing = [name for name, found in occurrences.items() if not found]
    if missing:
        raise ValueError(f"見出しに無い市町: {missing}")

    unique = [found[0] for found in occurrences.values() if len(found) == 1]
    if not unique:
        raise ValueError("一意に決まる市町が無く、範囲を determine できない")
    low, high = min(unique), max(unique)

    columns = {}
    for name, found in occurrences.items():
        inside = [index for index in found if low <= index <= high]
        if len(inside) != 1:
            raise ValueError(f"列を一意に決められない市町: {name} -> {found}")
        columns[name] = inside[0]

    ordered = [columns[name] for name in names]
    if ordered != list(range(ordered[0], ordered[0] + len(names))):
        raise ValueError(f"23市町の列が連続していない: {ordered}")
    return columns


def main():
    source = RAW / "dashboard.zip"
    csv_path = RAW / "extracted/市区町村毎のDX進捗状況_市区町村比較.csv"
    municipalities = {
        item["nameJa"]: item["code"]
        for item in json.loads((ROOT / "config/municipalities/hiroshima.json").read_text())
    }
    rows = list(csv.reader(csv_path.open(encoding="utf-8-sig")))
    header = rows[0]
    columns = resolve_columns(header, list(municipalities))
    entries = []
    for name, code in municipalities.items():
        column = columns[name]
        metrics = []
        for row in rows[1:]:
            if len(row) <= column or not row[1].strip():
                continue
            raw = row[column].strip()
            numeric = percent(raw)
            metrics.append({
                "category": row[0].strip(),
                "label": row[1].strip(),
                "value": numeric,
                "display_value": raw or None,
            })
        entries.append({"municipality_code": code, "municipality_name": name, "metrics": metrics})
    source_sha256 = hashlib.sha256(source.read_bytes()).hexdigest()
    result = {
        "schema_version": "1.0",
        "as_of_date": "2024-07-12",
        "source": {
            "title": "自治体DXの取組に関するダッシュボード データテーブル",
            "url": "https://www.digital.go.jp/resources/govdashboard/local-government-dx",
            "file": source.name,
            "acquired_at": acquired_at(source, source_sha256),
            "sha256": source_sha256,
        },
        "entries": entries,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(f"Normalized {len(entries)} municipalities and {sum(len(e['metrics']) for e in entries)} metrics")


if __name__ == "__main__":
    main()
