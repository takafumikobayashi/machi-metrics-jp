"""Shared source definitions for the 2025 census acquisition/normalization pipeline."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW_ROOT = ROOT / "data/raw/census/2025"
INDEX_URL = (
    "https://www.e-stat.go.jp/stat-search/files?page=1&toukei=00200521"
    "&tstat=000001230925"
)
TITLE = "令和7年国勢調査 人口等基本集計"
REFERENCE_DATE = "2025-10-01"
COMPARISON_REFERENCE_DATE = "2020-10-01"


def _download_url(stat_inf_id: str) -> str:
    return (
        "https://www.e-stat.go.jp/stat-search/file-download?"
        f"statInfId={stat_inf_id}&fileKind=0"
    )


# 総数は原数値、割合は「不詳」を按分した不詳補完値（参考表）を使う。
# 2020年の割合も、令和7年調査と同じ方法で補完した遡及集計を使う。
SOURCES = [
    {
        "id": "population_households",
        "file": "2025-original-01-01.xlsx",
        "value_type": "original",
        "title": (
            "令和7年国勢調査 人口等基本集計（原数値） 第1-1表 男女別人口、"
            "世帯の種類別世帯数及び世帯人員並びに2020年（令和2年）の人口（組替）、"
            "2020年（令和2年）の世帯数（組替）、5年間の人口増減数、5年間の人口増減率ほか"
        ),
        "table_number": "2025-国勢調査-1-1",
        "url": _download_url("000040506423"),
    },
    {
        "id": "age_2025",
        "file": "2025-imputed-02-07.xlsx",
        "value_type": "imputed",
        "title": (
            "令和7年国勢調査 人口等基本集計（不詳補完値） 第2-7表 男女、"
            "年齢（5歳階級及び3区分）、国籍総数か日本人別人口、平均年齢、"
            "年齢中位数及び人口構成比［年齢別］"
        ),
        "table_number": "2025-国勢調査-不詳補完値-2-7",
        "url": _download_url("000040506659"),
    },
    {
        "id": "age_2020",
        "file": "2020-imputed-02-07.xlsx",
        "value_type": "imputed",
        "title": (
            "令和2年国勢調査に関する不詳補完値（遡及集計、人口等基本集計） 第2-7表 男女、"
            "年齢（5歳階級及び3区分）、国籍総数か日本人別人口、平均年齢、"
            "年齢中位数及び人口構成比［年齢別］"
        ),
        "table_number": "2020-国勢調査-不詳補完値-2-7",
        "url": _download_url("000040317626"),
    },
]
