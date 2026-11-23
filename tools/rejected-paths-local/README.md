# Unpublished local rejected-path integration

Baseline: `29b45c28f10ef666a6b9bda92fc249570c558618`. Only this new directory changes;
all prior workflows, live entrypoints, policies, JIT, keys and safety controls remain
byte-identical. There is no workflow or live navigation entry in this candidate.

The updated scope includes every actual rejection callback, without a resource,
method, reason or first-event filter. Only a ready primary session and primary
frame can supply a path; unbound or unavailable evidence is counted with fixed
reasons. Directly paired aborts and synchronous correlated passive failures are
also observed. Unassociated guard/abort signals are counted separately, never as
fabricated distinct requests. No request permission, abort, continuation, await,
Promise handler or CDP command is added by the observer. It uses the existing
parsed passive callback, without parsing rejected CDP input.

The 400 eligible-request limit does not bound rejected callbacks; see CAPACITY.md.
Storage now supports 1,024 distinct rows, including tested 401 unique maximum-length
paths. Overflow and missing values are explicit; complete history is never claimed.
Duplicates are counted by normalized encoded pathname plus fixed metadata. Redacted
values coalesce only by fixed labels; distinct redacted/omitted identities are unknown.

## Executable closed integration

With actual Node 22.19.0 or 24.19.0:

    node --unhandled-rejections=strict tools/rejected-paths-local/verify.mjs
    node --unhandled-rejections=strict tools/rejected-paths-local/closed-child.mjs --closed-proof burst401

The closed entry invokes the unchanged `observeNaturalReads`, its configuration and
Nuxt probe setup, the existing fixed-memory 400 boundary, original request and owned
receiver methods, `finishArm`, receive settlement, private sealing and readback. It
uses a controlled CDP/VM transport with no network capability, not Chrome. The
closed-memory `start` supplies fixed resources; request policy is not overridden.

Cases include normal, 401-refusal burst, duplicates, maximum-length paths, overflow,
mixed refusal categories, redacted values, cleanup failure and a failed abort response. Successful abort ACKs require the exact original pending command to be consumed
by its same-session response. Sent replies, error replies and unconfirmed/forged
replies are distinct counts; renderer loading failures are not used as ACK evidence. A competing successful abort may win the original
first-fatal race; the fixture records that result without claiming causality. A sealed
record is not measurement adoption; unexpected failures and cleanup uncertainty do
not pass. Fixed output preserves the first refusal/fatal even if a later fixed-record
write fails. A preexisting output is never overwritten. The child authenticates its
synthetic encrypted file in RAM, prints only fixed counters/labels, and removes its
private directory. It does not expose captured values.

Only CLOSED binding and exact case/options are accepted. GHA/live scope, arbitrary
openers, unknown cases, public Actions environment and unavailable private storage
are rejected before an opener or probe. No code path calls the pinned live tunnel.
No future staging workflow is wired. The same ordinary240 / experiment400 / six-active,
native prefetch and request/egress guards remain intact.

## Privacy and storage

Only URL-standard normalized, encoded pathnames can enter the private payload.
Scheme, host, userinfo, query, fragment, headers, IDs and bodies are not stored.
Malformed or nested encoding, separator ambiguity and secret-looking segments redact
the entire path with a fixed reason. These conservative heuristics do not prove that
an arbitrary human-readable path is semantically nonsensitive; live privacy review
and an approved private delivery mechanism are still prerequisites.

Version-2 authenticated AES-256-GCM / RSA-3072 OAEP-SHA256 envelopes are randomized,
padded and bound to repository/ref/SHA/run/attempt/mode. The existing diagnostic key
is not read, moved or used; tests/closed child generate ephemeral key pairs in RAM.
The local sink requires a canonical owned 0700 directory, owner-only 0600 ciphertext,
no preexisting/symlink destination, no overwrite and bounded matching readback. Actual
Git metadata in ancestors is refused; empty platform `.git` sentinels are not Git
repositories. Public Actions delivery remains denied. No public exporter exists.
Only fixed summaries (at most 8 KiB) are written beside the private ciphertext.

Sealing occurs after the original runner cleanup and receiver settlement. It is
immutable and idempotent; later actual callbacks are a separately reported missing
suffix in the next in-memory summary. The fixed file is a snapshot; later delivery
after the closed entry returns is not observed or retrospectively recovered. It never
claims complete history. The underlying stop and failed-cleanup result are preserved. Crash survival
before seal, machine-level directory durability and destruction of JavaScript strings
are not claimed. Unknown is never equivalent to no rejection or no error.

## Still unverified

No real site was contacted. No actual Chrome was launched. Official Chrome is absent
in the current workspace; the known incompatible Chromium sandbox installation has
not changed and was not retried or bypassed. Another listed managed computer has no
available discovery/execution tools. No software or OS/network/security setting was
changed. The controlled-CDP proof is not an actual-browser or production-run proof.
The private real-data path remains fail-closed. Nuxt 500 diagnosis remains on hold.
