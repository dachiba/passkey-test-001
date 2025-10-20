# 🧩 Agent.md — Passkey Demo App Specification (with Unit Tests)

## 1. プロジェクト概要
社内エンジニア向けに、Passkey（WebAuthn）の基本動作を理解するための**最小構成デモアプリ**を開発する。
目的は、**ローカル環境で登録とログインを通して WebAuthn の仕組みを学習できること**。
セキュリティ概念とフロント・バックの連携を理解する教材を目指す。

## 2. 想定ユーザー
- 社内エンジニア、Webセキュリティ担当
- Passkey 実装を社内サービスに導入検討している開発者

## 3. 実行環境
- OS: Linux（macOSでも可）
- 環境: Next.js Dev Server → http://localhost:3000 （Passkey は localhost 例外として HTTPS 不要）
- Node.js v20+ 推奨
- 外部通信: ライブラリ依存通信のみ許可

## 4. 開発構成
- フレームワーク: Next.js (App Router)
- 言語: TypeScript
- API構成: /app/api/.../route.ts
- フロントエンド: /app/page.tsx
- データ保存: JSON ファイル (/data/webauthn.json)
- DB不要, ファイルI/Oのみ
- UI言語: 日本語

## 5. Passkey 実装範囲
### 実装対象
1. パスキー登録（register）
   - フロント入力: ユーザーID
   - /api/register/options → navigator.credentials.create()
   - /api/register/verify で検証とJSON保存
2. パスキー認証（login）
   - フロント入力: ユーザーID
   - /api/login/options → navigator.credentials.get()
   - /api/login/verify で検証
3. 成功メッセージをUIに表示（セッションは不要）

## 6. UI仕様
1ページ構成（/）
| 要素 | 表示テキスト |
|------|----------------|
| 入力欄 | ユーザーIDを入力してください |
| 登録ボタン | パスキー登録 |
| ログインボタン | パスキーでログイン |
| 結果領域 | 成功／エラー表示（日本語） |

## 7. データ構造
/data/webauthn.json
{
  "user@example.com": {
    "id": "user@example.com",
    "credentials": [
      {
        "credentialId": "Base64String",
        "publicKey": "Base64String",
        "counter": 1
      }
    ]
  }
}

## 8. セキュリティ仕様
- RP ID: localhost
- Origin: http://localhost:3000
- Challenge: サーバー生成（ランダムBase64url）
- 検証: @simplewebauthn/server
- 保存データ: credentialId, publicKey, counter のみ
- 入力サニタイズ必須

## 9. 使用ライブラリ
- @simplewebauthn/browser
- @simplewebauthn/server
- uuid
- fs/promises
- jest, ts-jest（ユニットテスト）

## 10. 実行手順
npm install
npm run dev
# アクセス http://localhost:3000

## 11. テスト仕様
- 使用ツール: Jest + ts-jest
- 対象: サーバー側ロジック（APIルート内ロジック層）
- ブラウザAPIはモックしない

### テスト対象
- /lib/webauthn.ts
- /api/register/options/route.ts
- /api/register/verify/route.ts
- /api/login/options/route.ts
- /api/login/verify/route.ts
- /lib/store.ts

### テストケース概要
REG-001: options challenge生成
REG-002: verify 正常JSON保存
AUTH-001: options 登録済みユーザー
AUTH-002: options 未登録エラー
STORE-001: saveCredential 正常保存 など

## 12. 成功条件
- Passkey 登録とログインが正常動作
- /data/webauthn.json に登録情報が保存される
- 再起動後もログイン可
- npm test にてテスト成功
- コード構成とテスト内容から学習可能

## 13. ディレクトリ構成
/app
  /page.tsx
  /api
    /register/options/route.ts
    /register/verify/route.ts
    /login/options/route.ts
    /login/verify/route.ts
/lib
  webauthn.ts
  store.ts
/data
  webauthn.json
/__tests__
  webauthn.test.ts
  store.test.ts
