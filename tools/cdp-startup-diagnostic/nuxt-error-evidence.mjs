// Local-only candidate. No transport, URL fetch, console capture, or adoption logic.
export const ERROR_PROBE_SLOT = '__pagebench_nuxt_error_observer_v1__';

// Serialized verbatim into the main world before application scripts. Only fixed
// metadata leaves this closure; errors, instances, messages and stacks never do.
export function createNuxtErrorProbe(env = globalThis) {
  // Captured at document-start, before target application code. No brand-check
  // fallback: instanceof / toString / name do not exclude Proxy wrappers.
  const errorBrand = typeof Error.isError === 'function' ? Error.isError : null;
  const descriptor = Object.getOwnPropertyDescriptor, prototypeOf = Object.getPrototypeOf, hasOwn = Object.hasOwn, integer = Number.isInteger;
  const typePrototype = TypeError.prototype, referencePrototype = ReferenceError.prototype, syntaxPrototype = SyntaxError.prototype, rangePrototype = RangeError.prototype, errorPrototype = Error.prototype;
  const branded = value => { try { return errorBrand !== null && errorBrand(value) === true; } catch { return false; } };
  const intrinsicClass = value => {
    const p = prototypeOf(value); // Call only after the native Error brand check.
    return p === typePrototype ? 'TYPE_ERROR' : p === referencePrototype ? 'REFERENCE_ERROR' : p === syntaxPrototype ? 'SYNTAX_ERROR' : p === rangePrototype ? 'RANGE_ERROR' : p === errorPrototype ? 'ERROR' : 'OTHER_OR_UNKNOWN';
  };
  const emptyCause = state => ({ state, error_class: 'OTHER_OR_UNKNOWN', class_evidence: 'UNKNOWN', message_shape: 'OTHER_OR_UNKNOWN', message_evidence: 'UNAVAILABLE', attribution: 'SHAPE_ONLY_NOT_SOURCE' });
  const payloadCause = wrapper => {
    if (!errorBrand) return emptyCause('UNSUPPORTED_BRAND_CHECK');
    if (!branded(wrapper)) return emptyCause('OPAQUE_WRAPPER');
    try {
      const d = descriptor(wrapper, 'cause');
      if (!d) return emptyCause('MISSING_CAUSE');
      if (!hasOwn(d, 'value')) return emptyCause('ACCESSOR_CAUSE');
      const cause = d.value;
      if (cause === wrapper) return emptyCause('SELF_REFERENCE');
      if (!branded(cause)) return emptyCause('OPAQUE_CAUSE');
      const cls = intrinsicClass(cause), m = descriptor(cause, 'message');
      const text = m && hasOwn(m, 'value') ? m.value : undefined;
      const readable = typeof text === 'string', bounded = readable && text.length <= 64;
      return { state: 'OWN_NATIVE_CAUSE', error_class: cls, class_evidence: cls === 'OTHER_OR_UNKNOWN' ? 'UNKNOWN' : 'DIRECT_CAPTURED_INTRINSIC_PROTOTYPE', message_shape: cls === 'TYPE_ERROR' && bounded && text === "Cannot read properties of null (reading 'title')" ? 'NULL_TITLE_READ' : 'OTHER_OR_UNKNOWN', message_evidence: !readable ? 'UNAVAILABLE' : bounded ? 'OWN_DATA_STRING' : 'TOO_LONG', attribution: 'SHAPE_ONLY_NOT_SOURCE' };
    } catch { return emptyCause('UNKNOWN'); }
  };
  const names = new Map([['TypeError', 'TYPE_ERROR'], ['ReferenceError', 'REFERENCE_ERROR'], ['SyntaxError', 'SYNTAX_ERROR'], ['RangeError', 'RANGE_ERROR'], ['Error', 'ERROR'], ['H3Error', 'NUXT_OR_H3_ERROR']]);
  const own = (value, key) => {
    try { const d = descriptor(value, key); return d && hasOwn(d, 'value') ? d.value : undefined; } catch { return undefined; }
  };
  const payloadMeta = value => {
    // Opaque or unsupported payloads stay silent, including parent metadata;
    // otherwise even the old reflection could trigger a Proxy descriptor trap.
    if (!branded(value)) return { error_class: 'OTHER_OR_UNKNOWN', status_code: null, location: 'UNKNOWN' };
    const cls = own(value, '__nuxt_error') === true || own(value, 'name') === 'H3Error' ? 'NUXT_OR_H3_ERROR' : intrinsicClass(value), status = own(value, 'statusCode');
    return { error_class: cls, status_code: integer(status) && status >= 400 && status <= 599 ? status : null, location: 'UNKNOWN' };
  };
  const project = value => {
    let name = own(value, 'name');
    if (name === undefined) {
      try { const proto = Object.getPrototypeOf(value); name = proto && own(proto, 'name'); } catch {}
    }
    const status = own(value, 'statusCode');
    return { error_class: names.get(name) || (own(value, '__nuxt_error') === true ? 'NUXT_OR_H3_ERROR' : 'OTHER_OR_UNKNOWN'), status_code: Number.isInteger(status) && status >= 400 && status <= 599 ? status : null, location: 'UNKNOWN' };
  };
  let active = true, attempts = 0, owner = null, failed = false, overflow = false;
  const events = [], unhooks = [];
  const record = (source, error) => {
    if (!active || failed) return;
    if (events.length >= 16) { overflow = true; return; }
    try { events.push(source === 'PAYLOAD_AT_READY' ? { source, ...payloadMeta(error), cause_detail: payloadCause(error) } : { source, ...project(error) }); } catch { failed = true; }
  };
  const release = () => { for (const off of unhooks.splice(0)) { try { off(); } catch { failed = true; } } };
  const current = () => env.document.getElementById('__nuxt')?.__vue_app__?.config?.globalProperties?.$nuxt;
  const poll = () => {
    if (!active || failed || ++attempts > 250) return;
    try {
      const app = current();
      if (owner && app !== owner) { failed = true; release(); return; }
      if (app && !owner) {
        if (typeof app.hook !== 'function') return;
        owner = app;
        for (const [name, source] of [['app:error', 'APP_ERROR_HOOK'], ['vue:error', 'VUE_ERROR_HOOK']]) {
          const off = app.hook(name, error => { record(source, error); });
          if (typeof off !== 'function') throw Error();
          unhooks.push(off);
        }
        // This is persisted app state, NOT a replayed hook or a claim of its time.
        const error = app.payload?.error;
        if (error != null) record('PAYLOAD_AT_READY', error);
      }
    } catch { failed = true; release(); }
  };
  poll();
  const timer = env.setInterval(() => { poll(); if (attempts >= 250 || failed || !active) env.clearInterval(timer); }, 100);
  const dom = () => {
    try {
      const markers = env.document.querySelectorAll('main img[src="/error.webp"]');
      if (markers.length !== 1) return { signature: markers.length ? 'AMBIGUOUS' : 'ABSENT', status_code: null };
      const main = markers[0].closest('main');
      const ps = main.querySelectorAll(':scope > div > p');
      const hs = main.querySelectorAll('h1');
      const links = main.querySelectorAll('a[href="/"]');
      if (ps.length !== 1 || hs.length !== 1 || links.length !== 1) return { signature: 'MARKER_ONLY', status_code: null };
      // The sole text read is bounded numeric status text, never heading/message.
      const nodes = ps[0].childNodes;
      if (!nodes || nodes.length > 3 || Array.from(nodes).some(n => n.nodeType !== 3 || n.length > 16) || Array.from(nodes).reduce((n, v) => n + v.length, 0) > 16) return { signature: 'STATUS_UNAVAILABLE', status_code: null };
      const text = Array.from(nodes, n => n.data).join('');
      if (!/^\s*[45][0-9]{2}\s*$/.test(text)) return { signature: 'STATUS_UNAVAILABLE', status_code: null };
      return { signature: 'STRUCTURAL_CANDIDATE', status_code: Number(text.trim()) };
    } catch { return { signature: 'UNOBSERVABLE', status_code: null }; }
  };
  return Object.freeze({ snapshot() {
    if (active && !failed) { try { if (owner && current() !== owner) { failed = true; release(); } else poll(); } catch { failed = true; release(); } }
    return { coverage: !active ? 'DISPOSED' : failed ? 'UNOBSERVABLE' : owner ? 'REGISTERED_WITH_PRE_READY_GAP' : attempts >= 250 ? 'READY_NOT_FOUND_WITHIN_BUDGET' : 'WAITING_FOR_READY', pre_ready_gap: true, overflow, events: events.map(e => e.cause_detail ? ({ ...e, cause_detail: { ...e.cause_detail } }) : ({ ...e })), dom: dom(), attribution: 'APP_REPORTED_NOT_CAUSAL', location: 'UNKNOWN' };
  }, dispose() { if (!active) return; active = false; env.clearInterval(timer); release(); owner = null; } });
}

