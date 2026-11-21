import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createNuxtErrorProbe, safeNuxtErrorProbe, compareErrorSignals, NuxtExceptionJournal, installNuxtErrorEvidence } from './nuxt-error-evidence.mjs';
import { errorFixtureHtml } from './nuxt-error-browser-fixture.mjs';

// Nuxt-compatible named hook signatures/unsubscription; NOT the Nuxt runtime.
function hooks() {
  const callbacks = new Map();
  return { payload: { error: null }, hook(name, fn) { const list = callbacks.get(name) || []; list.push(fn); callbacks.set(name, list); return () => callbacks.set(name, list.filter(v => v !== fn)); },
    async emit(name, error, instance, info) { for (const fn of [...callbacks.get(name) || []]) await fn(error, instance, info); },
    count() { return [...callbacks.values()].reduce((n, a) => n + a.length, 0); } };
}
function fixture({ ready = true, shell = 'none', code = '500' } = {}) {
  const app = hooks(), root = {}, timers = new Map(); let timerId = 0;
  if (ready) root.__vue_app__ = { config: { globalProperties: { $nuxt: app } } };
  const text = { nodeType: 3, length: code.length, data: code };
  const main = { querySelectorAll(s) { return s === ':scope > div > p' ? shell === 'full' ? [{ childNodes: [text] }] : [] : s === 'h1' || s === 'a[href="/"]' ? [{}] : []; } };
  const env = { document: { getElementById() { return root; }, querySelectorAll() { return shell === 'none' ? [] : [{ closest() { return main; } }]; } },
    setInterval(fn) { timers.set(++timerId, fn); return timerId; }, clearInterval(id) { timers.delete(id); } };
  return { env, app, root, timers, text, tick(n = 1) { for (let i = 0; i < n; i++) for (const fn of [...timers.values()]) fn(); }, ready() { root.__vue_app__ = { config: { globalProperties: { $nuxt: app } } }; } };
}
const error = (statusCode = 500) => Object.assign(new TypeError('SYNTHETIC_PRIVATE_MESSAGE'), { statusCode });

