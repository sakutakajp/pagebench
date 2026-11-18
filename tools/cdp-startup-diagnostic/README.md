# 隔離CDP起動観測（診断専用branch）

実計測経路から独立したNode標準ライブラリだけの診断です。Puppeteer/Lighthouse/既存runnerを
importしません。staging/image URL、サイトURL入力、サイト遷移、転送を有効化する処理はありません。

```bash
node --test tools/cdp-startup-diagnostic/diagnostic.test.mjs
node --check tools/cdp-startup-diagnostic/diagnostic.mjs
CHROME_PATH=/opt/google/chrome/chrome node tools/cdp-startup-diagnostic/diagnostic.mjs
```

Chrome sandbox/TLS/OS設定は変更しません。新規一時profile、既存の不要拡張抑制flag、
loopback全拒否proxyを使います。proxyはHTTP403、CONNECT/Upgrade切断のみで、上流client・
DNS lookup・外向きsocket・許可host・enable APIを持ちません。CDP WebSocketも自分のChromeが
生成したportとbrowser pathを検証したloopback接続だけです。

Chrome開始からproxyは閉鎖したまま。CDPは固定Target観測コマンドとabout:blank作成1回のみ。
root/child autoattachはwaitForDebuggerOnStart=trueで、Runtime再開・Page.navigate・Fetch転送等は
コマンドallowlistにありません。tab/pageも再開しません。既知補助target、未知/欠落/空/非文字列、
停止していないtarget、制御喪失・上限ではChromeを終了します。未知をfilterから除いて放置しません。

標準出力は固定codeと最大48件の{n,event,kind}、固定ゼロのsite_navigations/outbound_forwarding/
target_resumesだけ。任意のtype文字列、URL/title/target ID/session ID、ページ内容、stderr原文は出しません。
既知type表は公式ソースにある名前の診断分類で、実行許可ではありません。Chrome157の全typeを
網羅する保証はなく、未掲載はTYPE_UNKNOWN_STRINGで停止します。

終了コード0は「停止中のpageを観測した」のみで、実測・表示・機能・全fixture成功ではありません。
それ以外は1。生CDPやprofileを保存せず、profileは終了時削除。入力256KiB、イベント48件、
Chrome起動10秒、WebSocket3秒、各CDP command2秒の上限です。

ローカル検証: 合成CDP・実loopback拒否proxy等7試験成功。実Chromium154はCHROME_SANDBOX_FAILED、
sequence=[]で停止。実Chromeでのtarget互換性は未検証です。target_resumes=0はこの診断が再開commandを
送らない意味で、DevTools接続前のChrome内部処理を取り消せるという意味ではありません。

## 実ランナーでユーザーの手動起動に頼らず検証する場合

専用branch `diag/cdp-isolated-once-20261118-b651ddd` のpushだけを対象にする新規workflowを用意しました。
承認された1回のpushで自動診断します。既存workflowとmainは変更せず、手動再実行/dispatchは行いません。

既存の正規git書込みを用い、専用branchへの1回のpushだけをトリガーにする隔離jobが候補です。
必要なのは該当repoへのcontents/workflows書込み権限と、GitHub Actionsが利用可能なこと。
既存の拒否されたdispatch経路、追加credential、保護設定変更は使いません。公開workflowのjobは
ubuntu-24.04/標準Chrome、Node22.19以上、checkoutのcontents:readのみ、Secrets/Variablesなし、
固定branch・attempt1のみ、同時実行禁止、短いtimeout、retryなしにします。push前に既存workflowが
同時起動しないことを確認します。公開ログ/summaryは上の固定enum JSONのみ、artifactは不要です。

jobに置くのはこの診断と合成試験だけです。実サイトのstep、execute=true、SITEMAP_URL、PSI、
実計測への自動切替は一切入れません。この1回の観測と同じevent順序のローカル再現で互換性を
調べ、未知対象を実行しない方針を満たす設計が確認できるまで計測ルートに戻しません。
現時点では、このjobの公開・起動権限を実行時に確認したわけではありません。

根拠:
- https://chromedevtools.github.io/devtools-protocol/tot/Target/#method-setAutoAttach
- https://chromedevtools.github.io/devtools-protocol/tot/Target/#type-TargetInfo
- https://chromium.googlesource.com/chromium/src/+/lkgr/content/browser/devtools/devtools_agent_host_impl.cc
