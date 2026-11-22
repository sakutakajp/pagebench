import {ReadSignals} from './signals.mjs';
import {NoReinspectionGateway} from '../ab-observe/gateway.mjs';
import {TARGET,TOTAL_REQUESTS,INFLIGHT,classifyRequest,responseMime} from './policy.mjs';
export class NaturalReadBoundary{
 constructor(g){this.g=g;this.documents=0;this.total=0;this.http=null;this.html=false;this.policy=null;this.network=new Map();this.loader=null;}
 reject(code,e){this.policy??=code;this.g.stopEvidence.rejected(code,e);return code;}
 check(e){
  const c=classifyRequest(e);if(c.code!=='ALLOW')return this.reject(c.code,e);
  if(this.g.stopping||!this.g.sessions.get(this.g.primary)?.ready||e.frameId!==this.g.sessions.get(this.g.primary).frame)return this.reject('BINDING',e);
  if(c.kind==='MAIN_HTML'&&++this.documents!==1)return this.reject('NAVIGATION',e);
  if(++this.total>TOTAL_REQUESTS)return this.reject('LIMIT',e);
  if(typeof e.networkId!=='string'||!e.networkId||this.network.has(e.networkId))return this.reject('BINDING',e);
  this.network.set(e.networkId,{url:e.request.url,kind:c.kind,frame:e.frameId});this.g.stopEvidence.meta.bind(this.g.primary,e);this.g.readSignals?.bind(e,c.kind);return'ALLOW';
 }
 passive(m){if(m.sessionId!==this.g.primary)return;const p=m.params||{};
  if(m.method==='Page.frameNavigated'&&p.frame?.id===this.g.sessions.get(this.g.primary)?.frame){if(p.frame.url==='about:blank'&&this.documents===0&&!this.loader)return;if(typeof p.frame.loaderId!=='string'||!p.frame.loaderId){this.policy??='BINDING';this.g.fail('AB_BOUNDARY_BINDING');return;}if(p.frame.url!==TARGET||this.loader&&this.loader!==p.frame.loaderId){this.policy??='NAVIGATION';this.g.fail('AB_BOUNDARY_BINDING');}else this.loader=p.frame.loaderId;}
  if(m.method==='Network.requestWillBeSent'&&p.redirectResponse){this.policy??='REDIRECT';this.g.fail('AB_BOUNDARY_REDIRECT');return;}
  const prior=this.network.get(p.requestId);if(!prior)return;
  if(m.method==='Network.responseReceived'){
   const r=p.response;if(prior.kind==='MAIN_HTML'&&r&&Number.isInteger(r.status))this.http=r.status;
   if(!r||r.url!==prior.url||r.fromServiceWorker||r.status!==200){this.policy??='RESPONSE';this.g.fail('AB_BOUNDARY_RESPONSE');return;}
   const h=Object.fromEntries(Object.entries(r.headers||{}).map(([k,v])=>[k.toLowerCase(),v]));
   if(h['www-authenticate']||h['proxy-authenticate']||/\bprivate\b/i.test(h['cache-control']||'')){this.policy??='PUBLIC_SCOPE';this.g.fail('AB_BOUNDARY_RESPONSE');return;}
   if(!responseMime(prior.kind,r.mimeType)){this.policy??='MIME';this.g.fail('AB_BOUNDARY_RESPONSE');return;}
   if(prior.kind==='MAIN_HTML')this.html=true;
  }
  if(['Network.loadingFinished','Network.loadingFailed'].includes(m.method)){if(m.method==='Network.loadingFailed'){this.policy??='NETWORK';this.g.fail('AB_BOUNDARY_NETWORK');}this.network.delete(p.requestId);}
 }
 snapshot(){return{documents:this.documents,http_status:this.http,html:this.html,total_requests:this.total,normal_requests:this.total,prefetch_requests:0,boundary_reason:this.policy};}
}
// No purpose-marker inspection, prefetch abort branch or split counter on this path.
export class NaturalReadGateway extends NoReinspectionGateway{
 constructor(...args){super(...args);this.boundary=new NaturalReadBoundary(this);this.readSignals=new ReadSignals(this);}
 fail(code){this.readSignals?.stop();return super.fail(code);}
 async receive(raw){if(typeof raw==='string'&&raw.length<=1048576){try{const m=JSON.parse(raw);if(m.method)this.readSignals.observe(m);}catch{this.fail('AB_BOUNDARY_BINDING');}}return super.receive(raw);}
 beginCleanup(){this.readSignals.stop();return super.beginCleanup();}
 async request(e,id){if(id!==this.primary){await this.call('Fetch.failRequest',{requestId:e.requestId,errorReason:'BlockedByClient'},id);this.fail('AB_BOUNDARY_BINDING');return;}return super.request(e,id);}
}
export const closedLimits=Object.freeze({requests:TOTAL_REQUESTS,inflight:INFLIGHT});
