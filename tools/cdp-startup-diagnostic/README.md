# 隔離CDP起動観測（診断専用branch）

実計測経路から独立したNode標準ライブラリだけの診断です。Puppeteer/Lighthouse/既存runnerを
importしません。staging/image URL、サイトURL入力、サイト遷移、転送を有効化する処理はありません。

```bash
node --test tools/cdp-startup-diagnostic/*.test.mjs
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

終了コード0は「停止中のpageを観測し、cleanupも完了した」のみで、実測・表示・機能・全fixture成功ではありません。
それ以外は1。生CDPやprofileを保存せず、profileは終了時削除。入力256KiB、イベント48件、
Chrome起動10秒、WebSocket3秒、各CDP command2秒の上限です。

ローカル検証: 合成CDP・実loopback拒否proxy・終了処理の計14試験成功。実Chromium154はCHROME_SANDBOX_FAILED、
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

## 観測保持と終了診断（ローカル修正）

観測は最初のstop時、Chrome終了要求より前に固定enumだけのimmutable snapshotへ確定します。
終了操作が失敗してもcode/sequenceを置換せず、別のcleanup.stagesへ段階別固定codeを記録します。
観測が成功していてもcleanupに失敗が1件あればstatus=failed、終了コード1です。
workflow側もcodeだけで成功とせずstatusを検査するローカル差分です。今回は未push/未実行です。

順序は、早期停止エラーの記録→observer dispose→wire close→Chrome停止要求→close確認（最大3秒）
→全拒否proxy close→一時profile削除です。close未確認ならPROFILE_HELD_PROCESS_UNCONFIRMEDとして
profile削除を見送ります。削除再試行でエラーを隠すことはしません。確認対象は起動したChrome親processと
stdioのcloseで、全Chrome子processの終了を独立に証明するものではありません。

実テストは、URL等を含むエラー注入、実Node子processの停止/close、実非空dirの削除エラー、
終了未確認時のprofile保持、snapshot改変防止、各終了段階の失敗statusと記録保持を検証します。
Node子processによる終了順序試験をChrome起動成功として報告しません。
旧コードのfinallyがreturn済み観測を取り消すことは確定していますが、実runのどの終了操作が
失敗したかはログから特定できていません。ファイル削除競合等を原因と断定しません。
