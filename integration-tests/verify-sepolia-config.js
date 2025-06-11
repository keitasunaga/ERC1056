#!/usr/bin/env node

/**
 * Sepolia Testnetの設定を検証するスクリプト
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// 環境変数を読み込み
require('dotenv').config({ path: './config/sepolia.env' });

async function verifySepoliaConfig() {
  console.log('=== Sepolia Testnet Configuration Verification ===\n');

  // 1. 環境変数の確認
  console.log('1. 環境変数の確認:');
  const requiredVars = ['SEPOLIA_RPC_URL', 'REGISTRY_ADDRESS', 'NETWORK_NAME', 'CHAIN_ID'];
  const missingVars = [];

  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (value) {
      console.log(`   ✓ ${varName}: ${value}`);
    } else {
      console.log(`   ✗ ${varName}: 未設定`);
      missingVars.push(varName);
    }
  }

  if (missingVars.length > 0) {
    console.error(`\nエラー: 必要な環境変数が設定されていません: ${missingVars.join(', ')}`);
    process.exit(1);
  }

  // 2. ネットワーク接続の確認
  console.log('\n2. ネットワーク接続の確認:');
  try {
    const rpcUrl = process.env.SEPOLIA_RPC_URL || process.env.BLOCKCHAIN_URL;
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const network = await provider.getNetwork();
    console.log(`   ✓ Chain ID: ${network.chainId}`);
    console.log(`   ✓ Network Name: ${network.name}`);

    if (network.chainId.toString() !== process.env.CHAIN_ID) {
      console.warn(`   ⚠ 注意: 設定のCHAIN_ID (${process.env.CHAIN_ID}) と実際のchainId (${network.chainId}) が異なります`);
    }
  } catch (error) {
    console.error(`   ✗ ネットワーク接続エラー: ${error.message}`);
    process.exit(1);
  }

  // 3. コントラクトの確認
  console.log('\n3. ERC1056コントラクトの確認:');
  try {
    const rpcUrl = process.env.SEPOLIA_RPC_URL || process.env.BLOCKCHAIN_URL;
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const registryAddress = process.env.REGISTRY_ADDRESS;

    // コントラクトのコードを取得
    const code = await provider.getCode(registryAddress);
    if (code === '0x') {
      console.error(`   ✗ コントラクトが見つかりません: ${registryAddress}`);
      process.exit(1);
    }
    console.log(`   ✓ コントラクトが存在します: ${registryAddress}`);

    // シンプルなABIでidentityOwner関数を呼び出してテスト
    const testAddress = '0x0000000000000000000000000000000000000001';
    const abi = ['function identityOwner(address identity) view returns (address)'];
    const contract = new ethers.Contract(registryAddress, abi, provider);

    const owner = await contract.identityOwner(testAddress);
    console.log(`   ✓ identityOwner関数の動作確認: ${owner}`);

  } catch (error) {
    console.error(`   ✗ コントラクト確認エラー: ${error.message}`);
    process.exit(1);
  }

  // 4. アーティファクトファイルの確認
  console.log('\n4. アーティファクトファイルの確認:');
  const artifactPath = path.resolve(__dirname, '../artifacts/contracts/EthereumDIDRegistry.sol/EthereumDIDRegistry.json');

  if (fs.existsSync(artifactPath)) {
    console.log(`   ✓ アーティファクトファイルが存在します: ${artifactPath}`);
    try {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      console.log(`   ✓ ABI読み込み成功 (${artifact.abi.length}個の関数)`);
    } catch (error) {
      console.error(`   ✗ アーティファクトファイル読み込みエラー: ${error.message}`);
    }
  } else {
    console.warn(`   ⚠ アーティファクトファイルが見つかりません: ${artifactPath}`);
    console.warn(`     ルートディレクトリで 'npx hardhat compile' を実行してください`);
  }

  console.log('\n=== 設定検証完了 ===');
  console.log('すべての設定が正常です。統合テストを実行できます。');
}

// メイン実行
verifySepoliaConfig().catch(error => {
  console.error('検証中にエラーが発生しました:', error);
  process.exit(1);
}); 