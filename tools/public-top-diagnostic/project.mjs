// Read-only evidence projection. Never used for gate admission or browser control.
import {isProxy} from 'node:util/types';
import {lstatSync,openSync,fstatSync,readSync,closeSync,constants,writeFileSync,renameSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {TOP_CASES} from '../natural-reads/top-memory.mjs';
import {projectStartup,startupComplete} from '../natural-reads/startup-proof.mjs';

const ROOT=['kind','workflow_sha','run_id','status','cases','top_proof_sha256','raw_stderr_captured','semantics','real_site_navigations','score_saved','report_saved'];
const START=['capture','semantics','preload_gap','error_presence','child_close_seen','start_grant_callback','ipc_progress','disk_progress','final_message','close_signal','group_signal','group_after_close','physical_browser_cleanup'];
const EVIDENCE=['kind','events','last_phase','first_error','secondary_errors','exit_code','overflow','recording_failed','write_attempts'];
const ERROR=['kind','phase','native_class','node_code','open_phase','open_cleanup'];
const REASONS=['CHILD_EXIT_WITHOUT_FINAL','CHILD_TIMEOUT','INVALID_CHILD_PROTOCOL','GUARD_OR_CHILD_FAILURE','FIXED_OBSERVATION_COMPLETE','UNKNOWN_OR_NOT_REACHED'];
const BUDGET=32768;
const exact=(v,keys)=>{if(!v||typeof v!=='object'||isProxy(v)||Object.getPrototypeOf(v)!==Object.prototype)return false;const all=Reflect.ownKeys(v);return all.every(k=>typeof k==='string')&&all.sort().join(',')===keys.toSorted().join(',')&&keys.every(k=>Object.hasOwn(Object.getOwnPropertyDescriptor(v,k),'value'));};
const array=v=>v&&typeof v==='object'&&!isProxy(v)&&Array.isArray(v)&&Reflect.ownKeys(v).length===v.length+1&&Array.from({length:v.length},(_,i)=>Object.getOwnPropertyDescriptor(v,String(i))).every(d=>d&&Object.hasOwn(d,'value'));
const data=(v,depth=0)=>{if(v===null||['boolean','number'].includes(typeof v))return true;if(typeof v==='string')return v.length<=128;if(!v||typeof v!=='object'||isProxy(v)||depth>10)return false;const keys=Reflect.ownKeys(v);if(keys.length>64||!Array.isArray(v)&&Object.getPrototypeOf(v)!==Object.prototype)return false;return keys.every(k=>{if(typeof k!=='string')return false;const d=Object.getOwnPropertyDescriptor(v,k);return d&&Object.hasOwn(d,'value')&&data(d.value,depth+1);});};
const identity=v=>exact(v,['sha','run'])&&typeof v.sha==='string'&&typeof v.run==='string'&&/^[a-f0-9]{40}$/.test(v.sha)&&/^[1-9][0-9]{0,23}$/.test(v.run)?{sha:v.sha,run:v.run}:null;

export function checkedReceipt(v,expected){
 try{
  const s=identity(expected);if(!s||!data(v)||!exact(v,ROOT)||v.kind!=='FIXED_CLOSED_NODE_STARTUP_PROOF'||v.workflow_sha!==s.sha||v.run_id!==s.run||!['passed','failed'].includes(v.status)||!array(v.cases)||v.cases.length!==TOP_CASES.length||v.top_proof_sha256!==null&&!/^[a-f0-9]{64}$/.test(v.top_proof_sha256)||v.raw_stderr_captured!==false||v.semantics!=='NODE_PROCESS_NOT_BROWSER_CONSOLE_OR_NUXT_CAUSE'||v.real_site_navigations!==0||v.score_saved!==false||v.report_saved!==false)return null;
  const cases=v.cases.map((c,i)=>{
   if(!exact(c,['case','status','parent_reason','startup','cleanup'])||c.case!==TOP_CASES[i]||!['passed','failed','not_run'].includes(c.status)||!REASONS.includes(c.parent_reason)||!['COMPLETE','UNKNOWN_OR_FAILED','UNKNOWN'].includes(c.cleanup))throw Error();
   let startup=null;if(c.startup!==null){const p=c.startup;if(!exact(p,START)||!exact(p.capture,['state','evidence']))throw Error();const e=p.capture.evidence;if(e!==null){if(!exact(e,EVIDENCE)||!array(e.events)||e.first_error!==null&&!exact(e.first_error,ERROR))throw Error();}
    startup=projectStartup(p);if(!startup||JSON.stringify(startup)!==JSON.stringify(p))throw Error();
   }
   return{case:c.case,status:c.status,parent_reason:c.parent_reason,startup,cleanup:c.cleanup};
  });
  if(v.status==='passed'&&cases.some(c=>c.status!=='passed'||!startupComplete(c.startup)))return null;
  // This checks only fixed schema/scope. It does not authenticate the raw top
  // proof, browser binary, exit-code match, or topCaseVerdict predicates.
  return{status:v.status,cases};
 }catch{return null;}
}

const STATES=['VALID_FIXED_SCHEMA_ONLY','MISSING','INVALID_OR_UNREADABLE','UNBOUND_SCOPE'];
export function projectReceipt(v,expected,state='INVALID_OR_UNREADABLE'){
 const s=identity(expected),r=checkedReceipt(v,expected);state=r?'VALID_FIXED_SCHEMA_ONLY':s&&STATES.includes(state)&&state!=='VALID_FIXED_SCHEMA_ONLY'?state:s?'INVALID_OR_UNREADABLE':'UNBOUND_SCOPE';
 const out={kind:'FIXED_TOP_STARTUP_CASES',scope:s,receipt_state:state,top_status:r?r.status==='passed'?'RECEIPT_PASSED':'RECEIPT_FAILED':'UNKNOWN',cases:TOP_CASES.map((name,i)=>{
  const c=r?.cases[i],p=c?.startup,e=p?.capture.evidence,f=e?.first_error;
  return{case:name,status:c?.status??'UNKNOWN',reason:{parent:c?.parent_reason??'UNKNOWN_OR_NOT_REACHED',node_error_presence:f?'FIXED_NODE_ERROR_OBSERVED':e?'UNKNOWN_NO_RECORDED_NODE_ERROR':'UNKNOWN',error_kind:f?.kind??'UNKNOWN',native_class:f?.native_class??'UNKNOWN',node_code:f?.node_code??'UNKNOWN'},cleanup:{parent:c?.cleanup??'UNKNOWN',browser:p?.physical_browser_cleanup??'UNKNOWN',group_signal:p?.group_signal??'UNKNOWN',group_after_close:p?.group_after_close??'UNKNOWN'},point:{capture:p?.capture.state??'NOT_RECORDED',last_phase:e?.last_phase??'UNKNOWN',error_phase:f?.phase??'UNKNOWN',open_phase:f?.open_phase??'UNKNOWN'}};
 }),authority:'SCHEMA_AND_SCOPE_ONLY_NOT_GATE_ADMISSION',semantics:'NODE_STARTUP_NOT_BROWSER_CONSOLE_OR_NUXT_CAUSE',score_saved:false,report_saved:false};
 if(Buffer.byteLength(JSON.stringify(out))>BUDGET)throw Error('FIXED_PUBLIC_TOP_BUDGET');return out;
}

export function readProjection(directory,expected){let fd;try{
 const p=join(directory,'startup-closed-proof.json'),before=lstatSync(p);if(!before.isFile()||before.isSymbolicLink()||before.size>BUDGET)throw Error();fd=openSync(p,constants.O_RDONLY|constants.O_NOFOLLOW);const st=fstatSync(fd);if(!st.isFile()||st.size>BUDGET)throw Error();const bytes=Buffer.alloc(BUDGET+1),n=readSync(fd,bytes,0,bytes.length,null);if(n>BUDGET)throw Error();return projectReceipt(JSON.parse(bytes.subarray(0,n)),expected);
 }catch(e){return projectReceipt(null,expected,e?.code==='ENOENT'?'MISSING':'INVALID_OR_UNREADABLE');}finally{if(fd!==undefined)try{closeSync(fd);}catch{}}}
export function publish(directory,expected){const out=readProjection(directory,expected),p=join(directory,'public-top-startup.json'),text=JSON.stringify(out);writeFileSync(p+'.tmp',text,{flag:'wx',mode:0o600});renameSync(p+'.tmp',p);if(readFileSync(p,'utf8')!==text)throw Error('FIXED_PUBLIC_TOP_READBACK');return out;}
if(process.argv[1]===fileURLToPath(import.meta.url)){try{if(process.argv.length!==2)throw Error();const out=publish('.',{sha:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID});console.log(JSON.stringify(out));}catch{process.exitCode=1;}}
