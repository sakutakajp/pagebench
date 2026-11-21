# 同一documentのNode lineage単発観測案（未承認・未公開）

基準94333c93e9ed6072a7abd75c116aade8c5ea8876は閉域7対照成功済み。ただし新候補に対する成功を代用しない。新候補の同一SHAで既存全gateと7対照を同じjob内で通す。現地の原因やhydrationとの因果は推測しない。

提案ブランチdiag/lineage-observe-once-20261121、workflow staging-lineage-observe-once-20261121.yml。exact own path/push/subject l1/attempt1/親94333c9/差分一覧/source hash/fixture_ready/全step success/sha/fingerprint/Chrome一致を要求。新branchなので旧push workflowは一致しない。まだpushやCIの承認を受けたものではない。

全通過時だけ、既存のstagingOnceを--observe-onceで固定 https://staging.hirameki.dev/ja/へ1回実行する案。mobile simulate 300ms/800Kbps/CPU6、新規空profile、通常TLS/sandbox、既存許可2origin内のGET/HEADと必須資材のみ。1文書、redirect/POST/credentials/外部/広告/GA/PSI拒否、120通常request/同時6/prefetch上限、CDP受信上限/Trace分割/Font/最終表示/seal/cleanupは不変。retry/別URL/段階2/3/DBはない。

新しい観測modeは同じreport検証・表示条件・seal・cleanupまでを通し、Lighthouseレポート保存の直前で分岐する。スコアを採用せず、performance/metricsはnull、score_adopted=false、lighthouse_report_saved=false。通常の--execute経路は維持。表示条件失敗やguard失敗なら従来どおり拒否し、固定の観測集計だけを残す。親コードのliveReportとseal/cleanup条件を変えない。--observe-onceは値や任意URLを取らず、実行時には登録済みkeyを読まない。

公開内容は同一documentの既存Node/ID関係、固定error署名のbool、main-world hydration enum、欠測/overflow、HTTP/文書数、Font/Trace件数とcleanupだけ。本文/HTML/画像/raw Trace/raw LHR/識別子/URL/例外文字列なし。hydrationとの順序はINTERVAL_ONLY、本文の同一性はNOT_OBSERVED、pixelはNOT_PROVEN。error署名はNuxt error発火の証明ではない。歴史版への同一性は新たに採取せず未確認固定値のまま。

既存入口を通す合成対照で、正常modeでもreport/tmpを書かないこと、表示不足/入力上限/after-seal異常を拒否することを確認する。合成は実Chromeの成功ではない。今ターンの外部接続/公開/CI/現地リクエストは0。新候補の実Chromeや現地は未検証で、将来の承認と同一SHAの全gate成功が必要。
