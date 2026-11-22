// CLOSED real-Chrome fixture candidate. No upstream-capable proxy or live CLI.
import {NaturalReadGateway} from './gateway.mjs';import {TARGET,classifyRequest} from './policy.mjs';import {PAGE,PAYLOAD,ASSET,META} from './control.mjs';
import {openGuarded} from '../cdp-startup-diagnostic/fixture-runner.mjs';import {applyLockedConfig,browserFileHash} from '../ab-observe/config.mjs';import {rejectOnlyProxy} from '../nuxt-debug/natural-prefetch-proxy.mjs';import {finishArm} from '../nuxt-debug/cleanup.mjs';
import{safeEvidence}from'../nuxt-debug/evidence.mjs';import{FixtureStopProof,nativeVerdict,EXPECTED_STOP}from'./fixture-stop.mjs';import{createRequire}from'node:module';import{pathToFileURL}from'node:url';
import{NEGATIVE_ARM_DELAY_MS,armNegativeFixture,validArmAck,waitForFixtureStop}from'./negative-arm.mjs';
export const BROWSER_MODES=['ordinary_reads','natural_prefetch','post','unapproved_api','external','navigation'];
const IMAGE='https://image.hirameki.dev/fixture.webp';
export function fixtureHtml(mode){if(!BROWSER_MODES.includes(mode))throw Error('MODE');let action;
 const init='<script>window.fixedState={ready:false,prefetch:0};window.fixedRender=function(){document.querySelector("h1").textContent="Fixed hydrated main ready";window.fixedState.ready=true};</script>',urls=[PAGE,PAYLOAD,ASSET];
 if(mode==='natural_prefetch')action=urls.map(u=>'<link rel="prefetch" href="'+u+'" onload="window.fixedState.prefetch++">').join('')+'<script>fetch('+JSON.stringify(META)+',{credentials:"omit"}).then(r=>r.json()).then(()=>window.fixedRender())</script>';
 else if(mode==='ordinary_reads')action='<script>Promise.all('+JSON.stringify([...urls,META])+'.map(u=>fetch(u,{credentials:"omit"}).then(r=>r.text()))).then(()=>window.fixedRender())</script>';
 else{const command=mode==='navigation'?'location.href='+JSON.stringify(PAGE):'fetch('+JSON.stringify(mode==='external'?'https://other.invalid/fixture':mode==='unapproved_api'?'https://staging.hirameki.dev/api/users':META)+','+(mode==='post'?'{method:"POST",body:"fixed"}':'{credentials:"omit"}')+').catch(()=>{})';action='<script>window.fixedRender();let fixedArmed=false;window.fixedArmNegative=function(){if(fixedArmed)return{state:"DUPLICATE",scheduled:false};fixedArmed=true;setTimeout(()=>{'+command+'},'+NEGATIVE_ARM_DELAY_MS+');return{state:"ARMED",scheduled:true}}</script>';}
 return '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,">'+init+'</head><body><main id="home-content"><h1 id="home-title">Fixed closed natural loading fixture</h1><p>Fixed local fixture only, not site content.</p><img src="'+IMAGE+'"></main>'+action+'</body></html>';
}
export function memoryGateway(mode){return class extends NaturalReadGateway{
 constructor(...args){super(...args);this.delivered={html:0,page:0,payload:0,asset:0,metadata:0,image:0};this.fixtureStop=new FixtureStopProof(this,mode);const check=this.boundary.check.bind(this.boundary),send=this.wire.send.bind(this.wire);this.boundary.check=e=>{const decision=check(e);if(decision!=='ALLOW')this.fixtureStop.rejected(decision,e);return decision;};this.wire.send=raw=>this.fixtureStop.sent(raw,()=>send(raw));}
 async receive(raw){this.fixtureStop?.received(raw);return super.receive(raw);}
 fail(code){if(!this.stopping)this.fixtureStop?.fatal();return super.fail(code);}
 beginCleanup(){this.fixtureStop.beginCleanup();return super.beginCleanup();}
 async start(e){if(this.stopping)return;const c=classifyRequest(e);if(c.code!=='ALLOW'||!this.boundary.network.has(e.networkId)){this.fail('AB_BOUNDARY_BINDING');return;}let body,type,key;
  if(e.request.url===TARGET){key='html';type='text/html';body=fixtureHtml(mode);}else if(e.request.url===PAGE){key='page';type='text/html';body='<!doctype html><h1>Fixed prefetched page</h1>';}else if(e.request.url===PAYLOAD){key='payload';type='application/json';body='{"fixed":true}';}else if(e.request.url===ASSET){key='asset';type='text/javascript';body='window.fixedAsset=true';}else if(e.request.url===META){key='metadata';type='application/json';body='{"title":"Fixed metadata"}';}else if(e.request.url===IMAGE){key='image';type='image/png';body=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aBfkAAAAASUVORK5CYII=','base64');}else{this.fail('AB_BOUNDARY_REJECTED');return;}
  this.active.add(e.networkId);this.stats.max_inflight=Math.max(this.stats.max_inflight,this.active.size);this.delivered[key]++;await this.call('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:type},{name:'Cache-Control',value:'public,max-age=60'}],body:Buffer.from(body).toString('base64')},this.primary);
 }
};}
// Only actual pinned Puppeteer error prototypes are recognized, never their messages/names.
async function browserError(e){try{const require=createRequire(new URL('../lighthouse-once/package.json',import.meta.url)),p=await import(pathToFileURL(require.resolve('puppeteer-core')).href);const proto=Object.getPrototypeOf(e);if(proto===p.TargetCloseError.prototype)return'TARGET_CLOSED';if(proto===p.ConnectionClosedError.prototype)return'CONNECTION_CLOSED';}catch{}return'UNKNOWN_EXCEPTION';}
export async function closedBrowserCase(mode,chrome,{open=openGuarded,configure=applyLockedConfig,classifyError=browserError,pause=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 let c,config,proxy,state=null,cleanup,reason='UNCONFIRMED',startup=null,phase='OPEN',firstError=null,negativeFlow={initial_navigation:'NOT_COMPLETED',initial_visible:false,arm_reply:'NOT_SENT',stop_wait:'NOT_STARTED'};
 const stage=p=>{phase=p;c?.gateway.fixtureStop.stage(p);c?.gateway.stopEvidence.stage(({GOTO:'NAVIGATION',READINESS_SAMPLE:'SHARED_SAMPLE',RUNTIME_ENABLE:'CONFIG',CLASSIFY:'SEAL',ARM_COMMAND:'SHARED_SAMPLE',WAIT_STOP:'WINDOW',DONE:'FINISHED'})[p]||p);};
 const caught=async e=>{const code=await classifyError(e);firstError??={phase,code:['TARGET_CLOSED','CONNECTION_CLOSED'].includes(code)?code:'UNKNOWN_EXCEPTION'};};
 try{
  c=await open(memoryGateway(mode),()=>rejectOnlyProxy().then(p=>(proxy=p)));if(chrome&&c.chrome!==chrome)throw Error();
  stage('CONFIG');config=await configure(c);stage('RUNTIME_ENABLE');await c.gateway.call('Runtime.enable',{},c.gateway.primary);c.gateway.readSignals.runtimeReady();
  stage('GOTO');try{await c.page.goto(TARGET,{waitUntil:'domcontentloaded',timeout:12000});}catch(e){await caught(e);}
  const negative=Object.hasOwn(EXPECTED_STOP,mode),primary=c.gateway.primary,owner=c.gateway.sessions.get(primary),frame=owner?.frame;
  const healthy=()=>!c.gateway.stopping&&!c.gateway.stats.fatal&&c.gateway.primary===primary&&c.gateway.sessions.get(primary)===owner&&owner?.ready===true&&owner.frame===frame;
  if(firstError)throw Error('FIXED_INITIAL_NAVIGATION_FAILED');negativeFlow.initial_navigation='COMPLETED';
  const end=Date.now()+8000;
  while(healthy()&&Date.now()<end){stage('READINESS_SAMPLE');state=await c.page.evaluate(()=>({ready:window.fixedState?.ready===true,prefetch:window.fixedState?.prefetch??0,rendered:document.querySelector('h1')?.textContent==='Fixed hydrated main ready'&&document.querySelector('h1').getClientRects().length>0}));if(state.ready&&(mode!=='natural_prefetch'||state.prefetch===3))break;await pause(100);}
  if(negative){const b=c.gateway.boundary.snapshot();negativeFlow.initial_visible=b.documents===1&&b.http_status===200&&b.html===true&&healthy()&&state?.ready===true&&state.rendered===true&&c.page.url()===TARGET;
   if(!negativeFlow.initial_visible||c.gateway.fixtureStop.snapshot().candidate_count!==0)throw Error('FIXED_INITIAL_RENDER_FAILED');
   stage('ARM_COMMAND');negativeFlow.arm_reply='AWAITING_REPLY';const ack=await c.page.evaluate(armNegativeFixture);
   if(!healthy()||!validArmAck(ack)||c.gateway.fixtureStop.snapshot().candidate_count!==0)throw Error('FIXED_ARM_ACK_FAILED');
   negativeFlow.arm_reply='ACKNOWLEDGED';c.gateway.fixtureStop.bindArm();stage('WAIT_STOP');negativeFlow.stop_wait=await waitForFixtureStop(c.gateway,{pause});
   // No browser command, URL read or DOM sample after arming. Wait is Node RAM only.
  }
  stage('CLASSIFY');reason=c.gateway.stats.fatal?'STOPPED':negative?'UNCONFIRMED':state?.ready&&state.rendered===true&&(mode!=='natural_prefetch'||state.prefetch===3)&&c.page.url()===TARGET?'RENDERED_SAME_DOCUMENT':'UNCONFIRMED';
 }catch(e){await caught(e);startup=c?null:{phase:['BINARY','CHROME_SANDBOX_FAILED','CHROME_START_FAILED','DEVTOOLS_FILE_TIMEOUT'].includes(e?.fixed?.phase)?e.fixed.phase:'UNKNOWN'};reason=c?.gateway.stats.fatal?'STOPPED':'FAILED_OR_UNCONFIRMED';}
 finally{stage('CLEANUP');cleanup=await finishArm(c,[()=>config?.dispose()]);stage('DONE');}
 const p=proxy?.snapshot()??null,b=c?.gateway.boundary.snapshot()??null,e=safeEvidence(c?.gateway.stopEvidence?.snapshot()),proof=c?.gateway.fixtureStop.snapshot()??null;
 const verdict=nativeVerdict({mode,reason,error:firstError,proof,evidence:e,boundary:b,delivered:c?.gateway.delivered,proxy:p,cleanup:cleanup.status,pending:c?.gateway.pending.size??null,negative_flow:negativeFlow});
 return{case:mode,chrome:c?.chrome??null,startup,reason,...verdict,phase,negative_flow:negativeFlow,first_exception:firstError,evidence:e,stop_proof:proof,boundary:b?{documents:b.documents,http_status:b.http_status,html:b.html,total_requests:b.total_requests,boundary_reason:b.boundary_reason}:null,delivered:c?.gateway.delivered??null,js_rendered:state?.rendered===true,signals:c?.gateway.readSignals.snapshot()??null,proxy:p,cleanup:cleanup.status,fresh_profile:true,real_site_navigations:0,score_saved:false};
}
export async function runClosedBrowser({run=closedBrowserCase,hash=browserFileHash}={}){
 const initialHash=await hash(),cases=[];let chrome=null,stopped=false;
 for(const mode of BROWSER_MODES){if(stopped){cases.push({case:mode,status:'not_run',reason:'PREVIOUS_UNCERTAIN_SAFETY_OR_FAILURE'});continue;}const r=await run(mode,chrome);cases.push(r);chrome??=r.chrome;if(r.continuation!=='SAFE_CLOSED_NEXT_CASE')stopped=true;}
 let stable=false;try{stable=await hash()===initialHash;}catch{}
 return{kind:'CLOSED_NATURAL_READS_NOT_LIVE',status:cases.every(r=>r.status==='passed')&&stable?'passed':'failed',cases,continuation:!stopped&&stable?'SAFE_CLOSED_NEXT_SUITE':'STOP_UNCERTAIN_SAFETY_OR_FAILURE',live_eligible:false,real_site_navigations:0,score_saved:false};
}