test('normal compatible app is only no recorded signal WITH pre-ready gap', () => {
  const f = fixture(), p = createNuxtErrorProbe(f.env), h = safeNuxtErrorProbe(p.snapshot());
  assert.equal(h.coverage, 'REGISTERED_WITH_PRE_READY_GAP'); assert.equal(h.pre_ready_gap, true); assert.equal(h.events.length, 0);
  assert.equal(compareErrorSignals(h, { events: [] }).signal, 'NO_RECORDED_SIGNAL_WITH_GAPS'); p.dispose(); assert.equal(f.app.count(), 0); assert.equal(f.timers.size, 0);
});
test('one app:error projects actual numeric app status and exception class without message/stack', async () => {
  const f = fixture({ shell: 'full' }), p = createNuxtErrorProbe(f.env), e = error();
  for (const key of ['message', 'stack', 'url', 'cause', 'data']) Object.defineProperty(e, key, { get() { assert.fail('private property read'); } });
  await f.app.emit('app:error', e); const h = safeNuxtErrorProbe(p.snapshot());
  assert.deepEqual(h.events, [{ source: 'APP_ERROR_HOOK', error_class: 'TYPE_ERROR', status_code: 500, location: 'UNKNOWN' }]); assert.equal(compareErrorSignals(h, { events: [] }).status_relation, 'MATCH');
  assert.doesNotMatch(JSON.stringify(h), /SYNTHETIC_PRIVATE|message|stack|url|cause/); p.dispose();
});
test('Vue-captured error can be recorded with zero CDP uncaught events', async () => {
  const f = fixture(), p = createNuxtErrorProbe(f.env); await f.app.emit('vue:error', error(503), { private: 'DO_NOT_READ' }, 'PRIVATE_COMPONENT_INFO');
  const h = safeNuxtErrorProbe(p.snapshot()); assert.equal(h.events[0].source, 'VUE_ERROR_HOOK'); assert.equal(h.events[0].status_code, 503);
  assert.equal(compareErrorSignals(h, { events: [] }).status_relation, 'HOOK_STATUS_ONLY'); assert.doesNotMatch(JSON.stringify(h), /DO_NOT_READ|PRIVATE_COMPONENT/); p.dispose();
});
test('a fake image marker alone does not create a Nuxt status or exception', () => {
  const f = fixture({ shell: 'marker' }), p = createNuxtErrorProbe(f.env), h = safeNuxtErrorProbe(p.snapshot()); assert.equal(h.dom.signature, 'MARKER_ONLY'); assert.equal(h.dom.status_code, null); assert.deepEqual(h.events, []); p.dispose();
});
test('DOM candidate is independent app-reported status, not a server error claim', () => {
  const f = fixture({ shell: 'full', code: ' 503 ' }), p = createNuxtErrorProbe(f.env), h = safeNuxtErrorProbe(p.snapshot()); assert.equal(h.dom.status_code, 503); assert.equal(compareErrorSignals(h, { events: [] }).signal, 'DOM_CANDIDATE_ONLY'); p.dispose();
});
test('non-numeric or oversize DOM status is unavailable without heading read', () => {
  for (const code of ['private page text', '500 and details', '500'.repeat(100)]) { const f = fixture({ shell: 'full', code }), p = createNuxtErrorProbe(f.env); assert.equal(p.snapshot().dom.signature, 'STATUS_UNAVAILABLE'); p.dispose(); }
});
test('before-ready error is classified persisted payload, not recovered hook timing', () => {
  const f = fixture({ ready: false }), p = createNuxtErrorProbe(f.env); f.app.payload.error = error(502); f.ready(); f.tick(); const s = p.snapshot(); assert.equal(s.events[0].source, 'PAYLOAD_AT_READY'); assert.equal(s.pre_ready_gap, true); p.dispose();
});
test('an early nonpersistent hook is honestly missed until root app pointer exists', async () => {
  const f = fixture({ ready: false }), p = createNuxtErrorProbe(f.env); await f.app.emit('app:error', error()); f.ready(); f.tick(); assert.equal(p.snapshot().events.length, 0); assert.equal(p.snapshot().pre_ready_gap, true); p.dispose();
});
test('ready never found, owner change and callback overflow stay explicit', async () => {
  const f = fixture({ ready: false }), p = createNuxtErrorProbe(f.env); f.tick(251); assert.equal(p.snapshot().coverage, 'READY_NOT_FOUND_WITHIN_BUDGET'); p.dispose();
  const q = fixture(), r = createNuxtErrorProbe(q.env); q.tick(251); q.root.__vue_app__.config.globalProperties.$nuxt = hooks(); assert.equal(r.snapshot().coverage, 'UNOBSERVABLE'); r.dispose();
  const a = fixture(), b = createNuxtErrorProbe(a.env); for (let i = 0; i < 20; i++) await a.app.emit('app:error', error()); assert.equal(b.snapshot().events.length, 16); assert.equal(b.snapshot().overflow, true); b.dispose();
});
test('unknown names, getter statuses and mixed fields cannot leak or make known locations', async () => {
  const f = fixture(), p = createNuxtErrorProbe(f.env), e = { name: 'UNTRUSTED_CLASS', location: 'PRIVATE_PATH', message: 'PRIVATE_MESSAGE' };
  Object.defineProperty(e, 'statusCode', { get() { assert.fail(); } }); await f.app.emit('app:error', e); const s = p.snapshot(); s.events[0].extra = 'PRIVATE_VALUE';
  const safe = safeNuxtErrorProbe(s); assert.equal(safe.events[0].error_class, 'OTHER_OR_UNKNOWN'); assert.equal(safe.events[0].status_code, null); assert.doesNotMatch(JSON.stringify(safe), /UNTRUSTED|PRIVATE/); p.dispose();
});
test('numeric hook/DOM disagreement is CONFLICT, never overwritten', async () => {
  const f = fixture({ shell: 'full', code: '503' }), p = createNuxtErrorProbe(f.env); await f.app.emit('app:error', error(500)); assert.equal(compareErrorSignals(p.snapshot(), { events: [] }).status_relation, 'CONFLICT'); p.dispose();
});
const nav = (url = 'https://fixture.invalid/only', loaderId = 'L') => ({ method: 'Page.frameNavigated', params: { frame: { id: 'F', url, loaderId } } });
const context = id => ({ method: 'Runtime.executionContextCreated', params: { context: { id, auxData: { frameId: 'F', isDefault: true } } } });
const thrown = id => ({ method: 'Runtime.exceptionThrown', params: { exceptionDetails: { executionContextId: id, exception: { className: 'TypeError' } } } });
test('accepted CDP main-context exception has fixed type only; no payload fields read', () => {
  const j = new NuxtExceptionJournal('F'); j.observe(nav(), 'https://fixture.invalid/only'); j.observe(context(4), 'https://fixture.invalid/only'); const m = thrown(4);
  for (const key of ['text', 'url', 'stackTrace']) Object.defineProperty(m.params.exceptionDetails, key, { get() { assert.fail(); } });
  Object.defineProperty(m.params.exceptionDetails.exception, 'description', { get() { assert.fail(); } }); j.observe(m, 'https://fixture.invalid/only'); assert.equal(j.snapshot().events[0].error_class, 'TYPE_ERROR');
});
test('old/isolated context, unknown ordering, reload, and cleared context are not attributed', () => {
  const t = 'https://fixture.invalid/only', j = new NuxtExceptionJournal('F'); j.observe(context(4), t); j.observe(thrown(4), t); assert.equal(j.snapshot().events.length, 0);
  j.observe(nav(), t); j.observe(context(4), t); j.observe(thrown(5), t); assert.equal(j.snapshot().events.length, 0);
  j.observe({ method: 'Runtime.executionContextsCleared' }, t); j.observe(thrown(4), t); assert.equal(j.snapshot().events.length, 0);
  j.observe(nav(t, 'NEXT'), t); assert.equal(j.snapshot().coverage, 'SCOPE_LOST');
});
test('pre-target about:blank preparation is unscoped, while a later navigation loses scope', () => {
  const t = 'https://fixture.invalid/only', j = new NuxtExceptionJournal('F'); j.observe(nav('about:blank','BLANK'),t); j.observe(context(4),t); j.observe(thrown(4),t);
  assert.equal(j.snapshot().coverage,'CONTEXT_NOT_ESTABLISHED'); assert.equal(j.snapshot().events.length,0);
  j.observe(nav(),t); j.observe(context(5),t); j.observe(thrown(5),t); assert.equal(j.snapshot().events.length,1);
  j.observe(nav('about:blank','AFTER'),t); assert.equal(j.snapshot().coverage,'SCOPE_LOST');
});
test('early console typed error metadata is independent of app hook and never reads console text', () => {
  const t = 'https://fixture.invalid/only', j = new NuxtExceptionJournal('F'); j.observe(nav(), t); j.observe(context(4), t);
  const text = { type: 'string' }, object = { type: 'object', subtype: 'error', className: 'TypeError' };
  Object.defineProperty(text, 'value', { get() { assert.fail('console text read'); } });
  for (const key of ['description', 'preview', 'objectId']) Object.defineProperty(object, key, { get() { assert.fail('remote payload read'); } });
  j.observe({ method: 'Runtime.consoleAPICalled', params: { type: 'error', executionContextId: 4, args: [text, object] } }, t);
  assert.deepEqual(j.snapshot().events, [{ source: 'CDP_CONSOLE_ERROR_OBJECT', error_class: 'TYPE_ERROR', status_code: null, location: 'UNKNOWN' }]);
});
test('text-only console, too many arguments, unscoped notification and competing context are explicit', () => {
  const t = 'https://fixture.invalid/only', j = new NuxtExceptionJournal('F'); j.observe(thrown(1), t); j.observe(nav(), t); j.observe(context(4), t);
  j.observe({ method: 'Runtime.consoleAPICalled', params: { type: 'error', executionContextId: 4, args: [{ type: 'string', value: 'PRIVATE' }] } }, t);
  assert.equal(j.snapshot().console_error_without_error_object, 1); assert.equal(j.snapshot().unscoped_error_notifications, 1); assert.equal(j.snapshot().events.length, 0);
  j.observe({ method: 'Runtime.consoleAPICalled', params: { type: 'error', executionContextId: 4, args: Array(9).fill({ type: 'string' }) } }, t); assert.equal(j.snapshot().overflow, true);
  j.observe(context(5), t); assert.equal(j.snapshot().coverage, 'SCOPE_LOST');
});

