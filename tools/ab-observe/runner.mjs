import {openGuarded} from '../cdp-startup-diagnostic/fixture-runner.mjs';
import {pinnedTunnel} from '../cdp-startup-diagnostic/staging-egress.mjs';
import {installNodeLineage} from '../cdp-startup-diagnostic/node-lineage.mjs';
import {installDetachEvidence} from '../cdp-startup-diagnostic/detach-evidence.mjs';
import {installNuxtErrorEvidence} from '../cdp-startup-diagnostic/nuxt-error-evidence.mjs';
import {sealMeasurement,verifyMeasurementSeal} from '../cdp-startup-diagnostic/measurement-cutoff.mjs';
import {NoReinspectionGateway,ReinspectionGateway} from './gateway.mjs';
import {applyLockedConfig,TARGET,LIMITS,browserFileHash} from './config.mjs';
import {commonObserver,safeSample,classifyPair,comparableViewport,safeViewport} from './state.mjs';
import {writeFile,readFile} from 'node:fs/promises';
import {admit} from './admission.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const CODE=['AB_BOUNDARY_REJECTED','AB_BOUNDARY_REDIRECT','AB_BOUNDARY_RESPONSE','AB_BOUNDARY_HTML','AB_BOUNDARY_NETWORK','AB_BOUNDARY_BINDING','AB_CONFIG_MUTATION','AB_CONFIG_SCOPE','AB_DEADLINE','CHROME_SANDBOX_FAILED','POST_DEVICE_READBACK'];
export function failureCode(g){return CODE.includes(g?.stats.fatal)?g.stats.fatal:g?.stats.fatal?'GUARD_STOP':'PHASE_FAILED';}
export function publicResult(pair,sha){const count=(v,max)=>Number.isInteger(v)&&v>=0&&v<=max?v:null,phases=['OPEN','CONFIG','NAVIGATION','WINDOW','SHARED_SAMPLE','B_OBSERVERS','DISPOSE','SEAL','CLEANUP'];
 const attempts=[];for(const r of (Array.isArray(pair?.attempts)?pair.attempts:[]).slice(0,2)){
  const mode=attempts.length===0?'A':'B';const valid=r?.mode===mode;const status=valid&&r.status==='completed'?'completed':'failed';
  const a={mode,status,reason:valid&&['OBSERVED','GUARD_STOP','PHASE_FAILED',...CODE].includes(r.reason)?r.reason:'PHASE_FAILED',chrome:typeof r?.chrome==='string'&&/^(Chrome|HeadlessChrome)\/\d+\.\d+\.\d+\.\d+$/.test(r.chrome)?r.chrome:null,documents:count(r?.documents,1),http_status:count(r?.http_status,599),html:typeof r?.html==='boolean'?r.html:null,cleanup:r?.cleanup==='complete'?'complete':'not-confirmed'};
  if(status==='failed'){a.phase=phases.includes(r?.phase)?r.phase:'UNKNOWN';a.post_viewport=r?.post_viewport?{first:safeViewport(r.post_viewport.first),end:safeViewport(r.post_viewport.end)}:null;}
  else{const f=safeSample(r.samples?.first),e=safeSample(r.samples?.end),same=r.samples?.same_document===true,classification=classifyPair(f,e,same);
   a.samples={first:f,end:e,same_document:same,classification,sampling:'FIRST_POST_FCP_AND_45S_DEADLINE',between_samples:'NOT_OBSERVED'};
   a.settings={settings_acknowledged:r.settings?.settings_acknowledged===true,mobile_device_readback:r.settings?.mobile_device_readback===true,pre_navigation_screen_dpr_ua:r.settings?.pre_navigation_screen_dpr_ua==='MATCH'?'MATCH':'UNKNOWN',pre_navigation_layout_viewport:'NOT_COMPARED',network:'ACTUAL_CDP_300MS_800K_DOWN_800K_UP',cpu:'ACTUAL_CDP_X6'};
   a.b_observers={installed:mode==='B',lineage:['NOT_CONFIGURED','OBSERVED_PAIR','UNKNOWN'].includes(r.b_observers?.lineage)?r.b_observers.lineage:'UNKNOWN',nuxt:['NOT_CONFIGURED','OBSERVED_WITH_GAPS','UNKNOWN'].includes(r.b_observers?.nuxt)?r.b_observers.nuxt:'UNKNOWN'};
   a.normal_requests=count(r.normal_requests,120);a.prefetch_requests=count(r.prefetch_requests,256);a.prefetch_blocked=count(r.prefetch_blocked,256);a.fonts={expected:count(r.fonts?.expected,120),verified:count(r.fonts?.verified,120),adoptable:r.fonts?.adoptable===true};
   if(!f||!e||!same||classification==='UNKNOWN'||!comparableViewport(f.viewport)||!comparableViewport(e.viewport)||!a.settings.settings_acknowledged||!a.settings.mobile_device_readback||a.settings.pre_navigation_screen_dpr_ua!=='MATCH'||a.documents!==1||a.http_status!==200||a.html!==true||a.cleanup!=='complete'||a.fonts.adoptable!==true){a.status='failed';a.reason='PHASE_FAILED';}
  }attempts.push(a);
 }
 const complete=attempts.length===2&&attempts.every(r=>r.status==='completed')&&attempts[0].chrome&&attempts[0].chrome===attempts[1].chrome;
 return{kind:'restricted-staging-gateway-ab-observation',workflow_sha:/^[a-f0-9]{40}$/.test(sha||'')?sha:null,status:complete?'OBSERVED_PAIR':'INCOMPLETE_PAIR',attempts,causality:'NOT_ESTABLISHED',deployment_identity:'NOT_ESTABLISHED',formal_score:false,score_saved:false,report_saved:false,external_db_write:false,scope:'GATEWAY_AND_OBSERVERS_NOT_LIGHTHOUSE',html_full_body_barrier:'B_ONLY',streaming_render_order:'NOT_PROVEN',actual_throttling:{rtt_ms:300,down_kbps:800,up_kbps:800,cpu:6},sample_window_ms:LIMITS.window_ms};
}
export async function executePair(run){const attempts=[];let chrome=null;for(const mode of ['A','B']){const r=await run(mode,chrome);attempts.push(r);if(r.status!=='completed')return{status:'INCOMPLETE_PAIR',attempts,causality:'NOT_ESTABLISHED',deployment_identity:'NOT_ESTABLISHED'};if(!chrome)chrome=r.chrome;else if(chrome!==r.chrome)return{status:'INCOMPLETE_PAIR',attempts,causality:'NOT_ESTABLISHED',deployment_identity:'NOT_ESTABLISHED'};}return{status:'OBSERVED_PAIR',attempts,causality:'NOT_ESTABLISHED',deployment_identity:'NOT_ESTABLISHED'};}
// B drives the original observers' trace boundary without invoking Lighthouse or computing scores.
async function finishOwnTrace(session,g){let timer,on;const complete=new Promise((resolve,reject)=>{on=p=>{clearTimeout(timer);resolve(p);};session.once('Tracing.tracingComplete',on);timer=setTimeout(()=>{session.off('Tracing.tracingComplete',on);reject(Error('TRACE'));},10000);});complete.catch(()=>{});
 try{await session.send('Tracing.end');const event=await complete;if(!event?.stream||event.dataLossOccurred)throw Error('TRACE');let eof=false;for(let i=0;i<1024&&!eof;i++){if(g.stopping)throw Error('TRACE');const r=await session.send('IO.read',{handle:event.stream,size:65536});eof=r.eof===true;}if(!eof)throw Error('TRACE');await session.send('IO.close',{handle:event.stream});if(!g.traceReads.adoptable())throw Error('TRACE');}finally{clearTimeout(timer);session.off('Tracing.tracingComplete',on);}}
