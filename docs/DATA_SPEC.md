# データ仕様

最終更新: 2026-08-29  
対象リリース: `juki-2016-2025-v1`

## 1. 基本方針

MVPの主データは、総務省「住民基本台帳に基づく人口、人口動態及び世帯数調査」です。e-Statまたは総務省が配布する表を取得し、基準日、集計期間、人口区分を失わない形で正規化します。

画面に表示する値は、原本ファイルから自動処理で再生成できなければなりません。原本のセルを手で修正した値は採用しません。訂正が必要な場合は補正ルールをコードと判断記録に残します。

## 2. 一次情報

| 用途                 | 一次情報                                                   | 備考                                 |
| -------------------- | ---------------------------------------------------------- | ------------------------------------ |
| 人口・人口動態・世帯 | 総務省「住民基本台帳に基づく人口、人口動態及び世帯数調査」 | 年次、市区町村別                     |
| 配布ファイル・統計表 | e-Stat「政府統計の総合窓口」                               | 表番号・更新履歴をマニフェストへ記録 |
| 自治体コード・名称   | 総務省「全国地方公共団体コード」                           | コード改定日も保持                   |
| 地図境界             | 国土数値情報「行政区域データ」等                           | 統計年と境界時点を明記して別管理     |

主要リンク:

- [総務省｜住民基本台帳等](https://www.soumu.go.jp/main_sosiki/jichi_gyousei/daityo/gaiyou.html)
- [e-Stat](https://www.e-stat.go.jp/)
- [総務省｜全国地方公共団体コード](https://www.soumu.go.jp/denshijiti/code.html)
- [国土数値情報ダウンロードサイト](https://nlftp.mlit.go.jp/ksj/)

実際に使用した配布URLは変わる可能性があるため、この文書だけで固定せず、各データリリースの `manifest.json` に記録します。

## 3. 対象期間

MVPでは現行年2026年を除外し、次の10時点を固定します。

```text
2016-01-01, 2017-01-01, 2018-01-01, 2019-01-01, 2020-01-01,
2021-01-01, 2022-01-01, 2023-01-01, 2024-01-01, 2025-01-01
```

将来更新時の既定ルールは「公開作業年の前年を終点とする10時点」です。ただし、一次情報が未公表または訂正中なら自動的に空値で公開せず、最後に検証済みの年を終点とします。対象期間の変更は新しいリリースIDと判断記録を必要とします。

## 4. ストックとフロー

人口は基準日時点の**ストック**、出生・死亡・転入・転出は開始日から終了日までの**フロー**です。調査年の見かけ上のラベルだけで結合しません。

| 種別           | 必須時間列                   | 例                       |
| -------------- | ---------------------------- | ------------------------ |
| 人口・年齢構成 | `as_of_date`                 | `2025-01-01` 時点        |
| 人口動態       | `period_start`, `period_end` | 原表に記載された集計期間 |

人口動態の公開JSONには、期間の終了年から便宜的な年ラベルを作る場合も、開始日・終了日を必ず残します。画面では「2024年中」など、基準日人口と区別できる表現を使います。

## 5. 人口の範囲

MVPの `population_total` は、住民基本台帳に記録された日本人住民と外国人住民の合計です。

```text
population_total = population_japanese + population_foreign
```

データ表が区分を提供する場合は、合計値だけでなく両方を保持します。外国人住民を含む同一定義で10年比較できない系列が見つかった場合は、混在させず、対象系列・期間を再検討して `DECISIONS.md` に記録します。

これは常住人口を調べる国勢調査とは定義・基準日が異なります。MVP内で両者を一つの時系列として接続しません。

## 6. 自治体単位とコード

- 主キーは `municipality_code` と時間キーの組です。
- `municipality_code` は全国地方公共団体コードの先頭5桁を、先頭ゼロを含む文字列として保持します。
- 6桁目の検査数字が原本にある場合は `municipality_code6_raw` に保持します。
- 広島県は `prefecture_code = "34"` の23市町です。
- 政令指定都市は市全体を自治体単位とし、行政区を重複計上しません。
- 東京都特別区は類似検索では自治体相当の比較対象に含めます。

名称を結合キーに使いません。合併、名称変更、市制移行、コード変更は `municipality_history` で発効日つきの対応関係として管理します。期間をまたぐ単純合算は行わず、比較可能な地理単位へ組み替える場合は変換方法をリリース単位で記録します。

## 7. 年齢区分

MVPの表示区分は次の3つです。

| ID            | 年齢     |
| ------------- | -------- |
| `age_0_14`    | 0〜14歳  |
| `age_15_64`   | 15〜64歳 |
| `age_65_plus` | 65歳以上 |

原本の5歳階級を保持できる場合は正規化層に残し、上の3区分を派生値として作ります。年齢不詳は `age_unknown` として分離し、構成比の分母は `population_age_known` とします。

```text
population_age_known = age_0_14 + age_15_64 + age_65_plus
age_group_share = age_group / population_age_known
```

### 画面で使う年齢カテゴリ

自治体詳細の「年齢カテゴリ別の人口推移」では、5歳階級から作った本サイト独自の4区分を使います。上の3区分とは別物であり、指標としては公開しません。

| カテゴリ | 年齢     | 3区分との関係        |
| -------- | -------- | -------------------- |
| 年少人口 | 0〜14歳  | `age_0_14` と一致    |
| 若年層   | 15〜39歳 | 本サイト独自の分割   |
| 壮年層   | 40〜64歳 | 本サイト独自の分割   |
| 高齢者   | 65歳以上 | `age_65_plus` と一致 |

生産年齢人口（15〜64歳）を若年層と壮年層へ分けるのは、同じ生産年齢でも人口動態の傾向が異なるためです。「現役世代」のように生産年齢人口と混同されうる呼称は使いません。画面では必ず年齢範囲を併記します。

`population_age_known` と `population_total` の差は消去しません。差分と割合を品質レポートに出し、原表の定義差または年齢不詳として説明できない差は公開を停止します。

## 8. 人口動態

最低限保持する項目:

- `births`
- `deaths`
- `natural_change_reported`
- `move_ins`
- `move_outs`
- `migration_change_reported`
- 原表に存在するその他増減・職権記載消除等の調整項目

検算値も別に作ります。

```text
natural_change_calculated = births - deaths
migration_change_simple = move_ins - move_outs
```

社会増減は原表の定義に調整項目が含まれる可能性があるため、`move_ins - move_outs` で報告値を上書きしません。報告値、単純計算値、差分を保持し、画面の採用値をリリースマニフェストに明記します。

## 9. 正規化データモデル

### `municipalities`

| 列                  | 型        | 必須 | 説明                           |
| ------------------- | --------- | ---- | ------------------------------ |
| `municipality_code` | string(5) | yes  | 自治体識別子                   |
| `prefecture_code`   | string(2) | yes  | 都道府県コード                 |
| `name_ja`           | string    | yes  | 自治体名                       |
| `name_kana`         | string    | no   | 読み                           |
| `municipality_type` | enum      | yes  | city/town/village/special_ward |
| `valid_from`        | date      | yes  | この名称・区分の発効日         |
| `valid_to`          | date/null | yes  | 終了日、現行ならnull           |

### `population_snapshots`

| 列                    | 型           | 必須 | 説明                 |
| --------------------- | ------------ | ---- | -------------------- |
| `municipality_code`   | string(5)    | yes  | 自治体識別子         |
| `as_of_date`          | date         | yes  | 基準日               |
| `population_total`    | integer      | yes  | 全住民合計           |
| `population_japanese` | integer/null | no   | 日本人住民           |
| `population_foreign`  | integer/null | no   | 外国人住民           |
| `households`          | integer/null | no   | 世帯数               |
| `source_record_id`    | string       | yes  | 原本の表・行への参照 |

### `age_populations`

| 列                  | 型           | 必須 | 説明                   |
| ------------------- | ------------ | ---- | ---------------------- |
| `municipality_code` | string(5)    | yes  | 自治体識別子           |
| `as_of_date`        | date         | yes  | 基準日                 |
| `age_band_start`    | integer      | yes  | 下限年齢               |
| `age_band_end`      | integer/null | yes  | 上限、上限なしはnull   |
| `population`        | integer      | yes  | 人数                   |
| `resident_scope`    | enum         | yes  | total/japanese/foreign |
| `source_record_id`  | string       | yes  | 原本参照               |

### `population_flows`

| 列                          | 型           | 必須 | 説明           |
| --------------------------- | ------------ | ---- | -------------- |
| `municipality_code`         | string(5)    | yes  | 自治体識別子   |
| `period_start`              | date         | yes  | 集計開始日     |
| `period_end`                | date         | yes  | 集計終了日     |
| `births`, `deaths`          | integer/null | no   | 自然動態       |
| `move_ins`, `move_outs`     | integer/null | no   | 社会動態       |
| `natural_change_reported`   | integer/null | no   | 出典の自然増減 |
| `migration_change_reported` | integer/null | no   | 出典の社会増減 |
| `adjustment`                | integer/null | no   | その他増減     |
| `source_record_id`          | string       | yes  | 原本参照       |

## 10. 派生指標

### 10年増減

```text
population_change_10y = population(end) - population(start)
population_change_rate_10y = population_change_10y / population(start)
```

`start = 2016-01-01`, `end = 2025-01-01` です。「10年間」という表示は10回の年次スナップショットを指し、二つの基準日の間隔は9年です。この誤解を避けるため、データ説明では必ず両端の日付を併記します。

### 年次率

自然増減率・社会増減率を作る場合、分母は対応する期間開始時または最も近い基準日の人口とし、1,000人当たりで表示します。どの基準日を使ったかを列として保持します。

```text
rate_per_1000 = flow / denominator_population * 1000
```

### 指数

住民区分のように桁の違う系列を同じ図で比べる場合、表示用に指数を作ります。

```text
index = value / value(基準年) × 100
```

基準年は対象期間の最初の年で、画面に必ず明記します。指数は表示のための派生値であり、公開JSONには保存しません。実人数を別のグラフと表で必ず併記します。

### 類似度

特徴量、標準化、重みは [MVP_SPEC.md](MVP_SPEC.md#5-類似自治体) を正とします。計算に使った全国中央値、IQR、候補件数、除外件数を `similarity-model.json` に保存します。

候補マスターは2025年-03の現行自治体行から作り、全国の市・町・村と東京都特別区を含めます。政令指定都市の行政区、都道府県・郡などの集計行は含めません。2016年との対応は同じ5桁の自治体コードによる直接突合とし、合併・分割を推定して値を合算しません。必須4特徴量（2025年人口、2025年年齢構成、2016〜2025年人口増減率）が一つでも欠ける候補は除外理由とともに記録します。

`similarity.json` の `entries` は4特徴量を重み付けした総合ランキングです。v5以降は `single_feature_entries` に、4特徴量それぞれを単独で標準化して再ランキングした結果も保存します。既存の `entries` は互換性のため維持します。

## 11. 公開JSON

```text
public/data/
├── latest.json
└── releases/
    └── juki-2016-2025-v1/
        ├── manifest.json
        ├── municipalities.json
        ├── hiroshima-summary.json
        ├── municipality/
        │   └── 34214.json
        ├── extended/
        │   └── municipality/34214.json
        ├── similarity.json
        └── similarity-model.json
```

`municipalities.json` は類似度候補を含む全国自治体マスターです。詳細JSONは主役である広島県23市町分だけを収録し、全国候補は `similarity.json` に上位結果と特徴量の寄与を収録します。

`latest.json` は現在のリリースIDだけを指します。リリースディレクトリの内容は公開後に上書きせず、訂正は `v2` など新IDで作成します。

公開JSONの機械可読な契約は `src/lib/data/schema.ts` を正とします。フィールド名は本書9の正規化モデルとMVP_SPEC 4の指標IDに合わせたsnake_caseで、人が管理する `config/` のcamelCaseとは別系統です。欠損はキーを省略せず `null` を明示し、比率は0〜1で保持します。想定外のキーを含むJSONはスキーマ違反として公開を止めます。

ファイル間の整合（一覧と詳細の一致、10年増減の再計算、類似結果の件数と参照先など）は `src/lib/data/validate.ts` で検証し、`node --import tsx scripts/data/validate-release.ts` から実行します。

### マニフェスト必須項目

- `release_id`
- `schema_version`
- `generated_at`
- `coverage`
- 使用した設定ファイルのハッシュ
- 各原本の統計名、表名、配布URL、取得日時、SHA-256
- 変換処理のGitコミット
- 品質検証結果と除外件数
- 比率フィールドの単位（0〜1の比率であること）
- ライセンス・出典表示文

## 12. 品質検証

公開前に最低限、次を機械検証します。

- 自治体コードが5桁で、マスターに存在する。
- 主キーに重複がない。
- 人数は整数かつ0以上、増減値は整数。
- 対象23市町×10時点の総人口が揃う。
- `population_japanese + population_foreign == population_total`（両方がある場合）。
- 年齢3区分の合計と年齢把握済み人口が一致する。
- 構成比が0〜1の範囲にある。
- 出生−死亡と報告自然増減の差を検査する。
- 転入−転出と報告社会増減の差を記録する。
- 10年増減率を両端人口から再計算できる。
- 類似候補の必須特徴量に欠損がない。
- JSON Schemaまたは同等のランタイムスキーマに合格する。

警告とエラーを区別します。説明可能な丸め差・定義差は警告として明示でき、主キー重複、負の人口、対象市町の欠損はエラーとして公開を停止します。

## 13. 丸め・欠損・秘匿

- 保存値は原則として原本の精度を保つ。
- 計算途中で丸めず、表示時だけ丸める。
- 欠損は `null` とし、0で埋めない。
- `0` と「未公表」「該当なし」「秘匿」を区別する。
- 欠損を含む比率は計算しない。
- 推定補完はMVPで行わない。

## 14. 出典表示

ページには短い出典名、対象時点、データリリースIDを表示し、詳細ページからマニフェストと一次情報へリンクします。加工値には「総務省の公表データを本プロジェクトが加工」と明記します。
