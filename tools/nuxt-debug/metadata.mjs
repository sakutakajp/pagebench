import {allowed} from '../lighthouse-once/guard.mjs';
import {classifyNetworkFailure} from '../cdp-startup-diagnostic/network-failure.mjs';
const categories=['CANCELED','CORS','BLOCKED','TLS','CONNECTION','DNS','TIMEOUT','OTHER','PROXY'];
const id=v=>typeof v==='string'&&v.length>0&&v.length<=256;
const prefetch=r=>Object.entries(r?.headers||{}).some(([k,v])=>['sec-purpose','purpose'].includes(k.toLowerCase())&&/prefetch/i.test(v));
function required(r,type){return r?.method==='GET'&&['Fetch','XHR'].includes(type)&&allowed(r,type)&&!prefetch(r);}
export class MetadataEvidence{
 constructor(g){this.g=g;this.loader=null;this.slot=null;this.starts=new Map();this.ambiguous=false;this.phase='MEASURING';this.cleanup_before=null;this.late=0;this.unknown=false;}
 notify(){this.g.stopEvidence?.publish();}
 bind(s,e){if(prefetch(e.request)){this.starts.delete(e.networkId);return;}if(this.phase!=='MEASURING'||s!==this.g.primary||e.frameId!==this.g.sessions.get(s)?.frame||!required(e.request,e.resourceType))return;
  if(!id(e.networkId)||!this.loader){this.unknown=true;this.notify();return;}
  if(this.slot&&this.slot.id!==e.networkId){this.ambiguous=true;this.notify();return;}
  this.slot??={id:e.networkId,url:e.request.url,started:false,headers:false,eof:false,failed:false,status:null,mime:'UNKNOWN',failure:[]};
  const start=this.starts.get(e.networkId);if(start?.url===e.request.url&&start.loader===this.loader)this.slot.started=true;
  this.notify();
 }
 observe(m){if(m.sessionId!==this.g.primary)return;const p=m.params||{},frame=this.g.sessions.get(this.g.primary)?.frame;
  if(m.method==='Page.frameNavigated'&&p.frame?.id===frame&&!p.frame.parentId&&p.frame.url===this.g.documentURL){if(this.loader&&this.loader!==p.frame.loaderId)this.unknown=true;else if(id(p.frame.loaderId))this.loader=p.frame.loaderId;return;}
  if(!m.method?.startsWith('Network.'))return;
  if(this.phase!=='MEASURING'){if(this.slot?.id===p.requestId){this.late=Math.min(65535,this.late+1);this.notify();}return;}
  if(m.method==='Network.requestWillBeSent'&&p.frameId===frame&&required(p.request,p.type)){
   if(p.loaderId!==this.loader||!id(p.requestId)){this.unknown=true;this.notify();return;}
   if(!this.starts.has(p.requestId)&&this.starts.size>=2)this.starts.delete(this.starts.keys().next().value);this.starts.set(p.requestId,{url:p.request.url,loader:p.loaderId});
   if(this.slot?.id===p.requestId){if(this.slot.url!==p.request.url||p.redirectResponse)this.ambiguous=true;else this.slot.started=true;this.notify();}
  }
  const e=this.slot;if(!e||p.requestId!==e.id)return;
  if(m.method==='Network.responseReceived'){if(!e.started||e.headers||p.response?.url!==e.url)this.ambiguous=true;e.headers=true;e.status=Number.isInteger(p.response?.status)&&p.response.status>=100&&p.response.status<=599?p.response.status:null;e.mime=p.response?.mimeType==='application/json'?'JSON':'OTHER';this.notify();}
  if(m.method==='Network.loadingFinished'){if(!e.started||!e.headers||e.eof||e.failed)this.ambiguous=true;e.eof=true;this.notify();}
  if(m.method==='Network.loadingFailed'){e.failed=true;e.failure=classifyNetworkFailure(p).categories.filter(c=>categories.includes(c)).slice(0,4);this.notify();}
 }
 stop(){this.phase='STOPPED';}
 beginCleanup(){this.cleanup_before=this.current();this.phase='CLEANUP';}
 current(){const e=this.slot;return{scope:this.ambiguous?'AMBIGUOUS':this.unknown?'UNKNOWN':e?'BOUND_SAME_SESSION_FRAME_LOADER':'NOT_OBSERVED',started:e?.started===true,headers:e?.headers===true,network_eof:e?.eof===true,network_failed:e?.failed===true,status:e?.status??null,mime:e?.mime||'UNKNOWN',failure_categories:e?[...e.failure]:[],js_body_read:'NOT_OBSERVED'};}
 snapshot(){return{...this.current(),phase:this.phase,before_cleanup:this.cleanup_before?{...this.cleanup_before}:null,after_stop_or_cleanup_events:this.late};}
}
export function safeMetadata(v){if(!v)return null;const project=x=>{if(!x||!['AMBIGUOUS','UNKNOWN','BOUND_SAME_SESSION_FRAME_LOADER','NOT_OBSERVED'].includes(x.scope)||['started','headers','network_eof','network_failed'].some(k=>typeof x[k]!=='boolean')||x.status!==null&&(!Number.isInteger(x.status)||x.status<100||x.status>599)||!['UNKNOWN','JSON','OTHER'].includes(x.mime)||!Array.isArray(x.failure_categories)||x.failure_categories.length>4||x.failure_categories.some(c=>!categories.includes(c))||x.js_body_read!=='NOT_OBSERVED')return null;return{scope:x.scope,started:x.started,headers:x.headers,network_eof:x.network_eof,network_failed:x.network_failed,status:x.status,mime:x.mime,failure_categories:[...x.failure_categories],js_body_read:'NOT_OBSERVED'};};
 const p=project(v);if(!p||!['MEASURING','STOPPED','CLEANUP'].includes(v.phase)||!Number.isInteger(v.after_stop_or_cleanup_events)||v.after_stop_or_cleanup_events<0||v.after_stop_or_cleanup_events>65535)return null;const b=v.before_cleanup===null?null:project(v.before_cleanup);if(v.before_cleanup!==null&&!b)return null;return{...p,phase:v.phase,before_cleanup:b,after_stop_or_cleanup_events:v.after_stop_or_cleanup_events};}
