// Offline end-to-end regression tests: the real staging CLI, with every external
// boundary replaced before module loading. Child environments contain no keys.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {inputLimitDiagnostic,safeInputLimitDiagnostic,FixtureGateway} from './fixture-gateway.mjs';
import {safetyFingerprint} from './proof.mjs';
import {prerequisitesValid} from './staging-once.mjs';

async function offlineCliFixture(){
 const assert=(await import('node:assert/strict')).default;
 const {registerHooks,createRequire}=await import('node:module');
 const fs=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const {pathToFileURL}=await import('node:url');
 const {EventEmitter}=await import('node:events');
 const {createHash}=await import('node:crypto');
 const scenario=process.env.FIXTURE_SCENARIO,entry=process.env.FIXTURE_ENTRY;
 const sha='a'.repeat(40),dir=await fs.mkdtemp(join(tmpdir(),'pagebench-diagnostic-offline-'));
 const entryURL=pathToFileURL(entry).href,base=new URL('./',entryURL);
 const {safetyFingerprint}=await import(new URL('proof.mjs',base).href);
 const {StagingGateway}=await import(new URL('staging-gateway.mjs',base).href);
 const fingerprint=await safetyFingerprint();
 const sourceRequire=createRequire(new URL('../lighthouse-once/package.json',base));
 const lighthouseURL=pathToFileURL(sourceRequire.resolve('lighthouse')).href;
 const loggerURL=pathToFileURL(sourceRequire.resolve('lighthouse-logger')).href;
 const common={status:'passed',run_sha:sha,safety_fingerprint:fingerprint,outbound_forwarding:0,chrome:'Chrome/1.2.3.4'};
 const proofFiles={'fixture-lighthouse-status.json':common,'staging-memory-proof.json':common,'response-path-proof.json':{...common,cases:['parallel_success','network','missing_metadata','redirect'].map(c=>({case:c,status:'passed',chrome:common.chrome,cleanup:'complete',outbound_forwarding:0}))}};
 if(scenario==='stale_proof')proofFiles['staging-memory-proof.json']={...common,safety_fingerprint:'0'.repeat(64)};
 const writes=[],order=[],logs=[];let cleanupCalls=0,openCalls=0,gets=0,parsesAtReject=null,cleanupResult;
 const proxy={stats:{fatal:null,resolved_hosts:0},enable(){order.push('PROXY_MEMORY_ENABLE');},disable(){order.push('PROXY_MEMORY_DISABLE');}};
 const wire={send(raw){const m=JSON.parse(raw);queueMicrotask(()=>{if(m.method==='Tracing.end')wire.onmessage(JSON.stringify({sessionId:m.sessionId,method:'Tracing.tracingComplete',params:{stream:'PRIVATE_TRACE'}}));const result=m.method==='IO.read'?{data:'{\"traceEvents\":[]}',eof:true}:{};wire.onmessage(JSON.stringify({id:m.id,sessionId:m.sessionId,result}));});},close(){}};
 const gateway=new StagingGateway(wire,()=>order.push('EMERGENCY'));
 gateway.primary='P';gateway.sessions.set('P',{ready:true,frame:'FRAME'});gateway.released=true;
 Object.assign(gateway.stats,{live_documents:1,http_status:200,html200:true,html_validated:true});
 const clientReplies=new Map();let clientId=100;gateway.onmessage=raw=>{const m=JSON.parse(raw),pending=clientReplies.get(m.id);if(pending){clientReplies.delete(m.id);pending(m.result);}};
 const clientCommand=(method,params={})=>new Promise(resolve=>{const id=++clientId;clientReplies.set(id,resolve);gateway.send(JSON.stringify({id,sessionId:'P',method,params}));});
 const ownTrace=async()=>{await clientCommand('Tracing.start',{transferMode:'ReturnAsStream'});await clientCommand('Tracing.end');await clientCommand('IO.read',{handle:'PRIVATE_TRACE'});await clientCommand('IO.close',{handle:'PRIVATE_TRACE'});};
 const inject=async()=>{
  const original=JSON.parse;let parsed=0;JSON.parse=(...args)=>{parsed++;return original(...args);};
  try{
   if(scenario==='nontext'||scenario==='nontext_then_oversize'){
    const nontext=new Proxy({},{get(){gets++;throw Error('SYNTHETIC_GETTER');}});
    await gateway.receive(nontext);
   }else await gateway.receive(' '.repeat(1048577));
  }finally{JSON.parse=original;}
  parsesAtReject=parsed;
  if(scenario==='nontext_then_oversize')await gateway.receive(' '.repeat(1048577));
 };
 const ctx={gateway,proxy,chrome:common.chrome,page:{evaluate:async()=>{
  order.push('FINAL_PAGE_OPERATION');if(scenario==='late_oversize')await inject();
  return{body_characters:40,headings:1};
 }},cleanup:async()=>{
  if(cleanupResult)return cleanupResult;
  cleanupCalls++;order.push('CLEANUP');gateway.beginCleanup();
  if(scenario==='after_seal')await inject();
  gateway.dispose();
  cleanupResult={status:scenario==='cleanup_failure'?'failed':'complete'};return cleanupResult;
 }};
 const report={requestedUrl:'https://staging.hirameki.dev/ja/',finalUrl:'https://staging.hirameki.dev/ja/',finalDisplayedUrl:'https://staging.hirameki.dev/ja/',lighthouseVersion:'13.6.0',fetchTime:'2026-11-19T00:00:00.000Z',environment:{benchmarkIndex:100},configSettings:{formFactor:'mobile',throttlingMethod:'simulate',throttling:{rttMs:300,throughputKbps:800,cpuSlowdownMultiplier:6},disableStorageReset:false,screenEmulation:{mobile:true,width:360,height:640,deviceScaleFactor:1}},categories:{performance:{score:0.75}},audits:Object.fromEntries(['first-contentful-paint','largest-contentful-paint','total-blocking-time','cumulative-layout-shift','speed-index'].map(k=>[k,{numericValue:1}]))};
 const mockFs={
  readFile:async(p,...args)=>{if(Object.hasOwn(proofFiles,p))return JSON.stringify(proofFiles[p]);return fs.readFile(join(dir,p),...args);},
  writeFile:async(p,data,options)=>{assert(['staging-once-attempt.json','staging-lighthouse-status.json','staging-lighthouse-report.tmp'].includes(p));assert.equal(options.mode,0o600);writes.push(p);return fs.writeFile(join(dir,p),data,options);},
  rename:async(a,b)=>{assert.equal(a,'staging-lighthouse-report.tmp');assert.equal(b,'staging-lighthouse-report.json');return fs.rename(join(dir,a),join(dir,b));},
  appendFile:async()=>assert.fail('summary path not configured'),
 };
 globalThis.__pagebenchOfflineDoubles={
  fs:mockFs,
  openGuarded:async(_Type,factory)=>{openCalls++;order.push('OPEN_MEMORY');await factory();return ctx;},
  pinnedTunnel:async()=>proxy,
  lighthouse:async()=>{
   order.push('LIGHTHOUSE_MEMORY');
   if(['positive','exact_boundary','late_oversize','after_seal'].includes(scenario))await ownTrace();
   if(['nontext','oversize','nontext_then_oversize','cleanup_failure'].includes(scenario))await inject();
   if(scenario==='exact_boundary'){
    const empty=JSON.stringify({id:99,result:{value:''}});
    await gateway.receive(JSON.stringify({id:99,result:{value:'a'.repeat(1048576-empty.length)}}));
   }
   return{lhr:report};
  },logger:{events:new EventEmitter()},
 };
 const mock=name=>'data:text/javascript,'+encodeURIComponent(name);
 const hooks=registerHooks({resolve(specifier,context,next){
  if(['node:net','net','node:http','http','node:https','https','node:tls','tls','node:dns','dns','node:dgram','dgram','node:child_process','child_process','undici','ws'].includes(specifier))throw Error('NETWORK_OR_PROCESS_FORBIDDEN');
  if(context.parentURL===entryURL){
   if(specifier==='./fixture-runner.mjs')return{url:mock('export const openGuarded=globalThis.__pagebenchOfflineDoubles.openGuarded;'),shortCircuit:true};
   if(specifier==='./staging-egress.mjs')return{url:mock('export const pinnedTunnel=globalThis.__pagebenchOfflineDoubles.pinnedTunnel;'),shortCircuit:true};
   if(specifier==='node:fs/promises')return{url:mock('export const{readFile,writeFile,rename,appendFile}=globalThis.__pagebenchOfflineDoubles.fs;'),shortCircuit:true};
   if(specifier===lighthouseURL)return{url:mock('export default globalThis.__pagebenchOfflineDoubles.lighthouse;'),shortCircuit:true};
   if(specifier===loggerURL)return{url:mock('export default globalThis.__pagebenchOfflineDoubles.logger;'),shortCircuit:true};
  }
  return next(specifier,context);
 }});
 globalThis.fetch=()=>{throw Error('NETWORK_FORBIDDEN');};
 globalThis.WebSocket=class{constructor(){throw Error('NETWORK_FORBIDDEN');}};
 const originalLog=console.log;console.log=s=>logs.push(JSON.parse(s));
 const originalArgv=process.argv;process.argv=[process.execPath,entry,...(scenario==='default_dry'?[]:['--execute'])];
 try{
  await import(entryURL);
  const text=await fs.readFile(join(dir,'staging-lighthouse-status.json'),'utf8');
  const status=JSON.parse(text);assert.equal(logs.length,1);assert.deepEqual(logs[0],status);
  if(scenario==='default_dry')assert.equal(status.cdp_stages,undefined);
  else{assert.equal(status.cdp_stages.cause,'NOT_ATTRIBUTED');assert(status.cdp_stages.events.length<=64);assert(!JSON.stringify(status.cdp_stages).includes('SYNTHETIC_PRIVATE'));}
  if(scenario==='stale_proof')assert.equal(status.cdp_stages.observation,'NO_CONTEXT');
  assert.equal((await fs.stat(join(dir,'staging-lighthouse-status.json'))).mode&0o777,0o600);
  const files=await fs.readdir(dir);const adopted=['positive','exact_boundary'].includes(scenario);
  if(adopted){
   assert.equal(status.status,'success');assert.equal(status.json_readback,true);
   assert.equal(status.trace_read.observation,'OWN_TRACE');assert.equal(status.trace_read.reads,1);assert.equal(status.trace_read.completed,1);assert.equal(status.trace_read.close_confirmed,true);assert.equal(status.trace_read.failure,null);
   const reportText=await fs.readFile(join(dir,'staging-lighthouse-report.json'),'utf8');
   assert.equal(status.report_sha256,createHash('sha256').update(reportText).digest('hex'));
   assert.equal(JSON.parse(reportText).measurement_boundary,'AFTER_FINAL_BROWSER_OPERATION_AND_PRIMARY_SESSION_FENCE');
   assert.deepEqual(JSON.parse(reportText).cdp_stages,status.cdp_stages);
   assert.deepEqual(JSON.parse(reportText).trace_read,status.trace_read);
  }else{
   assert.equal(status.performance,null);assert(!files.includes('staging-lighthouse-report.json'));assert(!files.includes('staging-lighthouse-report.tmp'));
  }
  if(['nontext','oversize','nontext_then_oversize','cleanup_failure','late_oversize','after_seal'].includes(scenario)){
   assert.equal(status.reason,'CDP_INPUT_LIMIT');assert.equal(status.json_report_saved,false);assert.equal(parsesAtReject,0);assert.equal(gets,0);
   assert.equal(status.cdp_input_diagnostic.violation,scenario.startsWith('nontext')?'NON_TEXT':'OVERSIZE_TEXT');
   assert.equal(status.cdp_input_diagnostic.message_role,'UNKNOWN_PREPARSE');assert.equal(status.cdp_input_diagnostic.direction,'CHROME_TO_GUARD');
   assert.equal(status.cleanup,scenario==='cleanup_failure'?'failed':'complete');assert.equal(cleanupCalls,1);
   assert(order.indexOf('EMERGENCY')>=0);
   if(scenario!=='after_seal')assert(order.indexOf('EMERGENCY')<order.indexOf('CLEANUP'));
   assert.equal(order.filter(x=>x==='EMERGENCY').length,1);
  }
  if(scenario==='stale_proof'){assert.equal(openCalls,0);assert.equal(status.reason,'PREREQUISITE');assert.equal(status.cdp_input_diagnostic,null);assert.deepEqual(files,['staging-lighthouse-status.json']);}
  if(scenario==='default_dry'){assert.equal(openCalls,0);assert.equal(status.reason,'EXPLICIT_EXECUTE_REQUIRED');assert.deepEqual(files,['staging-lighthouse-status.json']);}
  const summary={fixture:true,scenario,status:'passed',adopted,cleanup:status.cleanup??'not-started',network_connections:0,browser_launches:0};
  process.exitCode=0;console.log=originalLog;originalLog(JSON.stringify(summary));
 }finally{
  console.log=originalLog;process.argv=originalArgv;hooks.deregister();delete globalThis.__pagebenchOfflineDoubles;await fs.rm(dir,{recursive:true,force:true});
 }
}

