# 自然な先読みを通常読み込みと同じに扱うローカル診断候補

基準は公開済み `4270ea66ed23a951e1267a7ff420ca6336336194`。遮断専用 `69885b6…` は不採用・未公開のまま保存し、新候補へ取り込まない。今回push・Actions・サイト通信0、使用枠3/10のまま。既存workflowは一切変更しない。

## コード監査

| 場所 | 確認したこと | 新候補 |
|---|---|---|
| tools/lighthouse-once/gateway.mjs request | Purpose/Sec-Purposeで即abort、専用256上限 | このrequest経路を使わない |
| tools/cdp-startup-diagnostic/staging-gateway.mjs:46 | 同じ明示的abort。ReinspectionGatewayもここへ進む | このrequest経路を使わない |
| tools/ab-observe/gateway.mjs requestDecision | Fetch/XHRは既定ホームContent契約だけ。別ページHTML/payload、Fetch型静的先読みは暗黙SCOPE。Otherもimage文脈のみ | 新しい有限のpublic policyで置換 |
| 同SharedBoundary | 通常120とprefetch256を別計数。Documentは全てトップ文書制約 | Purposeを見ず合計120。真のDocumentのみトップ1回、prefetched HTMLは読取サブリソース |
| tools/nuxt-debug/bound-prefetch.mjs | parser/二通知等に合う先読みだけabortして観測続行する旧候補 | importも実行もしない |
| tools/nuxt-debug/metadata.mjs | speculative印のあるContentを本要求の診断から除外。通信許可/遮断ではない | 旧診断は保持し、新受動証跡で全公開Content読取を記録。印は証跡boolだけ |
| fixture-runner.mjs / authless-profile.mjs | 毎回mkdtempの空profile、Cookie拒否。独自起動引数にprefetch専用disable設定なし。background networking/extensions無効、SW/WS・未知target拒否 | 起動・sandbox・TLS・プロキシ・設定不変。background flagが自然先読みに無影響とは静的読解だけで証明しない |
| render.cjs / baseline.cjs | captureごとに新context、ブラウザは複数captureで共有。origin/redirect guard、明示的Purpose abortなし | 正式保存/比較経路は今回変更しない。新候補はopenGuardedの新process/profileを使う |

現行の正式計測を変更済みとは主張しない。今回の差分は `tools/natural-reads/` に閉じ、通常workflowへ接続しない。

## 根拠付きの同一判定

許可先は従来のHTTPS staging.hirameki.dev / image.hirameki.devだけ。GET/HEADのみ、資格情報・body・redirect・追跡/管理/auth API・別originは拒否。Purpose印、initiator、二通知の順や型差を理由に拒否/abort/短絡/無効化しない。単一合計120要求・同時6・既存時限を全リソース共通に適用する。旧120通常+256先読みを一律376に拡大しない。多いページでは共通上限で停止し得る。

- HTML: 読取Fetch/XHR/Other/Prefetchで、有限のpublished route snapshotに載るパスだけ。実際のDocumentナビゲーションは `/ja/` GETを1回のみ。別ルートのHTML読取と別トップ遷移は別判定。
- Nuxt資産: 既知の公開 `/_nuxt/` 静的namespaceと安全な既存cache/画像query条件。Fetch/Other等でも読取可。動的に実行された後のAPI/外部通信は引き続き同じguardを通る。
- Payload: 台帳にあるページの `_payload.json` / `_payload.js`。ソースにあるbuild UUID/時刻のbare queryと従来の安全なstatic queryのみ。任意queryやtokenは不可。
- publicディレクトリ: 保存済みサイトソースの259パスを有限に収録。静的Fetch/Otherも通常と同じ。禁止segmentは先に拒否する。未知の同一origin Fetchを全開しない。
- 画像origin: 従来のImage等は維持。Fetch/Otherの画像読取は既承認origin上の明確な画像パスと安全な画像変換queryだけ。API許可の追加なし。
- Content: `/api/_content/query/<bounded>.json`、query名 `_params` 一つのみ。JSONをparseして、(1)公表routeのfirst metadata、(2)日本語HomeDiscoveryのhomepage=true/_partial=false/blog除外/only4項目のdirectory queryだけ。任意のwhere/only/previewToken、別APIは不可。regex文字列は固定比較だけで評価しない。

Contentの根拠は保存済み `pages/ja/index.vue` と `HomeDiscovery.vue`、実インストール済み@nuxt/contentのquery builder/serializer。閉域VMで同じrealmのRegExpを使い、builderが作るdirectoryとfindOneの両契約がpolicyへ入ることを確認。既知の `_stem` とインストール版の `_file` の固定sortのみ。初回の異realmVMではRegExpのinstanceofが一致しなかったため、実装と同じrealmへ直して対照した。現配信版と同じruntimeだという証拠にはしない。

