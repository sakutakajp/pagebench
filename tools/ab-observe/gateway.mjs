import {FixtureGateway} from '../cdp-startup-diagnostic/fixture-gateway.mjs';
import {StagingGateway} from '../cdp-startup-diagnostic/staging-gateway.mjs';
import {FontMonitor} from '../cdp-startup-diagnostic/font-monitor.mjs';
import {allowed} from '../lighthouse-once/guard.mjs';
import {TARGET,LIMITS} from './config.mjs';
import {ownedGateway} from '../nuxt-debug/owned-receiver.mjs';
const ORIGINS=['https://staging.hirameki.dev','https://image.hirameki.dev'];
const credential=/^(cookie|authorization|proxy-authorization|x-api-key|x-goog-api-key)$/i;
export function requestDecision(e,icons=new Set()){
 const r=e?.request||{};let u;try{u=new URL(r.url);}catch{return'URL';}
 if(e.redirectedRequestId)return'REDIRECT';
 if(!ORIGINS.includes(u.origin)||u.username||u.password||u.hash)return'ORIGIN';
 if(!['GET','HEAD'].includes(r.method)||r.postData)return'METHOD';
 if(Object.keys(r.headers||{}).some(k=>credential.test(k)))return'CREDENTIAL';
 // Other is only an image-destination request (e.g. browser favicon), never a generic fetch.
 const imageOther=e.resourceType==='Other'&&Object.entries(r.headers||{}).some(([k,v])=>k.toLowerCase()==='sec-fetch-dest'&&v==='image');
 if(!allowed(r,imageOther?'Image':e.resourceType,icons))return'SCOPE';
 return'ALLOW';
}
export function isPrefetch(e){return Object.entries(e?.request?.headers||{}).some(([k,v])=>['sec-purpose','purpose'].includes(k.toLowerCase())&&/prefetch/i.test(v));}
class SharedBoundary {
 constructor(g){this.g=g;this.documents=0;this.normal=0;this.prefetch=0;this.rejected=0;this.network=new Map();this.http=null;this.html=false;this.policy=null;}
 check(e){const code=this.checkPolicy(e);if(code!=='ALLOW')this.g.stopEvidence?.rejected(code,e);else this.g.stopEvidence?.meta.bind(this.g.primary,e);return code;}
 checkPolicy(e){const code=requestDecision(e,this.g.icons);if(code!=='ALLOW'){this.rejected++;this.policy??=code;return code;}
  if(e.resourceType==='Document'&&(e.request.url!==TARGET||e.request.method!=='GET'||e.frameId!==this.g.sessions.get(this.g.primary)?.frame||++this.documents!==1))return this.policy='NAVIGATION';
  if(isPrefetch(e)){if(++this.prefetch>LIMITS.prefetch_requests)return this.policy='LIMIT';}else if(++this.normal>LIMITS.normal_requests)return this.policy='LIMIT';
  if(typeof e.networkId!=='string'||!e.networkId)return this.policy='BINDING';
  this.network.set(e.networkId,{url:e.request.url,type:e.resourceType,frame:e.frameId});return'ALLOW';
 }
 passive(m){if(m.sessionId!==this.g.primary)return;const p=m.params||{};
  if(m.method==='Network.requestWillBeSent'&&p.redirectResponse){this.policy??='REDIRECT';this.g.fail('AB_BOUNDARY_REDIRECT');return;}
  if(m.method==='Network.responseReceived'){const prior=this.network.get(p.requestId);if(!prior)return;const r=p.response;
   if(!this.g.stopping&&prior.type==='Document'&&r?.url===prior.url&&Number.isInteger(r.status)&&r.status>=100&&r.status<=599)this.http=r.status;
   if(!r||r.url!==prior.url||r.fromServiceWorker||r.status!==200){this.policy??='RESPONSE';this.g.fail('AB_BOUNDARY_RESPONSE');return;}
   const headers=Object.fromEntries(Object.entries(r.headers||{}).map(([k,v])=>[k.toLowerCase(),v]));
   if(headers['www-authenticate']||headers['proxy-authenticate']||/\bprivate\b/i.test(headers['cache-control']||'')){this.policy??='PUBLIC_SCOPE';this.g.fail('AB_BOUNDARY_RESPONSE');return;}
   if(prior.type==='Document'){this.http=r.status;this.html=r.mimeType==='text/html'&&r.url===TARGET;if(!this.html){this.policy??='HTML';this.g.fail('AB_BOUNDARY_HTML');}}
  }
  if(['Network.loadingFinished','Network.loadingFailed'].includes(m.method)){const prior=this.network.get(p.requestId);if(prior&&m.method==='Network.loadingFailed'){this.policy??='NETWORK';this.g.fail('AB_BOUNDARY_NETWORK');}this.network.delete(p.requestId);}
 }
 snapshot(){return{documents:this.documents,http_status:this.http,html:this.html,normal_requests:this.normal,prefetch_requests:this.prefetch,rejected_requests:this.rejected,boundary_reason:this.policy};}
}
const readEvent=raw=>{if(typeof raw!=='string'||raw.length>1048576)return null;try{const m=JSON.parse(raw);return m.method?.startsWith('Network.')||m.method==='Page.frameNavigated'?m:null;}catch{return null;}};
export class NoReinspectionGateway extends ownedGateway(FixtureGateway) {
 get documentURL(){return TARGET;}
 fetchPatterns(){return[{urlPattern:'*',requestStage:'Request'}];}
 constructor(...args){super(...args);this.boundary=new SharedBoundary(this);this.fonts=new FontMonitor(code=>this.fail(code));this.active=new Set();this.waiting=[];this.stats.max_inflight=0;}
 async receive(raw){const m=readEvent(raw);if(m){this.stopEvidence.meta.observe(m);this.boundary.passive(m);if(m.sessionId===this.primary&&['Network.requestWillBeSent','Network.responseReceived','Network.loadingFinished','Network.loadingFailed'].includes(m.method))this.fonts.observe(m.sessionId,m.method,m.params||{});
  if(m.sessionId===this.primary&&['Network.loadingFinished','Network.loadingFailed'].includes(m.method)){this.active.delete(m.params?.requestId);while(!this.stopping&&this.waiting.length&&this.active.size<LIMITS.inflight)await this.start(this.waiting.shift());}}
  return super.receive(raw);
 }
 async start(e){if(this.stopping)return;if(e.resourceType==='Font'){this.fonts.bind(this.primary,e);if(this.stopping)return;}if(this.active.has(e.networkId)){this.fail('AB_BOUNDARY_BINDING');return;}this.active.add(e.networkId);this.stats.max_inflight=Math.max(this.stats.max_inflight,this.active.size);
  // A changes no request headers or payload. Safety rejects credentials rather than stripping them.
  await this.call('Fetch.continueRequest',{requestId:e.requestId},this.primary);
 }
 async request(e,id){const decision=this.boundary.check(e);if(decision!=='ALLOW'){await this.call('Fetch.failRequest',{requestId:e.requestId,errorReason:'BlockedByClient'},id);this.fail('AB_BOUNDARY_REJECTED');return;}
  if(this.active.size>=LIMITS.inflight){this.waiting.push(e);return;}await this.start(e);
 }
 beginCleanup(){super.beginCleanup();this.fonts.beginCleanup();}
}
export class ReinspectionGateway extends ownedGateway(StagingGateway) {
 constructor(...args){super(...args);this.boundary=new SharedBoundary(this);}
 async receive(raw){const m=readEvent(raw);if(m){this.stopEvidence.meta.observe(m);this.boundary.passive(m);}return super.receive(raw);}
 async request(e,id){if(e.responseStatusCode===undefined&&!e.responseErrorReason){const decision=this.boundary.check(e);if(decision!=='ALLOW'){await this.call('Fetch.failRequest',{requestId:e.requestId,errorReason:'BlockedByClient'},id);this.fail('AB_BOUNDARY_REJECTED');return;}if(isPrefetch(e))this.boundary.network.delete(e.networkId);}return super.request(e,id);}
}
