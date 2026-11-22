# Offline stop-record diagnosis and dedicated240 candidate

Base: `1aa55b640f77d885e247ad3a9f9aaa06e93d2b24` (run44999606871).
Budget7/10 unchanged; no slot reserved. No remote read/write, website request,
Chrome launch, Actions, score, database or system-setting operation is performed.
All pre-existing repository files are byte-identical. This candidate adds closed fixtures, a bounded stop projection, and a dedicated
future240 workflow. Historical120 paths and workflows remain byte-identical; new staging diagnostics
use the shared named240 policy without a ja-only cap exception.

## What is confirmed

The actual existing observeNaturalReads, NaturalReadBoundary, request handler,
owned receiver, cleanup, safeFinal, child journal and superviseNatural are used
in the closed process control. All bodies and commands are fixed in memory; no
HTTP client/upstream-capable transport exists. The instrumentation wraps check
and fail without overriding request decisions or messages. Baseline/instrumented
continue/abort counts, first cause and cleanup are compared exactly.

With180 ordinary fixed GET request pauses received before the first abort ACK:

- Requests1..120 (including main) pass the shared count check.
- Request121 first rejects LIMIT; its abort awaits a CDP acknowledgment.
-59 further request pauses are processed while that ACK is pending, BEFORE
  g.stopping becomes true; total reaches180. They are also rejected, not sent.
- After the first ACK the original fail path stops the guard.40 additional
  request pauses received AFTER this point do not enter boundary.check and do
  not increase the policy total. Census received220; boundary total180.
- Actual closed command counts:7 continue commands (main plus6 concurrent
  subresources),60 aborts, no upstream. The waiting permitted subresources are
  never released after stopping. This is a CDP double, not real network traffic.
- safeFinal rejects the raw result because total_requests is limited to121.
  The original parent then reports CHILD_EXIT_WITHOUT_FINAL despite first
  LIMIT and COMPLETE cleanup already being durable in its journal.

A121-total control remains representable;122 and180 are not. The counterexample
is a benign concurrent batch, not a changed cap or delayed-stop implementation.
The fixture holds mock abort replies to represent ordinary response latency;
production stop timing is unchanged. After-stop messages are separately counted.

This reproduces an exact code path that explains the observed parent outcome.
Run#7 did not save its actual final total, so it does NOT prove that the real
value was180 or that this was the only cause of the missing final record.
Receiver peak180 is not a count of requests and is not used as one.

## Repair candidate and its deliberate integration boundary

stop-record.mjs is NOT imported by any existing120 child/runner/protocol/workflow.
The NEW fixed240 child uses its metadata-only recordParts projection.
It projects only a genuine FAILED_OR_UNKNOWN result with a fixed first fatal.
It reuses the current safeFinal and existing fixed metadata validators. For a
legacy total outside0..121 it emits legacy total_requests:null, rather than
lying by clamping it to121. A separate request_total has a bounded value and
EXACT / AT_LEAST / UNKNOWN semantics. Values above65535 become >=65535; invalid
or missing values remain UNKNOWN. No counter changes the forwarding decision.

The envelope preserves first refusal/fatal, scoped console coverage, missing
samples and cleanup. It is always STOPPED_NOT_ADOPTED with score/report false.
A numeric120 in the existing capped passive counters is labeled AT_LEAST in the
extra envelope; zero counts with UNKNOWN coverage do not become error absence.
Contradictory counters/cleanup, accessors on known top-level fields, invalid
schemas or claimed adopted/score results fail closed. Unknown extra fields are
not read or copied. The input is the trusted runner result, not a raw Error,
page object, rejected CDP payload or arbitrary Proxy.

The extended envelope passes fixed-schema JSON readback and existing atomic
saveParentFixed with the same131072-byte ceiling. In the closed candidate child,
the existing parent accepts the normalized FAILED observation, retains the
first stop and reports GUARD_OR_CHILD_FAILURE instead of losing the final.
The extended counter envelope is separately saved to a private file. The new
dedicated240 parent reads it back, validates it and matches its observation
against the unchanged parent protocol result. It then outputs one bounded
fixed envelope. Historical120 protocol and workflow bytes are untouched.
No failed-result adoption or score acceptance occurs. Cleanup FAILED/UNKNOWN
remains failed/unknown. The new path has not run on a real browser or site.

## Threshold audit (unchanged)

| Bound | Role and consequence |
|---|---|
|historical120 / new240 | Shared policy count, main included; ordinary and marked reads identical. Stop follows abort ACK, so the observed counter can exceed121 before stop. |
|6 | Active request forwarding concurrency; excess permitted requests wait. |
|120 starts | Passive Network-start binding map, concurrent entries, separate from policy total. EOF/failure releases entries. Overflow makes coverage UNKNOWN. |
|120 content rows | Retained Content observations; separate from active-start capacity. |
|32 events | Passive timeline, not HTTP request count. The33rd observed event sets overflow; counters may continue but coverage becomes UNKNOWN. |
|120 passive counters | Existing console, uncaught, unscoped, network-failure and post-stop-notification counters saturate. They are not exact beyond their bound. |
|64+16 /80 | Regular plus critical journal packet budget; retained first stop/cleanup tested by existing regressions. |
|65536 bytes | Existing journal packet bound. |
|131072 bytes | Existing final parent file bound; also enforced on the new envelope. |
|1048576 UTF-16 units | Existing received CDP guard limit; unrelated to total request/schema limits. |

The starts map sees Network notifications before request admission and can fill
independently. A32-event overflow can occur with very few requests; a closed
window's NOT_OBSERVED_IN_SCOPED_WINDOW is never a global absence claim. Fetch
pauses after stopping are ignored by the existing passive late-notification
counter, which only counts selected error/failure notifications; the closed
census therefore labels its post-stop Fetch count separately.

## Sizing and observation limits

The real LIMIT establishes at least121 count-eligible requests in the relevant
window, not a complete page workload or peak request count. It cannot justify
a particular larger policy cap. First preserve bounded total, first crossing,
pre-stop overshoot and post-stop arrivals with missing/overflow reasons. Measure
all request types identically, without reading purpose headers or a prefetch
quota. Choose any future shared cap from a completed bounded ordinary workload
and its peak concurrency, with separately reviewed CPU/memory/time/egress bounds.
Size the passive active-start map from concurrent unresolved starts and the
Content store/timeline from retained evidence, rather than copying the HTTP cap.
A fixed first-critical-event plus coarse saturating counters is preferable to
an unbounded event log. The user subsequently approved240 for all staging diagnostic pages. This
candidate implements the shared named240 policy with dedicated ja admission; none of the
passive thresholds, forwarding concurrency or time limits changes. A larger
policy cap does not restore missing passive coverage.

## Verification scope

Node22.19.0 --unhandled-rejections=strict for new controls. Tests cover120/121/
122/180, a before-stop burst and1/40/128 post-stop arrivals, original/candidate
parent results, complete/failed/unknown cleanup, passive32/33 and120/121
boundaries, saturation, missing samples, unknown console coverage, redaction,
atomic readback and byte identity of EVERY pre-existing source and workflow.
Ordinary versus purpose-marked synthetic streams are compared; no marker is
read by the new census. Native Chrome and actual site data are not used or
substituted. Existing898 regressions and both new test groups are separately rerun on the
exact candidate. See SCOPED240-PLAN.md and the review verification record.