export async function runArm(mode,expectedChrome,{Gateway=mode==='A'?NoReinspectionGateway:ReinspectionGateway,proxyFactory,windowMs=LIMITS.window_ms,configure=applyLockedConfig,fixture=false,binaryHash}={}){
 let ctx,config,common,lineage,detach,errors,traceSession,timer,phase='OPEN',result,postViewport=null,localFailure=null;const started=Date.now();
 try{
  if(binaryHash&&await browserFileHash()!==binaryHash)throw Error('BINARY_CHANGED');
  ctx=await openGuarded(Gateway,proxyFactory||(()=>pinnedTunnel({onFatal:code=>ctx?.gateway.fail(code)})));
  if(expectedChrome&&expectedChrome!==ctx.chrome)throw Error('VERSION');phase='CONFIG';config=await configure(ctx);
  common=await commonObserver(ctx,TARGET);
  if(mode==='B'){detach=installDetachEvidence(ctx,TARGET);lineage=await installNodeLineage(ctx,TARGET);errors=await installNuxtErrorEvidence(ctx,TARGET);if(!errors.ready)throw Error('ERROR_OBSERVER');traceSession=await ctx.page.createCDPSession();await traceSession.send('Tracing.start',{transferMode:'ReturnAsStream',traceConfig:{recordMode:'recordAsMuchAsPossible',includedCategories:['devtools.timeline','blink.user_timing']}});}
  phase='NAVIGATION';ctx.proxy.enable?.(ctx.gateway);const dispatched=Date.now();timer=setTimeout(()=>ctx.gateway.fail('AB_DEADLINE'),LIMITS.total_ms);
  await ctx.page.goto(TARGET,{waitUntil:'domcontentloaded',timeout:LIMITS.navigation_ms});phase='WINDOW';await sleep(Math.max(0,dispatched+windowMs-Date.now()));
  phase='SHARED_SAMPLE';const samples=await common.finish();postViewport={first:safeViewport(samples.first?.viewport),end:safeViewport(samples.end?.viewport)};if(ctx.gateway.stats.fatal||ctx.gateway.boundary.documents!==1||ctx.gateway.boundary.http!==200||!ctx.gateway.boundary.html)throw Error('BOUNDARY');if(!comparableViewport(samples.first?.viewport)||!comparableViewport(samples.end?.viewport)){localFailure='POST_DEVICE_READBACK';throw Error();}
  const bObserverEvidence={installed:mode==='B',lineage:'NOT_CONFIGURED',nuxt:'NOT_CONFIGURED'};
  if(mode==='B'){phase='B_OBSERVERS';await finishOwnTrace(traceSession,ctx.gateway);await traceSession.detach();bObserverEvidence.lineage=lineage.lineage().status;bObserverEvidence.nuxt=(await errors.collect()).status;if(bObserverEvidence.lineage!=='OBSERVED_PAIR'||bObserverEvidence.nuxt==='UNKNOWN')throw Error('B_OBSERVER_UNKNOWN');}
  phase='DISPOSE';await errors?.dispose();await lineage?.dispose();detach?.dispose();common.dispose();
  phase='SEAL';const sealed=await sealMeasurement(ctx,0);const boundary=ctx.gateway.boundary.snapshot();const settings=config.snapshot();const fonts={expected:sealed.fonts.expected,verified:sealed.fonts.verified,adoptable:sealed.fonts.adoptable};
  phase='CLEANUP';config.dispose();const cleanup=await ctx.cleanup();verifyMeasurementSeal(ctx,sealed);if(cleanup.status!=='complete')throw Error('CLEANUP');if(binaryHash&&await browserFileHash()!==binaryHash)throw Error('BINARY_CHANGED');
  if(samples.same_document!==true||samples.classification==='UNKNOWN')throw Error('UNKNOWN_SAMPLE');
  result={mode,status:'completed',reason:'OBSERVED',chrome:ctx.chrome,documents:boundary.documents,http_status:boundary.http_status,html:boundary.html,settings,samples,b_observers:bObserverEvidence,normal_requests:boundary.normal_requests,prefetch_requests:boundary.prefetch_requests,prefetch_blocked:ctx.gateway.stats.prefetch_blocked,fonts,cleanup:'complete',elapsed_bucket:Date.now()-started<60000?'LT60S':'GE60S',fixture};ctx=null;
 }catch(error){await errors?.dispose().catch(()=>{});await lineage?.dispose().catch(()=>{});detach?.dispose();common?.dispose();config?.dispose();const boundary=ctx?.gateway.boundary?.snapshot();const reason=ctx?.gateway.stats.fatal?failureCode(ctx.gateway):localFailure||(error?.fixed?.phase==='CHROME_SANDBOX_FAILED'?'CHROME_SANDBOX_FAILED':failureCode(ctx?.gateway));const cleanup=await ctx?.cleanup();result={mode,status:'failed',phase,reason,post_viewport:postViewport,chrome:ctx?.chrome||null,documents:boundary?.documents??(phase==='OPEN'?0:null),http_status:boundary?.http_status??null,html:boundary?.html??null,cleanup:cleanup?.status||(error?.fixed?.cleanup==='complete'?'complete':'not-started'),fixture};}
 finally{clearTimeout(timer);}return result;
}
export async function runLiveOnce(){const admission=await admit();const binaryHash=await browserFileHash();await writeFile('ab-attempt.json',JSON.stringify({sha:process.env.GITHUB_SHA}),{flag:'wx',mode:0o600});const pair=await executePair(mode=>runArm(mode,admission.chrome,{binaryHash}));
 const result=publicResult(pair,process.env.GITHUB_SHA);
 const text=JSON.stringify(result);await writeFile('ab-observation-only.json',text,{mode:0o600,flag:'wx'});if(await readFile('ab-observation-only.json','utf8')!==text)throw Error('READBACK');console.log(text);return result;}
if(process.argv[1]===new URL(import.meta.url).pathname){if(process.argv.length!==3||process.argv[2]!=='--execute-once'){console.log('{"status":"NOT_EXECUTED","reason":"EXPLICIT_EXECUTION_REQUIRED"}');process.exitCode=1;}else try{const r=await runLiveOnce();if(r.status!=='OBSERVED_PAIR')process.exitCode=1;}catch{console.log('{"status":"NOT_EXECUTED_OR_INCOMPLETE","reason":"FIXED_FAILURE","score_saved":false}');process.exitCode=1;}}
