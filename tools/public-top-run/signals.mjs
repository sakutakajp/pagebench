// Fixed metadata at ORIGINAL top-producer boundaries. No browser calls or gate.
import {isProxy} from 'node:util/types';
import {lstatSync,openSync,fstatSync,readSync,closeSync,constants} from 'node:fs';
import {join} from 'node:path';
import {TOP_CASES} from '../natural-reads/top-memory.mjs';
import {topCaseVerdict} from '../natural-reads/top-browser.mjs';
import {safeSample} from '../ab-observe/state.mjs';
import {scope,fixedWrite} from './records.mjs';

export const JOURNAL='public-top-progress.json';
const LIMIT=32768;
const VERSION=/^(Chrome|HeadlessChrome)\/\d{1,10}\.\d{1,10}\.\d{1,10}\.\d{1,10}$/;
const PHASES=['OPEN','CONFIG','NAVIGATION','WINDOW','OBSERVATION','SHARED_SAMPLE','SEAL','CLEANUP','FINISHED','UNKNOWN'];
const REASONS=['CHILD_EXIT_WITHOUT_FINAL','CHILD_TIMEOUT','INVALID_CHILD_PROTOCOL','GUARD_OR_CHILD_FAILURE','FIXED_OBSERVATION_COMPLETE','PREREQUISITE_FAILED','PARENT_RECORD_UNAVAILABLE','AWAITING_START_GRANT','CHILD_RUNNING_OR_EXIT_UNCONFIRMED','UNKNOWN'];
const FIELDS={point:['NOT_STARTED','CASE_STARTED','RESULT_RETURNED','SUPERVISOR_THROWN','NOT_RUN_CONFIRMED'],case_status:['PASSED','FAILED','NOT_RUN','UNKNOWN'],continuation:['SAFE_CLOSED_NEXT_CASE','STOP_UNCERTAIN_SAFETY_OR_FAILURE','UNKNOWN'],initial_original_predicate:['TRUE','FALSE','UNKNOWN'],uncaught_free_predicate:['TRUE','FALSE','UNKNOWN'],hook_predicate:['PROVED_BY_APP_ERROR_HOOK','NOT_CONFIRMED','NOT_REQUIRED','UNKNOWN'],first_sample:['UNKNOWN','ERROR_500','ORIGINAL_CONTENT','SHORT_CONTENT','OTHER_OR_UNKNOWN','NOT_AVAILABLE','INVALID_OR_UNAVAILABLE'],end_sample:['UNKNOWN','ERROR_500','ORIGINAL_CONTENT','SHORT_CONTENT','OTHER_OR_UNKNOWN','NOT_AVAILABLE','INVALID_OR_UNAVAILABLE'],same_document:['TRUE','FALSE','UNKNOWN'],child_started:['TRUE','FALSE','UNKNOWN'],observation_source:['PARENT_FINAL_OBSERVATION','UNAVAILABLE'],parent_reason:REASONS,parent_cleanup:['COMPLETE','UNKNOWN_OR_FAILED','UNKNOWN'],child_phase:PHASES,chrome_source:['ORIGINAL_PARENT_FINAL_CHROME_FIELD','UNKNOWN']};
const exact=(v,keys)=>{if(!v||typeof v!=='object'||isProxy(v)||Object.getPrototypeOf(v)!==Object.prototype)return false;const own=Reflect.ownKeys(v);return own.every(k=>typeof k==='string')&&own.toSorted().join(',')===keys.toSorted().join(',')&&keys.every(k=>Object.hasOwn(Object.getOwnPropertyDescriptor(v,k),'value'));};
const list=v=>v&&typeof v==='object'&&!isProxy(v)&&Array.isArray(v)&&Reflect.ownKeys(v).length===v.length+1&&Array.from({length:v.length},(_,i)=>Object.getOwnPropertyDescriptor(v,String(i))).every(d=>d&&Object.hasOwn(d,'value'));
function safeData(v,depth=0,budget={n:0},stack=new Set()){
 if(++budget.n>4096||depth>18)return false;
 if(v===null||typeof v==='boolean')return true;
 if(typeof v==='number')return Number.isFinite(v);
 if(typeof v==='string')return v.length<=256;
 if(!v||typeof v!=='object'||isProxy(v)||stack.has(v)||!Array.isArray(v)&&Object.getPrototypeOf(v)!==Object.prototype)return false;
 const keys=Reflect.ownKeys(v);if(keys.length>257)return false;stack.add(v);
 const good=keys.every(k=>{if(typeof k!=='string')return false;const d=Object.getOwnPropertyDescriptor(v,k);return d&&Object.hasOwn(d,'value')&&safeData(d.value,depth+1,budget,stack);});stack.delete(v);return good;
}
const tri=v=>v===true?'TRUE':v===false?'FALSE':'UNKNOWN';
const choose=(v,allowed)=>typeof v==='string'&&allowed.includes(v)?v:'UNKNOWN';
const version=v=>typeof v==='string'&&v.length<=64&&VERSION.test(v)?v:null;
const field=(v,key)=>{if(!v||typeof v!=='object'||isProxy(v))return undefined;const d=Object.getOwnPropertyDescriptor(v,key);return d&&Object.hasOwn(d,'value')?d.value:undefined;};
export function emptyRow(name){return{case:name,point:'NOT_STARTED',case_status:'UNKNOWN',continuation:'UNKNOWN',initial_original_predicate:'UNKNOWN',uncaught_free_predicate:'UNKNOWN',hook_predicate:'UNKNOWN',first_sample:'NOT_AVAILABLE',end_sample:'NOT_AVAILABLE',same_document:'UNKNOWN',child_started:'UNKNOWN',observation_source:'UNAVAILABLE',parent_reason:'UNKNOWN',parent_cleanup:'UNKNOWN',child_phase:'UNKNOWN',chrome:null,chrome_source:'UNKNOWN'};}
export function caseSignals(name,r,chrome,{thrown=false}={}){
 const row={...emptyRow(name),point:thrown?'SUPERVISOR_THROWN':'RESULT_RETURNED'};
 if(!TOP_CASES.includes(name)||!safeData(r))return row;
 try{
  const v=topCaseVerdict(name,r,chrome),o=r?.observation,p=r?.progress;
  const sample=x=>x==null?'NOT_AVAILABLE':safeSample(x)?.state??'INVALID_OR_UNAVAILABLE';
  const c=version(o?.chrome);
  return{...row,case_status:v.status==='passed'?'PASSED':v.status==='failed'?'FAILED':'UNKNOWN',continuation:choose(v.continuation,FIELDS.continuation),initial_original_predicate:tri(v.initial_original),uncaught_free_predicate:tri(v.uncaught_free),hook_predicate:choose(v.hook_registration,FIELDS.hook_predicate),first_sample:sample(o?.samples?.first),end_sample:sample(o?.samples?.end),same_document:tri(o?.samples?.same_document),child_started:tri(r?.child_started),observation_source:o?'PARENT_FINAL_OBSERVATION':'UNAVAILABLE',parent_reason:choose(r?.reason,REASONS),parent_cleanup:choose(r?.cleanup,FIELDS.parent_cleanup),child_phase:choose(p?.phase??o?.phase,PHASES),chrome:c,chrome_source:c?'ORIGINAL_PARENT_FINAL_CHROME_FIELD':'UNKNOWN'};
 }catch{return row;}
}
export function validScope(v){try{if(!safeData(v))return null;const out=scope({GITHUB_SHA:v.sha,GITHUB_RUN_ID:v.run_id,GITHUB_RUN_ATTEMPT:String(v.attempt),GITHUB_REF:v.ref});return exact(v,Object.keys(out))&&JSON.stringify(v)===JSON.stringify(out)?out:null;}catch{return null;}}
function safeRow(v,i){
 if(!exact(v,Object.keys(emptyRow(TOP_CASES[i])))||v.case!==TOP_CASES[i])return null;
 for(const[k,allowed]of Object.entries(FIELDS))if(!allowed.includes(v[k]))return null;
 if(v.chrome!==null&&!version(v.chrome)||v.chrome===null&&v.chrome_source!=='UNKNOWN'||v.chrome!==null&&v.chrome_source!=='ORIGINAL_PARENT_FINAL_CHROME_FIELD')return null;
 if(['NOT_STARTED','CASE_STARTED','NOT_RUN_CONFIRMED'].includes(v.point)){const expected={...emptyRow(v.case),point:v.point,case_status:v.point==='NOT_RUN_CONFIRMED'?'NOT_RUN':'UNKNOWN'};if(JSON.stringify(v)!==JSON.stringify(expected))return null;}
 if(v.case_status==='NOT_RUN'&&v.point!=='NOT_RUN_CONFIRMED'||v.case_status==='PASSED'&&(v.point!=='RESULT_RETURNED'||v.continuation!=='SAFE_CLOSED_NEXT_CASE'))return null;
 const out=emptyRow(v.case);for(const k of Object.keys(out))out[k]=v[k];return out;
}
export function safeJournal(v,expected){try{
 const keys=['kind','scope','phase','sequence','recording','producer_status','cases','chrome','chrome_source','authority','score_status','score_saved','report_saved'];
 if(!safeData(v)||!exact(v,keys)||!validScope(v.scope)||JSON.stringify(v.scope)!==JSON.stringify(expected)||v.kind!=='FIXED_TOP_PRODUCER_BOUNDARIES'||!['INITIAL','CASE_IN_PROGRESS','CASE_RESULT_RECORDED','PRODUCER_RETURNED','PRODUCER_THROWN'].includes(v.phase)||!Number.isInteger(v.sequence)||v.sequence<1||v.sequence>16||!['COMPLETE_OBSERVED_PREFIX','WRITE_GAP_OBSERVED','CAPTURE_UNKNOWN'].includes(v.recording)||!['PASSED','FAILED','UNKNOWN'].includes(v.producer_status)||!list(v.cases)||v.cases.length!==6||v.authority!=='ORIGINAL_PREDICATE_OBSERVATION_NOT_GATE_ADMISSION'||v.score_status!=='NOT_MEASURED_NO_LIGHTHOUSE_ON_THIS_PATH'||v.score_saved!==false||v.report_saved!==false)return null;
 const cases=v.cases.map(safeRow);if(cases.some(c=>!c)||cases.filter(c=>c.point==='CASE_STARTED').length>1)return null;
 if(v.producer_status==='PASSED'&&cases.some(c=>c.case_status!=='PASSED'||c.point!=='RESULT_RETURNED'||c.continuation!=='SAFE_CLOSED_NEXT_CASE'))return null;
 if(v.chrome!==null&&!version(v.chrome)||!['ORIGINAL_TOP_PRODUCER_CHROME_FIELD','FIRST_RETURNED_PARENT_CHROME_FIELD','UNKNOWN'].includes(v.chrome_source)||v.chrome===null&&v.chrome_source!=='UNKNOWN'||v.chrome!==null&&v.chrome_source==='UNKNOWN')return null;
 if(v.phase!=='PRODUCER_RETURNED'&&v.producer_status!=='UNKNOWN'||v.phase==='PRODUCER_RETURNED'&&v.producer_status!=='UNKNOWN'&&v.cases.some(c=>['NOT_STARTED','CASE_STARTED'].includes(c.point)))return null;
 const out={kind:v.kind,scope:validScope(v.scope),phase:v.phase,sequence:v.sequence,recording:v.recording,producer_status:v.producer_status,cases,chrome:v.chrome,chrome_source:v.chrome_source,authority:v.authority,score_status:v.score_status,score_saved:false,report_saved:false};
 return Buffer.byteLength(JSON.stringify(out))<=LIMIT?out:null;
 }catch{return null;}}
