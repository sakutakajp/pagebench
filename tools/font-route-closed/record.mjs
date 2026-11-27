import {readFileSync,writeFileSync,renameSync,lstatSync} from 'node:fs';
import {empty as oldEmpty,safe as oldSafe} from '../font-http-closed/record.mjs';import {REF as OLD_REF} from '../font-http-closed/config.mjs';
import {scope,PUBLIC,REF} from './config.mjs';import {safeAudit} from './audit.mjs';import {emptyControl} from './control.mjs';
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function identity(s){return s&&Object.keys(s).sort().join(',')==='attempt,ref,run,sha'&&s.ref===REF&&s.attempt===1&&/^[a-f0-9]{40}$/.test(s.sha)&&/^[1-9][0-9]{0,23}$/.test(s.run);}
// Only pure validator identity is adapted; original runtime and acceptance clauses
// are imported unchanged. No old admission/monitor is executed or relabeled.
export function nativeSafe(v,s){try{if(!v||!equal(v.scope,s))return null;const mapped={...v,scope:s?{...s,ref:OLD_REF}:null},checked=oldSafe(mapped);return checked?{...checked,scope:s}:null;}catch{return null;}}
function transportSafe(t){if(t===null)return null;const v=oldEmpty();v.cases[0].http=t;return oldSafe(v)?.cases[0].http??null;}
export function controlSafe(v){try{
 const o=emptyControl();if(!v||v.kind!==o.kind||v.actor!==o.actor||!['NOT_RUN','FAILED','PASSED'].includes(v.status)||!['UNKNOWN','PINNED_FONT_BYTES_MIME_VERIFIED'].includes(v.font_delivery)||!['UNKNOWN','DENIED_OTHER_UNATTRIBUTED'].includes(v.other_request)||!['UNKNOWN','DENIED_FIXED_FONT_HOST'].includes(v.fixed_font_rejection)||!['UNKNOWN','DENIED'].includes(v.connect_rejection)||!['NOT_RUN','UNKNOWN','FAILED','COMPLETE'].includes(v.cleanup))return null;
 o.status=v.status;o.font_delivery=v.font_delivery;o.other_request=v.other_request;o.fixed_font_rejection=v.fixed_font_rejection;o.connect_rejection=v.connect_rejection;o.audit=v.audit===null?null:safeAudit(v.audit);o.transport=transportSafe(v.transport);o.cleanup=v.cleanup;
 if(v.audit!==null&&!o.audit||v.transport!==null&&!o.transport)return null;
 if(o.status==='PASSED'&&(o.cleanup!=='COMPLETE'||o.font_delivery!=='PINNED_FONT_BYTES_MIME_VERIFIED'||o.other_request!=='DENIED_OTHER_UNATTRIBUTED'||o.fixed_font_rejection!=='DENIED_FIXED_FONT_HOST'||o.connect_rejection!=='DENIED'||o.audit?.coverage!=='COMPLETE_HTTP_RECEIVE_WINDOW'||o.transport?.closed!==true||o.transport.open_sockets||o.transport.socket_errors||o.transport.client_errors||o.transport.overflow||o.transport.documents!==1||o.transport.font_a!==2||o.transport.font_b!==0||o.transport.denied!==2||o.transport.connect_denied!==1))return null;
 return equal(o,v)?o:null;
 }catch{return null;}}
export function empty(s=null){return {kind:'FONT_ROUTE_CLOSED_FIXED_V1',scope:s,admission:'NOT_STARTED',status:'FAILED_OR_UNKNOWN',node:emptyControl(),native:oldEmpty(s),audits:['SINGLE','SHARED','DISTINCT'].map(mode=>({mode,state:'NOT_ATTACHED',audit:null})),separation:'NOT_CONFIRMED',network:null,historical_slot44:'NOT_ATTRIBUTED',historical_slot43:'NOT_IDENTIFIED',site_requests:0,score_saved:false,report_saved:false};}
export function safe(v){try{
 if(!v||v.scope!==null&&!identity(v.scope))return null;const o=empty(v.scope);
 if(!['NOT_STARTED','SCOPE','EVENT','SOURCE','UNITS','CONSUME','ADMITTED','UNKNOWN'].includes(v.admission)||!['FAILED_OR_UNKNOWN','PASSED'].includes(v.status)||!['NOT_CONFIRMED','DISTINCT_PORT_AND_INSTANCE_CONFIRMED'].includes(v.separation))return null;o.admission=v.admission;o.status=v.status;o.separation=v.separation;
 o.node=controlSafe(v.node);o.native=nativeSafe(v.native,v.scope);if(!o.node||!o.native||!Array.isArray(v.audits)||v.audits.length!==3)return null;
 for(let i=0;i<3;i++){const a=v.audits[i];if(a.mode!==o.audits[i].mode||!['NOT_ATTACHED','ATTACHED'].includes(a.state)||a.state==='NOT_ATTACHED'&&a.audit!==null)return null;const audit=a.audit===null?null:safeAudit(a.audit);if(a.audit!==null&&!audit)return null;o.audits[i]={mode:a.mode,state:a.state,audit};}
 if(v.network!==null){const n=v.network;if(n.installed!==true||!['loopback_connects','blocked_connects','dns_attempts'].every(k=>Number.isInteger(n[k])&&n[k]>=0&&n[k]<=65535))return null;o.network={installed:true,loopback_connects:n.loopback_connects,blocked_connects:n.blocked_connects,dns_attempts:n.dns_attempts};}
 if(o.status==='PASSED'&&(o.admission!=='ADMITTED'||o.node.status!=='PASSED'||o.native.status!=='PASSED'||o.separation!=='DISTINCT_PORT_AND_INSTANCE_CONFIRMED'||!o.network||o.network.blocked_connects||o.network.dns_attempts||o.audits.some(a=>a.state!=='ATTACHED'||a.audit?.coverage!=='COMPLETE_HTTP_RECEIVE_WINDOW')))return null;
 return equal(o,v)?o:null;
 }catch{return null;}}
export function save(v,path=PUBLIC){const o=safe(v);if(!o)throw Error('FIXED_SCHEMA');const t=JSON.stringify(o),temp=path+'.tmp';writeFileSync(temp,t,{mode:0o600,flag:'wx'});renameSync(temp,path);if(readFileSync(path,'utf8')!==t)throw Error('FIXED_READBACK');}
export function read(path=PUBLIC){try{const s=lstatSync(path);if(!s.isFile()||s.isSymbolicLink()||s.size>131072)return null;return safe(JSON.parse(readFileSync(path,'utf8')));}catch{return null;}}
export function publish({env=process.env,load=read,write=save,print=console.log}={}){let v=empty();try{const s=scope(env),r=load();if(r&&equal(r.scope,s))v=r;}catch{}write(v);print(JSON.stringify(v));return v;}
