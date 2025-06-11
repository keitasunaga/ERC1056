FROM node:18-alpine

WORKDIR /app

# ホストOSとコンテナのユーザーIDを合わせるための引数
ARG USER_ID=1000
ARG GROUP_ID=1000

# 必要なパッケージをインストール
RUN apk add --no-cache bash curl jq python3 make g++ git

# ユーザー権限の設定
RUN if [ ${USER_ID:-0} -ne 0 ] && [ ${GROUP_ID:-0} -ne 0 ]; then \
  deluser --remove-home node && \
  addgroup -g ${GROUP_ID} appuser && \
  adduser -u ${USER_ID} -G appuser -s /bin/sh -D appuser && \
  mkdir -p /home/appuser && \
  chown -R appuser:appuser /home/appuser \
  ; fi

# npmのキャッシュディレクトリを作成し、権限を設定
RUN mkdir -p /tmp/.cache && chmod -R 777 /tmp/.cache

# package.jsonとpackage-lock.jsonをコピー
COPY integration-tests/package*.json ./

# 依存関係をインストール (--no-bin-links フラグを追加して権限問題を回避)
RUN npm install --no-bin-links

# PATHにnode_modules/.binを追加
ENV PATH="/app/node_modules/.bin:${PATH}"

# 必要なTypeScript定義ファイルをコピー
COPY integration-tests/src/globals.d.ts ./src/
COPY integration-tests/jest-setup.ts ./
COPY integration-tests/jest.config.js ./

# ビルドディレクトリの作成
RUN mkdir -p dist

# アーティファクトディレクトリへのシンボリックリンク作成
RUN mkdir -p artifacts && \
  ln -sf /app/artifacts /app/artifacts

# ソースコードをコピー
COPY integration-tests/ ./

# ビルド（TypeScriptのコンパイル）
RUN npm run build

# 実行コマンド
CMD ["npm", "test"] 