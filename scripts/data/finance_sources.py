"""Shared source definitions for the finance acquisition/normalization pipeline."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW_ROOT = ROOT / "data/raw/finance"
ESTAT_PAGE_URL = (
    "https://www.e-stat.go.jp/stat-search/files?cycle=7&layout=datalist&month=0"
    "&result_back=1&tclass1=000001077756&tclass2=000001077757&tclass3val=0"
    "&toukei=00200251&tstat=000001077755&year=20250"
)
PREFECTURE_PAGE_URL = "https://www.pref.hiroshima.lg.jp/soshiki/36/r06zaiseijoukyou.html"
PREFECTURE_BASE_URL = "https://www.pref.hiroshima.lg.jp"
PUBLISHED_RATIO_URL = (
    "https://www.pref.hiroshima.lg.jp/uploaded/attachment/658760.pdf"
)
FINANCE_TITLE = "地方財政状況調査 市町村分（2025年公表・令和6年度決算／歳入・歳出）"
PUBLISHED_RATIO_TITLE = "令和6年度 市町決算の概要（広島県）"

# e-Stat file IDs are the identifiers shown on the official 2025 publication page.
ESTAT_CSV_FILES = {
    "table04.csv": "000040375638",
    "table05-1.csv": "000040375639",
    "table05-2.csv": "000040375640",
    "table07-1.csv": "000040375643",
    "table07-2.csv": "000040375644",
    "table08-1.csv": "000040375645",
    "table08-2.csv": "000040375646",
    "table09-1.csv": "000040375647",
    "table09-2.csv": "000040375648",
    "table10-1.csv": "000040375649",
    "table10-2.csv": "000040375650",
    "table11-1.csv": "000040375651",
    "table11-2.csv": "000040375652",
    "table12-1.csv": "000040375653",
    "table12-2.csv": "000040375654",
    "table12-3.csv": "000040375655",
    "table14-1.csv": "000040375660",
    "table14-2.csv": "000040375661",
}

# The prefecture page publishes one workbook per municipality.  Keeping the
# official hrefs here makes acquisition deterministic even if the page layout
# changes; the page URL remains the authoritative index in the manifest.
PREFECTURE_XLSX_PATHS = {
    "34100": "/uploaded/life/1114354_9619203_misc.xlsx",
    "34202": "/uploaded/life/1114354_9619182_misc.xlsx",
    "34203": "/uploaded/life/1114354_9619202_misc.xlsx",
    "34204": "/uploaded/life/1114354_9620184_misc.xlsx",
    "34205": "/uploaded/life/1114354_9620153_misc.xlsx",
    "34207": "/uploaded/life/1114354_9620154_misc.xlsx",
    "34208": "/uploaded/life/1114354_9619186_misc.xlsx",
    "34209": "/uploaded/life/1114354_9619187_misc.xlsx",
    "34210": "/uploaded/life/1114354_9620174_misc.xlsx",
    "34211": "/uploaded/life/1114354_9619189_misc.xlsx",
    "34212": "/uploaded/life/1114354_9620176_misc.xlsx",
    "34213": "/uploaded/life/1114354_9619191_misc.xlsx",
    "34214": "/uploaded/life/1114354_9619192_misc.xlsx",
    "34215": "/uploaded/life/1114354_9620177_misc.xlsx",
    "34302": "/uploaded/life/1114354_9619194_misc.xlsx",
    "34304": "/uploaded/life/1114354_9619195_misc.xlsx",
    "34307": "/uploaded/life/1114354_9619204_misc.xlsx",
    "34309": "/uploaded/life/1114354_9619201_misc.xlsx",
    "34368": "/uploaded/life/1114354_9620179_misc.xlsx",
    "34369": "/uploaded/life/1114354_9620180_misc.xlsx",
    "34431": "/uploaded/life/1114354_9620181_misc.xlsx",
    "34462": "/uploaded/life/1114354_9620182_misc.xlsx",
    "34545": "/uploaded/life/1114354_9619200_misc.xlsx",
}


def estat_url(file_name: str) -> str:
    """Return the stable download URL for an e-Stat CSV."""

    return (
        "https://www.e-stat.go.jp/stat-search/file-download?fileKind=1&statInfId="
        + ESTAT_CSV_FILES[file_name]
    )


def source_definitions(municipality_codes: list[str]) -> list[dict[str, str]]:
    """Return expected raw files in the order used by the manifest."""

    sources = [
        {
            "file": f"estat-2025/{name}",
            "url": estat_url(name),
            "title": f"e-Stat 地方財政状況調査 表{name.removeprefix('table').replace('.csv', '')}",
        }
        for name in ESTAT_CSV_FILES
    ]
    sources.extend(
        {
            "file": f"hiroshima-shiryoshu/2024/{code}.xlsx",
            "url": PREFECTURE_BASE_URL + PREFECTURE_XLSX_PATHS[code],
            "title": f"令和6年度市町別普通会計決算の状況（{code}）",
        }
        for code in municipality_codes
    )
    sources.append(
        {
            "file": "hiroshima-kessan/2024/658760.pdf",
            "url": PUBLISHED_RATIO_URL,
            "title": PUBLISHED_RATIO_TITLE,
        }
    )
    return sources
