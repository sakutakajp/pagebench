# One-time closed native font/HTTP comparison

This is a new closed-test family on exact published Slot43 commit `2da3a06948fab2c290ff83eebf55197ea834981b` (tree `676983a081f27c97ce459470e60613c032a6d18f`). The previous local-only font HTTP fixture had no Git commit; this candidate preserves the complete historical committed tree and adds files only. It does not edit the current runtime, policy, old workflows, or Slot43 artifacts.

The proposed branch and sole push workflow are `diag/font-http-closed-once-20261126` and `.github/workflows/font-http-closed-once-20261126.yml`. The exact subject is `diagnostic: closed font HTTP comparison once (20261126-an1)`. It is not dispatched or retried. A future create-only push requires separate root review. No push or Actions run was made while preparing this candidate; 27 credits remain.

## What a future approved run can observe

Three cases, in this order, each in its own new authless browser profile:

1. SINGLE: one DOM element uses the fixed font A.
2. SHARED: twelve DOM elements use that same face and URL.
3. DISTINCT: twelve elements use A and twelve use a genuinely different font B and URL.

Two unchanged DejaVu TTF files and their redistribution license are included, with exact hash/length/sfnt verification before the HTTP listener opens. The HTML contains fixed CSS and text, no page JavaScript, preload, prefetch, iframe or external reference. There is no timing benchmark or performance score. The only Runtime evaluations are trusted test code for `document.fonts.ready`, fixed face status and DOM counts.

The known normal-sandbox `openGuarded`/authless profile/cleanup path is reused byte-for-byte, not the legacy FontFixtureGateway policy and not a live measurement entry. No launch flag is relaxed. `CHROME_PATH` is exactly the pre-existing runner's `/opt/google/chrome/chrome`. Version and executable hash are compared across all three cases. Missing/incompatible browser, ownership loss, rejected command, observer loss, proxy fault or unknown cleanup fails closed; later cases are not forced to run.

The **new closed-only** gateway inherits the existing target/session/frame quarantine and command restrictions. Its route table contains exactly the fixed local document and selected font routes, GET only, no query, fragment, credentials, redirect or arbitrary resource types. Font response interception is request-stage only. The browser can continue those fixed requests solely into a reject-only loopback proxy. That proxy supplies fixed response bytes itself and has **no upstream connection, DNS, tunnel or forwarding factory**. It rejects unknown requests, CONNECT and Upgrade locally. It uses the already tested post-flush `destroySoon` disposition for rejected CONNECT, retaining strict socket/client-error failure. The inherited Node no-egress guard separately blocks nonloopback sockets and DNS before any native operation. There is no live factory, API client, provider URL, scoring entry, credential injection or staging navigation in the execution graph.

This is the previously approved closed proxy/browser isolation model, not a new OS firewall claim. Actions checkout/setup/npm use their ordinary dependency retrieval; the browser test itself has no target-site or upstream capability. A local logical URL in the synthetic HTML is not an upstream access.

The server counts actual HTTP receipts independently of DOM and CDP. A shared DOM does not imply either one or several wire requests. Counts are never inferred from `Network.requestId`. Node component controls explicitly send requests; their counts are not native results. The local fixture limits (64 counters/requests, 32 bounded identity rows, at most six font requests active) are closed-test budgets, not modifications to the production 400/6 or other policies.

## Passive notification comparison and stop

Raw request/session/frame/loader/command IDs and URLs exist only in bounded RAM. Fixed output contains Font start/pause/logical-ID counts, a relation enum, binding strength, overflow/coverage, and local HTTP counters. A positive relation requires the observed primary document loader, same primary frame and exact fixed request metadata. Missing, conflicting, overflowed or incomplete observation never supplies an absence conclusion.

The wrapper observes an outgoing original `Fetch.continueRequest` **after** the underlying wire `send` returns, with exact command/session/pause identity in RAM. It separately observes the matching ACK before delegating it to the inherited handler. At a second pause it freezes `BEFORE_SEND`, `PENDING_ACK`, `AFTER_ACK` or `UNKNOWN`. `first_continue` describes the prior pause associated with a duplicate once a duplicate is seen; otherwise it is only the latest observed font continuation state. Network redirect and Fetch redirect indicators are separate fixed labels; no redirect is followed. This is local Node receive order, not a browser internal clock or proof of a physical transaction.

A second pause under an already-bound logical font ID is **aborted**, and the abort ACK is counted before failure. There is no replay allowance, continuation replay, deduplication fix, or change to a live guard. If it occurs, later comparison cases stop. A normal completed three-case run with complete bounded coverage reports `NOT_REPRODUCED_IN_THIS_CLOSED_CONTROL` (「この閉域対照では再現せず」). A duplicate reports `OBSERVED_IN_THIS_CLOSED_CONTROL_ONLY` (「この対照でのみ観測」), with strict failure if the comparison cannot finish. Missing coverage stays `UNKNOWN_NOT_COMPLETED`. None establishes historical Slot43 identity, cause or a safe live acceptance change.

The additional upstream WOFF2 report supplied by root is background only. This candidate deliberately preserves the known TTF controls; it neither executes that report's code nor contacts its targets, and cannot generalize a TTF negative to WOFF2. A reported command-ID excerpt is not treated as the original pause's ACK. Historical relation is always `NOT_IDENTIFIED` / `NOT_ESTABLISHED`.

## Admission and public output

Fresh `fetch-depth: 2`, exact new created push/event/ref/subject/parent/SHA, one commit beyond the parent, tracked clean tree, complete source pins, additions-only list, two exact-version unit receipts and exclusive local consume marker precede the browser. No GitHub API/token is needed. Workflow permission is `contents: read` only, checkout credentials are not persisted, and the browser subprocess receives a small system-only environment.

The exact Node24.19.0 and Node22.19.0 unit entry runs 31 real component/protocol tests each. The unit stage never starts Chrome; browser presence/absence is represented by closed controls. Real TCP requests are loopback-only, with byte/count/403/CONNECT/close checks. Synthetic CDP/protocol and mocked native readback are clearly test controls, not native proofs. Real fixed filesystem readback, malformed/missing/foreign receipt, double-use, failure/no-browser-entry, arbitrary field rejection and no raw output are tested.

Only `font-http-units.json` and `font-http-fixed.json` may be uploaded, retained for one day. Publisher independently reconstructs the exact allowlisted schema and requires current run identity. Missing, malformed or foreign receipt becomes fixed unknown fallback. Forged root success with NOT_RUN cases is rejected. No raw stderr, CDP proof, HTTP body, path, header, font bytes, identifiers, profile path, trace, report or site-derived hashes are uploaded. The fixed success verdict requires all three cases rendered, HTTP receipt evidence, complete bounded notification coverage, unchanged browser, no refusals/faults/overflow and confirmed cleanup. Other states cannot become success.

Local preparation does not run/retry the known sandbox-failing installed Chromium. Actual normal-sandbox Chrome execution, native event order, real shared-font HTTP counts and runner-version behavior remain pending one reviewed closed-only run. No historical attribution or guard repair is claimed.
