import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

// コントラクトのABIを読み込む
const getContractABI = (): any => {
  try {
    // Hardhatでコンパイルされたアーティファクトからのパス (相対パス指定)
    const contractPath = '../../artifacts/contracts/EthereumDIDRegistry.sol/EthereumDIDRegistry.json';
    const contractJsonPath = path.resolve(__dirname, contractPath);
    const contractJson = JSON.parse(fs.readFileSync(contractJsonPath, 'utf8'));
    return contractJson.abi;
  } catch (error) {
    console.error('Failed to load contract ABI:', error);
    throw error;
  }
};

// コントラクトのBytecodeを取得
const getContractBytecode = (): string => {
  try {
    const contractPath = '../../artifacts/contracts/EthereumDIDRegistry.sol/EthereumDIDRegistry.json';
    const contractJsonPath = path.resolve(__dirname, contractPath);
    const contractJson = JSON.parse(fs.readFileSync(contractJsonPath, 'utf8'));
    return contractJson.bytecode;
  } catch (error) {
    console.error('Failed to load contract bytecode:', error);
    throw error;
  }
};

// 環境変数からプロバイダーURLを取得
const getProviderUrl = (): string => {
  const url = process.env.BLOCKCHAIN_URL || 'http://localhost:8545';
  return url;
};

// プロバイダーの設定
export const getProvider = (): ethers.JsonRpcProvider => {
  const providerUrl = getProviderUrl();
  return new ethers.JsonRpcProvider(providerUrl);
};

// Wallet (署名者) の設定
export const getWallet = (): ethers.Wallet => {
  const provider = getProvider();
  const privateKey = process.env.TEST_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  return new ethers.Wallet(privateKey, provider);
};

// コントラクトのデプロイ
export const deployContract = async (): Promise<ethers.Contract> => {
  const abi = getContractABI();
  const bytecode = getContractBytecode();
  const wallet = getWallet();

  // コントラクトファクトリーを作成
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);

  // コントラクトをデプロイ
  console.log('Deploying EthereumDIDRegistry contract...');
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log(`Contract deployed at address: ${contractAddress}`);

  // 型アサーションを使用してContract型への変換を明示的に行う
  return contract as unknown as ethers.Contract;
};

// すでにデプロイされているコントラクトに接続
export const connectToContract = (contractAddress: string): ethers.Contract => {
  const abi = getContractABI();
  const wallet = getWallet();
  return new ethers.Contract(contractAddress, abi, wallet);
};

// コントラクトをデプロイまたは既存のものに接続
export const getContract = async (): Promise<ethers.Contract> => {
  const existingContractAddress = process.env.REGISTRY_ADDRESS;

  if (existingContractAddress) {
    console.log(`Connecting to existing contract at ${existingContractAddress}`);
    return connectToContract(existingContractAddress);
  } else {
    // 新しいコントラクトをデプロイ
    return deployContract();
  }
};

// レジストリのアドレスを取得
export const getRegistryAddress = async (): Promise<string> => {
  // 環境変数からアドレスを取得
  const existingContractAddress = process.env.REGISTRY_ADDRESS;

  if (existingContractAddress) {
    console.log(`Using registry address from environment: ${existingContractAddress}`);
    return existingContractAddress;
  } else {
    // 新しいコントラクトをデプロイし、アドレスを取得
    const contract = await deployContract();
    const address = await contract.getAddress();
    console.log(`Deployed new registry at address: ${address}`);
    return address;
  }
}; 