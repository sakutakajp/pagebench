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

Chrome開始からproxyは閉鎖したまま。CDPはrootだけのBrowser.getVersion、固定Target観測コマンドとabout:blankタブ作成1回、照合済みpageだけへのPage初期化2コマンドです。
root/child autoattachはwaitForDebuggerOnStart=trueで、Runtime再開・Page.navigate・Fetch転送等は
コマンドallowlistにありません。tab/pageも再開しません。停止隔離BROWSER_UI以外の既知補助target、未知/欠落/空/非文字列、
停止していないtarget、制御喪失・上限ではChromeを終了します。未知をfilterから除いて放置しません。

標準出力は固定codeと最大48件の{n,event,kind}、固定ゼロのsite_navigations/outbound_forwarding/
target_resumesだけ。任意のtype文字列、URL/title/target ID/session ID、ページ内容、stderr原文は出しません。
既知type表は公式ソースにある名前の診断分類で、実行許可ではありません。Chrome157の全typeを
網羅する保証はなく、未掲載はTYPE_UNKNOWN_STRINGで停止します。

終了コード0は「同じChromeの版が確定し、停止中のpageを初期化し、cleanupも完了した」のみで、実測・表示・機能・全fixture成功ではありません。
それ以外は1。生CDPやprofileを保存せず、profileは終了時削除。入力256KiB、イベント48件、
Chrome起動10秒、WebSocket3秒、各CDP command2秒の上限です。

ローカル検証: 合成CDP・実loopback拒否proxy・終了処理の計22試験成功。実Chromium154はCHROME_SANDBOX_FAILED、
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
workflow側もcodeだけで成功とせずstatusを検査します。

順序は、早期停止エラーの記録→observer dispose→wire close→Chrome停止要求→close確認（最大3秒）
→全拒否proxy close→一時profile削除です。close未確認ならPROFILE_HELD_PROCESS_UNCONFIRMEDとして
profile削除を見送ります。削除再試行でエラーを隠すことはしません。確認対象は起動したChrome親processと
stdioのcloseで、全Chrome子processの終了を独立に証明するものではありません。

実テストは、URL等を含むエラー注入、実Node子processの停止/close、実非空dirの削除エラー、
終了未確認時のprofile保持、snapshot改変防止、各終了段階の失敗statusと記録保持を検証します。
Node子processによる終了順序試験をChrome起動成功として報告しません。
旧コードのfinallyがreturn済み観測を取り消すことは確定していますが、実runのどの終了操作が
失敗したかはログから特定できていません。ファイル削除競合等を原因と断定しません。

## BROWSER_UIの停止隔離と単一pageのprotocol初期化

公式ChromeソースはBROWSER_UIをWebUI/toolbar等のUI用targetとしてpageと区別します。
これだけで安全に実行できるとは判断せず、waitingForDebugger=trueを必須として停止状態のまま保持。
filterから除外せず、再帰Target.setAutoAttachだけを設定します。UIへPage/Runtime/Network操作はしません。
全拒否proxyとChrome/TLS起動条件も変更しません。

作成は固定about:blank・forTab=trueの1回のみ。戻りのTAB IDと捕捉した唯一のTABを照合し、
そのsessionの直接配下、または停止隔離UIを挟んだ配下のPAGEだけを対象にします。IDはメモリ内で
照合し出力しません。親子不明、追加TAB/PAGE、worker・未知種別、停止していないtarget、
detach/destroy/種別変更はfail-closedです。UIは最大4対象、取得イベントは従来通り最大48件。

pageの初期化はPage.enableとPage.getFrameTreeだけです。frame URLがabout:blank、子frameなしを
確認したらBLANK_PAGE_PROTOCOL_READY。Runtime再開・JavaScript実行・Puppeteer初期化・描画試験では
ありません。target_resumes/browser_ui_resumesは常に0。page_protocol_initializedと
browser_ui_quarantinedは固定型の状態として出します。UIを止めたためpageが現れなければ
最大5秒でPAGE_NOT_OBSERVED。UIを再開するfallbackはありません。

公式の根拠（実ランナーの親子関係を仮定するためのものではありません）:
- https://chromedevtools.github.io/devtools-protocol/tot/Target/#method-createTarget
- https://chromium.googlesource.com/chromium/src/+/a24f112f7dcefa1402ba08df5f325679679e44fc
- https://chromium.googlesource.com/chromium/src/+/327d939af510cc32a34b28cfa3a6fa82fe5d7418
- https://chromium.googlesource.com/chromium/src/+/2ebb13842d07f99f830e14f5694495f98a442fb9/chrome/browser/ui/webui_browser/webui_browser_browsertest.cc

## 同じChromeからの版取得（ローカル修正、未公開）

独立したChrome `--version`プロセスは起動しません。全拒否proxyの下で起動した診断用Chromeに対し、
rootの停止autoattachを確認した後、同じCDP接続のBrowser.getVersionを1回だけ呼びます。
productが `Chrome/数字.数字.数字.数字` または `HeadlessChrome/数字.数字.数字.数字` と完全一致する場合だけ、
数字4区分をbrowser_version.versionへ出します。各区分は1〜10桁。product原文やuserAgent/revision等は出しません。

browser_version.codeはVERSION_VERIFIED / VERSION_NOT_ATTEMPTED / VERSION_MISSING /
VERSION_INVALID / VERSION_TIMEOUT / VERSION_COMMAND_FAILED / VERSION_CONTROL_LOSTのみ。
欠損・不正・2秒タイムアウト・当該コマンドエラーは版をnullとし、閉鎖proxyのまま対象観測は続けます。
保護喪失・制御喪失は従来どおり停止します。タイムアウト後の再送はありません。

観測code/sequence、browser_version、cleanupを分離し、観測と版はcleanup前にimmutableへ確定。
版取得だけが失敗しても初期化の観測や終了処理の失敗を上書きしません。status=successには
VERSION_VERIFIED・BLANK_PAGE_PROTOCOL_READY・page_protocol_initialized=true・cleanup完了のすべてが必要です。
BROWSER_UIもpageも再開せず、外向き転送は0です。この版変更の実Actions上の解消はまだ未確認です。

根拠: https://chromedevtools.github.io/devtools-protocol/tot/Browser/#method-getVersion

## 直列10回の実Chrome診断

専用workflowはten-trials.mjsで同じmain()を直列10回呼びます。各main()が新しい一時profile・Chrome・
全拒否proxyを作成し終了します。各回の固定観測code/版/cleanupとelapsed_ms、最後に成功・失敗・未試行件数を
記録します。ローカル合成結果を実試行へ補充しません。通常の起動・版・初期化失敗は10回まで継続し、
保護喪失、停止していないtarget、不正入力/コマンド、非ゼロ安全counter、終了未完了などは即時SAFETY_STOP。
未試行を成功としません。jobは最大8分、同じbranch/attempt1だけで、mainや実計測workflowは変更しません。
