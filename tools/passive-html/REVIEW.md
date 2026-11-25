# Passive HTML baseline; no browser and no JavaScript

Parent: `5f19827fbe442840db801c568b7933633d058059` (published Slot26).
New ref: `refs/heads/diag/passive-html-ja-once-20261125`.
One new commit; exact subject and unique workflow are defined in config.mjs.
This is an additional isolated route. No prior workflow/runtime/policy is modified.

## What a future run does

After Node24.19.0 and Node22.19.0 each pass exactly 92 closed tests, Node22
validates repository/ref/push/create/attempt1/title/one commit/parent/clean tracked
tree/source pins and the exact unit receipts. A bounded public GitHub API read
must show exactly this one push run. An exclusive local marker consumes the
attempt before a single HTTPS GET of the fixed staging `/ja/` document.
There is no configurable target, browser, script execution, subresource loader,
redirect handler, credential header, retry, second page, or score adoption.
No npm dependency installation is needed. Python3.12 stdlib is used as an inert
lexical tokenizer, with a separate 2-second process deadline and fixed output.
An installed OpenSSL executable generates disposable certificates only inside
closed unit tests; all TLS test traffic is loopback and files are deleted.

## Transport and limits

The sole document request is HTTPS/443/GET to the fixed host and path. The
unchanged publicIPv4 predicate from staging-egress.mjs rejects all nonpublic,
mixed, IPv6 or oversized DNS sets. One selected public IPv4 is pinned for the
single connection, preserving the fixed hostname for SNI/certificate checks.
Normal certificate validation is mandatory; the production route has no custom
CA, proxy, insecure TLS, cookie jar, redirects or decompressor. The request has
only a fixed UA, Accept:text/html, Accept-Encoding:identity and Connection:close.
The full DNS/TLS/headers/body window is 15 seconds; socket closure is checked for
at most another second. Unknown closure fails and removes the HTML from output.
Headers are bounded to16KiB, Link header8KiB, decoded UTF-8 HTML256KiB.
Only status200 public HTML with supported encoding is scanned. Redirect,
authentication, Set-Cookie, private/no-store, unexpected MIME/encoding, truncation,
overflow or invalid UTF-8 stop with fixed failure labels; no alternate fetch.
Incoming Link hints are strings for analysis only, never followed.

## Honest serving-variant label

The fixed UA uses the known LH13.6 mobile Moto G Power template with Chrome158
milestone substitution, consistent with the Slot26 binary and installed LH
emulation code. Actual Slot26 wire headers were not recorded. Accept/encoding/
Connection are diagnostic choices, not asserted historical header values.
No Sec-CH, Sec-Fetch or other browser headers are invented. Node TLS/HTTP and
Chrome differ. Output explicitly says current Node HTTPS baseline, not the
historical browser variant, no match to its privately unretained refused URL,
and no source/causality inference.

## Fixed public output

Only schema-validated public run identity, fixed status/phase/reason, request
attempt count(0/1/null unknown), HTTP status, physical cleanup, lexical coverage,
bounded tag/reference counts, and fixed rows(kind/position/dependency/count).
Kinds separate script-src, preload/modulepreload, typed/untyped prefetch and
HTTP Link hints. Position is explicit head/body/after explicit body end/outside/
inert-or-ambiguous/header; these are lexical positions, not rendered DOM.
Rows with duplicate reference values are counted; their strings/digests are not
retained. Inline scripts are counted but never evaluated or examined for code.
Comments/style/raw script content do not create script-src references.
Unknown or ambiguous markup, duplicate attributes, base resolution, malformed
Link hints and unclosed relevant constructs stay ambiguous; overflow is limited.
Complete token scan with zero references means no static reference detected in
that scan, never no script execution or absence from the historical browser.

Dependency origin categories use only the four publicly verified references
from hirameki-dev commit aa57e2280732fc016ffe347a4714715138f47998:
nuxt.config.ts89-106(GTM), plugins/ad.client.ts8-26(AdSense),
plugins/preview-newsletter.ts9-18(Turnstile), and
components/custom/x/TweetButton.vue18-23(Twitter), under frontend/hirameki-dev/.
The exact HTTPS hostname category alone does not prove a specific code owner,
executed script, matched historical request or current app revision. Relative
references are separate; any unverified origin/userinfo/port remains unknown.
There is no independently verified delivery-layer signature in the available
evidence; the fixed output says so. No heuristic vendor attribution is added.
No domain/path, source text, headers, body, stack, identifier, site-derived digest,
cryptographic envelope or keys enter any log/artifact/file. Raw input is bounded
in memory and the short-lived parser stdin only. Only fixed results are saved.

## Decision value and limits

A positive script-src or hint category in the current response is actionable
evidence to inspect that verified public dependency's application declaration.
An unknown script row or a tail position alone does not distinguish application
HTML from a CDN/hosting transform, and does not authorize another origin.
Comparing an exact trusted serving-build origin HTML baseline would be required
to establish delivery modification. This job cannot establish Nuxt500 cause or
produce a Lighthouse score. It never changes the existing400/6 or prefetch policy.

## Local verification boundaries

The same exported production entry/getDocument/parser/projection are exercised
using controlled HTTPS event streams, actual loopback TLS, actual readback and
CLI rejection. The loopback test rejects an untrusted synthetic certificate,
then trusts only that disposable certificate through a TEST-ONLY request adapter;
the production request factory never receives that CA or an alternate endpoint.
Its server sees exactly one successful `/ja/` request despite scripts and hints.
Admission fixtures control API/event data; they are not real GitHub admission.
The final review includes fresh depth2 checkout/source-contract checks and static
full workflow trigger inventory. No Chrome, live DNS, external HTTP, push or GHA
is performed locally. The future actual serving response remains unobserved.
