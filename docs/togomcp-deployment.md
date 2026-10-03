# TogoMCP: 静的HTMLでのログイン運用と匿名運用への移行

## 1. GoogleクライアントIDの取得

Google Identity Servicesの公式手順:
https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid

1. Google Cloud ConsoleのGoogle Auth Platformで、既存の管理可能なプロジェクトを選択するか作成する。
2. Brandingにアプリ名、サポート連絡先、ホームページ・プライバシーポリシー等を設定する。Audienceは想定利用者に合わせる。ExternalかつTestingの場合はテストユーザーを登録し、一般公開時は公開状態・必要な検証を確認する。
3. Clients → Create client → Web applicationを選択する。
4. Authorized JavaScript originsに `https://test-togomcp.rdfportal.org` を追加する。パスや末尾スラッシュは不要。ローカル検証をする場合は `http://localhost` と使用ポート付きOriginも追加する。
5. 発行された `…apps.googleusercontent.com` をコピーする。これは公開設定値。client secretをHTMLへ置かない。
6. hub管理者にそのIDを伝え、`ALLOWED_GOOGLE_CLIENT_IDS`の既存リストへ追加して再起動してもらう。CORSにはページOriginを許可する。2026-10-04の読取確認ではTogoMCPページOriginとAuthorizationヘッダーは許可済み。

hub管理者の既存WebクライアントIDを共用する方法もあるが、Google側のAuthorized JavaScript origins追加とhub側の受け入れ確認が必要。IDを知っているだけでは使えない。

Google認証結果をJavaScript callbackで受け取るこの例では、独自の認証受信用サーバーやredirect URIは不要。Google+ APIの有効化も不要。

## 2. ウィジェットのログイン案内

このブランチのビルド済みJSを既存の静的配信先へコピーする:

```
app/assets/javascripts/llm_meta_widget/llm-meta-widget.js
```

`examples/togomcp-google-login.html`は静的配信用の例。`CLIENT_ID`を取得した値に、JSのsrcを実際のコピー先に置換する。qwen3-8-27b-fastは確認時に公開hub一覧にあるツール対応モデル。実行可能性はログインした利用者で確認する。

- `auth-required="true"`: 認証情報がない間、メッセージと認証ページリンクを表示し、チャットを無効化する。
- `auth-url="https://hub.aibranch.org/"`: 初回のhub登録・ログイン先。別タブで開く。
- `auth-message="…"`: 案内文の変更。
- `widget.bearerToken = response.credential`: このページのGoogle Identity Services callbackでIDトークンを渡す。属性、URL、localStorageやsessionStorageにトークンを保存しない。
- `widget.bearerToken = null`: 案内表示へ戻し、実行中のチャットを中断する。

ウィジェットは受け取ったトークンをモデル/MCP一覧、single_llm_calls、MCP実行へAuthorizationヘッダーで渡す。hubがトークンを検証する。UI上の入力有効化は認証成功の保証ではない。401、期限切れ、Token is missing等がLLM呼び出しから返った場合、トークンを破棄して案内へ戻る。

公開hubのAPIはGoogleのsubに対応する登録済みユーザーを検索する。初回はhubページで登録し、同じアカウントで静的ページでもGoogle認証する。hubに別タブでログインしただけではウィジェットにIDトークンは渡らない。リンクだけでログイン完了を自動検出する機能ではない。

ログイン必須はUIの設定であり、サーバーの認証・認可の代わりではない。Googleログイン済みユーザー用の制限は別途hub運用方針で確認する。今回のAnonymousUsagePolicyは匿名経路の制限なので、Bearer認証経路には適用されない。

## 3. ログイン不要の運用への移行

現状の公開hubでは、匿名のツール付きsingle_llm_callsにToken is missingが返る。ウィジェットの設定変更だけで匿名運用へ移行できない。

### サーバー側（2通り）

A. 公開hub管理者に今回の匿名MCP修正と乱用防止機能をレビュー・統合して配置してもらう。既存hubの最新コードへ統合し、既存サービスの認証・利用者設定を保持する。未統合のブランチで既存hubをそのまま置き換えない。

B. 自前のマシンに `yayamamo/llm_meta_server` の `feat/anonymous-abuse-protection` を配置する。依存関係、DB、環境変数を用意し `bin/rails db:migrate` を実行。OllamaとMCP接続、HTTPS公開、リバースプロキシを設定する。

両方で必要な条件:

- 匿名時のtool lookupでcurrent_userを要求せず、public_to_anonymousかつactiveのツールだけを許可する。
- `/api/mcp_tools/:id/call`が匿名公開ツールを実行可能。
- TogoMCPをactiveかつpublic_to_anonymousにする。
- 匿名で提供する実在のツール対応モデルを許可リストへ設定。例:

```dotenv
CORS_ORIGINS=https://test-togomcp.rdfportal.org
ANONYMOUS_MODELS=qwen3-8-27b-fast
```

このブランチのANONYMOUS_MODELS既定値はglm-4-7-flash。公開hubで確認したモデル一覧にはGLMがないので、qwenを使うなら明示設定が必要。

- 回数・同時実行・推論時間・日次予算・本文/ツール結果サイズ・緊急停止の制限を設定して有効化する。自前serverのdocs/anonymous-abuse-protection.mdを参照する。
- 信頼するプロキシを限定して利用者IPを正しく判定し、SSEバッファリングを無効にする。公開プロキシ経由の切断伝播を確認する。

### 静的HTML側

- 移行完了後、`auth-required="false"`にする（属性を省略してもfalse）。
- Googleログイン用JS/ボタンを外し、bearerTokenを渡さない。前のトークンが残るページでモードを切り替えず、新しいページを読み込む。
- 自前serverへ移る場合、llm-urlとtool-hub-urlをその公開HTTPS URLへ変更する。
- モデルslugとhub-toolsの登録名を合わせる。well-known-urls=""を維持すれば別経路のMCP自動探索は無効。

公開環境で確認する: 未ログインでツール付きLLM→MCP→tool result→次のLLM応答、同時実行拒否・429、日次上限・入力制限、切断時のRails/Ollama解放、緊急停止と復旧。UI設定を外すのはサーバーの制限・実行確認が完了した後。

## 検証済み範囲

今回の認証UIはローカル模擬APIで、未認証時にhub要求を開始しないこと、メッセージ/安全なリンク、トークン付きLLM/MCP/次のturn、認証エラー時の再案内を確認。GoogleクライアントID未取得のため、実Googleログインと公開hubでの認証付きE2Eは未確認。匿名版の実Ollama/TogoMCP E2Eは前回のローカル検証で成功している。
