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
Chrome起動30秒、WebSocket3秒、各CDP command2秒の上限です。

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

## 関係分類だけの診断

単純な10回反復は終了済みで、新しい検証として数えません。workflowは1回の診断に戻しています。
新しい固定enum target_relationは同一session、同一targetの別session、別targetのroot/内部UI配下を区別。
tab_rejectionは追加root/内部UI配下等、tab_create_replyは作成応答受領前後だけを出します。
raw ID・URL・titleは出しません。関係の記録だけを追加し、転送コマンド・停止条件は不変です。
合成CDPでは元コードとの6ケース差分比較で送信コマンドと停止結果が完全一致しています。

直前の関係分類probeはDevToolsファイル待ち10秒で終了し、target検証に到達しませんでした。
初回起動の待機不足という別仮説を確認するため、全拒否状態の起動待ちだけを30秒までとし、
ENOENTと読み取り不可・不正ファイル・Chrome終了を区別します。起動コマンド・TLS/sandbox・
外向き転送禁止・CDP/対象の停止条件は変えていません。仮説は実Chromeの次の結果で判断します。

## createTarget応答IDによる候補選択

response-bound.mjsは出現順で選びません。作成要求後から応答前までのroot TAB候補を最大3件、
停止状態のまま保持し、返されたTAB IDと厳密一致する唯一のsessionを選びます。
候補・UIへ送るのは再帰停止autoattachだけです。非選択候補は再開・Page初期化しません。
応答後の新しい不一致TAB、未知/不整合、候補上限、制御喪失は停止。応答IDに対応する候補が
現れなければ5秒以内にTAB_BINDING_FAILED。選択TAB配下の唯一のabout:blank pageだけをmetadata初期化します。
response_id_bound/candidate_tabs/quarantined_tabsのみを出し、raw IDは出しません。
これはLighthouse完走や実サイト成功とは別の前提検証です。

## 停止していない内部UI通知の観測分類

unpaused_uiはメモリ内のtarget/session照合だけで、同一session・同一targetの別session・
別targetを固定enumへ分類します。既存guardのREADY/INITIALIZING、選択TAB/別TAB/未確定TABの範囲、
親kindだけを記録し、raw IDやURL/titleは出しません。どの分類でもTARGET_NOT_PAUSEDで終了し、
既知UIの重複でも無視・再開する例外はまだありません。停止中の既存sessionがあっても、別sessionで
waitingForDebugger=falseという通知だけから対象全体の停止保証を推測しません。

## コマンド別の未応答診断

commands.entriesは固定コマンド名・対象kind・SENT/RESPONDED/ERROR/TIMEOUT/CANCELLEDを順番に記録します。
command_noは診断内の連番で、Chromeのtarget/session IDではありません。送信params・応答本文・URL・
raw errorは記録しません。commands.timeouts.pendingはタイムアウト時点で同時に未応答だった操作です。
Chrome内部の依存関係やdeadlockをこの一覧だけで断定しません。

2秒期限、送信コマンド/引数、保護条件、再開禁止は不変。最初の停止理由とコマンド記録をcleanup前に
immutableへ確定し、終了に伴う待機中止はTIMEOUTと区別します。最大64コマンド・128イベントで有界化。
同じkindへの並行要求も連番で区別し、個々のsession IDを外に出しません。

## 同一job内の一因子比較

operation-comparison.mjsはNO_CREATE（作成なし対照）、FULL_CONTROL（従来動作）、UI向け・
1番目TAB向け・2番目TAB向けautoattachのうち1つだけ保留、に加え各候補一本だけを送る3条件、計8条件を新規profile/processで直列比較します。
保留は送信しないままPromiseを保持し、終了時に中止します。対象の再開や新しい通信許可はありません。
保留条件では保護設定の完了自体が意図的に不完全なので、ページ検証済み/計測可能とは扱いません。
rootの停止autoattach、Chrome/TLS/sandboxと全拒否proxyは全条件共通。未知や未停止通知は従来通り停止します。

公開結果には操作のFIRST_TAB/SECOND_TAB/BROWSER_UIラベルと送信/保留状態、通知の親sessionが
どの操作の送信先か、既存通知の親と同じか、だけを固定enumで記録します。IDやURLは出しません。
各条件のChrome版を照合し、不一致は比較を中止、欠損はUNVERIFIED。runner版は同じjobのsetupログで確認します。
通常の起動/タイムアウトも結果として残し、実際に候補操作へ到達しなければintervention_applied=false。
同じ未再現を否定の証明にはしません。条件ごとに観測終了時点も異なり得るため打切りを区別します。

