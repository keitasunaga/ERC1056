# ERC-1056: Ethereum Lightweight Identity Implementation

このプロジェクトは、[EIP-1056](https://eips.ethereum.org/EIPS/eip-1056) で提案されているEthereum Lightweight Identityの仕様に基づいたスマートコントラクトの実装です。
ERC-1056は、ブロックチェーンリソースの使用を抑えつつ、効率的にIDを作成・管理するための標準を定義します。
主な目的は、ID作成コストを無料にし、オフライン環境でもID作成を可能にすること、そしてIDの主要な識別子を変更することなくキーのローテーションを可能にすることです。

## `EthereumDIDRegistry.sol` コントラクト

このプロジェクトの中心となるスマートコントラクトは `contracts/EthereumDIDRegistry.sol` です。
これは、全てのユーザーが共通して利用できるDID (Decentralized Identifier) レジストリとして機能します。

### 主な機能

*   **IDオーナーシップ管理**: 各IDの所有者を管理し、変更する機能を提供します。デフォルトでは、ID（Ethereumアドレス）自体がそのオーナーとなります。
*   **デリゲート管理**: IDの代わりに特定の操作を行う権限を持つデリゲート（別のアドレス）を、種類と有効期限付きで管理します。
*   **属性管理**: IDに関連するデータ（属性）を、名前、値、有効期限付きで管理します。

### メソッド詳細

#### オーナーシップ管理

*   `identityOwner(address identity) view returns (address)`
    *   指定されたIDの現在のオーナーアドレスを返します。オーナーが設定されていなければ、ID自体のアドレスを返します。
*   `changeOwner(address identity, address newOwner)`
    *   指定されたIDのオーナーを`newOwner`に変更します。現在のオーナーのみが呼び出し可能です。
*   `changeOwnerSigned(address identity, uint8 sigV, bytes32 sigR, bytes32 sigS, address newOwner)`
    *   署名を用いて、指定されたIDのオーナーを`newOwner`に変更します。現在のオーナーの署名が必要です。

#### デリゲート管理

*   `validDelegate(address identity, bytes32 delegateType, address delegate) view returns (bool)`
    *   指定された`delegate`が、特定の`identity`と`delegateType`において有効（有効期限内）であるかを確認します。
*   `addDelegate(address identity, bytes32 delegateType, address delegate, uint validity)`
    *   指定されたIDに新しいデリゲートを追加します。`delegateType`でデリゲートの種類を指定し、`validity`で有効期間（秒数）を指定します。現在のオーナーのみが呼び出し可能です。
*   `addDelegateSigned(address identity, uint8 sigV, bytes32 sigR, bytes32 sigS, bytes32 delegateType, address delegate, uint validity)`
    *   署名を用いて、新しいデリゲートを追加します。現在のオーナーの署名が必要です。
*   `revokeDelegate(address identity, bytes32 delegateType, address delegate)`
    *   指定されたIDのデリゲートを失効させます。現在のオーナーのみが呼び出し可能です。
*   `revokeDelegateSigned(address identity, uint8 sigV, bytes32 sigR, bytes32 sigS, bytes32 delegateType, address delegate)`
    *   署名を用いて、デリゲートを失効させます。現在のオーナーの署名が必要です。

#### 属性管理

*   `setAttribute(address identity, bytes32 name, bytes calldata value, uint validity)`
    *   指定されたIDに属性を設定します。属性は`name`（名前）、`value`（値）、`validity`（有効期間）を持ちます。現在のオーナーのみが呼び出し可能です。
*   `setAttributeSigned(address identity, uint8 sigV, bytes32 sigR, bytes32 sigS, bytes32 name, bytes calldata value, uint validity)`
    *   署名を用いて、属性を設定します。現在のオーナーの署名が必要です。
*   `revokeAttribute(address identity, bytes32 name, bytes calldata value)`
    *   指定されたIDの特定の`name`と`value`を持つ属性を失効させます。現在のオーナーのみが呼び出し可能です。
*   `revokeAttributeSigned(address identity, uint8 sigV, bytes32 sigR, bytes32 sigS, bytes32 name, bytes calldata value)`
    *   署名を用いて、特定の属性を失効させます。現在のオーナーの署名が必要です。

### イベント

*   `DIDOwnerChanged(address indexed identity, address owner, uint previousChange)`
    *   IDのオーナーが変更された際に発行されます。
*   `DIDDelegateChanged(address indexed identity, bytes32 delegateType, address delegate, uint validTo, uint previousChange)`
    *   IDのデリゲートが追加または失効された際に発行されます。
*   `DIDAttributeChanged(address indexed identity, bytes32 name, bytes value, uint validTo, uint previousChange)`
    *   IDの属性が設定または失効された際に発行されます。

`previousChange`は、各IDに対する前回の変更があったブロック番号を示し、イベントの効率的な検索を可能にします。

## 環境要件

- Docker
- Docker Compose

## セットアップ手順

1. リポジトリのクローン
```bash
git clone <repository-url>
cd ERC1056
```

2. 環境変数の設定
`.env`ファイルを作成し、必要な環境変数を設定します：
```env
PRIVATE_KEY=your_private_key
INFURA_API_KEY=your_infura_api_key
USER_ID=$(id -u)  # 現在のユーザーID
GROUP_ID=$(id -g) # 現在のグループID
```

3. Dockerコンテナのビルドと起動
```bash
docker compose build
docker compose up -d
```

## 開発コマンド

### コンパイル
```bash
docker compose run --rm hardhat npx hardhat compile
```

### テスト実行
```bash
docker compose run --rm hardhat npx hardhat test
```

### ローカルネットワークの起動
```bash
docker compose run --rm hardhat npx hardhat node
```

### デプロイ
```bash
docker compose run --rm hardhat npx hardhat run scripts/deploy.ts --network <network-name>
```

## プロジェクト構造

```
ERC1056/
├── contracts/          # スマートコントラクトのソースコード
│   └── EthereumDIDRegistry.sol
├── scripts/           # デプロイスクリプト
├── test/             # テストコード
├── hardhat.config.ts # Hardhat設定ファイル
├── package.json      # プロジェクト依存関係
├── Dockerfile        # Docker設定ファイル
└── docker-compose.yml # Docker Compose設定ファイル
```

## テスト

テストは`test`ディレクトリに配置されています。以下のコマンドで実行できます：

```bash
docker compose run --rm hardhat npx hardhat test
```

特定のテストファイルのみを実行する場合：

```bash
docker compose run --rm hardhat npx hardhat test test/Lock.ts
```

## 備忘録

### HardHatプロジェクトの新規作成手順
```bash
# package.jsonの作成
npm init -y

# HardHatのインストール
npm install --save-dev hardhat

# HardHatプロジェクトの初期化（TypeScript）
npx hardhat init
# 対話形式で以下の選択を行う：
# - Create a TypeScript project
# - プロジェクトのルートディレクトリを選択（デフォルトでOK）
# - .gitignoreの追加を確認（Yes）
# - 依存関係のインストールを確認（Yes）
```

## 参考情報

*   **EIP-1056**: [https://eips.ethereum.org/EIPS/eip-1056](https://eips.ethereum.org/EIPS/eip-1056)
*   **ethr-did-registry (uPort/Consensys)**: [https://github.com/uport-project/ethr-did-registry](https://github.com/uport-project/ethr-did-registry) - このコントラクトリファレンス実装の一つです。


