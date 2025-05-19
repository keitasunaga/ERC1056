# ERC1056

ERC1056（Ethereum Improvement Proposal 1056）の実装プロジェクトです。

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


