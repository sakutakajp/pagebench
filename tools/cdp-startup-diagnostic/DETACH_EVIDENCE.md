# 同じnavigationの切断前後観測（段階1候補）

現行の採否・300ms/800kbps/CPU6倍・TLS/sandbox・宛先/GET-HEAD・認証情報除去・1MiB受信制限・Trace分割予算・Font確認は変更しない。

`staging-once.mjs`の実入口で、既存gatewayの検証を通ったauxiliary `Target.detachFromTarget`だけを観測する。自身のTraceがEOF/close済みの場合に限り、送信前にprimary pageを読み、同じコマンドIDの正常応答と同じaux sessionのdetach通知の両方を確認してから後状態を読む。順序逆転は許すが、別session/ID・重複・欠損・エラーでは比較しない。既存のraw受信経路とサイズ判定には触れない。

各sampleはprimaryのframe tree→DOM→frame treeで囲む。target/primary/frame/loaderが一致し、同じURLであってもreloadでloaderが変わった場合はINVALID_PAIR。識別子はメモリ内だけ。本文・HTML・任意CSS値・画像は返さず、幅/高さ/本文長/見出し数も前後差のenumと閾値区分だけ公開する。見出し自身のdisplay/visibility、main内か、祖先のdisplay:none/content-visibility:hidden/hidden/closed containerを固定値で区別する。超過/例外のstyleはUNKNOWN。

観測の各待機は750ms以内。欠損・timeout・後着callbackは不明扱い。before取得後だけ元のdetachを転送し、after取得中だけその正常ACKを保持する。失敗やcleanupでは停止・fatal・primary/target/sessionの同一性を再照合し、有効な場合のみACKを解放してhookを戻す。停止後やsession失効後は保持応答を破棄する。遅延したdetachも送信直前に同じ状態を再照合し、不整合なら送信せず既存のPROTECTION_LOST経路で停止する。AFTER中の対応応答/通知の重複はINVALID_PAIRとし、後着sampleで上書きしない。計測済みTrace閉鎖後の観測だが、前後の時間差はdetach以外の非同期UI変化も含み得る。差が出ても単独の因果証明ではない。

合否は元の`body_characters < 20 || headings < 1`と最新Font/Trace seal等のまま。診断が不明なら比較を正式採用しないが、診断を新しい採点条件にはしない。古い観測を採点のsealとして使わない。

## 検証

実`stagingOnce --execute`入口を通す閉じたテストでは、外部境界を置換し、実gatewayと実受信guardを通す。表示維持、表示変化、同URL/異loader、不正値、観測欠損、timeout、cleanup、応答/通知の順序や対応を検証する。前後swapおよびafterの二重使用に変異したコードは、同じ入口テストの期待値に失敗しなければならない。これらを実Chromeの結果とは扱わない。

`detach-browser-fixture.mjs`は既存font fixture proxyだけを使う。通常表示と、detach後にfixtureだけのmainを隠し短い固定markerを残す対照を別新規profileで測る。外部転送0、Font正常、同navigation対照成立、cleanup正常、変化例の表示条件不合格を必須にする。実サイトの状態をこの意図的なDOM変化から推定しない。生LHRやtraceは保存しない。

## リモート実行案（まだ実行しない）

- ブランチ: `diag/cdp-isolated-once-20261118-b651ddd`
- 基準: `eaec5e186c89192f4855d73261eb068d624e89ac`
- 新しい固有workflow: `.github/workflows/staging-detach-boundary-once-20261121.yml`
- pushは上記branchと同workflowのpathだけ、attempt1、固定subject/親SHA/変更ファイル一覧/コードhashで固定する。
- 旧one-time workflowは変更せず再発火しない。旧closed-proofは当該subjectだけjobをskipする。
- 既存の全単体・memory/guard/response/Font/Traceの実Chrome gateに加え、新しいdetach browser gateが全成功してから、固定staging `/ja/`を1回だけ実行する。
- 公開artifactは固定enum/集計/検証済みレポートの既存最小要約だけ。Secrets、raw CDP、本文、HTML、画像、生LHR、traceを含めない。

段階2/3の弱条件や追加URLの起動・パラメータは含めない。独立照合が終わるまで、この候補をpush/dispatchしない。
