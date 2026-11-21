import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createNuxtErrorProbe, safeNuxtErrorProbe, safePayloadCause, safeNuxtErrorEvidence } from './nuxt-error-evidence.mjs';
import { nuxtErrorObservationSummary, nuxtErrorPublicSummary } from './nuxt-error-summary.mjs';
const TITLE = "Cannot read properties of null (reading 'title')";
function wrapper(cause, present = true) {
  const value = Object.assign(new Error('synthetic wrapper'), { statusCode: 500, __nuxt_error: true });
  if (present) Object.defineProperty(value, 'cause', { value: cause, configurable: true });
  return value;
}
function probe(error, ready = true) {
  const app = { payload: { error }, hook() { return () => {}; } }, root = {};
  const attach = () => { root.__vue_app__ = { config: { globalProperties: { $nuxt: app } } }; };
  if (ready) attach();
  let tick;
  const env = { document: { getElementById: () => root, querySelectorAll: () => [] }, setInterval(fn) { tick = fn; return 1; }, clearInterval() {} };
  const observer = createNuxtErrorProbe(env);
  return { observer, ready() { attach(); tick(); }, snapshot() { return safeNuxtErrorProbe(observer.snapshot()); }, dispose() { observer.dispose(); } };
}
function detail(error) { const p = probe(error); const s = p.snapshot(); p.dispose(); return s.events[0].cause_detail; }

