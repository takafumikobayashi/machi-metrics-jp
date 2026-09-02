#!/usr/bin/env python3
"""e-Stat住民基本台帳人口移動報告の市区町村別移動先を正規化する。

原本は年ごとに転入元・転出先の2ファイルで、各ファイルに広島県内の
自治体ごとのシートが収録されている。rawは変更せず、処理時だけLibreOffice
で旧形式をxlsxへ変換し、標準ライブラリで全シートを読み取る。
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import tempfile
import zipfile
from pathlib import Path
from typing import Any, Iterator
from xml.etree import ElementTree


NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "package_rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_YEARS = list(range(2018, 2026))
DEFAULT_RAW_ROOT = ROOT / "data/raw/juki-migration"
DEFAULT_STAGING_ROOT = ROOT / "data/staging/juki-migration"
DEFAULT_PROCESSED_ROOT = ROOT / "data/processed/juki-migration"
DEFAULT_AGE_RAW_ROOT = ROOT / "data/raw/juki-migration-age"
DEFAULT_AGE_STAGING_ROOT = ROOT / "data/staging/juki-migration-age"
DEFAULT_AGE_PROCESSED_ROOT = ROOT / "data/processed/juki-migration-age"

SOURCE_INFO: dict[int, dict[str, dict[str, Any]]] = {
    2018: {
        "inbound": {"file_id": "000031821729", "file_kind": 0},
        "outbound": {"file_id": "000031821776", "file_kind": 0},
    },
    2019: {
        "inbound": {"file_id": "000031928074", "file_kind": 0},
        "outbound": {"file_id": "000031928121", "file_kind": 0},
    },
    2020: {
        "inbound": {"file_id": "000032084343", "file_kind": 4},
        "outbound": {"file_id": "000032084390", "file_kind": 4},
    },
    2021: {
        "inbound": {"file_id": "000032193234", "file_kind": 4},
        "outbound": {"file_id": "000032193281", "file_kind": 4},
    },
    2022: {
        "inbound": {"file_id": "000040049293", "file_kind": 4},
        "outbound": {"file_id": "000040049340", "file_kind": 4},
    },
    2023: {
        "inbound": {"file_id": "000040174367", "file_kind": 4},
        "outbound": {"file_id": "000040174414", "file_kind": 4},
    },
    2024: {
        "inbound": {"file_id": "000040270577", "file_kind": 4},
        "outbound": {"file_id": "000040270624", "file_kind": 4},
    },
    2025: {
        "inbound": {"file_id": "000040443058", "file_kind": 4},
        "outbound": {"file_id": "000040443105", "file_kind": 4},
    },
}

AGE_SOURCE_INFO: dict[int, dict[str, dict[str, Any]]] = {
    2018: {
        "inbound": {"file_id": "000031818791", "file_kind": 0},
        "outbound": {"file_id": "000031818838", "file_kind": 0},
    },
    2019: {
        "inbound": {"file_id": "000031927980", "file_kind": 0},
        "outbound": {"file_id": "000031928027", "file_kind": 0},
    },
    2020: {
        "inbound": {"file_id": "000032084437", "file_kind": 4},
        "outbound": {"file_id": "000032084484", "file_kind": 4},
    },
    2021: {
        "inbound": {"file_id": "000032193140", "file_kind": 4},
        "outbound": {"file_id": "000032193187", "file_kind": 4},
    },
    2022: {
        "inbound": {"file_id": "000040049185", "file_kind": 4},
        "outbound": {"file_id": "000040049232", "file_kind": 4},
    },
    2023: {
        "inbound": {"file_id": "000040174273", "file_kind": 4},
        "outbound": {"file_id": "000040174320", "file_kind": 4},
    },
    2024: {
        "inbound": {"file_id": "000040270483", "file_kind": 4},
        "outbound": {"file_id": "000040270530", "file_kind": 4},
    },
    2025: {
        "inbound": {"file_id": "000040443152", "file_kind": 4},
        "outbound": {"file_id": "000040443199", "file_kind": 4},
    },
}

TABLE_NUMBERS = {"inbound": "3", "outbound": "4"}
TABLE_NAMES = {
    "inbound": "参考表（移動前の住所地別転入者数－都道府県、市区町村）",
    "outbound": "参考表（移動後の住所地別転出者数－都道府県、市区町村）",
}
AGE_TABLE_NUMBERS = {"inbound": "1", "outbound": "2"}
AGE_TABLE_NAMES = {
    "inbound": "参考表（年齢（10歳階級）、男女、移動前の住所地別転入者数－都道府県、市区町村）",
    "outbound": "参考表（年齢（10歳階級）、男女、移動後の住所地別転出者数－都道府県、市区町村）",
}

AGE_FIELDS = (
    ("age_0_9", "K", "0〜9歳"),
    ("age_10_19", "L", "10〜19歳"),
    ("age_20_29", "M", "20〜29歳"),
    ("age_30_39", "N", "30〜39歳"),
    ("age_40_49", "O", "40〜49歳"),
    ("age_50_59", "P", "50〜59歳"),
    ("age_60_plus", "Q", "60歳以上"),
    ("age_unknown_other", "R", "不詳・その他"),
)


def read_focus_municipalities() -> list[dict[str, str]]:
    path = ROOT / "config/municipalities/hiroshima.json"
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def column_name(reference: str) -> str:
    match = re.match(r"[A-Z]+", reference)
    if not match:
        raise ValueError(f"invalid xlsx cell reference: {reference}")
    return match.group(0)


def element_text(element: ElementTree.Element | None) -> str:
    if element is None:
        return ""
    return "".join(element.itertext())


def shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
    return [element_text(item) for item in root.findall("main:si", NS)]


def cell_value(cell: ElementTree.Element, strings: list[str]) -> str:
    cell_type = cell.attrib.get("t")
    if cell_type == "inlineStr":
        return element_text(cell.find("main:is", NS))

    value = cell.find("main:v", NS)
    if value is None:
        return ""
    raw = element_text(value)
    if cell_type == "s":
        return strings[int(raw)]
    return raw


def worksheet_target(target: str) -> str:
    normalized = target.lstrip("/")
    if not normalized.startswith("xl/"):
        normalized = f"xl/{normalized}"
    return normalized


def read_xlsx_sheets(path: Path) -> Iterator[tuple[str, list[tuple[int, dict[str, str]]]]]:
    with zipfile.ZipFile(path) as archive:
        strings = shared_strings(archive)
        workbook = ElementTree.fromstring(archive.read("xl/workbook.xml"))
        relationships = ElementTree.fromstring(
            archive.read("xl/_rels/workbook.xml.rels")
        )
        relation_targets = {
            relation.attrib["Id"]: relation.attrib["Target"]
            for relation in relationships.findall("package_rel:Relationship", NS)
        }
        sheets = workbook.find("main:sheets", NS)
        if sheets is None:
            raise ValueError(f"xlsxにシートがありません: {path}")

        for sheet in sheets.findall("main:sheet", NS):
            relation_id = sheet.attrib[f"{{{NS['rel']}}}id"]
            target = relation_targets.get(relation_id)
            if target is None:
                raise ValueError(f"xlsxのシート参照が見つかりません: {path}")
            worksheet = ElementTree.fromstring(archive.read(worksheet_target(target)))
            rows: list[tuple[int, dict[str, str]]] = []
            sheet_data = worksheet.find("main:sheetData", NS)
            if sheet_data is None:
                yield sheet.attrib["name"], rows
                continue
            for row in sheet_data.findall("main:row", NS):
                cells = {
                    column_name(cell.attrib["r"]): cell_value(cell, strings)
                    for cell in row.findall("main:c", NS)
                }
                if cells:
                    rows.append((int(row.attrib["r"]), cells))
            yield sheet.attrib["name"], rows


def convert_to_xlsx(raw_path: Path) -> tuple[Path, tempfile.TemporaryDirectory[str] | None]:
    if zipfile.is_zipfile(raw_path):
        return raw_path, None

    temporary = tempfile.TemporaryDirectory(prefix="machi-metrics-migration-")
    output_dir = Path(temporary.name)
    soffice = str(Path(__import__("os").environ.get("SOFFICE_BIN", "soffice")))
    try:
        subprocess.run(
            [soffice, "--headless", "--convert-to", "xlsx", "--outdir", str(output_dir), str(raw_path)],
            check=True,
            capture_output=True,
            text=True,
        )
    except (OSError, subprocess.CalledProcessError) as error:
        temporary.cleanup()
        detail = error.stderr if isinstance(error, subprocess.CalledProcessError) else str(error)
        raise RuntimeError(f"Excel原本のxlsx変換に失敗しました: {raw_path}\n{detail}") from error

    converted = output_dir / f"{raw_path.stem}.xlsx"
    if not converted.exists():
        candidates = list(output_dir.glob("*.xlsx"))
        if len(candidates) == 1:
            converted = candidates[0]
    if not converted.exists():
        temporary.cleanup()
        raise RuntimeError(f"xlsx変換結果が見つかりません: {raw_path}")
    return converted, temporary


def clean_area_name(value: str) -> str:
    compact = "".join(value.split())
    if compact.startswith("総数"):
        return "総数"
    compact = re.sub(r"^\d{2,3}", "", compact)
    return compact or "名称不明"


def area_type(area_code: str, name: str) -> str:
    if area_code == "00000":
        return "total"
    if area_code == "99000" or "その他の都道府県" in name:
        return "other_prefectures"
    if area_code.endswith("000"):
        return "prefecture"
    if area_code.endswith("999"):
        return "other_municipalities"
    if area_code.endswith("199") or "その他の区" in name:
        return "other_wards"
    return "municipality"


def parse_area_code(value: str) -> str | None:
    compact = value.strip()
    return compact if re.fullmatch(r"\d{5}", compact) else None


def parse_count(value: str, label: str) -> int | None:
    normalized = value.strip().replace(",", "")
    if normalized in {"", "-", "―", "X", "***", "…", "..."}:
        return None
    try:
        number = float(normalized)
    except ValueError as error:
        raise ValueError(f"{label} is not numeric: {value}") from error
    if not number.is_integer() or number < 0:
        raise ValueError(f"{label} is not a nonnegative integer: {value}")
    return int(number)


def find_raw_file(
    raw_root: Path, year: int, direction: str, file_prefix: str
) -> Path:
    matches = sorted(
        (raw_root / str(year)).glob(f"{file_prefix}-{direction}.*")
    )
    if not matches:
        raise FileNotFoundError(f"原本が見つかりません: {raw_root / str(year)} / {direction}")
    return matches[0]


def read_direction(
    raw_path: Path,
    target_codes: set[str],
    dataset: str,
) -> tuple[dict[str, list[dict[str, Any]]], set[str]]:
    xlsx_path, temporary = convert_to_xlsx(raw_path)
    try:
        by_code: dict[str, list[dict[str, Any]]] = {}
        sheet_names: set[str] = set()
        for sheet_name, rows in read_xlsx_sheets(xlsx_path):
            match = re.match(r"^(\d{5})", sheet_name)
            if not match or match.group(1) not in target_codes:
                continue
            municipality_code = match.group(1)
            sheet_names.add(sheet_name)
            entries: list[dict[str, Any]] = []
            for row_number, row in rows:
                source_code = parse_area_code(row.get("I" if dataset == "age" else "B", ""))
                if source_code is None:
                    continue
                name = clean_area_name(row.get("H", ""))
                parsed: dict[str, Any] = {
                    "area_code": source_code,
                    "area_name_ja": name,
                    "area_type": area_type(source_code, name),
                    "all_nationalities": parse_count(
                        row.get("J", ""), f"{raw_path} {sheet_name} row {row_number} 総数"
                    ),
                    "japanese": None,
                    "foreign": None,
                    "source_row": row_number,
                }
                if dataset == "age":
                    parsed.update(
                        {
                            field: parse_count(
                                row.get(column, ""),
                                f"{raw_path} {sheet_name} row {row_number} {label}",
                            )
                            for field, column, label in AGE_FIELDS
                        }
                    )
                else:
                    parsed.update(
                        {
                            "japanese": parse_count(
                                row.get("K", ""),
                                f"{raw_path} {sheet_name} row {row_number} 日本人",
                            ),
                            "foreign": parse_count(
                                row.get("L", ""),
                                f"{raw_path} {sheet_name} row {row_number} 外国人",
                            ),
                        }
                    )
                entries.append(parsed)
            if not entries:
                raise ValueError(f"移動先データの行がありません: {raw_path} {sheet_name}")
            by_code[municipality_code] = entries

        missing = sorted(target_codes - by_code.keys())
        if missing:
            raise ValueError(f"移動先データの自治体シートがありません: {raw_path} {', '.join(missing)}")
        return by_code, sheet_names
    finally:
        if temporary is not None:
            temporary.cleanup()


def normalize_year(
    year: int,
    raw_root: Path,
    target_municipalities: list[dict[str, str]],
    dataset: str,
) -> dict[str, Any]:
    source_info_by_year = AGE_SOURCE_INFO if dataset == "age" else SOURCE_INFO
    if year not in source_info_by_year:
        raise ValueError(f"e-StatファイルIDが未登録です: {year}")
    target_codes = {item["code"] for item in target_municipalities}
    by_direction: dict[str, dict[str, list[dict[str, Any]]]] = {}
    sources: list[dict[str, Any]] = []
    for direction in ("inbound", "outbound"):
        file_prefix = "juki-migration-age" if dataset == "age" else "juki-migration"
        raw_path = find_raw_file(raw_root, year, direction, file_prefix)
        rows_by_code, sheet_names = read_direction(raw_path, target_codes, dataset)
        by_direction[direction] = rows_by_code
        source_info = source_info_by_year[year][direction]
        sources.append(
            {
                "direction": direction,
                "table_number": (AGE_TABLE_NUMBERS if dataset == "age" else TABLE_NUMBERS)[direction],
                "table_name": (AGE_TABLE_NAMES if dataset == "age" else TABLE_NAMES)[direction],
                "file_id": source_info["file_id"],
                "file_kind": source_info["file_kind"],
                "raw_file": raw_path.relative_to(raw_root).as_posix(),
                "sha256": sha256(raw_path),
                "sheet_name": "、".join(sorted(sheet_names)),
            }
        )

    entries = []
    for municipality in target_municipalities:
        code = municipality["code"]
        entries.append(
            {
                "municipality_code": code,
                "name_ja": municipality["nameJa"],
                "inbound": by_direction["inbound"][code],
                "outbound": by_direction["outbound"][code],
            }
        )

    return {
        "schema_version": 1,
        "coverage": {
            "year": year,
            "period_start": f"{year}-01-01",
            "period_end": f"{year}-12-31",
            "focus_prefecture_code": "34",
            "municipality_codes": [item["code"] for item in target_municipalities],
        },
        "sources": sources,
        "entries": entries,
    }


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def parse_years(value: str) -> list[int]:
    years = [int(item.strip()) for item in value.split(",") if item.strip()]
    if not years:
        raise ValueError("yearsを1件以上指定してください")
    return years


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--years", default=",".join(map(str, DEFAULT_YEARS)))
    parser.add_argument("--dataset", choices=("legacy", "age"), default="legacy")
    parser.add_argument("--raw-root", type=Path)
    parser.add_argument("--staging-root", type=Path)
    parser.add_argument("--processed-root", type=Path)
    args = parser.parse_args()

    is_age = args.dataset == "age"
    raw_root = args.raw_root or (DEFAULT_AGE_RAW_ROOT if is_age else DEFAULT_RAW_ROOT)
    staging_root = args.staging_root or (
        DEFAULT_AGE_STAGING_ROOT if is_age else DEFAULT_STAGING_ROOT
    )
    processed_root = args.processed_root or (
        DEFAULT_AGE_PROCESSED_ROOT if is_age else DEFAULT_PROCESSED_ROOT
    )

    municipalities = read_focus_municipalities()
    for year in parse_years(args.years):
        normalized = normalize_year(year, raw_root, municipalities, args.dataset)
        write_json(staging_root / str(year) / "pilot.json", normalized)
        write_json(processed_root / str(year) / "pilot.json", normalized)
        print(
            f"移動元・移動先の正規化OK: {year}年 / "
            f"{len(normalized['entries'])}自治体 / "
            f"{len(normalized['sources'])}原本"
        )


if __name__ == "__main__":
    main()
