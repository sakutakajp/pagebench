// LOCAL CANDIDATE ONLY: not selected by any live entry or workflow.
// A discard is never a network grant. Real Chrome field compatibility / anti-spoof proof is still required.
import {NoReinspectionGateway,requestDecision,isPrefetch} from '../ab-observe/gateway.mjs';
import {TARGET,LIMITS} from '../ab-observe/config.mjs';
const valid=v=>typeof v==='string'&&v.length>0&&v.length<=256;
const credentials=/^(cookie|authorization|proxy-authorization|x-api-key|x-goog-api-key)$/i;
const COUNT_KEYS=['candidates','abort_sent','abort_acked','abort_ack_failed','pending','max_pending','limit_stops','ineligible','binding_invalidations','after_stop_ack','response_anomalies','continue_attempts_blocked'];
const REASONS=['REUSED_NETWORK_BINDING','OWNER_OR_FRAME','MISSING_NETWORK_BINDING','DUPLICATE_BINDING','REQUEST_MISMATCH','DISCARD_LIMIT','OWNER_BEFORE_ABORT','ABORT_ACK_OR_OWNER','ABORT_ACK_FAILED','DISCARD_CONTINUE_ATTEMPT','INCOMPLETE_AT_CLEANUP','ABORT_REPLY_INVALID','ABORT_COMMAND_BINDING'];
function strongMarker(request){
 if(!request||request.method!=='GET'||request.postData||request.hasPostData||request.postDataEntries)return false;
 const entries=Object.entries(request.headers||{});if(entries.length>128||entries.some(([k,v])=>credentials.test(k)||typeof v!=='string'||k.length>256||v.length>1024))return false;
 const sec=entries.filter(([k])=>k.toLowerCase()==='sec-purpose'),legacy=entries.filter(([k])=>k.toLowerCase()==='purpose');
 return sec.length===1&&sec[0][1]==='prefetch'&&legacy.length<=1&&legacy.every(([,v])=>v==='prefetch');
}
function localRequest(request){try{const u=new URL(request.url),p=decodeURIComponent(u.pathname);return u.origin==='https://staging.hirameki.dev'&&!u.username&&!u.password&&!u.hash&&!u.search&&request.url.length<=8192&&!/%|\\|[\x00-\x20]/.test(p)&&!/(^|\/)(api|graphql|collect|analytics|telemetry|tracking|track|beacon|ads|adsense|gtm|ga4|metrics)(\/|[._-]|$)/i.test(p)&&strongMarker(request);}catch{return false;}}
export class BoundPrefetchCandidate extends NoReinspectionGateway{
 constructor(...args){super(...args);this.discardOwner=null;this.discardRows=new Map();this.discardFetchIds=new Set();this.discardAcks=new Map();this.discardClosed=false;this.discardStats={candidates:0,abort_sent:0,abort_acked:0,abort_ack_failed:0,pending:0,max_pending:0,limit_stops:0,ineligible:0,first_ineligible:null,binding_invalidations:0,after_stop_ack:0,response_anomalies:0,continue_attempts_blocked:0,cleanup:'NOT_STARTED'};}
 owner(){const s=this.sessions.get(this.primary);return this.primary&&s?.ready&&!s.internalUI&&!s.auxiliary&&valid(s.frame)&&valid(this.createdPage)&&this.pageInfo?.targetId===this.createdPage?{session:this.primary,frame:s.frame,target:this.createdPage}:null;}
 sameOwner(){const o=this.owner(),p=this.discardOwner;return!!o&&!!p&&!this.stopping&&!this.discardClosed&&o.session===p.session&&o.frame===p.frame&&o.target===p.target;}
 rejectCandidate(reason,e){this.discardStats.ineligible++;this.discardStats.first_ineligible??=reason;if(e)this.stopEvidence.rejected('SCOPE',e);this.fail('AB_BOUNDARY_REJECTED');}
 observeDiscard(m){
  if(this.stopping||this.discardClosed)return;
  const p=m.params||{},o=this.owner();if(!o||m.sessionId!==o.session)return;
  if(m.method==='Page.frameNavigated'&&p.frame?.id===o.frame&&!p.frame.parentId){
   if(!this.discardOwner){if(p.frame.url===TARGET&&valid(p.frame.loaderId))this.discardOwner={...o,loader:p.frame.loaderId};return;}
   if(!this.sameOwner()||p.frame.url!==TARGET||p.frame.loaderId!==this.discardOwner.loader){this.discardStats.binding_invalidations++;this.fail('AB_BOUNDARY_BINDING');}return;
  }
  if(m.method==='Network.requestWillBeSent'){
   if(this.discardRows.has(p.requestId)){this.discardStats.binding_invalidations++;this.fail('AB_BOUNDARY_BINDING');return;}
   const e={resourceType:p.type,request:p.request};
   if(p.type!=='Fetch'||!isPrefetch(e)||requestDecision(e,this.icons)!=='SCOPE')return;
   if(!this.sameOwner()||p.frameId!==this.discardOwner.frame||p.loaderId!==this.discardOwner.loader||p.documentURL!==TARGET||Object.hasOwn(p,'redirectResponse')||!valid(p.requestId)||!localRequest(p.request)||p.initiator?.type!=='parser'||p.initiator.url!==TARGET||Object.hasOwn(p.initiator,'stack')||Object.hasOwn(p.initiator,'requestId'))return;
   if(this.discardRows.size>=LIMITS.prefetch_requests){this.discardStats.limit_stops++;this.fail('AB_BOUNDARY_BINDING');return;}
   this.discardRows.set(p.requestId,{url:p.request.url,claimed:false,acked:false,failed:false});return;
  }
  const row=this.discardRows.get(p.requestId);if(!row)return;
  if(['Network.responseReceived','Network.loadingFinished'].includes(m.method)){this.discardStats.response_anomalies++;this.fail('AB_BOUNDARY_NETWORK');}
  if(m.method==='Network.loadingFailed')row.failed=true;
 }
 async receive(raw){
  try{if(typeof raw==='string'&&raw.length<=1048576){const m=JSON.parse(raw),ack=this.discardAcks.get(m.id);if(ack){if(this.stopping||this.discardClosed)this.discardStats.after_stop_ack++;else if(ack.received||m.sessionId!==ack.session||m.method!==undefined||Object.hasOwn(m,'error')||!Object.hasOwn(m,'result')||!m.result||typeof m.result!=='object'||Array.isArray(m.result)||Object.keys(m.result).length!==0)this.rejectCandidate('ABORT_REPLY_INVALID',ack.event);else ack.received=true;}this.observeDiscard(m);}}catch{this.fail('AB_BOUNDARY_BINDING');}
  return super.receive(raw);
 }
 async request(e,id){
  if(this.stopping||this.discardClosed)return;
  const row=this.discardRows.get(e.networkId),decision=requestDecision(e,this.icons);
  if(decision!=='SCOPE'||e.resourceType!=='Fetch'||!isPrefetch(e)){
   if(row&&decision==='ALLOW'){this.discardStats.binding_invalidations++;this.rejectCandidate('REUSED_NETWORK_BINDING',e);return;}
   return super.request(e,id);
  }
  let reason=null;
  if(!this.sameOwner()||id!==this.discardOwner?.session||e.frameId!==this.discardOwner?.frame)reason='OWNER_OR_FRAME';
  else if(!valid(e.networkId)||!valid(e.requestId)||!row)reason='MISSING_NETWORK_BINDING';
  else if(row.claimed||this.discardFetchIds.has(e.requestId))reason='DUPLICATE_BINDING';
  else if(row.url!==e.request.url||!localRequest(e.request)||Object.hasOwn(e,'redirectedRequestId')||Object.hasOwn(e,'responseStatusCode')||Object.hasOwn(e,'responseErrorReason'))reason='REQUEST_MISMATCH';
  if(reason){if(reason==='DUPLICATE_BINDING'){this.rejectCandidate(reason,e);return;}this.discardStats.ineligible++;this.discardStats.first_ineligible??=reason;return super.request(e,id);}
  this.discardStats.candidates++;
  if(this.boundary.prefetch>=LIMITS.prefetch_requests||this.discardStats.abort_sent>=LIMITS.prefetch_requests||this.discardStats.pending>=LIMITS.inflight){this.discardStats.limit_stops++;this.rejectCandidate('DISCARD_LIMIT',e);return;}
  row.claimed=true;this.discardFetchIds.add(e.requestId);this.boundary.prefetch++;
  this.discardStats.pending++;this.discardStats.max_pending=Math.max(this.discardStats.max_pending,this.discardStats.pending);
  let commandId;try{
   if(!this.sameOwner()){this.rejectCandidate('OWNER_BEFORE_ABORT',e);return;}
   // Bound to the pinned base call(): it allocates ++ownId synchronously before wire.send.
   commandId=this.ownId+1;if(!Number.isSafeInteger(commandId)||this.discardAcks.has(commandId)||this.pending.has(commandId)){this.rejectCandidate('ABORT_COMMAND_BINDING',e);return;}
   const ack={session:id,event:e,received:false};this.discardAcks.set(commandId,ack);
   this.discardStats.abort_sent++;
   const result=await this.call('Fetch.failRequest',{requestId:e.requestId,errorReason:'BlockedByClient'},id);
   if(this.stopping||this.discardClosed){this.discardStats.after_stop_ack++;return;}
   if(!ack.received||this.discardAcks.get(commandId)!==ack||!this.sameOwner()||this.discardRows.get(e.networkId)!==row||result===null||typeof result!=='object'||Array.isArray(result)||Object.keys(result).length!==0){this.rejectCandidate('ABORT_ACK_OR_OWNER',e);return;}
   row.acked=true;this.discardStats.abort_acked++;this.stats.prefetch_blocked++;
  }catch{this.discardStats.abort_ack_failed++;if(!this.stopping)this.rejectCandidate('ABORT_ACK_FAILED',e);}
  finally{this.discardAcks.delete(commandId);this.discardStats.pending=Math.max(0,this.discardStats.pending-1);}
 }
 async start(e){if(this.discardRows.has(e.networkId)){this.discardStats.continue_attempts_blocked++;this.rejectCandidate('DISCARD_CONTINUE_ATTEMPT',e);return;}return super.start(e);}
 verifyDiscardEnd(){if(!this.stopping&&(this.discardRows.size>0&&!this.discardClosed&&!this.sameOwner()||this.discardStats.pending!==0||this.discardAcks.size!==0||this.discardStats.abort_sent!==this.discardStats.abort_acked||this.discardStats.abort_ack_failed||[...this.discardRows.values()].some(r=>!r.claimed||!r.acked))){this.discardStats.first_ineligible??='INCOMPLETE_AT_CLEANUP';this.fail('AB_BOUNDARY_BINDING');}}
 beginCleanup(){this.verifyDiscardEnd();this.discardClosed=true;this.discardStats.cleanup='STARTED';return super.beginCleanup();}
 dispose(){this.verifyDiscardEnd();this.discardClosed=true;try{return super.dispose();}finally{this.discardRows.clear();this.discardFetchIds.clear();this.discardAcks.clear();this.discardOwner=null;this.discardStats.cleanup='DISPOSED';}}
 discardSnapshot(){const s=this.discardStats,count=v=>Number.isInteger(v)&&v>=0&&v<=65535?v:null;return{kind:'bound-prefetch-discard-local-candidate',binding:'EXACT_PRIMARY_FRAME_LOADER_NETWORK_JOIN',browser_compatibility:'NOT_YET_PROVEN',...Object.fromEntries(COUNT_KEYS.map(k=>[k,count(s[k])])),first_ineligible:s.first_ineligible===null?null:REASONS.includes(s.first_ineligible)?s.first_ineligible:'UNKNOWN',cleanup:['NOT_STARTED','STARTED','DISPOSED'].includes(s.cleanup)?s.cleanup:'UNKNOWN',retained_bindings:count(this.discardRows.size),retained_ack_bindings:count(this.discardAcks.size),normal_requests:count(this.boundary.normal),prefetch_budget:count(this.boundary.prefetch),normal_limit:LIMITS.normal_requests,prefetch_limit:LIMITS.prefetch_requests,pending_limit:LIMITS.inflight};}
}
