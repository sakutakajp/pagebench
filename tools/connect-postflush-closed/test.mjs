// LOCAL ONLY. Actual loopback TCP; controlled CDP is explicitly not real Chrome.
// Historical source-pin/admission/workflow updates are intentionally out of scope.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import {once} from 'node:events';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {rejectOnlyProxy as baseline} from '../nuxt-debug/natural-prefetch-proxy.mjs';
import {postFlushProxy,isPostFlushProxy,proxyState} from './proxy.mjs';
import {controlledCase,controlledAll} from './control.mjs';
import {controlledCase as baselineCase} from '../cloudflare-socket-closed/control.mjs';
const proposed=()=>postFlushProxy(baseline),BASE='c205c2eeaa2b2a90ebcf5208d366f3c1d44bf4b6';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const response=Buffer.from('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');
const connectBytes='CONNECT fixture.invalid:443 HTTP/1.1\r\nHost: fixture.invalid:443\r\n\r\n';
const evidence=[];
async function until(check,label){for(let i=0;i<200;i++){if(check())return;await pause(5);}throw Error(label);}
async function owned(factory,partial=false){
 let socket,serverClose=false;const original=http.createServer;
 http.createServer=function(...args){const s=Reflect.apply(original,this,args);s.prependListener('connection',v=>{socket=v;v.once('close',()=>serverClose=true);});return s;};
 let proxy;try{proxy=await factory();}finally{http.createServer=original;}
 const peer=net.connect({host:'127.0.0.1',port:Number(new URL(proxy.url).port),allowHalfOpen:true});peer.on('error',()=>{});peer.setTimeout(1500,()=>peer.destroy(Error('CLOSED_PEER_TIMEOUT')));
 await once(peer,'connect');await until(()=>!!socket,'ACCEPT_TIMEOUT');
 if(partial){const read=once(socket,'data');peer.write('CONNECT fixed');await read;}
 else{const received=once(peer,'data');peer.write(connectBytes);const [data]=await received;assert(data.equals(response));}
 return {proxy,peer,socket,closed:()=>serverClose,async finish(){peer.destroy();await proxy.close().catch(()=>{});assert.equal(proxy.snapshot().closed,true);assert.equal(proxy.snapshot().open_sockets,0);assert.equal(proxy.snapshot().upstream_sockets_opened,0);}};
}
function fixed(proxy){const s=proxy.snapshot();return {errors:s.socket_errors,fault:s.first_socket_fault,closed:s.closed,open:s.open_sockets,upstream:s.upstream_sockets_opened};}