export function createJournal(identity,{directory='.',write=v=>fixedWrite(v,join(directory,JOURNAL),LIMIT)}={}){
 const s=validScope(identity);if(!s)throw Error('FIXED_TOP_SCOPE');let attempts=0,chrome=null,source='UNKNOWN',phase='INITIAL',producer='UNKNOWN',recording='COMPLETE_OBSERVED_PREFIX';const rows=TOP_CASES.map(emptyRow);
 const snapshot=()=>({kind:'FIXED_TOP_PRODUCER_BOUNDARIES',scope:s,phase,sequence:Math.max(1,attempts),recording,producer_status:producer,cases:rows.map(r=>({...r})),chrome,chrome_source:source,authority:'ORIGINAL_PREDICATE_OBSERVATION_NOT_GATE_ADMISSION',score_status:'NOT_MEASURED_NO_LIGHTHOUSE_ON_THIS_PATH',score_saved:false,report_saved:false});
 const save=()=>{if(attempts>=16){recording='WRITE_GAP_OBSERVED';return;}attempts++;try{const v=safeJournal(snapshot(),s);if(!v)throw Error();write(v);}catch{recording='WRITE_GAP_OBSERVED';}};
 save();return{snapshot,begin(name){const i=TOP_CASES.indexOf(name);if(i<0||rows[i].point!=='NOT_STARTED'){recording='CAPTURE_UNKNOWN';save();return;}rows[i]={...emptyRow(name),point:'CASE_STARTED'};phase='CASE_IN_PROGRESS';save();},returned(name,r,{thrown=false}={}){const i=TOP_CASES.indexOf(name);if(i<0||rows[i].point!=='CASE_STARTED'){recording='CAPTURE_UNKNOWN';save();return;}rows[i]=caseSignals(name,r,chrome,{thrown});if(!chrome&&rows[i].chrome){chrome=rows[i].chrome;source='FIRST_RETURNED_PARENT_CHROME_FIELD';}phase='CASE_RESULT_RECORDED';save();},finished(top){phase='PRODUCER_RETURNED';try{const cases=field(top,'cases'),status=field(top,'status');if(field(top,'kind')!=='TOP_RUNNER_REAL_CHROME_CLOSED_PROOF'||!list(cases)||cases.length!==6||!['passed','failed'].includes(status))throw Error();for(let i=0;i<6;i++){const c=cases[i],name=field(c,'case'),state=field(c,'status');if(name!==TOP_CASES[i]||!['passed','failed','not_run'].includes(state))throw Error();if(state==='not_run')rows[i]={...emptyRow(name),point:'NOT_RUN_CONFIRMED',case_status:'NOT_RUN'};else if(rows[i].case_status!==(state==='passed'?'PASSED':'FAILED'))throw Error();}producer=status==='passed'?'PASSED':'FAILED';const c=version(field(top,'chrome'));if(c){chrome=c;source='ORIGINAL_TOP_PRODUCER_CHROME_FIELD';}}catch{recording='CAPTURE_UNKNOWN';producer='UNKNOWN';}save();},failed(){phase='PRODUCER_THROWN';save();}};
}
export function readJournal(directory,expected){let fd;try{const p=join(directory,JOURNAL),st=lstatSync(p);if(!st.isFile()||st.isSymbolicLink()||st.size>LIMIT)throw Error();fd=openSync(p,constants.O_RDONLY|constants.O_NOFOLLOW);const opened=fstatSync(fd);if(!opened.isFile()||opened.size>LIMIT)throw Error();const b=Buffer.alloc(LIMIT+1),n=readSync(fd,b,0,b.length,null);if(n>LIMIT)throw Error();const value=safeJournal(JSON.parse(b.subarray(0,n)),expected);return{state:value?'VALID_FIXED_PREFIX':'INVALID_OR_UNREADABLE',value};}catch(e){return{state:e?.code==='ENOENT'?'MISSING':'INVALID_OR_UNREADABLE',value:null};}finally{if(fd!==undefined)try{closeSync(fd);}catch{}}}
