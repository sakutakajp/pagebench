# Closed native cases and natural Lighthouse compatibility proof

This is a new closed-only proposal on immutable published Slot20 (416b0c6).
It contains no staging execution, upstream-capable proxy, URL argument, live
admission grant or site score adoption. Old workflows and runtime files are
unchanged. No GitHub run has been triggered for this proposal.

## Proposed single run

The only push trigger is the exact branch/path/title in config.mjs and the new
workflow. Admission requires one direct commit on BASE, the full source pins,
all real same-SHA unit receipts, the separately labeled historical receipt,
one matching push run, attempt one, and an exclusive start marker. No reruns.
The exact runner entry is `main.mjs --closed-once` with `monitor.mjs` preloaded.

It executes the original six native cases and original verdict/continuation.
Each STARTED/RETURNED/THREW/producer-confirmed NOT_RUN row is saved separately.
It proceeds only on original SAFE_CLOSED_NEXT_SUITE, then runs the original
closed400 within/over pair. It proceeds to the single fixed Lighthouse fixture
only if that original pair passes. Uncertain safety stops later stages.
This is at most nine isolated browser cases, no actual target requests. The
logical approved-origin fixture URLs are always fixed RAM responses, and the
independent reject-only proxy cannot open an upstream connection.

The new adapter projects existing fixed fields only: original verdict, phase,
exception presence/class, independent opener cleanup, HTTP/document/readiness,
fixture binding, abort ACK and non-forwarding, receiver and physical cleanup.
The sparse journal has a 32-write and 32768-byte ceiling; a write gap cannot
pass. Uncaught monitoring preserves the nonzero exit rather than catching it.
A separate publisher validates and reconstructs the fixed schema. Only its
projection and fixed unit receipts are uploaded; raw native proofs, the private
journal, stderr, raw LHR, trace, page data, images, identifiers, paths and keys
are excluded. Missing evidence remains UNKNOWN, never an absence claim.

## What the score experiment proves

Lighthouse 13.6.0 receives the original SETTINGS: mobile simulate RTT300ms,
throughput800kbps and CPU6, five performance audits, storage reset and no full
page screenshot. Natural browser link prefetches receive the same policy as
ordinary requests. The unchanged closed400 boundary, six-active gate, authless
profile, ordinary TLS/sandbox, request rules, passive Font verification and
owned bounded trace-read mechanism remain in use. No AB emulation lock is
installed for this score case. The first eight cases retain their old lock.

Actual Lighthouse emulation code clears real network throttling for simulate
and resets CPU during cleanup. An executed controlled test proves that the
old AB actual-CDP lock rejects this as AB_CONFIG_MUTATION. Therefore a successful
simulated score is not a locked actual-300ms/800kbps browser observation; this
candidate explicitly labels the distinction rather than silently weakening a
lock. It neither changes a live path nor claims equivalence.

A score passes only with strict report URL/settings/version/numeric checks,
visible fixed content, all three natural prefetches, positive verified Font,
owned trace EOF/close, final receive/session fence and unchanged seal after
physical cleanup. Original browser version is shared across stages, and the
actual executable hash must remain stable. The synthetic raw LHR is saved and
read back in private temporary 0700/0600 storage, size-limited and removed.
Only validated synthetic numeric metrics may enter the public fixed projection.
This is not a real-site score. Unknown/open/cleanup/cap/privacy failures have
null numeric metrics. No raw report is an artifact.

## Local verification and limitations

Existing Chromium154.0.8037.57 was tried once under the original openGuarded,
ordinary sandbox and reject-only proxy. It stopped at CHROME_SANDBOX_FAILED;
no page was connected, no forwarding occurred. This is not proof of Slot20's
GitHub failure (which had native exit1 and no per-case public diagnostics).
No repeated browser setup, security workaround or software install was used.
Thus neither real Chrome nor a genuine Lighthouse score is verified locally.
Model tests explicitly inject fixed contexts/LHR and are not browser results.

The entire current-SHA workflow unit inventory is run on exact installed
Node24.19.0 and Node22.19.0 in a fresh depth23 checkout with locked existing
dependencies. The old Slot20 admission test has parent-specific assertions;
it is executed unchanged at BASE in a separate local depth23 checkout by
history-test.mjs, with an explicit historical source label. It is not counted
as a same-SHA assertion. New admission still checks the exact new candidate.

A first reviewed closed-only Actions run would distinguish native case,
opening/policy/readiness/abort/cleanup failures and independently test genuine
natural-prefetch Lighthouse compatibility. It must not navigate to staging.
Only after that result could a separate reviewed live-scoring candidate be
considered. Historical external-script rejection, current deployment, live
visible-content success and current route coverage remain unverified. No
allowlist extension or bypass is proposed. All new Actions credits remain unused.
