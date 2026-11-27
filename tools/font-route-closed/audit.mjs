// Observation only. Actual Slot44 server, response, close and abort remain unchanged.
import http from 'node:http';
import {DOCUMENT,FONT_A,FONT_B,ORIGIN} from '../font-http-closed/config.mjs';
const route=x=>x===DOCUMENT?'DOCUMENT':x===FONT_A?'FONT_A':x===FONT_B?'FONT_B':'OTHER_OR_UNKNOWN';
export function classify(q,{mode,enabled,before}){
 const raw=typeof q.url==='string'?q.url:null,host=q.headers?.host,originForm=raw?.startsWith('/')===true;
 const target=originForm&&host==='127.0.0.1:47500'?ORIGIN+raw:raw,targetLabel=route(target),intended=route(originForm?ORIGIN+raw:raw);
 const label=targetLabel==='FONT_B'&&mode!=='DISTINCT'?'OTHER_OR_UNKNOWN':targetLabel;
 const credential=Object.keys(q.headers||{}).some(k=>/^(cookie|authorization|proxy-authorization|x-api-key|x-goog-api-key)$/i.test(k)),overflow=before.overflow===true||before.receipts>=64;
 const reason=!enabled?'DISABLED':overflow?'COUNTER_OVERFLOW':q.method!=='GET'?'METHOD_NOT_GET':host!=='127.0.0.1:47500'?'HOST_NOT_EXACT':credential?'CREDENTIAL_PRESENT':label==='OTHER_OR_UNKNOWN'?'ROUTE_NOT_SELECTED':'ALLOW';
 return {kind:'FIXED_PROXY_DECISION_V1',target:targetLabel,intended_fixed_route:intended,form:originForm?'ORIGIN_FORM':[DOCUMENT,FONT_A,FONT_B].includes(raw)?'EXACT_ABSOLUTE_FORM':'OTHER_OR_UNKNOWN',host:host==='127.0.0.1:47500'?'EXACT':typeof host==='string'?'OTHER':'MISSING_OR_INVALID',method:q.method==='GET'?'GET':q.method==='POST'?'POST':'OTHER',credential,enabled,overflow,first_reason:reason,attribution:'NOT_ESTABLISHED'};
}
const map=new WeakMap();let busy=false;
export const auditOf=p=>map.get(p)??null;
export async function observedFactory(factory,mode){
 if(busy||typeof factory!=='function')throw Error('AUDIT_FACTORY');busy=true;
 const create=http.createServer,servers=[];http.createServer=function(...args){const s=Reflect.apply(create,this,args);servers.push(s);return s;};
 let p;try{p=await factory();}finally{http.createServer=create;busy=false;}
 const before=p?.snapshot?.();if(servers.length!==1||before?.forwarding!=='ABSENT'||before.upstream_connections!==0||typeof p?.disable!=='function'||typeof p?.close!=='function'){try{await p?.close?.();}catch{}throw Error('AUDIT_FACTORY');}
 const rows=[];let enabled=true,overflow=false,omitted=0,failures=0;const server=servers[0];
 const listener=(q,r)=>{try{if(rows.length>=64){overflow=true;omitted=Math.min(64,omitted+1);return;}const row={sequence:rows.length+1,decision:classify(q,{mode,enabled,before:p.snapshot()}),response:'PENDING'};rows.push(row);r.once('finish',()=>{row.response=r.statusCode===200?'HTTP_200':r.statusCode===403?'HTTP_403':'OTHER_STATUS';});r.once('close',()=>{if(row.response==='PENDING')row.response='CLOSED_BEFORE_FINISH';});}catch{failures=Math.min(64,failures+1);}};
 server.prependListener('request',listener);
 const disable=p.disable,close=p.close;p.disable=function(...a){enabled=false;return Reflect.apply(disable,this,a);};p.close=function(...a){enabled=false;return Reflect.apply(close,this,a);};
 const a={snapshot:()=>({kind:'FIXED_PROXY_AUDIT_V1',rows:structuredClone(rows),overflow,omitted,observer_failures:failures,coverage:!overflow&&!omitted&&!failures&&rows.every(r=>r.response===(r.decision.first_reason==='ALLOW'?'HTTP_200':'HTTP_403'))?'COMPLETE_HTTP_RECEIVE_WINDOW':'INCOMPLETE_OR_UNKNOWN'})};map.set(p,a);return p;
}
export function safeAudit(v){try{
 if(!v||v.kind!=='FIXED_PROXY_AUDIT_V1'||!Array.isArray(v.rows)||v.rows.length>64||typeof v.overflow!=='boolean'||!Number.isInteger(v.omitted)||v.omitted<0||v.omitted>64||!Number.isInteger(v.observer_failures)||v.observer_failures<0||v.observer_failures>64||!['COMPLETE_HTTP_RECEIVE_WINDOW','INCOMPLETE_OR_UNKNOWN'].includes(v.coverage))return null;
 const rows=v.rows.map((r,i)=>{const d=r.decision;if(r.sequence!==i+1||!['PENDING','HTTP_200','HTTP_403','OTHER_STATUS','CLOSED_BEFORE_FINISH'].includes(r.response)||d.kind!=='FIXED_PROXY_DECISION_V1'||!['DOCUMENT','FONT_A','FONT_B','OTHER_OR_UNKNOWN'].includes(d.target)||!['DOCUMENT','FONT_A','FONT_B','OTHER_OR_UNKNOWN'].includes(d.intended_fixed_route)||!['ORIGIN_FORM','EXACT_ABSOLUTE_FORM','OTHER_OR_UNKNOWN'].includes(d.form)||!['EXACT','OTHER','MISSING_OR_INVALID'].includes(d.host)||!['GET','POST','OTHER'].includes(d.method)||![d.credential,d.enabled,d.overflow].every(x=>typeof x==='boolean')||!['ALLOW','DISABLED','COUNTER_OVERFLOW','METHOD_NOT_GET','HOST_NOT_EXACT','CREDENTIAL_PRESENT','ROUTE_NOT_SELECTED'].includes(d.first_reason)||d.attribution!=='NOT_ESTABLISHED')throw Error('AUDIT_SCHEMA');
  return {sequence:r.sequence,decision:{kind:d.kind,target:d.target,intended_fixed_route:d.intended_fixed_route,form:d.form,host:d.host,method:d.method,credential:d.credential,enabled:d.enabled,overflow:d.overflow,first_reason:d.first_reason,attribution:d.attribution},response:r.response};});
 const coverage=!v.overflow&&!v.omitted&&!v.observer_failures&&rows.every(r=>r.response===(r.decision.first_reason==='ALLOW'?'HTTP_200':'HTTP_403'))?'COMPLETE_HTTP_RECEIVE_WINDOW':'INCOMPLETE_OR_UNKNOWN';if(v.coverage!==coverage)return null;
 const o={kind:v.kind,rows,overflow:v.overflow,omitted:v.omitted,observer_failures:v.observer_failures,coverage:v.coverage};return JSON.stringify(o)===JSON.stringify(v)?o:null;
 }catch{return null;}}