const CLASSES = ['TYPE_ERROR', 'REFERENCE_ERROR', 'SYNTAX_ERROR', 'RANGE_ERROR', 'ERROR', 'NUXT_OR_H3_ERROR', 'OTHER_OR_UNKNOWN'];
const SOURCES = ['APP_ERROR_HOOK', 'VUE_ERROR_HOOK', 'PAYLOAD_AT_READY'];
const COVERAGE = ['REGISTERED_WITH_PRE_READY_GAP', 'READY_NOT_FOUND_WITHIN_BUDGET', 'WAITING_FOR_READY', 'UNOBSERVABLE', 'DISPOSED'];
const DOM = ['ABSENT', 'AMBIGUOUS', 'MARKER_ONLY', 'STATUS_UNAVAILABLE', 'STRUCTURAL_CANDIDATE', 'UNOBSERVABLE'];
export function safePayloadCause(v) {
  const states = ['UNSUPPORTED_BRAND_CHECK','OPAQUE_WRAPPER','MISSING_CAUSE','ACCESSOR_CAUSE','SELF_REFERENCE','OPAQUE_CAUSE','UNKNOWN','OWN_NATIVE_CAUSE'];
  const unknown = { state: 'UNKNOWN', error_class: 'OTHER_OR_UNKNOWN', class_evidence: 'UNKNOWN', message_shape: 'OTHER_OR_UNKNOWN', message_evidence: 'UNAVAILABLE', attribution: 'SHAPE_ONLY_NOT_SOURCE' };
  if (!v || !states.includes(v.state) || !['TYPE_ERROR','REFERENCE_ERROR','SYNTAX_ERROR','RANGE_ERROR','ERROR','OTHER_OR_UNKNOWN'].includes(v.error_class) || !['UNKNOWN','DIRECT_CAPTURED_INTRINSIC_PROTOTYPE'].includes(v.class_evidence) || !['NULL_TITLE_READ','OTHER_OR_UNKNOWN'].includes(v.message_shape) || !['UNAVAILABLE','OWN_DATA_STRING','TOO_LONG'].includes(v.message_evidence) || v.attribution !== 'SHAPE_ONLY_NOT_SOURCE') return unknown;
  if(v.state!=='OWN_NATIVE_CAUSE'&&(v.error_class!=='OTHER_OR_UNKNOWN'||v.class_evidence!=='UNKNOWN'||v.message_shape!=='OTHER_OR_UNKNOWN'||v.message_evidence!=='UNAVAILABLE'))return unknown;
  if((v.error_class==='OTHER_OR_UNKNOWN')!==(v.class_evidence==='UNKNOWN')||v.message_shape==='NULL_TITLE_READ'&&(v.error_class!=='TYPE_ERROR'||v.message_evidence!=='OWN_DATA_STRING'))return unknown;
  return { state: v.state, error_class: v.error_class, class_evidence: v.class_evidence, message_shape: v.message_shape, message_evidence: v.message_evidence, attribution: 'SHAPE_ONLY_NOT_SOURCE' };
}
const code = v => Number.isInteger(v) && v >= 400 && v <= 599 ? v : null;
const missing = reason => ({ status: 'UNKNOWN', reason, hooks: null, cdp: null, location: 'UNKNOWN', cause: 'NOT_ATTRIBUTED' });
export function compareErrorSignals(hooks, cdp) {
  const codes = new Set(hooks.events.map(e => e.status_code).filter(v => v !== null));
  const dom = hooks.dom.status_code;
  const relation = codes.size > 1 ? 'CONFLICT' : codes.size === 1 ? dom === null ? 'HOOK_STATUS_ONLY' : codes.has(dom) ? 'MATCH' : 'CONFLICT' : dom === null ? 'NO_STATUS' : 'DOM_STATUS_ONLY';
  return { status_relation: relation, signal: hooks.events.length ? 'HOOK_OR_PAYLOAD_REPORTED' : cdp.events.length ? 'CDP_ONLY' : hooks.dom.signature === 'STRUCTURAL_CANDIDATE' ? 'DOM_CANDIDATE_ONLY' : 'NO_RECORDED_SIGNAL_WITH_GAPS', cause: 'NOT_ATTRIBUTED', location: 'UNKNOWN' };
}
export function safeNuxtErrorProbe(v) {
  try {
    if (!v || !COVERAGE.includes(v.coverage) || v.pre_ready_gap !== true || typeof v.overflow !== 'boolean' || !Array.isArray(v.events) || v.events.length > 16 || !DOM.includes(v.dom?.signature)) return null;
    const events = v.events.map(e => {
      if (!SOURCES.includes(e.source) || !CLASSES.includes(e.error_class) || e.location !== 'UNKNOWN' || e.status_code !== null && code(e.status_code) === null) throw Error();
      return { source: e.source, error_class: e.error_class, status_code: e.status_code, location: 'UNKNOWN', ...(e.source === 'PAYLOAD_AT_READY' && Object.hasOwn(e,'cause_detail') ? { cause_detail: safePayloadCause(e.cause_detail) } : {}) };
    });
    const status = code(v.dom.status_code);
    if (v.dom.signature === 'STRUCTURAL_CANDIDATE' ? status === null : v.dom.status_code !== null) return null;
    return { coverage: v.coverage, pre_ready_gap: true, overflow: v.overflow, events, dom: { signature: v.dom.signature, status_code: status }, attribution: 'APP_REPORTED_NOT_CAUSAL', location: 'UNKNOWN' };
  } catch { return null; }
}