function driver(options) {
  const f = fixture(options), sandbox = vm.createContext({ ...f.env }); let added, removed = 0, calls = 0, evals = 0;
  const g = { primary: 'P', createdPage: 'T', sessions: new Map([['P', { ready: true, frame: 'F' }]]), stats: { fatal: null }, stopping: false, forwarded: 0,
    forward() { this.forwarded++; }, async call(method, params) { calls++; if (method === 'Page.addScriptToEvaluateOnNewDocument') { added = params.source; return { identifier: 'LOCAL_SCRIPT' }; } if (method === 'Page.removeScriptToEvaluateOnNewDocument') { removed++; return {}; } if (method === 'Runtime.evaluate') { evals++; return { result: { value: vm.runInContext(params.expression, sandbox) } }; } assert.equal(method, 'Page.getFrameTree'); return { frameTree: { frame: { id: 'F', loaderId: 'L', url: 'https://fixture.invalid/only' } } }; } };
  const page = { async evaluateOnNewDocument(source) { added = source; return { identifier: 'LOCAL_SCRIPT' }; }, async evaluate(fn, ...args) { evals++; sandbox.__args = args; try { return vm.runInContext(`(${fn.toString()})(...__args)`, sandbox); } finally { delete sandbox.__args; } }, async removeScriptToEvaluateOnNewDocument(id) { assert.equal(id, 'LOCAL_SCRIPT'); removed++; } };
  return { ...f, ctx: { gateway: g, page }, boot() { vm.runInContext(added, sandbox); }, event(m) { g.forward({ ...m, sessionId: 'P' }); }, counts: () => ({ calls, evals, removed }), sandbox };
}
test('exact installation/collection entry, pre-navigation bootstrap, same document and disposal', async () => {
  const d = driver(), observer = await installNuxtErrorEvidence(d.ctx, 'https://fixture.invalid/only'); d.boot(); d.event(nav()); d.event(context(4)); await d.app.emit('app:error', error(500));
  const result = await observer.collect(); assert.equal(result.status, 'OBSERVED_WITH_GAPS'); assert.equal(result.hooks.events[0].status_code, 500); assert.equal(result.cdp.events.length, 0); assert.equal(result.cause, 'NOT_ATTRIBUTED');
  await observer.dispose(); assert.equal(d.counts().removed, 1); assert.equal(d.app.count(), 0); assert.equal(d.timers.size, 0);
  assert.equal(d.counts().calls, 6);
});
test('same entry keeps app hook and CDP uncaught sources independent', async () => {
  const d = driver(), o = await installNuxtErrorEvidence(d.ctx, 'https://fixture.invalid/only'); d.boot(); d.event(nav()); d.event(context(4)); await d.app.emit('vue:error', error(503)); d.event(thrown(4));
  const r = await o.collect(); assert.equal(r.hooks.events[0].source, 'VUE_ERROR_HOOK'); assert.equal(r.cdp.events[0].source, 'CDP_UNCAUGHT'); await o.dispose();
});
test('stopped guard sends no observation or cleanup protocol operations', async () => {
  const d = driver(), o = await installNuxtErrorEvidence(d.ctx, 'https://fixture.invalid/only'); d.boot(); d.event(nav()); d.event(context(4)); d.ctx.gateway.stopping = true; const before = d.counts();
  assert.equal((await o.collect()).status, 'UNKNOWN'); await o.dispose(); assert.deepEqual(d.counts(), before);
});
test('wrong session, frame scope change and observer ownership conflict fail to UNKNOWN', async () => {
  for (const mode of ['wrong_session', 'frame_changed', 'owner_conflict']) {
    const d = driver(), o = await installNuxtErrorEvidence(d.ctx, 'https://fixture.invalid/only'); d.boot();
    if (mode === 'wrong_session') d.ctx.gateway.forward({ ...nav(), sessionId: 'OTHER' }); else { d.event(nav()); d.event(context(4)); }
    if (mode === 'frame_changed') d.ctx.gateway.sessions.set('P', { ready: true, frame: 'F' });
    if (mode === 'owner_conflict') d.ctx.gateway.forward = () => {};
    assert.equal((await o.collect()).status, 'UNKNOWN'); await o.dispose();
  }
});
test('deadline prevents subsequent frame calls and never changes the existing guard', async () => {
  const d = driver(), o = await installNuxtErrorEvidence(d.ctx, 'https://fixture.invalid/only'); d.boot(); d.event(nav()); d.event(context(4)); let resolve;
  d.ctx.gateway.call = () => new Promise(r => { resolve = r; }); const r = await o.collect(); assert.equal(r.reason, 'OBSERVATION_TIMEOUT');
  resolve({ frameTree: { frame: { id: 'F', loaderId: 'L', url: 'https://fixture.invalid/only' } } }); await new Promise(r => setImmediate(r)); assert.equal(d.counts().evals, 0); assert.equal(d.ctx.gateway.stats.fatal, null); await o.dispose();
});
test('malformed fixed sample is not accepted and arbitrary text never gets projected', () => {
  const f = fixture(), p = createNuxtErrorProbe(f.env), s = p.snapshot(); s.events = [{ source: 'PRIVATE_INPUT', error_class: 'TYPE_ERROR', status_code: 500, location: 'UNKNOWN' }]; assert.equal(safeNuxtErrorProbe(s), null); p.dispose();
});
test('collected metadata is a copy; later callbacks and disposal cannot rewrite evidence', async () => {
  const d = driver(), o = await installNuxtErrorEvidence(d.ctx, 'https://fixture.invalid/only'); d.boot(); d.event(nav()); d.event(context(4));
  await d.app.emit('app:error', error(500)); const before = await o.collect(); const text = JSON.stringify(before);
  await d.app.emit('vue:error', error(503)); d.event(thrown(4)); await o.dispose(); await d.app.emit('app:error', error(504));
  assert.equal(JSON.stringify(before), text); assert.equal(d.app.count(), 0);
});
test('collection is single-use and a context conflict during evaluation is rejected', async () => {
  const d = driver(), o = await installNuxtErrorEvidence(d.ctx, 'https://fixture.invalid/only'); d.boot(); d.event(nav()); d.event(context(4));
  const call = d.ctx.gateway.call; d.ctx.gateway.call = async (method, ...args) => { const r = await call(method, ...args); if (method === 'Runtime.evaluate') d.event(context(5)); return r; };
  assert.equal((await o.collect()).status, 'UNKNOWN'); const before = d.counts(); assert.equal((await o.collect()).reason, 'ALREADY_COLLECTED'); assert.deepEqual(d.counts(), before); await o.dispose();
});
test('the actual browser-fixture app scripts reach the same pre-navigation observer in VM', async () => {
  for (const mode of ['normal', 'app_error', 'vue_captured', 'fake_marker', 'not_ready']) {
    const d = driver({ ready: false }), o = await installNuxtErrorEvidence(d.ctx, 'https://fixture.invalid/only');
    const later = []; d.sandbox.setTimeout = fn => later.push(fn); d.sandbox.window = d.sandbox;
    d.boot(); d.event(nav()); d.event(context(4));
    const script = errorFixtureHtml(mode).match(/<script>([\s\S]*)<\/script>/)[1]; vm.runInContext(script, d.sandbox); d.tick(); for (const fn of later) fn();
    const r = await o.collect(); assert.equal(r.status, 'OBSERVED_WITH_GAPS');
    assert.equal(r.hooks.events.length, ['app_error', 'vue_captured'].includes(mode) ? 1 : 0);
    if (mode === 'app_error') assert.equal(r.hooks.events[0].source, 'APP_ERROR_HOOK');
    if (mode === 'vue_captured') assert.equal(r.hooks.events[0].source, 'VUE_ERROR_HOOK');
    if (mode === 'not_ready') assert.equal(r.hooks.coverage, 'WAITING_FOR_READY');
    await o.dispose();
  }
});
