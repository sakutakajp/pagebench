# Nuxt 500調査の前提となる証跡回収の修正候補

親は公開済み `2f1d1219ee1bef6c6f2c66a837b64e5a6652aea5`。候補refは `diag/nuxt500-evidence-recovery-once-20261122`、件名は `diagnostic: Nuxt evidence recovery once (20261122-p1)`。公開・CI・対象サイトへの接続はこのローカル作業では実行しない。ルート管理の最大10 Actions枠の今回消費は0。

## 立証したこと／まだ不明なこと

公開親のコードをgit archiveして、Node **22.19.0 / --unhandled-rejections=strict** で再現した。WebSocketイベント境界が非同期 `receive()` の戻りPromiseを所有せず、Aのnetwork completion callbackがqueueから進めた `Fetch.continueRequest` を待つ間に、別のrequestのポリシー拒否がguard停止を起こすと、pending rejectがそのreceive Promiseへ伝播し、未処理 `GUARD_STOPPED` で終了コード1となる。

これは閉域の制御したCDP対照で、公開runの個々のpending Promiseを復元した証拠ではない。過去runが同じqueue continuation、別のCDP待機、どの拒否要求だったかは保存情報だけでは確定しない。ORIGIN/Fetchという再現値はfixture固有で、実サイトの拒否分類ではない。Nuxt 500そのものの例外・原因も未確定であり、推測によるNuxt修正はしない。

## 修正する所有境界

`owned-receiver.mjs` はイベント入口で各receive Promiseへ成功/拒否ハンドラを直ちに付ける。拒否はguard停止を保持して回収し、未知の拒否は停止する。globalなunhandled rejectionを握り潰して実行を継続する方法は使わない。最初の拒否分類とfatalを先に固定し、emergencyの二次例外でもpendingのtimer解除・rejectを完了させる。cleanupでは既存のobserver disposeの失敗がphysical cleanupを飛ばさないようにし、所有receiveの完了を上限1秒待つ。未完了や二次例外を成功にしない。

liveの親プロセスは開始前に固定記録を書けることを確認し、固定IPCの開始許可後だけ子が動く。子は通常Node22 strictで元の`runArm('A')`を使う。小さい固定journalを同期atomic書込みし、同じ固定投影をIPCにも送る。最初のfatal/refusalの不整合は拒否。更新回数・サイズに上限を設け、子のstdout/stderrは値を読まず捨て、存在のbooleanだけを残す。子終了・異常・timeoutでも親が最後の検証済み記録を保存する。保存媒体/IPCの両方や親自体が失われた場合まで完全な原因保存は保証しない。その場合はUNKNOWN/記録不可であり、エラー未発生やcleanup完了とはしない。

子終了でcleanup ACKがない場合は所有する子のprocess groupへ停止を1回要求し、cleanupをUNKNOWNとする。group停止要求はChrome全子孫の終了証明ではない。通常経路のプロセス終了・profile削除は既存cleanupが担当する。OS・sandbox・TLS・認証設定は変更しない。

同期の小さい固定記録や追加のイベント分類はNode側の処理時間に影響し得る。これは原因診断専用であり、無介入の通常ブラウザとの同等性・計測値の同等性を主張しない。発生順やネットワーク到達だけでNuxt例外との因果を確定しない。

## メタデータの固定観測

既存許可関数を通る日本語ホームのGET metadata契約だけ。同じprimary session、accepted main frame/loader、Fetch networkIdとNetwork requestIdの一致だけをメモリ内で対応づける。prefetch・別session・別frameは本要求にしない。複数の本要求やscope/順序欠損はAMBIGUOUS/UNKNOWN。開始、応答headers到達、status/MIMEの固定区分、network EOF、loadingFailedの固定分類、停止/cleanup前後を区別する。受信後のJS `response.json()` やNuxt Contentの読取りは観測しておらず、`js_body_read:NOT_OBSERVED`を常に明示する。ネットワークEOFは本文parse成功・有効metadata・500の原因の証明ではない。

URL、query、header、body、stack、CDP ID/handleは公開記録に含めない。これらの対応用ID/正規URLはboundedなメモリ内だけ。新しいCDP要求やサイトGETは追加しない。既存のイベントを読むだけ。main HTTP statusも一致したDocument応答だけの固定数値で、Nuxt画面の500番号と混同しない。`documents`は送信前の受理件数であり、配信先が受信した件数の独立した証拠ではない。

## 試験と範囲

- 既存Node24.19.0の474件とA/B契約48件を維持する。
- Node22.19.0 strictの27件。正規live wrapper `runArm`と実際のNoReinspectionGateway.request/startを、制御したCDP/Page/cleanup doublesに接続する。requestのoverride/即fulfillで成功させる試験ではない。ただし実Chrome試験とも呼ばない。
- pending continuation中の拒否、遅着応答、継続失敗、emergency/cleanup/dispose/sink例外、子exit/timeout、不正IPC、IPC/file片側故障、first reason不整合、テストgate失敗、親の保存不可を含む。失敗・不完全・cleanup不明は非成功、raw出力は非公開。
- 既存の閉域実Chrome20ケース・Font/応答/lineage/Nuxt等の全ゲートを同じSHAで将来必須にする。元の20ケースのmemory request overrideという検証範囲の限界は前候補のREVIEW.mdのとおりで、本修正を実Chromeの送受信経路で完全検証したとはまだ言わない。既知のsandbox起動制約は回避せず、今回のローカルでは実Chrome未検証。

## 未公開workflow候補

新workflow `.github/workflows/nuxt500-evidence-recovery-once-20261122.yml` のexact ref/path/title/parent、push attempt1、source manifest、成功した同一SHA/Chromeの全ゲート、Node22 strict proofとJIT確認を要する。既存workflowは無変更・新refの対象外。専用concurrencyと他runのread-only照合を維持するが、旧workflow全体とのtransactionalな排他を保証しない。

将来、ルートのレビュー/実行指示を受けた場合だけ **A側1 navigation、Bなし**。対象は固定の `https://staging.hirameki.dev/ja/`、従来どおり実CDP300ms・上下800kbps・CPU6、fresh profile、45秒窓。既存の公開2origin・GET/HEAD・API契約・redirect/credential/third-party拒否・通常TLS/sandbox・120/256/6上限は変えない。Nuxt 500の診断であり、スコア・LHR・長いtrace・本番・PSI・D1・設定変更・retry・旧run再実行はない。親側timeoutは180秒、既存armの150秒停止と追加settle上限1秒は維持する。

artifactは既存/新proofと `nuxt500-debug-fixed.json` の固定JSONだけ。private journal/profile/子のstdout/stderrは含めない。結果が500を含んでも正式スコアへ採用しない。今回の候補は未公開であり、実サイトの500の再現・解消を報告するものではない。
