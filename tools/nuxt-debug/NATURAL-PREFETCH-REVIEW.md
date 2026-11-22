# 自然な先読みの閉域実Chrome対照（未公開）

親/比較候補: `0f09206dab0c633743fcbce9f42d70eab462a059`。元Aと、この親のBoundPrefetchCandidateを**変更せず**使う。ローカル候補refは `diag/natural-prefetch-closed-once-20261122`、workflowは `.github/workflows/natural-prefetch-closed-once-20261122.yml`。公開・起動は今回行わない。使用枠は2/10のまま。

## 何を比較するか

同一job・Chrome実行ファイルの前後hash、CDP product版を照合する。各対照は独立のfresh profile。既存openGuarded / applyLockedConfigと同じChrome argv、通常sandbox/TLS、cookie禁止profile、300ms・上下800kbps・CPU6を維持する。OS・信頼経路・サイトの設定は変更しない。

1. 元A + parserが読む静的 `<link rel="prefetch">`。
2. 未変更の候補 + 同じ自然なlink prefetch。
3. 候補 + scriptのPurpose偽装。
4. 候補 + scriptのSec-Purpose偽装（Chromeが禁止headerを落とす場合も観測する）。
5. 候補 + 通常の範囲外Fetch。
6. 候補 + POST。

自然対照はheaderを注入しない。linkの自然なerrorイベントだけで既知metadataをfetchする。Nodeからイベントを合成してmetadataへ強制的に進めない。先読みが発生しなければ欠測、束縛条件が異なればmismatchとして非合格。後続の安全な閉域負例は確認できるが、startup・安全性・cleanup故障なら以降は起動しない。未実施を合格にしない。

CDPの既存ロック依存 `devtools-protocol/types/protocol.d.ts` はResourceTypeとして**FetchとPrefetchを別々に列挙**し、Initiator.typeもparser/script/preload等を区別する。自然linkがFetchか、parserか、同じ順序で来るかは実行しなければ分からない。実run44983100225の要求をこのlinkと同一と断定しない。

## 外部接続経路がないこと

論理URLは元guardを正確に試すための既存TARGET/SPEC/METAである。実サイトから取得するURLではなく、CDPで**固定HTMLと固定JSONにだけメモリ応答**するキーとして使う。自然CDPのtype/header/initiator/URLは書き換えない。このためコードにstaging originの文字列はあるが、stagingへ接続する転送機能はない。

proxyはloopback待受の**拒否専用**。DNS・upstream client・net.connect・enable機能を実装せず、HTTP/CONNECT/Upgradeの拒否カウンターを取得する。単体では独立のloopback sinkを用意し、proxyへの3種の要求がsinkへ一切到達しないことを実際に確認する。実Chrome時もproxyの閉鎖・open socket0を必須にする。これはproxyのHTTP転送経路に関する証拠であり、OS全体のpacket captureと同じとは主張しない。

gatewayの通常許可判定はそのまま通す。許可済み文書とmetadataのstart後だけ、固定メモリ応答を返すfixture adapterを使う。他のstartはfatal、先読みへのcontinue/fulfillが一度でもあれば非合格。臨時HTMLと固定metadata以外の配信元やserver routeを読むことはない。upstream sink到達0と、CDP abort命令/同session ACK/metadata handler到達は別々に記録する。

新コードはlive runner・pinnedTunnel・staging-once・PSI・Lighthouse・DBを起動しない。CLIは引数を受けず、URL入力やexecute分岐もない。score/LHR/画像は生成も保存もしない。

受信観測とメモリ応答はタイミングに影響し得る。これはCDP互換性の閉域対照であり、実サイトと性能・ハイドレーション時刻が同等であるとは主張しない。

## 観測と採否

選んだ固定の先読み1件について、Network/Fetchのresource type、initiator分類、session/frame/loader/documentの一致booleanまたは不明、先読み印の有無、同じnetwork IDかのboolean、受信順だけを固定enumで残す。ID/URL/header/query/本文/stackを出力しない。欠損ID同士を一致扱いせず、欠測・不一致・重複・容量制限・停止後の通知を区別する。ACK観測bufferは6件まで。停止後に観測を更新して最初の情報を上書きしない。

候補の自然正例が合格するには、先読みcontinue/fulfill0、abort/正しいACK1、候補自身のACK1、pending/retained0、許可済みmetadataのhandler到達1とnetwork EOF、固定fixture側JSのJSON読取り完了、全cleanup、拒否proxyの閉鎖が必要。EOFとJS読取りを別のfieldにする。metaは合成データであり、Nuxt Contentの現行データや500の原因の証明ではない。

## ローカルで確認できたこと

通常sandboxの実起動を1回だけ試し、既存と同じ `CHROME_SANDBOX_FAILED` で停止した。CDP/文書に到達せず、自然対照は0件完了、残り5件は未実施。proxy connections0、転送0、cleanup complete。Chrome product版は不明。`/usr/bin/chromium`のhashは起動スクリプトのhashであり、実Chrome binary/versionと混同しない。起動制限を回避したり、別flagで再試行したりしていない。

通常のローカル試験は旧612 + 新18の630件。新18はfixture source、観測契約、未知/重複/逆順/容量、ACK、proxyの独立sink、保存読戻し、startup/safety失敗の停止、単発workflowを検証する。caseRunnerのtest doubleを使う契約試験は実Chromeの代わりの合格証明ではない。

## 専用workflow候補

exact branch/path/title/parent/push/attempt1、contents:read、資格情報を保持しないcheckout、timeout10分、並行実行防止。既存ロック依存のnpm ci --ignore-scriptsだけ。Chromeはrunnerの既存 `/opt/google/chrome/chrome`、新規downloadやOS変更なし。Node24.19.0で旧474/48、Node22.19.0 strictで旧27/23/40と新18を全件確認し、同SHAとmanifestを直前照合してから**閉域fixtureだけ**を一度呼ぶ。実サイトへ進むstepは存在しない。失敗時も固定proofを保存し、artifactはunit-proofとclosed-proofのJSON2個、1日保持だけ。

元クラッシュ対照の2f1 objectを使うため、この候補ではfetch-depth5を必要とする。既存workflow・候補0f09206の5ファイルはすべて不変。この候補の親0f09206自体も未公開であり、将来公開するときは新コミットだけでなくその未公開親を含む範囲の確認が必要。今回は公開や実行の予約をしない。
