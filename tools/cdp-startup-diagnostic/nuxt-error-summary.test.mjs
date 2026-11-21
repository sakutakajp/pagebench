import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nuxtErrorObservationSummary, nuxtErrorPublicSummary } from './nuxt-error-summary.mjs';
import { ERROR_OBSERVATION_LIMITS, safeNuxtErrorEvidence } from './nuxt-error-evidence.mjs';
import { validNuxtErrorBrowserProof } from './nuxt-error-browser-fixture.mjs';
const evidence = () => ({ status: 'OBSERVED_WITH_GAPS', reason: 'SAME_DOCUMENT_NOT_CAUSAL', hooks: { coverage: 'REGISTERED_WITH_PRE_READY_GAP', pre_ready_gap: true, overflow: false, events: [{ source: 'APP_ERROR_HOOK', error_class: 'TYPE_ERROR', status_code: 500, location: 'UNKNOWN' }], dom: { signature: 'STRUCTURAL_CANDIDATE', status_code: 500 } }, cdp: { coverage: 'MAIN_CONTEXT_OBSERVED', pre_context_gap: true, unscoped_error_notifications: 0, console_error_without_error_object: 0, overflow: false, events: [] } });
test('LIVE_VISIBLE_CONTENT preserves independently observed status/type but never a score', () => {
  const r = nuxtErrorObservationSummary({ status: 'measurement_failed', reason: 'LIVE_VISIBLE_CONTENT', documents: 1, http_status: 200, cleanup: 'complete', performance: 88, nuxt_error: evidence() });
  assert.equal(r.reason, 'LIVE_VISIBLE_CONTENT'); assert.equal(r.status, 'observation_rejected'); assert.equal(r.nuxt_error.hooks.events[0].status_code, 500); assert.equal(r.nuxt_error.hooks.events[0].error_class, 'TYPE_ERROR'); assert.equal(r.performance, null); assert.equal(r.lighthouse_report_saved, false); assert.deepEqual(nuxtErrorPublicSummary(r), r);
});
test('missing, stopped and unknown samples cannot become no-error observations', () => {
  for (const value of [null, {}, { status: 'UNKNOWN', reason: 'SCOPE_OR_OBSERVATION_FAILED', hooks: null, cdp: null }]) { const r = nuxtErrorObservationSummary({ nuxt_error: value }); assert.equal(r.nuxt_error.status, 'UNKNOWN'); assert.equal(r.nuxt_error.hooks, null); }
  assert.equal(safeNuxtErrorEvidence({...evidence(),status:'UNKNOWN',reason:'SCOPE_OR_OBSERVATION_FAILED'}).status,'UNKNOWN');
});
test('fixed projection rejects unknown classes, invalid status and scope/conflict claims', () => {
  for (const mutate of [e => e.hooks.events[0].status_code = 200, e => e.hooks.events[0].error_class = 'PRIVATE_MESSAGE', e => e.cdp.coverage = 'PRIVATE_URL']) { const e = evidence(); mutate(e); const safe = safeNuxtErrorEvidence(e); assert.equal(safe.status, 'UNKNOWN'); assert.doesNotMatch(JSON.stringify(safe), /PRIVATE/); }
  const e = evidence(); e.hooks.extra = 'PRIVATE'; e.cdp.events = [{ source: 'CDP_UNCAUGHT', error_class: 'TYPE_ERROR', status_code: null, location: 'UNKNOWN', url: 'PRIVATE' }]; assert.doesNotMatch(JSON.stringify(safeNuxtErrorEvidence(e)), /PRIVATE/);
});
test('public wrapper rejects mixed raw fields and preserves no-adoption role', () => {
  const p = nuxtErrorObservationSummary({ reason: 'LIVE_VISIBLE_CONTENT', nuxt_error: evidence() });
  for (const v of [{ ...p, raw: 'PRIVATE' }, { ...p, performance: 99 }, { ...p, score_adopted: true }]) { const r = nuxtErrorPublicSummary(v); assert.equal(r.status, 'observation_rejected'); assert.equal(r.performance, null); assert.equal(r.score_adopted, false); assert.doesNotMatch(JSON.stringify(r), /PRIVATE/); }
  assert.equal(ERROR_OBSERVATION_LIMITS.additional_cdp_calls, 6); assert.equal(ERROR_OBSERVATION_LIMITS.total_wait_ms, 2250);
});
test('closed five-case admission rejects stale/missing/forged evidence and forwarding', () => {
  const sha = 'a'.repeat(40), fingerprint = 'b'.repeat(64);
  const good = () => ({ kind: 'closed-nuxt-error-proof', status: 'passed', workflow_sha: sha, fingerprint, chrome: 'Chrome/1.2.3.4', live_pages_attempted: 0, outbound_forwarding: 0, json_readback: true, cases: ['normal','app_error','vue_captured','fake_marker','not_ready'].map(name => {
    const e = evidence();
    if (name === 'vue_captured') { e.hooks.events[0].source = 'VUE_ERROR_HOOK'; e.hooks.events[0].status_code = 503; e.hooks.dom.status_code = 503; }
    if (['normal','fake_marker','not_ready'].includes(name)) { e.hooks.events = []; e.hooks.dom = { signature: name === 'fake_marker' ? 'MARKER_ONLY' : 'ABSENT', status_code: null }; }
    if (name === 'not_ready') e.hooks.coverage = 'WAITING_FOR_READY';
    return { case: name, status: 'passed', chrome: 'Chrome/1.2.3.4', observer_cleanup: 'complete', cleanup: 'complete', evidence: safeNuxtErrorEvidence(e), outbound_forwarding: 0 };
  }) });
  assert.equal(validNuxtErrorBrowserProof(good(), sha, fingerprint), true);
  for (const mutate of [p=>p.workflow_sha='c'.repeat(40),p=>p.fingerprint='c'.repeat(64),p=>p.json_readback=false,p=>p.outbound_forwarding=1,p=>p.live_pages_attempted=1,p=>p.cases.pop(),p=>p.cases[1].evidence.hooks.events=[],p=>p.cases[1].evidence.hooks.events[0].status_code=null,p=>p.cases[1].cleanup='failed',p=>p.cases[2].evidence.cdp.events=[{source:'CDP_UNCAUGHT'}],p=>p.cases[0].evidence.hooks.pre_ready_gap=false,p=>p.cases[0].evidence.extra='PRIVATE']) {
    const p = good(); mutate(p); assert.equal(validNuxtErrorBrowserProof(p, sha, fingerprint), false);
  }
});
