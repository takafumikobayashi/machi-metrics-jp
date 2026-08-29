# Data scripts

データ処理は次の小さな段階に分けて追加します。

```text
acquire → normalize → validate → derive → publish
```

現時点では、対象期間・23市町・類似度設定の検証、全60原本の正規化、公開JSONのstaging検証まで実装しています。

```bash
pnpm validate:data
```

## パイロット正規化

2016年・2025年の`-03`・`-04`原本から、広島市（`34100`）と安芸高田市（`34214`）を抽出します。
旧Excel形式（`.xls`）と新Excel形式（`.xlsx`）の両方を扱うため、ローカルにLibreOfficeの`soffice`が必要です。
原本は変更せず、一時CSVへ変換してから解析します。

```bash
pnpm normalize:data -- --years 2016,2025 --municipalities 34100,34214
```

出力先は次のとおりです。

- `data/staging/juki/<year>/pilot.json`: 原表の列を保った抽出結果
- `data/processed/juki/<year>/pilot.json`: 共通モデルへ正規化した結果と検算値

`-03`の社会増減は、転入−転出の単純計算値で上書きせず、原表の報告値と差分を保持します。

全量処理では、2016〜2025年の23市町を指定します。正規化結果はGit管理外の`data/staging`・`data/processed`に生成されます。

## 正規化結果から公開JSONへの変換

公開JSONのスキーマと横断検証は既存の`src/lib/data/`を利用します。次の処理は、正規化済みの総計データと拡張データを公開JSONの形へ変換し、スキーマ検証と横断検証を通過した場合だけパイロット出力を配置します。

```bash
pnpm publish:data -- \
  --years 2016,2025 \
  --municipalities 34100,34214 \
  --release-id juki-2016-2025-pilot-v1
```

既定の出力先は`data/staging/public-juki`です。`public/data`や本番用の`latest.json`は変更しません。現段階では2自治体・2時点のパイロットであり、類似自治体の候補集合も選択自治体内に限定されるため、全国公開用には使用しません。

## 拡張データの公開

拡張正規化データ（`-07`、`-08`、`-11`、`-12`）は、既存の公開JSON契約を変更せず、リリース内の`extended/municipality/<コード>.json`へ出力します。ここには日本人住民・外国人住民ごとの人口、人口動態、5歳階級別人口を収録します。公開先に既存リリースがある場合も、新しいリリースIDでのみ追加し、`latest.json`だけを新リリースへ更新します。
