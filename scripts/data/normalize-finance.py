"""Normalize the verified e-Stat and Hiroshima prefecture finance snapshot."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path

import openpyxl

from finance_sources import (
    ESTAT_PAGE_URL,
    ESTAT_FISCAL_STRENGTH_FILE,
    ESTAT_FISCAL_STRENGTH_TITLE,
    ESTAT_FISCAL_STRENGTH_URL,
    FINANCE_TITLE,
    PUBLISHED_RATIO_TITLE,
    PUBLISHED_RATIO_URL,
    PREFECTURE_PAGE_URL,
    RAW_ROOT,
    source_definitions,
)

OUTPUT = Path(__file__).resolve().parents[2] / "data/processed/finance/finance.json"
FISCAL_YEAR = "2024"
MUNICIPALITIES_PATH = Path(__file__).resolve().parents[2] / "config/municipalities/hiroshima.json"

REVENUE_LABELS = [
    "地方税", "地方譲与税", "利子割交付金", "配当割交付金", "株式等譲渡所得割交付金",
    "分離課税所得割交付金", "地方消費税交付金", "ゴルフ場利用税交付金",
    "軽油引取税・自動車取得税交付金", "自動車税環境性能割交付金", "法人事業税交付金",
    "地方特例交付金等", "地方交付税", "交通安全対策特別交付金", "分担金及び負担金",
    "使用料", "手数料", "国庫支出金", "国有提供施設等所在市町村助成交付金",
    "都道府県支出金", "財産収入", "寄附金", "繰入金", "繰越金", "諸収入", "地方債",
]
PURPOSE_COLUMNS = {
    "table07-2.csv": {"議会費": "議会費", "総務費・総額": "総務費"},
    "table08-2.csv": {
        "民生費・総額": "民生費", "民生費・社会福祉費": "社会福祉費",
        "民生費・老人福祉費": "老人福祉費", "民生費・児童福祉費": "児童福祉費",
        "衛生費・総額": "衛生費",
    },
    "table09-2.csv": {
        "労働費・総額": "労働費", "農林水産業費・総額": "農林水産業費", "商工費": "商工費",
    },
    "table10-2.csv": {"土木費・総額": "土木費"},
    "table11-2.csv": {
        "消防費": "消防費", "教育費・総額": "教育費", "教育費・小学校費": "小学校費",
        "教育費・中学校費": "中学校費", "教育費・社会教育費": "社会教育費",
    },
    "table12-2.csv": {
        "災害復旧費・総額": "災害復旧費", "公債費": "公債費",
        "諸支出金・総額": "諸支出金", "前年度繰上充用金": "前年度繰上充用金",
    },
}
NATURE_LABELS = [
    "人件費", "うち退職手当債を財源とするもの", "物件費", "維持補修費", "扶助費", "補助費等",
    "内訳・一部事務組合に対するもの", "内訳・7行以外のもの", "公債費", "内訳・元利償還金・元金",
    "内訳・元利償還金・利子", "内訳・一時借入金利子", "積立金", "投資及び出資金・貸付金", "繰出金",
    "前年度繰上充用金", "投資的経費", "投資的経費・うち人件費", "投資的経費・普通建設事業費",
    "投資的経費・普通建設事業費・うち単独事業費", "投資的経費・災害復旧事業費", "歳出合計",
]


def parse_fiscal_strength_value(value: object, *, context: str) -> float:
    """Parse the D2201 index, preserving its published decimal precision."""

    if value is None or str(value).strip() in {"", "-", "－", "…", "―", "..."}:
        raise ValueError(f"財政力指数が欠損しています ({context})")
    try:
        parsed = float(str(value).strip().replace(",", ""))
    except ValueError as error:
        raise ValueError(f"財政力指数を読めません ({context}): {value!r}") from error
    if parsed < 0:
        raise ValueError(f"財政力指数が負です ({context}): {value!r}")
    return parsed


def parse_amount(value: str | int | float | None, *, context: str) -> int:
    if value is None:
        return 0
    text = str(value).strip().replace(",", "")
    if text in {"", "-", "－", "…", "―"}:
        return 0
    try:
        number = float(text)
    except ValueError as error:
        raise ValueError(f"数値を読めません ({context}): {value!r}") from error
    if not number.is_integer() or number < 0:
        raise ValueError(f"非負整数ではありません ({context}): {value!r}")
    return int(number)


def load_municipalities() -> list[dict[str, str]]:
    values = json.loads(MUNICIPALITIES_PATH.read_text(encoding="utf-8"))
    if not isinstance(values, list) or len(values) != 23:
        raise ValueError("広島県の自治体設定は23件必要です")
    return [{"code": str(item["code"]), "name": str(item["nameJa"])} for item in values]


def verify_manifest(raw_root: Path, municipalities: list[dict[str, str]]) -> tuple[dict, dict[str, dict]]:
    manifest_path = raw_root / "source.json"
    if not manifest_path.is_file():
        raise FileNotFoundError(
            f"財務原本のmanifestがありません: {manifest_path}。先に pnpm acquire:finance を実行してください。"
        )
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    validate_acquired_at(manifest.get("acquired_at"), context="finance source.json")
    if manifest.get("fiscal_year") != FISCAL_YEAR:
        raise ValueError("finance source.json の fiscal_year が対象年度と一致しません")
    expected = {item["file"]: item for item in source_definitions([m["code"] for m in municipalities])}
    listed = {item.get("file"): item for item in manifest.get("sources", [])}
    if set(listed) != set(expected):
        raise ValueError("finance source.json のファイル一覧が正規化対象と一致しません")
    for relative, expected_definition in expected.items():
        item = listed[relative]
        path = raw_root / relative
        if not path.is_file():
            raise FileNotFoundError(f"財務原本がありません: {path}")
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != item.get("sha256"):
            raise ValueError(f"原本のSHA-256がmanifestと一致しません: {path}")
        if item.get("url") != expected_definition["url"]:
            raise ValueError(f"原本URLが定義と一致しません: {relative}")
        if "acquired_at" in item:
            validate_acquired_at(item["acquired_at"], context=f"finance source.json の {relative}")
    return manifest, listed


def validate_acquired_at(value: object, *, context: str) -> str:
    if not isinstance(value, str) or not value:
        raise ValueError(f"{context} に acquired_at がありません")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError(f"{context} の acquired_at がISO日時ではありません") from error
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError(f"{context} の acquired_at にはタイムゾーンが必要です")
    return value


def source_acquired_at(manifest: dict, item: dict) -> str:
    """後から追記した原本はファイル単位の取得日時を優先し、なければスナップショット全体の値を使う。"""

    return item.get("acquired_at") or manifest["acquired_at"]


def read_csv_table(path: Path) -> tuple[list[str], dict[tuple[str, str], dict]]:
    with path.open(encoding="cp932", newline="") as stream:
        rows = list(csv.reader(stream))
    if not rows or len(rows[0]) < 11 or rows[0][0].strip() != "決算年度":
        raise ValueError(f"e-Stat CSVの見出しが不正です: {path}")
    columns = [cell.split(":", 1)[1] if ":" in cell else cell for cell in rows[0][10:]]
    table: dict[tuple[str, str], dict] = {}
    for row in rows[1:]:
        if len(row) < 10:
            continue
        if row[0].strip() != FISCAL_YEAR or row[3].strip() != "広島県":
            continue
        raw_code = row[2].strip()
        if len(raw_code) != 6 or not raw_code.startswith("34"):
            continue
        code = raw_code[:5]
        key = (code, row[8].strip())
        if key in table:
            raise ValueError(f"CSVに同一団体・行番号の重複があります: {path} {key}")
        values = {
            column: parse_amount(value, context=f"{path.name}:{code}:{row[8]}:{column}")
            for column, value in zip(columns, row[10:])
        }
        table[key] = {"label": row[9].strip(), "values": values}
    if not table:
        raise ValueError(f"広島県の行が見つかりません: {path}")
    return columns, table


def row_by_label(table: dict[tuple[str, str], dict], code: str, label: str) -> dict:
    matches = [value for (row_code, _), value in table.items() if row_code == code and value["label"] == label]
    if len(matches) != 1:
        raise ValueError(f"{code} の行「{label}」が一意ではありません: {len(matches)}件")
    return matches[0]


def row_by_number(table: dict[tuple[str, str], dict], code: str, number: str) -> dict:
    try:
        return table[(code, number)]
    except KeyError as error:
        raise ValueError(f"{code} の行番号 {number} がありません") from error


def xlsx_indicators(path: Path) -> tuple[int, int, int]:
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    if "普通会計の状況" not in workbook.sheetnames:
        raise ValueError(f"普通会計の状況シートがありません: {path}")
    sheet = workbook["普通会計の状況"]
    general_revenue: int | None = None
    deficit: int | None = None
    fiscal_adjustment: int | None = None
    for row in sheet.iter_rows(values_only=True):
        # The prefecture workbook reserves column A for a category marker; the
        # human-readable row label is in column B.
        label = str(row[1]).strip() if len(row) > 1 and row[1] is not None else ""
        if label == "歳入合計":
            general_revenue = parse_amount(row[29] if len(row) > 29 else None, context=f"{path.name}:歳入合計")
        if "減収補" in label and "特例" in label:
            deficit = parse_amount(row[17] if len(row) > 17 else None, context=f"{path.name}:{label}")
        if "臨時財政対策債" in label:
            fiscal_adjustment = parse_amount(row[17] if len(row) > 17 else None, context=f"{path.name}:{label}")
    workbook.close()
    if general_revenue is None or deficit is None or fiscal_adjustment is None:
        raise ValueError(f"経常収支比率の算定元行を確認できません: {path}")
    # The prefecture workbook records these cells in thousands of yen.
    return general_revenue * 1000, deficit * 1000, fiscal_adjustment * 1000


def fiscal_strength_index(path: Path, codes: list[str]) -> tuple[str, dict[str, float]]:
    """Read the official D2201 column from the e-Stat administrative-base workbook.

    The 2026 publication is distributed as a legacy .xls file, so convert it in
    a temporary directory before handing it to openpyxl.  Header positions are
    detected by their D2201/code labels rather than hard-coded columns.
    """

    with tempfile.TemporaryDirectory(prefix="finance-fiscal-strength-") as directory:
        converted = path
        if path.suffix.lower() != ".xlsx":
            try:
                subprocess.run(
                    [
                        str(Path(os.environ.get("SOFFICE_BIN", "soffice"))),
                        "--headless",
                        "--convert-to",
                        "xlsx",
                        "--outdir",
                        directory,
                        str(path),
                    ],
                    check=True,
                    capture_output=True,
                    text=True,
                )
            except FileNotFoundError as error:
                raise RuntimeError(
                    "財政力指数の旧形式Excel変換にはLibreOfficeのsofficeが必要です"
                ) from error
            except subprocess.CalledProcessError as error:
                detail = (error.stderr or error.stdout or "").strip()
                raise RuntimeError(
                    f"財政力指数Excelの変換に失敗しました: {detail}"
                ) from error
            candidates = list(Path(directory).glob("*.xlsx"))
            if len(candidates) != 1:
                raise ValueError(f"財政力指数Excelの変換結果が一意ではありません: {path}")
            converted = candidates[0]

        workbook = openpyxl.load_workbook(converted, read_only=True, data_only=True)
        if "D" not in workbook.sheetnames:
            raise ValueError(f"行政基盤シートがありません: {path}")
        sheet = workbook["D"]
        d2201_column: int | None = None
        code_column: int | None = None
        year: str | None = None
        for row in sheet.iter_rows(min_row=1, max_row=15, values_only=True):
            for index, value in enumerate(row, start=1):
                text = str(value).replace("\n", "").strip() if value is not None else ""
                if text == "D2201":
                    d2201_column = index
                if "市区町村" in text and ("コード" in text or "ｺｰﾄﾞ" in text):
                    code_column = index
        if d2201_column is None or code_column is None:
            raise ValueError(f"D2201または自治体コード列が見つかりません: {path}")
        for row in sheet.iter_rows(min_row=1, max_row=15, values_only=True):
            value = row[d2201_column - 1] if len(row) >= d2201_column else None
            if value is not None and re.fullmatch(r"\d{4}", str(value).strip()):
                year = str(value).strip()
                break
        if year is None:
            raise ValueError(f"財政力指数の調査年度が見つかりません: {path}")

        values: dict[str, float] = {}
        wanted = set(codes)
        for row in sheet.iter_rows(min_row=11, values_only=True):
            if len(row) < max(d2201_column, code_column):
                continue
            raw_code = row[code_column - 1]
            code = str(raw_code).strip() if raw_code is not None else ""
            if code.endswith(".0"):
                code = code[:-2]
            if code not in wanted:
                continue
            if code in values:
                raise ValueError(f"財政力指数に同一自治体コードの重複があります: {code}")
            values[code] = parse_fiscal_strength_value(
                row[d2201_column - 1], context=f"{path.name}:{code}:{year}"
            )
        workbook.close()
        missing = sorted(wanted - values.keys())
        if missing:
            raise ValueError(f"財政力指数に広島県23市町の行がありません: {missing}")
        return year, values


def pdf_ratios(path: Path, names: list[str]) -> dict[str, float]:
    try:
        result = subprocess.run(
            ["pdftotext", "-layout", str(path), "-"], check=True, capture_output=True, text=True
        )
    except FileNotFoundError as error:
        raise RuntimeError("PDF比率の抽出にはpdftotext (Poppler) が必要です") from error
    text = result.stdout
    markers = list(re.finditer(r"経常収支比率\s+地方債現在高", text))
    if not markers:
        raise ValueError(f"PDFに経常収支比率の表がありません: {path}")
    # The report mentions the ratio in narrative and historical charts too;
    # the final matching header is the municipality-level table.
    section = text[markers[-1].start() :]
    ratios: dict[str, float] = {}
    for line in section.splitlines():
        compact = re.sub(r"\s+", "", line)
        for name in names:
            if name in ratios or name not in compact:
                continue
            tail = compact.split(name, 1)[1]
            match = re.match(r"(\d+(?:\.\d+)?)", tail)
            if match:
                ratios[name] = float(match.group(1))
    missing = [name for name in names if name not in ratios]
    if missing:
        raise ValueError(f"PDFから経常収支比率を抽出できません: {missing}")
    return ratios


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw-root", type=Path, default=RAW_ROOT)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    raw_root = args.raw_root.resolve()
    output = args.output.resolve()
    municipalities = load_municipalities()
    manifest, listed = verify_manifest(raw_root, municipalities)

    tables: dict[str, tuple[list[str], dict]] = {}
    for name in source_definitions([m["code"] for m in municipalities]):
        relative = name["file"]
        if relative.startswith("estat-2025/"):
            tables[Path(relative).name] = read_csv_table(raw_root / relative)

    codes = [m["code"] for m in municipalities]
    for table_name, (_, table) in tables.items():
        found = {code for (code, _) in table}
        missing = set(codes) - found
        if missing:
            raise ValueError(f"{table_name} に広島県23市町の行がありません: {sorted(missing)}")

    purpose_values: dict[str, dict[str, int]] = {code: {} for code in codes}
    for table_name, mapping in PURPOSE_COLUMNS.items():
        _, table = tables[table_name]
        for code in codes:
            total = row_by_label(table, code, "歳出合計")
            for column, output_label in mapping.items():
                if column not in total["values"]:
                    raise ValueError(f"{table_name} に列 {column} がありません")
                purpose_values[code][output_label] = total["values"][column] * 1000
    for code in codes:
        purpose_values[code]["歳出合計"] = sum(
            purpose_values[code][label]
            for label in ["議会費", "総務費", "民生費", "衛生費", "労働費", "農林水産業費", "商工費", "土木費", "消防費", "教育費", "災害復旧費", "公債費", "諸支出金", "前年度繰上充用金"]
        )

    nature_values: dict[str, dict[str, int]] = {code: {} for code in codes}
    for code in codes:
        for label in NATURE_LABELS:
            source_table = tables["table14-1.csv"][1] if label != "歳出合計" else tables["table14-2.csv"][1]
            row = row_by_label(source_table, code, label)
            nature_values[code][label] = row["values"]["決算額"] * 1000
        if purpose_values[code]["歳出合計"] != nature_values[code]["歳出合計"]:
            raise ValueError(f"目的別と性質別の歳出合計が一致しません: {code}")

    revenue_values: dict[str, dict[str, int]] = {code: {} for code in codes}
    revenue_rows = {code: {} for code in codes}
    for table_name in ("table05-1.csv", "table05-2.csv"):
        _, table = tables[table_name]
        for (code, _), row in table.items():
            if code in revenue_rows:
                revenue_rows[code][row["label"]] = row
    for code in codes:
        for label in REVENUE_LABELS:
            if label not in revenue_rows[code]:
                raise ValueError(f"{code} の歳入行がありません: {label}")
            revenue_values[code][label] = revenue_rows[code][label]["values"]["決算額"] * 1000
        revenue_total = revenue_rows[code]["（歳入合計）"]["values"]["決算額"] * 1000
        if sum(revenue_values[code].values()) != revenue_total:
            raise ValueError(f"歳入の款合計と歳入合計が一致しません: {code}")
        revenue_values[code]["歳入合計"] = revenue_total

    details: dict[str, dict] = {code: {"地方交付税": {}, "地方譲与税": {}, "諸収入": {}, "地方債": {}} for code in codes}
    _, table04 = tables["table04.csv"]
    detail_columns = {
        "地方交付税": {"普通交付税": "普通交付税", "特別交付税": "特別交付税", "震災復興特別交付税": "震災復興特別交付税"},
        "地方譲与税": {"地方揮発油譲与税": "地方揮発油譲与税", "特別とん譲与税": "特別とん譲与税", "石油ガス譲与税": "石油ガス譲与税", "自動車重量譲与税": "自動車重量譲与税", "航空機燃料譲与税": "航空機燃料譲与税", "森林環境譲与税": "森林環境譲与税"},
    }
    for code in codes:
        row = row_by_number(table04, code, "01")
        for group, mapping in detail_columns.items():
            for column, output_label in mapping.items():
                details[code][group][output_label] = row["values"][column] * 1000
        for label, row_number in (("収益事業収入", "26"), ("各種貸付金元利収入", "27"), ("その他", "28")):
            details[code]["諸収入"][label] = row_by_number(tables["table05-2.csv"][1], code, row_number)["values"]["決算額"] * 1000
        for label, row_number in (("都道府県貸付金", "30"), ("減収補塡債特例分", "31"), ("臨時財政対策債", "32")):
            details[code]["地方債"][label] = row_by_number(tables["table05-2.csv"][1], code, row_number)["values"]["決算額"] * 1000

    ratio_file = raw_root / "hiroshima-kessan/2024/658760.pdf"
    ratios = pdf_ratios(ratio_file, [m["name"] for m in municipalities])
    indicators = []
    for municipality in municipalities:
        code = municipality["code"]
        xlsx_relative = f"hiroshima-shiryoshu/2024/{code}.xlsx"
        general_revenue, deficit, fiscal_adjustment = xlsx_indicators(raw_root / xlsx_relative)
        current_expenditure = tables["table14-2.csv"][1]
        expenditure_general = row_by_label(current_expenditure, code, "歳出合計")["values"]["左の内訳・一般財源等"] * 1000
        denominator = general_revenue + deficit + fiscal_adjustment
        if denominator <= 0:
            raise ValueError(f"経常収支比率の分母が0以下です: {code}")
        calculated_ratio = round(expenditure_general / denominator * 100, 1)
        if calculated_ratio != round(ratios[municipality["name"]], 1):
            raise ValueError(
                f"県PDFの経常収支比率と算定元データが一致しません: {municipality['name']} "
                f"({calculated_ratio} != {ratios[municipality['name']]})"
            )
        indicators.append(
            {
                "municipality_code": code,
                "fiscal_year": FISCAL_YEAR,
                "current_general_revenue_yen": general_revenue,
                "current_expenditure_general_funding_yen": expenditure_general,
                "deficit_compensation_bond_yen": deficit,
                "fiscal_adjustment_bond_yen": fiscal_adjustment,
                "published_ratio_percent": round(ratios[municipality["name"]], 1),
                "source_file": f"{code}.xlsx",
                "source_sha256": listed[xlsx_relative]["sha256"],
            }
        )

    fiscal_strength_relative = ESTAT_FISCAL_STRENGTH_FILE
    fiscal_strength_year, fiscal_strength_values = fiscal_strength_index(
        raw_root / fiscal_strength_relative, codes
    )
    fiscal_strength_entries = [
        {
            "municipality_code": municipality["code"],
            "fiscal_year": fiscal_strength_year,
            "value": fiscal_strength_values[municipality["code"]],
        }
        for municipality in municipalities
    ]

    entries = []
    for municipality in municipalities:
        code, name = municipality["code"], municipality["name"]
        values = purpose_values[code]
        revenue = {**revenue_values[code]}
        entries.append(
            {
                "municipality_code": code,
                "municipality_name": name,
                "fiscal_year": FISCAL_YEAR,
                "source_url": ESTAT_PAGE_URL,
                "unit": "yen",
                "values": values,
                "revenue": revenue,
                "revenue_details": details[code],
                "expenditure_nature": nature_values[code],
            }
        )

    result = {
        "schema_version": "1.0",
        "source": {
            "title": FINANCE_TITLE,
            "url": ESTAT_PAGE_URL,
            "acquired_at": manifest["acquired_at"],
            "files": [
                {"file": item["file"], "url": item["url"], "sha256": item["sha256"]}
                for item in (manifest["sources"])
            ],
        },
        "financial_indicators": {
            "source": {
                "title": "令和6年度 県内市町の財政状況資料集（広島県）",
                "url": PREFECTURE_PAGE_URL,
                "note": "市町ごとのExcelの「普通会計の状況」シートから、経常一般財源等と臨時財政対策債を取る。分子の経常経費充当一般財源等は、e-Stat「地方財政状況調査 市町村分」第14表 性質別経費の状況による。",
                "acquired_at": manifest["acquired_at"],
            },
            "published_ratio_source": {
                "title": PUBLISHED_RATIO_TITLE,
                "url": PUBLISHED_RATIO_URL,
                "file": "658760.pdf",
                "sha256": listed["hiroshima-kessan/2024/658760.pdf"]["sha256"],
                "acquired_at": manifest["acquired_at"],
            },
            "fiscal_strength": {
                "source": {
                    "title": ESTAT_FISCAL_STRENGTH_TITLE,
                    "url": ESTAT_FISCAL_STRENGTH_URL,
                    "file": fiscal_strength_relative,
                    "sha256": listed[fiscal_strength_relative]["sha256"],
                    "acquired_at": source_acquired_at(
                        manifest, listed[fiscal_strength_relative]
                    ),
                    "note": "e-Stat D2201「財政力指数（市町村財政）」の公表値。値は基準財政収入額と基準財政需要額の過去3年度平均です。",
                },
                "entries": fiscal_strength_entries,
            },
            "entries": indicators,
        },
        "entries": entries,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Normalized {len(entries)} municipalities and {len(indicators)} financial indicators")


if __name__ == "__main__":
    main()
