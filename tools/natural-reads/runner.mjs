// No CLI, default live opener, workflow or scoring. A future remote invocation needs review.
import {NaturalReadGateway} from './gateway.mjs';
import {TARGET,routeEvidence} from './policy.mjs';
import {applyLockedConfig,LIMITS} from '../ab-observe/config.mjs';
import {commonObserver} from '../ab-observe/state.mjs';
import {installNuxtErrorEvidence,safeNuxtErrorEvidence} from '../cdp-startup-diagnostic/nuxt-error-evidence.mjs';
import {sealMeasurement,verifyMeasurementSeal} from '../cdp-startup-diagnostic/measurement-cutoff.mjs';
import {finishArm} from '../nuxt-debug/cleanup.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export async function observeNaturalReads({open,proxyFactory,fixture=false,windowMs=LIMITS.window_ms}={}){
 if(typeof open!=='function'||typeof proxyFactory!=='function'||!fixture&&windowMs!==LIMITS.window_ms)throw Error('EXPLICIT_REVIEWED_OPENER_REQUIRED');
 let c,config,common,errors,sealed,timer,samples=null,nuxt=safeNuxtErrorEvidence(null),phase='OPEN',failed=true;
 try{c=await open(NaturalReadGateway,proxyFactory);phase='CONFIG';config=await applyLockedConfig(c);common=await commonObserver(c,TARGET);errors=await installNuxtErrorEvidence(c,TARGET);if(!errors.ready)throw Error();await c.gateway.call('Runtime.enable',{},c.gateway.primary);if(c.gateway.stopping)throw Error();c.gateway.readSignals.runtimeReady();
  phase='NAVIGATION';c.proxy.enable?.(c.gateway);timer=setTimeout(()=>c.gateway.fail('AB_DEADLINE'),LIMITS.total_ms);const start=Date.now();await c.page.goto(TARGET,{waitUntil:'domcontentloaded',timeout:LIMITS.navigation_ms});phase='WINDOW';await sleep(Math.max(0,start+windowMs-Date.now()));
  phase='OBSERVATION';samples=await common.finish();nuxt=safeNuxtErrorEvidence(await errors.collect());if(c.gateway.stopping||c.gateway.stats.fatal||!samples.first||!samples.end||samples.same_document!==true)throw Error();
  phase='SEAL';await errors.dispose();common.dispose();sealed=await sealMeasurement(c,0);failed=false;
 }catch{failed=true;}
 finally{clearTimeout(timer);}
 let configuration=null;try{configuration=config?.snapshot()??null;}catch{failed=true;}const boundary=c?.gateway.boundary.snapshot()??null;const cleanup=await finishArm(c,[()=>errors?.dispose(),()=>common?.dispose(),()=>config?.dispose()]);
 try{if(sealed)verifyMeasurementSeal(c,sealed);}catch{failed=true;}
 const signals=c?.gateway.readSignals.snapshot()??null;if(signals?.coverage!=='SCOPED_WINDOW_WITH_PRE_CONTEXT_GAP')failed=true;
 return{kind:'NATURAL_READS_NUXT_DIAGNOSTIC_NOT_SCORE',status:!failed&&cleanup.status==='complete'?'OBSERVED':'FAILED_OR_UNKNOWN',phase,chrome:/^(Chrome|HeadlessChrome)\/\d+\.\d+\.\d+\.\d+$/.test(c?.chrome||'')?c.chrome:null,configuration,documents:boundary?.documents??(phase==='OPEN'?0:null),http_status:boundary?.http_status??null,html:boundary?.html??null,total_requests:boundary?.total_requests??null,boundary_reason:boundary?.boundary_reason??null,samples,nuxt_error:nuxt,passive_signals:signals,stop_evidence:cleanup.evidence,cleanup:cleanup.status,route_catalog:routeEvidence,fresh_profile_required:true,score_saved:false,report_saved:false,observation_scope:'FIXED_SIGNALS_WITH_REPORTED_GAPS',causality:'NOT_ESTABLISHED',fixture};
}
