# Active Context

## What you're working on now
src/if-api/index.tsファイルの修正を完了しました。具体的には、`/run`エンドポイントのレスポンス形式をYAML形式でも返せるように修正しました。

修正前は、レスポンスは常にJSON形式で返されていましたが、修正後は以下のようになりました：
1. リクエストのAcceptヘッダーに`application/json`が含まれている場合は、JSONレスポンスを返す
2. それ以外の場合（Acceptヘッダーがない場合や、JSONが指定されていない場合）は、YAMLレスポンスを返す

## Recent changes
以下の変更を行いました：
1. js-yamlライブラリから`dump`関数をインポート
2. レスポンスデータを準備する変数を作成
3. リクエストのAcceptヘッダーを確認する処理を追加
4. Acceptヘッダーに基づいて、JSONまたはYAML形式でレスポンスを返す処理を実装

## Next steps
現在のタスクは完了しました。次のタスクに進むことができます。