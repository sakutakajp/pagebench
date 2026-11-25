# Closed synthetic Chrome + genuine filesystem proof

This is a separate Ubuntu closed-only successor of published `7ca8895…`.
The unpublished Linux local-preflight `707d32a…` and the stopped Mac worktree
are not included. Existing workflows, real-data constructors, allowlists,
guards, launch flags, proxy and cleanup code are unchanged.

The workflow has one exact new branch/path/title/parent and attempt1 admission,
new-ref-only/non-force event checks, same-SHA units, sole-run API check,
read-only permission, no retained checkout credentials and no live step.
The only browser URL is the previous constant loopback fixture. The same
normal-sandbox launcher, actual request handler and reject-only proxy are used.
The old seven RAM-store/static-projector Chrome cases are not run again.

## What is genuine and what is fixture-specific

The byte-pinned original journal, **normal original schema/projector** and
original cryptography are used. The isolated journal module redirects only
its private-store import to an explicitly synthetic filesystem store. This
is a separate implementation with real Node filesystem calls, not a RAM sink
and not the production private-delivery constructor. The latter still rejects
Actions; environment markers are never cleared to make it usable.

The dedicated store accepts only a complete authenticated fixed fabricated
payload: exactly401 known paths,406 callbacks, the exact duplicate counts,
GET/Fetch-or-XHR/direct-abort/bound-before-stop metadata and no losses or
unknown rows. It rejects foreign scopes, real-data/GHA envelope mode and all
unrecognized values before any ciphertext write. Keys are generated per case
in RAM; neither keys nor ciphertext nor paths are uploaded. The ordinary
production journal rejects this store's brand.

The store uses a canonical OS temporary directory outside Git, an owner-only
0700 directory, actual0600 files, bounded/no-follow reads, exclusive creation,
fsync, link-based no-overwrite publication and exact ciphertext readback. The
existing RSA3072/OAEP-SHA256 + AES256-GCM output is authenticated with the
generated fixture key and validated against the known fixed payload. All
files and the containing directory are removed and absence checked.

Three fresh-profile Chrome cases each render JS and make401 distinct fixed
rejected requests plus five duplicates. They then confirm original receiver,
guard, proxy and process/profile cleanup before sealing/readback:

* `duplicates`: actual file save and authenticated readback must succeed.
* `write_conflict`: an actual preexisting file prevents publication; capture
  must remain failed/unadopted. This expected negative is not a saved report.
* `readback_change`: changing an actual encrypted file must fail verification
  and remain unadopted, including a later finalization attempt.

Each case must confirm file removal and physical browser/proxy/profile cleanup.
Unsafe or unconfirmed cleanup stops the group. Unknown failures never pass.
The published artifact has a strict fixed schema: version/SHA/run identity,
phases, booleans and bounded counters only. No paths, envelope, bytes, private
key, raw child output, errors or page content can be in that schema.

## Local and future CI verification

Run `node --unhandled-rejections=strict --test tools/rejected-paths-filesystem/test.mjs`
with existing Node22.19.0 and24.19.0. These are controlled-CDP/disk component
tests and privacy/negative contracts, explicitly not real Chrome results.
`browser.mjs --local-prerequisites` is a fixed read-only check; it cannot
authorize or start a live/browser run. The actual entry has no URL/key/store
argument and calls exact admission immediately before Chrome.

The exact real-browser cases remain unexecuted locally because the approved
standard Chrome path is absent. Only the reviewed future one-job Actions run
can supply that result; synthetic tests do not substitute for it. No push,
Actions, staging request, score/report, D1 or actual user data is part of
candidate preparation. No change to ordinary240/experimental400/six-active
or natural-prefetch policy is made; this is a separate memory-response fixture.
