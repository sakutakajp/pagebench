// CLOSED ONLY. Logical URLs identify fixed memory responses; no upstream transport exists.
import {openGuarded} from '../cdp-startup-diagnostic/fixture-runner.mjs';
import {NoReinspectionGateway} from '../ab-observe/gateway.mjs';
import {BoundPrefetchCandidate} from './bound-prefetch.mjs';
import {TARGET,applyLockedConfig,browserFileHash} from '../ab-observe/config.mjs';
import {fixedFatal} from './evidence.mjs';
import {rejectOnlyProxy} from './natural-prefetch-proxy.mjs';
import {NaturalObservation,fixedHtml,MODES,SPEC,META} from './natural-prefetch-state.mjs';
import {writeFile,readFile,rename} from 'node:fs/promises';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const PHASES=['BINARY','AUTHLESS_PROFILE','PROXY_SETUP','CHROME_START','CHROME_START_FAILED','CHROME_SANDBOX_FAILED','DEVTOOLS_FILE_TIMEOUT','DEVTOOLS_FILE_INVALID','DEVTOOLS_FILE_UNREADABLE','CDP_CONNECT','ROOT_GUARD','PUPPETEER_CONNECT','BOUND_PAGE'];
export function memoryGateway(mode){const Parent=mode==='original_natural'?NoReinspectionGateway:BoundPrefetchCandidate;return class extends Parent{
 constructor(...args){super(...args);this.natural=new NaturalObservation(this);const send=this.wire.send;this.wire.send=raw=>{try{this.natural.command(JSON.parse(raw));}catch{this.fail('AB_BOUNDARY_BINDING');return;}return send.call(this.wire,raw);};}
 async receive(raw){try{if(typeof raw==='string'&&raw.length<=1048576){const m=JSON.parse(raw);if(m.method==='Fetch.requestPaused')this.natural.paused(m.params);this.natural.event(m);}}catch{this.fail('AB_BOUNDARY_BINDING');}return super.receive(raw);}
 async start(e){
  if(this.stopping)return;
  if(e.request.url===TARGET&&e.resourceType==='Document'&&e.request.method==='GET'){
   this.natural.counters.document_fulfills++;await this.call('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/html'},{name:'Cache-Control',value:'no-store'}],body:Buffer.from(fixedHtml(mode)).toString('base64')},this.primary);return;
  }
  if(e.request.url===META&&e.resourceType==='Fetch'&&e.request.method==='GET'){
   this.natural.counters.metadata_fulfills++;await this.call('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Cache-Control',value:'no-store'}],body:Buffer.from('{"fixed":true}').toString('base64')},this.primary);return;
  }
  this.natural.counters.unexpected_resource_starts++;this.fail('AB_BOUNDARY_REJECTED');
 }
};}
export function classifyCase(mode,facts){
 if(facts.startup)return'STARTUP_FAILED';
 const n=facts.natural,c=n?.counters;
 if(!c||!facts.proxy||facts.proxy.forwarding_capability!=='ABSENT'||facts.proxy.upstream_sockets_opened!==0||c.spec_continue_commands!==0||c.spec_fulfill_commands!==0||c.unexpected_resource_starts!==0)return'SAFETY_FAILED';
 if(facts.cleanup!=='complete'||facts.proxy.closed!==true||facts.proxy.open_sockets!==0)return'CLEANUP_FAILED';
 if(c.document_fulfills!==1||facts.http_status!==200||facts.html!==true)return'DOCUMENT_NOT_CONFIRMED';
 if(mode==='original_natural')return n.fetch_events===1&&c.spec_abort_commands===1&&c.spec_abort_ack===1&&facts.fatal==='AB_BOUNDARY_REJECTED'&&c.metadata_fulfills===0?'ORIGINAL_SCOPE_STOP':'ORIGINAL_CONTROL_UNCONFIRMED';
 if(mode==='candidate_natural'){
  if(!n.fetch_events)return'NO_NATURAL_REQUEST_OBSERVED';
  return facts.fatal===null&&n.mismatch.length===0&&facts.discard?.abort_acked===1&&facts.discard.pending===0&&facts.discard.retained_bindings===0&&facts.discard.retained_ack_bindings===0&&c.spec_abort_commands===1&&c.spec_abort_ack===1&&c.metadata_fulfills===1&&facts.metadata?.network_eof===true&&facts.fixture_metadata_js_read===true?'NATURAL_BINDING_AND_METADATA_CONFIRMED':'NATURAL_BINDING_MISMATCH';
 }
 return facts.fatal==='AB_BOUNDARY_REJECTED'&&n.fetch_events===1&&c.spec_abort_commands===1&&c.spec_abort_ack===1&&c.metadata_fulfills===0&&facts.discard?.abort_acked===0?'UNAPPROVED_REQUEST_STOPPED':'NEGATIVE_UNCONFIRMED';
}
async function runCase(mode,expectedChrome){let c,config,proxy,stage='OPEN',startup=null,cleanup='not-started',jsRead=null,chrome=null,natural=null,discard=null,metadata=null,fatal=null,http=null,html=null;
 try{
  c=await openGuarded(memoryGateway(mode),async()=>proxy=await rejectOnlyProxy());chrome=c.chrome;
  if(expectedChrome&&chrome!==expectedChrome)throw Error('VERSION_CHANGED');stage='CONFIG';config=await applyLockedConfig(c);stage='DOCUMENT';
  await c.page.goto(TARGET,{waitUntil:'domcontentloaded',timeout:12000}).catch(()=>{});stage='OBSERVATION';
  const end=Date.now()+8000;
  while(!c.gateway.stopping&&Date.now()<end){
   if(mode==='candidate_natural'&&c.gateway.natural.counters.metadata_fulfills===1){if(c.gateway.stopping)break;jsRead=await c.page.evaluate(()=>window.fixedFixture?.metadata_done===true).catch(()=>null);if(jsRead===true)break;}
   if(!mode.endsWith('_natural')&&c.gateway.stopping)break;await pause(100);
  }
 }catch(e){if(!c)startup={phase:PHASES.includes(e?.fixed?.phase)?e.fixed.phase:'UNKNOWN',cleanup:e?.fixed?.cleanup==='complete'?'complete':'unknown'};else stage='CASE_FAILED';}
 finally{
  if(c){let disposeFailed=false;try{config?.dispose();}catch{disposeFailed=true;}try{const r=await c.cleanup();cleanup=!disposeFailed&&r?.status==='complete'?'complete':'failed';}catch{cleanup='failed';}
   natural=c.gateway.natural.snapshot();discard=c.gateway.discardSnapshot?.()??null;metadata=c.gateway.stopEvidence.meta.snapshot();fatal=c.gateway.stats.fatal?fixedFatal(c.gateway.stats.fatal):null;http=Number.isInteger(c.gateway.boundary.http)?c.gateway.boundary.http:null;html=c.gateway.boundary.html===true;
  }else cleanup=startup?.cleanup||'unknown';
 }
 const proxyStats=proxy?.snapshot()??null;
 const result={case:mode,source:mode.endsWith('_natural')?'PARSER_LINK_PREFETCH_NO_HEADER_OVERRIDE':'SCRIPT_NEGATIVE_CONTROL',stage,chrome:/^(Chrome|HeadlessChrome)\/\d+\.\d+\.\d+\.\d+$/.test(chrome||'')?chrome:null,startup,cleanup,proxy:proxyStats,natural,discard,metadata,http_status:http,html,fatal,fixture_metadata_js_read:jsRead,upstream_route:'ABSENT_MEMORY_ONLY',real_site_navigations:0,score_saved:false};
 result.outcome=classifyCase(mode,result);result.status=['ORIGINAL_SCOPE_STOP','NATURAL_BINDING_AND_METADATA_CONFIRMED','UNAPPROVED_REQUEST_STOPPED'].includes(result.outcome)?'passed':'failed';return result;
}
export async function runClosed({caseRunner=runCase,hash=browserFileHash}={}){const cases=[];let binary=null,reason='UNKNOWN',same=false;
 try{binary=await hash();let chrome=null;for(const mode of MODES){const r=await caseRunner(mode,chrome);cases.push(r);if(r.chrome&&!chrome)chrome=r.chrome;if(r.startup||['SAFETY_FAILED','CLEANUP_FAILED'].includes(r.outcome)){reason=r.outcome;break;}}
  same=await hash()===binary;reason=cases.length===MODES.length&&cases.every(c=>c.status==='passed')&&same?'ALL_CLOSED_CONTROLS_PASSED':reason==='UNKNOWN'?'CLOSED_MISMATCH_OR_INCOMPLETE':reason;
 }catch{reason='CLOSED_RUN_FAILED';}
 return{kind:'natural-prefetch-closed-proof',status:reason==='ALL_CLOSED_CONTROLS_PASSED'?'passed':'failed',reason,workflow_sha:/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA||'')?process.env.GITHUB_SHA:null,executable_sha256:binary,same_executable_after:same,cases,not_run:MODES.filter(m=>!cases.some(c=>c.case===m)),observations:'FIXED_ENUMS_AND_COUNTS_ONLY',synthetic_memory_documents:true,real_site_navigations:0,forwarding_route:'ABSENT',lighthouse_invoked:false,score_saved:false,report_saved:false};
}
export async function saveFixed(result,path='natural-prefetch-closed-proof.json'){const text=JSON.stringify(result);await writeFile(path+'.tmp',text,{mode:0o600});await rename(path+'.tmp',path);if(await readFile(path,'utf8')!==text)throw Error('READBACK');}
if(process.argv[1]===new URL(import.meta.url).pathname){let r;try{if(process.argv.length!==2)throw Error('NO_INPUTS');r=await runClosed();await saveFixed(r);console.log(JSON.stringify(r));}catch{r={kind:'natural-prefetch-closed-proof',status:'failed',reason:'FIXED_SAVE_OR_RUN_FAILED',real_site_navigations:0,score_saved:false};console.log(JSON.stringify(r));}if(r.status!=='passed')process.exitCode=1;}
