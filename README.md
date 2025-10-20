# Passkey デモアプリケーション

このリポジトリは、Next.js (App Router) と SimpleWebAuthn を用いてパスキー (WebAuthn) 登録・認証の基本フローを学習できる最小構成のデモアプリです。フロントエンドと API の連携、チャレンジ管理、資格情報のファイル保存など、実装の要点を確認できます。

## 主な機能
- ユーザーID入力によるパスキー登録 (`navigator.credentials.create()`)
- 登録済みユーザーのパスキー認証 (`navigator.credentials.get()`)
- 登録情報の JSON ファイル (`data/webauthn.json`) への保存
- Jest を利用したユニットテスト

## 主要なディレクトリ構成
- `app/` : App Router ベースの UI と API ルート
- `lib/` : WebAuthn ロジックおよびデータストア
- `data/` : WebAuthn 資格情報を保持する JSON ファイル
- `__tests__/` : サーバーロジック向けユニットテスト

## 開発手順
```bash
npm install
npm run dev
# ブラウザで http://localhost:3000 を開く
```

## テスト
```bash
npm test
```
