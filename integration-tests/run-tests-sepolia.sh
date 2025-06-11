#!/bin/bash

# エラーが発生したら停止
set -e

echo "=== Sepolia Testnet Integration Tests ==="

# 設定ファイルが存在するかチェック
if [ ! -f "config/sepolia.env" ]; then
    echo "エラー: config/sepolia.env ファイルが見つかりません。"
    echo "このファイルにSepolia testnetの設定を記載してください。"
    exit 1
fi

# 環境変数を読み込み
echo "Sepolia testnet設定を読み込んでいます..."
export $(grep -v '^#' config/sepolia.env | xargs)

# 必要な環境変数をチェック
if [ -z "$REGISTRY_ADDRESS" ]; then
    echo "エラー: REGISTRY_ADDRESS が設定されていません。"
    exit 1
fi

if [ -z "$SEPOLIA_RPC_URL" ] && [ -z "$BLOCKCHAIN_URL" ]; then
    echo "エラー: SEPOLIA_RPC_URL または BLOCKCHAIN_URL が設定されていません。"
    exit 1
fi

# SEPOLIA_RPC_URLが設定されている場合はBLOCKCHAIN_URLにも設定
if [ -n "$SEPOLIA_RPC_URL" ]; then
    export BLOCKCHAIN_URL="$SEPOLIA_RPC_URL"
fi

echo "設定情報:"
echo "  ネットワーク: $NETWORK_NAME"
echo "  Chain ID: $CHAIN_ID"
echo "  Registry Address: $REGISTRY_ADDRESS"
echo "  RPC URL: ${SEPOLIA_RPC_URL:-$BLOCKCHAIN_URL}"

# Sepolia testnetへの接続をテスト
echo "Sepolia testnetへの接続をテストしています..."

# JSONRPCを使用してネットワーク情報を取得
response=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
  "${SEPOLIA_RPC_URL:-$BLOCKCHAIN_URL}")

if echo "$response" | grep -q "result"; then
    echo "Sepolia testnetへの接続に成功しました。"
else
    echo "エラー: Sepolia testnetへの接続に失敗しました。"
    echo "レスポンス: $response"
    echo "SEPOLIA_RPC_URLを確認してください。"
    exit 1
fi

# 依存関係のインストール
echo "依存関係のインストール..."
npm install --no-bin-links

# PATHにnode_modules/.binを追加
export PATH="./node_modules/.bin:$PATH"

# jestの存在確認
if ! command -v jest &> /dev/null && ! [ -f "./node_modules/.bin/jest" ]; then
    echo "エラー: jestが見つかりません。依存関係を再インストールします..."
    npm install --no-bin-links
fi

echo "Sepolia testnetでテストを実行中..."
npx jest --runInBand

echo "Sepolia testnet統合テスト完了!" 