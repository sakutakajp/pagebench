import {spawn} from 'node:child_process';import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {readJournal,safePacket,safeArm} from './protocol.mjs';import {safeEvidence} from './evidence.mjs';
export async function supervise(module,args=[],{prerequisite=false,timeout=180000,onProgress=()=>{},env={}}={}){
 if(!prerequisite)return{kind:'nuxt-debug-parent',status:'NOT_STARTED',reason:'PREREQUISITE_FAILED',child_started:false,evidence:null,cleanup:'NOT_STARTED',score_saved:false};
 if(process.version!=='v22.19.0')return{kind:'nuxt-debug-parent',status:'NOT_STARTED',reason:'NODE_22_19_REQUIRED',child_started:false,evidence:null,cleanup:'NOT_STARTED',score_saved:false};
 const dir=await mkdtemp(join(tmpdir(),'pagebench-nuxt-child-'));let latest=null,final=null,invalid=false,stderr=false,stdout=false,timedout=false,groupStop='NOT_REQUESTED',child,exit;
 const progress=()=>{try{onProgress({kind:'nuxt-debug-parent',status:'INCOMPLETE',reason:'CHILD_RUNNING_OR_EXIT_UNCONFIRMED',child_started:true,evidence:latest?.evidence??null,cleanup:'UNKNOWN',score_saved:false});}catch{invalid=true;kill();}};
 const kill=()=>{if(groupStop!=='NOT_REQUESTED'||!child?.pid)return;groupStop='REQUESTED';try{process.kill(-child.pid,'SIGKILL');}catch(e){groupStop=e.code==='ESRCH'?'GROUP_NOT_PRESENT':'REQUEST_FAILED';}};
 try{
  try{onProgress({kind:'nuxt-debug-parent',status:'NOT_STARTED',reason:'AWAITING_CHILD_GRANT',child_started:false,evidence:null,cleanup:'NOT_STARTED',score_saved:false});}catch{return{kind:'nuxt-debug-parent',status:'NOT_STARTED',reason:'PARENT_RECORD_UNAVAILABLE',child_started:false,evidence:null,cleanup:'NOT_STARTED',score_saved:false};}
  child=spawn(process.execPath,['--unhandled-rejections=strict',module,...args],{env:{...process.env,...env,PB_DEBUG_DIRECTORY:dir},detached:true,stdio:['ignore','pipe','pipe','ipc']});progress();
  child.stdout.on('data',()=>stdout=true);child.stderr.on('data',()=>stderr=true); // Discard, never echo or persist raw child output.
  child.on('message',m=>{try{
   if(m?.kind==='nuxt-debug-final'){const e=safeEvidence(m.evidence),a=safeArm(m.observation,process.env.GITHUB_SHA);if(!e||!a||final||latest&&(latest.evidence.first_fatal!==e.first_fatal||JSON.stringify(latest.evidence.first_refusal)!==JSON.stringify(e.first_refusal))){invalid=true;kill();return;}final={evidence:e,observation:a};return;}
   const p=safePacket(m);if(!p||latest&&p.seq<=latest.seq){invalid=true;kill();return;}
   if(latest&&(latest.evidence.first_fatal&&p.evidence.first_fatal!==latest.evidence.first_fatal||latest.evidence.first_refusal&&JSON.stringify(p.evidence.first_refusal)!==JSON.stringify(latest.evidence.first_refusal))){invalid=true;kill();return;}
   latest=p;progress();
  }catch{invalid=true;kill();}});
  if(!invalid)try{child.send({kind:'nuxt-debug-start'},error=>{if(error){invalid=true;kill();}});}catch{invalid=true;kill();}
  let timer;try{exit=await new Promise(resolve=>{timer=setTimeout(()=>{timedout=true;kill();},timeout);child.once('error',()=>resolve({code:null,signal:'SPAWN_FAILED'}));child.once('close',(code,signal)=>resolve({code,signal}));});}finally{clearTimeout(timer);}
  const disk=readJournal(dir);if(disk&&latest&&(latest.evidence.first_fatal&&disk.evidence.first_fatal!==latest.evidence.first_fatal||latest.evidence.first_refusal&&JSON.stringify(disk.evidence.first_refusal)!==JSON.stringify(latest.evidence.first_refusal)))invalid=true;
  else if(disk&&(!latest||disk.seq>latest.seq))latest=disk;else if(disk&&latest&&disk.seq===latest.seq&&JSON.stringify(disk.evidence)!==JSON.stringify(latest.evidence))invalid=true;
  const evidence=latest?.evidence??final?.evidence??null;
  const cleaned=evidence?.cleanup==='COMPLETE'&&evidence.receiver_active===0&&evidence.secondary_failures===0;
  if(!cleaned)kill();
  const success=exit.code===0&&!exit.signal&&!timedout&&!invalid&&!stderr&&!stdout&&final&&final.observation.status==='completed'&&cleaned&&!evidence.first_fatal&&evidence.receiver_rejections===0;
  return{kind:'nuxt-debug-parent',status:success?'OBSERVED':'STOPPED',reason:timedout?'CHILD_TIMEOUT':invalid?'INVALID_CHILD_PROTOCOL':!final?'CHILD_EXIT_WITHOUT_FINAL':success?'FIXED_OBSERVATION_COMPLETE':'GUARD_OR_CHILD_FAILURE',child_started:true,child_exit:Number.isInteger(exit.code)?exit.code:null,child_signal:exit.signal?'SIGNAL_OR_SPAWN_FAILURE':null,unexpected_stderr:stderr,unexpected_stdout:stdout,group_stop:groupStop,evidence,observation:final?.observation??null,cleanup:cleaned?'COMPLETE':'UNKNOWN_OR_FAILED',score_saved:false,report_saved:false};
 }finally{try{await rm(dir,{recursive:true,force:true});}catch{}}
}
async function save(v){const text=JSON.stringify(v);await writeFile('nuxt500-debug-fixed.tmp',text,{mode:0o600});await (await import('node:fs/promises')).rename('nuxt500-debug-fixed.tmp','nuxt500-debug-fixed.json');if(await readFile('nuxt500-debug-fixed.json','utf8')!==text)throw Error('FIXED_READBACK');}
if(process.argv[1]===new URL(import.meta.url).pathname){let result;try{
 if(process.argv.length!==3||process.argv[2]!=='--execute-once')throw Error('EXECUTE');const{debugAdmission}=await import('./admission.mjs');await debugAdmission();await writeFile('nuxt500-debug-attempt.json','{"attempt":1}',{flag:'wx',mode:0o600});
 result=await supervise(new URL('./child.mjs',import.meta.url).pathname,[],{prerequisite:true,onProgress:partial=>{const text=JSON.stringify({workflow_sha:process.env.GITHUB_SHA,...partial});const fs=process.getBuiltinModule('fs');fs.writeFileSync('nuxt500-debug-fixed.tmp',text,{mode:0o600});fs.renameSync('nuxt500-debug-fixed.tmp','nuxt500-debug-fixed.json');}});
 }catch{result={kind:'nuxt-debug-parent',status:'NOT_STARTED_OR_INCOMPLETE',reason:'PRECONDITION_OR_PARENT_FAILURE',cleanup:'UNKNOWN',score_saved:false};}
 result={workflow_sha:/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA||'')?process.env.GITHUB_SHA:null,...result};try{await save(result);console.log(JSON.stringify(result));}catch{console.log('{"kind":"nuxt-debug-parent","status":"STOPPED","reason":"FIXED_RECORD_UNAVAILABLE","score_saved":false}');}
 if(result.status!=='OBSERVED')process.exitCode=1;
}
