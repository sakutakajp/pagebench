// TEST ONLY. Real entry/default CLOSED callback and LIVE factory; controlled
// browser/CDP/LHR, real loopback proxy/process/files. Never native Chrome proof.
import assert from 'node:assert/strict';
import fs from 'node:fs';import {Readable} from 'node:stream';
import {registerHooks,syncBuiltinESMExports} from 'node:module';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createHash} from 'node:crypto';import net from 'node:net';import {once} from 'node:events';
const mode=process.argv[2];assert(['CLOSED_OK','CLOSED_EARLY_RST','PRECHECK','LIVE_OK','LIVE_REFUSAL'].includes(mode));
assert(!('GITHUB_TOKEN'in process.env));
const root=process.cwd(),dir=mkdtempSync(join(tmpdir(),'slot42-wiring-'));
const binaryBytes=Buffer.from('CLOSED_TEST_HASH_NOT_A_BROWSER'),binary=createHash('sha256').update(binaryBytes).digest('hex'),originalRead=fs.createReadStream;
fs.createReadStream=function(p,...a){return p==='/opt/google/chrome/chrome'?Readable.from([binaryBytes]):Reflect.apply(originalRead,this,[p,...a]);};syncBuiltinESMExports();
// Initialize test model before registering the single opener seam; production
// entry and its selected postFlushOpen import still load afterward, in order.
const {model}=await import('../native-proxy-order/model.mjs');
const {isPostFlushProxy}=await import('../connect-postflush-closed/proxy.mjs');
const {install,snapshot}=await import('../connect-postflush-closed/net-guard.mjs');install();
const target=new URL('../cdp-startup-diagnostic/fixture-runner.mjs',import.meta.url).href,shim=new URL('./wiring-shim.mjs',import.meta.url).href;
const hook=registerHooks({resolve(spec,ctx,next){const r=next(spec,ctx);if(r.url===target&&ctx.parentURL!==shim)return{url:shim,shortCircuit:true};return r;}});
let opens=0,decorated=0,liveEnable=0,controls=0,nativeProof,peer,liveControl,liveRow,stage;
const m=model({variant:'baseline'});
try{
 const {run}=await import('./entry.mjs');
 const {fixture,S}=await import('./test-fixtures.mjs');
 const {createReceipt}=await import('./records.mjs');
 const {createJournal}=await import('../native-score-proof/state.mjs');
 const {admitClosed}=await import('./admission.mjs');
 const {controlled,BINARY}=await import('./control.mjs');
 const f=await fixture();Object.assign(process.env,f.env);process.chdir(dir);
 globalThis.__PB_SLOT42_OPEN=async(G,factory)=>{
  opens++;
  const c=mode.startsWith('LIVE')?await liveControl.open(G,factory):await m.open(G,factory);
  if(isPostFlushProxy(c.proxy))decorated++;
  if(mode.startsWith('LIVE')){assert(!isPostFlushProxy(c.proxy));assert.equal(typeof c.proxy.enable,'function');liveEnable++;}
  else assert(isPostFlushProxy(c.proxy));
  if(mode==='CLOSED_EARLY_RST'){
   peer=net.connect({host:'127.0.0.1',port:Number(new URL(c.proxy.url).port),allowHalfOpen:true});peer.on('error',()=>{});peer.setTimeout(1000,()=>peer.destroy());await once(peer,'connect');peer.write('CONNECT fixed');await new Promise(r=>setTimeout(r,15));peer.resetAndDestroy();
   for(let n=0;n<100&&c.proxy.snapshot().socket_errors===0;n++)await new Promise(r=>setTimeout(r,5));
   assert.equal(c.proxy.snapshot().first_socket_fault.stage,'ACCEPTED');
  }
  return c;
 };
 if(mode.startsWith('LIVE')){
  for(const[p,v]of Object.entries(f.files))if(!p.startsWith('tools/'))writeFileSync(p,JSON.stringify(v),{mode:0o600});
  const write=f.options.io.write;f.options.io.write=(p,v)=>{write(p,v);writeFileSync(p,JSON.stringify(v),{mode:0o600,flag:'wx'});};
  liveControl=controlled(mode==='LIVE_OK'?'versioned_beacon':'cf_image_denied');
  const record=createReceipt('LIVE',f.env),state={record,j:null,live:null,emergency:null};
  const ok=await run('LIVE',{record,state,admit:o=>admitClosed({...f.options,...o}),liveDependencies:{hash:async()=>BINARY,lighthouse:liveControl.lighthouse,proxyOptions:{lookup:async()=>[{address:'104.16.1.2',family:4}],connect:()=>{throw Error('NO_UPSTREAM');}}}});
  record.exit(ok?0:1);state.live?.exit(ok?0:1);liveRow=state.live?.snapshot().result;
  if(process.version==='v22.19.0'){
   assert.equal(opens,1);assert.equal(liveEnable,1);assert.equal(decorated,0);assert.equal(ok,mode==='LIVE_OK');assert.equal(liveRow.cleanup,'COMPLETE');assert.equal(liveRow.policy_limit,400);assert(liveRow.max_inflight<=6);
   if(mode==='LIVE_REFUSAL'){assert.equal(liveRow.first_refusal.category,'SCOPE');assert.equal(liveRow.performance,null);}
  }else{assert.equal(ok,false);assert.equal(opens,0);assert.equal(decorated,0);assert.equal(liveRow.status,'NOT_RUN');}
  stage=ok?'CONTROLLED_LIVE_PASSED':'CONTROLLED_LIVE_REJECTED';
 }else{
  const record=createReceipt(mode==='PRECHECK'?'PRECHECK':'JIT',f.env),state={record,j:null,live:null,emergency:null};
  const ok=await run(mode==='PRECHECK'?'PRECHECK':'JIT',{record,state,admit:async()=>S,hash:async()=>binary,makeJournal:s=>createJournal(s,{write:()=>{}}),controls:async({j,native})=>{controls++;nativeProof=await native(j);j.native(nativeProof);return false;}});
  if(mode==='PRECHECK'){assert.equal(ok,true);assert.equal(controls,0);assert.equal(opens,0);}
  else{assert.equal(ok,false);assert.equal(controls,1);assert.equal(state.live,null);assert.equal(opens,mode==='CLOSED_OK'?6:1);assert.equal(decorated,opens);assert.equal(nativeProof.status,mode==='CLOSED_OK'?'passed':'failed');assert(m.physical.every(p=>p.process_closed&&p.profile_deleted&&p.wire_closed&&p.proxy_closed&&p.open_sockets===0));if(mode==='CLOSED_EARLY_RST')assert(nativeProof.cases.slice(1).every(p=>p.status==='not_run'));}
  stage=mode==='PRECHECK'?'PRECHECK_ONLY':'INTENTIONAL_TEST_CUT_AFTER_FIRST_SIX';
 }
 const n=snapshot();assert.equal(n.dns_attempts,0);assert.equal(n.blocked_connects,0);
 process.stdout.write(JSON.stringify({kind:'SLOT42_CONTROLLED_WIRING',case:mode,node:process.version,passed:true,stage,opens,postflush_selected:decorated,live_enable_capability:liveEnable,native_status:nativeProof?.status??'NOT_RUN',native_cases:nativeProof?.cases.filter(x=>x.status!=='not_run').length??0,upstream:0,site_requests:0,network:n,real_chrome:false,score_saved:false,report_saved:false})+'\n');
}finally{peer?.destroy();delete globalThis.__PB_SLOT42_OPEN;hook.deregister();process.chdir(root);rmSync(dir,{recursive:true,force:true});}