各条件の終了確認・profile削除後に次を開始し、完了した記録をatomic保存してから進みます。
cleanup失敗・非ゼロ安全counter・Chrome版の変化は比較全体を停止。mock Lighthouseや実サイトへの移行はありません。

各候補一本のみの3条件でもrootの停止autoattachは共通で有効です。比較するのは子sessionへ送る
再帰autoattachのうちどれかで、rootと子の重複接続の必要性まで完全分離した実験ではありません。
別の未停止targetで先に終了した条件は打切りであり、目的のUI通知が将来発生しない証明ではありません。

## root捕捉と確定IDに限定した再帰接続（診断比較）

公式PDLを確認: https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/domains/Target.pdl
setAutoAttachは既存の関連targetにも接続します。filterは順序付きの最初の一致で決まります。
autoAttachRelatedは既存setAutoAttachを取消すため、今回の全件監視の代替にはしません。

CONTROLは従来動作。最初の案はrootでTAB/PAGEを同時に含め、Chromeが拒否しました。
実装の制約を追加確認: https://raw.githubusercontent.com/chromium/chromium/main/content/browser/devtools/protocol/target_handler.cc
rootフィルターはTAB/PAGEを同時に許可できません。通常PAGEのparentIdも常にあるとは限りません。
https://raw.githubusercontent.com/chromium/chromium/main/content/browser/devtools/render_frame_devtools_agent_host.cc

ROOT_PAGEはrootでPAGE/UI/未知種別を停止捕捉しTAB/browserだけを除きます。TABは全件discoveryで監視し、
作成要求は通常PAGEとして発行。返されたPAGE IDとrootで捕捉した唯一のPAGEを直接照合します。
TAB/UIには再帰接続しません。root envelopeと応答IDで所有が確定するため、任意の親や出現順を推測しません。
SELECTED_TABはrootでTAB/UI/未知種別を停止捕捉しPAGE/browserを除き、応答TAB IDに一致するsessionだけへ
UIを除いた子捕捉を設定します。PAGEはこのTAB親session、または矛盾しない明示parentIdを必須にします。
両案ともPAGEの子worker等は停止捕捉し、全種別discoveryで未知・追加TAB/PAGEを検出すると停止します。
UI未停止通知や制御喪失に例外はありません。フィルターで除外した対象を監視から消すことはしません。

三条件は同じjob/Chromeで新規profileに分けて比較します。rootのPAGE捕捉を追加するため設定自体が変わる
比較であり、単一因子試験とは呼びません。必要なroot/子autoattach ACK・親ID照合・metadata初期化・cleanupを
確認した条件だけsafe_for_fixtureにします。この診断成功はLighthouse完走やJSONレポート保存とは別です。

## 模擬専用Lighthouse経路（外向き転送なし）

fixture-gateway.mjs/fixture-runner.mjsは診断用だけです。運用engine/workflowを編集しません。
ROOT_PAGE対照比較が応答PAGE ID照合・停止PAGE/子捕捉ACK・初期frame・cleanupを確認した同じjobだけで起動。
固定 http://127.0.0.1:47500/fixture と /fixture.js をFetch.fulfillRequestでメモリから返します。
このポートにHTTPサーバーを立てたり、実サーバーへ取りに行く処理はありません。他は中止します。
Chromeのproxyも従来denyProxyで、上流client・接続を有効化するAPIを持ちません。TLS/sandbox旗は不変。

rootの全件discovery/停止PAGE捕捉を維持し、UIはrootで停止保持してPuppeteerへ渡しません。
新しいtarget/worker/未知種別はPuppeteerへの可視性とは別の監視経路で停止。PAGEは作成応答ID一致・
子捕捉・Network/Fetch/WebSocket禁止・ServiceWorker bypass・初期frame照合のすべてのACK後だけ渡します。
既存Gatewayが認めていたready PAGEの補助sessionも、明示attach要求・返却session ID・対象PAGE ID一致と
主sessionの保護存続を必須に限定します。内部UI/未知sessionを許可する例外はありません。
呼出側がroot/子filterを変更して監視を隠したり、Fetch/TLS/ServiceWorker保護を解除する要求は止めます。

実Chromeで表示とPOST/外部遮断、popup/worker/iframe/保護喪失/設定改変停止、WebSocket handshakeなしを確認。
全件通過時だけ新規profileでLighthouse13.6.0を1回実行。mobile/simulate/300ms/800kbps/CPU6x、キャッシュ初期状態。
LHRのruntimeError、URL、版、実設定、有限スコア/全指標を検証し、画像dataを含まないLHR JSONだけをatomic保存。
cleanup完了後のJSON読戻し・SHA256まで成功した場合だけpassedとします。Trace/artifacts/画像は保存しません。
ログとstatusは固定段階codeだけ。失敗を0点にせず、診断JSONとfixture-lighthouse.lhr.jsonを区別します。

