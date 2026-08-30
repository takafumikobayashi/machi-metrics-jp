# 技術構成

最終更新: 2026-08-30  
状態: MVP + 人口密度・産業構造拡張

## 1. 方針

MVPは、ブラウザ表示とデータ作成を分離した静的データ中心のWebアプリにします。利用者のリクエストごとにe-Statへ接続せず、事前に検証したバージョン付きJSONをNext.jsが読みます。

```text
総務省・e-Statの原本
        ↓ 取得 + SHA-256記録
data/raw（編集禁止）
        ↓ 正規化
data/staging
        ↓ 検証 + 指標計算 + 類似度計算
data/processed
        ↓ 公開スキーマへ変換
public/data/releases/<release-id>
        ↓
Next.js（概要 / 自治体詳細 / データ説明）
```

この境界により、統計の更新・訂正をUIから独立させ、将来の産業・農業・財政データも別パイプラインから同じ自治体コードへ接続できます。

## 2. 採用技術

| 領域       | 技術                                    | 理由                                                                           |
| ---------- | --------------------------------------- | ------------------------------------------------------------------------------ |
| Web        | Next.js App Router + React + TypeScript | 静的生成、ルーティング、メタデータ、将来のAPI追加を一つに保てる                |
| スタイル   | CSS Modules / global CSSから開始        | MVPでデザインシステム依存を増やさず、必要時に段階導入できる                    |
| データ契約 | TypeScript型 + Zod                      | ビルド時と実行時の両方で公開JSONを検証できる                                   |
| データ処理 | Node.js + TypeScript / Python           | 通常処理はNode.js、国勢調査の大規模Excel XML解析だけPython標準ライブラリを使用 |
| テスト     | Node test runner（`tsx --test`）        | 小さな純粋関数の検証から始め、追加フレームワークを避ける                       |
| 可視化     | SVG/軽量チャートを比較後に決定          | グラフ要件とアクセシビリティを固める前に依存を固定しない                       |
| 地図       | GeoJSON + 描画ライブラリを比較後に決定  | 23市町ならSVGも候補。境界ライセンスとサイズを先に検証                          |
| 配信       | Vercel等のNode/静的配信を想定           | 公開JSONが静的なので特定のDBを必要としない                                     |
| CI         | GitHub Actions                          | lint、型、テスト、データ設定、ビルドを自動確認                                 |

通常のMVP処理はNode.js + TypeScriptで行います。産業構造の原本は1シート約30万行・大規模なExcel XMLであるため、`normalize-industry.py`だけは追加ライブラリ不要のPython標準ライブラリでストリーム解析します。採用理由は処理をWeb実行時へ持ち込まず、Excel原本の保存・再生成手順を保つためです。

## 3. ディレクトリ責務

```text
config/
  project.json             # 対象期間、年齢区分、類似度設定
  municipalities/         # 人が確認する対象自治体リスト
data/
  raw/                     # ダウンロード原本。Git管理外、変更禁止
  staging/                 # 解析しやすい長形式。Git管理外
  processed/               # 検証済みテーブル。Git管理外
docs/                      # プロダクト・データ・技術の正本
public/data/
  latest.json              # 最新の不変リリースを指す小さなポインタ
  releases/<id>/           # Web向けのバージョン付きJSON
scripts/data/
  acquire/                 # 取得とハッシュ記録
  normalize/               # 原表固有形式から共通モデルへ変換
  derive/                  # 指標と類似度を計算
  validate/                # スキーマ・整合性・カバレッジ検証
  publish/                 # 公開JSONとマニフェスト生成
src/app/                   # ルート、レイアウト、メタデータ
src/components/            # 分野非依存UI
src/features/              # overview, municipality, similarityなど
src/lib/data/              # 公開JSONの型、読み込み、形式変換
src/lib/metrics/           # 増減、年齢構成、動態検算、人口密度の純粋計算
src/lib/similarity/        # 類似度の純粋計算
src/lib/format/            # 表示直前の数値・日付整形
tests/                     # 設定、指標、回帰用fixture
```

