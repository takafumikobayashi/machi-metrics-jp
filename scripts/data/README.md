# Data scripts

データ処理は次の小さな段階に分けて追加します。

```text
acquire → normalize → validate → derive → publish
```

現時点では、対象期間・23市町・類似度設定の検証だけを実装しています。

```bash
pnpm validate:data
```

次の実装は、1年・2自治体程度の実ファイルを使った `acquire` と `normalize` です。具体的な原表を確認するまで、架空の列名や値を置かないでください。
