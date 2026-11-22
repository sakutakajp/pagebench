# 単発 A/B 診断候補（未公開・未起動）

親: `2d851705facce2749307e21363404429abec9995`。
予定 ref: `diag/ab-gateway-observe-once-20261122`。
件名: `diagnostic: guarded gateway AB observation once (20261122-o1)`。
専用 workflow: `.github/workflows/staging-ab-gateway-observe-once-20261122.yml`。

## 何を比較するか

採点や Lighthouse navigation runner 全体の比較ではない。A/B とも同じ公開読み取りの安全境界、同じ target 捕捉保護、同じ最小状態サンプルを使う。
A は応答の Fetch 停止・本文検査、ヘッダーの書換え、Pagebench の先読み遮断、Nuxt hook / identity observer を使わない。共通の送信前の安全検査と読み取り専用の応答メタデータ監視はあるので、「完全に無介入の通常ブラウザ」とは呼ばない。
B は親の StagingGateway、Nuxt / lineage / detach 観測器を変更せず継承・呼出す。既存の応答検査、認証・Referer 等のヘッダー除外、先読み遮断、Font の受動的な応答検証が追加される。観測器の trace 境界を駆動する限定 trace はメモリ内で読み捨て、保存しない。Lighthouse の gatherer や audit は実行しない。従来の Lighthouse 全体と trace categories / 実行順まで同一という意味ではない。

特に **全HTML本文の完了待ちはBだけ**。親 staging-gateway の `Fetch.getResponseBody` → public HTML検証 → `Fetch.continueResponse` の順を維持する。Aは応答段階を停止せず本文も読み出さないため、この全本文バリアはない。遅い末尾によってBのHTML解放・最初のFCPが遅れることは比較対象の一部であり、「両者とも全本文を待った同じ配信条件」とはしない。結果にも `html_full_body_barrier:B_ONLY` を固定記録する。期限切れ・FCP欠測・元DOM未観測だけを500への遷移とは呼ばない。

新しいlocalhost実HTTPのdelayed-tailテストは、完全な見出しをprefixに入れた後に末尾を明示的に保留し、Bの実応答ハンドラ（CDPだけは制御した代替）がEOFまで解放しないことと、Aにbody-read barrierがないことを確認する。これはChromeによる途中描画の証拠ではない。通常sandboxの実Chromeは環境で起動できず、実ブラウザのstreaming描画順を確認したとは報告しない。既存の実Chrome応答経路ゲートは残す。

前回の simulate 300 ms / 800 kbps / CPU6 はスコア計算用で、実ブラウザに同じ遅延を課していなかった。今回は両者に **実際の CDP** `latency:300`, `downloadThroughput:102400`, `uploadThroughput:102400` bytes/s と CPU `rate:6` を同じ primary session に適用する。上下とも800×1024/8 bytes/s。モバイル412×823、DPR1.75、Android11 Moto G Power UA（Chrome milestone に一致）、touch 有効。設定コマンドの正常応答と端末値を確認し、その後の変更・解除は停止。設定の正常応答は実効回線速度・CPU倍率の独立した物理測定ではない。

`about:blank` には viewport meta がない。ナビゲーション前は5コマンドのACKと、`screen.width/height`・DPR・UAの実測一致を別々に記録し、`innerWidth/innerHeight` は取得も比較もしない。対象文書の既存2サンプルにmeta有無とviewportの固定分類を追加する（追加のCDP評価呼出しはない）。metaが1つある時だけinner viewportと412×823のMATCH/DIFFERENTを返し、metaなしはNOT_COMPARED、複数/欠測はUNKNOWNとする。meta PRESENTは要素の存在であってcontent値の妥当性の証明ではない。metaありのlayout差異だけではCONFIG失敗にせず、結果の条件として明示する。screen/DPRの不一致・欠測、metaの曖昧さ・欠測は比較完了としない。これはCSS可視性や500の原因を判定するものではない。

## 固定範囲と停止

将来、全ゲートが成功した場合だけ同じ job 内で A→B。各 arm は独立した新規プロファイル・プロセスで1回だけ `https://staging.hirameki.dev/ja/` に遷移する。観測窓は送出から45秒、navigation上限30秒、armの有界終了150秒。retryなし。Aの起動・保護・欠測・cleanup失敗ならBを始めない。500や短文は観測結果として記録し、通信失敗とは区別する。

両者に公開 HTTPS の staging/image の厳密2 origin、GET/HEAD、既存の静的資産・日本語メタデータ契約だけを許可。新APIを推測で追加しない。Cookie禁止の新規profileを共用仕様とし、資格情報ヘッダーが見えたら送らず停止する。Aには書換えで救済する経路はない。Bでもこの共通条件を満たした後に元の処理を使う。第三者・本番・write・redirect・auth・worker・追加ページ・WebSocket・service worker・内部IPへの解決は拒否。透過CONNECTは既存の公開IPv4固定を再利用し、TLSとsandboxを維持する。