// Observes only already-accepted messages supplied by the existing gateway.
// It does not parse raw or rejected input and never sends a protocol command.
export class NuxtExceptionJournal {
  constructor(frame) { this.frame = frame; this.loader = null; this.context = null; this.lost = false; this.events = []; this.overflow = false; this.unscoped = 0; this.consoleWithoutObject = 0; }
  observe(m, target) {
    const p = m.params;
    if (m.method === 'Page.frameNavigated' && p?.frame?.id === this.frame && !p.frame.parentId) {
      if (!this.loader && p.frame.url === 'about:blank') return;
      if (p.frame.url !== target || typeof p.frame.loaderId !== 'string' || this.loader && this.loader !== p.frame.loaderId) { this.lost = true; return; }
      this.loader = p.frame.loaderId; this.context = null;
    }
    const notification = m.method === 'Runtime.exceptionThrown' || m.method === 'Runtime.consoleAPICalled' && p?.type === 'error';
    if (!this.loader || this.lost) { if (notification) { if (this.unscoped >= 16) this.overflow = true; else this.unscoped++; } return; }
    if (m.method === 'Runtime.executionContextCreated' && p?.context?.auxData?.frameId === this.frame && p.context.auxData.isDefault === true && Number.isInteger(p.context.id)) {
      if (this.context !== null && this.context !== p.context.id) this.lost = true;
      else this.context = p.context.id;
    }
    if (m.method === 'Runtime.executionContextsCleared' || m.method === 'Runtime.executionContextDestroyed' && p?.executionContextId === this.context) this.context = null;
    if (!notification) return;
    const context = m.method === 'Runtime.exceptionThrown' ? p?.exceptionDetails?.executionContextId : p.executionContextId;
    if (this.context === null || context !== this.context) { if (this.unscoped >= 16) this.overflow = true; else this.unscoped++; return; }
    const names = new Map([['TypeError', 'TYPE_ERROR'], ['ReferenceError', 'REFERENCE_ERROR'], ['SyntaxError', 'SYNTAX_ERROR'], ['RangeError', 'RANGE_ERROR'], ['Error', 'ERROR'], ['H3Error', 'NUXT_OR_H3_ERROR']]);
    const record = (source, name) => { if (this.events.length >= 16) { this.overflow = true; return; } this.events.push({ source, error_class: names.get(name) || 'OTHER_OR_UNKNOWN', status_code: null, location: 'UNKNOWN' }); };
    if (m.method === 'Runtime.exceptionThrown') record('CDP_UNCAUGHT', p.exceptionDetails.exception?.className);
    else {
      // No console text, values, previews, descriptions, IDs or remote inspection.
      if (!Array.isArray(p.args) || p.args.length > 8) { this.overflow = true; return; }
      let found = 0;
      for (const arg of p.args) if (arg?.type === 'object' && arg.subtype === 'error') { record('CDP_CONSOLE_ERROR_OBJECT', arg.className); found++; }
      if (!found) { if (this.consoleWithoutObject >= 16) this.overflow = true; else this.consoleWithoutObject++; }
    }
  }
  snapshot() { return { coverage: this.lost ? 'SCOPE_LOST' : this.context === null ? 'CONTEXT_NOT_ESTABLISHED' : 'MAIN_CONTEXT_OBSERVED', pre_context_gap: true, unscoped_error_notifications: this.unscoped, console_error_without_error_object: this.consoleWithoutObject, overflow: this.overflow, events: this.events.map(e => ({ ...e })) }; }
}

