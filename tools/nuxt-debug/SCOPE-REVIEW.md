# 最初の SCOPE / Fetch の固定分類候補（未公開）

親: `8199ddd88a462072e28a2cbbe7f914db77c6d073`。
候補ref: `diag/nuxt500-scope-kind-once-20261122`。
件名: `diagnostic: first scope Fetch classification once (20261122-q1)`。
workflow: `.github/workflows/nuxt500-scope-fetch-once-20261122.yml`。

## 根拠と限界

- 利用可能なサイトソース `sakutakajp/hirameki-dev` の歴史的 ref `14f39cb96b8a27bcbc407ffca6cf435bf554037d`、`frontend/hirameki-dev/pages/ja/index.vue:20` は `queryContent(route.path).findOne()` を呼び、後に `article.title` 等を参照する。これは今回配信版の同定や、過去500の原因の証明ではない。
- 実際の既知読み取り契約は親の `tools/lighthouse-once/guard.mjs:6–16`。`/api/_content/query/<固定形式>.json`、クエリ名が `_params` 一つだけ、4500文字以下、JSONは `first:true`, `where:[{_path:'/ja'}]`, `sort:[{_stem:1,$numeric:true}]` の既存 stringify 完全一致である。追加decodeは既存guardが認める一度に限る。分類器はこの契約の写しを診断にだけ用い、許可判定に用いない。
- 手元には今回版のクライアントコード・実要求を特定する証跡がない。`/ja/_payload.json` や `/_nuxt/` の名前だけを見て、Nuxt生成payload／必要な静的資産Fetchと断定しない。これらは `OTHER_OR_UNKNOWN` とする。現行ソース根拠を得た場合の細分化は別候補であり、この候補では推測で作らない。
- 過去run `44981711222` はSCOPE/GET/Fetchまで。新候補で得る分類を過去runに遡って適用しない。

## 記録するもの

最初の拒否だけの既存 `first_refusal` に、その時点の固定 `phase` と `scope_fetch` を追加する。SCOPEかつFetch以外は `scope_fetch:null`。

| kind | 意味 |
| --- | --- |
| CONTENT_QUERY_PATH_MISMATCH | 既知Content query接頭辞の中でパス形式が不一致 |
| CONTENT_PARAMS_SHAPE_MISMATCH | 正しい経路形式だがキー・重複・長さ・JSON解析の形状が不一致 |
| CONTENT_PARAMS_VALUE_MISMATCH | 解析できるが既知JSON値／stringify順序と不一致 |
| CONTENT_CONTRACT_MATCH | 診断上は既知契約に一致（通常SCOPE拒否では到達しない対照。拒否は維持） |
| OTHER_API | 同一stagingのその他 `/api` 経路 |
| OTHER_OR_UNKNOWN | その他、曖昧、形式不正、診断の読取り不能・上限等 |

`prefetch` は既知 `Sec-Purpose` / `Purpose` の印の有無のboolean。読取り不能はnullであり「先読みでない」としない。URLは最大8192、headerは128項目・キー256・値1024文字で診断を打切る。これらは分類処理の上限だけで、既存の送信許可や通信上限ではない。own data descriptorのみ読み、getter/toStringを実行しない。CDP受理済みJSONを前提とし、任意Proxyに対する無反射の保証はしない。

正規化URL、拒否URL、query、header、body、CDP ID、stack、URL等のハッシュは記録しない。分類例外は固定UNKNOWNに閉じ、元の拒否・送信・停止・cleanupに影響させない。固定分類欠損／偽enumの子証跡は受理しない。UNKNOWNでも拒否を解除せず、結果はSTOPPEDのまま。

## 差分と試験

`gateway.mjs`・`runner.mjs`・元のguard・CDP保護・proxy・config・既存workflowは親とバイト一致。変更は観測器、閉域fixture、admissionの追加必須証明、新しい単発workflowとそのmanifestだけ。最初の拒否phaseは後続phaseと区別して保持する。

既存474 + AB48、Node22.19.0 strict既存27を維持。新23対照には分類・未知・getter不実行・入力不変・redaction・欠損拒否・初回値/phase保持・診断sink失敗・新規event/step gate陰性を含む。うち7ケースは元のlive `runArm('A')`、元のrequest/start、実際の親子プロセスと固定journal/IPCを、制御したCDP/Pageに接続して保存/読戻しを試す。request overrideで成功させる試験ではないが、実Chromeやステージングでもない。

通常sandboxの実Chromeはこのローカル環境の既知の起動制約により未実施。代替で成功扱いにしない。既存全閉域実Chromeゲート、A/B20対照、strict27、新23の同一SHA合格後だけ、将来別途承認された場合に固定 `/ja/` へA1/B0。実CDP300ms・上下800kbps・CPU6、新規profile、45秒窓、許可2origin・GET/HEAD・API契約、通常TLS/sandbox、従来120/256/6制限は不変。

旧workflowは無変更。新exact ref/path/title/parent/attempt1・一回ファイル・JIT admission・他run照会を維持。checkout depthだけ3（新HEADから祖父2f1の元厳格クラッシュ対照を実行するため）。manifestはこの一コミットの変更ファイルだけを照合する。公開artifactは元6個の固定JSONと `nuxt-scope-fixed-proof.json` だけ。生データ／子journal／profile／スコア／LHRは含めない。

今回はローカル候補まで。push・Actions・対象サイト通信なし。最大10 Actions枠は既存1回のまま。次の実行の承認・予約・発火は含めない。Nuxt500の原因も現行配信版も依然未確定である。
