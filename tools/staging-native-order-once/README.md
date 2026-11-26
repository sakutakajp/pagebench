# Slot42: scoped job-token API read and guarded beacon staging once

Unpublished direct successor of published Slot41
`df29ee7204cc6bd82db2f59d5fff4cb124d6cded`. Adds a new exact identity/entry, tests and one workflow. The sole runtime
behavior delta is the existing post-flush opener for the first six CLOSED cases. Old workflows, policy V1/V2, scope/transport/score predicates and historical source remain
unchanged. The separate HTTP-header
classification draft is excluded.

- Ref: `refs/heads/diag/native-order-ja-once-20261126`
- Subject: `diagnostic: closed native post-flush staging once (20261126-ak1)`
- Workflow: `.github/workflows/staging-native-order-ja-once-20261126.yml`

## Authentication boundary

The job has only `contents: read` and `actions: read`. Checkout retains
`persist-credentials: false`, depth64. The standard `${{ github.token }}` is
injected only into PRECHECK, JIT/closed and LIVE entry steps. Each shell uses
`exec node ...bootstrap.mjs` so it does not remain as a credential-bearing shell
while Node runs. No token env is assigned to dependency install, unit tests,
Chrome/Lighthouse, publisher, upload or job-wide environment.

Before importing application modules or running Git/children, bootstrap invokes
the exact immutable Slot32 pure `takeApiReader` factory and deletes GITHUB_TOKEN
from process.env. Missing/invalid/unremovable token or an alternate credential
variable is a failure before app loading. There is no anonymous fallback.
The private capability can add Authorization only to exactly one GET of
`https://api.github.com/repos/sakutakajp/pagebench/actions/runs?head_sha=<exact SHA>&event=push&per_page=100`
per entry process. It requires redirect:error, exact Accept header and signal;
all other URLs, repositories, extra options, methods or headers fail and consume
the capability. It retains the original 10s timeout, 262144B API bound and
same-SHA/run/attempt/event/path uniqueness predicates. 403/429 or any other error
stops; no retry, alternate credential or different request. Three separately
invoked gates may each make their original single metadata read. This is not a
new API call beyond Slot41's three existing calls.

The closure clears the token before awaiting transport, removes its transient
Authorization header in finally, and is disposed on every exit. No app dependency
receives the credential or the general fetcher; admission receives the single-use
read capability. Standard checkout/setup/artifact runner internals are unchanged;
no additional credential inputs or persistent Git configuration are introduced.

## Preserved gates and behavior

Admission predicates change only their exact identity: one created push, attempt1, exact parent/one commit,
subject/ref/event/clean tracked tree, source pins and source additions. Operator
review pins exact SHA; self-embedding its commit hash is impossible. Recheck
current remote absence/zero runs/default-branch followers before any future push.
Local trigger inventory is a snapshot, not a claim about future remote state.

All existing unit/history gates and 23 current-SHA/run/binary normally sandboxed
Chrome controls remain required: original13, registered V1 five with Slot39's
closed-only post-flush adapter, V2 beacon five (canonical/versioned GET, non-JS,
POST, redirect). Native/measure/result/control fixtures are re-exports of the
unchanged Slot40 modules, not substitute proof generators. No old native proof
is accepted as a new same-run proof. Exact JIT and its process-local single-use
grant remain mandatory before one staging `/ja/` top-level navigation.

Policy ID remains `staging-ja-cloudflare-beacon-get-400-v2`: original path/query,
HTTPS443, public-IP/DNS/CONNECT, credentials, ownership, response, time and refusal
rules;400 total/six concurrent, ordinary240 and natural prefetch unchanged.
Only approved queryless canonical/strict versioned beacon Script GET is allowed;
no analytics POST/collect. No extra origin or path. MIME interception remains
passive, not a pre-execution guarantee. Any refusal, incomplete data, unexpected
response or cleanup failure invalidates the score.

The existing Lighthouse13.6 standalone simulated mobile weak method is preserved,
not locked AB equivalence. Score adoption still requires every existing report,
DOM/resource/runtime/font/trace/binary/recording/cleanup condition. No D1/raw
report saving. Response revision remains UNKNOWN; historical #441 does not bind
this future response. No extra request/hash is used to infer it.

## Tests and public output