ローカル実行（正式Chromeがsandbox有効で使える環境のみ）:
```
node --test tools/cdp-startup-diagnostic/*.test.mjs
(cd tools/lighthouse-once && npm ci --ignore-scripts)
CHROME_PATH=/opt/google/chrome/chrome node tools/cdp-startup-diagnostic/scoped-comparison.mjs
CHROME_PATH=/opt/google/chrome/chrome node tools/cdp-startup-diagnostic/fixture-runner.mjs
```
既知のローカル環境はCHROME_SANDBOX_FAILEDのため実ブラウザ検証不可。helper所有者やsandbox設定は変更しません。
GitHub Actionsの公式ubuntu-24.04 Chromeでmandatory fixtureを実施し、失敗ならLighthouse段階へ進みません。

## 承認された staging /ja/ の一回限り実測

staging-once.mjsはURL入力を受けず、`--execute`指定と同じSHA/安全コードfingerprint/Chrome版の
fixture-lighthouse-status.json、staging-memory-proof.jsonを必須とします。通常のPSI/既存運用workflowは変更しません。
診断workflowでは固有コミット件名 `diagnostic: staging ja one-shot (20261118-root-page-a1)` のpush/attempt1だけ実測します。
将来の別件名pushでは実測しません。同じjobでの二重実行はexclusive作成するattemptファイルで拒否します。

先に従来の実Chrome模擬異常試験・模擬Lighthouseを実行し、次にstaging用policy自体をメモリ応答・
転送不能proxyで確認。それらが通るまで実ホストへのブラウザ要求はしません。
本番URLへのfallback、別ページ、実測のretry、キー、API、D1、設定変更はありません。

staging-egress.mjsは標準OS DNSでstaging/image.hirameki.devのIPv4 A回答を各1回だけ取得し、
全回答が公開IPv4のときだけIPを固定します。private/loopback/linklocal/CGNAT/文書・特殊/予約域とIPv6は拒否。
https://www.iana.org/assignments/iana-ipv4-special-registry を参照し、特殊用途範囲全体を保守的に拒否します。
IPv6だけのホストでは開始できません。CONNECTは正確な2ホスト:443だけ、TCPは検証済みIPへ接続するため
DNS再解決/fallbackはありません。TLSはChromeから元hostnameへend-to-endのまま、復号/独自CA/証明書無視はしません。
proxyは初期閉鎖で、PAGEの保護完了後だけ有効化。制御喪失/異常では即時全tunnelを閉じます。

トップDocumentは https://staging.hirameki.dev/ja/ のGET1件のみ。GET/HEADの公開静的resourceは既存policyの
2 HTTPS originに限定、APIは既知の `/ja` ContentメタデータGET契約だけ。Cookie/認証/APIキー類/Refererを
送信前に除き、query付きsecretや未承認API、GA4/広告/外部origin、prefetch、POST、redirectを拒否します。
HTMLは200/text-html、非private、IS_PRODUCTION:falseと追跡参照なしをメモリ内で確認し、そのまま継続します。
HTML/JS/CSSを書換えませんが、検査による待ち時間はあります。正常in-flightは全体6件、通常120要求、prefetch256上限。
遮断された依存の固定カテゴリ件数を残す、制限付きstaging基準です。CDN purge/warmはしません。

Lighthouse13.6.0/mobile/simulate RTT300ms/800kbps/CPU6x。全設定、final URL、runtime error、実score/全metric、
benchmarkIndexと表示の件数だけを検証。公開する実測JSONは数値・日時・固定URL/版/実設定・遮断件数のwhitelistで、
生LHR/HTML/header/画像は保存しません。cleanup完了後atomic保存・JSON読戻し・SHA256を確認します。
失敗はscore=nullで、実測前停止とDocument要求開始後の実測失敗を分けます。HTTP/DNS/WAFで止まれば迂回や再試行はしません。
この診断の結果を通常PSI系列・正式な全件ベースラインと混ぜないでください。

## 応答経路の隔離診断（実サイト実行なし）

