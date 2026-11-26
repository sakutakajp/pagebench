# Slot41: scoped job-token API read and guarded beacon staging once

Unpublished direct successor of published Slot40
`4d1b6054c4be125e1402b2b5693d0529e9745553`. Adds only this identity/entry,
tests and one workflow. Old workflows, policy V1/V2, scope/transport/score
predicates and historical source remain unchanged. The separate HTTP-header
classification draft is excluded.

- Ref: `refs/heads/diag/beacon-api-read-ja-once-20261126`
- Subject: `diagnostic: job-token scoped beacon staging once (20261126-aj1)`
- Workflow: `.github/workflows/staging-beacon-api-read-ja-once-20261126.yml`

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
new API call beyond Slot40's three existing calls.

The closure clears the token before awaiting transport, removes its transient
Authorization header in finally, and is disposed on every exit. No app dependency
receives the credential or the general fetcher; admission receives the single-use
read capability. Standard checkout/setup/artifact runner internals are unchanged;
no additional credential inputs or persistent Git configuration are introduced.

## Preserved gates and behavior

Identity changes only: one created push, attempt1, exact parent/one commit,
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