Auth tests use dummy canaries only; real credentials are neither read nor used.
They cover exact GET constraints, one-use/error/dispose, header erasure, missing/
invalid/undeletable/alternate tokens,403/429, malformed uniqueness/source, and
no fallback. Test child runs actual bootstrap, admission, entry, progress/files
and publisher CLI with fabricated prior receipts and controlled CDP/LHR; real
filesystem writes/readback and child environment checks are used. It performs
zero upstream requests. Real default CLI imports are also exercised in a nongit
closed directory and must reject before API. Node22 can complete the controlled
positive; Node24 retains its genuine LIVE runtime rejection. These are model/
process tests, not real Chrome or real GitHub authorization evidence.

Public bootstrap shape is the same five fields; credential is one of
JOB_API_READ_TOKEN_CAPTURED / TOKEN_MISSING / TOKEN_INVALID / ENV_UNCLEARED /
ALTERNATE_CREDENTIAL_PRESENT. Unknown fields/strings drop the record. Only fixed
unit receipts and reconstructed public JSON are uploaded. No env/token/header,
URL/path/host/query/body/raw console/stderr, raw proof, key/ciphertext or secret
hashes. Missing evidence remains unknown, never absence. These diagnostics do not
replace admission predicates.

The original historical helper creates its own depth23 clone; from this new
HEAD Slot20 is the shallow boundary and its HEAD^ assertion deterministically
fails before tests. The new historical bridge is byte-identical to that helper
except its config import path and depth64. All21 original assertions, frozen
source SHA, runtime, receipt fields and verdicts are unchanged. A regression
requires exact normalized byte equivalence. Old helper remains immutable.

Local handoff requires all workflow Node24.19.0 and Node22.19.0 commands in a
fresh depth64 clone at exact SHA, including unchanged historical tests, without
skips. No Google Chrome exists at the required local path; no setup retry or
sandbox/TLS workaround.23 actual native controls, real GitHub token authorization,
real Lighthouse and staging remain unverified until a separately reviewed run.
This preparation includes no push, Actions, live DNS/site request, credential/
settings change or Actions budget consumption.

## CLOSED first-six adapter, strictly separated from LIVE

The reviewed four-file local hypothesis at
4f88847b4df876c4858d62d914eecf6a717dffd8 is included with identical bytes. Its
objects are not an ancestor requirement: tests pin these four source hashes,
so a fresh shallow clone never needs an unpublished side branch. The only parent
of this candidate is published Slot41. All old827 tracked files are immutable.

The first-six callback in this entry invokes observedFixtureNative, whose default
opener is the immutable reviewed postFlushOpen. This queues the original reject-only
403 before closing that raw accepted socket via destroySoon. It does not suppress
faults or change a request decision. The original six modes, order, ownership,
abortACK/consistency, physical cleanup, continuation and failure verdicts remain.
No change is made to other inherited CLOSED factories or23 required case count.
A failure still stops the suite and prevents LIVE. All original cap400, score,
counterpart, owner, V1 and V2 controls follow in their same order after the six.

buildLive is byte-identical to Slot41 after namespace substitution. It imports
openGuarded directly and builds the same pinnedTunnel via the V2 selection seam.
It never selects postFlushOpen. Neither native-proxy-order/model nor wiring test
helpers are imported by the production entry. POST, origins, paths, DNS/IP,
credentials, response,400/6, natural prefetch and adoption rules are unchanged.

New wiring tests run the real entry/default CLOSED callback/default adapter and
original first-six producer through a TEST-ONLY Node registerHooks opener seam.
Only fixture-runner.openGuarded is replaced in the child; the real postFlushOpen
and postFlushProxy stay in the graph. Chrome hashing is a labeled synthetic byte
stream; CDP/readiness are controlled. Real reject-only proxy, Node process/profile,
files and cleanup remain. The controls stop intentionally after those six; no fake
full23 passing proof is minted. True early TCP reset still fails and halts. The
actual default LIVE opener is separately exercised with fabricated valid prior
receipts, controlled CDP/LHR and no upstream; it has the enable capability of the
original pinnedTunnel, never the closed post-flush decorator. Node24 retains its
actual LIVE runtime rejection before any opener. Invalid ACK and half-open/reset
counterexamples remain covered by the immutable eleven reviewed model tests.

The original Slot41 reset trigger is still unproven. Both modeled before-arm and
ACK-pending resets can produce its fixed signature. A passing current native gate
cannot establish historical causality or the deployed app revision.

All23 same-SHA/run/binary real-Chrome controls remain required in the proposed
single job before the existing exact LIVE JIT and at most one /ja/ navigation.
No native Chrome has been run locally. No push, GHA, remote read, site/DNS,
external socket or D1 operation is part of preparation.29 Actions remain, none
reserved. The source/event/ref/run/default-workflow inventory must be rechecked
read-only before any separately authorized create-only push.
