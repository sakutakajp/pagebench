import {spawnSync} from 'node:child_process';
import {safeScan as baseSafe} from '../passive-html-channels/project.mjs';
import {classifyOrigin,ORIGIN_LABELS,USERINFO,PORTS,FRAGMENTS,GUARDS,UNKNOWN_ORIGIN} from './origin.mjs';
export const POSITIONS=['HEAD','BODY','AFTER_EXPLICIT_BODY_END','OUTSIDE_EXPLICIT_HEAD_BODY','UNKNOWN_OR_AMBIGUOUS'];
const EXCLUDED=['RELATIVE_UNRESOLVED','PROTOCOL_RELATIVE_UNRESOLVED','NON_HTTPS'];
const exact=(v,keys)=>v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const integer=(n,max)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
const bins=(v,keys)=>exact(v,keys)&&Object.values(v).every(n=>integer(n,1024));
const rowKeys=['position','origin','guard_on_attribute','userinfo','port','fragment','count'];
const tupleValid=r=>r.origin==='INVALID_OR_UNKNOWN'?r.guard_on_attribute==='UNKNOWN'&&[r.userinfo,r.port,r.fragment].every(v=>v==='UNKNOWN'):r.port!=='UNKNOWN'&&r.userinfo!=='UNKNOWN'&&r.fragment!=='UNKNOWN'&&(r.origin==='OUTSIDE_APPROVED'?r.guard_on_attribute==='REJECT_ON_ATTRIBUTE':r.port==='DEFAULT_OR_ABSENT'&&r.guard_on_attribute===(r.userinfo==='NONEMPTY'||r.fragment==='NONEMPTY'?'REJECT_ON_ATTRIBUTE':'PASS_ORIGIN_ONLY'));
const rowValid=r=>tupleValid(r)&&exact(r,rowKeys)&&POSITIONS.includes(r.position)&&ORIGIN_LABELS.includes(r.origin)&&GUARDS.includes(r.guard_on_attribute)&&USERINFO.includes(r.userinfo)&&PORTS.includes(r.port)&&FRAGMENTS.includes(r.fragment)&&integer(r.count,1024)&&r.count>0;
const key=r=>JSON.stringify(rowKeys.slice(0,-1).map(k=>r[k]));
const template=()=>({basis:'DECODED_STATIC_ATTRIBUTE_NOT_OBSERVED_REQUEST',permission:'ORIGIN_PREDICATE_ONLY_NOT_FULL_REQUEST_PERMISSION',position_basis:'LEXICAL_GLOBAL_AMBIGUITY_COARSENS_ALL_POSITIONS',base_resolution:'NOT_APPLIED_TO_ABSOLUTE_OR_UNRESOLVED',coverage:'AMBIGUOUS',input_limited:false,rows_limited:false,counts_saturated:false,observed_absolute_https:0,unretained_absolute_https:0,excluded:{RELATIVE_UNRESOLVED:0,PROTOCOL_RELATIVE_UNRESOLVED:0,NON_HTTPS:0},unclassifiable_attributes:0,rows:[]});
export function safeJoint(v){
 const t=template();if(!exact(v,Object.keys(t))||['basis','permission','position_basis','base_resolution'].some(k=>v[k]!==t[k])||!['COMPLETE_STATIC_LEXICAL_NOT_BROWSER_DOM','AMBIGUOUS','TOKEN_LIMITED'].includes(v.coverage)||['input_limited','rows_limited','counts_saturated'].some(k=>typeof v[k]!=='boolean')||!integer(v.observed_absolute_https,1024)||!integer(v.unretained_absolute_https,1024)||!integer(v.unclassifiable_attributes,1024)||!bins(v.excluded,EXCLUDED)||!Array.isArray(v.rows)||v.rows.length>64||!v.rows.every(rowValid)||new Set(v.rows.map(key)).size!==v.rows.length)return null;
 if(v.coverage!=='COMPLETE_STATIC_LEXICAL_NOT_BROWSER_DOM'&&v.rows.some(r=>r.position!=='UNKNOWN_OR_AMBIGUOUS'))return null;
 const total=v.rows.reduce((n,r)=>n+r.count,0);if(!v.rows_limited&&!v.counts_saturated&&total!==v.observed_absolute_https)return null;
 if(total>v.observed_absolute_https&&!v.counts_saturated)return null;
 if(v.unretained_absolute_https&&!v.input_limited)return null;
 return JSON.parse(JSON.stringify(v));
}
export function safeScan(v){
 if(!v||typeof v!=='object')return null;const {absolute_https_script_origins:joint,...rest}=v;
 if(!baseSafe(rest)||!safeJoint(joint)||joint.coverage!==rest.body_token_coverage)return null;
 return JSON.parse(JSON.stringify(v));
}
// Private fd 3 is bounded RAM-only transport, never stdout, stderr, a file or a public record.
export function projectCapture(wrapper,privateBytes){
 if(!exact(wrapper,['base_scan','origin_capture'])||!baseSafe(wrapper.base_scan)||!Buffer.isBuffer(privateBytes)||privateBytes.length>32768)return null;
 const m=wrapper.origin_capture;
 if(!exact(m,['sent_count','sent_bytes','byte_limited','message_limited','dropped','dropped_saturated','unresolved','unresolved_saturated','excluded','excluded_saturated','unclassifiable_attributes','unclassifiable_saturated'])||!integer(m.sent_count,256)||!integer(m.sent_bytes,32768)||m.sent_bytes!==privateBytes.length||!integer(m.dropped,1024)||!integer(m.unclassifiable_attributes,1024)||!bins(m.unresolved,POSITIONS)||!bins(m.excluded,EXCLUDED)||['byte_limited','message_limited','dropped_saturated','unresolved_saturated','excluded_saturated','unclassifiable_saturated'].some(k=>typeof m[k]!=='boolean')||m.dropped>0&&!m.byte_limited&&!m.message_limited)return null;
 try{
  const text=new TextDecoder('utf-8',{fatal:true}).decode(privateBytes);
  if(text!==''&&!text.endsWith('\n'))return null;
  const lines=text===''?[]:text.slice(0,-1).split('\n');if(lines.length!==m.sent_count)return null;
  const result=template();result.coverage=wrapper.base_scan.body_token_coverage;result.input_limited=m.byte_limited||m.message_limited;result.unretained_absolute_https=m.dropped;result.excluded={...m.excluded};result.unclassifiable_attributes=m.unclassifiable_attributes;result.counts_saturated=m.dropped_saturated||m.unresolved_saturated||m.excluded_saturated||m.unclassifiable_saturated;
  const rows=new Map();
  function add(position,origin,count=1){
   position=result.coverage==='COMPLETE_STATIC_LEXICAL_NOT_BROWSER_DOM'?position:'UNKNOWN_OR_AMBIGUOUS';
   if(result.observed_absolute_https+count>1024)result.counts_saturated=true;
   result.observed_absolute_https=Math.min(1024,result.observed_absolute_https+count);
   const row={position,...origin,count},k=key(row),prior=rows.get(k);
   if(prior){if(prior.count+count>1024)result.counts_saturated=true;prior.count=Math.min(1024,prior.count+count);}
   else if(rows.size<64)rows.set(k,row);else result.rows_limited=true;
  }
  for(let seq=0;seq<lines.length;seq++){
   const v=JSON.parse(lines[seq]);if(!exact(v,['seq','position','value'])||v.seq!==seq||!POSITIONS.includes(v.position)||typeof v.value!=='string'||v.value.length>8192||!/^https:\/\//i.test(v.value)||/[\x00-\x20\x7f\\]/.test(v.value))return null;
   add(v.position,classifyOrigin(v.value));
  }
  for(const p of POSITIONS)if(m.unresolved[p])add(p,UNKNOWN_ORIGIN,m.unresolved[p]);
  result.rows=[...rows.values()];return safeScan({...wrapper.base_scan,absolute_https_script_origins:result});
 }catch{return null;}
}
export function parse(html,link){
 const p=spawnSync('python3',[new URL('./parser.py',import.meta.url).pathname],{input:JSON.stringify({html,link}),stdio:['pipe','pipe','pipe','pipe'],timeout:2000,maxBuffer:65536,env:{PATH:process.env.PATH,LANG:'C.UTF-8',PYTHONDONTWRITEBYTECODE:'1'}});
 const bytes=p.output?.[3];try{if(p.status!==0||p.signal||p.error||p.stderr?.length||!Buffer.isBuffer(p.stdout))return null;return projectCapture(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(p.stdout)),bytes);}catch{return null;}finally{if(Buffer.isBuffer(bytes))bytes.fill(0);}
}
