# Data scripts

データ処理は次の小さな段階に分けて追加します。

```text
acquire → normalize → validate → derive → publish
```

現時点では、対象期間・23市町・類似度設定の検証、全60原本の正規化、全国類似度候補の生成、人口密度・産業構造データの正規化、公開JSONの検証まで実装しています。

住民基本台帳人口移動報告の参考表（表1・表2、旧形式は表3・表4）については、2018〜2025年の転入元・転出先を別パイプラインで正規化します。e-Statの各年ファイルには広島県内23市町のシートがまとまっているため、対象シートだけを抽出し、個別の市区町村と「その他」の集計行を区別して保存します。2018〜2019年の旧`.xls`、2020〜2021年の旧形式実体も処理時にLibreOfficeで一時的に`.xlsx`へ変換しますが、raw原本は変更しません。

```bash
pnpm validate:data
```

## パイロット正規化

2016年・2025年の`-03`・`-04`原本から、広島市（`34100`）と安芸高田市（`34214`）を抽出します。
旧Excel形式（`.xls`）と新Excel形式（`.xlsx`）の両方を扱うため、ローカルにLibreOfficeの`soffice`が必要です。
`publish:data`も全国候補を原本から読むため同じ依存があります。`soffice`がない環境では公開JSONを再生成できません。
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
pnpm normalize:area -- \
  --raw-path data/raw/area/R8_04_mencho.csv \
  --output-path data/processed/area/pilot.json

pnpm publish:data -- \
  --release-id juki-2016-2025-hiroshima-v16
```

既定の年は`config/project.json`の2016〜2025年、自治体は`config/municipalities/hiroshima.json`の23市町です。公開処理では追加で2016年・2025年の`-03`・`-04`原本から、全国の市・町・村と東京都特別区を候補として生成します。政令指定都市の行政区は除外し、必須4特徴量が揃わない候補は理由を記録します。
既定の出力先は`data/staging/public-juki`です。`public/data`へ配置する場合も、既存リリースを上書きせず、新しいリリースIDと`latest.json`だけを追加・更新します。

人口密度は、国土地理院の面積調CSVを`data/raw/area/R8_04_mencho.csv`へ原本のまま置き、`normalize:area`で`data/processed/area/pilot.json`へ正規化します。`publish:data`は正規化済み面積と2025年1月1日時点の人口を突合し、`density.json`を生成します。

産業・農業構造は、e-Statの令和2年国勢調査 第5-3表のExcel原本を`data/raw/industry/2020/2020-005-03.xlsx`へ置き、`pnpm normalize:industry`で`data/processed/industry/2020/pilot.json`へ正規化します。`publish:data`はこの1時点データを`industry.json`へ収録します。国勢調査は2020年10月1日現在で、住民基本台帳の年次系列とは接続しません。

`publish:data`は既存4指標の`similarity.json`を維持したまま、人口密度・地域構造・産業構造の全国ランキングを`similarity-structure.json`へ、モデル統計を`similarity-structure-model.json`へ出力します。面積原本の4桁コードは正規化時に先頭ゼロを補い、全国候補の5桁自治体コードと突合します。

## 拡張データの公開

拡張正規化データ（`-07`、`-08`、`-11`、`-12`）は、既存の公開JSON契約を変更せず、リリース内の`extended/municipality/<コード>.json`へ出力します。ここには日本人住民・外国人住民ごとの人口、人口動態、5歳階級別人口を収録します。公開先に既存リリースがある場合も、新しいリリースIDでのみ追加し、`latest.json`だけを新リリースへ更新します。

## 転入元・転出先データ

原本は次のコマンドで正規化します。

```bash
pnpm normalize:migration
```

出力先は`data/staging/juki-migration/<year>/pilot.json`と`data/processed/juki-migration/<year>/pilot.json`です。`publish:data`はこれらをまとめ、リリース内の`migration-flow.json`と表示用の`migration-summary.json`へ変換します。公開JSONの利用可能年は2018〜2025年で、既存の人口スナップショット（2016〜2025年）とは別の年次フローです。

使用した統計はe-Statの[住民基本台帳人口移動報告 参考表 2018年〜](https://www.e-stat.go.jp/stat-search/files?cycle=7&layout=datalist&month=0&tclass1=000001128355&toukei=00200523&tstat=000000070001&year=20250)です。現行の表1が移動前の住所地別転入者数、表2が移動後の住所地別転出者数で、移動者（外国人を含む）の総数と10歳階級別人数を保持します。表3・表4の総数・日本人移動者・外国人移動者は旧リリース互換用に残しています。配布ファイルのURL、取得日時、SHA-256はリリースの`manifest.json`へ記録します。

年齢階級別の原本を正規化する場合は、次を実行します。

```bash
pnpm normalize:migration:age
```

出力先は`data/staging/juki-migration-age/<year>/pilot.json`と`data/processed/juki-migration-age/<year>/pilot.json`です。`publish:data`の既定値はこの年齢階級別パイプラインを使用します。

表示用集計は、地方別、都道府県別、広島県内23市町別を切り替えます。首都圏は関東から、北陸は中部から分離して重複を避けます。原本の「その他の県」「その他の市町村」は配分せず残余として表示し、個別行のない地点は0人とみなしません。広島市の行政区は県内市町別から除外します。
