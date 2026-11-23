# Capacity and refusal-event accounting

Source baseline: `29b45c28f10ef666a6b9bda92fc249570c558618`.

A bound of 400 on all rejected requests cannot be proved from the existing code:

* `tools/natural-reads/retry400-gateway.mjs:8` rejects a failed classification before
  incrementing the eligible counter at line 11. Thus ORIGIN, METHOD, CREDENTIAL and
  SCOPE failures are not bounded by that counter.
* `tools/ab-observe/gateway.mjs` awaits `Fetch.failRequest` before setting the fatal
  stop. Concurrent owned receivers can judge other requests during that await.
* `tools/nuxt-debug/owned-receiver.mjs:9` saturates an active-receiver statistic at
  65,535; it does not enforce a receiver/event admission limit. Its 1,000 ms settle
  timeout bounds waiting time, not how many callbacks have already run.
* ReadSignals' 32 chronology entries, 120 start rows and Content table bounds only
  retain passive evidence; their overflow flags do not stop receiver delivery.
* The 1,048,576 UTF-16 CDP input limit bounds one message. The existing timeouts do
  not provide a source-level deterministic maximum number of messages.

The executable controlled-CDP case fills the existing eligible total to 400 and
then judges 401 or 1,105 rejected callbacks before the abort responses finish the
stop. All were aborted; no continuation was added. Three later paused notifications
are not judged by the stopped gateway and are therefore outside this journal.
This is a closed execution of the original runner/receiver/request/finishArm path,
not evidence that Chrome or the live site used this event order.

## Explicit storage bound, not a claimed complete history

The local capacity is now 1,024 distinct retained rows, not 64. Each pathname is
bounded to 256 UTF-8 bytes and 256 UTF-16 units, with the existing redaction rules.
There are at most 32 fixed signal rows. Individual counters saturate explicitly at
65,535 and then represent lower bounds.

`capacityProof()` computes a conservative maximum JSON row (755 bytes), including
quote escaping and longest fixed labels. It reserves 4,096 bytes for outer fields
and counters, and 108 bytes per signal including a separator. The conservative
plaintext bound is 781,696 bytes, below the 1,048,576-byte padded private plaintext
budget including its four-byte length prefix. The ciphertext-envelope limit is
1,572,864 bytes, above a conservative 1,402,752-byte envelope bound (base64
ciphertext and fixed cryptographic/binding fields). These are private local storage limits, not changes to CDP input,
HTTP response, request, concurrency or parent fixed-record limits. The closed
entry refuses to start if the serialization proof no longer fits.

The version-2 payload separately records total omitted callbacks and omissions due
to row capacity. Existing retained duplicates still increment their exact count
when the table is full. Every event whose row cannot be retained increments the
omitted-event counter, including repeats of an already omitted path. Distinctness
and duplicate identity among omitted values are explicitly NOT_MEASURED; no hash
of an omitted or redacted secret is stored. Retained row counts plus omitted events
equal observed prefix callbacks whenever counters are unsaturated.

No output claims complete capture: `collection_completeness` is always
NOT_PROVEN_EVENT_BOUND_UNKNOWN. The immutable first seal covers that prefix only;
a later actual callback increments the separate late counter and cannot silently
rewrite the file. Post-stop traffic with no rejection judgment is excluded, rather
than counted as a rejection. Missing/unbound events, redaction, projection loss,
overflow and saturation remain distinguishable. Fixed artifact absence remains
unknown. A private sink or write/readback failure never enables a live opener.