test('all inherited source and policies remain exact; only a closed wrapper decorates the factory',()=>{
 for(const path of ['tools/nuxt-debug/natural-prefetch-proxy.mjs','tools/cloudflare-socket-closed/browser.mjs','tools/cloudflare-socket-closed/fixture.mjs','tools/cloudflare-socket-closed/control.mjs','tools/cdp-startup-diagnostic/cleanup.mjs','tools/cdp-startup-diagnostic/fixture-runner.mjs','tools/staging-cloudflare-origin/closed-only-gateway.mjs','tools/staging-cloudflare-origin/policy.mjs','tools/staging-first-scope/native.mjs'])assert(readFileSync(resolve(root,path)).equals(execFileSync('git',['show',BASE+':'+path],{cwd:root})));
 const original=readFileSync(resolve(root,'tools/cloudflare-socket-closed/control.mjs'),'utf8').replaceAll("from'./","from'../cloudflare-socket-closed/").replace('c.open(G,f)','c.open(G,()=>postFlushProxy(f))');
 assert.equal(readFileSync(new URL('./control.mjs',import.meta.url),'utf8'),"// TEST ONLY relocated model; only the proxy factory is decorated.\nimport {postFlushProxy} from './proxy.mjs';\n"+original);
});
for(const [name,factory] of [['baseline',baseline],['proposed',proposed]]){
 test(name+' real post-response reset x12; no upstream',async()=>{
  for(let n=0;n<12;n++){
   const x=await owned(factory);try{
    if(name==='proposed')await until(x.closed,'POST_FLUSH_CLOSE_TIMEOUT');else{await pause(15);assert.equal(x.closed(),false);assert.equal(x.socket.writableEnded,true);assert.equal(x.socket.readableEnded,false);}
    x.peer.resetAndDestroy();await pause(20);
    if(name==='baseline'){
     await until(()=>x.proxy.snapshot().socket_errors===1,'REAL_RST_NOT_OBSERVED');const f=x.proxy.snapshot().first_socket_fault;
     assert.deepEqual(f,{resource:'ACCEPTED_DOWNSTREAM_PROXY_SOCKET',code:'ECONNRESET',stage:'CONNECT_HANDOFF',lifecycle:'ACTIVE'});
     await assert.rejects(x.proxy.close(),{message:'CLOSED_PROXY_SOCKET_FAULT'});
    }else{await x.proxy.close();assert.equal(x.proxy.snapshot().socket_errors,0);}
    evidence.push({case:'POST_RESPONSE_RST',variant:name,iteration:n,...fixed(x.proxy)});
   }finally{await x.finish();}
  }
 });
 test(name+' real reset before CONNECT handoff stays fatal',async()=>{
  const x=await owned(factory,true);try{x.peer.resetAndDestroy();await until(()=>x.proxy.snapshot().socket_errors>0,'EARLY_RST_NOT_OBSERVED');assert.equal(x.proxy.snapshot().first_socket_fault.stage,'ACCEPTED');assert.equal(x.proxy.snapshot().first_socket_fault.code,'ECONNRESET');await assert.rejects(x.proxy.close(),{message:'CLOSED_PROXY_SOCKET_FAULT'});evidence.push({case:'EARLY_REAL_RST',variant:name,...fixed(x.proxy)});}finally{await x.finish();}
 });
 test(name+' normal peer FIN and idempotent close',async()=>{
  const x=await owned(factory);try{x.peer.end();await until(x.closed,'NORMAL_CLOSE_TIMEOUT');await x.proxy.close();await x.proxy.close();assert.equal(x.proxy.snapshot().socket_errors,0);}finally{await x.finish();}
 });
}
for(const phase of ['ACTIVE','CLOSING'])test('proposed retains actual listener error and strict failure '+phase,async()=>{
 const x=await owned(proposed,true);try{let close;if(phase==='CLOSING')close=x.proxy.close();x.socket.emit('error',Object.assign(Error('FIXED_CONTROL_NOT_OUTPUT'),{code:'EPIPE'}));await assert.rejects(close||x.proxy.close(),{message:'CLOSED_PROXY_SOCKET_FAULT'});assert.equal(x.proxy.snapshot().first_socket_fault.code,'EPIPE');assert.equal(x.proxy.snapshot().first_socket_fault.lifecycle,phase);evidence.push({case:'CONTROLLED_LISTENER_ERROR_'+phase,variant:'proposed',...fixed(x.proxy)});}finally{await x.finish();}
});
for(const [name,run] of [['baseline',baselineCase],['proposed',controlledCase]])for(const moment of ['BEFORE_ARM','ABORT_ACK_PENDING'])test(name+' actual fixture entry plus real TCP reset '+moment,async()=>{
 let peer,scheduled=false,completed=false;
 try{
  const out=await run('image',{configure:async ctx=>{
   peer=net.connect({host:'127.0.0.1',port:Number(new URL(ctx.proxy.url).port),allowHalfOpen:true});peer.on('error',()=>{});peer.setTimeout(1500,()=>peer.destroy(Error('CLOSED_PEER_TIMEOUT')));await once(peer,'connect');const data=once(peer,'data');peer.write(connectBytes);assert((await data)[0].equals(response));await pause(15);
   if(moment==='BEFORE_ARM'){peer.resetAndDestroy();await pause(30);completed=true;}
   else{const send=ctx.gateway.wire.send;ctx.gateway.wire.send=function(raw){const m=JSON.parse(raw);if(m.method==='Fetch.failRequest'){assert(!scheduled);scheduled=true;peer.resetAndDestroy();let turns=0;const ack=()=>{if(name==='baseline'&&ctx.proxy.snapshot().socket_errors===0&&turns++<16){setImmediate(ack);return;}completed=true;Reflect.apply(send,this,[raw]);};setImmediate(ack);return;}return Reflect.apply(send,this,[raw]);};}
  }});
  const r=out.row;assert(completed);assert.equal(r.reason,'EXPECTED_BLOCK');assert.equal(r.stop.first.category,'SCOPE');assert.equal(r.stop.first.type,'Image');assert.equal(r.stop.first.bound,true);assert.equal(r.stop.first.fixture_match,true);assert.equal(r.stop.ack,1);assert.equal(r.stop.forwarded,0);assert.equal(r.proxy.upstream,0);assert.equal(r.proxy.open,0);assert(r.proxy.closed);assert(r.wire_closed);assert.equal(r.diagnostics.cleanup_stages.PROCESS_EXIT,'PROCESS_EXIT_CONFIRMED');assert.equal(r.diagnostics.cleanup_stages.PROFILE_DELETE,'PROFILE_DELETED');
  if(name==='baseline'){assert.equal(r.status,'failed');assert.equal(r.physical_cleanup,false);assert.equal(r.proxy.socket_errors,1);assert.equal(r.diagnostics.proxy.first_socket_fault.code,'ECONNRESET');assert.equal(r.diagnostics.proxy.first_socket_fault.stage,'CONNECT_HANDOFF');assert.equal(r.diagnostics.proxy.first_socket_fault.lifecycle,'ACTIVE');}
  else{assert.equal(r.status,'passed');assert(r.physical_cleanup);assert.equal(r.proxy.socket_errors,0);}
  evidence.push({case:'ACTUAL_FIXTURE_CONTROLLED_CDP_'+moment,variant:name,status:r.status,reason:r.reason,ack:r.stop.ack,forwarded:r.stop.forwarded,proxy:r.proxy,diagnostics:r.diagnostics});
 }finally{peer?.destroy();}
});
test('unchanged natural prefetch and all five original fixture controls pass with controlled CDP',async()=>{const r=await controlledAll();assert.equal(r.status,'passed');assert.equal(r.cases.length,5);assert(r.cases.every(c=>c.status==='passed'&&c.proxy.socket_errors===0&&c.physical_cleanup));evidence.push({case:'ORIGINAL_FIVE_CONTROLLED_CDP',count:5,status:r.status});});
test('actual entry still fails and halts group on a genuine early socket error',async()=>{
 const {runAll}=await import('../cloudflare-socket-closed/browser.mjs');let peer;
 try{const r=await runAll({hash:async()=> 'a'.repeat(64),run:mode=>controlledCase(mode,mode==='image'?{configure:async ctx=>{peer=net.connect({host:'127.0.0.1',port:Number(new URL(ctx.proxy.url).port),allowHalfOpen:true});peer.on('error',()=>{});peer.setTimeout(1500,()=>peer.destroy(Error('CLOSED_PEER_TIMEOUT')));await once(peer,'connect');// No server interception: reset after the incomplete HTTP reaches the peer.
 peer.write('CONNECT fixed');await pause(20);peer.resetAndDestroy();await until(()=>ctx.proxy.snapshot().socket_errors>0,'EARLY_RST_NOT_OBSERVED');}}:{})});assert.equal(r.cases[0].status,'passed');assert.equal(r.cases[1].status,'failed');assert.equal(r.cases[1].proxy.socket_errors,1);assert(r.cases.slice(2).every(c=>c.point==='NOT_RUN'));evidence.push({case:'EARLY_FAULT_HALTS_GROUP',status:r.status,next_not_run:3});}finally{peer?.destroy();}
});
test('HTTP CONNECT and Upgrade stay rejected; independent local sink receives zero requests',async()=>{
 let arrivals=0;const sink=http.createServer((_q,r)=>{arrivals++;r.end();});await new Promise(r=>sink.listen(0,'127.0.0.1',r));const p=await proposed();
 try{const port=Number(new URL(p.url).port),destination='127.0.0.1:'+sink.address().port;
  for(const [method,path,headers] of [['GET','http://'+destination+'/fixed',{}],['CONNECT',destination,{}],['GET','/fixed',{Connection:'Upgrade',Upgrade:'websocket'}]])await new Promise((done,fail)=>{const q=http.request({host:'127.0.0.1',port,method,path,headers},r=>{assert.equal(r.statusCode,403);r.resume();r.on('end',done);});q.on('connect',(r,s)=>{assert.equal(r.statusCode,403);s.destroy();done();});q.on('error',e=>e.code==='ECONNRESET'?done():fail(Error('FIXED_HTTP_FAILED')));q.on('close',done);q.setTimeout(1500,()=>{q.destroy();fail(Error('CLOSED_HTTP_TIMEOUT'));});q.end();});
  await p.close();assert.equal(arrivals,0);const s=p.snapshot();assert.equal(s.http_rejected,1);assert.equal(s.connect_rejected,1);assert.equal(s.upgrade_rejected,1);assert.equal(s.socket_errors,0);assert.equal(s.open_sockets,0);assert.equal(s.upstream_sockets_opened,0);assert.equal(typeof p.enable,'undefined');evidence.push({case:'INDEPENDENT_SINK',requests:arrivals,upstream:0,rejections:3});
 }finally{await p.close().catch(()=>{});await new Promise(r=>sink.close(r));}
});
test('fixed local proof serialization contains no TCP bytes or raw error text',()=>{
 const out={kind:'LOCAL_CONNECT_LIFECYCLE',node:process.version,source:'REAL_LOOPBACK_TCP_WITH_CONTROLLED_CDP',real_chrome:false,historical_causality:'UNPROVEN',upstream_connections:0,evidence};const text=JSON.stringify(out);
 for(const value of ['fixture.invalid','CONNECT fixed','HTTP/1.1','FIXED_CONTROL_NOT_OUTPUT','https://'])assert(!text.includes(value));
 if(process.env.CP_TEST_PROOF)writeFileSync(process.env.CP_TEST_PROOF,text+'\n',{mode:0o600});
});

