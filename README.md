# pagebench

同じ固定URL集合で、PSI mobile採点と**スクリーンショットを撮らない**Chromium表示・操作比較を行う小さなCLIです。Linux、Python 3.12、Node 22を想定。D1・サイトマップ生成元・本番定期ランナーとは独立しています。ローカル実行と手動Actions dry-runに対応し、スケジュールは含みません。

## 準備

```bash
npm ci
npx playwright install chromium
python3 -m unittest discover -s tests -v
npm run check
npm test
```

fixture試験は既存 `/usr/bin/chromium` を使用します。他の標準インストール先なら `PAGEBENCH_TEST_CHROMIUM` で指定してください。実行用はrender設定の `executable_path` を必要時だけ指定します。TLS/CAの回避はしません。

## 固定マニフェストを作る

サイトごとの設定は `SITEMAP_URL`。このコマンドだけがサイトマップを取得します。今回の検証ではローカル合成XMLを使い、本番通信はしていません。

```bash
export SITEMAP_URL=https://hirameki.dev/sitemap.xml
python3 sitemap.py --out runs/manifest.json
```

XML標準namespaceの `urlset` と `sitemapindex` に対応。 標準は `http://www.sitemaps.org/schemas/sitemap/0.9`。既存サイトとの互換性のため、観測済みの非標準 `http://www.sitemaps.org/schema/sitemap/0.9` だけも明示的に許可します。各文書のroot・子要素は同一namespace必須で、未知・混在namespaceは拒否します。index内の文書・掲載URLは同一originのみ、UTF-8、HTTPS・標準443（明示ポートも不可）、資格情報・query・fragmentなし。DTD/entity・壊れたXML・外部originを拒否し、展開しません。gzip sitemapは未対応。最大32文書、1文書4MiB、計64MiB、100,000 URL、socket15秒・CLI全体120秒上限。DNSの非public IPを拒否するため、内部用previewには使えません。公開HTTPS previewは対応します。DNS解決と接続は別なので、攻撃者が制御するDNS/サイトを対象にせず、利用者が管理する信頼済み公開サイトだけを設定してください。

順序はURLソート、重複は統合、日本語はNFCの正規UTF-8大文字パーセント表現に統一。二重encode・小文字escape・encoded ASCII/区切り文字・dot segment・制御文字等の曖昧表現は拒否します。正規化はredirect追従ではありません。検索掲載用サイトマップにはnoindexや未掲載ページがないため、全公開ページの網羅性は保証しません。

サイト側でroute/build/prerender等から発見した有限のURL配列も入力できます。noindexを含めるかは利用者が決めます。サイト固有データ・発見ロジックはpagebenchに含めません。

```bash
python3 common.py --origin https://hirameki.dev --urls examples/hirameki.urls.json --out runs/manifest.json
# 別サイトの例（実サイトへアクセスしない）
python3 common.py --origin https://example.org --urls examples/example.urls.json --out runs/example-manifest.json
```

手動配列は入力順を保存し、重複を拒否。hashはschema・origin・順序・URL等を含みます。生成した同じmanifestを両コマンドへ渡し、途中で編集・再取得しないでください。

## PSI採点

```bash
# dry-runが既定。キーを読まず、通信しない。
python3 psi.py run --manifest runs/manifest.json --run-dir runs/before --max-batches 1
# 実測が承認済みの環境だけで、環境変数PSI_API_KEYを安全に設定して実行
python3 psi.py run --manifest runs/manifest.json --run-dir runs/before --max-batches 1 --execute
python3 psi.py compare runs/before/run.json runs/after/run.json --out runs/comparison.json
```

`PSI_API_KEY` は実送信時だけ必須、未設定は通信前に停止。値を引数やファイルへ渡しません。公式HTTPS `www.googleapis.com/pagespeedonline/v5/runPagespeed` 固定、ヘッダーのみ、TLS検証有効、redirect・匿名retryなし。認証反射・一般的な認証情報パターンを検出した応答は破棄。生レスポンスは保存しません。HTTP失敗はstatus/許可enumだけを保存し、401/403/429・auth/quota enumで停止します。

1バッチ10 URL、1起動最大10バッチ。1,000件超は同じrun-dirで繰り返して進めます。成功・失敗・不明な中断結果は再照会せず隔離。各要求の前後に0600ファイルへatomic/fsync保存し、次の通信前に確定。別run/manifest/ツール版・合成/実測の混入を拒否します。ローカルcheckpointは信頼済み個人ディレクトリに保管してください。

outer ID・requested/final/finalDisplayed/mainDocumentのURLが全て完全一致、mobileの両formFactor、runtimeErrorなし、有限score、版・日時を検証。API契約変更でフィールド欠落なら失敗扱い。比較対象configはformFactor/emulatedFormFactor・gatherMode・throttlingMethod/throttling・screenEmulation・emulatedUserAgentの実際に返った値だけ保存し、欠落throttling等を推定しません。全対象が成功しない全件スコアはnull。成功部分・共通集合・同一版/configで比較可能な集合を分けます。失敗・未計測は0点にしません。

