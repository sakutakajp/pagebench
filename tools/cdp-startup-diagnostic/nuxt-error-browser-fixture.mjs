// CLOSED candidate only. Base FixtureGateway fulfills fixed strings or aborts;
// denyProxy cannot forward any connection. No site or Lighthouse entry here.
import { openGuarded } from './fixture-runner.mjs';
import { FixtureGateway, FIXTURE_URL } from './fixture-gateway.mjs';
import { denyProxy } from './diagnostic.mjs';
import { installNuxtErrorEvidence, safeNuxtErrorEvidence } from './nuxt-error-evidence.mjs';
import { writeFile, readFile } from 'node:fs/promises';
import { safetyFingerprint, workflowSha } from './proof.mjs';

export const ERROR_FIXTURE_CASES = ['normal', 'app_error', 'vue_captured', 'fake_marker', 'not_ready'];
export function errorFixtureHtml(mode) {
  if (!ERROR_FIXTURE_CASES.includes(mode)) throw Error('FIXTURE_MODE');
  const errorShell = mode === 'app_error' || mode === 'vue_captured';
  const marker = errorShell || mode === 'fake_marker' ? '<img loading="lazy" style="display:none" src="/error.webp">' : '';
  const body = errorShell ? `${marker}<div><p>${mode === 'app_error' ? 500 : 503}</p><h1>Fixed synthetic heading</h1><a href="/">Home</a></div>` : `${marker}<h1>Normal synthetic heading</h1><p>Fixed synthetic local content.</p>`;
  return `<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"></head><body><div id="__nuxt"><main>${body}</main></div><script>
    const callbacks=new Map();
    const app={payload:{error:null},hook(name,fn){const a=callbacks.get(name)||[];a.push(fn);callbacks.set(name,a);return()=>callbacks.set(name,a.filter(x=>x!==fn));}};
    const emit=(name,e)=>{for(const f of callbacks.get(name)||[])f(e);};
    ${mode === 'not_ready' ? '' : "document.getElementById('__nuxt').__vue_app__={config:{globalProperties:{$nuxt:app}}};"}
    setTimeout(()=>{
      ${mode === 'app_error' ? "const e=new TypeError('synthetic only');e.statusCode=500;app.payload.error=e;emit('app:error',e);" : ''}
      ${mode === 'vue_captured' ? "try{throw Object.assign(new TypeError('synthetic only'),{statusCode:503});}catch(e){emit('vue:error',e);}" : ''}
      window.fixtureReady=true;
    },350);
  </script></body></html>`;
}
export async function runNuxtErrorBrowserFixture() {
  const cases = []; let ctx, phase = 'OPEN';
  try {
    for (const mode of ERROR_FIXTURE_CASES) {
      phase = 'OPEN';
      class ClosedErrorGateway extends FixtureGateway {
        async call(method, params = {}, session) {
          if (method === 'Fetch.fulfillRequest' && params.responseHeaders?.some(h => h.name === 'Content-Type' && h.value === 'text/html')) params = { ...params, body: Buffer.from(errorFixtureHtml(mode)).toString('base64') };
          return super.call(method, params, session);
        }
      }
      ctx = await openGuarded(ClosedErrorGateway, denyProxy);
      phase = 'INSTALL'; const observer = await installNuxtErrorEvidence(ctx, FIXTURE_URL);
      phase = 'NAVIGATE'; await ctx.page.goto(FIXTURE_URL, { waitUntil: 'load', timeout: 15000 });
      await ctx.page.waitForFunction(() => window.fixtureReady === true, { timeout: 3000 });
      phase = 'COLLECT'; const evidence = await observer.collect();
      if (evidence.status !== 'OBSERVED_WITH_GAPS' || evidence.hooks.pre_ready_gap !== true || evidence.hooks.overflow || evidence.cdp.overflow) throw Error();
      if (mode === 'app_error' && !(evidence.hooks.events.length === 1 && evidence.hooks.events[0].source === 'APP_ERROR_HOOK' && evidence.hooks.events[0].error_class === 'TYPE_ERROR' && evidence.hooks.events[0].status_code === 500 && evidence.comparison.status_relation === 'MATCH')) throw Error();
      if (mode === 'vue_captured' && !(evidence.hooks.events.length === 1 && evidence.hooks.events[0].source === 'VUE_ERROR_HOOK' && evidence.hooks.events[0].status_code === 503 && evidence.cdp.events.length === 0)) throw Error();
      if (mode === 'normal' && !(evidence.hooks.events.length === 0 && evidence.hooks.dom.signature === 'ABSENT')) throw Error();
      if (mode === 'fake_marker' && !(evidence.hooks.events.length === 0 && evidence.hooks.dom.signature === 'MARKER_ONLY' && evidence.hooks.dom.status_code === null)) throw Error();
      if (mode === 'not_ready' && evidence.hooks.coverage !== 'WAITING_FOR_READY') throw Error();
      if (ctx.gateway.stats.fatal || ctx.gateway.stats.fixture_documents !== 1) throw Error();
      phase = 'CLEANUP'; const observerCleanup = await observer.dispose(); if(observerCleanup.status!=='complete')throw Error(); const chrome = ctx.chrome, cleanup = await ctx.cleanup(); ctx = null;
      if (cleanup.status !== 'complete') throw Error();
      cases.push({ case: mode, status: 'passed', chrome, evidence, observer_cleanup: 'complete', cleanup: 'complete', outbound_forwarding: 0 });
    }
    return { kind: 'closed-nuxt-error-proof', status: 'passed', workflow_sha: workflowSha(), fingerprint: await safetyFingerprint(), chrome: cases[0].chrome, cases, live_pages_attempted: 0, outbound_forwarding: 0, json_readback: true };
  } catch (error) {
    const cleanup = await ctx?.cleanup();
    const phases = ['BINARY', 'AUTHLESS_PROFILE', 'PROXY_SETUP', 'CHROME_START', 'CHROME_SANDBOX_FAILED', 'DEVTOOLS_FILE_INVALID', 'DEVTOOLS_NOT_READY', 'CDP_CONNECT', 'ROOT_GUARD', 'PUPPETEER_CONNECT', 'BOUND_PAGE'];
    return { kind: 'closed-nuxt-error-proof', status: 'failed', phase, reason: phase === 'OPEN' ? 'BROWSER_NOT_STARTED' : 'FIXTURE_CHECK_FAILED', startup_phase: phases.includes(error.fixed?.phase) ? error.fixed.phase : 'UNKNOWN', cases, cleanup: cleanup?.status || (error.fixed?.cleanup === 'complete' ? 'complete' : 'UNKNOWN'), live_pages_attempted: 0, outbound_forwarding: 0 };
  }
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  try {
    const result = await runNuxtErrorBrowserFixture();
    if(result.status==='passed'&&!validNuxtErrorBrowserProof(result,workflowSha(),await safetyFingerprint()))throw Error();
    const text = JSON.stringify(result); await writeFile('closed-nuxt-error-proof.json', text, { mode: 0o600 }); if(await readFile('closed-nuxt-error-proof.json','utf8')!==text)throw Error(); console.log(text);
    if (result.status !== 'passed') process.exitCode = 1;
  } catch {
    const text=JSON.stringify({kind:'closed-nuxt-error-proof',status:'failed',phase:'READBACK',reason:'CLOSED_OUTPUT_INVALID',cases:[],live_pages_attempted:0,outbound_forwarding:0,json_readback:false});
    try{await writeFile('closed-nuxt-error-proof.json',text,{mode:0o600});}catch{} console.log(text);process.exitCode=1;
  }
}