export const ERROR_OBSERVATION_LIMITS = Object.freeze({ additional_cdp_calls: 6, install_ms: 750, collect_ms: 750, dispose_ms: 750, total_wait_ms: 2250, hook_checks: 250, hook_interval_ms: 100, events_per_source: 16 });
export async function installNuxtErrorEvidence(ctx, target) {
  const g = ctx.gateway, primary = g.primary, targetId = g.createdPage, session = g.sessions.get(primary), forward = g.forward;
  let active = true, script, expired = false, collected = false;
  const healthy = () => active && !expired && !g.stopping && !g.stats.fatal && g.primary === primary && g.createdPage === targetId && g.sessions.get(primary) === session && session?.ready && g.forward === observer;
  const journal = new NuxtExceptionJournal(session?.frame);
  function observer(m) { const r = forward.call(g, m); if (healthy() && m.sessionId === primary) journal.observe(m, target); return r; }
  const wait = async (work, reason) => { let timer; try { return await Promise.race([work(), new Promise((_, reject) => { timer = setTimeout(() => { expired = true; reject(Error(reason)); }, 750); })]); } finally { clearTimeout(timer); } };
  const evaluate = async expression => {
    if (!healthy() || journal.context === null || journal.lost) throw Error();
    const context = journal.context;
    const reply = await g.call('Runtime.evaluate', { expression, contextId: context, returnByValue: true, silent: true }, primary);
    if (!healthy() || journal.context !== context || journal.lost || reply.exceptionDetails) throw Error();
    return reply.result?.value;
  };
  g.forward = observer;
  try {
    await wait(async () => {
      if (!healthy()) throw Error();
      const source = `;(()=>{const key=${JSON.stringify(ERROR_PROBE_SLOT)};if(Object.getOwnPropertyDescriptor(globalThis,key))return;Object.defineProperty(globalThis,key,{value:(${createNuxtErrorProbe.toString()})(globalThis)});})();`;
      script = await g.call('Page.addScriptToEvaluateOnNewDocument', { source }, primary);
      if (!healthy() || typeof script?.identifier !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(script.identifier)) throw Error();
    }, 'INSTALL_TIMEOUT');
  } catch { active = false; if (g.forward === observer) g.forward = forward; return { ready: false, collect: async () => missing('INSTALL_FAILED'), dispose: async () => {} }; }
  return Object.freeze({ ready: true, async collect() {
    if (collected) return missing('ALREADY_COLLECTED');
    collected = true;
    try {
      return await wait(async () => {
        if (!healthy()) throw Error();
        const before = (await g.call('Page.getFrameTree', {}, primary)).frameTree?.frame;
        if (!healthy() || before?.url !== target || before.id !== session.frame || before.loaderId !== journal.loader || journal.lost) throw Error();
        const raw = await evaluate(`globalThis.${ERROR_PROBE_SLOT}?.snapshot()`);
        if (!healthy()) throw Error();
        const after = (await g.call('Page.getFrameTree', {}, primary)).frameTree?.frame;
        if (!healthy() || journal.lost || after?.id !== before.id || after?.loaderId !== before.loaderId || after?.url !== target) throw Error();
        const hooks = safeNuxtErrorProbe(raw);
        if (!hooks) return missing('INVALID_FIXED_SAMPLE');
        const cdp = journal.snapshot(), limited = hooks.overflow || journal.overflow, unavailable = ['UNOBSERVABLE', 'DISPOSED'].includes(hooks.coverage);
        return { status: limited || unavailable ? 'UNKNOWN' : 'OBSERVED_WITH_GAPS', reason: limited ? 'EVENT_LIMIT' : unavailable ? 'HOOKS_UNOBSERVABLE' : 'SAME_DOCUMENT_NOT_CAUSAL', hooks, cdp, comparison: compareErrorSignals(hooks, cdp), location: 'UNKNOWN', cause: 'NOT_ATTRIBUTED' };
      }, 'OBSERVATION_TIMEOUT');
    } catch (error) { return missing(error.message === 'OBSERVATION_TIMEOUT' ? 'OBSERVATION_TIMEOUT' : 'SCOPE_OR_OBSERVATION_FAILED'); }
  }, async dispose() {
    if (!active) return { status: 'skipped' };
    let status = healthy() ? 'complete' : 'skipped';
    try { await wait(async () => {
      if (healthy() && journal.context !== null && !journal.lost) { await evaluate(`globalThis.${ERROR_PROBE_SLOT}?.dispose()`); }
      if (healthy() && script?.identifier) { await g.call('Page.removeScriptToEvaluateOnNewDocument', { identifier: script.identifier }, primary); }
    }, 'DISPOSE_TIMEOUT'); } catch { status = 'failed'; }
    active = false; if (g.forward === observer) g.forward = forward;
    return { status };
  } });
}