## スクリーンショットなしの表示・操作比較

```bash
# examples/render.jsonを編集し、修正前後の別originと代表操作を指定
node render.cjs runs/manifest.json examples/render.json runs/render 20
```

固定412×823/DPR1.75、ja-JP、UTC、固定Date、reduced motion、アニメーション停止、fonts ready/networkidleで同一路径を表示。HTTPSまたはlocalhost HTTPに限定。外部リソースは `asset_origins` の明示許可が必要。redirect拒否、TLS検証有効。1起動1〜100 URL、ページ高さ20,000px・可視要素10,000上限、navigation15秒・操作3秒。ページ型ごとに狭いpath正規表現とready/stepsを設定し、複数一致は失敗。fill/click/完全一致expectTextを提供します。

可視要素の順序・tag/role・ARIA/label・直下テキスト・リンク・値・rect・主要computed style・擬似要素contentを比較。リンク等の同一originは `@site` に正規化します。全body対象、tolerance/mask/scopeは提供せず、追加・削除を隠しません。操作結果は別の判定軸。未設定は `matched_actions_unverified` で合格ではありません。

キャプチャはメモリ内のみ、スクリーンショットAPIや画像出力は一切使いません。保存はhash・差分カテゴリ・要素数・状態のみ。本文やDOMの生キャプチャをpublic artifactにしない設計です。manifest/config/ブラウザー版/ソースhashの異なるrunへの混入を拒否。再開時に成功等はスキップ、中断は再実行せず明示。プロセス消失後の残存 `running.lock` はプロセス不在を確認して手動削除します。

この方式は画像の画素、フォントglyphの形、Canvas/WebGL、動画内容を検証できません。DOM外の見た目や未指定の操作は未検証。固定化していない乱数・広告・時変データは差分になり得ます。正確なCSS/座標比較は微小差にも反応します。画素一致の代替や完全なaccessibility tree検査とは扱わないでください。

## 改善前JSONを凍結して後日比較（ローカルのみ）

従来の2 origin同時比較に加え、同じ `render.cjs` のcapture/compareを使って、改善前・改善後を別の日に保存できます。スクリーンショットは取りません。このモードだけは正規化した可視DOM/rect/style/代表操作結果のJSONを0600でローカル保存します。既存の2 originコマンドは引き続きsummaryだけを保存します。

1. サイト側で発見した同じmanifestを固定します（noindexも含めるなら手動URL配列を使用）。
2. `examples/baseline.json` をコピーし、origin・任意のbuild_label・代表操作を設定します。`data_policy: public-reviewed` は、対象が公開用または合成fixtureで個人情報を含まないことを確認した場合だけ指定します。ログイン、Cookie、認証header、storageState、端末情報などを注入する設定はありません。
3. 改善前を取得します。1起動1〜100ページ。完了前は同じ引数・ディレクトリで再開できます。

```bash
node baseline.cjs capture runs/manifest.json /tmp/before-profile.json runs/baseline-before 20
# pendingが0になるまで同じコマンドで続きを取得
```

4. 全対象を処理すると `frozen.json` が作られます。失敗も失敗として凍結され、再試行や成功への置換はしません。baseline ID、manifest hash、origin、buildラベル、ブラウザー版・固定viewport/locale・操作profile・ソースhashを記録します。凍結後の再実行は内容を検証して終了し、再取得・上書きしません。変更版を取得する場合は必ず新しいディレクトリを使います。
5. 改善前サーバーを停止しても構いません。同じmanifestと操作設定で改善後を保存し、両方の凍結済みディレクトリをオフライン比較します。

```bash
node baseline.cjs capture runs/manifest.json /tmp/after-profile.json runs/baseline-after 20
node baseline.cjs compare runs/baseline-before runs/baseline-after runs/baseline-comparison.json
```

origin・buildラベルは前後で変更可能。manifest・操作profile・asset許可・ブラウザー/正規化設定・ソースhashの不一致は比較を拒否します。各JSONとmetadataをhashで照合し、欠落・改変を検出します。秘密鍵による署名ではなく、信頼済みの個人ディレクトリでの事故検出です。snapshotは番号付きJSON、summaryは別ファイルで、将来の保存先adapterは未実装です。D1/R2やpublic artifactへの送信はありません。

比較結果は `passed` / `changed` / `matched_actions_unverified` / `unverified` を区別。取得失敗・中断・片側欠落を合格にせず、JSONファイル自体が欠落した場合は整合性エラーです。中断中のURLは再照会せず未検証扱い。プロセスが消失してlockが残った場合は、不在を確認後 `running.lock` だけを手動削除して再開します。

安全側に失敗させるため、password/email/tel等の入力欄、query/fragment付きリンク、認証情報やemailに似た文字列の検出時にはそのページを保存しません。ただし全種類の個人情報を自動検出する保証はありません。公開用・合成データだけを使用し、JSONは共有・コミットしないでください。出力先例の `runs/` はgitignore済みです。画像画素・フォントglyph・Canvas/WebGL・未設定の操作は検証できません。代表操作は合成fixtureのclick/完全一致assertionで検証しており、実サイトのルーレット等に対応済みという意味ではありません。

