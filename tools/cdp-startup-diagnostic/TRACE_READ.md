# Trace専用の分割読み出し（ローカル変更）

基点は `468f1b6db05bc07ea00ed19dae2b1f5135ef9951`。全体受信上限は変更していません。現行の実値は **1,048,576 UTF-16コード単位/メッセージ**で、4,194,304は従来の `GT_4M` 分類境界です。

`FixtureGateway` の既存の送信ガードを通過した `ReturnAsStream` の開始、その成功応答、自分の終了コマンド、同じsessionの正規完了通知を照合します。そこで得たopaque handleとsessionに一致する `IO.read` だけへ `size` を追加します。ID・session・handleは私有メモリ内だけです。終了ACKが遅れた場合は先に小さいreadを送れても、ACKを含む全条件が揃うまで採用できません。

- 1回64 KiB以下（元の指定が小さければ維持）。受理後の応答もdecoded byte数を検証。
- decoded総量32 MiB以下、最大1,024 read、同時readは1件。
- **書出し期限10秒は `Tracing.end` 送出から**。以前の試作の開始時点から数える方式は、最大60秒待つ通常ナビゲーションを誤って打ち切るため採用しません。既存の計測全体120秒の期限は不変です。
- 正規Traceは順次readなので、当該streamのseek/offset、不正size、重複・不一致・データ欠損・未知形式は不採用。
- 確認済みclose後はhandle所有権を解放し、後続の汎用IOへ作用しません。他session/handle、Fetch、Fontは変更しません。

Lighthouse 13.6.0のparserと `finally { IO.close }` は変更せず、受理した応答をそのまま渡します。base64、UTF-8のchunk境界、EOFを検証し、本文は記録しません。guard停止時は従来どおりChromeを停止するため、上流のclose試行が失敗することはあります。そのために停止後の通信を許す例外はありません。Chrome終了・profile削除の既存cleanupを維持します。

予算超過・不完全exportは既存の採点採用ゲートへ渡しません。最終ブラウザ操作後のsealとcleanup後の確認も行います。`trace_read` に保存するのは固定状態と集計だけです。`NOT_OBSERVED` はTrace取得成功の証拠ではありません。

既存の段階ログは64イベント/各集計255のままです。chunk数が多いと段階ログが打ち切られるため、完全な時系列とは扱えません。分割readerの集計は別途1,024 readまで管理します。生Traceを保存・公開しません。

## 検証

```bash
node --test tools/cdp-startup-diagnostic/*.test.mjs
npm run check --prefix tools/lighthouse-once
```

追加26件＋既存182件がローカルNode 24.19.0で成功。実受信ガードと元のLighthouse parserを通す合成Unicode Trace、空EOF、複数chunk、イベント順・metadataのhash一致、予算、異種IOの不変、上流cleanup、合成CLI報告JSONの保存/読戻しを検証しています。これは実サイト採点や実Chrome成功を意味しません。

この環境では、外向き転送のないfixtureを通常sandboxで1回試し、`CHROME_SANDBOX_FAILED` で停止、cleanup完了でした。helper所有者は65534（期待0）。sandbox/OS/TLS設定は変更していません。

push、Actions、実サイト、PSI、D1は未実施。以前の一回限りのworkflowは旧hash・試験件数を固定しており、この変更をそのまま起動できる状態にはしていません。実Chrome・hosted Node 22での検証、実測スコア/指標の同等性は未確認です。
