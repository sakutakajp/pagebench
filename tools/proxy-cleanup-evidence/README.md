# Closed proxy cleanup evidence (diagnostic only)

Exact parent is published e688e567e3fc024201f7fc92cb756935f8a9474d.
No existing file, workflow, socket policy, accepted origin, route, method,
concurrency, cap, prefetch, browser command, sandbox or TLS setting changes.
No live/staging entry exists. The same native6/cap400pair/synthetic-Lighthouse
path is retained. A synthetic score, if obtained, is not a staging score.

## Facts and causal limits

Slot22 ordinary_reads returned HTTP200 and the fixed JS-rendered document with
all six resources delivered, no recorded fatal/refusal/exception, and zero
receiver/pending counts. Its aggregate cleanup failed and proxy socket_errors
was1; the proxy was physically closed with zero open/upstream sockets. That
alone does not identify the socket error code, stage, timing or all cleanup
components. initial_visible is a negative-arm field left false in this positive
case; it is not evidence that the successful render sample was invisible.

The original rejectOnlyProxy already freezes a fixed first_socket_fault when
it increments that counter. It keeps its error listener through physical close
and close() throws CLOSED_PROXY_SOCKET_FAULT even after physical closure. Its
error and close policy remain unchanged here. Strict Node22.19.0/24.19.0 local
component tests (25 each) reproduced real kernel loopback reset and controlled
lifecycle faults, normal denial/no-forwarding, process closure and profile
removal. The known fault cases remain failed despite successful physical
closure. These tests do not establish which fault happened in Slot22.

No causal production repair is justified yet. This candidate only retains the
existing fixed fields that were omitted from the public projection. It does not
ignore expected-looking resets, catch-and-pass errors, retry, or treat physical
closure as a successful proof. Score remains behind the original full verdicts.

## Observation boundary

native.mjs calls the original nativeStage and original closedBrowserCase. It
wraps the supplied context cleanup, returns the exact original result/rejection,
and records the original frozen cleanup stages. No ordering, waits or command
are added. One passive close listener is installed only on the exact open CDP
wire and removed after the case. Listener failure cannot skip original cleanup.
The proxy is the exact original reject-only instance, with no forwarding or DNS
capability. Its first fault remains the source's first fault, not a nearby event.

Per case, the fixed separate projection records first fault resource/code/stage/
lifecycle, bounded error count, physical proxy close/server-and-socket state,
existing process kill/close, wire close call, profile remove outcome, original
verdict and cleanup status. It retains explicit UNKNOWN/NOT_REACHED and not-run
cases. It is not a replacement verdict. A separate stop-only attestation also rejects
an original pass if current component observations show a fault or do not
confirm closure/removal outcomes; it cannot upgrade an original failure. No
extra wait is added to obtain that evidence. Process close confirmation is from the
existing tracked process close event. A wire close method returning is distinct
from the separately observed close event. PROFILE_DELETED means the original
remove operation returned; this candidate has no profile path and makes no
independent stat claim for a Chrome profile. Local component controls separately
check actual synthetic profile deletion. If openGuarded never returns a context,
process/wire/profile details may be UNKNOWN; a captured proxy can still be read.
It does not reconstruct inaccessible cleanup state.

Proxy proof remains failed on any recorded/unconfirmed fault. Original counters,
shutdown, abort/deny rules and physical cleanup all remain authoritative. A
recording/storage gap adds a stop; it never makes a failed proof pass. The
separate observer is limited to six cases,32 writes,16KiB. Only reconstructed
fixed JSON is published, within the unchanged48KiB combined projection cap.
No URLs, paths, peer/session/request IDs, headers, bytes, exception strings,
stdout/stderr, trace, keys or raw reports are projected. Old admission receipts
are retained, plus the new unit gate. Missing observations are not absence.

## Reuse and prospective run

Only the small parent admission/record/entry/publication adapters are relocated
with new exact identity/source pins and one additional unit gate. Their prior
predicate bodies, exception behavior, units and JIT consumption are retained.
All five previous current-unit families plus the parent's53-per-runtime tests
run unchanged; new tests add actual closed socket/process/filesystem observer
checks, schema/privacy/unknown controls and original-verdict/score-suppression
controls. A fresh named depth25 checkout matches workflow order and versions.
The unchanged21 historical tests remain explicitly at immutable416b0c6.

The one future workflow is exact branch/path/title/direct parent/attempt1, no
manual/schedule trigger. It has no live step. Successful admission revalidates
at JIT, then runs the same original closed checks and score only if all their
verdicts pass. Publication independently rebuilds admission, native and proxy
cleanup evidence after failure. Raw intermediate journals are not artifacts.
Remote absence/competition/trigger state must be rechecked if later authorized.

No local Chrome launch was repeated: the known ordinary-sandbox local Chromium
attempt failed its sandbox prerequisite. Real Chrome interpretation remains for
a separately reviewed closed run. No Actions credit is reserved by this work.
