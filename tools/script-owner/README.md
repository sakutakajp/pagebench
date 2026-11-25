# First refused Script metadata — unpublished diagnostic successor

Direct parent: `1b18780a79c73721e59585ebfeb3369c9ae74c0f` (Slot24).
Proposed ref: `refs/heads/diag/script-owner-ja-once-20261125`.
Workflow: `staging-script-owner-ja-once-20261125.yml`; checkout depth27.
Every parent file, old workflow, transport, request policy, scoring implementation,
Lighthouse profile and hard guard is unchanged. The new gateway copy is byte
identical; its relative admission import binds only the new one-use identity.

## New observation, not a new benchmark

The new wrapper observes the existing `boundary.passive` receive path, after the
original handler, and the existing synchronous first `boundary.reject`. It never
issues a CDP command, enables a domain, changes a request or its verdict, waits for
metadata, or contacts a rejected host. Original requests/abort promises are returned
unchanged. The fixed snapshot is captured in RAM at refusal; its file callback runs
only after the original request promise settles (abort ACK or failure), not before
abort. Writer failure cannot bypass the original refusal and suppresses adoption.

Only the first refusal can select a snapshot. A non-Script first refusal is labeled
as such. A Script needs an already-received Network start matching the exact current
open wire, released target, primary non-auxiliary session/state, target frame,
current single-document loader, exact configured document URL, Network request ID,
request URL, method and Script type. Binding loss, prior IDs, duplicate start,
redirect, reused Fetch/network ID, missing event, malformed metadata or overflow
produce UNKNOWN, never a guessed initiator. Metadata arriving after selection is
not used to retrofit the result. Target/loader/session reuse cannot rebind a lost
scope. Pre-target primary IDs are remembered only to reject ambiguous reuse; their
metadata can never become attribution evidence.

The result contains only fixed enums and a bounded row count. Initiator labels are
PARSER/SCRIPT/PRELOAD/OTHER/UNKNOWN. The optional owner label considers only the
parser URL or the first frame of a bounded64-frame stack, then immediately discards
that input. EXACT_DOCUMENT means exact `/ja/`; APPROVED_NUXT_BUNDLE_FAMILY means a
query/fragment/credential-free JS URL satisfying the existing staging static rule.
Neither means a proven source file or causal application owner. Known public origin
labels mean origin equality only, not a particular resource, library or path.

Public declarations were independently verified at repository revision
`aa57e2280732fc016ffe347a4714715138f47998`:

- GTM: `frontend/hirameki-dev/nuxt.config.ts:89–106` (production-only).
- ADSENSE: `frontend/hirameki-dev/plugins/ad.client.ts:8–26` (production-only).
- TURNSTILE: `frontend/hirameki-dev/plugins/preview-newsletter.ts:9–18`
  (preview exclusion, not proof of an active loader).
- TWITTER: `frontend/hirameki-dev/components/custom/x/TweetButton.vue:18–23`
  (onMounted, not proof the home page mounts it).

No sealed host was decoded or compared. Slot24's host has not been retained here;
there is no no-run attribution from its old fixed predicate mask. These constants
are not an allowlist extension. Any other origin remains OTHER_OR_UNKNOWN and is
still denied. There is no source/causal/deployment-identity conclusion from a match.

## Bounds and absence semantics

There are at most512 RAM start rows,512 pre-target IDs and512 Fetch IDs. URLs are
bounded8192 characters and identifiers256; no eviction or hashing permits a later
ambiguous ID to pass. This is a finite diagnostic budget, not a promise that all
browser starts fit the400 accepted-request cap. Overflow disables attribution.
The snapshot clears all maps. No URL, hostname, path, query, fragment, credentials,
header, stack, identifier, snippet or secret-derived hash is written or published.
The fixed owner record is at most4096 bytes, at most4 writes; an identical final
snapshot is idempotent. Missing/late/partial evidence is UNKNOWN, not absence.

## Gates and unchanged measurement

All original same-SHA Node and11 real Chrome controls are retained. Two NEW native
closed controls use the exact original `measure()` bridge and memory-only fixture:
a parser-inserted GTM-origin Script and an application timer-inserted Twitter-origin
Script. Both must be refused with exact fixture identity, abort1/ACK1/continue0,
strict prior-Network attribution, exact document owner, physical process/profile/
wire/proxy closure and zero upstream sockets. They never load those public hosts.
If the browser delivers Network too late or lacks a required scope field, the
native gate fails with a fixed UNKNOWN reason and live remains skipped. The actual
browser event order is NOT established by the local controlled tests.

The consuming live admission repeats all original source/event/unit/API/closed/
binary/one-use gates and requires both new controls. Only then may the same job
make the existing single staging `/ja/` navigation,400 total/six active, natural
allowed prefetch, two existing HTTPS domains, unchanged paths/credentials/methods/
response/TLS/sandbox/egress/refusal/cleanup. No explicit Script is added to live.
The parent standalone simulated Lighthouse300ms/800kbps/CPU6 method is reused,
never the locked AB arm. Rejection/incomplete measurement cannot produce a score.
The RAM-only bounded genuine LHR roundtrip, resource/font/trace/seal/readback and
late-failure invalidation remain original requirements. No raw report file or D1.

## Local proof versus remaining native prerequisite

Tests exercise actual wrappers, unchanged measure, abort-before-writer ordering,
producer/admission/publisher contracts, real Node reject-only loopback TCP,
process cleanup, fixed filesystem permissions/readback, actual CLI early failure
and import behavior. API/CDP/LHR are controlled inputs, never current site or real
Chrome observations. The model fixtures are unreachable from the runtime entry.
No new local sandbox-compatible browser environment was available; the known
sandbox failure was not retried or bypassed. New native proof is still pending.

The expected useful result is either a safely bound fixed origin/initiator
category, or a precise UNKNOWN binding predicate. It cannot identify a host not in
this public constant set, a code location, deployment or Nuxt500 cause. It cannot
make the existing forbidden dependency permissible. No run/push is performed or
authorized by this candidate package. Sixteen additional credits remain, none reserved.
