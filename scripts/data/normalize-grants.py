"""Extract Hiroshima grant awards from the stored PDFs; no hand-typed figures.

原本のPDFから広島県内23市町の採択行を機械的に抜き出す。原本が表になっていない
もの（図で示される採択団体一覧など）と、原本を保存できていないものは
`config/grants/manual-entries.json` に分けて置き、抽出結果と結合する。

テキスト抽出には Poppler の `pdftotext` を使う。DEVELOPMENT 8 の外部ツール依存。
"""
import hashlib
import html
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data/raw/grants"

SOURCES = {
    "digital_implementation_2022": {
        "id": "digital_implementation_2022",
        "program": "デジタル田園都市国家構想交付金",
        "title": "デジタル田園都市国家構想交付金（令和4年度第2次補正予算分）採択結果について",
        "url": "https://www.chisou.go.jp/sousei/about/kouhukin/pdf/saitaku.pdf",
        "path": "digital-implementation/2022/saitaku.pdf",
        "sha256": "a1dfacc15562537f32c896e15d979d94de1a0eac169f1d8c5ef79945ac980228",
        "page_basis": "file",
    },
    "regional_future_2026": {
        "id": "regional_future_2026",
        "program": "地域未来交付金",
        "title": "地域未来交付金（地域未来推進型）の交付対象事業の決定について",
        "url": "https://www.chisou.go.jp/sousei/about/kouhukin/pdf/r8_suishin_1.pdf",
        "path": "regional-future/2026/r8_suishin_1.pdf",
        "sha256": "949ece75408f71e3ac9f4c8cc26752ac15a6210769ec745480c7958ed2385cb2",
        "page_basis": "file",
    },
    "environment_friendly_2024": {
        "id": "environment_friendly_2024",
        "program": "環境保全型農業直接支払交付金",
        "title": "令和6年度環境保全型農業直接支払交付金の実施状況（都道府県別・市町村別）",
        "url": "https://www.maff.go.jp/j/seisan/kankyo/kakyou_chokubarai/other/attach/pdf/jisshijyoukyou-22.pdf",
        "path": "environment-friendly/2024/jisshijyoukyou-22.pdf",
        "sha256": "ad1a13fa5d5fa66e642983bcff6b72bd75af36fe5045743e126c6f821bd642a1",
        "page_basis": "file",
    },
    "hiroshima_lodging_tax_2026": {
        "id": "hiroshima_lodging_tax_2026",
        "program": "宿泊税を活用した市町補助金",
        "title": "宿泊税を活用した市町補助金 交付決定事業一覧（2026年8月31日時点）",
        "url": "https://www.pref.hiroshima.lg.jp/soshiki/78/shityouhojyokin.html",
        "path": "hiroshima-lodging-tax/2026/shityouhojyokin.html",
        "sha256": "572b23566e9351ea892c153a4dc1404b0bf0d2960c9b1645b1667852b2931fed",
        "page_basis": "file",
    },
    "multifunctional_2021": {
        "id": "multifunctional_2021",
        "program": "多面的機能支払交付金",
        "title": "令和3年度 多面的機能支払交付金の市町村別取組状況",
        "url": "https://www.maff.go.jp/chushi/chusankan/attach/pdf/nihongata-50.pdf",
        "path": "multifunctional/2021/nihongata-50.pdf",
        "sha256": "b4d021241144b6c545840b42b8425b875691fe9d44f170bd2dc24dc36dd891fc",
        "page_basis": "file",
    },
}

MUNICIPALITIES = {
    m["nameJa"]: m["code"]
    for m in json.loads((ROOT / "config/municipalities/hiroshima.json").read_text())
}
NAMES = sorted(MUNICIPALITIES, key=len, reverse=True)
PREFECTURE_HEAD = re.compile(r"\s*(北海道|東京都|京都府|大阪府|.{2,3}県)")
TRAILING_NUMBER = re.compile(r"([0-9,]+)\s*$")