normal120 / prefetch256 / 同時6件を維持。Aの許可済みprefetchは送るがBは元のまま遮断する。共通契約外のprefetch、用途不明のOther、必要なAPIがあれば、許可範囲を広げず比較を停止する。Otherはimage destination等の固定した静的文脈のみで、API/active fetchには拡張しない。Aの応答は停止せず受動監視なので、Bの応答隔離と同等ではない。送信前の共通境界で外部・write等を拒否し、異常なら結果を不採用にする。

同一フレーム・loaderに対応したFCP通知後の最初のサンプルと窓終端を比較する。本文・見出しは固定boolean、bodyの20文字区分、構造署名の400–599番号だけ。ORIGINAL_CONTENTは既知DOMの存在とbody区分であり、main固有の文字数・CSS可視性・描画ピクセルを証明しない。FCP自体がmainの表示を証明するわけではなく、サンプル間の短い表示や遷移は否定できない。サンプルは各通知/期限後の非同期CDP処理であり、その瞬間そのものではない。元DOM未観測、500への同一文書遷移、短文、欠測、片側失敗を区別。配信版は採取せず **同一deploymentは未証明**。1対で因果は確定しない。スコア・LHR・生trace・本文・画像・例外・stack・URL query・CDP ID・headers・外部DBの保存はない。

## Gate

exact ref / push / attempt1 / 件名 / 親 / HEADとeventの一致 / 親から1commit / exact changed file set / source manifest を検査する。新workflow以外を変更しない。将来の公開時にはレビューした完全SHAだけをpushし、refとrunを読み戻す必要がある（現候補に自身のSHAを循環的に埋め込まない）。

Node24.19.0で既存474件と新規48件を完全実行、Node22.19.0へ戻す。同じSHA・Chromeで従来のcapture ready、memory、response、Font19、stage、Unicode trace、detach、main paint、lineage7、Nuxt5、native cause6を保持。さらに閉域のA/B実Chrome20ケース（従来の18にmetaなしA/Bを追加）が全部成功し、JSON readback、上流接続0、live0を必須にする。通常metaあり/なしの両方でpost-navigationの分類も必須にする。skipは不可。新proofは120秒以内、同一Chrome版・binary hash、全cleanupと実設定ackを要求する。合成テストの成功で代用しない。

### 各試験が通る経路と未検証部分

- 新しい20ケース（旧候補では18）は `memoryClass.request` でA/Bのrequest処理を**上書き**し、共通boundary検査後に既知の応答を直接fulfillする。実Chromeでtarget保護・設定ACK/readback・共通DOM/viewport観測・Bの各観測器・停止/cleanupを通すが、live Aの `start/continueRequest`・queue/font bindや、live Bのヘッダー除外・HTML全本文検査・`continueResponse`の全経路を通る証明ではない。
- 維持する既存の実Chrome `response-fixture` 4対照は、固定loopbackだけのHTTP proxyとfixture内の論理URL対応を用い、元のStagingGatewayの `continueRequest` → 応答停止 → metadata/本文検査 → `continueResponse` を通す。元のB経路の回帰であり、新しいA/B wrapper全体のend-to-end実通信検証と同一視しない。memory/Font等の他の既存ゲートも、それぞれの元のfixture範囲に限定される。
- 新規unitはA/Bの実requestメソッドを制御したCDP代替に接続し、ヘッダー非改変/除外、prefetchの差、上限・queue等を確認する。delayed-tailは実localhost HTTPを使うがChromeは代替で、BのEOF待機/解放の順序だけを確認する。Aがprefixを途中描画した証拠にはならない。
- meta有無・980相当layout差・欠測・固定JSON投影のローカル確認も合成である。将来の実Chrome20ケースにmetaなしを含めるが、この環境ではその実行は未確認。特に新Aのrequest-only実通信全体とstreaming描画順について、既存ゲートの成功だけで証明済みとは報告しない。

専用concurrency groupと単一jobを使い、JITで公開GitHub RESTのin_progress/queued/waitingを資格情報なしGETで確認する。自分以外のrun、取得不可、過多・不整合なら停止する。このメタデータ確認はサイトへのHTTPではなくrunner側のreadだけ。既存workflowのconcurrencyは変更しないため、このsnapshot後に他workflowが始まる競合をtransactionとして防ぐ保証はない。公開直前の同種run照合も必要。共有ステージングのビルド変更を理由に停止する仕組みは追加していない。

artifactの対象は固定JSON5ファイルだけ、retention1日。raw出力・LHR・trace・profileは対象外。JSONは固定projectionとbytes readbackを使う。結果が良好でも正式スコアではない。

## ローカルで分かった制限

実Chrome対照はこの環境の通常sandbox起動で `CHROME_SANDBOX_FAILED`、最初のA_normalで停止。cleanup正常、閉域ブラウザ対照は完走0件、上流/live0。sandbox/OS/TLSは変更していない。したがって本候補の実Chrome統合は未検証であり、実行準備完了や現行stagingの原因確定とは報告しない。独立レビュー後の将来CIでも全実ゲートに失敗すればlive0で停止する。
