import {spawnSync} from 'node:child_process';
import {safeScan as parentSafe,projectCapture as parentProject,POSITIONS} from '../passive-html-origin-joint/scan.mjs';
import {classifyOrigin} from '../passive-html-origin-joint/origin.mjs';
import {classifyBeacon,HOST_CLASSES,PATH_CLASSES} from './beacon.mjs';
const exact=(v,keys)=>v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const int=(v,max)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
const EVIDENCE=['OBSERVED_LEXICAL_MATCH_NOT_EXECUTION','NO_MATCH_IN_COMPLETE_ABSOLUTE_HTTPS_SRC_SCOPE','UNKNOWN_OR_INCOMPLETE'];
const KEYS=['position','host','path','userinfo','port','fragment','count'];
const key=r=>JSON.stringify(KEYS.slice(0,-1).map(k=>r[k]));
const blank=()=>({basis:'OUTSIDE_APPROVED_ABSOLUTE_HTTPS_SRC_STATIC_ATTRIBUTE',context:'LEXICAL_POSITION_NOT_BROWSER_DOM_OR_ACTIVE_SCRIPT',reference_identity:'NOT_HISTORICAL_REQUEST_OR_INSERTION_ATTRIBUTION',scope:'HOST_AND_PATH_ON_SAME_ATTRIBUTE_ONLY_QUERY_NOT_TESTED',coverage:'UNKNOWN_OR_INCOMPLETE',host_evidence:'UNKNOWN_OR_INCOMPLETE',same_element_official_path_evidence:'UNKNOWN_OR_INCOMPLETE',observed_outside_absolute_https:0,unknown_absolute_https:0,rows_limited:false,counts_saturated:false,rows:[]});
const complete=base=>{const j=base.absolute_https_script_origins;return j.coverage==='COMPLETE_STATIC_LEXICAL_NOT_BROWSER_DOM'&&!j.input_limited&&!j.rows_limited&&!j.counts_saturated&&!j.unretained_absolute_https&&!j.unclassifiable_attributes;};
export function safeBeacon(v){
 const t=blank();if(!exact(v,Object.keys(t))||['basis','context','reference_identity','scope'].some(k=>v[k]!==t[k])||!['COMPLETE_ABSOLUTE_HTTPS_SRC_SCOPE','UNKNOWN_OR_INCOMPLETE'].includes(v.coverage)||!EVIDENCE.includes(v.host_evidence)||!EVIDENCE.includes(v.same_element_official_path_evidence)||!int(v.observed_outside_absolute_https,256)||!int(v.unknown_absolute_https,1024)||typeof v.rows_limited!=='boolean'||typeof v.counts_saturated!=='boolean'||!Array.isArray(v.rows)||v.rows.length>64)return null;
 for(const r of v.rows)if(!exact(r,KEYS)||!POSITIONS.includes(r.position)||!HOST_CLASSES.includes(r.host)||!PATH_CLASSES.includes(r.path)||!['ABSENT','EMPTY_MARKER','NONEMPTY'].includes(r.userinfo)||!['DEFAULT_OR_ABSENT','NONDEFAULT'].includes(r.port)||!['ABSENT','EMPTY_MARKER','NONEMPTY'].includes(r.fragment)||!int(r.count,256)||r.count===0||r.host==='UNKNOWN'||r.host==='EXACT_CANDIDATE_HOST'&&!['EXACT_OFFICIAL_PATH','OTHER_PATH'].includes(r.path)||r.host==='OTHER_HOST'&&r.path!=='NOT_APPLICABLE')return null;
 if(new Set(v.rows.map(key)).size!==v.rows.length)return null;
 const total=v.rows.reduce((n,r)=>n+r.count,0);if(total>v.observed_outside_absolute_https||!v.rows_limited&&total!==v.observed_outside_absolute_https)return null;
 const knownHost=v.rows.some(r=>r.host==='EXACT_CANDIDATE_HOST'),knownPath=v.rows.some(r=>r.host==='EXACT_CANDIDATE_HOST'&&r.path==='EXACT_OFFICIAL_PATH');
 for(const [field,positive] of [['host_evidence',knownHost],['same_element_official_path_evidence',knownPath]])if(positive?v[field]!=='OBSERVED_LEXICAL_MATCH_NOT_EXECUTION':v[field]!== (v.coverage==='COMPLETE_ABSOLUTE_HTTPS_SRC_SCOPE'?'NO_MATCH_IN_COMPLETE_ABSOLUTE_HTTPS_SRC_SCOPE':'UNKNOWN_OR_INCOMPLETE'))return null;
 if(v.coverage==='COMPLETE_ABSOLUTE_HTTPS_SRC_SCOPE'&&(v.unknown_absolute_https||v.rows_limited||v.counts_saturated))return null;
 return JSON.parse(JSON.stringify(v));
}
export function safeScan(v){
 if(!v||typeof v!=='object')return null;const {official_beacon_match:beacon,...base}=v;if(!parentSafe(base)||!safeBeacon(beacon))return null;
 if(beacon.coverage==='COMPLETE_ABSOLUTE_HTTPS_SRC_SCOPE'&&!complete(base))return null;
 if(base.body_token_coverage!=='COMPLETE_STATIC_LEXICAL_NOT_BROWSER_DOM'&&beacon.rows.some(r=>r.position!=='UNKNOWN_OR_AMBIGUOUS'))return null;
 const j=base.absolute_https_script_origins;
 if(beacon.observed_outside_absolute_https+beacon.unknown_absolute_https>j.observed_absolute_https&&!j.counts_saturated)return null;
 if(!j.rows_limited&&!j.counts_saturated&&(beacon.observed_outside_absolute_https!==j.rows.filter(r=>r.origin==='OUTSIDE_APPROVED').reduce((n,r)=>n+r.count,0)||beacon.unknown_absolute_https!==j.rows.filter(r=>r.origin==='INVALID_OR_UNKNOWN').reduce((n,r)=>n+r.count,0)))return null;
 return JSON.parse(JSON.stringify(v));
}
// Reuse the exact parent bounded parser/private protocol. No extra parser/network/process.
export function projectCapture(wrapper,bytes){
 const base=parentProject(wrapper,bytes);if(!base)return null;
 try{
  const m=wrapper.origin_capture,v=blank(),rows=new Map();
  v.unknown_absolute_https=Math.min(1024,Object.values(m.unresolved).reduce((a,b)=>a+b,0));
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes),lines=text===''?[]:text.slice(0,-1).split('\n');
  for(const line of lines){
   const r=JSON.parse(line),origin=classifyOrigin(r.value);
   if(origin.origin==='INVALID_OR_UNKNOWN'){v.unknown_absolute_https=Math.min(1024,v.unknown_absolute_https+1);continue;}
   if(origin.origin!=='OUTSIDE_APPROVED')continue;
   const matched=classifyBeacon(r.value);if(matched.host==='UNKNOWN'){v.unknown_absolute_https=Math.min(1024,v.unknown_absolute_https+1);continue;}
   v.observed_outside_absolute_https++;
   const position=base.body_token_coverage==='COMPLETE_STATIC_LEXICAL_NOT_BROWSER_DOM'?r.position:'UNKNOWN_OR_AMBIGUOUS';
   const row={position,...matched,userinfo:origin.userinfo,port:origin.port,fragment:origin.fragment,count:1},k=key(row);
   if(rows.has(k))rows.get(k).count++;else if(rows.size<64)rows.set(k,row);else v.rows_limited=true;
  }
  v.rows=[...rows.values()];v.counts_saturated=base.absolute_https_script_origins.counts_saturated;
  v.coverage=complete(base)&&!v.unknown_absolute_https&&!v.rows_limited?'COMPLETE_ABSOLUTE_HTTPS_SRC_SCOPE':'UNKNOWN_OR_INCOMPLETE';
  for(const [field,positive] of [['host_evidence',v.rows.some(r=>r.host==='EXACT_CANDIDATE_HOST')],['same_element_official_path_evidence',v.rows.some(r=>r.host==='EXACT_CANDIDATE_HOST'&&r.path==='EXACT_OFFICIAL_PATH')]])v[field]=positive?'OBSERVED_LEXICAL_MATCH_NOT_EXECUTION':v.coverage==='COMPLETE_ABSOLUTE_HTTPS_SRC_SCOPE'?'NO_MATCH_IN_COMPLETE_ABSOLUTE_HTTPS_SRC_SCOPE':'UNKNOWN_OR_INCOMPLETE';
  return safeScan({...base,official_beacon_match:v});
 }catch{return null;}
}
export function parse(html,link){
 const p=spawnSync('python3',[new URL('../passive-html-origin-joint/parser.py',import.meta.url).pathname],{input:JSON.stringify({html,link}),stdio:['pipe','pipe','pipe','pipe'],timeout:2000,maxBuffer:65536,env:{PATH:process.env.PATH,LANG:'C.UTF-8',PYTHONDONTWRITEBYTECODE:'1'}});
 const bytes=p.output?.[3];try{if(p.status!==0||p.signal||p.error||p.stderr?.length||!Buffer.isBuffer(p.stdout))return null;return projectCapture(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(p.stdout)),bytes);}catch{return null;}finally{if(Buffer.isBuffer(bytes))bytes.fill(0);}
}
