# Exact staging beacon read policy V2 — local candidate with observed narrow suffix shape

This is an explicitly selected configuration/library seam. There is no workflow,
new admission, live CLI or automatic activation. V1 and every historical workflow
remain byte-identical. Neither this commit nor its configuration authorizes a run.

Policy ID: `staging-ja-cloudflare-beacon-get-400-v2`.

The only new request exception is a Script GET with exact raw URL spelling
`https://static.cloudflareinsights.com/beacon.min.js` or the same spelling with
`:443`, optionally followed by exactly one `/v` version component consisting of
32 lowercase hexadecimal characters and 13 decimal characters after the `v`.
The suffix is exactly 46 characters in one component. A full-length check and
anchored regex both apply; no decoding or URL normalization creates a match.
No query (including an empty `?`), fragment, credentials, body, encoded or
normalized path alternative, other port, method, resource type or other suffix qualifies.
The existing classifier runs first. Only its SCOPE refusal can become STATIC ALLOW;
its redirect, origin, credential and method refusals cannot be overridden. The same
exception feeds the static predicate. Other existing CF reads remain as V1 permits.
POST, analytics/collect and unrelated blocked paths stay blocked.

The selected wrapper reuses the existing approved-400 factory requirement, binding,
first refusal/abort, count400, six active, natural prefetch, expiry and one-document
conditions. The DNS/public-IP pinning and CONNECT implementation and three hosts
are reused byte-for-byte from V1. The socket layer cannot enforce an HTTPS path;
the CDP boundary does so. CONNECT totals are tunnels, not HTTP request totals.
Ordinary shared staging240 and all older historical120 files are untouched.

For a bound accepted canonical beacon response, the original URL/status200,
service-worker, authentication/cache-scope and MIME checks run first. An additional
passive Network.responseReceived check requires both CDP mimeType and exactly one
Content-Type header to identify text/javascript or application/javascript. Header
parameters are ignored after the semicolon. Missing, duplicate, mismatching or
non-JS types fail closed and prohibit a score. This is a passive response/score
guard, not proof of a pre-execution response hold: the unchanged no-reinspection
transport has request-stage interception only. It adds no CDP call. Native browser
coverage of this new response check is unverified.

The pure measure/result and report-readback bodies are reused unchanged. Controlled
LHR/CDP positives are synthetic functional tests, never native measurements or
staging scores. A refusal, invalid response, incomplete evidence or failed cleanup
keeps performance null; D1 and report persistence remain false.

## Observation, adoption and remaining gates

A single newly authorized ordinary HTTPS GET of /ja/ returned HTTP200. The bounded
inert parser found one active CF script-src, canonical raw origin spelling,
HTTPS/default443, no userinfo/query/fragment and no parser ambiguity. The observed
suffix was one component with length 46: a leading `v` and 45 lowercase hex
characters; its trailing decimal run had length 17. It also passed the stricter
RAM predicate `^v[0-9a-f]{32}[0-9]{13}$`. That stricter fixed predicate, with a
separate exact-length check, is the adopted permit boundary. It is not a claim
that the two groups have hash/timestamp or any other field semantics, or that
all future Cloudflare versions will match. A future shape change fails closed.

Only fixed shape/count/predicate results were retained. No body, suffix value,
query value, credentials, header or access identifier was written or printed.
No external script was fetched and no JS ran. No additional official-document
request was made; this permit relies on the actual current public HTML shape,
not an undocumented claim of a universal vendor version grammar. This HTML is
not proof of the exact historical Chrome refusal or delivery-layer insertion.

A persisted full-value equality rule was not chosen: retaining the actual suffix
value contradicts this task's no-value-retention boundary. A per-run exact value
in RAM could be narrower, but requires a new document-to-browser correlation
mechanism or an additional fetch; neither is needed or implemented here. The
chosen host+public beacon prefix+single finite shape remains an explicitly
limited Script GET, not a wildcard path or analytics write permission.

Presence and score adoption are separate. The current HTML contains the matching
reference, but the JS MIME/status and actual browser delivery were not observed.
No staging score exists. A new same-SHA native case for the suffix and response
checks, exact one-use admission and workflow are still required before a future
single staging navigation. The current deployment/build and preview #441 remain
UNKNOWN; the known historical preview deploy event is not current response proof.

## Inspection and tests

Inert inspection (no measurement):

    node tools/staging-beacon-policy-v2/select.mjs --policy staging-ja-cloudflare-beacon-get-400-v2

New tests, with exact Node22.19.0 and Node24.19.0:

    node --unhandled-rejections=strict --test-reporter=tap --test tools/staging-beacon-policy-v2/test.mjs

The tests exercise the real selected wrapper, request boundary, inherited DNS/proxy
factory, measure and result body using fabricated CDP/LHR and an approved-factory
test double; normal local process/profile/proxy cleanup is real. The lookup is a
fixed test substitute and upstream connect throws. These are not admission or
Chrome proofs. Other tests cover limit400/401, six-active/seventh-wait, original
240 and V1 byte equality, prefetch, malformed/unsafe variants, MIME, redirects,
no score after failure and no DNS/browser without selection/admission.

The unchanged Slot35 exact-identity test must run at Slot35 itself:
`eb29bc22d02b9fe870632f3c1f90ca1422c1fa8c`. At another HEAD its real Git identity
check correctly fails FIXED_EVENT. Evidence includes that rejection and the
unchanged suite passing at its own pinned SHA. It is not silently skipped or
changed to accept this configuration commit. No new live admission exists here.

## Future run requirements (not included or authorized by this configuration)

Slot39's ALONE5 and SEQUENCE13+5 evidence covers the prior policy, not this V2.
A future one-use workflow requires current-SHA/run/binary native gates including
canonical GET, observed suffix, MIME/header failure, redirect, POST,
non-Script and scope negatives, unchanged count400/six-active/prefetch, strict
physical cleanup, all original gate proofs and exact JIT. Then at most one approved
staging /ja/ navigation. Public result: fixed policy ID, safe host/category of first
refusal, gate/coverage/cleanup states and a valid standalone simulated score only
if all original measure predicates pass. Never call it the locked AB profile.
No score adoption after a refusal or partial page. No path/query/body/raw report.

Expected deployment is UNKNOWN until a trustworthy permitted build identifier is
available; source revision or preview #441 is not inferred from the page's HTTP200.
This turn performed exactly the one authorized passive main-document GET. No new
workflow, push, remote GitHub check, Chrome launch, script fetch, GHA, key operation,
permission change, score/report write or D1 operation occurred here.
