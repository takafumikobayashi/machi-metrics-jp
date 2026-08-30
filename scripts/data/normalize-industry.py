#!/usr/bin/env python3
"""令和2年国勢調査の産業別就業者数を公開用の中間JSONへ正規化する。

対象表は市区町村ごとに現在の境域と2000年境域を並べているため、
2020年の自治体コード(F列)と「旧：」ではない地域名(G列)だけを採用する。
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET


NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
SOURCE_URL = (
    "https://www.e-stat.go.jp/stat-search/file-download?"
    "fileKind=0&statInfId=000032201183"
)
SOURCE_TITLE = (
    "令和2年国勢調査 就業状態等基本集計 第5-3表 "
    "男女，従業上の地位，産業（大分類）別就業者数（15歳以上）"
)
TABLE_NUMBER = "2020-国勢調査-5-3"
TARGET_INDUSTRIES = {
    "0_総数",
    "A_農業，林業",
    "01_うち農業",
    "B_漁業",
    "C_鉱業，採石業，砂利採取業",
    "D_建設業",
    "E_製造業",
    "F_電気・ガス・熱供給・水道業",
    "G_情報通信業",
    "H_運輸業，郵便業",
    "I_卸売業，小売業",
    "J_金融業，保険業",
    "K_不動産業，物品賃貸業",
    "L_学術研究，専門・技術サービス業",
    "M_宿泊業，飲食サービス業",
    "N_生活関連サービス業，娯楽業",
    "O_教育，学習支援業",
    "P_医療，福祉",
    "Q_複合サービス事業",
    "R_サービス業（他に分類されないもの）",
    "S_公務（他に分類されるものを除く）",
}
MUNICIPALITY_SUFFIXES = ("市", "町", "村", "区")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input",
        default="data/raw/industry/2020/2020-005-03.xlsx",
        help="e-Stat Excel原本",
    )
    parser.add_argument(
        "--output",
        default="data/processed/industry/2020/pilot.json",
        help="正規化JSONの出力先",
    )
    return parser.parse_args()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def acquired_at(path: Path) -> str:
    """原本の取得記録がない場合に使う、ローカル原本の更新時刻。"""
    return (
        datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def raw_file_name(path: Path) -> str:
    raw_root = Path("data/raw").resolve()
    try:
        return str(path.resolve().relative_to(raw_root))
    except ValueError:
        return str(path)


def column_name(cell_ref: str) -> str:
    return re.sub(r"[^A-Z]", "", cell_ref)


def shared_strings(archive: zipfile.ZipFile) -> list[str]:
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    return ["".join(text.text or "" for text in item.iter(NS + "t")) for item in root.findall(NS + "si")]


def cell_value(cell: ET.Element, strings: list[str]) -> str:
    value = cell.find(NS + "v")
    if value is None or value.text is None:
        inline = cell.find(NS + "is")
        return "" if inline is None else "".join(text.text or "" for text in inline.iter(NS + "t"))
    raw = value.text
    if cell.attrib.get("t") == "s":
        return strings[int(raw)]
    return raw


def parse_count(value: str, code: str) -> int:
    if value in ("", "-"):
        return 0
    try:
        parsed = int(value)
    except ValueError as error:
        raise ValueError(f"自治体コード{code}の就業者数を読めません: {value!r}") from error
    if parsed < 0:
        raise ValueError(f"自治体コード{code}の就業者数が負です: {parsed}")
    return parsed


def split_code_label(value: str) -> tuple[str, str]:
    code, separator, label = value.partition("_")
    return (code, label if separator else value)


def is_current_municipality(values: dict[str, str]) -> bool:
    code = values.get("F", "")
    _, name = split_code_label(values.get("G", ""))
    _, prefecture_name = split_code_label(values.get("E", ""))
    if not re.fullmatch(r"\d{5}", code):
        return False
    if "（旧：" in name or "(旧:" in name:
        return False
    if name.endswith("区"):
        return prefecture_name == "東京都"
    return name.endswith(MUNICIPALITY_SUFFIXES)


def add_row(records: dict[str, dict], values: dict[str, str]) -> None:
    if values.get("H") != "0_総数" or values.get("J") not in TARGET_INDUSTRIES:
        return
    if not is_current_municipality(values):
        return

    code = values["F"]
    _, prefecture_name = split_code_label(values.get("E", ""))
    _, name = split_code_label(values.get("G", ""))
    record = records.setdefault(
        code,
        {
            "municipality_code": code,
            "prefecture_code": code[:2],
            "prefecture_name_ja": prefecture_name,
            "name_ja": name,
            "counts": {},
        },
    )
    industry = values["J"]
    if industry in record["counts"]:
        raise ValueError(f"自治体コード{code}の産業行が重複しています: {industry}")
    record["counts"][industry] = parse_count(values.get("K", ""), code)


def parse_xlsx(path: Path) -> dict[str, dict]:
    records: dict[str, dict] = {}
    with zipfile.ZipFile(path) as archive:
        strings = shared_strings(archive)
        with archive.open("xl/worksheets/sheet1.xml") as stream:
            for _, row in ET.iterparse(stream, events=("end",)):
                if row.tag != NS + "row":
                    continue
                values: dict[str, str] = {}
                for cell in row:
                    if cell.tag != NS + "c":
                        continue
                    column = column_name(cell.attrib.get("r", ""))
                    if column in {"E", "F", "G", "H", "I", "J", "K"}:
                        values[column] = cell_value(cell, strings)
                add_row(records, values)
                row.clear()
    return records


def share(value: int, denominator: int) -> float | None:
    return None if denominator == 0 else value / denominator


def to_entry(record: dict) -> dict:
    counts = record["counts"]
    required = TARGET_INDUSTRIES - counts.keys()
    if required:
        missing = ", ".join(sorted(required))
        raise ValueError(f"自治体コード{record['municipality_code']}の産業行が不足しています: {missing}")

    agriculture = counts["01_うち農業"]
    primary = counts["A_農業，林業"] + counts["B_漁業"]
    secondary = sum(counts[key] for key in ("C_鉱業，採石業，砂利採取業", "D_建設業", "E_製造業"))
    tertiary_prefixes = {f"{letter}_" for letter in "FGHIJKLMNOPQRS"}
    tertiary = sum(
        counts[key] for key in TARGET_INDUSTRIES if key[:2] in tertiary_prefixes
    )
    total = counts["0_総数"]
    classified = primary + secondary + tertiary
    unknown = total - classified
    if unknown < 0:
        raise ValueError(
            f"自治体コード{record['municipality_code']}で産業3部門の合計が総数を超えています: "
            f"{classified} > {total}"
        )

    return {
        "municipality_code": record["municipality_code"],
        "prefecture_code": record["prefecture_code"],
        "prefecture_name_ja": record["prefecture_name_ja"],
        "name_ja": record["name_ja"],
        "reference_date": "2020-10-01",
        "employed_population_15_plus": total,
        "industry_classified_population": classified,
        "industry_unknown_population": unknown,
        "agriculture_population": agriculture,
        "primary_industry_population": primary,
        "secondary_industry_population": secondary,
        "tertiary_industry_population": tertiary,
        "agriculture_share": share(agriculture, classified),
        "primary_industry_share": share(primary, classified),
        "secondary_industry_share": share(secondary, classified),
        "tertiary_industry_share": share(tertiary, classified),
    }


def main() -> int:
    args = parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)
    if not input_path.exists():
        raise FileNotFoundError(f"Excel原本が見つかりません: {input_path}")

    records = parse_xlsx(input_path)
    entries = [to_entry(records[code]) for code in sorted(records)]
    if len(entries) < 2:
        raise ValueError("産業構造の自治体レコードが2件未満です")

    payload = {
        "schema_version": 1,
        "dataset": "industry",
        "reference_date": "2020-10-01",
        "scope": "employed_population_15_plus",
        "share_denominator": "industry_classified_population",
        "source": {
            "title": SOURCE_TITLE,
            "url": SOURCE_URL,
            "table_number": TABLE_NUMBER,
            "acquired_at": acquired_at(input_path),
            "raw_file": raw_file_name(input_path),
            "sha256": sha256(input_path),
        },
        "coverage": {"municipality_count": len(entries)},
        "entries": entries,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"産業構造の正規化OK: {output_path} / {len(entries)}自治体 / 基準日2020-10-01")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (FileNotFoundError, ValueError, zipfile.BadZipFile) as error:
        print(f"産業構造の正規化失敗: {error}", file=sys.stderr)
        raise SystemExit(1)
