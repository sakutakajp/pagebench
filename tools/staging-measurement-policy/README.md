# Persistent staging measurement policy (prepared, not activated)

This is configuration and a library integration seam, not a new authorization or executable live entry. Planned durable ref: `refs/heads/config/staging-measurement-policy-v1`. No workflow is added or changed. Publishing this ref alone must match zero push workflows and zero followers. Nothing is currently pushed or activated.

## Current source of truth and status

Local tracked configuration and documentation contain no central operational host registry for the 400-request route. The documented default-branch `staging-lighthouse-once` entry uses the historical 120-request engine; it is intentionally untouched. Renderer `asset_origins` is unrelated and untouched. Published 400 diagnostic entries have exact historical ref/subject/parent/source and process-local admission bindings; none is silently repointed. No remote settings, variables, secrets or new service state were inspected to claim that they do not exist.

`config/staging-measurement-policy.json` is the proposed versioned staging registration. Explicit ID: `staging-ja-cloudflare-script-400-v1`. It retains the two prior origins and adds exactly HTTPS `static.cloudflareinsights.com`, standard port, Script GET/HEAD only. Existing static path/query/credential/fragment and Content contracts remain unchanged. In particular the existing forbidden beacon path rule still rejects `/beacon.min.js`; host registration is not a path exception. No actual observed path is inferred. The currently supported target remains exact staging `/ja/`; future routes are not authorized. Ordinary staging limit 240 remains unchanged; this selected diagnostic uses 400/6 and one document.

Prepared local configuration is NOT_APPLIED to existing operational entries. A later config-only publication would persist selectable code, not activate a measurement. The next separately reviewed and approved single-use entry must explicitly select this version and use the binding below, with its original full source/event/unit/native/JIT/one-use predicates. There is no safe command that reuses an expired historical LIVE grant or makes the old 120 entry consume this policy. This identity binding is the remaining operational integration step.

## Explicit selection and integration

Description only, no DNS/browser/API or permission acquisition:

```
node tools/staging-measurement-policy/select.mjs --policy staging-ja-cloudflare-script-400-v1
```

The library `measureSelected({policyId, approvedGatewayFactory, open, ...measurementOptions})` requires a trusted, pinned caller's existing one-use approved 400 gateway factory and protected browser opener. The factory runs before proxy/DNS/browser creation. Missing or rejected factory/opener cannot begin traffic. **A supplied callback is not itself evidence of authorization**: the future caller must actually execute unchanged admission, retain its process-local consuming grant and include this selected code in exact source pins. This module intentionally does not supply, generalize or bypass that admission. There is no token/API fallback or credential requirement in this configuration layer.

After that factory returns, `forApprovedGateway` requires the existing fresh NaturalReadBoundary, RequestMeter400 and census, replacing only the classification-aware check with the verified Slot34 core; original receive/abort/queue/cleanup methods remain inherited. CDP classification and pinned DNS/CONNECT derive from the same validated registration. Proxy still requires the released ready exact target guarded session before enable. Proxy host capability does not independently authorize a resource; CDP enforces Script and GET/HEAD. Normal TLS and sandbox are the caller's unchanged responsibility. `measureSelected` runs the existing standalone simulated method, not locked A/B; no score after refusal/incomplete proof and no raw report persistence. No private store, token, Cloudflare change or D1 is added.

## Apply/review sequence (not executed)

1. Review exact config-only commit and hashes; publish only its planned durable config ref if authorized. No workflow should run. Do not merge into main or alter old entries.
2. For the next explicitly authorized measurement, prepare a separate exact one-use entry on that ref's commit. Hardcode the policy ID, pin these sources, call the original approved gateway factory through this library, and preserve all same-SHA/run/binary closed controls and JIT. Review that future caller's gate binding; do not accept an arbitrary callback as authorization.
3. Only that separately approved entry may initiate one guarded staging `/ja/` observation. Until it exists and is admitted, runtime registration is NOT_APPLIED. No additional Actions/API token reapproval is requested by this preparation.

## Verification and limitations

Local Node22.19.0 and Node24.19.0 strict tests exercise description/selection, actual selected measurement component, controlled CDP/LHR, real loopback proxy, real process/profile cleanup, all three scoped DNS inputs without remote DNS, Script positive, Image/beacon/other-host negatives, refusal ACK, no score on failure, 400/401 and no double census count. Controlled factories are test doubles, not native-browser or real admission proofs. Exact classifier/static predicate and boundary bodies match published Slot34; pinned proxy body matches existing verified transport. Synthetic score 50 is test input, not a site score.

Published Slot34 native Chrome158 five-case evidence is inherited implementation evidence, not a local Chrome run for this new wrapper. Official compatible local Chrome remains unavailable; no known failing browser setup was repeated or security relaxed. No live DNS, site/Cloudflare requests, GitHub API, push, GHA, permission changes or key operations were performed. Six Actions remain, none reserved.
