// Fixture-only: fixed memory HTML and denyProxy, no live/network forwarding.
import { openGuarded } from './fixture-runner.mjs';
import { FixtureGateway, FIXTURE_URL } from './fixture-gateway.mjs';
import { denyProxy } from './diagnostic.mjs';
import { installNuxtErrorEvidence } from './nuxt-error-evidence.mjs';
import { nuxtErrorObservationSummary, nuxtErrorPublicSummary } from './nuxt-error-summary.mjs';
import { safetyFingerprint, workflowSha } from './proof.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export const CAUSE_CASES = ['native_title','proxy_cause','proxy_wrapper','missing_cause','message_getter','range_same_text'];
export function causeFixtureHtml(mode) {
  if (!CAUSE_CASES.includes(mode)) throw Error('CAUSE_FIXTURE_MODE');
  return `<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"></head><body><div id="__nuxt"><main><img loading="lazy" style="display:none" src="/error.webp"><div><p>500</p><h1>Fixed closed error fixture</h1><a href="/">Home</a></div></main></div><script>
    let trapCount=0,getterCount=0;
    const traps={get(){trapCount++;throw Error();},getOwnPropertyDescriptor(){trapCount++;throw Error();},getPrototypeOf(){trapCount++;throw Error();},ownKeys(){trapCount++;throw Error();},has(){trapCount++;throw Error();}};
    const mode=${JSON.stringify(mode)};
    let cause;try{const metadata=null;metadata.title;}catch(e){cause=e;}
    const standard=typeof Error.isError==='function'&&Error.isError(new Error())===true&&Error.isError(new Proxy(new Error(),traps))===false;
    if(mode==='proxy_cause')cause=new Proxy(cause,traps);
    if(mode==='message_getter')Object.defineProperty(cause,'message',{get(){getterCount++;throw Error();},configurable:true});
    if(mode==='range_same_text')cause=new RangeError("Cannot read properties of null (reading 'title')");
    let wrapper=mode==='missing_cause'?new Error('fixed wrapper'):new Error('fixed wrapper',{cause});
    Object.defineProperties(wrapper,{name:{value:'H3Error'},statusCode:{value:500},__nuxt_error:{value:true}});
    if(mode==='proxy_wrapper')wrapper=new Proxy(wrapper,traps);
    const app={payload:{error:wrapper},hook(){return()=>{};}};
    document.getElementById('__nuxt').__vue_app__={config:{globalProperties:{$nuxt:app}}};
    window.__causeFixture={read:()=>({standard_brand:standard,reflection_traps:trapCount,getter_calls:getterCount})};
    window.fixtureReady=true;
  </script></body></html>`;
}
export function causePublicOutcome(evidence) {
  // Exercise the real failure projection, not a fabricated successful LHR.
  return nuxtErrorObservationSummary({kind:'closed-cause-fixture',status:'measurement_failed',reason:'LIVE_VISIBLE_CONTENT',documents:1,http_status:200,cleanup:'complete',performance:null,nuxt_error:evidence});
}
export async function causePublicReadback(value,file) {
  const projected=nuxtErrorPublicSummary(value),text=JSON.stringify(projected);
  await writeFile(file,text,{mode:0o600});if(await readFile(file,'utf8')!==text)throw Error('FIXED_READBACK');
  return {public:projected,public_readback:true,public_sha256:createHash('sha256').update(text).digest('hex')};
}
export function validCauseCase(c) {
  try {
    if(!c||Object.keys(c).sort().join(',')!=='case,chrome,cleanup,documents,getter_calls,information,observer_cleanup,outbound_forwarding,public,public_readback,public_sha256,reflection_traps,standard_brand,status')return false;
    if(!CAUSE_CASES.includes(c?.case)||c.status!=='passed'||c.standard_brand!==true||c.reflection_traps!==0||c.getter_calls!==0||c.documents!==1||c.cleanup!=='complete'||c.observer_cleanup!=='complete'||c.outbound_forwarding!==0||c.public_readback!==true||!/^Chrome\/\d+\.\d+\.\d+\.\d+$/.test(c.chrome))return false;
    const p=c.public,e=p?.nuxt_error,h=e?.hooks,d=h?.events?.[0]?.cause_detail;
    if(JSON.stringify(nuxtErrorPublicSummary(p))!==JSON.stringify(p)||p.status!=='observation_rejected'||p.reason!=='LIVE_VISIBLE_CONTENT'||p.documents!==1||p.http_status!==200||p.performance!==null||p.metrics!==null||p.score_adopted!==false||p.lighthouse_report_saved!==false||e.status!=='OBSERVED_WITH_GAPS'||h.coverage!=='REGISTERED_WITH_PRE_READY_GAP'||h.pre_ready_gap!==true||h.overflow||h.events.length!==1||h.events[0].source!=='PAYLOAD_AT_READY'||e.cdp.coverage!=='MAIN_CONTEXT_OBSERVED'||e.cdp.overflow||!d)return false;
    if(createHash('sha256').update(JSON.stringify(p)).digest('hex')!==c.public_sha256)return false;
    if(c.case==='native_title')return c.information==='NATIVE_SHAPE_OBSERVED'&&h.events[0].status_code===500&&d.state==='OWN_NATIVE_CAUSE'&&d.error_class==='TYPE_ERROR'&&d.class_evidence==='DIRECT_CAPTURED_INTRINSIC_PROTOTYPE'&&d.message_shape==='NULL_TITLE_READ'&&d.attribution==='SHAPE_ONLY_NOT_SOURCE';
    if(c.information!=='UNKNOWN'||d.message_shape!=='OTHER_OR_UNKNOWN')return false;
    const expected={proxy_cause:'OPAQUE_CAUSE',proxy_wrapper:'OPAQUE_WRAPPER',missing_cause:'MISSING_CAUSE',message_getter:'OWN_NATIVE_CAUSE',range_same_text:'OWN_NATIVE_CAUSE'};
    if(d.state!==expected[c.case])return false;
    if(c.case==='message_getter')return d.error_class==='TYPE_ERROR'&&d.message_evidence==='UNAVAILABLE';
    if(c.case==='range_same_text')return d.error_class==='RANGE_ERROR';
    return d.error_class==='OTHER_OR_UNKNOWN'&&(c.case!=='proxy_wrapper'||h.events[0].status_code===null);
  } catch{return false;}
}
export function validCauseBrowserProof(p,sha,fingerprint) {
  try {
    if(!p||Object.keys(p).sort().join(',')!=='cases,chrome,fingerprint,json_readback,kind,live_pages_attempted,outbound_forwarding,status,workflow_sha')return false;
    return p?.kind==='closed-payload-cause-proof'&&p.status==='passed'&&p.workflow_sha===sha&&p.fingerprint===fingerprint&&p.live_pages_attempted===0&&p.outbound_forwarding===0&&p.json_readback===true&&/^Chrome\/\d+\.\d+\.\d+\.\d+$/.test(p.chrome)&&JSON.stringify(p.cases?.map(c=>c.case))===JSON.stringify(CAUSE_CASES)&&p.cases.every(c=>c.chrome===p.chrome&&validCauseCase(c));
  } catch{return false;}
}
export async function runCauseBrowserFixture() {
  let ctx,observer,phase='OPEN';const cases=[];
  try {
    for(const mode of CAUSE_CASES){
      phase='OPEN';
      class ClosedCauseGateway extends FixtureGateway {
        async call(method,params={},session){
          if(method==='Fetch.fulfillRequest'&&params.responseHeaders?.some(h=>h.name==='Content-Type'&&h.value==='text/html'))params={...params,body:Buffer.from(causeFixtureHtml(mode)).toString('base64')};
          return super.call(method,params,session);
        }
      }
      ctx=await openGuarded(ClosedCauseGateway,denyProxy);
      phase='INSTALL';observer=await installNuxtErrorEvidence(ctx,FIXTURE_URL);if(!observer.ready)throw Error();
      phase='NAVIGATE';await ctx.page.goto(FIXTURE_URL,{waitUntil:'load',timeout:15000});await ctx.page.waitForFunction(()=>window.fixtureReady===true,{timeout:3000});
      phase='COLLECT';const evidence=await observer.collect();
      // This extra read belongs only to the closed test, never the live mechanism.
      const counters=await ctx.page.evaluate(()=>window.__causeFixture?.read());
      if(counters?.standard_brand!==true||counters.reflection_traps!==0||counters.getter_calls!==0)throw Error();
      const publicValue=nuxtErrorPublicSummary(causePublicOutcome(evidence));
      phase='PUBLIC_READBACK';const saved=await causePublicReadback(publicValue,'closed-cause-public-'+mode+'.json');
      if(ctx.gateway.stats.fatal||ctx.gateway.stats.fixture_documents!==1)throw Error();
      phase='CLEANUP';const observerCleanup=await observer.dispose();observer=null;const chrome=ctx.chrome,cleanup=await ctx.cleanup();ctx=null;
      const c={case:mode,status:'passed',chrome,standard_brand:true,reflection_traps:0,getter_calls:0,documents:1,cleanup:cleanup.status,observer_cleanup:observerCleanup.status,outbound_forwarding:0,...saved,information:mode==='native_title'?'NATIVE_SHAPE_OBSERVED':'UNKNOWN'};
      if(!validCauseCase(c))throw Error();cases.push(c);
    }
    return {kind:'closed-payload-cause-proof',status:'passed',workflow_sha:workflowSha(),fingerprint:await safetyFingerprint(),chrome:cases[0].chrome,cases,live_pages_attempted:0,outbound_forwarding:0,json_readback:true};
  } catch(error){
    await observer?.dispose();const cleanup=await ctx?.cleanup();
    return {kind:'closed-payload-cause-proof',status:'failed',phase,reason:phase==='OPEN'?'BROWSER_NOT_STARTED':'CAUSE_PROOF_FAILED',startup_phase:error.fixed?.phase==='CHROME_SANDBOX_FAILED'?'CHROME_SANDBOX_FAILED':'UNKNOWN',cases:cases.map(c=>({case:c.case,status:c.status})),cleanup:cleanup?.status==='complete'||error.fixed?.cleanup==='complete'?'complete':cleanup?.status==='failed'?'failed':'UNKNOWN',live_pages_attempted:0,outbound_forwarding:0,json_readback:false};
  }
}
if(process.argv[1]===new URL(import.meta.url).pathname){
  try{const result=await runCauseBrowserFixture();if(result.status==='passed'&&!validCauseBrowserProof(result,workflowSha(),await safetyFingerprint()))throw Error();const text=JSON.stringify(result);await writeFile('payload-cause-browser-proof.json',text,{mode:0o600});if(await readFile('payload-cause-browser-proof.json','utf8')!==text)throw Error();console.log(text);if(result.status!=='passed')process.exitCode=1;}
  catch{const text='{"kind":"closed-payload-cause-proof","status":"failed","phase":"READBACK","reason":"CLOSED_OUTPUT_INVALID","live_pages_attempted":0,"outbound_forwarding":0,"json_readback":false}';try{await writeFile('payload-cause-browser-proof.json',text,{mode:0o600});}catch{}console.log(text);process.exitCode=1;}
}
