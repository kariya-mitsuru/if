ARG BASEIMAGE=node:18-slim

FROM --platform=$BUILDPLATFORM $BASEIMAGE AS builder

# アプリケーションディレクトリを作成
WORKDIR /app

# ビルド用依存ライブラリをインストール
RUN --mount=src=package.json,target=package.json \
    --mount=src=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --ignore-scripts

# TypeScriptをコンパイル
RUN --mount=src=package.json,target=package.json \
    --mount=src=tsconfig.json,target=tsconfig.json \
    --mount=src=tsconfig.build.json,target=tsconfig.build.json \
    --mount=src=src/,target=src/ \
    npm run build

# npm モジュールを pack する
RUN --mount=src=package.json,target=package.json \
    npm pack

# pack ファイル名を変更する
RUN mv grnsft-if-*.tgz grnsft-if.tgz

FROM --platform=$BUILDPLATFORM $BASEIMAGE AS deps

# アプリケーションディレクトリを作成
WORKDIR /app

RUN echo {} > package.json

# ランタイム用依存ライブラリをインストール
RUN --mount=from=builder,src=/app/grnsft-if.tgz,target=grnsft-if.tgz \
    --mount=type=cache,target=/root/.npm,sharing=locked \
    npm i grnsft-if.tgz

FROM $BASEIMAGE

# lsb_release をインストール
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && \
    apt-get --no-install-recommends install -y \
    lsb-release git ca-certificates

# 実行ユーザを設定
USER 1000

# アプリケーションディレクトリを作成
WORKDIR /app

# ランタイム用依存ライブラリをコピー
COPY --from=deps --chown=node:node /app ./

# 環境変数を設定
ENV NODE_ENV=production HOST=0.0.0.0 PATH=/app/node_modules/.bin:$PATH

# ポートを公開
EXPOSE 3000

# アプリケーションを実行
CMD ["if-api"]