### 台帳の限界

サイトsourceは手元で確実に読めた `14f39cb96b8a27bcbc407ffca6cf435bf554037d`。published/noindexも含むルートと、以前明示された少数の文字ページを併せ345パス。public source259パス。これは現在の2594 sitemap全体や現行ビルドとの一致を証明しない。未知ルート/新Content形状は通常/先読みとも同じSCOPEで停止する。完全な現行範囲を得るには、別途許可された正規の既存成果物/manifestとの照合が必要であり、この候補ではネットワーク取得や推測で補完しない。新hostは必要ない。追加Content契約やパスは、根拠を示して別差分として扱う。

## Nuxt500用の観測

採点・Lighthouse・trace収集を行わず、既存300ms/上下800Kbps/CPU×6の実CDP設定、新しい空profile、同じ `/ja/` 一回の入口を準備した。APIのEOFはJSのresponse.json成功ではない。公開ContentのID/session/frame/loaderをRAM内で結合し、開始/headers/EOF/失敗/曖昧を固定値で残す。

ナビ前に既存Nuxt app:error/vue:error/payload/DOM/CDP観測器を入れる。追加はRuntime.enableのACK1回と、既存のNetwork/Runtime通知を受動投影する小さなjournal。console.errorと未捕捉例外、主文書HTTP、FCP、Content到達/Network failureを同じ受信順の最大32記録で比較。consoleのargs/例外text/stack/URL/任意文字列は読まない。各チャネルは未設定/欠測と、観測窓で通知を見なかったことを区別。前context/Ready前の欠落、overflow、停止後通知は明示し、受信順から因果は言わない。Runtime.exceptionThrownはCDPで届いた通知であり、最終的に未処理のままだったことやNuxtの発生箇所の確定には使わない。

**HTTP200でもNuxtが処理したapp:error/payload500はあり得る。未処理例外やconsole.errorが必ず出る、とは仮定しない。** 閉域driver対照ではHTTP200＋app:error500＋DOM500、console/uncaught通知0を別々に検証する。これは過去/現行stagingの原因の再現ではない。

新runnerは外部open/proxyの明示注入が必須で、ライブCLI/自動発火workflow/保存入口なし。safe既存Nuxt出力、固定DOM集計、列挙/件数だけを返す。report/score/DB保存なし。未知や欠測を正常・エラー未発生とはしない。

## 閉域検証と未実施

1. 新policyのordinary/purpose付き同一判定、encoded route、payload、資産、Content形状、拒否対象、共通上限。
2. 元runArmと実request/startを通る制御CDP20対照。request overrideで許可したことにしない。
3. 新診断入口を通るcontrolled renderer/CDP対照: 通常、処理済み500、console/uncaught、Network失敗、SCOPE拒否、cleanup故障、Runtime.enable故障、FCP欠測。
4. 実Chrome用の6ケースを用意: 同じ複数リソースを普通に読む／自然なlink rel=prefetchで読む、POST、別API、外部、別トップ遷移。prefix/META/画像は固定メモリのみ、拒否専用proxyには上流機能なし。自然prefetch3件、JS完了、main1・同じURL、要求ごとの配信1、proxy転送0、cleanupが必要。未発火は未確認/非合格。

現在の環境は既定 `/opt/google/chrome/chrome` 自体が無く、実Chromeは未実施。sandboxを無効化した代替起動や依存取得は行わない。制御CDP・VM・source静的検証を実ブラウザ成功として報告しない。user指定の補助手順2つはカタログ/実行環境に見つからず、既承認の閉域検証・停止・レビュー手順を用いた。

## 未公開CI候補

`.github/workflows/natural-reads-closed-once-20261122.yml` を追加候補として用意。exact新規ref `refs/heads/diag/natural-reads-closed-once-20261122`、自分のpath、件名 `diagnostic: natural public reads closed proof (20261122-u1)`、親4270…、単一commit、push/attempt1限定。contents:read、fetch-depth6、credentials非保持、10分・専用concurrency。既存630＋新51の正確な681単体をNode24.19.0/Node22.19.0 strictで通し、manifestとprerequisiteが一致したときのみ閉域Chrome6ケース。公開可能な固定JSON2個のみ、1日保持。ライブstep・dispatch・schedule・継続計測なし。候補を公開/実行する承認はこのターンにはなく、pushしない。

旧runArm互換の内部snapshotにはnormal_requests=合計とprefetch_requests=0の未使用aliasが残るが、後者を実際の先読み件数として公表しない。新出力はtotal_requestsだけに投影する。新policyにPurpose別の計数/判定はない。
