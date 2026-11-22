# /ja/一回の自然読み込み診断候補（未公開・未実行）

親 `063282ef31e30d21803829e0b5f3169e11e00405`。自然先読み6対照が成功したrun44991192806は過去版の証拠であり、新候補のChrome合格には流用しない。今回push/Actions/実サイト通信0、使用枠4/10のまま。

## 変更しない境界

`policy.mjs`、`gateway.mjs`、`public-routes.json`、既存の送信・proxy・Chrome起動・sandbox/TLS・authless profile・Font・CDP受理・旧workflowをバイト不変で維持。通常と先読みで同一policy、単一合計120要求、同時6、CONNECT32、固定GET/HEAD・2公開HTTPS origin、主文書 `/ja/` 1回、redirect/credentials/他origin/追跡/管理/その他API拒否。45秒の同一ページ観測、nav30秒・全体150秒。実CDP 300ms/上下800Kbps/CPU6、新規の空profile。Lighthouse採点、trace採取、score/report/DB保存なし。追加リトライなし。

## どこで止まるか

NoReinspectionGatewayの受動 `Network.responseReceived` の既存境界は、URL不一致・SW・HTTP非200・auth/private・MIME不一致で停止、loadingFailed（キャンセル含む）でも停止する。これはresponseを止める方式ではなく、Chromeが受けた通知をNodeで観測する方式。ブラウザが先に本文を処理した可能性もあり、反応前に停止する場合もある。ここから画面切替の前後・因果は断定しない。

認証challenge/redirectを伴わない公開の500や404であっても今回継続させない。本文は読まず、既存停止を遅延しない。status・既知resource種別・auth/privateヘッダーが見えたかの固定区分・redirect status bool・既知network failure分類だけを、最初の原因として停止前にラッチする。auth/privateヘッダー不在はデータの公開性の証明ではない。読取上限・許可上限の拡大はない。

許可済みContentは従来の実装に根拠があるfirst metadataとHomeDiscovery directoryだけ。EOFはブラウザJSでのJSON読取りやarticle.title参照成功ではない。失敗時、Nuxtフックや終了時DOMが未回収ならUNKNOWNのまま。Chrome停止後にCDPを追加発行して回収しない。

## 証拠を失わない経路

ナビゲーション前から既存のNuxt app:error/vue:error、payload/DOM、main-contextのRuntime console.error/exceptionThrown、Networkの観測を使う。Log.entryAddedやChrome Console全体の網羅を主張しない。Nuxt snapshotとCDP/Networkの共通時計はないため **SAME_WINDOW_ONLY_NOT_ORDERED**。CDP内の受信順も因果ではない。Ready/context前の穴、未知/overflow/停止後通知を明示。

従来と同じfirst/end samplingをローカルの薄いpeek対応コピーへ移し、既に完了した最初のsampleだけRAMから参照できる。追加のブラウザ操作はない。停止でendを取れなかった場合にfirstを失わない。Nuxt collectの一度きりの契約・観測制限は不変。

childはStart IPC前にブラウザを作らない。原始stdout/stderrを親で破棄して固定boolだけ残す。固定のtyped projectionを通したprogressを、親所有のatomic/fsync/readback JSONへ保存。子側の非公開0700 journalを補助に使い、親はIPCとjournalのseq・最初のfatal/refusal/response failureを照合。ナビゲーション呼出し回数と受理文書数を分け、確証が無いときはnull。正常終了・HTTP200＋DOM500・guard stop・欠測を分ける。64通常更新＋16 critical更新、1packet最大64KiB、親最終JSON最大128KiB。通常更新省略はlimitedで明示し、最後の原因を上書きしない。保存不能・protocol不整合・timeout・cleanup未確認は不採用、子process groupを停止する。共有secret類はchildへ渡さず、PATH/HOME/locale/Chrome pathと必要な公開GHAメタデータだけを明示継承する。

## 同一SHAの将来ゲート

新ref候補 `refs/heads/diag/natural-ja-observe-once-20261122`、専用path `.github/workflows/staging-natural-ja-observe-once-20261122.yml`、件名 `diagnostic: natural ja observation once (20261122-v1)`、親063282e・1commit・push/attempt1だけ。旧workflow不変。12分・専用concurrency・contents:read・checkout資格情報非保持・fetch-depth7。

1. 既存681＋新31単体（Node24.19.0/Node22.19.0 strict）。
2. 同じ候補の既存実Chrome native6対照を新たに実行。新プロファイル、同じ固定メモリ、reject-only proxy。
3. **実際の最上位observeNaturalReadsとNuxt probe、親子プロセス・同じ固定出力/cleanupを通す実Chrome6対照**: 正常、app:error500のみ、console.error＋app:error500、許可Contentの500、Nuxt静的資産404、ネイティブAbortControllerによるContentキャンセル。正常/500対照は同一documentの表示とフック番号を確認。異常3対照は公開responseカテゴリが親に残ることを確認。陰性結果を成功した実観測と混同しない。これらはNuxt互換の小さいfixtureであり実サイトNuxt/Contentの再現ではない。
4. 3証拠ファイルのexact SHA/runID、全件pass・skip無し・同じChrome/binary hash、閉域上流0/cleanupをJITで照合。wx sentinelを親で一度だけ作成し、childも再照合。
5. 全て通った場合だけ、将来の承認対象workflow自身が固定 `/ja/` 1回へ進む設計。今は公開も実行もしない。失敗/未知は次段階skip、再起動なし。

artifactはunit/native/top/live親所有の固定JSON4個のみ（1日）。live入口は固定コマンドのみでURL入力なし。上流なしの閉域fixtureでも論理URLを使うが実サイトへの転送はない。

## 台帳と未完了範囲

この環境の既存共有資料・取得済み資料から、最新2594件の正本staging sitemap/manifestを追加で見つけられなかった。保持しているのは063282eの345公開ルート＋259 public資材の保存ソース台帳。現行と全面一致するとは扱わない。台帳自体は変更せず、未知ルート/Content形状は通常・先読みとも同じSCOPEで停止し、診断未完了として報告する。現配信版の同定・本番との同一視もしない。新たなサイトGETやsitemap preflightは加えない。

## ローカルと実ブラウザの区別

新31試験は実際のtop runnerを通るcontrolled renderer/CDP9対照、実process/親journal12対照と、record failure・redaction・first reason・atomic readback等。元request/startを通し、requestをALLOWへoverrideしていない。新旧の回帰と正確な候補の浅いcloneでも確認する。実Chrome `/opt/google/chrome/chrome` が無いため新Chromeゲートは未実施。古いrun合格や合成結果で代用しない。指定の補助skillは既知のカタログ/実行環境に無いため、以前認められた閉域検証・停止・レビュー手順で進める。
