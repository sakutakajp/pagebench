# Local candidate: closed fixture stop proof

Parent: `699688dbc2d2d3b36ab210e85a7d8256ac5a1289`.
Proposed unpublished branch: `diag/fixture-stop-proof-once-20261122`.
Subject: `diagnostic: fixture stop proof and ja once (20261122-w1)`.
Workflow: `.github/workflows/staging-fixture-stop-proof-once-20261122.yml`.
No push, Actions, website access or additional trial has been performed for this candidate.

## Confirmed defect and evidential limit

The old native fixture overwrote its result in a generic catch. A controlled
execution of that exact wrapper reproduced `STOPPED` before sampling and
`FAILED_OR_UNCONFIRMED` during sampling with the same modeled guard stop.
Run44994286909 did not save exception class, phase or abort acknowledgment, so
this does not identify its actual thrown exception or establish a Nuxt cause.

The new CLOSED fixture keeps a fixed phase and fixed exception category, first
policy candidate, first fatal phase and exact abort acknowledgment separately.
Only native Puppeteer TargetCloseError/ConnectionClosedError prototypes during
GOTO or READINESS_SAMPLE can be an expected interrupted sample, and only if
all expected rejection, actual abort, unchanged owner/session/frame,
no selected forwarding/fulfillment, settled receiver and physical cleanup
proofs agree. Unknown exceptions remain failures. No exception strings are read.
The probe emits only fixed fields, booleans and bounded counters; command,
request, session and frame identifiers remain in RAM only. It issues no CDP.
Abort acknowledgment is not renderer loadingFailed nor upstream arrival.

## Scope and unchanged code

Changes are confined to two CLOSED fixture runners, the CLOSED top-memory fixture, one CLOSED proof helper,
two regression test files, this review document and the new workflow. The
three exported live-admission ref/parent/subject constants and its exact source
manifest are rebound for the future candidate; the admission implementation
itself is byte-identical. This binding metadata is required to avoid reusing
an old live workflow or bypassing admission.

All previous workflows, request policy, live gateway, route table, live runner,
signals, child/parent/journal/protocol, pinned proxy, Chrome launcher/sandbox,
TLS, limits, natural prefetch treatment and diagnosis remain byte-identical.
Normal and native-prefetch fixture HTML and fixed response bodies are unchanged.
Positives retain all six exact deliveries, JS rendering, main200 and zero fatal;
checks additionally require HTML and complete stop-evidence consistency.

## Failure collection

A functional assertion failure may continue to the next fresh CLOSED case only
with independently absent forwarding capability, zero upstream/open sockets,
complete cleanup and settled receiver. An unknown GOTO/sample exception stays
failed; only a separately complete expected block and physical cleanup proof
permits collecting the next CLOSED case. This never admits live execution.
Unconfirmed blocking, startup, ownership, cleanup or physical safety
stops the suite and labels remaining cases not_run. Aggregate failure stays
failure even if later cases pass. The combined Chrome step may run the top
suite after a safely closed functional native failure, but never after
uncertain safety. Both proof JSON files are written and read back, and any
failed/not_run case prevents live admission.
The top gate additionally rejects child protocol errors, unexpected output,
parent kills, wrong exit, unknown fatal, unfinished receives and missing cleanup;
it never substitutes a generic catch for a successful negative control.

## Future execution envelope (not executed)

Exact push branch/path/subject, parent one-commit binding, attempt1 only,
no schedule/dispatch/retry, contents:read, credentials not persisted,
12-minute job cap, unchanged locked npm sources and Node24.19/22.19.
A depth8 checkout retains the earliest existing AB baseline ancestor.
The candidate has 712 existing unit tests plus 140 fixture and 8 workflow tests.
All exact-SHA unit and both six-case real Chrome gates must pass before the
existing JIT admission and one fixed /ja/ observation. A safe functional
failure still prevents the live step. No live execution is currently approved
for this local preparation. Any future use requires parent execution review.

Future live envelope stays one fresh authless profile, one navigation to
https://staging.hirameki.dev/ja/, CDP300ms/800Kbps down and up/CPU6,
staging and image origins only within the existing finite public read policy,
GET/HEAD, natural prefetch treated identically, ordinary TLS and sandbox.
Unknown current routes fail closed; the historical route list does not prove
coverage of the present2594 entries. No score, report, raw content, headers,
IDs, URLs/queries, screenshots, PSI or D1 output is added.

## Verification distinction

Local CDP doubles use the actual closedBrowserCase, memory fixture, inherited
request/policy, abort transport/ack path, owned receiver and finishArm.
They replace the Chrome transport/page, not request decisions. They do not
execute browser HTML/JS or establish native prefetch ordering. Existing parent
process doubles also pass through the actual supervisor and fixed projection.
The real Chrome fixture and actual top runner remain mandatory CI gates.
Local Chrome is unavailable at /opt/google/chrome/chrome; it was not launched
or substituted and no security setting was changed. No local synthetic result
is reported as a real browser result or as evidence about the staging500.

## Additional closed hook readiness repair

The two synthetic handled500 pages no longer guess that the probe has registered
within400ms. Their app.hook records actual app:error registration, then emits
one fixed error50ms later. Absence by1200ms is a sticky
REGISTRATION_DEADLINE_MISSING; a late registration cannot revive it. The existing
1800ms observation window and live probe/runner are unchanged. A removed hook
fails the fixture rather than manufacturing an observed hook event. The gate
requires the actual APP_ERROR_HOOK500 evidence and outputs only
PROVED_BY_APP_ERROR_HOOK/NOT_CONFIRMED/NOT_REQUIRED. Local VM controls run the
actual createNuxtErrorProbe against the exact emitted script and distinguish
late registration, missing registration, Vue-only registration, duplicate
registration, the console variant and removal before emission. These are VM
controls, not real Chrome. No renderer cancellation/application-error causal
ordering is inferred.

## Review correction: fixed script request fingerprints

Root independently reviewed the actual bytes of run44986877618,
artifact14739863502, Chrome157.0.8103.78. Its script GET and POST controls
reported Fetch.requestPaused.resourceType XHR while Network reported Fetch.
This is supplied evidence, not a new artifact download or local Chrome run.
The exact resource type in run44994286909 remains unknown.

Only the three script negative fixture cases now recognize Fetch or XHR.
Each also requires its own exact fixed fixture URL (RAM comparison, output
fixture_url_match boolean only), expected method/category, same ready primary
owner/frame, exact request/abort command/session acknowledgment, selected
forward/fulfill0, main200, receiver settlement and physical cleanup.
The first refusal type must equal the actual candidate type; accepting both
does not permit a cross-type mismatch. Navigation remains Document only.
Other/Document/Script in script negatives, different path/query, missing match
proof, fake/missing ACK and negative evidence in positive cases fail closed.
The live gateway, policy, top runner and probe have no changes from bd36fab.
New controlled CDP tests preserve separate Fetch-paused XHR versus Network
Fetch fields and pass through the actual closed wrapper/inherited policy.
They establish the fixture contract, not a new native browser observation.