export function validNuxtErrorBrowserProof(p, sha, fingerprint) {
  try {
    const keys = ['kind','status','workflow_sha','fingerprint','chrome','cases','live_pages_attempted','outbound_forwarding','json_readback'];
    if (!p || Object.keys(p).length !== keys.length || Object.keys(p).some(k=>!keys.includes(k)) || p.kind !== 'closed-nuxt-error-proof' || p.status !== 'passed' || p.workflow_sha !== sha || p.fingerprint !== fingerprint || !/^Chrome\/\d+\.\d+\.\d+\.\d+$/.test(p.chrome) || p.live_pages_attempted !== 0 || p.outbound_forwarding !== 0 || p.json_readback !== true || JSON.stringify(p.cases?.map(c=>c.case)) !== JSON.stringify(ERROR_FIXTURE_CASES)) return false;
    for (const c of p.cases) {
      if (Object.keys(c).sort().join(',') !== 'case,chrome,cleanup,evidence,observer_cleanup,outbound_forwarding,status' || c.status !== 'passed' || c.chrome !== p.chrome || c.cleanup !== 'complete' || c.observer_cleanup !== 'complete' || c.outbound_forwarding !== 0 || c.evidence.status !== 'OBSERVED_WITH_GAPS' || JSON.stringify(safeNuxtErrorEvidence(c.evidence)) !== JSON.stringify(c.evidence)) return false;
      const h = c.evidence.hooks;
      if (h.pre_ready_gap !== true || h.overflow || c.evidence.cdp.overflow) return false;
      if (c.case === 'app_error' && !(h.events.length === 1 && h.events[0].source === 'APP_ERROR_HOOK' && h.events[0].error_class === 'TYPE_ERROR' && h.events[0].status_code === 500 && c.evidence.comparison.status_relation === 'MATCH')) return false;
      if (c.case === 'vue_captured' && !(h.events.length === 1 && h.events[0].source === 'VUE_ERROR_HOOK' && h.events[0].error_class === 'TYPE_ERROR' && h.events[0].status_code === 503 && c.evidence.cdp.events.length === 0)) return false;
      if (['normal','fake_marker','not_ready'].includes(c.case) && h.events.length !== 0) return false;
      if (c.case === 'normal' && h.dom.signature !== 'ABSENT') return false;
      if (c.case === 'fake_marker' && (h.dom.signature !== 'MARKER_ONLY' || h.dom.status_code !== null)) return false;
      if (c.case === 'not_ready' && h.coverage !== 'WAITING_FOR_READY') return false;
    }
    return true;
  } catch { return false; }
}
