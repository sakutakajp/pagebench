# Passive HTML continuation: independent bounded channels

Parent: published Slot27 `d14550d41bd0a8527cbab3e59b5cec5940726440`.
New exact ref: `refs/heads/diag/passive-html-channels-ja-once-20261126`.
All changes are additions. The old parser, transport, admission, workflow,
400/6/browser policy and prior diagnostic routes remain byte-identical.

## Causal repair and reproducible local proof

The actual old parser receives300 ordinary relative Script prefetch hints in
HEAD followed by a public-verified synthetic script-src in BODY. It stops at
256 shared references and reports zero script tags. The new actual parser sees
the body script, its BODY bucket and verified origin category, despite the
ordinary-hint count saturation. This is a producer-path regression, not a
handwritten positive proof. It models Slot27's proved omission mechanism,
not its unretained body or historical refused URL.

## Bounds and independent coverage

The old production getDocument is imported unchanged: one fixed HTTPS GET,
normal certificate validation and public pinned IPv4,15s,256KiB UTF-8 body,
16KiB headers/8KiB Link, no browser/JavaScript/cookies/redirect/subresource/retry.
The parser child keeps its2s deadline,64KiB output and bounded stdin envelope.

Four channels have independent finite aggregate caps:

| Channel | Counter cap |
|---|---:|
| SCRIPT_SRC |1024|
| BODY_HINTS(modulepreload/preload/prefetch) |256|
| HTTP_SCRIPT_HINTS |128|
| HTTP_UNTYPED_PREFETCH |128|

Reaching any counter cap never halts tokenization or any other channel.
Counters and all fixed category bins saturate independently; later positive
dependency observations remain represented even after a channel total saturates.
count_coverage is EXACT or SATURATED_LOWER_BOUNDS. Bins are independent marginals,
not joint rows: do not bind a particular dependency to a particular position or
hint kind when multiple categories exist. Their sums can exceed a saturated
total; no exact denominator is claimed in that case.

Each channel separately reports parse_coverage. Body syntax uncertainty does not
erase a confirmed HTTP hint, and malformed Link syntax does not erase a confirmed
body script. Known positives remain visible when coverage is ambiguous. Zero
observed count across any uncertainty is never evidence of absence.

The old2048 tag ceiling is replaced by90000 actual source-tag tokens. Every
start/end/self-closing token consumes at least3 source bytes; self-closing tags
count once. Under the unchanged262144-byte body cap, at most87381 such tokens can
occur.90000 therefore covers the entire byte-bounded token stream. It is not a
shared reference cap. Header parts have their own8193 ceiling under8KiB input.
Pathological near256KiB fixtures exercise65000 void tokens followed by a body
script, and87381 minimum-size tokens. Both complete within the existing parser
deadline locally. The latter has bounded stack overflow and AMBIGUOUS coverage,
not fabricated DOM validity. No page timing benchmark is emitted.

Parser structural/inert stacks cap at64 entries; overflow marks permanent body
uncertainty while lexical detection continues. Only fixed aggregate keys are
retained. Raw-text/RCDATA(script/style/title/textarea/xmp/iframe/etc.) and comments
cannot fabricate script-src from embedded text. Incomplete constructs, duplicate
attributes, unknown namespaces, malformed Link parameters and unclosed raw text
preserve ambiguity. This is a conservative tokenizer with limited structural
checks, not an HTML5 DOM parser; valid optional-tag forms may be ambiguous.

## URL forms, base and privacy

Forms distinguish RELATIVE, PROTOCOL_RELATIVE, ABSOLUTE_HTTPS, ABSOLUTE_OTHER
and INVALID. Relative/protocol-relative values are not resolved or assigned a
verified public dependency. Base presence is separately ABSENT only with complete
body lexical coverage; otherwise unobserved base stays UNKNOWN. Observed bases
are PRESENT_NOT_RESOLVED or MULTIPLE_OR_INVALID. No base value is retained.

Only the same previously demonstrated public dependency HTTPS origins are
classified(GTM/AdSense/Turnstile/Twitter; historical source provenance in the
unchanged parent REVIEW.md). Credentials, ambiguous ports/schemes or an unverified
hostname never become a verified dependency label. No new vendor signature is
guessed. Output says no independently verified delivery signature implemented.
Inline scripts and other raw text are not evaluated or searched for dynamic
loads; dynamic_sources is explicitly NOT_EVALUATED.

No body/header/source/host/path/query/userinfo/stack/value digest is written or
published. Only fixed enums, saturating counters and public GitHub scope appear.
The body and reference values exist solely in bounded memory/parser stdin.
Independent Node validation rejects arbitrary fields, bad counters, impossible
public-origin/form combinations and false complete coverage on invalid values.

## One-use execution and tests

New exact branch/path/title/parent/created-push/attempt1/source pins and matching
unit receipts are required. A bounded GitHub metadata read must identify exactly
that one push run; an exclusive new attempt marker is consumed before the GET.
The new job executes the unchanged parent92 tests plus new66 tests:158 each on
Node24.19.0 and Node22.19.0. Same entry/transport/parser/strict projection/actual
filesystem readback and rejected CLI are exercised. Parent tests retain actual
loopback TLS, untrusted-certificate rejection and one document/no subresources.
New adversarial parser tests replace Python socket/DNS/URL-fetch operations with
failures and assert zero attempted network calls. No actual remote GET occurs in
preparation. Fresh depth2 checks and producer-to-actual-admission readback are in
the private review evidence; controlled API fixtures are not actual GitHub proof.

## Interpretation and stopping criteria

The result remains a current Node HTTPS baseline, not the old Chrome serving
variant or a match to its private refused URL. Position and origin-category
positives do not prove application-vs-edge authorship or causality.
If script-src and HTTP-script channels still give only OTHER_OR_UNKNOWN or no
positive verified categories, do not retry an equivalent GET or enlarge an origin
allowlist. With complete lexical coverage, the missing fact is a trusted exact
serving-build origin document or independently verified fixed signature. With
ambiguity/oversize/timeout, report the specific coverage gap rather than no match.
Any further capture or signature rule needs separate review; no automatic next
run, repair, score, browser, added live request or setting change is included.