import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawnSync} from 'node:child_process';
import {condition as produce} from './runner.mjs';import {runParent,runChild,childEnv} from './entry.mjs';import {scope,REF,SUBJECT,DIR,UNITS,TESTS,WORKFLOW} from './config.mjs';import {admit,unitsValid} from './admission.mjs';import {safeCondition,saveCondition,readCondition,save,PRELUDE} from './record.mjs';
const S={sha:'a'.repeat(40),run:'12345',ref:REF,attempt:1},BINARY='b'.repeat(64),CHROME='Chrome/157.0.8103.78';
const env={GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'sakutakajp/pagebench',GITHUB_REF:REF,GITHUB_SHA:S.sha,GITHUB_RUN_ID:S.run,GITHUB_RUN_ATTEMPT:'1',GITHUB_EVENT_NAME:'push',GITHUB_EVENT_PATH:'EVENT',CHROME_PATH:'/opt/google/chrome/chrome'};
function admissionFixture(){const units={kind:'CONNECT_POSTFLUSH_UNITS',sha:S.sha,status:'passed',groups:['v24.19.0','v22.19.0'].map(node=>({node,tests:TESTS,pass:TESTS,fail:0,skipped:0,cancelled:0,todo:0,status:'passed'}))},files={EVENT:{created:true,forced:false,deleted:false,head_commit:{id:S.sha,message:SUBJECT}},[DIR+'/source-pins.json']:{parent:BASE,files:{FIXED:'c'.repeat(64)}},[DIR+'/added-paths.json']:['FIXED'],[UNITS]:units};let consumed=false;return{files,options:{env,version:'v22.19.0',io:{read:p=>{if(!(p in files))throw Error('MISSING');return files[p]},git:(...a)=>a[0]==='rev-parse'?a[1]==='HEAD^'?BASE:S.sha:a[0]==='rev-list'?'1':a[0]==='show'?SUBJECT:a[0]==='diff'&&a[1]==='--name-status'?'A\tFIXED':'',hash:()=> 'c'.repeat(64),write(){if(consumed)throw Error('DUPLICATE');consumed=true;}}}};}
const modelOptions={hash:async()=>BINARY,net:()=>({installed:true,loopback_connects:1,blocked_connects:0,dns_attempts:0}),prelude:async v=>{v.chrome=CHROME;for(const r of v.prelude){r.status='PASSED';r.cleanup='COMPLETE';}},alone:({onCase})=>controlledAll({onCase}),registered:async({scope,binary,chrome,onCase})=>{const r=await controlledAll({onCase:cases=>cases.filter(r=>r.point!=='NOT_RUN').forEach(onCase)});return{kind:'SELECTED_POLICY_NATIVE_PROOF',policy_id:'staging-ja-cloudflare-script-400-v1',scope,binary,chrome,status:r.status,cases:r.cases,score_saved:false,report_saved:false};}};
async function tmp(fn){const cwd=process.cwd(),dir=mkdtempSync(join(tmpdir(),'postflush-fixed-test-'));try{process.chdir(dir);return await fn(dir);}finally{process.chdir(cwd);rmSync(dir,{recursive:true,force:true});}}
test('actual admission checks same-shaped evidence and rejects duplicate consume',()=>{const x=admissionFixture();assert.deepEqual(admit(x.options),S);assert.throws(()=>admit(x.options));assert(unitsValid(x.files[UNITS],S.sha));});
for(const field of ['scope','event','source','units'])test('admission failure '+field+' reaches no child',async()=>tmp(async()=>{const x=admissionFixture();if(field==='scope')x.options.env={...env,GITHUB_TOKEN:'FIXED_NOT_OUTPUT'};if(field==='event')x.files.EVENT.created=false;if(field==='source')x.files[DIR+'/source-pins.json'].parent='0'.repeat(40);if(field==='units')x.files[UNITS].groups[0].pass=-1;let children=0;assert.equal(await runParent({env,admission:opt=>admit({...x.options,onStage:opt.onStage}),hash:async()=>BINARY,child:async()=>{children++;}}),false);assert.equal(children,0);}));
test('actual condition producer and filesystem readback through actual publisher CLI; controlled-CDP model only',async()=>tmp(async()=>{let children=0;const x=admissionFixture();const ok=await runParent({env,admission:opt=>admit({...x.options,onStage:opt.onStage}),hash:async()=>BINARY,child:async c=>{children++;const v=await produce(c,S,BINARY,modelOptions);assert.equal(v.status,'PASSED');assert(safeCondition(v));assert.deepEqual(readCondition(c),v);return{state:'EXIT_0',group_stop:'NOT_NEEDED'};}});assert(ok);assert.equal(children,2);const r=spawnSync(process.execPath,[resolve(root,DIR,'entry.mjs'),'--publish'],{encoding:'utf8'});assert.equal(r.status,0);assert.equal(r.stderr,'');const v=JSON.parse(r.stdout);assert.equal(v.status,'PASSED');assert.equal(v.conditions[1].prelude.length,13);assert(!r.stdout.includes('fixture.invalid'));assert.equal((await import('node:fs/promises')).readFile!==undefined,true);}));
test('nonzero child cannot publish pass even after a passed condition; next child not run',async()=>tmp(async()=>{let count=0;await runParent({env,admission:opt=>admit({...admissionFixture().options,onStage:opt.onStage}),hash:async()=>BINARY,child:async c=>{count++;await produce(c,S,BINARY,modelOptions);return{state:'EXIT_NONZERO_OR_UNKNOWN',group_stop:'REQUESTED'};}});assert.equal(count,1);const r=spawnSync(process.execPath,[resolve(root,DIR,'entry.mjs'),'--publish'],{encoding:'utf8'});const v=JSON.parse(r.stdout);assert.equal(v.status,'FAILED_OR_UNKNOWN');assert.equal(v.conditions[0].status,'PASSED');assert.equal(v.conditions[1].status,'UNKNOWN');}));
test('wrong binary or missing prelude cannot admit or publish passed result',async()=>{const a=await produce('ALONE',S,BINARY,{...modelOptions,hash:async()=> 'c'.repeat(64),write:()=>{}});assert.equal(a.status,'FAILED');const b=await produce('SEQUENCE',S,BINARY,{...modelOptions,prelude:async()=>{},write:()=>{}});assert.equal(b.status,'FAILED');assert(b.cases.every(r=>r.point==='NOT_RUN'));});
test('malformed foreign or extra fixed evidence never publishes',async()=>tmp(async()=>{const v=await produce('ALONE',S,BINARY,modelOptions);for(const change of [x=>x.raw='PRIVATE',x=>x.scope.ref='foreign',x=>x.cases[1].stop.ack=0,x=>x.network.dns_attempts=1,x=>x.prelude[0].status='PASSED']){const bad=structuredClone(v);change(bad);assert.equal(safeCondition(bad),null);}writeFileSync('connect-postflush-ALONE.json','partial');assert.equal(readCondition('ALONE'),null);const r=spawnSync(process.execPath,[resolve(root,DIR,'entry.mjs'),'--publish'],{encoding:'utf8'});assert.equal(JSON.parse(r.stdout).conditions[0].status,'UNKNOWN');}));
test('child cannot start without an exclusive scoped permit and admitted parent',async()=>tmp(()=>{const call=()=>spawnSync(process.execPath,[resolve(root,DIR,'entry.mjs'),'--condition-alone'],{env:{...env,PATH:process.env.PATH},encoding:'utf8'});assert.equal(call().status,1);writeFileSync('connect-postflush-ALONE.permit',JSON.stringify({scope:S,binary:BINARY,condition:'ALONE'}),{mode:0o600});const r=call();assert.equal(r.status,1);assert.equal(r.stdout,'');assert.equal(r.stderr,'');}));
test('factory hook is synchronous exclusive and restores http intrinsic; failed factory never passes',async()=>{const orig=http.createServer;await assert.rejects(postFlushProxy(()=>{throw Error('FIXED_CONTROL')}));assert.equal(http.createServer,orig);const p=await proposed();try{assert(isPostFlushProxy(p));assert.equal(http.createServer,orig);assert.equal(proxyState(p).invalid_handoffs,0);}finally{await p.close();}await assert.rejects(postFlushProxy(()=>({snapshot:()=>({forwarding_capability:'PRESENT',upstream_sockets_opened:1})})));assert.equal(http.createServer,orig);});
test('independent Node guard permits actual loopback and denies DNS/nonloopback without sending',()=>{const script="const {install,snapshot}=await import("+JSON.stringify(new URL('./net-guard.mjs',import.meta.url).href)+");const net=await import('node:net'),dns=await import('node:dns');install();let denied=0;try{net.connect({host:'192.0.2.1',port:443})}catch{denied++}try{dns.lookup('fixture.invalid',()=>{})}catch{denied++}if(denied!==2)process.exitCode=1;process.stdout.write(JSON.stringify(snapshot()));";const r=spawnSync(process.execPath,['--unhandled-rejections=strict','--input-type=module','-e',script],{encoding:'utf8'});assert.equal(r.status,0);assert.equal(r.stderr,'');const n=JSON.parse(r.stdout);assert.equal(n.blocked_connects,1);assert.equal(n.dns_attempts,1);assert.equal(n.loopback_connects,0);});
test('strict one-use closed workflow and all old workflows remain immutable',()=>{const s=readFileSync(resolve(root,WORKFLOW),'utf8');assert(s.includes('fetch-depth: 6'));assert(s.includes('contents: read'));assert(s.includes('persist-credentials: false'));assert(s.includes(REF.slice(11)));assert(s.includes(SUBJECT));assert(!/workflow_dispatch|workflow_run|GITHUB_TOKEN|actions: read|--measure-once|staging-first-scope\/bootstrap/.test(s));const list=execFileSync('git',['ls-tree','-r','--name-only',BASE,'.github/workflows'],{cwd:root,encoding:'utf8'}).trim().split('\n');for(const p of list)assert(readFileSync(resolve(root,p)).equals(execFileSync('git',['show',BASE+':'+p],{cwd:root})));});
import {modelOpener} from './open-model.mjs';
test('real default runner reaches actual registered adapter and unchanged boundary under controlled CDP',async()=>tmp(async()=>{
 for(const c of ['ALONE','SEQUENCE']){const v=await produce(c,S,BINARY,{open:modelOpener(),hash:modelOptions.hash,net:modelOptions.net,prelude:modelOptions.prelude});assert.equal(v.status,'PASSED');assert(safeCondition(v));assert.deepEqual(readCondition(c),v);assert(v.cases.every(r=>r.stop.forwarded===0&&r.proxy.upstream===0&&r.physical_cleanup));}
}));
test('Node no-egress guard allows the actual decorated proxy loopback/403/physical close',()=>{const script="const {install,snapshot}=await import("+JSON.stringify(new URL('./net-guard.mjs',import.meta.url).href)+");const {postFlushProxy}=await import("+JSON.stringify(new URL('./proxy.mjs',import.meta.url).href)+");const {rejectOnlyProxy}=await import("+JSON.stringify(new URL('../nuxt-debug/natural-prefetch-proxy.mjs',import.meta.url).href)+");const net=await import('node:net');install();const p=await postFlushProxy(rejectOnlyProxy);await new Promise((yes,no)=>{const c=net.connect({host:'127.0.0.1',port:Number(new URL(p.url).port)},()=>c.write('CONNECT fixture.invalid:443 HTTP/1.1\\r\\nHost: fixture.invalid\\r\\n\\r\\n'));c.on('data',b=>{if(!b.toString().startsWith('HTTP/1.1 403'))no(Error('FIXED_403'));c.end()});c.on('error',no);c.on('close',yes);c.setTimeout(1500,()=>{c.destroy();no(Error('CLOSED_TIMEOUT'))})});await p.close();if(p.snapshot().open_sockets!==0||p.snapshot().socket_errors!==0)process.exitCode=1;process.stdout.write(JSON.stringify(snapshot()));";const r=spawnSync(process.execPath,['--unhandled-rejections=strict','--input-type=module','-e',script],{encoding:'utf8',timeout:5000});assert.equal(r.status,0);assert.equal(r.stderr,'');const n=JSON.parse(r.stdout);assert(n.loopback_connects>=1);assert.equal(n.blocked_connects,0);assert.equal(n.dns_attempts,0);});
for(const phase of ['NATIVE','CAP400','SCORE','COUNTERPARTS','OWNERS'])test('partial prelude failure '+phase+' preserves fixed phase and prevents five-case start',async()=>tmp(async()=>{let five=0;const v=await produce('SEQUENCE',S,BINARY,{...modelOptions,prelude:async(v,{save})=>{v.phase=phase;v.prelude[0].status='FAILED';v.prelude[0].cleanup='FAILED';save();throw Error('NOT_SAVED_RAW_CONTROL');},registered:async()=>{five++;},write:saveCondition});assert.equal(five,0);assert.equal(v.status,'FAILED');assert.equal(v.phase,phase);assert(v.cases.every(r=>r.point==='NOT_RUN'));assert(!JSON.stringify(readCondition('SEQUENCE')).includes('NOT_SAVED_RAW_CONTROL'));}));
test('write failure prevents all browser operations and never returns passed',async()=>{let invoked=0;const r=await produce('ALONE',S,BINARY,{...modelOptions,write:()=>{throw Error('CLOSED_RECORD');},alone:()=>{invoked++;}});assert.equal(invoked,0);assert.equal(r.status,'FAILED');});
test('unchanged thirteen-core functions and order remain fail closed; no live selector is called',()=>{const r=readFileSync(new URL('./runner.mjs',import.meta.url),'utf8');for(const path of ['tools/native-score-proof/main.mjs','tools/natural-reads/scoped400-browser.mjs','tools/native-score-proof/score.mjs','tools/standalone-score/closed.mjs','tools/script-owner/native.mjs'])assert(readFileSync(resolve(root,path)).equals(execFileSync('git',['show',BASE+':'+path],{cwd:root})));assert(r.indexOf('executeClosed({')<r.indexOf('await runCounterparts({'));assert(r.indexOf('await runCounterparts({')<r.indexOf('await runOwnerControls({'));assert(r.includes('validCounterparts(counters'));assert(r.includes('validOwnerProof(owners'));assert(!/buildLive\(|measureSelected\(|pinnedTunnel\(|from[^\n]*bootstrap|await fetch\(/.test(r));});

test('child receives only fixed identity and ordinary runtime environment, never credential fields',()=>{const x=childEnv({...env,GITHUB_TOKEN:'FIXED_SENTINEL',ACTIONS_RUNTIME_TOKEN:'FIXED_SENTINEL',HTTP_PROXY:'FIXED_SENTINEL',PB_NATIVE_SCORE:'CLOSED'});assert.equal(x.GITHUB_SHA,S.sha);for(const k of ['GITHUB_TOKEN','ACTIONS_RUNTIME_TOKEN','HTTP_PROXY','PB_NATIVE_SCORE'])assert(!Object.hasOwn(x,k));assert(!JSON.stringify(x).includes('FIXED_SENTINEL'));});