for(const scenario of ['nontext','oversize','nontext_then_oversize','late_oversize','after_seal','cleanup_failure','stale_proof','default_dry','positive','exact_boundary']){
 test('offline exact staging CLI: '+scenario,()=>{
  const child=spawnSync(process.execPath,['--input-type=module','-e',`(${offlineCliFixture.toString()})().catch(()=>{console.log('{"fixture":true,"status":"failed","reason":"OFFLINE_FIXTURE_ASSERTION"}');process.exitCode=1;});`],{
   env:{GITHUB_SHA:'a'.repeat(40),FIXTURE_SCENARIO:scenario,FIXTURE_ENTRY:new URL('./staging-once.mjs',import.meta.url).pathname},encoding:'utf8',timeout:15000,maxBuffer:65536,
  });
  assert.equal(child.error,undefined);assert.equal(child.status,0,'offline fixture must pass');
  const result=JSON.parse(child.stdout.trim());assert.equal(result.fixture,true);assert.equal(result.status,'passed');assert.equal(result.scenario,scenario);assert.equal(result.network_connections,0);
 });
}

test('diagnostic is only fixed metadata and has no implicit object coercion',()=>{
 let touched=0;const raw=new Proxy({},{get(){touched++;throw Error('SYNTHETIC');}});const d=inputLimitDiagnostic(raw);assert.equal(touched,0);assert(Object.isFrozen(d));assert.deepEqual(d,{direction:'CHROME_TO_GUARD',violation:'NON_TEXT',length_bucket:'NOT_TEXT',message_role:'UNKNOWN_PREPARSE'});
 const safe=safeInputLimitDiagnostic({...d,payload:'SYNTHETIC_PRIVATE',id:'SYNTHETIC_PRIVATE'});assert.deepEqual(safe,d);assert(!JSON.stringify(safe).includes('SYNTHETIC_PRIVATE'));assert.equal(safeInputLimitDiagnostic({...d,message_role:'IO.read'}),null);assert.equal(inputLimitDiagnostic(' '.repeat(1048576)),null);
});

