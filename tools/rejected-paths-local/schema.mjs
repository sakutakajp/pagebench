// Private diagnostic projection only. Never retains a URL, host, query or header.
import{isProxy}from'node:util/types';
export const LIMITS=Object.freeze({url:8192,path:256,rows:1024,signals:32,counter:65535,plain:1048576,envelope:1572864});
export const REASONS=Object.freeze(['URL','REDIRECT','ORIGIN','METHOD','CREDENTIAL','SCOPE','NAVIGATION','LIMIT','BINDING','SESSION_BINDING','ABORT_WITHOUT_POLICY_REASON','AB_BOUNDARY_BINDING','AB_BOUNDARY_REDIRECT','AB_BOUNDARY_RESPONSE','AB_BOUNDARY_NETWORK','AUTH_REJECTED','RESPONSE_ERROR','HTML_HTTP','CDP_LOST','CDP_FORMAT','GUARD_FAILURE','TARGET_REJECTED','PROTECTION_LOST','OTHER_OR_UNKNOWN']);
export const RESOURCES=Object.freeze(['Document','Stylesheet','Image','Media','Font','Script','TextTrack','XHR','Fetch','Prefetch','Other','Manifest','WebSocket','EventSource','Ping','Preflight','CSPViolationReport','SignedExchange','UNKNOWN']);
export const METHODS=Object.freeze(['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS','CONNECT','TRACE','UNKNOWN']);
export const SOURCES=Object.freeze(['POLICY_DECISION','ABORT_COMMAND','PASSIVE_STOP']);
export const DETAILS=Object.freeze(['NONE','SCOPE_UNCONFIRMED','EVENT_UNAVAILABLE','NO_URL','URL_TOO_LONG','URL_INVALID','UNSUPPORTED_SCHEME','PATH_TOO_LONG','PATH_ENCODING','PATH_STRUCTURE','SENSITIVE_SEGMENT']);
const descriptor=Object.getOwnPropertyDescriptor;
export function own(v,k){try{if(!v||typeof v!=='object'||isProxy(v))return undefined;const d=descriptor(v,k);return d&&Object.hasOwn(d,'value')?d.value:undefined;}catch{return undefined;}}
export const fixed=(v,list,fallback)=>typeof v==='string'&&list.includes(v)?v:fallback;
const absent=(state,detail)=>({path:null,state,detail});
export function privatePath(path){
 if(typeof path!=='string'||!path.startsWith('/')||path.startsWith('//'))return absent('REDACTED','PATH_STRUCTURE');
 if(path.length>LIMITS.path||Buffer.byteLength(path)>LIMITS.path)return absent('REDACTED','PATH_TOO_LONG');
 if(/[?#\\\u0000-\u0020\u007f]/.test(path))return absent('REDACTED','PATH_STRUCTURE');
 for(const encoded of path.split('/')){let s;try{s=decodeURIComponent(encoded).normalize('NFKC');}catch{return absent('REDACTED','PATH_ENCODING');}
  if(/[%/\\?#@=:;\u0000-\u0020\u007f]/.test(s))return absent('REDACTED','PATH_ENCODING');
  if(s.length>64||/(?:token|secret|password|passwd|bearer|session|credential|api[-_]?key|access[-_]?key)/i.test(s)||/^(?:auth|oauth|login|logout|user|users|account|accounts|email|key|keys)$/i.test(s)||/[a-f0-9]{16,}|\d{7,}|[a-z0-9_-]{24,}/i.test(s)||/^eyJ[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}$/i.test(s)||/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(s))return absent('REDACTED','SENSITIVE_SEGMENT');
 }
 return{path,state:'CAPTURED',detail:'NONE'};
}
export function project(e,bound){
 if(!e)return absent('UNAVAILABLE','EVENT_UNAVAILABLE');
 if(!bound)return absent('UNAVAILABLE','SCOPE_UNCONFIRMED');
 const r=own(e,'request'),url=own(r,'url');if(typeof url!=='string')return absent('UNAVAILABLE','NO_URL');
 if(url.length>LIMITS.url)return absent('UNAVAILABLE','URL_TOO_LONG');let u;try{u=new URL(url);}catch{return absent('UNAVAILABLE','URL_INVALID');}
 if(!['https:','http:'].includes(u.protocol))return absent('UNAVAILABLE','UNSUPPORTED_SCHEME');
 return privatePath(u.pathname);
}
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v)&&!isProxy(v)&&Object.getPrototypeOf(v)===Object.prototype;
const keys=(v,k)=>plain(v)&&Object.keys(v).sort().join(',')===k.toSorted().join(',')&&k.every(q=>{const d=descriptor(v,q);return d&&Object.hasOwn(d,'value');});
const array=(v,max)=>Array.isArray(v)&&!isProxy(v)&&v.length<=max&&Object.keys(v).length===v.length&&Array.from({length:v.length},(_,i)=>{const d=descriptor(v,String(i));return !!d&&Object.hasOwn(d,'value');}).every(Boolean);
export const counter=v=>keys(v,['value','saturated'])&&Number.isInteger(v.value)&&v.value>=0&&v.value<=LIMITS.counter&&typeof v.saturated==='boolean'&&(!v.saturated||v.value===LIMITS.counter);
export function safePayload(p){try{
 if(!keys(p,['kind','version','coverage','snapshot_boundary','observed','omitted','capacity_omitted','losses','unassociated_stops','signals_omitted','unknown_metadata','rows','signals'])||p.kind!=='PRIVATE_REJECTED_PATHS'||p.version!==2||p.coverage!=='ACTUAL_REJECT_CALLBACKS_ONLY_UNASSESSED_EXCLUDED'||p.snapshot_boundary!=='FIRST_PRIVATE_SEAL'||!counter(p.observed)||!counter(p.omitted)||!counter(p.capacity_omitted)||!counter(p.losses)||!counter(p.unassociated_stops)||!counter(p.signals_omitted)||!counter(p.unknown_metadata)||!array(p.rows,LIMITS.rows)||!array(p.signals,LIMITS.signals))return null;
 if(p.capacity_omitted.value>p.omitted.value||p.capacity_omitted.saturated&&!p.omitted.saturated)return null;
 for(const c of[p.omitted,p.capacity_omitted,p.unknown_metadata])if(c.value>p.observed.value||c.saturated&&!p.observed.saturated)return null;
 const seen=new Set();for(const r of p.rows){if(!keys(r,['path','state','detail','reason','resource','method','source','phase','count'])||!['CAPTURED','REDACTED','UNAVAILABLE'].includes(r.state)||!DETAILS.includes(r.detail)||!REASONS.includes(r.reason)||!RESOURCES.includes(r.resource)||!METHODS.includes(r.method)||!SOURCES.includes(r.source)||!['BEFORE_STOP','AFTER_STOP'].includes(r.phase)||!counter(r.count)||r.count.value<1)return null;
  if(r.state==='CAPTURED'){const v=privatePath(r.path);if(v.state!=='CAPTURED'||v.path!==r.path||r.detail!=='NONE')return null;}else if(r.path!==null||r.detail==='NONE')return null;
  const k=JSON.stringify([r.path,r.state,r.detail,r.reason,r.resource,r.method,r.source,r.phase]);if(seen.has(k))return null;seen.add(k);
 }
 const signals=new Set();for(const s of p.signals){if(!keys(s,['reason','source','count'])||!REASONS.includes(s.reason)||!['ABORT_COMMAND','GUARD_SIGNAL'].includes(s.source)||!counter(s.count)||s.count.value<1)return null;const k=s.reason+'|'+s.source;if(signals.has(k))return null;signals.add(k);}
 if(!p.observed.saturated&&p.rows.some(r=>r.count.saturated))return null;
 if(!p.unassociated_stops.saturated&&p.signals.some(s=>s.count.saturated))return null;
 if(!p.observed.saturated&&!p.omitted.saturated&&!p.rows.some(r=>r.count.saturated)&&p.rows.reduce((n,r)=>n+r.count.value,0)+p.omitted.value!==p.observed.value)return null;
 if(!p.unassociated_stops.saturated&&!p.signals_omitted.saturated&&!p.signals.some(s=>s.count.saturated)&&p.signals.reduce((n,s)=>n+s.count.value,0)+p.signals_omitted.value!==p.unassociated_stops.value)return null;
 return JSON.parse(JSON.stringify(p));
 }catch{return null;}}

// This proves a serialization envelope, not a global count of rejected events.
export function capacityProof(){
 const longest=a=>a.reduce((x,y)=>JSON.stringify(x).length>JSON.stringify(y).length?x:y);
 const row={path:'/'+String.fromCharCode(34).repeat(LIMITS.path-1),state:'UNAVAILABLE',detail:longest(DETAILS),reason:longest(REASONS),resource:longest(RESOURCES),method:longest(METHODS),source:longest(SOURCES),phase:'BEFORE_STOP',count:{value:LIMITS.counter,saturated:false}};
 const signal={reason:longest(REASONS),source:'ABORT_COMMAND',count:{value:LIMITS.counter,saturated:false}};
 const rowBytes=Buffer.byteLength(JSON.stringify(row)),signalBytes=Buffer.byteLength(JSON.stringify(signal));
 // Fixed fields plus seven counters are substantially smaller than 4096 bytes.
 const upper=4096+LIMITS.rows*(rowBytes+1)+LIMITS.signals*(signalBytes+1);
 const envelopeUpper=4096+4*Math.ceil(LIMITS.plain/3)+512+16+24;
 return Object.freeze({rows:LIMITS.rows,path_bytes:LIMITS.path,row_serialization_upper:rowBytes,signal_serialization_upper:signalBytes,plaintext_serialization_upper:upper,padded_plaintext_bytes:LIMITS.plain,ciphertext_envelope_upper:envelopeUpper,max_ciphertext_envelope_bytes:LIMITS.envelope,fits:upper+4<=LIMITS.plain&&envelopeUpper<=LIMITS.envelope,global_rejected_event_bound:'NOT_PROVEN',basis:'BOUNDED_STORAGE_NOT_400_REQUEST_BOUND'});
}