export function safeNuxtErrorEvidence(v) {
  const reasons = ['NOT_ENABLED', 'NOT_COLLECTED', 'INSTALL_FAILED', 'ALREADY_COLLECTED', 'OBSERVATION_TIMEOUT', 'SCOPE_OR_OBSERVATION_FAILED', 'INVALID_FIXED_SAMPLE', 'EVENT_LIMIT', 'HOOKS_UNOBSERVABLE', 'SAME_DOCUMENT_NOT_CAUSAL'];
  try {
    if (!v || !['UNKNOWN', 'OBSERVED_WITH_GAPS'].includes(v.status) || !reasons.includes(v.reason)) return missing('NOT_COLLECTED');
    if(v.status==='OBSERVED_WITH_GAPS'&&v.reason!=='SAME_DOCUMENT_NOT_CAUSAL')return missing('INVALID_FIXED_SAMPLE');
    if (v.hooks === null && v.cdp === null && v.status === 'UNKNOWN') return missing(v.reason);
    const hooks = safeNuxtErrorProbe(v.hooks), c = v.cdp;
    if (!hooks || !['SCOPE_LOST', 'CONTEXT_NOT_ESTABLISHED', 'MAIN_CONTEXT_OBSERVED'].includes(c?.coverage) || c.pre_context_gap !== true || typeof c.overflow !== 'boolean' || ![c.unscoped_error_notifications, c.console_error_without_error_object].every(n => Number.isInteger(n) && n >= 0 && n <= 16) || !Array.isArray(c.events) || c.events.length > 16) return missing('INVALID_FIXED_SAMPLE');
    const events = c.events.map(e => { if (!['CDP_UNCAUGHT', 'CDP_CONSOLE_ERROR_OBJECT'].includes(e.source) || !CLASSES.includes(e.error_class) || e.status_code !== null || e.location !== 'UNKNOWN') throw Error(); return { source: e.source, error_class: e.error_class, status_code: null, location: 'UNKNOWN' }; });
    const cdp = { coverage: c.coverage, pre_context_gap: true, unscoped_error_notifications: c.unscoped_error_notifications, console_error_without_error_object: c.console_error_without_error_object, overflow: c.overflow, events };
    const limited = hooks.overflow || cdp.overflow, unavailable = ['UNOBSERVABLE', 'DISPOSED'].includes(hooks.coverage) || cdp.coverage === 'SCOPE_LOST';
    return { status: limited || unavailable || v.status === 'UNKNOWN' ? 'UNKNOWN' : 'OBSERVED_WITH_GAPS', reason: limited ? 'EVENT_LIMIT' : unavailable ? 'HOOKS_UNOBSERVABLE' : v.status === 'UNKNOWN' ? v.reason : 'SAME_DOCUMENT_NOT_CAUSAL', hooks, cdp, comparison: compareErrorSignals(hooks, cdp), location: 'UNKNOWN', cause: 'NOT_ATTRIBUTED' };
  } catch { return missing('INVALID_FIXED_SAMPLE'); }
}
