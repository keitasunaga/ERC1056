#!/bin/bash

# エラーが発生したら停止
set -e

echo "Hardhatノードへの接続を確認しています..."
# ノードが応答するまで待機（最大10回試行）
max_attempts=10
attempt=1
connected=false

while [ $attempt -le $max_attempts ]; do
  echo "試行 $attempt/$max_attempts..."
  
  if curl -s -o /dev/null -w "%{http_code}" http://hardhat:8545 2>/dev/null | grep -q "200"; then
    connected=true
    break
  fi
  
  # 別のホスト名でも試行
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:8545 2>/dev/null | grep -q "200"; then
    echo "localhost:8545 で接続に成功しました。環境変数を更新します。"
    export BLOCKCHAIN_URL=http://localhost:8545
    connected=true
    break
  fi
  
  echo "Hardhatノードに接続できません。5秒後に再試行します..."
  sleep 5
  attempt=$((attempt+1))
done

if [ "$connected" = false ]; then
  echo "Hardhatノードへの接続に失敗しました。ノードが起動していることを確認してください。"
  echo "docker compose ps で現在のコンテナ状態を確認できます。"
  exit 1
fi

echo "Hardhatノードへの接続に成功しました。"

echo "依存関係のインストール..."
npm install --no-bin-links

echo "テストを実行中..."
npm test

echo "テスト完了!" 