## 手動GitHub Actions（PSI通信なし）

[Settings → Secrets and variables → Actions → Variables](https://github.com/sakutakajp/pagebench/settings/variables/actions) で `SITEMAP_URL=https://hirameki.dev/sitemap.xml` を設定します。Actions → **Pagebench manual dry-run** → Run workflow → default branch `main` を選んで実行してください。default branch以外はjobをスキップします。

手動dispatchのみ、contents:read、15分上限、同時実行を直列化。合成試験・ローカルChromium fixtureの後、公開サイトマップを固定化し先頭最大3件だけdry-runします。`--max-batches 1` は最大10件を意味するため、別途manifest自体を3件に制限しています。Google PSI呼出しは0件、Secret参照なし、liveモードなし。summaryは件数・hashのみで、manifest/キャプチャ等のartifactを公開しません。fixtureはローカルHTMLのみで、実サイトの描画比較ではありません。

APIキーを準備する場合は本人が [Settings → Secrets and variables → Actions → Secrets](https://github.com/sakutakajp/pagebench/settings/secrets/actions) の **New repository secret** から `PSI_API_KEY` を登録してください。チャットやVariablesには値を貼らないでください。今回のworkflowは登録後もキーを使わず、本番計測は別の明示的な変更が必要です。将来の参照は `SITEMAP_URL: ${{ vars.SITEMAP_URL }}`、PSI送信stepだけ `PSI_API_KEY: ${{ secrets.PSI_API_KEY }}` とします。

## 検証と制約

PSIは合成レスポンスのみ。秘密値は試験用文字列で、実秘密やGoogle通信を使いません。XML fixtureは1,002一意URL（日本語・重複含む）、不正XML・外部origin等を検証。Chromium localhost fixtureは同一、追加、削除、本文、layout、style、操作変更と未設定を検証し、screenshot APIの呼出し・画像出力がないこともassertします。

全ページ本番実行は未実施。事前に対象manifest hash、公開URLの実在/canonical、noindex範囲、代表操作、外部asset許可、PSI予算を固定してください。既存hirameki-dev/growth-loop/プロダクションrunnerには変更を加えていません。

最終ローカル検証: Python 9試験成功、Node構文check成功、Chromium 154.0.8037.57でfixture 8件（合格1・変更6・操作未設定1）。独立した2サイトのmanifest生成とPSI dry-runも成功。依存取得は標準npm registryのみ。

## 固定3ページの手動Chromiumアクセス確認

Actions → **Public Chromium capture smoke** → Run workflow → `main` で起動します。入力・Secrets・Variablesは不要です。対象は `/ja/`、`/ja/amidakuji/`、`/ja/font/serif/list/%E6%9C%9D/` の固定3ページのみ。サイトマップdry-runとは別workflowです。

標準Chromium・通常TLSでGET/HEADのみを許可し、操作は実行しません。取得データはメモリ内だけで破棄し、snapshot・スクリーンショット・artifactを保存/公開しません。ログ/summaryは件数と固定失敗分類のみ。最初の失敗で停止し、残りはpending。再試行・UA偽装・TLS回避・WAF変更はありません。成功しても「アクセス/取得できた・操作未検証」であり、baseline保存完了や本番回帰テスト合格を意味しません。スケジュールや自動dispatchはありません。

## 手動mobile PSI実測pilot（最大3件）

Actions → **Manual mobile PSI pilot (max 3)** → Run workflow → `main`。既定の `execute=false` はキー不要・通信0件の計画のみです。本人が実測を行う場合だけ `execute` にチェックして起動します。`PSI_API_KEY` はrepository Actions Secretとして本人が登録し、実測stepだけに渡されます。未設定なら通信前に失敗します。

対象は `https://hirameki.dev/ja/`、`https://hirameki.dev/en/spin-wheel/`、`https://hirameki.dev/ja/amidakuji/` の固定3件。URL入力や対象変更はできません。1実行最大3リクエスト、retryなし、最初の失敗・隔離で停止。公式Google HTTPS固定endpoint・headerのみ、TLS検証・redirect拒否・認証反射検知・canonical/mobile/score検証を既存transportのまま使います。ログ/summaryは固定分類と件数、全3件成功時のみ平均スコアです。失敗を0点にせず平均はnull。生応答・個別行・checkpoint・artifactを保存せず、D1等へ書きません。

同時実行は直列化、10分上限、手動default branch限定です。再実行は新たな最大3リクエストになるため、自動で繰り返さないでください。タイムアウト等で結果不明の場合も自動再試行しません。ブラウザーsmoke・サイトマップdry-runとは別workflowで、スケジュールはありません。この追加の検証は合成レスポンスのみで、開発作業から実PSIやdispatchは行っていません。
