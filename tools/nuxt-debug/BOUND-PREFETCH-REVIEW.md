# 束縛された先読みの「送信せず破棄」閉域候補

親は `9aa7667aaadd3649b4a876e067f1b599f576c812`。ローカルbranchは `diag/nuxt500-bound-prefetch-local-20261122`。今回の目的は拒否された先読みを送らず、その拒否ACK後に既存のmetadata読み取りへ進めるかの閉域対照だけである。Nuxt500の原因・解消は主張しない。

## 実在する処理差

親の `tools/cdp-startup-diagnostic/staging-gateway.mjs:45–47` は先読み印を見て `Fetch.failRequest`、256件までは続行する。比較Aの `tools/ab-observe/gateway.mjs` は `requestDecision` が SCOPE なら同じabort後に `AB_BOUNDARY_REJECTED` で全体停止する。実run44983100225が証明したのはHTTP200後のSCOPE/GET/Fetch・OTHER_OR_UNKNOWN・先読み印ありまでで、initiator、loader、URL、具体的資産種別は保存されていない。

今回の元A対照は、この同じ粗い分類で停止するケースを、元の `runArm('A')` / request / start に制御CDPを接続して作る。新対照は専用subclassだけを選び、同じ先読みへのcontinue命令0、abort ACK1、続く許可済みmetadataの本要求1・headers/EOFまでを確認する。HTTP・DOM・Chrome版はdoubleによる値であり、実サイト／実Chrome証拠ではない。公開用の閉域結果から偽のChrome版・実エミュレーション主張は除いている。

## 限定した破棄条件

一般のPurposeヘッダーやSCOPE/Fetchだけで例外にしない。次の全部を必要とする。

- 既存のrequestDecisionがSCOPE、Fetch、GET。通常の許可判断・転送方法は不変。
- 正確なstaging HTTPS originのみ、query・credential・fragment・bodyなし。API、解析／広告等の既存危険経路、二重エンコード等の不明パスは除外。image originもこの例外にはしない。
- 先に受理済みTARGETのPage.frameNavigatedと既知loader、同じprimary ready session / main frame / created targetへの結合。
- 同じprimaryのNetwork.requestWillBeSentとFetch.networkId / requestId、URL / method / frameをメモリ内だけで完全照合。Network.documentURLもTARGET、Network.loaderIdも既知loader。異なるsessionや前後順未確定では続行しない。
- Networkのinitiatorはparser、initiator.urlもTARGET、stack/別request由来は不可。Network側とFetch側の両方に正確なSec-Purpose: prefetch。Purposeだけ、script initiator、欠損・重複・競合は不可。
- Request段階のみ、redirectや応答段階は除外。Fetch.failRequestのcommand IDと同一sessionに一致した、resultが明示された空の成功応答を確認して初めてabort_ackedとする。エラー、欠損、所有者変更、別違反による停止後のACKは続行の根拠にしない。元callが欠けたresultを空objectへ置き換える前に、この専用ACKだけを検査する。command IDは固定親のcallが同期的に++ownIdしてからsendする実装に束縛し、他のCDP応答処理は変えない。

devtools-protocolの既存ロック依存のtypes/protocol.d.tsではNetwork.requestWillBeSentがloaderId/documentURL/initiator/frameIdを持ち、Initiator.typeはparser/script/preload等、parser URLが明示される。ただしAPIの型にフィールドがあることは、今回の実Chromeが同じprefetchでそれらを同じ順序で出す証明ではない。

**実Chromeでの整合性・偽装耐性は未確認。** 前回の実要求のinitiatorがparserかも不明で、この限定条件を実際には満たさない可能性がある。通常sandbox Chromeの既知CHROME_SANDBOX_FAILED記録はあるが、今回は緩和・別起動をしていない。制御CDPに適合する値を入れた正例をブラウザの真実とみなさない。したがって本候補は既存live入口やworkflowに接続しない。ライブ移行可とはしない。

## 不変の制約と採否

専用ledgerは最大256、破棄ACK待機は最大6。通常forwardedの120件、既存prefetch合算256、既存inflight6を維持。既存のforward/permissionを増やさず、discard ledgerに入ったnetwork IDをstartへ渡そうとしたら停止する。別の範囲外Fetch、API、第三者、POST、認証、redirect、未知target、保護喪失は従来のfatalへ進む。新たな続行は停止条件の狭い局所候補であり、既存Aと同等の無介入ブラウザとは主張しない。

他の違反と同時に来た場合は、その違反と最初の理由を維持し、ACK待ちを解除して停止する。cleanup開始時点で未claim/未ACK/pendingがあれば、metadata EOFが先に得られていてもfatalとして不採用。Network応答やEOFが破棄要求に見えた場合もfatal。cleanup時にID/URLのメモリを消す。固定スナップショットはenum/上限付き件数だけで、URL/header/query/body/ID/任意文字列は出さない。EOFはJS本文読取り成功やNuxt500との因果ではない。

## 検証と次に必要なこと

新40対照はNode22.19.0 --unhandled-rejections=strict。元Aとの対照、続くmetadata、通常拒否、Purposeだけ、script由来、各束縛欠損・URL不一致、API/query/image先読み、認証/外部/POST/redirect、ACK error/不正/欠損、別違反競合、応答異常、257件、ACK待機7件、未知target、cleanup故障、先行metadata、欠けたFetch通知、遅着ACK、owner変更、固定投影、wire例外、通常120上限を含む。requestを即fulfillするoverrideは使わず、元のlive wrapperと実request処理を制御wire/Pageに通している。旧474/48/27/23と、既存コード・全workflowのバイト一致も確認する。

次に必要なのは外部転送0の**閉域実Chromeだけ**の検証。自然なparserのlink prefetchとscript/Purpose偽装、逆順・欠損を同一Chromeで比較し、上記の束縛と実HTTP handler到達0、abort ACK、metadata到達、終了時不完全の不採用を確認する必要がある。そこで条件を満たせなければ停止し、既存Aのfatalを維持する。実ページを先に試したり、ヘッダーだけへfallbackしたりしない。

新workflow・live入口・運用設定は作成/変更していない。今回push/Actions/ステージング/本番/PSI/D1は0。使用枠2/10は不変。閉域結果の保存はレビュー用で、正式計測・スコア・LHRを保存しない。
