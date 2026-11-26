// Test-only child. No real API, DNS, socket or browser: production entry with controlled dependencies.
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {bootstrap} from './bootstrap.mjs';
const root=process.cwd(),publisher=resolve('tools/staging-binding-once/publish.mjs');
const variant=process.argv[2],allowed=['positive','http403','http429','duplicate','transport','source','missing','invalid','alternate'];
assert(allowed.includes(variant));
const dir=mkdtempSync(join(tmpdir(),'job-api-child-'));
let calls=0,opens=0,dns=0,tcp=0,childChecks=0,publishChecks=0,f,entryModule,recordModule,state;
// DUMMY credential injected by this closed test only, never a runner credential.
const dummy='DUMMY_CANARY_NOT_A_CREDENTIAL_71524';
assert(!('GITHUB_TOKEN' in process.env));
const sha='a'.repeat(40),ref='refs/heads/diag/binding-branch-ja-once-20261126';
Object.assign(process.env,{GITHUB_ACTIONS:'true',GITHUB_REF:ref,GITHUB_SHA:sha,GITHUB_RUN_ID:'1234',GITHUB_RUN_ATTEMPT:'1',GITHUB_REPOSITORY:'sakutakajp/pagebench',GITHUB_EVENT_NAME:'push',GITHUB_EVENT_PATH:'event.json',CHROME_PATH:'/opt/google/chrome/chrome'});
if(variant!=='missing')process.env.GITHUB_TOKEN=variant==='invalid'?'INVALID\nTOKEN':dummy;
if(variant==='alternate')process.env.GH_TOKEN='DUMMY_ALTERNATE_ONLY';
process.argv=[process.execPath,'controlled-bootstrap','--measure-once'];
try{
 process.chdir(dir);
 const ok=await bootstrap({transport:async(url,o)=>{
  calls++;assert.equal(calls,1);
  assert.equal(url,'https://api.github.com/repos/sakutakajp/pagebench/actions/runs?head_sha='+sha+'&event=push&per_page=100');
  assert.equal(o.method,'GET');assert.equal(o.redirect,'error');assert.equal(o.headers.Authorization,'Bearer '+dummy);
  assert(!('GITHUB_TOKEN' in process.env));
  if(variant==='transport')throw Error(dummy);
  if(variant==='http403'||variant==='http429')return new Response(dummy,{status:variant==='http403'?403:429});
  return new Response(JSON.stringify({total_count:variant==='duplicate'?2:1,workflow_runs:[{id:1234,head_sha:sha,event:'push',run_attempt:1,path:'.github/workflows/staging-binding-branch-ja-once-20261126.yml'}],unused:dummy}));
 },load:async()=>{
  assert(!('GITHUB_TOKEN' in process.env));
  const probe=spawnSync(process.execPath,['-e',"process.stdout.write(JSON.stringify({present:'GITHUB_TOKEN' in process.env}))"],{encoding:'utf8'});
  assert.equal(probe.status,0);assert.equal(probe.stderr,'');assert.deepEqual(JSON.parse(probe.stdout),{present:false});childChecks++;
  // These modules load only after the exact production bootstrap purges environment.
  const {fixture}=await import('./test-fixtures.mjs');
  const admission=await import('./admission.mjs');
  entryModule=await import('./entry.mjs');recordModule=await import('./records.mjs');
  const {controlled,BINARY}=await import('./control.mjs');
  process.chdir(root);try{f=await fixture();}finally{process.chdir(dir);}
  const c=controlled('versioned_beacon');
  for(const[p,v]of Object.entries(f.files))if(!p.startsWith('tools/'))writeFileSync(p,JSON.stringify(v),{mode:0o600});
  for(const[phase,v]of Object.entries(f.receipts))writeFileSync('staging-binding-once-admission-'+phase.toLowerCase()+'.json',JSON.stringify(v),{mode:0o600});
  writeFileSync('native-score-fixed.json',JSON.stringify(f.m.native),{mode:0o600});
  writeFileSync('proxy-cleanup-case-fixed.json',JSON.stringify(f.m.proxy),{mode:0o600});
  const originalWrite=f.options.io.write;
  f.options.io.write=(p,v)=>{originalWrite(p,v);writeFileSync(p,JSON.stringify(v),{flag:'wx',mode:0o600});};
  if(variant==='source')f.options.io.digest=()=> '0'.repeat(64);
  return {records:recordModule,admission:{admitClosed:o=>admission.admitClosed({...f.options,...o})},entry:{lifecycle:s=>{state=s;},run:async(mode,o)=>{
   const result=await entryModule.run(mode,{...o,liveDependencies:{hash:async()=>BINARY,lighthouse:async(...args)=>{assert(!('GITHUB_TOKEN'in process.env));return c.lighthouse(...args);},open:async(...args)=>{assert(!('GITHUB_TOKEN'in process.env));opens++;return c.open(...args);},proxyOptions:{lookup:async()=>{assert(!('GITHUB_TOKEN'in process.env));dns++;return[{address:'104.16.1.2',family:4}]},connect:()=>{tcp++;throw Error('NO_UPSTREAM');}}}});
   state.record.exit(result?0:1);state.live?.exit(result?0:1);return result;
  }}};
 }});
 const expected=variant==='positive'&&process.version==='v22.19.0';
 assert.equal(ok,expected);assert.equal(opens,expected?1:0);assert.equal(dns,ok?3:0);assert.equal(tcp,0);
 assert.equal(calls,['missing','invalid','alternate','source'].includes(variant)?0:1);
 assert.equal(childChecks,['missing','invalid','alternate'].includes(variant)?0:1);
 assert(!('GITHUB_TOKEN'in process.env));
 const boot=JSON.parse(readFileSync('selected-boot-LIVE.json'));
 assert.equal(boot.status,ok?'PASSED':['missing','invalid','alternate'].includes(variant)?'CREDENTIAL_REJECTED':'FAILED');
 if(variant==='positive'){assert.equal(state.record.snapshot().status,'ADMITTED');if(!expected){assert.equal(state.live.snapshot().first_fault.reason,'FIXED_RUN');assert.equal(state.live.snapshot().result.status,'NOT_RUN');}}
 if(f){
  const env={...process.env,...Object.fromEntries(['UNITS24','UNITS22','PRECHECK','CLOSED','STAGING'].map(k=>['PB_STAGING_BINDING_ONCE_'+k,ok||k!=='STAGING'?'success':'failure']))};
  const p=spawnSync(process.execPath,[publisher],{env,encoding:'utf8'});assert.equal(p.status,0);assert.equal(p.stderr,'');assert(!p.stdout.includes(dummy));
  const pub=JSON.parse(p.stdout);assert.equal(pub.score_adopted,ok);assert.equal(pub.d1_writes,0);assert.equal(pub.report_file_written,false);publishChecks++;
  if(ok){assert.equal(state.live.snapshot().result.cleanup,'COMPLETE');assert.equal(state.live.snapshot().result.policy_limit,400);assert.equal(state.live.snapshot().result.performance,50);}
 }
 for(const name of readdirSync(dir))if(name.endsWith('.json')){const s=readFileSync(name,'utf8');assert(!s.includes(dummy));assert(!s.includes('Bearer '));assert(!s.includes('INVALID\\nTOKEN'));}
 process.stdout.write(JSON.stringify({kind:'DUMMY_API_BOUNDARY_CASE',case:variant,passed:true,api_calls:calls,browser_factories:opens,upstream:tcp,child_checks:childChecks,publisher_checks:publishChecks,token_present:false,files_removed:true})+'\n');
}finally{delete process.env.GH_TOKEN;process.chdir(root);rmSync(dir,{recursive:true,force:true});}