test('native null-title TypeError becomes a fixed shape, never a source location', () => {
  const error = wrapper(new TypeError(TITLE)), p = probe(error), s = p.snapshot(), d = s.events[0].cause_detail;
  assert.equal(s.events[0].status_code, 500); assert.equal(s.events[0].error_class, 'NUXT_OR_H3_ERROR');
  assert.deepEqual(d, { state: 'OWN_NATIVE_CAUSE', error_class: 'TYPE_ERROR', class_evidence: 'DIRECT_CAPTURED_INTRINSIC_PROTOTYPE', message_shape: 'NULL_TITLE_READ', message_evidence: 'OWN_DATA_STRING', attribution: 'SHAPE_ONLY_NOT_SOURCE' });
  assert.equal(s.events[0].location, 'UNKNOWN'); assert(!JSON.stringify(s).includes(TITLE)); p.dispose();
});
test('an actual native property-read error and a manually constructed identical TypeError are only shape matches', () => {
  let native; try { const value = null; value.title; } catch (e) { native = e; }
  assert.equal(detail(wrapper(native)).message_shape, 'NULL_TITLE_READ');
  assert.deepEqual(detail(wrapper(native)), detail(wrapper(new TypeError(TITLE))));
  assert.equal(detail(wrapper(native)).attribution, 'SHAPE_ONLY_NOT_SOURCE');
});
test('strict message variants, other property, other class and forged names do not match', () => {
  for (const text of [TITLE+' ', ' '+TITLE, TITLE+'\n', TITLE+' PRIVATE', "Cannot read properties of undefined (reading 'title')", "Cannot read properties of null (reading 'name')", TITLE.toLowerCase()]) assert.equal(detail(wrapper(new TypeError(text))).message_shape, 'OTHER_OR_UNKNOWN');
  for (const cause of [new Error(TITLE), new RangeError(TITLE), Object.assign(new RangeError(TITLE), { name: 'TypeError' })]) assert.equal(detail(wrapper(cause)).message_shape, 'OTHER_OR_UNKNOWN');
  assert.equal(detail(wrapper(Object.assign(new RangeError(TITLE), { name: 'TypeError' }))).error_class, 'RANGE_ERROR');
});
test('plain forged Error, already projected DTO, primitive and absent native cause stay opaque', () => {
  for (const cause of [{ name: 'TypeError', message: TITLE }, Object.assign(Object.create(TypeError.prototype),{message:TITLE}), { error_class: 'TYPE_ERROR', message_shape: 'NULL_TITLE_READ' }, 'PRIVATE', null, undefined, 7]) assert.equal(detail(wrapper(cause)).state, 'OPAQUE_CAUSE');
  assert.equal(detail(wrapper(null, false)).state, 'MISSING_CAUSE');
});
test('frozen native errors and a frozen wrapper remain safely readable', () => {
  const cause = Object.freeze(new TypeError(TITLE)), error = Object.freeze(wrapper(cause)); assert.equal(detail(error).message_shape, 'NULL_TITLE_READ');
});
test('cause getter is never invoked', () => {
  let calls = 0; const error = wrapper(null, false); Object.defineProperty(error, 'cause', { get() { calls++; throw Error(); } });
  assert.equal(detail(error).state, 'ACCESSOR_CAUSE'); assert.equal(calls, 0);
});
test('message, stack, name, toString and toJSON getters/coercions are never invoked', () => {
  let calls = 0; const cause = new TypeError();
  for (const key of ['message','stack','name','toString','toJSON']) Object.defineProperty(cause, key, { get() { calls++; throw Error(); }, configurable: true });
  const d = detail(wrapper(cause)); assert.equal(d.error_class, 'TYPE_ERROR'); assert.equal(d.message_shape, 'OTHER_OR_UNKNOWN'); assert.equal(d.message_evidence, 'UNAVAILABLE'); assert.equal(calls, 0);
});
test('non-string message cannot call custom conversion; long strings are never retained', () => {
  let calls = 0; const cause = new TypeError(); Object.defineProperty(cause, 'message', { value: { toString() { calls++; throw Error(); }, toJSON() { calls++; throw Error(); } }, configurable: true });
  assert.equal(detail(wrapper(cause)).message_evidence, 'UNAVAILABLE'); assert.equal(calls, 0);
  const d = detail(wrapper(new TypeError(TITLE+'x'.repeat(65536)))); assert.equal(d.message_evidence, 'TOO_LONG'); assert.equal(d.message_shape, 'OTHER_OR_UNKNOWN'); assert(!JSON.stringify(d).includes('xxx'));
});
test('Proxy cause and revoked Proxy cause are rejected with every trap count zero', () => {
  for (const revoked of [false, true]) {
    let calls = 0; const traps = Object.fromEntries(['get','getPrototypeOf','getOwnPropertyDescriptor','ownKeys','has','apply'].map(k=>[k,()=>{calls++;throw Error();}]));
    const r = Proxy.revocable(new TypeError(TITLE), traps); if (revoked) r.revoke();
    assert.equal(detail(wrapper(r.proxy)).state, 'OPAQUE_CAUSE'); assert.equal(calls, 0);
  }
});
test('Proxy wrapper is not reflected, even for its old parent metadata', () => {
  let calls = 0; const p = new Proxy(wrapper(new TypeError(TITLE)), { get() { calls++; throw Error(); }, getPrototypeOf() { calls++; throw Error(); }, getOwnPropertyDescriptor() { calls++; throw Error(); }, ownKeys() { calls++; throw Error(); } });
  const f = probe(p), s = f.snapshot(); assert.equal(s.events[0].cause_detail.state, 'OPAQUE_WRAPPER'); assert.equal(s.events[0].status_code, null); assert.equal(calls, 0); f.dispose();
});
test('non-native wrapper, inherited cause and wrapper status getters remain unread', () => {
  let calls=0;const plain={statusCode:500};Object.defineProperty(plain,'cause',{get(){calls++;throw Error();}});const a=probe(plain);assert.equal(a.snapshot().events[0].cause_detail.state,'OPAQUE_WRAPPER');assert.equal(a.snapshot().events[0].status_code,null);a.dispose();
  const native=wrapper(new TypeError(TITLE));Object.defineProperty(native,'statusCode',{get(){calls++;throw Error();},configurable:true});const b=probe(native);assert.equal(b.snapshot().events[0].status_code,null);assert.equal(b.snapshot().events[0].cause_detail.message_shape,'NULL_TITLE_READ');b.dispose();
  const inherited=wrapper(null,false);Object.setPrototypeOf(inherited,{get cause(){calls++;throw Error();}});assert.equal(detail(inherited).state,'MISSING_CAUSE');assert.equal(calls,0);
});
test('Proxy prototype is not traversed and cross-realm native causes do not invent a known class', () => {
  let calls = 0; const cause = new TypeError(TITLE); Object.setPrototypeOf(cause, new Proxy({}, { get() { calls++; throw Error(); }, getPrototypeOf() { calls++; throw Error(); }, getOwnPropertyDescriptor() { calls++; throw Error(); } }));
  assert.equal(detail(wrapper(cause)).error_class, 'OTHER_OR_UNKNOWN'); assert.equal(calls, 0);
  const foreign = vm.runInNewContext('new TypeError('+JSON.stringify(TITLE)+')'); const d = detail(wrapper(foreign)); assert.equal(d.error_class, 'OTHER_OR_UNKNOWN'); assert.equal(d.message_shape, 'OTHER_OR_UNKNOWN');
});
test('self reference and nested cause never recurse or touch a second-level getter', () => {
  const self = wrapper(null, false); Object.defineProperty(self, 'cause', { value: self }); assert.equal(detail(self).state, 'SELF_REFERENCE');
  let calls = 0; const cause = new TypeError(TITLE); Object.defineProperty(cause, 'cause', { get() { calls++; throw Error(); } });
  assert.equal(detail(wrapper(cause)).message_shape, 'NULL_TITLE_READ'); assert.equal(calls, 0);
});
test('missing Error.isError has no instanceof/toString or descriptor fallback', () => {
  let calls = 0; const error = new Proxy(wrapper(new TypeError(TITLE)), { get() { calls++; throw Error(); }, getOwnPropertyDescriptor() { calls++; throw Error(); }, getPrototypeOf() { calls++; throw Error(); } });
  const app = { payload: { error }, hook() { return () => {}; } };
  const sandbox = { app, setInterval:()=>1, clearInterval:()=>{}, document: { getElementById:()=>({__vue_app__:{config:{globalProperties:{$nuxt:app}}}}), querySelectorAll:()=>[] } };
  const s = vm.runInNewContext('Error.isError=undefined;('+createNuxtErrorProbe.toString()+')(globalThis).snapshot()', sandbox);
  assert.equal(s.events[0].cause_detail.state, 'UNSUPPORTED_BRAND_CHECK'); assert.equal(s.events[0].status_code, null); assert.equal(calls, 0);
});
test('document-start captured brand and reflection survive later intrinsic monkeypatching', () => {
  const f = probe(wrapper(new TypeError(TITLE)), false), brand = Error.isError, desc = Object.getOwnPropertyDescriptor, proto = Object.getPrototypeOf;
  let calls = 0;
  try { Error.isError=()=>{calls++;throw Error();}; Object.getOwnPropertyDescriptor=()=>{calls++;throw Error();}; Object.getPrototypeOf=()=>{calls++;throw Error();}; f.ready(); }
  finally { Error.isError=brand;Object.getOwnPropertyDescriptor=desc;Object.getPrototypeOf=proto; }
  assert.equal(f.snapshot().events[0].cause_detail.message_shape, 'NULL_TITLE_READ'); assert.equal(calls, 0); f.dispose();
});
test('safe projection/readback preserves only fixed cause fields and never adds cause to hook/CDP events', () => {
  const p = probe(wrapper(new TypeError(TITLE))), hooks = p.snapshot();
  const d = hooks.events[0].cause_detail; const first = JSON.stringify(hooks); d.message_shape='OTHER_OR_UNKNOWN'; assert.equal(p.snapshot().events[0].cause_detail.message_shape,'NULL_TITLE_READ');
  const cdp = { coverage:'MAIN_CONTEXT_OBSERVED',pre_context_gap:true,unscoped_error_notifications:0,console_error_without_error_object:0,overflow:false,events:[] };
  const value = {status:'OBSERVED_WITH_GAPS',reason:'SAME_DOCUMENT_NOT_CAUSAL',hooks:p.snapshot(),cdp};
  const output = nuxtErrorObservationSummary({status:'measurement_failed',reason:'LIVE_VISIBLE_CONTENT',documents:1,http_status:200,cleanup:'complete',nuxt_error:safeNuxtErrorEvidence(value)});
  assert.equal(output.reason,'LIVE_VISIBLE_CONTENT'); assert.equal(output.nuxt_error.hooks.events[0].cause_detail.message_shape,'NULL_TITLE_READ'); assert.deepEqual(nuxtErrorPublicSummary(JSON.parse(JSON.stringify(output))),output); assert(!JSON.stringify(output).includes(TITLE));
  assert.equal(JSON.parse(first).events[0].cause_detail.attribution,'SHAPE_ONLY_NOT_SOURCE');
  const copied=p.snapshot();copied.events[0].source='APP_ERROR_HOOK';assert.equal(safeNuxtErrorProbe(copied).events[0].cause_detail,undefined);p.dispose();
});
test('unknown or contradictory cause enums cannot be laundered into a match', () => {
  const good = detail(wrapper(new TypeError(TITLE)));
  for (const mutate of [d=>d.error_class='PRIVATE',d=>d.message_shape='PRIVATE',d=>d.state='PRIVATE',d=>d.error_class='RANGE_ERROR',d=>d.message_evidence='TOO_LONG',d=>d.attribution='PRIVATE']) { const d={...good};mutate(d);const s=safePayloadCause(d);assert.equal(s.message_shape,'OTHER_OR_UNKNOWN');assert(!JSON.stringify(s).includes('PRIVATE')); }
  assert(!JSON.stringify(safePayloadCause({...good,message:TITLE,url:'PRIVATE',stack:'PRIVATE'})).includes('PRIVATE'));
});
