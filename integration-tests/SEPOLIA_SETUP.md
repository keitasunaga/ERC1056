# Sepolia Testnet統合テストのセットアップガイド

このガイドでは、デプロイされたSepolia testnet上のERC1056コントラクトを使用して統合テストを実行する方法を説明します。

## デプロイされたコントラクト情報

- **コントラクトアドレス**: `0x7E0F56D46a53f17d0D57c6f0f0041049A62C5bA4`
- **ネットワーク**: Sepolia Testnet (Chain ID: 11155111)
- **Etherscan**: [https://sepolia.etherscan.io/address/0x7E0F56D46a53f17d0D57c6f0f0041049A62C5bA4](https://sepolia.etherscan.io/address/0x7E0F56D46a53f17d0D57c6f0f0041049A62C5bA4)

## セットアップ手順

### 1. Infura/AlchemyアカウントとAPIキーの準備

Sepolia testnetにアクセスするためのRPC URLが必要です：

- [Infura](https://infura.io/)アカウントを作成してプロジェクトを作成
- または[Alchemy](https://alchemy.com/)アカウントを作成してアプリを作成

### 2. 設定ファイルの編集

`config/sepolia.env`ファイルを編集して、あなたのAPIキーを設定します：

```bash
# Infuraの場合
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID

# または、Alchemyの場合
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
```

### 3. 設定の検証

テストを実行する前に、設定が正しいかを確認します：

```bash
cd integration-tests
npm install
npm run verify:sepolia
```

このコマンドは以下をチェックします：
- 環境変数の設定
- Sepoliaネットワークへの接続
- デプロイされたコントラクトの存在確認
- アーティファクトファイルの存在

### 4. 統合テストの実行

#### Docker Composeを使用する場合（推奨）

```bash
# ルートディレクトリから実行
docker compose run --rm integration-tests-sepolia
```

#### 直接実行する場合

```bash
cd integration-tests
npm run test:sepolia
```

## テスト内容

統合テストでは以下の機能を検証します：

1. **DIDドキュメントの解決** - ethr-did-resolverを使用してDIDドキュメントが正しく取得できるか
2. **オーナーシップの変更** - コントラクトのオーナーシップ変更機能
3. **属性の管理** - DIDに関連する属性の設定と失効
4. **デリゲートの管理** - デリゲートの追加と失効

## トラブルシューティング

### よくあるエラーと解決方法

#### 1. ネットワーク接続エラー
```
✗ ネットワーク接続エラー: could not detect network
```
**解決方法**: `config/sepolia.env`のSEPOLIA_RPC_URLが正しいことを確認してください。

#### 2. コントラクトが見つからない
```
✗ コントラクトが見つかりません
```
**解決方法**: REGISTRY_ADDRESSが正しく設定されていることを確認してください。

#### 3. アーティファクトファイルが見つからない
```
⚠ アーティファクトファイルが見つかりません
```
**解決方法**: ルートディレクトリで以下を実行してください：
```bash
npx hardhat compile
```

#### 4. Gas不足エラー
```
insufficient funds for gas
```
**解決方法**: テストで使用するアカウントがSepoliaテストネットのETHを持っていることを確認してください。[Sepolia Faucet](https://sepoliafaucet.com/)でテストETHを取得できます。

- 設定ファイルにAPIキーを保存する際は、リポジトリにコミットしないよう注意してください

## セキュリティに関する注意事項

- テスト用の秘密鍵のみを使用してください
- 実際の価値のある資金を持つアカウントは使用しないでください
- 設定ファイルにAPIキーを保存する際は、リポジトリにコミットしないよう注意してください

## 設定ファイルのテンプレート

`config/sepolia.env`のテンプレート：

```bash
# Sepolia Testnet Configuration
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
REGISTRY_ADDRESS=0x7E0F56D46a53f17d0D57c6f0f0041049A62C5bA4
NETWORK_NAME=sepolia
CHAIN_ID=11155111
SEPOLIA_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

## 関連リンク

- [ERC1056 Specification](https://eips.ethereum.org/EIPS/eip-1056)
- [ethr-did Library](https://github.com/decentralized-identity/ethr-did)
- [ethr-did-resolver Library](https://github.com/decentralized-identity/ethr-did-resolver)
- [Sepolia Testnet Faucet](https://sepoliafaucet.com/)
- [Infura](https://infura.io/)
- [Alchemy](https://alchemy.com/) 