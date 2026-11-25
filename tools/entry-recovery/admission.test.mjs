// Actual new admission in a fresh exact shallow clone; only browser hashing
// and GitHub response are controlled. No Chrome, HTTP, credentials or site.
import test,{after} from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,existsSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import {spawnSync,execFileSync} from 'node:child_process';
import {proofFixtures} from './admission-fixtures.mjs';import {BASE,REF,WORKFLOW,UNITS} from './config.mjs';
assert.equal(process.version,'v22.19.0');
const root=new URL('../../',import.meta.url).pathname,sha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),directory=mkdtempSync(join(tmpdir(),'pagebench-exact-admission-')),clone=join(directory,'clone'),run='98765';
// actions/checkout uses detached HEAD: clone that exact local HEAD, never rely
// on a local branch existing in the runner's repository.
execFileSync('git',['clone','--quiet','--depth','22','file://'+root,clone],{stdio:'pipe'});
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:clone,encoding:'utf8'}).trim(),sha);
assert.equal(execFileSync('git',['rev-parse','HEAD^'],{cwd:clone,encoding:'utf8'}).trim(),BASE);
after(()=>rmSync(directory,{recursive:true,force:true}));
let fixture;
async function runAdmission(change=()=>{}, {consume=false,twice=false,start=true,entry=false,sourceTamper=false}={}){
 for(const f of ['public-stage-live.json','public-entry-owner.json','public-entry-result.json','public-rejection-fixed.json','public-rejection-attempt.json','natural-top-closed-proof.json','startup-closed-proof.json'])rmSync(join(clone,f),{force:true});
 fixture=await proofFixtures(clone,sha,run);writeFileSync(join(clone,'event-fixed.json'),JSON.stringify({created:true,forced:false,deleted:false,head_commit:{id:sha}}));
 const value={consume,twice,start,entry,run:fixture.run};change({get:f=>JSON.parse(readFileSync(join(clone,f))),set:(f,v)=>writeFileSync(join(clone,f),JSON.stringify(v)),remove:f=>rmSync(join(clone,f)),value});
 const hashModule=new URL('tools/ab-observe/config.mjs','file://'+clone+'/').href;
 const helper=`import{registerHooks}from'node:module';import{writeFileSync}from'node:fs';let calls=0,oldMonitor=false;registerHooks({load(u,c,n){if(u.endsWith('/public-top-run/monitor.mjs')||u.endsWith('/public-rejection-logs/monitor.mjs'))oldMonitor=true;if(u===${JSON.stringify(hashModule)})return{format:'module',shortCircuit:true,source:${JSON.stringify("export * from "+JSON.stringify(hashModule+"?closed-original")+";export async function browserFileHash(){return'"+fixture.hash+"'}")}};return n(u,c)}});globalThis.fetch=async()=>{calls++;return{ok:true,json:async()=>(${JSON.stringify(value.run)})}};process.on('exit',()=>writeFileSync('fixed-fetch-count.json',JSON.stringify({calls,oldMonitor}))); `;
 const hook=join(directory,'hash-and-api-control.mjs');writeFileSync(hook,helper);
 const code=`import{admit}from'./tools/entry-recovery/admission.mjs';let code=null,ok=false;try{await admit({live:true,consume:${consume}});if(${twice})await admit({live:true,consume:true});ok=true}catch(e){const d=Object.getOwnPropertyDescriptor(e,'message');code=['FIXED_EVENT','FIXED_UNITS','FIXED_RUN','FIXED_START_GRANT','FIXED_STAGE_MONITOR','FIXED_REAL_GATE','FIXED_240_GATE','FIXED_400_GATE','FIXED_400_METER_GATE','FIXED_STARTUP_GATE','FIXED_STARTUP_RECEIPT','FIXED_COUNTER_CLOSED_GATE','FIXED_CONTINUATION_GATE'].includes(d?.value)?d.value:'UNKNOWN'}console.log(JSON.stringify({ok,code}));if(!ok)process.exitCode=1;`;
 const env={PATH:process.env.PATH,GITHUB_REPOSITORY:'sakutakajp/pagebench',GITHUB_SHA:sha,GITHUB_REF:REF,GITHUB_EVENT_NAME:'push',GITHUB_EVENT_PATH:join(clone,'event-fixed.json'),GITHUB_RUN_ID:run,GITHUB_RUN_ATTEMPT:'1',GITHUB_ACTIONS:'true',CHROME_PATH:'/opt/google/chrome/chrome',PB_PUBLIC_STAGE:'live'};
 const path=join(clone,'tools/natural-reads/policy.mjs'),original=sourceTamper?readFileSync(path):null;if(sourceTamper)writeFileSync(path,Buffer.concat([original,Buffer.from('\n// CLOSED_FIXED_TAMPER_CONTROL\n')]));let p;try{p=spawnSync(process.execPath,['--unhandled-rejections=strict','--import',hook,'--import',join(clone,'tools/entry-recovery/preload.mjs'),'--import',join(clone,'tools/entry-recovery/monitor.mjs'),'--input-type=module','-e',code],{cwd:clone,env,encoding:'utf8',timeout:10000,maxBuffer:65536});}finally{if(sourceTamper)writeFileSync(path,original);}
 assert.equal(p.stderr,'');const out=JSON.parse(p.stdout);const monitor=JSON.parse(readFileSync(join(clone,'public-stage-live.json')));assert.equal(monitor.first_fault,null);assert.equal(monitor.scope.ref,REF);assert.equal(JSON.parse(readFileSync(join(clone,'fixed-fetch-count.json'))).oldMonitor,false);return{exit:p.status,...out,marker:existsSync(join(clone,'public-rejection-attempt.json')),calls:JSON.parse(readFileSync(join(clone,'fixed-fetch-count.json'))).calls};
}
test('actual fresh exact admission consumes one grant with all original producer contracts',async()=>{const r=await runAdmission(()=>{},{consume:true});assert.deepEqual(r,{exit:0,ok:true,code:null,marker:true,calls:1});});
test('second consumption fails and never replaces the first grant',async()=>{const r=await runAdmission(()=>{},{consume:true,twice:true});assert.equal(r.exit,1);assert.equal(r.ok,false);assert.equal(r.marker,true);});
test('child-style JIT without parent start grant fails closed with original unknown file error',async()=>{const r=await runAdmission();assert.equal(r.exit,1);assert.equal(r.code,'UNKNOWN');assert.equal(r.marker,false);});
test('existing mismatched parent grant has exact fixed refusal',async()=>{const r=await runAdmission(io=>io.set('public-rejection-attempt.json',{sha,run_id:'2',attempt:1,ref:REF}));assert.equal(r.exit,1);assert.equal(r.code,'FIXED_START_GRANT');});
test('matching existing grant permits unchanged child-style revalidation without consuming again',async()=>{const r=await runAdmission(io=>io.set('public-rejection-attempt.json',{sha,run_id:run,attempt:1,ref:REF}));assert.deepEqual(r,{exit:0,ok:true,code:null,marker:true,calls:1});});
for(const file of ['rejected-paths-unit-proof.json','rejected-paths-filesystem-units.json','public-rejection-units.json','public-top-units.json',UNITS])test('actual admission rejects missing inherited or new units '+file,async()=>{const r=await runAdmission(io=>io.remove(file),{consume:true});assert.equal(r.exit,1);assert.equal(r.marker,false);});
for(const [file,mutate] of [
 ['natural-native-closed-proof.json',v=>v.workflow_sha='0'.repeat(40)],
 ['natural-top-closed-proof.json',v=>v.cases[0].result.cleanup='UNKNOWN'],
 ['scoped240-closed-proof.json',v=>v.cases[0].max_inflight=7],
 ['scoped400-closed-proof.json',v=>v.cases[0].request_breakdown=null],
 ['startup-closed-proof.json',v=>v.status='failed'],
 ['public-rejection-closed.json',v=>v.cases[0].upstream=1],
 ['public-stage-top.json',v=>v.exit_code=1]
])test('actual admission preserves strict JIT rejection '+file,async()=>{const r=await runAdmission(io=>{const v=io.get(file);mutate(v);io.set(file,v);},{consume:true});assert.equal(r.exit,1);assert.equal(r.marker,false);assert.equal(r.calls,0);});
test('duplicate push run is rejected before any start grant',async()=>{const r=await runAdmission(io=>io.value.run.total_count=2,{consume:true});assert.equal(r.exit,1);assert.equal(r.code,'FIXED_RUN');assert.equal(r.marker,false);});
test('foreign workflow cannot supply exact JIT uniqueness',async()=>{const r=await runAdmission(io=>io.value.run.workflow_runs[0].path='.github/workflows/other-fixed.yml',{consume:true});assert.equal(r.exit,1);assert.equal(r.code,'FIXED_RUN');assert.equal(r.marker,false);});
test('wrong event head never reaches remote uniqueness or a grant',async()=>{const r=await runAdmission(io=>io.set('event-fixed.json',{created:true,forced:false,deleted:false,head_commit:{id:'0'.repeat(40)}}),{consume:true});assert.equal(r.exit,1);assert.equal(r.code,'FIXED_EVENT');assert.equal(r.calls,0);assert.equal(r.marker,false);});
test('modified tracked policy source fails closed without changing the policy',async()=>{const r=await runAdmission(()=>{},{consume:true,sourceTamper:true});assert.equal(r.exit,1);assert.equal(r.calls,0);assert.equal(r.marker,false);});