`src` から `data/raw` や `data/processed` は参照しません。表示層が読めるのは公開スキーマだけです。

## 4. 公開データの設計

データは1ファイルに詰め込まず、一覧に必要な軽量サマリーと自治体別詳細を分けます。

- 初期表示: `latest.json` → `hiroshima-summary.json`
- 詳細表示: `municipality/<code>.json`
- 拡張詳細: `extended/municipality/<code>.json`（日本人・外国人、5歳階級）
- 類似検索: 事前計算した `similarity.json` と `similarity-structure.json`
- 地域構造: `density.json`（行政区域面積と人口密度）、`industry.json`（産業・農業構造）
- 説明: `manifest.json`、`similarity-model.json`、`similarity-structure-model.json`

類似度はクライアントで全自治体を毎回計算せず、データリリース作成時に決定的に計算します。表示側は特徴量差を説明するだけにします。

## 5. アプリケーション境界

- **Server Components**: データ読み込み、ページメタデータ、初期HTML生成。
- **Client Components**: 指標切替、並べ替え、ツールチップなど操作が必要な最小範囲。
- **Data module**: パス解決、Zod検証、表示モデルへの変換。コンポーネントからJSONを直接読むことを避ける。
- **Domain functions**: 増減率、年齢構成、類似度。UIとI/Oから独立した純粋関数にする。

初版は認証、データベース、独自バックエンドを持ちません。必要になるまで運用面を増やさない方針です。

## 6. データ更新フロー

1. 対象年と一次情報を確認し、取得元定義を追加する。
2. 原本を `data/raw/<source>/<year>/` へ取得し、URL・時刻・SHA-256を保存する。
3. 原表固有の列や結合セルを正規化する。
4. 自治体コード・期間・人口区分を検証する。
5. 派生指標と全国類似度を計算する。
6. 前リリースとの差分レポートを確認する。
7. 新しい不変リリースIDで公開JSONを生成する。
8. 画面と数値を人が確認し、`latest.json` を更新する。

取得と公開を別コマンドにし、ネットワーク障害や上流更新が本番ビルドへ直接影響しないようにします。

## 7. 拡張方法

将来の分野は、次の契約を守る独立モジュールとして追加します。

```text
dataset = municipality_code + reference time + metric + provenance
```

例:

- `density`: 人口面積、可住地面積、人口密度
- `industry`: 就業者・事業所・産業構成
- `agriculture`: 経営体、耕地、主要品目
- `finance`: 歳入歳出、財政力、基金、将来負担
- `furusato_tax`: 受入額、件数、住民税控除額

異なる基準年を無理に横並びにせず、各データセットが自身の時点と品質情報を持ちます。横断指標を作るときだけ、許容する時点差を明示します。

## 8. セキュリティ・プライバシー

MVPは集計済み公的統計だけを扱い、個人データを収集しません。外部入力を受けるAPIも持ちません。それでも依存関係更新、CSP等のHTTPヘッダー、外部リンク、公開ファイルへの不要情報混入を確認します。

アクセス解析を導入する場合は、目的、収集項目、保存期間、オプトアウトを別判断として記録します。

## 9. 可用性と失敗時の振る舞い

- 公開JSONがスキーマ不一致ならビルドまたは公開処理を失敗させる。
- 1指標が欠損する場合は「0」と表示せず「データなし」と理由を示す。
- 地図描画の失敗時も自治体一覧を使える。
- `latest.json` の参照先は公開済みリリースに限定する。
- 上流サイトが停止しても既存リリースは表示を継続する。

## 10. 未決事項

次は実データまたは画面試作を見て決めます。

- グラフライブラリ
- 地図をSVG自前描画にするかMapLibre等にするか
- 公開JSONの圧縮と分割単位
- 原本Excelの解析ライブラリ
- 全国境界変更の正規化方針

未決事項を実装の暗黙仕様にせず、決定時に [DECISIONS.md](DECISIONS.md) へ追記します。
