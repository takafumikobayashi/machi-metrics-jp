# Contributing

このプロジェクトでは、実装の速さと統計の説明責任を両立させます。作業前に [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) を確認してください。

## 変更の基本単位

- UI変更: 実装、主要状態の確認、必要なアクセシビリティ対応
- データ変更: 取得元マニフェスト、変換処理、検証、データ仕様の更新
- 指標変更: 定義、式、丸め、欠損値処理、テスト、判断記録の更新
- 技術構成変更: `docs/ARCHITECTURE.md` と `docs/DECISIONS.md` の更新

## Pull Request前の確認

```bash
pnpm check
pnpm build
```

生成物を手で編集せず、生成元の設定または処理を直してください。新しい統計を追加するときは、画面実装より先に `docs/DATA_SPEC.md` へ出典・粒度・時点・結合キー・欠損ルールを追記します。
