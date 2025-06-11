import { ethers } from "hardhat";
import * as dotenv from "dotenv";

// 環境変数を読み込み
dotenv.config();

async function main() {
  console.log("🚀 ERC1056 (EthereumDIDRegistry) コントラクトをSepoliaテストネットにデプロイしています...");

  // デプロイアカウントの取得
  const [deployer] = await ethers.getSigners();
  console.log("📝 デプロイアカウント:", deployer.address);

  // アカウント残高の確認
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 アカウント残高:", ethers.formatEther(balance), "ETH");

  if (balance < ethers.parseEther("0.01")) {
    console.warn("⚠️  アカウント残高が少ないです。Sepoliaテストネット用のETHを取得してください。");
    console.log("🔗 Sepolia Faucet: https://sepoliafaucet.com/");
  }

  // コントラクトファクトリーの取得
  const EthereumDIDRegistry = await ethers.getContractFactory("EthereumDIDRegistry");

  // ガス見積もり
  const deployTransaction = await EthereumDIDRegistry.getDeployTransaction();
  const estimatedGas = await ethers.provider.estimateGas(deployTransaction);
  console.log("⛽ 推定ガス使用量:", estimatedGas.toString());

  // コントラクトのデプロイ
  console.log("🔄 デプロイ中...");
  const registry = await EthereumDIDRegistry.deploy();

  // デプロイの完了を待機
  await registry.waitForDeployment();
  const contractAddress = await registry.getAddress();

  console.log("✅ デプロイ完了!");
  console.log("📄 コントラクトアドレス:", contractAddress);
  console.log("🔗 Sepolia Explorer:", `https://sepolia.etherscan.io/address/${contractAddress}`);

  // デプロイトランザクションの詳細を表示
  const deployTx = registry.deploymentTransaction();
  if (deployTx) {
    console.log("📋 デプロイトランザクション:");
    console.log("   - Hash:", deployTx.hash);
    console.log("   - Gas Used:", deployTx.gasLimit?.toString());
    console.log("   - Gas Price:", deployTx.gasPrice ? ethers.formatUnits(deployTx.gasPrice, "gwei") + " gwei" : "N/A");
  }

  // 簡単な動作確認
  console.log("\n🧪 基本動作テスト...");
  const testIdentity = deployer.address;
  const owner = await registry.identityOwner(testIdentity);
  console.log(`✓ identityOwner(${testIdentity}) = ${owner}`);
  console.log(`✓ デフォルトオーナーが正しく設定されています: ${owner === testIdentity}`);

  console.log("\n🎉 ERC1056コントラクトのデプロイとテストが正常に完了しました！");

  // 重要な情報の再表示
  console.log("\n📋 重要な情報:");
  console.log("=".repeat(50));
  console.log(`コントラクトアドレス: ${contractAddress}`);
  console.log(`Etherscan URL: https://sepolia.etherscan.io/address/${contractAddress}`);
  console.log(`ネットワーク: Sepolia Testnet`);
  console.log("=".repeat(50));
}

// エラーハンドリング付きでmain関数を実行
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ デプロイ中にエラーが発生しました:");
    console.error(error);
    process.exit(1);
  }); 