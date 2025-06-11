# ERC1056とethr-didライブラリの統合テスト環境

このディレクトリには、ERC1056（EthereumDIDRegistry）コントラクトとethr-didライブラリの連携テストを行うための環境が含まれています。

## 概要

統合テスト環境は以下の目的で設計されています：

1. Hardhatで実行されているイーサリアムノードを使用して、ERC1056コントラクトと通信する
2. ethr-didライブラリを使用してDIDを操作・管理する
3. ethr-did-resolverライブラリを使用してDIDドキュメントを解決する
4. 実際の使用シナリオに基づいたテストケースを実行する

## 実行方法

### 前提条件

- Docker・Docker Composeがインストールされていること
- ルートディレクトリで `docker compose up -d hardhat` を実行して、Hardhatノードが起動していること

### テスト実行

```bash
# ルートディレクトリから実行
docker compose run --rm integration-tests

# または
cd integration-tests
npm install
npm test
```

## ファイル構造

- `src/utils/deploy-helper.ts` - コントラクトデプロイ関連のヘルパー関数
- `src/utils/ethr-did-helper.ts` - ethr-didライブラリの操作をラップするヘルパークラス
- `src/ethr-did-integration.test.ts` - 統合テスト

## テストケース

1. **初期DIDドキュメント解決** - デフォルトDIDドキュメントが正しく解決できることを確認
2. **オーナー変更** - DIコントラクトを通じてDIDオーナーを変更できることを確認
3. **デリゲート管理** - デリゲートの追加・失効ができることを確認
4. **属性管理** - 属性（サービスエンドポイントなど）の設定・失効ができることを確認

## トラブルシューティング

- **テスト失敗**: Hardhatノードが起動していることを確認
- **コントラクト接続エラー**: 新しいデプロイが必要な場合は環境変数 `REGISTRY_ADDRESS` を未設定にする
- **DIDドキュメント解決エラー**: ethr-did-resolverのバージョンが最新かを確認

## 注意事項

- このテスト環境はローカルの開発・テスト用途を想定しています
- 実運用環境では適切なセキュリティ設定が必要です 