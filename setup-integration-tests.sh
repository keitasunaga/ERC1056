#!/bin/bash

# エラーが発生したら停止
set -e

echo "ERC1056とethr-didライブラリの統合テスト環境をセットアップしています..."

# 必要なディレクトリがあることを確認
if [ ! -d "integration-tests" ]; then
  echo "ERROR: integration-testsディレクトリが見つかりません。"
  exit 1
fi

# ユーザーID・グループIDを環境変数として設定
export USER_ID=$(id -u)
export GROUP_ID=$(id -g)

echo "コントラクトをコンパイルしています..."
docker compose run --rm hardhat npx hardhat compile

echo "Hardhatノードを起動しています..."
docker compose up -d hardhat

echo "統合テスト環境の準備が完了しました！"
echo ""
echo "以下のコマンドでテストを実行できます:"
echo "  docker compose run --rm integration-tests"
echo ""
echo "Hardhatノードを停止するには:"
echo "  docker compose down" 