// No live entry, admission bootstrap, API, DNS or forwarding factory is invoked.
import {runAll,browserCase} from '../cloudflare-socket-closed/browser.mjs';
import {runCFControls,validCFProof} from '../staging-first-scope/native.mjs';
import {browserFileHash} from '../ab-observe/config.mjs';import {postFlushOpen} from '../connect-postflush-closed/open.mjs';
import {emptyCondition,fault,saveCondition} from './record.mjs';import {snapshot as network} from '../connect-postflush-closed/net-guard.mjs';
export async function condition(condition,scope,binary,{open=postFlushOpen,hash=browserFileHash,alone,registered,prelude=runPrelude,write=saveCondition,net=network}={}){
 const v=emptyCondition(condition,scope,binary);let writes=0;const save=()=>{v.network=net();if(++writes>128)throw Error('CLOSED_RECORD');write(v);};
 const check=async c=>{if(await hash()!==binary)throw Error('CLOSED_BINARY');if(c.chrome){if(v.chrome&&v.chrome!==c.chrome)throw Error('CLOSED_BINARY');v.chrome=c.chrome;}save();};
 const opener=async(G,f)=>{if(await hash()!==binary)throw Error('CLOSED_BINARY');const c=await open(G,f);try{await check(c);return c;}catch(e){await c.cleanup();throw e;}};
 try{v.status='STARTED';v.phase='START';save();if(await hash()!==binary)throw Error('CLOSED_BINARY');
  if(condition==='SEQUENCE'){await prelude(v,{scope,binary,hash,save});if(v.prelude.some(r=>r.status!=='PASSED'||r.cleanup!=='COMPLETE'))throw Error('CLOSED_PRELUDE');}
  v.phase=condition==='ALONE'?'ALONE':'REGISTERED';save();const onCase=cases=>{v.cases=cases;save();};
  if(condition==='ALONE'){const r=await (alone??(o=>runAll({hash,run:(mode,c)=>browserCase(mode,c,{open:opener}),onCase:o.onCase})))({onCase});v.cases=r.cases;if(v.chrome&&v.chrome!==r.chrome)throw Error('CLOSED_BINARY');v.chrome=r.chrome;if(r.status!=='passed'||!r.same_binary)throw Error('CLOSED_CASES');}
  else{const r=await (registered??(o=>runCFControls({...o,open:opener,hash})))({scope,binary,chrome:v.chrome,onCase:row=>{const i=v.cases.findIndex(r=>r.case===row.case);if(i<0)throw Error('CLOSED_RECORD');v.cases[i]=row;save();}});v.cases=r.cases;if(!validCFProof(r,scope,binary,v.chrome))throw Error('CLOSED_CASES');}
  v.same_binary=await hash()===binary;if(!v.same_binary)throw Error('CLOSED_BINARY');v.phase='COMPLETE';v.status='PASSED';save();return v;
 }catch(e){fault(v,e);try{save();}catch{}return v;}
}
export async function runPrelude(v,{scope,binary,hash,save}){
 // The exact Slot36 prelude functions and order; their reject-only proxy is
 // deliberately unchanged. Only the later five controls use the post-flush hook.
 // Node22 can observe an uninitialized shared fixture binding when these module
 // graphs are dynamically linked concurrently. Fully initialize each in order.
 const modules=[];
 for(const path of ['../native-score-proof/main.mjs','../native-score-proof/state.mjs','../proxy-cleanup-evidence/native.mjs','../proxy-cleanup-evidence/cleanup-evidence.mjs','../natural-reads/scoped400-browser.mjs','../native-score-proof/score.mjs','../standalone-score/closed.mjs','../script-owner/native.mjs'])modules.push(await import(path));
 const [{executeClosed},{createJournal},{observedNative},{evidence},{runScoped400Browser},{closedScore},{runCounterparts,validCounterparts},{runOwnerControls,validOwnerProof}]=modules;
 const cell=(name,status,cleanup,proxy)=>{const r=v.prelude.find(r=>r.case===name);if(!r)throw Error('CLOSED_PRELUDE');if(r.status!==status||r.cleanup!==cleanup||proxy&&JSON.stringify(r.proxy)!==JSON.stringify(proxy)){r.status=status;r.cleanup=cleanup;if(proxy)r.proxy=proxy;save();}};
 const mark=(name,r)=>cell(name,r.status==='passed'||r.status==='PASSED'?'PASSED':'FAILED',r.cleanup==='complete'||r.cleanup==='COMPLETE'||r.physical_cleanup===true?'COMPLETE':r.cleanup==='failed'||r.cleanup==='FAILED'||r.physical_cleanup===false?'FAILED':'UNKNOWN');
 const [{openGuarded},{proxyState}]=await Promise.all([import('../cdp-startup-diagnostic/fixture-runner.mjs'),import('../proxy-cleanup-evidence/cleanup-evidence.mjs')]);let currentName=null;
 const unchangedOpen=async(G,f)=>{const name=currentName,c=await openGuarded(G,f),close=c.cleanup;c.cleanup=async()=>{try{return await close();}finally{if(name){const row=v.prelude.find(x=>x.case===name);cell(name,row.status,row.cleanup,proxyState(c.proxy.snapshot()));}}};return c;};
 const j=createJournal(scope,{write:()=>{}});const ok=await executeClosed({j,
  native:async j=>{v.phase='NATIVE';save();const n=await observedNative(j,{diagnostics:evidence(scope,{write:d=>{for(const r of d.cases)if(r.point!=='NOT_REACHED')cell(r.case,r.original_status==='passed'?'PASSED':r.point==='STARTED'?'STARTED':r.point==='NOT_RUN_CONFIRMED'?'NOT_RUN':'FAILED',r.cleanup_result==='complete'?'COMPLETE':r.cleanup_result==='failed'?'FAILED':'UNKNOWN',r.proxy);}})});for(const r of n.cases)mark(r.case,r);return n;},
  budget:async()=>{v.phase='CAP400';save();const b=await runScoped400Browser();for(const r of b.cases)mark('cap_'+r.case,r);return b;},
  score:async()=>{v.phase='SCORE';cell('synthetic_score','STARTED','UNKNOWN');currentName='synthetic_score';const s=await closedScore({open:unchangedOpen});mark('synthetic_score',s);return s;}});
 if(!ok||j.snapshot().recording!=='COMPLETE_PREFIX'||await hash()!==binary)throw Error('CLOSED_PRELUDE');v.chrome=j.snapshot().score.chrome;
 v.phase='COUNTERPARTS';save();const counters=await runCounterparts({scope,binary,chrome:v.chrome,hash,open:unchangedOpen,onCase:r=>{currentName='counterpart_'+r.case;if(r.point==='STARTED')cell(currentName,'STARTED','UNKNOWN');else mark('counterpart_'+r.case,r);}});if(!validCounterparts(counters,scope,binary,v.chrome))throw Error('CLOSED_PRELUDE');
 v.phase='OWNERS';save();const owners=await runOwnerControls({scope,binary,chrome:v.chrome,hash,open:unchangedOpen,onCase:r=>{currentName='owner_'+r.case;if(r.point==='STARTED')cell(currentName,'STARTED','UNKNOWN');else mark('owner_'+r.case,r);}});if(!validOwnerProof(owners,scope,binary,v.chrome)||await hash()!==binary)throw Error('CLOSED_PRELUDE');
}
