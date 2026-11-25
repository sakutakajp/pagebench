// Fixed diagnostic evidence only. Never substitutes for an admission predicate.
import {readFileSync,writeFileSync,renameSync,lstatSync,openSync,closeSync,readSync,fstatSync,constants} from 'node:fs';
import {isNativeError,isProxy} from 'node:util/types';
import {plainData,own} from '../native-score-proof/case-project.mjs';
import {scope,RECEIPTS} from './config.mjs';
export const CHECKS=Object.freeze(['SCOPE','EVENT_READ','RUNTIME','GIT_IDENTITY','EVENT','CLEAN_TREE','PINS_READ','PINS_HASH','PATHS_READ','PATHS_MATCH','UNIT_CHROME','UNIT_FILESYSTEM','UNIT_PUBLIC','UNIT_TOP','UNIT_NATIVE','UNIT_HISTORY','UNIT_ADMISSION','API_TRANSPORT','API_HTTP','API_JSON','API_METADATA','CONSUME']);
export const EVENT_FIELDS=Object.freeze(['repo','ref','attempt','event','created','forced','deleted','parent','count','subject','sha_format','head','event_head']);
export const API_FIELDS=Object.freeze(['total','rows','run_id','sha','event','attempt','path']);
const classes=['ERROR','TYPE_ERROR','RANGE_ERROR','SYNTAX_ERROR','REFERENCE_ERROR','OTHER_NATIVE_ERROR','UNKNOWN'];
const codes=['UNKNOWN','ENOENT','EACCES','EEXIST','ENOSPC','EMFILE','EPIPE','ECONNRESET','ECONNREFUSED','ETIMEDOUT','ENOTFOUND','EAI_AGAIN','ABORT_ERR','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_SOCKET'];
const reasons=['UNKNOWN','CLOSED_SCOPE','FIXED_EVENT','FIXED_SOURCE','FIXED_UNITS','FIXED_RUN','FIXED_ARGS','FIXED_DIAGNOSTIC_STORAGE'];
const verdicts=['NOT_REACHED','PASS','FAIL','UNKNOWN'];
const http=['NOT_REACHED','HTTP_2XX','HTTP_401','HTTP_403','HTTP_404','HTTP_429','HTTP_4XX','HTTP_5XX','HTTP_OTHER','UNKNOWN'];
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const exact=(v,keys)=>plainData(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
export function failure(error,stage){
 let native_class='UNKNOWN',node_code='UNKNOWN',cause_node_code='UNKNOWN',reason='UNKNOWN';
 try{if(!isProxy(error)&&isNativeError(error)){
  const p=Object.getPrototypeOf(error);native_class=p===TypeError.prototype?'TYPE_ERROR':p===RangeError.prototype?'RANGE_ERROR':p===SyntaxError.prototype?'SYNTAX_ERROR':p===ReferenceError.prototype?'REFERENCE_ERROR':p===Error.prototype?'ERROR':'OTHER_NATIVE_ERROR';
  const m=own(error,'message');if(reasons.includes(m))reason=m;const c=own(error,'code');if(codes.includes(c))node_code=c;
  const cause=own(error,'cause');if(!isProxy(cause)&&isNativeError(cause)){const c=own(cause,'code');if(codes.includes(c))cause_node_code=c;}
 }}catch{}
 return{stage:CHECKS.includes(stage)?stage:'UNKNOWN',reason,native_class,node_code,cause_node_code};
}
export function httpLabel(response){let n;try{if(isProxy(response))return'UNKNOWN';n=own(response,'status');if(n===undefined)n=Object.getOwnPropertyDescriptor(Response.prototype,'status').get.call(response);}catch{}return Number.isInteger(n)?n>=200&&n<300?'HTTP_2XX':[401,403,404,429].includes(n)?'HTTP_'+n:n>=400&&n<500?'HTTP_4XX':n>=500&&n<600?'HTTP_5XX':'HTTP_OTHER':'UNKNOWN';}
export function safeReceipt(v,identity,mode){try{
 if(!exact(v,['kind','scope','mode','status','stage','checks','event','api','http','first_fault','recording','writes','consume','exit_code','authority'])||v.kind!=='FIXED_CLOSED_ADMISSION_EVIDENCE'||!['PRECHECK','JIT'].includes(mode)||v.mode!==mode||!eq(v.scope,identity)||!['PENDING','ADMITTED','REJECTED'].includes(v.status)||!['INITIAL','DONE','UNKNOWN',...CHECKS].includes(v.stage)||!exact(v.checks,CHECKS)||Object.values(v.checks).some(x=>!verdicts.includes(x))||!exact(v.event,EVENT_FIELDS)||Object.values(v.event).some(x=>!verdicts.includes(x))||!exact(v.api,API_FIELDS)||Object.values(v.api).some(x=>!verdicts.includes(x))||!http.includes(v.http)||!['COMPLETE_PREFIX','WRITE_GAP'].includes(v.recording)||!Number.isInteger(v.writes)||v.writes<1||v.writes>32||v.consume!==(mode==='JIT')||v.exit_code!==null&&(!Number.isInteger(v.exit_code)||v.exit_code<0||v.exit_code>255)||v.authority!=='DIAGNOSTIC_ONLY_ORIGINAL_PREDICATES_STILL_REQUIRED')return null;
 if(identity!==null&&!eq(scope({GITHUB_ACTIONS:'true',GITHUB_REF:identity.ref,GITHUB_SHA:identity.sha,GITHUB_RUN_ID:identity.run,GITHUB_RUN_ATTEMPT:String(identity.attempt)}),identity))return null;
 if(v.first_fault!==null){const f=v.first_fault;if(!exact(f,['stage','reason','native_class','node_code','cause_node_code'])||!['UNKNOWN',...CHECKS].includes(f.stage)||!reasons.includes(f.reason)||!classes.includes(f.native_class)||!codes.includes(f.node_code)||!codes.includes(f.cause_node_code))return null;}
 if(v.status==='ADMITTED'&&(identity===null||v.stage!=='DONE'||v.first_fault!==null||v.recording!=='COMPLETE_PREFIX'||Object.values(v.checks).some(x=>x!=='PASS')||Object.values(v.event).some(x=>x!=='PASS')||Object.values(v.api).some(x=>x!=='PASS')))return null;
 return JSON.parse(JSON.stringify(v));
 }catch{return null;}}
export function fixedWrite(path,value,max=16384){const text=JSON.stringify(value);if(Buffer.byteLength(text)>max)throw Error('FIXED_DIAGNOSTIC_STORAGE');writeFileSync(path+'.tmp',text,{flag:'wx',mode:0o600});renameSync(path+'.tmp',path);if(readFileSync(path,'utf8')!==text)throw Error('FIXED_DIAGNOSTIC_STORAGE');}
export function createReceipt(mode,env=process.env,{write=v=>fixedWrite(RECEIPTS[mode],v)}={}){
 if(!Object.hasOwn(RECEIPTS,mode))throw Error('FIXED_ARGS');let identity=null;try{identity=scope(env);}catch{}
 const v={kind:'FIXED_CLOSED_ADMISSION_EVIDENCE',scope:identity,mode,status:'PENDING',stage:'INITIAL',checks:Object.fromEntries(CHECKS.map(k=>[k,'NOT_REACHED'])),event:Object.fromEntries(EVENT_FIELDS.map(k=>[k,'NOT_REACHED'])),api:Object.fromEntries(API_FIELDS.map(k=>[k,'NOT_REACHED'])),http:'NOT_REACHED',first_fault:null,recording:'COMPLETE_PREFIX',writes:0,consume:mode==='JIT',exit_code:null,authority:'DIAGNOSTIC_ONLY_ORIGINAL_PREDICATES_STILL_REQUIRED'};
 let count=0;const snapshot=()=>({...v,writes:Math.max(1,count)}),save=()=>{if(count>=32){v.recording='WRITE_GAP';return false;}count++;try{const out=safeReceipt(snapshot(),identity,mode);if(!out)throw Error();write(out);return true;}catch{v.recording='WRITE_GAP';return false;}};save();
 return{snapshot,identity,begin(stage){if(!CHECKS.includes(stage))throw Error('FIXED_ARGS');v.stage=stage;},pass(stage){v.checks[stage]='PASS';save();},details(kind,values){const keys=kind==='event'?EVENT_FIELDS:kind==='api'?API_FIELDS:[];for(const k of keys)v[kind][k]=verdicts.includes(values[k])?values[k]:'UNKNOWN';},http(response){v.http=httpLabel(response);},reject(error){v.first_fault??=failure(error,v.stage);if(CHECKS.includes(v.stage))v.checks[v.stage]='FAIL';v.status='REJECTED';save();},admitted(){v.status='ADMITTED';v.stage='DONE';if(!save()||v.recording!=='COMPLETE_PREFIX')throw Error('FIXED_DIAGNOSTIC_STORAGE');},exit(code){v.exit_code=Number.isInteger(code)&&code>=0&&code<=255?code:null;save();}};
}
export function readReceipt(mode,identity){let fd;try{const p=RECEIPTS[mode],st=lstatSync(p);if(!st.isFile()||st.isSymbolicLink()||st.size>16384)return null;fd=openSync(p,constants.O_RDONLY|constants.O_NOFOLLOW);if(fstatSync(fd).size>16384)return null;const b=Buffer.alloc(16385),n=readSync(fd,b,0,b.length,null);if(n>16384)return null;return safeReceipt(JSON.parse(b.subarray(0,n)),identity,mode);}catch{return null;}finally{if(fd!==undefined)try{closeSync(fd);}catch{}}}
