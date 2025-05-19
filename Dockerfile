# Node.js 20をベースイメージとして使用
FROM node:20-slim

# 環境変数の設定
ARG USER_ID
ARG GROUP_ID

# 作業ディレクトリを設定
WORKDIR /app

# 必要なパッケージをインストール
RUN apt-get update && \
  apt-get install -y git && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/*

# ユーザーとグループの作成
RUN groupadd -g ${GROUP_ID} nodejs && \
  useradd -u ${USER_ID} -g nodejs -s /bin/bash -m nodejs

# 必要なディレクトリの権限を設定
RUN mkdir -p /app && \
  chown -R nodejs:nodejs /app && \
  mkdir -p /.config && \
  chown -R nodejs:nodejs /.config

# ユーザーを切り替え
USER nodejs

# package.jsonとpackage-lock.jsonをコピー
COPY --chown=nodejs:nodejs package*.json ./

# 依存関係のインストール
RUN npm install 

# ソースコードをコピー
COPY --chown=nodejs:nodejs . .

# node_modulesの権限を修正
RUN chown -R nodejs:nodejs /app/node_modules

# コンテナ起動時のデフォルトコマンド
CMD ["npm", "run", "node"] 