def pages(source_id):
    source = SOURCES[source_id]
    path = RAW / source["path"]
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if digest != source["sha256"]:
        raise ValueError(f"Checksum mismatch: {path}")
    text = subprocess.run(
        ["pdftotext", "-layout", str(path), "-"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    return text.split("\f")


def regional_future():
    """別紙1の「地方公共団体名／交付対象事業名／採択額（千円）」の行を拾う。

    事業名が長い行は、団体名の行から上下へ折り返されている。折り返しは
    都道府県名で始まらない行に限って連結する。
    """
    entries = []
    pattern = re.compile(r"広島県\s*(" + "|".join(NAMES) + r")\s")
    for page_number, page in enumerate(pages("regional_future_2026"), 1):
        lines = page.split("\n")
        for index, line in enumerate(lines):
            matched = pattern.search(line + " ")
            if not matched:
                continue
            amount = TRAILING_NUMBER.search(line.rstrip())
            if not amount:
                continue
            middle = line[matched.end() : amount.start()].strip()
            if not middle:
                before = next(
                    (l.strip() for l in reversed(lines[:index]) if l.strip()), ""
                )
                after = next((l.strip() for l in lines[index + 1 :] if l.strip()), "")
                before = "" if PREFECTURE_HEAD.match(before) else before
                after = "" if PREFECTURE_HEAD.match(after) else after
                middle = (before + after).strip()
            if not middle:
                raise ValueError(f"事業名を読めない行: p{page_number} {line!r}")
            entries.append(
                {
                    "municipality_code": MUNICIPALITIES[matched.group(1)],
                    "municipality_name": matched.group(1),
                    "fiscal_year": 2026,
                    "provider": "national",
                    "program": "地域未来交付金",
                    "category": "地域未来推進型",
                    "award_count": 1,
                    "amount_yen": int(amount.group(1).replace(",", "")) * 1000,
                    "project_name": middle,
                    "source_id": "regional_future_2026",
                    "source_page": page_number,
                    "verification_status": "double_checked",
                }
            )
    return entries


def multifunctional():
    """広島県ブロックの「取組組織数／取組面積／交付金額（百万円）」を拾う。"""
    entries = []
    for page_number, page in enumerate(pages("multifunctional_2021"), 1):
        if "広島県 計" not in page:
            continue
        if "単位：百万円" not in page.replace(" ", "") and "百万円" not in page:
            raise ValueError("交付金額の単位が百万円であることを確認できない")
        inside = False
        for line in page.split("\n"):
            stripped = line.strip()
            if stripped.startswith("広島県") and "計" not in stripped:
                inside = True
                continue
            if not inside:
                continue
            if stripped.startswith("広島県 計") or stripped.startswith("山口県"):
                break
            parts = stripped.split()
            if len(parts) != 8 or parts[0] not in MUNICIPALITIES:
                continue
            numbers = [int(p.replace(",", "")) for p in parts[1:7]]
            amount = float(parts[7].replace(",", ""))
            entries.append(
                {
                    "municipality_code": MUNICIPALITIES[parts[0]],
                    "municipality_name": parts[0],
                    "fiscal_year": 2021,
                    "provider": "national",
                    "program": "多面的機能支払交付金",
                    "category": "農地維持・資源向上",
                    "award_count": 1,
                    # 原本は百万円単位の丸めた値。円へ直しても精度は百万円のまま。
                    "amount_yen": int(round(amount * 1_000_000)),
                    "project_name": (
                        f"令和3年度市町村別取組状況・農地維持{numbers[0]}組織"
                        f"・取組面積{numbers[1]}ha"
                    ),
                    "source_id": "multifunctional_2021",
                    "source_page": page_number,
                    "verification_status": "double_checked",
                }
            )
        break
    if len(entries) != 17:
        raise ValueError(f"広島県の市町行が17でない: {len(entries)}")
    return entries


def environment_friendly():
    """広島県のページから「実施件数／実施面積／交付金額（千円）」を拾う。

    取組実績のない市町村は原本の表に載らないため、23市町すべてが揃うとは限らない。
    合計行と突き合わせて、読み落としがないことを確かめる。
    """
    entries = []
    total_declared = None
    for page_number, page in enumerate(pages("environment_friendly_2024"), 1):
        if "実施状況 （広島県）" not in page.replace("⽀", "支"):
            continue
        if "（単位：千円）" not in page:
            raise ValueError("交付金額の単位が千円であることを確認できない")
        for line in page.split("\n"):
            parts = line.split()
            if len(parts) < 5:
                continue
            if parts[0] == "合" and parts[1] == "計":
                total_declared = int(parts[-1].replace(",", ""))
                continue
            if not parts[0].isdigit() or parts[1] not in MUNICIPALITIES:
                continue
            entries.append(
                {
                    "municipality_code": MUNICIPALITIES[parts[1]],
                    "municipality_name": parts[1],
                    "fiscal_year": 2024,
                    "provider": "national",
                    "program": "環境保全型農業直接支払交付金",
                    "category": "市町村別実施状況",
                    "award_count": 1,
                    # 原本は千円単位。国と地方公共団体の交付額の合計（交付割合1:1）。
                    "amount_yen": int(parts[-1].replace(",", "")) * 1000,
                    "project_name": (
                        f"令和6年度実施状況・実施件数{parts[2]}件"
                        f"・実施面積{parts[3]}ha"
                    ),
                    "source_id": "environment_friendly_2024",
                    "source_page": page_number,
                    "verification_status": "double_checked",
                }
            )
        break
    if total_declared is None:
        raise ValueError("広島県の合計行を読めない")
    total = sum(entry["amount_yen"] for entry in entries) // 1000
    if total != total_declared:
        raise ValueError(f"交付金額の合計が合わない: {total} != {total_declared}")
    return entries


def lodging_tax():
    """県のHTMLの交付決定事業一覧から、市町ごとの事業名と交付決定金額を拾う。

    原本はPDFではなくHTMLで、交付決定のたびに更新される。取得時点を固定するため
    スナップショットを保存し、ハッシュで照合する。ページに年度の記載が無いので
    年度は持たせない（値を作らない）。
    """
    source = SOURCES["hiroshima_lodging_tax_2026"]
    path = RAW / source["path"]
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if digest != source["sha256"]:
        raise ValueError(f"Checksum mismatch: {path}")
    doc = path.read_text(encoding="utf-8", errors="replace")

    table = re.search(r"<table.*?</table>", doc, re.S)
    if not table:
        raise ValueError("交付決定事業一覧の表が見つからない")

    def cell(fragment):
        return html.unescape(re.sub(r"<[^>]+>", "", fragment)).replace("\u3000", " ").strip()

    entries = []
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", table.group(0), re.S):
        cells = [cell(c) for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S)]
        if len(cells) < 5 or cells[0] not in MUNICIPALITIES:
            continue
        amount = re.fullmatch(r"([0-9,]+)円", cells[-1].replace(" ", ""))
        if not amount:
            raise ValueError(f"交付決定金額を読めない: {cells[0]} {cells[-1]!r}")
        entries.append(
            {
                "municipality_code": MUNICIPALITIES[cells[0]],
                "municipality_name": cells[0],
                # 原本に年度の記載が無いため、年度は持たせない。
                "fiscal_year": None,
                "provider": "hiroshima_prefecture",
                "program": "宿泊税を活用した市町補助金",
                "category": "交付決定事業",
                "award_count": 1,
                "amount_yen": int(amount.group(1).replace(",", "")),
                "project_name": cells[1] or None,
                "source_id": "hiroshima_lodging_tax_2026",
                # HTMLのためページ番号を持たない。
                "source_page": None,
                "verification_status": "double_checked",
            }
        )
    if len(entries) < 23:
        raise ValueError(f"交付決定の行が少なすぎる: {len(entries)}")
    return entries


def main():
    manual = json.loads((ROOT / "config/grants/manual-entries.json").read_text())
    extracted = (
        regional_future()
        + multifunctional()
        + environment_friendly()
        + lodging_tax()
    )
    for entry in extracted:
        if entry["municipality_code"] not in MUNICIPALITIES.values():
            raise ValueError(f"広島県外の自治体: {entry}")

    result = {
        "schema_version": "2.0",
        "sources": [
            {
                "id": source["id"],
                "program": source["program"],
                "title": source["title"],
                "url": source["url"],
                "file": Path(source["path"]).name,
                "sha256": source["sha256"],
                "page_basis": source["page_basis"],
            }
            for source in SOURCES.values()
        ],
        "unsourced_programs": manual["unsourced_programs"],
        "entries": sorted(
            extracted + manual["entries"],
            key=lambda e: (e["municipality_code"], e["program"], -(e["amount_yen"] or 0)),
        ),
        "review_entries": sorted(
            manual["review_entries"],
            key=lambda e: (e["municipality_code"], e["program"]),
        ),
    }
    output = ROOT / "data/processed/grants/grants.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(
        f"抽出 {len(extracted)}件 + 手入力 {len(manual['entries'])}件"
        f" / 未照合 {len(result['review_entries'])}件"
    )


if __name__ == "__main__":
    main()
