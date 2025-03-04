# System Patterns

## How the system is built
Impact Frameworkは、Node.jsとTypeScriptで構築されたモジュラーなシステムです。主要なコンポーネントは以下の通りです：

1. **if-api**: Web APIサーバー（Express.jsベース）
2. **if-run**: マニフェストの処理と計算を行うコアモジュール
3. **if-check**: マニフェストの検証を行うモジュール
4. **if-diff**: マニフェスト間の差分を計算するモジュール
5. **if-merge**: マニフェストをマージするモジュール
6. **if-csv**: CSVデータの処理を行うモジュール
7. **if-env**: 環境変数の処理を行うモジュール
8. **common**: 共通のユーティリティと型定義

## Key technical decisions
1. **Express.js**: Web APIサーバーのフレームワークとして採用
2. **TypeScript**: 型安全性と開発効率のために採用
3. **YAML/JSON**: マニフェストの形式として採用
4. **モジュラー設計**: 各機能を独立したモジュールとして実装
5. **プラグインシステム**: 拡張性を高めるためのプラグインアーキテクチャ

## Architecture patterns
1. **RESTful API**: HTTPメソッドとエンドポイントを使用したRESTfulなAPI設計
2. **ミドルウェアパターン**: Express.jsのミドルウェアを活用した処理の分離
3. **エラーハンドリング**: try-catchブロックと適切なエラーレスポンスによるエラー処理
4. **設定の分離**: 設定とコードの分離（config/ディレクトリ）
5. **型駆動開発**: TypeScriptの型システムを活用した開発
6. **非同期処理**: Promiseとasync/awaitを使用した非同期処理