"""Normalize MIC numeric fields only; no gift descriptions or images are published."""
import hashlib
import json
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data/raw/furusato/mic-2026"


def numeric(value, scale=1):
    if value is None or value in ("", "-", "－", "…"):
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)) or value < 0:
        raise ValueError(f"Unexpected numeric value: {value!r}")
    return round(value * scale, 2)


def load(source_id):
    metadata = json.loads((RAW / f"{source_id}.source.json").read_text())
    path = RAW / metadata["file"]
    if hashlib.sha256(path.read_bytes()).hexdigest() != metadata["sha256"]:
        raise ValueError(f"Checksum mismatch: {path}")
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    return metadata, workbook.active, list(workbook.active.values)


def keyed_rows(rows, municipalities):
    result = {}
    for row_number, row in enumerate(rows, 1):
        if row[1] != "広島県" or row[2] not in municipalities:
            continue
        code = str(row[0]).zfill(6)[:5]
        if code != municipalities[row[2]] or code in result:
            raise ValueError(f"Unexpected/duplicate municipality: {row[:3]}")
        result[code] = (row_number, row)
    if set(result) != set(municipalities.values()):
        raise ValueError("Expected exactly 23 Hiroshima municipalities")
    return result


def main():
    municipalities = {m["nameJa"]: m["code"] for m in json.loads(
        (ROOT / "config/municipalities/hiroshima.json").read_text())}
    history_source, history_sheet, history = load("history")
    receipts_source, receipts_sheet, receipts = load("receipts")
    deduction_source, deduction_sheet, deductions = load("deductions")
    # Fail closed if the published table layout changes.
    assert history[0][37] == "（単位：千円、件）"
    assert history[1][18] == "平成28年度" and history[1][36] == "令和７年度"
    assert receipts[12][3:5] == ("件数", "金額")
    assert receipts[11][17] == "合計"
    assert "決算見込" in receipts[2][0]
    assert deductions[13][54] == "市町村民税"
    assert "推計値含む" in deductions[15][56]
    receipt_rows = keyed_rows(receipts, municipalities)
    deduction_rows = keyed_rows(deductions, municipalities)
    entries = []
    found = set()
    for row_number, row in enumerate(history, 1):
        if row[0] != "広島県" or row[1] not in municipalities:
            continue
        code = municipalities[row[1]]
        if code in found:
            raise ValueError(f"Duplicate history: {code}")
        found.add(code)
        rnumber, receipt = receipt_rows[code]
        dnumber, deduction = deduction_rows[code]
        for year in range(2016, 2026):
            column = 2 + (year - 2008) * 2
            amount = numeric(row[column], 1000)
            count = numeric(row[column + 1])
            if year == 2025:
                if amount != numeric(receipt[4]) or count != numeric(receipt[3]):
                    raise ValueError(f"History/receipt mismatch: {code}")
                components = [numeric(value) for value in receipt[11:17]]
                if all(value is not None for value in components):
                    if sum(components) != numeric(receipt[17]):
                        raise ValueError(f"Expense reconciliation failed: {code}")
            entries.append({
                "municipality_code": code,
                "fiscal_year": year,
                "amount_yen": amount,
                "donation_count": count,
                "expense_yen": numeric(receipt[17]) if year == 2025 else None,
                "provisional": year == 2025,
                "source_cells": {
                    "history": f"{history_sheet.title}!{openpyxl.utils.get_column_letter(column+1)}{row_number}:{openpyxl.utils.get_column_letter(column+2)}{row_number}",
                    "receipts": f"{receipts_sheet.title}!D{rnumber}:R{rnumber}" if year == 2025 else None,
                },
            })
    if found != set(municipalities.values()):
        raise ValueError("Incomplete history coverage")
    result = {
        "schema_version": "1.0",
        "sources": [history_source, receipts_source, deduction_source],
        "entries": sorted(entries, key=lambda e: (e["municipality_code"], e["fiscal_year"])),
        "deductions": [{
            "municipality_code": code,
            "tax_year": 2026,
            "municipal_tax_deduction_yen": numeric(row[56]),
            "includes_estimates": True,
            "source_cell": f"{deduction_sheet.title}!BE{number}",
        } for code, (number, row) in sorted(deduction_rows.items())],
    }
    output = ROOT / "data/processed/furusato/mic-2026.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(f"Validated {len(entries)} receipt rows and {len(result['deductions'])} deduction rows")


if __name__ == "__main__":
    main()
