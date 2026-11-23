import{mkdtemp,mkdir,rm}from'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';
import{captureGateway,persistCaptureState,finalizeOriginOutput,readOriginSummary}from'./retry-output.mjs';
// Test entry only: fixed RAM content, reject-only proxy with NO upstream/DNS client.
// No live mode, URL input, score, report, remote workflow or site access function.
import {generateKeyPairSync} from 'node:crypto';
import {openGuarded} from '../cdp-startup-diagnostic/fixture-runner.mjs';
import {closed400MemoryGateway} from '../natural-reads/startup400-gateway.mjs';
import {rejectOnlyProxy} from '../nuxt-debug/natural-prefetch-proxy.mjs';
import {finishArm} from '../nuxt-debug/cleanup.mjs';
import {applyLockedConfig} from '../ab-observe/config.mjs';
import {TARGET} from '../natural-reads/policy.mjs';
import {instrumentOrigin} from './retry-observer.mjs';
import {openOrigin,REF} from './retry-crypto.mjs';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
export async function runClosedOrigin(){
  const pair=generateKeyPairSync('rsa',{modulusLength:3072,publicExponent:65537,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
  const cases=[];let stopped=false;
  for(const mode of ['normal','rejected_script']){
    if(stopped){cases.push({case:mode,status:'NOT_RUN',reason:'PREVIOUS_UNCONFIRMED'});continue;}
    let directory,publicDirectory,publicReadback=false,directoryCleanup='unknown',c,config,proxy,phase='OPEN',failure=null,openCleanup='NOT_REPORTED',cleanup,initial=false,armed=false,loaded=false,matched=false,sealed=null,abortSent=0,abortAck=0,pageErrors=0;
    const scope={repository:'sakutakajp/pagebench',ref:REF,sha:/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA||'')?process.env.GITHUB_SHA:'a'.repeat(40),run_id:'CLOSED_BROWSER',attempt:1,mode:'CLOSED'};
    const dummy='https://rejected-origin.invalid:9443/fixture.js';
    const selected=mode==='normal'?'https://staging.hirameki.dev/_nuxt/fixture-cap-repeat.js':dummy;
    class Memory extends closed400MemoryGateway('within'){
      constructor(...a){super(...a);let requestId=null;const call=this.call;
        this.call=async(method,p,s)=>{const target=method==='Fetch.failRequest'&&s===this.primary&&p?.requestId===requestId;if(target)abortSent++;const v=await Reflect.apply(call,this,[method,p,s]);if(target)abortAck++;return v;};
        const request=this.request;this.request=function(e,s){if(e?.request?.url===selected&&e.resourceType==='Script'&&s===this.primary)requestId=e.requestId;return Reflect.apply(request,this,[e,s]);};
      }
      async start(e){if(e.request.url!==TARGET)return super.start(e);if(this.stopping)return;
        const html='<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><main><h1>Closed origin fixture</h1><p>Known fixed visible content longer than twenty characters.</p></main><script>window.fixtureLoaded=false;window.beginOriginFixture=()=>{setTimeout(()=>{const s=document.createElement("script");s.src='+JSON.stringify(selected)+';s.onload=()=>window.fixtureLoaded=true;document.head.appendChild(s)},250);return"ARMED"}</script>';
        this.active.add(e.networkId);this.stats.max_inflight=Math.max(this.stats.max_inflight,this.active.size);
        await this.call('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/html'},{name:'Cache-Control',value:'public,max-age=0'}],body:Buffer.from(html).toString('base64')},this.primary);
      }
    }
    try{
      directory=await mkdtemp(join(tmpdir(),'pagebench-origin-proof-'));publicDirectory=join(directory,'public');await mkdir(publicDirectory,{mode:0o700});
      c=await openGuarded(instrumentOrigin(captureGateway(Memory,{directory,scope}),{publicKey:pair.publicKey,scope,emit:v=>{sealed=v;}}),async()=>proxy=await rejectOnlyProxy());
      c.page.on('pageerror',()=>pageErrors++);phase='CONFIG';config=await applyLockedConfig(c);c.gateway.stopEvidence.stage('NAVIGATION');phase='NAVIGATION';
      await c.page.goto(TARGET,{waitUntil:'domcontentloaded',timeout:12000});initial=await c.page.evaluate(()=>document.body.innerText.trim().length>=20&&document.querySelector('h1').getClientRects().length>0);
      if(!initial||c.gateway.stopping)throw Error();phase='ARM';armed=await c.page.evaluate(()=>window.beginOriginFixture())==='ARMED';phase='WAIT';const end=Date.now()+5000;
      while(!c.gateway.stopping&&Date.now()<end){if(mode==='normal'){loaded=await c.page.evaluate(()=>window.fixtureLoaded===true);if(loaded)break;}await pause(20);}
      if(sealed){const v=openOrigin(sealed,pair.privateKey,scope);matched=v.scheme==='https:'&&v.hostname==='rejected-origin.invalid'&&v.port==='9443'&&v.userinfo==='ABSENT';}
    }catch(e){const fixed=Object.getOwnPropertyDescriptor(e,'fixed')?.value;openCleanup=['complete','failed','not-started'].includes(fixed?.cleanup)?fixed.cleanup:'UNKNOWN';failure=['BINARY','AUTHLESS_PROFILE','PROXY_SETUP','CHROME_START','CHROME_SANDBOX_FAILED','CHROME_START_FAILED','DEVTOOLS_FILE_TIMEOUT','DEVTOOLS_FILE_INVALID','DEVTOOLS_FILE_UNREADABLE','DEVTOOLS_EARLY_EXIT','CDP_CONNECT','ROOT_GUARD','PUPPETEER_CONNECT','BOUND_PAGE'].includes(fixed?.phase)?fixed.phase:phase;}
    finally{cleanup=c?await finishArm(c,[()=>config?.dispose()]):null;try{persistCaptureState(directory,c?.gateway?.originCapture?.(),scope);const s=finalizeOriginOutput({directory,scope,firstRefusal:c?.gateway?.stopEvidence.refusal??null,output:publicDirectory});publicReadback=JSON.stringify(readOriginSummary(publicDirectory,scope))===JSON.stringify(s)&&(mode==='normal'?s.outcome==='NO_ENVELOPE_UNCONFIRMED'&&s.capture_state==='NOT_OBSERVED':s.outcome==='SEALED_BOUND_FIRST_REFUSAL'&&s.capture_state==='SEALED');}catch{failure??='FILE_READBACK';}try{if(directory)await rm(directory,{recursive:true,force:true});directoryCleanup='complete';}catch{directoryCleanup='failed';}}
    const p=proxy?.snapshot(),g=c?.gateway,first=g?.stopEvidence.refusal,safe=p?.forwarding_capability==='ABSENT'&&p.upstream_sockets_opened===0&&p.closed===true&&p.open_sockets===0&&cleanup?.status==='complete'&&publicReadback&&directoryCleanup==='complete';
    const expected=mode==='normal'?loaded&&!sealed&&!g?.stats.fatal:matched&&abortSent===1&&abortAck===1&&first?.category==='ORIGIN'&&first.method==='GET'&&first.resource_type==='Script'&&g?.stats.fatal==='AB_BOUNDARY_REJECTED';
    cases.push({case:mode,status:!failure&&safe&&initial&&armed&&pageErrors===0&&expected?'passed':'failed',failure_phase:failure,browser_initialized:!!c,opener_cleanup:openCleanup,initial_visible:initial,armed,loaded,origin_tuple_match:matched,abort_sent:abortSent,abort_ack:abortAck,page_error_count:pageErrors,public_output_readback:publicReadback,local_directory_cleanup:directoryCleanup,cleanup:cleanup?.status??'NOT_ENTERED_OPENER_OWNS_CLEANUP',proxy:p?{forwarding:p.forwarding_capability,upstream:p.upstream_sockets_opened,closed:p.closed,open_sockets:p.open_sockets}:null,chrome:c?.chrome??null,guard:{fatal:g?.stats.fatal===null||g?.stats.fatal===undefined?null:g.stats.fatal==='AB_BOUNDARY_REJECTED'?'AB_BOUNDARY_REJECTED':'OTHER_GUARD_FAILURE',receiver_active:cleanup?.evidence?.receiver_active??null,receiver_rejections:cleanup?.evidence?.receiver_rejections??null,secondary_failures:cleanup?.evidence?.secondary_failures??null,emergency:cleanup?.evidence?.emergency??'UNKNOWN'},first_refusal:first?{category:first.category,method:first.method,resource_type:first.resource_type}:null,real_site_navigations:0,score_saved:false,report_saved:false});
    if(!safe||failure)stopped=true;
  }
  return{kind:'CLOSED_ORIGIN_REAL_BROWSER_PROOF',status:cases.length===2&&cases.every(c=>c.status==='passed')?'passed':'failed',cases,external_forwarding_capability:'ABSENT',real_site_navigations:0,score_saved:false,report_saved:false};
}
if(process.argv[1]===new URL(import.meta.url).pathname){if(process.argv.length!==3||process.argv[2]!=='--closed-no-upstream'){process.exitCode=1;}else{const r=await runClosedOrigin();console.log(JSON.stringify(r));if(r.status!=='passed')process.exitCode=1;}}