test('first cap reason and metadata survive later queued events',async()=>{
 let killed=0;const g=new FixtureGateway({send(){assert.fail('no forwarding');},close(){}},()=>killed++);await g.receive({});const first=g.stats.cdp_input_diagnostic;await g.receive(' '.repeat(1048577));g.fail('SECOND_REASON');assert.equal(killed,1);assert.equal(g.stats.fatal,'CDP_INPUT_LIMIT');assert.equal(g.stats.cdp_input_diagnostic,first);
});

test('candidate sources belong to current proof fingerprint; stale proofs fail closed',async()=>{
 const hash=await safetyFingerprint();assert.match(hash,/^[a-f0-9]{64}$/);const source=await readFile(new URL('./proof.mjs',import.meta.url),'utf8');for(const name of ['fixture-gateway.mjs','staging-once.mjs'])assert(source.includes("'"+name+"'"));
 const common={status:'passed',safety_fingerprint:hash,run_sha:'a'.repeat(40),outbound_forwarding:0,chrome:'Chrome/1.2.3.4'};const response={...common,cases:['parallel_success','network','missing_metadata','redirect'].map(c=>({case:c,status:'passed',chrome:common.chrome,cleanup:'complete',outbound_forwarding:0}))};assert.equal(prerequisitesValid(common,common,response,hash,common.run_sha),true);assert.equal(prerequisitesValid(common,{...common,safety_fingerprint:'0'.repeat(64)},response,hash,common.run_sha),false);
});
