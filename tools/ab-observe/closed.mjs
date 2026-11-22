// Memory-only responses behind the existing proxy with no forwarding capability.
import {NoReinspectionGateway,ReinspectionGateway} from './gateway.mjs';
import {runArm} from './runner.mjs';import {applyLockedConfig,browserFileHash} from './config.mjs';
import {openGuarded} from '../cdp-startup-diagnostic/fixture-runner.mjs';
import {denyProxy} from '../cdp-startup-diagnostic/diagnostic.mjs';
import {safetyFingerprint,workflowSha} from '../cdp-startup-diagnostic/proof.mjs';
import {writeFile,readFile} from 'node:fs/promises';
const main='<main id="home-content"><h1 id="home-title">Closed heading</h1><p>A fixed fixture with more than twenty characters of visible content.</p></main>';
export function fixtureHtml(kind){return '<!doctype html><html><head>'+(kind==='no_meta'?'':'<meta name="viewport" content="width=device-width,initial-scale=1">')+'<link rel="icon" href="data:,"><script>window.__NUXT__={config:{public:{IS_PRODUCTION:false}}}</script></head><body>'+(kind==='short'?'<main>short</main>':kind==='missing_original'?'<main><h1>Unmarked</h1><p>Only fixed known text longer than twenty characters.</p></main>':main)+(kind==='transition'?'<script>setTimeout(()=>{document.body.innerHTML=\'<main><div><p>500</p><h1>Fixed error</h1><a href="/">Home</a></div><img src="/error.webp"></main>\'},2500)</script>':kind==='redirect'?'<script src="/redirect.js"></script>':'')+'</body></html>';}
export function memoryClass(mode,kind){const Parent=mode==='A'?NoReinspectionGateway:ReinspectionGateway;return class extends Parent{
 constructor(...args){super(...args);this.memory=true;}
 async request(e,id){
  if(e.responseStatusCode!==undefined||e.responseErrorReason){if(e.responseErrorReason||e.responseStatusCode!==200){await this.call('Fetch.failRequest',{requestId:e.requestId,errorReason:'BlockedByClient'},id);this.fail('REDIRECT');return;}await this.call('Fetch.continueResponse',{requestId:e.requestId},id);return;}
  const decision=this.boundary.check(e);if(decision!=='ALLOW'){await this.call('Fetch.failRequest',{requestId:e.requestId,errorReason:'BlockedByClient'},id);this.fail('AB_BOUNDARY_REJECTED');return;}
  if(e.request.url.endsWith('/redirect.js')){await this.call('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:302,responseHeaders:[{name:'Location',value:'https://telemetry.invalid/never'}],body:''},id);return;}
  const doc=e.resourceType==='Document';const bytes=doc?Buffer.from(fixtureHtml(kind)):Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
  await this.call('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:doc?'text/html':'image/png'}],body:bytes.toString('base64')},id);
 }
};}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function negative(mode,kind){let c,config;try{c=await openGuarded(memoryClass(mode,kind),denyProxy);config=await applyLockedConfig(c);if(kind==='redirect'){await c.page.goto(c.gateway.documentURL,{waitUntil:'load',timeout:10000}).catch(()=>{});}else{await c.page.goto(c.gateway.documentURL,{waitUntil:'load',timeout:10000});
 if(kind==='POST')await c.page.evaluate(()=>fetch('/not-approved',{method:'POST'}).catch(()=>{})).catch(()=>{});
 if(kind==='external')await c.page.evaluate(()=>fetch('https://telemetry.invalid/never').catch(()=>{})).catch(()=>{});
 if(kind==='config_mutation')await c.gateway.call('Emulation.setCPUThrottlingRate',{rate:1},c.gateway.primary).catch(()=>{});
 if(kind==='loss')c.gateway.wire.close();}
 for(let n=0;n<50&&!c.gateway.stats.fatal;n++)await wait(20);
 const fatal=c.gateway.stats.fatal;const expected=kind==='config_mutation'?['AB_CONFIG_MUTATION']:kind==='loss'?['CDP_LOST']:kind==='redirect'?['REDIRECT','AB_BOUNDARY_REDIRECT','AB_BOUNDARY_RESPONSE']:['AB_BOUNDARY_REJECTED'];
 config.dispose();const cleanup=await c.cleanup();return{case:mode+'_'+kind,status:expected.includes(fatal)&&cleanup.status==='complete'?'passed':'failed',chrome:c.chrome,cleanup:cleanup.status,actual_config:config.snapshot().settings_acknowledged,reason:expected.includes(fatal)?fatal:'UNEXPECTED_FIXED_FAILURE'};
 }catch{config?.dispose();const cleanup=await c?.cleanup();return{case:mode+'_'+kind,status:'failed',reason:'CLOSED_SETUP_OR_ASSERTION',cleanup:cleanup?.status||'not-started',actual_config:false};}}
export async function closedProof(){const cases=[];let phase='BINARY';try{const binaryHash=await browserFileHash();phase='POSITIVE';
 for(const kind of ['normal','no_meta','transition','short','missing_original'])for(const mode of ['A','B']){const r=await runArm(mode,cases[0]?.chrome,{Gateway:memoryClass(mode,kind),proxyFactory:denyProxy,windowMs:5000,fixture:true,binaryHash});
 const expected={normal:'ORIGINAL_AT_BOTH_SAMPLES',no_meta:'ORIGINAL_AT_BOTH_SAMPLES',transition:'SAME_DOCUMENT_500_TRANSITION',short:'SHORT_CONTENT',missing_original:'ORIGINAL_DOM_NOT_OBSERVED_OR_OTHER'}[kind];
 const viewportExpected=kind==='no_meta'?{meta:'ABSENT',layout:'NOT_COMPARED',screen:'MATCH',dpr:'MATCH'}:{meta:'PRESENT',layout:'MATCH',screen:'MATCH',dpr:'MATCH'};
 const viewportOk=['first','end'].every(k=>JSON.stringify(r.samples?.[k]?.viewport)===JSON.stringify(viewportExpected));
 const c={case:mode+'_'+kind,status:r.status==='completed'&&r.samples?.classification===expected&&viewportOk?'passed':'failed',chrome:r.chrome,cleanup:r.cleanup,actual_config:r.settings?.settings_acknowledged===true,viewport_check:viewportOk?'EXPECTED_CLASSIFICATION':'UNKNOWN_OR_DIFFERENT',classification:r.samples?.classification||'UNKNOWN',reason:r.reason||'UNKNOWN'};cases.push(c);if(c.status!=='passed')throw Error();}
 phase='NEGATIVE';for(const kind of ['POST','external','redirect','config_mutation','loss'])for(const mode of ['A','B']){const c=await negative(mode,kind);cases.push(c);if(c.status!=='passed')throw Error();}
 if(await browserFileHash()!==binaryHash)throw Error();const result={kind:'closed-ab-real-chrome-proof',status:'passed',sha:workflowSha(),fingerprint:await safetyFingerprint(),chrome:cases[0].chrome,binary_sha256:binaryHash,cases,finished_ms:Date.now(),upstream_connections:0,live_navigations:0,readback:true};const text=JSON.stringify(result);await writeFile('ab-closed-proof.json',text,{mode:0o600});if(await readFile('ab-closed-proof.json','utf8')!==text)throw Error();return result;
 }catch{return{kind:'closed-ab-real-chrome-proof',status:'failed',phase,cases,sha:workflowSha(),upstream_connections:0,live_navigations:0,readback:false};}}
if(process.argv[1]===new URL(import.meta.url).pathname){const r=await closedProof();await writeFile('ab-closed-proof.json',JSON.stringify(r),{mode:0o600});console.log(JSON.stringify(r));if(r.status!=='passed')process.exitCode=1;}
