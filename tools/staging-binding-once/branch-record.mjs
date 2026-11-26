// Fixed record only. Never contains received URLs, identifiers or browser bytes.
import {openSync,readSync,fstatSync,closeSync,lstatSync,constants} from 'node:fs';
import {plainData} from '../native-score-proof/case-project.mjs';
import {fixedWrite} from './records.mjs';import {storageScope} from './storage.mjs';import {scope} from './config.mjs';
import {safeBranch,emptyBranch} from './branch.mjs';
export const BRANCH_FILE='binding-branch-fixed.json';
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function safeBranchRecord(v,s){try{
 if(!plainData(v)||!plainData(s)||Object.keys(v).sort().join(',')!=='kind,recording,sample,scope,stage,timings'||v.kind!=='FIXED_BINDING_BRANCH_RECORD_V1'||!eq(v.scope,s)||!eq(scope({GITHUB_ACTIONS:'true',GITHUB_REF:s.ref,GITHUB_SHA:s.sha,GITHUB_RUN_ID:s.run,GITHUB_RUN_ATTEMPT:String(s.attempt)}),s)||!['BEFORE_BROWSER','AFTER_MEASURE'].includes(v.stage)||!['COMPLETE_PREFIX','OBSERVER_FAILED'].includes(v.recording)||!safeBranch(v.sample)||!plainData(v.timings)||Object.keys(v.timings).sort().join(',')!=='branch,finalize,initialize'||v.timings.initialize!=='BEFORE_BROWSER_CONFIRMED'||!['NOT_OBSERVED','RAM_AT_DECISION_BEFORE_REJECT','UNKNOWN'].includes(v.timings.branch)||v.timings.finalize!==(v.stage==='AFTER_MEASURE'?'AFTER_MEASURE_RETURN':'NOT_REACHED'))return null;
 if(v.stage==='BEFORE_BROWSER'&&(v.sample.state!=='NOT_INSTALLED'||v.timings.branch!=='NOT_OBSERVED'||v.recording!=='COMPLETE_PREFIX'))return null;
 if(v.sample.state==='CAPTURED'&&v.timings.branch!=='RAM_AT_DECISION_BEFORE_REJECT')return null;
 if(['INSPECTION_UNKNOWN','NOT_INSTALLED'].includes(v.sample.state)&&v.stage==='AFTER_MEASURE'&&v.recording!=='OBSERVER_FAILED')return null;
 if(v.sample.state==='CAPTURED'){
  const p=v.sample,bindings=['STOPPING','PRIMARY_NOT_READY','FRAME_MISMATCH','NETWORK_ID_MISSING','NETWORK_ID_NONSTRING','NETWORK_ID_EMPTY','NETWORK_ID_ALREADY_BOUND'];
  if(bindings.includes(p.branch)&&p.category!=='BINDING'||p.branch==='DOCUMENT_REPEAT'&&p.category!=='NAVIGATION'||p.branch==='TOTAL_LIMIT'&&p.category!=='LIMIT'||p.branch==='POLICY_REJECT'&&['ALLOW','BINDING','LIMIT'].includes(p.category))return null;
  if(p.branch==='NETWORK_ID_MISSING'&&p.network_kind!=='MISSING'||p.branch==='NETWORK_ID_NONSTRING'&&!['UNDEFINED','NULL','BOOLEAN','NUMBER','OBJECT','ARRAY','OTHER'].includes(p.network_kind)||p.branch==='NETWORK_ID_EMPTY'&&p.network_kind!=='EMPTY_STRING'||p.branch==='NETWORK_ID_ALREADY_BOUND'&&p.network_kind!=='NONEMPTY_STRING')return null;
 }
 return JSON.parse(JSON.stringify(v));
 }catch{return null;}}
