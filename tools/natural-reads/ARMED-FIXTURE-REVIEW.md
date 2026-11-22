# Unpublished fixture recovery candidate

Parent: `18c6bcc07fb96dd342c89b544aaf52097266f46b` (run44997603530).
Proposed ref: `refs/heads/diag/fixture-arm-proof-once-20261122`.
Subject: `diagnostic: armed negative fixture and ja once (20261122-x1)`.
New workflow: `.github/workflows/staging-fixture-arm-proof-once-20261122.yml`.
No push/Actions/site access performed. Budget6/10 unchanged, no next slot reserved.

## Native negative controls: finish initial navigation before arming

The previous four negative controls were actually blocked and cleaned up, but
all threw an unclassified exception during goto. No error class is guessed or
newly accepted. Even the previously recognized target-closed exceptions no
longer pass a negative test: first_exception must be null.

Negative HTML is now inert until the one fixture-only arming function is called.
The original goto must resolve without exception. Same-target URL, ready primary
owner/frame, main200/HTML/doc1 and known visible initial heading must be checked
before arming. The arming function schedules its one fixed action250ms later
and returns the exact {state:ARMED,scheduled:true} acknowledgment. The Node side
must actually receive that acknowledgment while still healthy and before any
candidate refusal. The owner/frame is bound in RAM. WAIT_STOP then polls Node
RAM only, capped at2000ms/100 sleeps; it issues no browser or CDP operation.
If the refusal beats the arm reply, a reply is malformed/missing, ownership
changes, a timeout occurs, or any browser call throws, the case fails. There is
no retry. A timer delay is not treated as proof that the reply arrived first:
ARM_COMMAND versus WAIT_STOP phase and acknowledged flow are mandatory evidence.
These stage records express observed order, not application causality.

Actual refusal still requires exact fixed fixture URL (boolean output only),
method/category, Fetch/XHR only for script negatives or Document for navigation,
same request/abort command/session ACK, no selected forwarding/fulfillment,
main200, receiver settlement and physical cleanup. Unknown failures do not pass.
Both positive HTML strings and fixed response bodies are byte-identical to the
parent. Normal and native prefetch still need all six deliveries and JS render.

## Closed handled500 controls: Window-bound timers and complete evidence

The copied timer methods used the temporary environment object as receiver.
The exact old fixture fails a receiver-checking VM model with TypeError; its
counterpart with Window-bound timers succeeds. This is a JavaScript receiver
model, not proof of the native Chrome error message in the earlier run.

The fixture now passes setTimeout/clearTimeout bound to globalThis (the real
Window when run in Chrome). Actual app:error registration remains required
within1200ms. The single error is emitted250ms after registration, rather than
assuming registration happened before a timer. Missing/late registration stays
missing; duplicate registration does not duplicate emission. An emission failure
sets the fixed failed state, emits one fixed console failure signal and throws
one fixed exception; it cannot silently satisfy the successful fixture.

The closed top gate requires an actual initial ORIGINAL_CONTENT/GE20 sample
with known main/heading; handled controls also require final ERROR_500/500,
app:error500 and exact console count0 or1. Every case must report scoped
uncaught_count0/NOT_OBSERVED_IN_SCOPED_WINDOW. Unknown/uncaught or extra console
fail the gate. Thus late initial sampling does not silently count as a valid
initial display. The250ms delay increases opportunity; only actual samples prove
the gated state. It is not a general paint guarantee. Network/cancellation
negative controls retain their original expected refusal checks without requiring
an initial DOM sample that a rapid safe stop can legitimately interrupt.

The old controlled parent double starts handled cases already in500. It is
still tested, and the new stricter top gate correctly rejects it for missing an
original first sample. It is not presented as the valid new real-browser fixture.

## Scope and future gate

Live request policy, natural prefetch treatment, route table, gateway, sender,
runner/probe, child/parent/protocol, proxy, TLS/sandbox/profile/security and all
old workflows remain byte-identical. Only three admission binding constants and
its exact manifest change to the new parent/ref/subject; the function body is
unchanged. No live observation command is added.

The new workflow uses exact branch/path/title, parent one-commit JIT binding,
push/attempt1 only, depth9, contents:read, checkout credential nonretention,
locked dependencies, Node24.19/22.19 and the existing12-minute cap. Same-SHA
unit and both complete six-case real Chrome gates must pass before any future
one /ja/ observation. A safely closed assertion failure may collect the other
controls, but aggregate failure always skips live. No current execution is
approved or attempted by this local preparation. Public artifacts remain fixed
JSON only, no score/report/raw CDP/HTML/trace/screenshots/headers/IDs.

## Local evidence boundary

Closed CDP doubles pass through the actual closedBrowserCase, inherited request
policy, abort ACK, receiver and physical-cleanup wrapper. They never override
request decisions. VM controls use the exact emitted fixture script and actual
Nuxt probe, including a timer receiver check. They do not substitute for native
browser rendering or native prefetch. Chrome is absent at the standard path. The installed Chromium has its known
chrome-sandbox helper owned by nobody/nogroup, mode4755 rather than root.
The previously inapplicable sandbox launch is not retried. No launcher, sandbox,
OS/TLS setting or external connection is changed. Native Chrome controls are
NOT_RUN; the VM/CDP doubles do not replace the mandatory future CI gates.
