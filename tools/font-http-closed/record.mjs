import {readFileSync,writeFileSync,renameSync,lstatSync} from 'node:fs';
import {MODES,PUBLIC,REF} from './config.mjs';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),num=x=>Number.isInteger(x)&&x>=0&&x<=64;
export const reasons=['NONE','SCOPE','STAGE_OR_REDIRECT','METHOD_OR_CREDENTIAL','FIXED_ROUTE','LOCAL_EVENT_LIMIT','IDENTITY','NAVIGATION','DUPLICATE_FONT_ID','OBSERVER_UNKNOWN','LOCAL_INFLIGHT_LIMIT','UNKNOWN'];
export const phases=['NOT_STARTED','OPEN','NAVIGATION','FONTS','READBACK','CLEANUP','COMPLETE','UNKNOWN'];
export const duplicates=['NONE_OBSERVED','SAME_FETCH_HANDLE_REDELIVERY','SAME_NETWORK_NEW_FETCH_BEFORE_RESPONSE','DUPLICATE_OTHER_OR_UNKNOWN'];
export const bindings=['UNKNOWN','PRIMARY_FRAME_REQUEST_METADATA_MATCH','UNKNOWN_OR_CONFLICT'];
export const startupPhases=['NOT_APPLICABLE','BINARY','AUTHLESS_PROFILE','PROXY_SETUP','CHROME_START','CHROME_SANDBOX_FAILED','CDP_CONNECT','ROOT_GUARD','PUPPETEER_CONNECT','BOUND_PAGE','UNKNOWN'];
export function empty(s=null){return {kind:'FONT_HTTP_CLOSED_FIXED_V1',scope:s,admission:'NOT_STARTED',status:'FAILED_OR_UNKNOWN',chrome:null,cases:MODES.map(mode=>({mode,status:'NOT_RUN',phase:'NOT_STARTED',failure_phase:'NONE',startup:'NOT_APPLICABLE',reason:'NONE',render:'UNKNOWN',http:null,events:null,abort_ack:0,continued:0,documents:0,cleanup:'NOT_RUN'})),network:null,comparison:'UNKNOWN_NOT_COMPLETED',historical_slot43:'NOT_IDENTIFIED',site_requests:0,score_saved:false,report_saved:false};}
export function safe(v){
 try{
 const s=v.scope;if(s!==null&&(!s||Object.keys(s).sort().join(',')!=='attempt,ref,run,sha'||s.ref!==REF||s.attempt!==1||!/^[a-f0-9]{40}$/.test(s.sha)||!/^[1-9][0-9]{0,23}$/.test(s.run)))return null;
 const o=empty(s?{sha:s.sha,run:s.run,ref:s.ref,attempt:1}:null);
 if(!['NOT_STARTED','SCOPE','EVENT','SOURCE','UNITS','CONSUME','ADMITTED','UNKNOWN'].includes(v.admission)||!['PASSED','FAILED_OR_UNKNOWN'].includes(v.status)||v.chrome!==null&&!/^(Chrome|HeadlessChrome)\/[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/.test(v.chrome))return null;
 o.admission=v.admission;o.status=v.status;o.chrome=v.chrome;
 if(!Array.isArray(v.cases)||v.cases.length!==3)return null;
 for(let i=0;i<3;i++){
  const c=v.cases[i];if(c.mode!==MODES[i]||!['NOT_RUN','STARTED','PASSED','FAILED'].includes(c.status)||!phases.includes(c.phase)||!['NONE',...phases].includes(c.failure_phase)||!startupPhases.includes(c.startup)||!reasons.includes(c.reason)||!['UNKNOWN','LOADED_EXPECTED_FACES_AND_DOM'].includes(c.render)||!['NOT_RUN','COMPLETE','FAILED','UNKNOWN'].includes(c.cleanup)||![c.abort_ack,c.continued,c.documents].every(num))return null;
  let h=null,e=null;
  if(c.http!==null){const r=c.http;if(!['receipts','documents','font_a','font_b','denied','connect_denied','upgrade_denied','socket_errors','client_errors','open_sockets','upstream_connections'].every(k=>num(r[k]))||typeof r.closed!=='boolean'||typeof r.overflow!=='boolean'||r.forwarding!=='ABSENT'||r.upstream_connections!==0)return null;h=Object.fromEntries(['receipts','documents','font_a','font_b','denied','connect_denied','upgrade_denied','socket_errors','client_errors','overflow','closed','open_sockets','upstream_connections','forwarding'].map(k=>[k,r[k]]));}
  if(c.events!==null){const r=c.events;if(!['network_font_starts','font_pauses','logical_font_ids','late_after_stop'].every(k=>num(r[k]))||!duplicates.includes(r.duplicate)||!bindings.includes(r.binding)||!['NOT_SENT','SENT_PENDING_ACK','ACKED','ACK_ERROR','UNKNOWN'].includes(r.first_continue)||!['NOT_OBSERVED','BEFORE_SEND','PENDING_ACK','AFTER_ACK','UNKNOWN'].includes(r.second_pause_vs_continue)||!['NONE_OBSERVED','NETWORK_REDIRECT','FETCH_INDICATOR','BOTH'].includes(r.redirect)||!['COMPLETE_BOUNDED_WINDOW','UNKNOWN_OR_INCOMPLETE'].includes(r.coverage)||typeof r.overflow!=='boolean'||r.historical_identity!=='NOT_ESTABLISHED')return null;e=Object.fromEntries(['network_font_starts','font_pauses','logical_font_ids','duplicate','binding','first_continue','second_pause_vs_continue','redirect','coverage','overflow','late_after_stop','historical_identity'].map(k=>[k,r[k]]));}
  o.cases[i]={mode:c.mode,status:c.status,phase:c.phase,failure_phase:c.failure_phase,startup:c.startup,reason:c.reason,render:c.render,http:h,events:e,abort_ack:c.abort_ack,continued:c.continued,documents:c.documents,cleanup:c.cleanup};
 }
 if(v.network!==null){const n=v.network;if(n.installed!==true||!['loopback_connects','blocked_connects','dns_attempts'].every(k=>Number.isInteger(n[k])&&n[k]>=0&&n[k]<=65535))return null;o.network={installed:true,loopback_connects:n.loopback_connects,blocked_connects:n.blocked_connects,dns_attempts:n.dns_attempts};}
 if(!['UNKNOWN_NOT_COMPLETED','NOT_REPRODUCED_IN_THIS_CLOSED_CONTROL','OBSERVED_IN_THIS_CLOSED_CONTROL_ONLY'].includes(v.comparison))return null;o.comparison=v.comparison;
 if(o.status==='PASSED'&&(o.admission!=='ADMITTED'||!s||!o.chrome||!o.network||o.network.blocked_connects||o.network.dns_attempts||o.comparison!=='NOT_REPRODUCED_IN_THIS_CLOSED_CONTROL'||o.cases.some(c=>c.status!=='PASSED'||c.phase!=='COMPLETE'||c.failure_phase!=='NONE'||c.reason!=='NONE'||c.render!=='LOADED_EXPECTED_FACES_AND_DOM'||c.cleanup!=='COMPLETE'||c.documents!==1||c.abort_ack!==0||!c.http||!c.events||!c.http.closed||c.http.open_sockets||c.http.denied||c.http.socket_errors||c.http.client_errors||c.http.overflow||c.http.documents!==1||c.http.font_a<1||(c.mode==='DISTINCT'?c.http.font_b<1:c.http.font_b!==0)||c.events.overflow||c.events.duplicate!=='NONE_OBSERVED')))return null;
 // Exact reconstruction: reject extra/untrusted fields instead of dumping input.
 if(o.status==='PASSED'&&o.cases.some(c=>c.events.coverage!=='COMPLETE_BOUNDED_WINDOW'))return null;
 return same(o,v)?o:null;
 }catch{return null;}
}
export function save(v,path=PUBLIC){const o=safe(v);if(!o)throw Error('FIXED_SCHEMA');const t=JSON.stringify(o),temp=path+'.tmp';writeFileSync(temp,t,{mode:0o600,flag:'wx'});renameSync(temp,path);if(readFileSync(path,'utf8')!==t)throw Error('FIXED_READBACK');}
export function read(path=PUBLIC){try{const s=lstatSync(path);if(!s.isFile()||s.isSymbolicLink()||s.size>32768)return null;return safe(JSON.parse(readFileSync(path,'utf8')));}catch{return null;}}