現在の診断workflowから `staging-once.mjs --execute` ステップを外しました。
ブランチpushでは模擬試験のみ実行し、staging DNS/HTMLへの通信や再計測はしません。
`response-fixture.mjs` は外部に接続する機能のないHTTP proxyで、固定loopbackの合成HTML/JSだけ返します。
診断専用subclassでその固定URLをポリシー照合時だけ写像し、元のStagingGatewayの
continueRequest → 実Chromeの応答停止 → metadata照合 → continueResponseを通します。
live側のlocalhost禁止、TLS、sandbox、停止判定、許可先や上限は変更していません。
正常8並列JS（同時最大6）、通信切断、metadata欠損注入、redirectを別の新規プロファイルで検証します。

ResponseTraceは固定enum・単調な観測順・最大64イベント/16 milestone/最初の異常を保存します。
response metadataなし・通信エラー・両方を区別し、通信エラー名はCDPの既知enum以外OTHER。
URL/ID/headers/bodyは保存しません。停止理由と処理判断は以前と同じです。
Lighthouse13.6.0のlogger warningの完全一致2種類だけを観測し、load timeout/hung判定と
response異常、LHR返却後のPAGE_HUNG観測を分けます。listenerは必ず外します。
順序はローカル観測であり、Chrome内部の因果関係を証明するものではありません。
前回run44351598714はこれらを記録していないため遡及的には原因・順序を確定できません。
prefetch249/256は停止理由ではありません。単体試験で249の遮断と応答障害を別に確認します。

## 追加承認された一回のretry（20261118-b1）

診断workflowは固有件名 `diagnostic: staging ja retry after response proof (20261118-b1)` のpush/attempt1だけ、
既存の異常遮断・模擬Lighthouse・メモリpolicy・実Chrome loopback4ケースがすべて成功した後に固定 `/ja/` を1回実行します。
同一SHA・安全コードfingerprint・Chrome版、4ケースの順序/成功/cleanup/転送0を実測コマンドでも照合します。
ほかの件名のpushやattempt2では実サイトステップは動きません。失敗しても実測retryはしません。
DevToolsActivePortが空/正しい形式の途中だけの場合、従来の30秒上限の中で完成を待つようにしました。
完全な形式以外には一切接続せず、不正値は即停止。新プロセスの再起動やsandbox/TLS変更はありません。
これは部分書込みの可能性への最小対策で、前回のファイル内容は未保存のため原因確定とは扱いません。

## Font Network.loadingFailed の完全一致診断（実サイトなし）

現在のworkflowから実サイト実行stepを再び削除しました。pushではstagingへのDNS/HTTP/計測を行いません。
`NetworkFailureJoin`はFetch要求のnetworkIdとセッションをメモリ内で保持し、同セッションの
Network.loadingFailed.requestIdとの完全一致だけで照合。応答側networkIdが異なる場合、別セッション、
redirect、複数Fetch/Network失敗、容量不足は明示的な未確定分類とし、近接順で推測しません。
先着・遅着を区別します。Network情報が停止までに来なければ未観測。収集のために停止を待たず、
停止後に既に届いたイベントは記録できても、Chromeを再開・再接続しません。
生errorText、URL、ID、headers、CORS failedParameterは保存・出力せず、既知enumだけを残します。
CANCELED/CORS/TLS/CONNECTION/DNS/TIMEOUT/BLOCKEDは独立した観測で、単一の根本原因とは断定しません。
前回のrun44356846151はこれを保存していないため、Font Failedより細かい過去の理由は復元できません。

`font-fixture.mjs`は閉じたloopback proxy内で正常フォント・切断・CORS拒否を検証します。
OSに元からあるDejaVuSans.ttfを読み、合成HTMLのFontFaceだけで使用。フォントファイルは同梱/公開しません。
診断専用subclassの固定2 URLだけを照合用に写像します。実測のlocalhost禁止やTLS設定は変えません。
proxyには外向き転送機能がなく、正常ケースは実際のフォントdecode成功まで確認します。
自分のFetch.failRequest送信・保護停止より後にNetwork失敗を観測したかも別のbooleanで保持します。
特に遅着の canceled/ERR_ABORTED は自分の遮断・終了の結果の可能性があり、先行したFont Failedの原因と断定しません。

フォント診断の対照は正常/切断を同一loopback origin、CORSを別loopback portで行います。
proxyで遮断したOPTIONS・POST・その他メソッドを固定件数で区別し、OPTIONSがGET用preflightかはboolean相当の件数だけ保存。
OPTIONSも許可しません。ブラウザー内部のpreflightはページFetchとは別経路の可能性があるため、
これを観測した場合、GET/HEAD限定のライブ経路がその送信まで防げるとは断定しません。
この診断workflowには実サイト実行はありません。
