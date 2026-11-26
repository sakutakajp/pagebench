# Closed-only CONNECT post-flush comparison

Historical parent: c205c2eeaa2b2a90ebcf5208d366f3c1d44bf4b6 (Slot36).
No previous file, workflow, source pin, live transport or admission is changed.
This candidate has no staging/live entry or target argument and never adopts a
score. All logical resource URLs are the inherited fixed memory fixtures; only
local proxy/CDP sockets are used. A logical URL does not authorize an upstream
request. The reject-only proxy has no forwarding or DNS implementation.

## Correction and isolation

`postFlushProxy` invokes the original factory exactly once and returns its exact
object, preserving the fixture's captured reference. While that factory runs
synchronously to its first await, it captures the one `http.createServer` and
restores the intrinsic before any await. It attaches a second CONNECT listener
**after** the original fixed403/end listener. This requires the writable end to
have been initiated, then calls `destroySoon()` to close after queued response
bytes flush. A bad handoff emits a fault and fails. Original fault listeners,
counters, strict close and cleanup remain untouched; no error is ignored.
This wrapper is imported only by the new closed comparison. Existing live and
closed entry points do not import or select it. All inherited files remain exact.

## Exact comparison

One parent admits the exact new push, units, sources, parent and exclusive consume.
It starts ALONE and SEQUENCE in separate strict Node children, in that order.
A failed or unknown first condition stops the whole job; no later case is forced.
Each child has an exclusive identity-bound permit. Credentials and arbitrary
parent flags are excluded from the child environment. Each browser gets the
unchanged normal sandbox flags and a fresh profile from `openGuarded`.

ALONE: the unchanged five original CF fixture cases and verdicts, with the new
post-flush proxy decoration only.

SEQUENCE: the Slot36 original thirteen controls (native6, cap400 two, synthetic
Lighthouse one, standalone two, owner two) in the same order and with the original
reject-only proxy; then the actual registered adapter and the same five CF cases
with the decorated proxy. Original producers and validity predicates decide all
prelude gates. The synthetic score is validated privately and discarded; no score
number, raw report or trace is included in output. Cleanup wrappers add only fixed
post-cleanup snapshots where existing APIs accept an opener. Cap400's internal
opener is unchanged, so its proxy fault details can remain UNKNOWN.

Both children use one Chrome file identity, verified around the five-case opens
and with existing prelude identity checks; parent verifies the file hash around
each child and requires equal reported Chrome versions. A hash/exit/cleanup gap
cannot produce PASS. No valid outcome may contain a proxy socket fault.

This is a two-condition comparison, not a complete factorial experiment: prior
thirteen-case history and the registered adapter vary together. It cannot isolate
one from the other or prove the historical Chromium event that caused Slot36's
RST. Separate children avoid contamination of the second Node process by the
first condition, but host-level time/load remain uncontrolled. No baseline old
proxy real-Chrome arm is added: the exact old-proxy failure is reproduced by the
real TCP regression instead. This keeps the requested comparison bounded.

## Network and publication

The inherited forced loopback reject proxy, no proxy bypass, no forwarding
implementation, memory-only CDP fixture and unchanged browser restrictions remain.
Additionally a child-local Node guard rejects non-loopback Socket.connect and
hostname DNS operations before dispatch. Literal loopback lookup requires no DNS
query and is permitted. Node guard attempts are fixed counters. No public API,
credential, live factory, external script or target fetch is used. Chromium-wide
OS packet capture is not added: the existing browser isolation/proxy contract is
retained; Node DNS counters are not labeled an independent Chromium UDP census.

Only exact fixed receipts are printed/uploaded. Per-case proxy faults, original
cleanup stages, case/refusal enums and bounded counters survive a failure.
Missing/corrupt/foreign evidence remains UNKNOWN. The publisher requires both
child exit0 dispositions as well as valid passed conditions, so a crash after a
saved PASS cannot publish success. Nonzero/timeout child disposition stops the
other condition and requests a process-group kill when needed; physical closure
is never inferred from the kill request. No raw stderr, URL, host, path, query,
body, browser log, identifier, key, ciphertext or raw proof is published.

## Local validation and real-Chrome limit

The unit entry runs all unchanged48 socket/fixture tests plus40 new tests on exact
Node24.19.0 and22.19.0. This includes real loopback403 bytes, old kernelRST, post-
flush physical close, real earlyRST, retained fault failures, process/profile
cleanup, unchanged natural prefetch, actual registered-adapter execution with
controlled CDP, actual filesystem/CLI readback, and negative admission/permit/
exit/schema/guard tests. Controlled CDP is not real Chrome; the thirteen prelude
functions have not been executed natively in the local environment.

Official `/opt/google/chrome/chrome` is unavailable locally. The existing Chromium
sandbox helper still has the previously unsuitable ownership; no browser setup
retry, sandbox/TLS bypass, installation or network operation was attempted.
Real normal-sandbox Chrome comparison remains the unperformed gate, for one
separately authorized future Actions run. No live continuation exists in this job.

The workflow uses one new exact branch/path/title/push/attempt1, contents:read,
persist-credentials:false, depth6 and unchanged dependency lock with ignore-scripts.
Depth6 is the minimal history through the original Slot33 reference used by the
unchanged48 tests. No existing workflow changes or automatic followers are intended;
remote absence/run checks must be freshly repeated before any future publication.
No Actions credit is reserved or consumed by this local preparation.
