# Unpublished one-run real Chrome closed proof

Parent: `29b45c28f10ef666a6b9bda92fc249570c558618`.
Planned ref: `refs/heads/diag/rejected-paths-chrome-closed-once-20261123`.
Subject: `diagnostic: fixed rejected paths Chrome proof once (20261123-q1)`.
No push, Actions or browser launch is performed by preparing this candidate.

The previous eleven local files remain byte-identical. Real private filesystem
storage still refuses Actions, and the real-data entry still refuses GHA binding.
This workflow tests no real URL or data and cannot activate that path.

## Explicit test doubles, not a private-delivery bypass

The producer loads the exact pinned journal source as a separate ESM instance using
Node's existing synchronous registerHooks API. Only that instance's two imports are
replaced: a ciphertext-only RAM store and a static-fixture projector. Hooks are removed
immediately after import. Ordinary journal/private-store module identity and brands
remain unchanged; the real constructor rejects the RAM-store brand. The test factory
accepts CLOSED binding only. An unknown actual input value is never parsed as a URL or
returned as a path: the projector may emit only literals already enumerated by data.mjs.
No arbitrary real value can become a retained path through this test entry. Independent
bounded unknown-input/scope-miss counters invalidate the case even when the row table
is already full; counter saturation is unknown, never zero.

The original journal collection, deduplication, overflow accounting and original
crypto execute unchanged. Tests authenticate the encrypted synthetic payload in RAM.
No key, ciphertext, path list, HTML, screenshot, browser stderr or CDP log is exported.
This proves the collector with explicit fixture doubles. It does not prove real private
filesystem delivery in Actions or authorize handling real rejected paths there.

## Browser boundary and cases

Only the existing fixed loopback FixtureGateway and openGuarded launcher are used.
The existing guarded request method is inherited without override; the observer sees
its actual abort commands. A minimal boundary adapter supplies the journal interface
without making a policy decision. Reasons absent from the fixture policy remain
ABORT_WITHOUT_POLICY_REASON; staging ORIGIN/METHOD attribution is not invented.

The proxy is the existing rejectOnlyProxy: no DNS or upstream connector, no enable or
forwarding capability. Browser navigation uses the fixed loopback fixture intercepted
from constant strings. No staging or production opener is imported or called. The
standard runner Chrome path, same-process CDP Browser.getVersion, binary fingerprint,
new empty authless profiles, sandbox, TLS and existing launch arguments are reused.
No Chrome install, alternate runtime flag or sandbox workaround is introduced.

Seven independent fixed cases use fresh profiles: normal, 401 unique paths, duplicates,
401 maximum-length paths, 1,100 unique paths with duplicates/overflow, redaction and POST.
Five intentional duplicate fetches run serially after the first set settles, preventing
coalescing from being mistaken for lost callbacks. They are finite fixture operations,
not retries of a failed browser case. All requested fetches must actually reject; the
original owned receivers must settle, pending commands must be empty, and no guard fatal
or receiver rejection is tolerated. No renderer loadingFailed is used as an abort ACK.

Each case must have one fixed document and script allowed, the expected number of
aborts and captured callbacks, correct rows/duplicates/omissions, authenticated memory
readback, real rendered fixture/JS, a stable Chrome version/hash, complete process/profile
cleanup and zero proxy upstream/open sockets/socket faults. Unknown is not a pass.
Cleanup/protection uncertainty and any opening/version/binary identity failure stop
the matrix; the binary is checked before each launch as well as after binding and
after the matrix. A normal failed case fails the job even
if later independent cases can safely record their results. There is no subsequent live
stage under any outcome. Standard240, the historical exact400 experiment, concurrency
six, natural prefetch and all staging policies/JIT remain unchanged. Their existing
Node contracts are retained; this loopback Chrome fixture is not a staging-policy proof.

## One-use trigger and publication boundary

The workflow has push only, exact new branch and its own unique workflow path, exact
subject, new-ref event, attempt1 and a unique non-cancelling concurrency group. Checkout
is depth18 with credentials not retained. Same recognized lock/ignore-scripts and exact
Node24.19.0/22.19.0 are used. The inventory explicitly matches the actual runtime
execution order (all Node24 groups including the helper, then all Node22 groups);
actual producer-to-admission readback is checked locally to prevent stale ordering
from rejecting a genuinely passing proof. All 26 old unit groups plus the new fixed-memory contracts
must pass. Local identity/source/added-paths/parent/one-commit checks and a public read-only
same-SHA run-uniqueness query must pass before Chrome. No dispatch, rerun or schedule exists.

The future publish preflight must independently verify the exact reviewed SHA, absent
remote ref/no matching or competing run and the fresh trigger inventory. These remote
conditions are not claimed verified by this local-only preparation. Existing workflows
are untouched. Only two fixed summary JSON files are uploaded with one-day retention.
The old positive local-filesystem suite is tested locally; its positive cases are not
silently run in a stripped Actions environment. Actions instead explicitly verifies that
real private delivery remains denied, then tests the disclosed memory/static doubles.

Actual Chrome execution is still unverified locally: no newly compatible ordinary
sandbox environment is available, and no known failing launch is repeated. The pending
one-time exception, if granted, concerns this fixed-data closed workflow only.