export function readBranchRecord(s,{open=openSync,read=readSync,stat=fstatSync,close=closeSync}={}){let fd;try{fd=open(BRANCH_FILE,constants.O_RDONLY|constants.O_NOFOLLOW);const st=stat(fd);if(!st.isFile()||st.size>4096)return null;const b=Buffer.alloc(4097),n=read(fd,b,0,b.length,null);if(n>4096)return null;return safeBranchRecord(JSON.parse(b.subarray(0,n)),s);}catch{return null;}finally{if(fd!==undefined)try{close(fd);}catch{}}}
export function openBranchRecord(grant,{identity=scope(),write=v=>fixedWrite(BRANCH_FILE,v,4096),read=readBranchRecord}={}){
 const s=storageScope(grant,identity);let finished=false;
 try{lstatSync(BRANCH_FILE);throw Error('FIXED_DIAGNOSTIC_STORAGE');}catch(e){if(e.code!=='ENOENT')throw Error('FIXED_DIAGNOSTIC_STORAGE');}
 let v={kind:'FIXED_BINDING_BRANCH_RECORD_V1',scope:s,stage:'BEFORE_BROWSER',recording:'COMPLETE_PREFIX',sample:emptyBranch(),timings:{initialize:'BEFORE_BROWSER_CONFIRMED',branch:'NOT_OBSERVED',finalize:'NOT_REACHED'}};
 let saved=null;const save=()=>{const x=safeBranchRecord(v,s);if(!x||saved&&!eq(read(s),saved))throw Error('FIXED_DIAGNOSTIC_STORAGE');write(x);if(!eq(read(s),x))throw Error('FIXED_DIAGNOSTIC_STORAGE');saved=x;};save();
 return{snapshot:()=>safeBranchRecord(v,s),finish(g){if(finished)throw Error('FIXED_DIAGNOSTIC_STORAGE');finished=true;let sample=null;try{sample=safeBranch(g?.bindingSnapshot?.());}catch{}
  const failed=!sample||sample.state==='INSPECTION_UNKNOWN'||g?.bindingObserverFailed?.()!==false;
  v={...v,stage:'AFTER_MEASURE',recording:failed?'OBSERVER_FAILED':'COMPLETE_PREFIX',sample:sample??emptyBranch(),timings:{...v.timings,branch:sample?.state==='CAPTURED'?'RAM_AT_DECISION_BEFORE_REJECT':failed?'UNKNOWN':'NOT_OBSERVED',finalize:'AFTER_MEASURE_RETURN'}};
  save();if(failed)throw Error('FIXED_DIAGNOSTIC_STORAGE');return safeBranchRecord(v,s);
 }};
}
export function projectBranchRecord(input,s,live){try{if(!plainData(s)||!eq(s,scope({GITHUB_ACTIONS:'true',GITHUB_REF:s.ref,GITHUB_SHA:s.sha,GITHUB_RUN_ID:s.run,GITHUB_RUN_ATTEMPT:String(s.attempt)})))s=null;}catch{s=null;}live=plainData(live)?live:null;const v=safeBranchRecord(input,s);if(!v)return{kind:'PUBLIC_BINDING_BRANCH_V1',scope:s,state:'UNKNOWN_MISSING_OR_INVALID',sample:null,timings:null,authority:'DIAGNOSTIC_ONLY'};
 let match=!!live&&eq(live.scope,s)&&live.recording==='COMPLETE_PREFIX'&&live.first_fault===null;const r=live?.result,p=v.sample;
 if(v.stage==='AFTER_MEASURE')match=match&&r?.phase==='FINISHED'&&(p.state==='CAPTURED'?r.first_refusal?.category===p.category&&r.first_refusal?.resource_type===p.resource_type&&r.first_refusal?.phase===p.phase:r.first_refusal===null);
 return{kind:'PUBLIC_BINDING_BRANCH_V1',scope:s,state:v.stage!=='AFTER_MEASURE'?'UNKNOWN_NOT_FINALIZED':!match?'UNKNOWN_RESULT_MISMATCH':v.recording!=='COMPLETE_PREFIX'?'UNKNOWN_OBSERVER_FAILED':'FIXED_RECORD_VALIDATED',sample:match?p:null,timings:{...v.timings,readback:match?'PUBLISHER_SCOPE_AND_RESULT_MATCH':'UNKNOWN'},authority:'DIAGNOSTIC_ONLY'};
}
export function branchAllowsAdoption(v,s,live){const p=projectBranchRecord(v,s,live);return p.state==='FIXED_RECORD_VALIDATED'&&p.sample?.state==='NO_BOUNDARY_REFUSAL_OBSERVED'&&live?.result?.status==='PASSED';}
