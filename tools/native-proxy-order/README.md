# Local-only first-six closed proxy order candidate

Base is published Slot41 `df29ee7204cc6bd82db2f59d5fff4cb124d6cded`.
No old source, workflow, pins, admission, live opener or policy is modified.
There is no new workflow, CLI, target argument, API/credential handling or live
entry. This library is not automatically selected by any published workflow.

## What is established

The already-retained Slot38 result stopped at Node24 units before the comparison;
it is not a Chrome result. Slot39's Chrome158 sequence prelude includes a passing
unapproved_api with zero socket errors. Slot40's Chrome157 first six all pass.
Slot41's Chrome158 first three pass; unapproved_api has SCOPE/GET/XHR, abortACK1,
forward0 and physical proxy close/open0, but one strict socket fault:
ACCEPTED_DOWNSTREAM_PROXY_SOCKET / ECONNRESET / CONNECT_HANDOFF / ACTIVE.
The eight relevant core source files are byte-identical across Slots38–41.
Displayed Chrome versions alone do not establish cross-run binary identity.

The prelude uses the original observedNative -> nativeStage -> closedBrowserCase
-> openGuarded -> rejectOnlyProxy. The reviewed postFlushOpen only decorated the
later five Cloudflare cases, not those first six. Sequential module initialization
was repaired before Slot39; Slot41 returned a complete failed case, not an early
module-initialization exception. Authentication succeeds before native work and
is not evidence of the TCP reset's cause.

The original CONNECT callback calls socket.end(403): the writable side ends but
the raw accepted socket's readable side may remain open. An actual peer TCP reset
in that interval reproduces the fixed CONNECT_HANDOFF/ACTIVE fault. ACTIVE means
the first error handler ran before disable/close latched. The stored receipt has
no per-socket relation to the CDP request and no shared event timestamps; it does
not establish which Chrome connection or action triggered the reset.

## Small proposed correction

`native.mjs` passes the existing reviewed postFlushOpen to the original
observedNative. That opener decorates only the reject-only loopback factory,
checks writableEnded after the original403 response is queued, then destroySoon
closes the local socket after its queued output. It does not forward or enable
anything. It preserves the captured proxy object, original error listeners,
first-fault recording, strict close failure and all original case verdicts.
The optional open argument is the existing trusted dependency seam for tests;
there is no environment/CLI selector. Default is the immutable postFlushOpen.

A later separately reviewed one-shot entry could select this callback only for
its first six CLOSED native cases. Nothing in this local candidate changes the
actual live pinnedTunnel, accepted live CONNECT handling, CDP deny policy,
POST/allowlist/path/query/credentials,400/6, natural prefetch or score adoption.
All23 current-SHA/binary native controls and exact JIT would remain required
before any live use. This is not authorization or wiring of a new run.

## Reproduction and counterexamples

`model.mjs` uses the actual closedBrowserCase/memoryGateway/nativeVerdict,
observedNative/journal/cleanup projection, real reject-only TCP, Node child and
private temporary profile/file cleanup. CDP events, page readiness, Chrome string
and renderer results are CONTROLLED. It is not native Chrome evidence.

On each exact Node22.19.0/24.19.0 runtime, six repetitions of each of two orders
are tested with both factories: reset before arming; reset while abortACK is
pending. Original factory fails12/12 with the Slot41 fixed fault signature;
decorated factory passes12/12 after local physical close before peer reset.
These two different modeled orders produce the same historical fixed shape,
showing that ACK1 plus the socket fault cannot prove abort caused the reset.
A real early TCP reset before CONNECT handoff still fails under both factories;
an invalid abort reply also fails and prevents subsequent cases. A matching reply
count may be1 while consistency/block confirmation is false: count alone is not
success. No error is ignored, downclassified or converted to a pass.

No-fault runs preserve all six functional cases, including normal reads, natural
prefetch, POST and other scope/navigation denials. Every returned context checks
process close, profile absence by stat, wire close, proxy physical close/open0.
An independent Node loopback-only guard records zero DNS/nonloopback attempts in
this model. Existing tests additionally cover403 flushing, peer FIN, true early/
active/closing faults, independent sink zero, no continuation after uncertainty,
current beacon policies and score adoption. All actual traffic here is loopback.

Run the new eleven tests:

```
node --unhandled-rejections=strict --test-reporter=tap --test tools/native-proxy-order/test.mjs
```

Run `run-regressions.py` from the review package for exact existing suite inventory.
Node22-only fixture-stop suite is deliberately not claimed as Node24 coverage.
Tests use the already installed lock-identical Lighthouse dependency tree; no
software installation, browser launch or security/network adjustment is needed.

Normal-sandbox Chrome is unavailable at the required local path, so the actual
first-six/native23 comparison remains unverified. No setup retry or workaround
was attempted. The smallest useful next native check is this first-six opener
selection under the unchanged same-binary23 gate; do not replay Slot41 unchanged
or infer anything about Nuxt/deployed revision. No Actions slot is reserved.
