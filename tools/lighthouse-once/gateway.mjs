// Single CDP transport: no client can resume a target before its guard is installed.
import {allowed,headerSafe,TARGET} from './guard.mjs';
export class Gateway {
 constructor(wire, emergency, fixture=null){
  this.wire=wire;this.emergency=emergency;this.fixture=fixture;this.ownId=1000000000;this.pending=new Map();this.sessions=new Map();this.targets=new Map();this.queue=[];this.delivered=new Set();this.deferred=[];this.forwarding=false;this.stopping=false;this.icons=new Set();
  this.stats={allowed:0,blocked:0,prefetch_blocked:0,html200:false,fatal:null};this.documents=0;
  wire.onmessage=event=>this.receive(typeof event==='string'?event:event.data);
  wire.onerror=()=>{if(!this.stopping)this.fail('CDP_LOST');};
  wire.onclose=()=>{if(!this.stopping)this.fail('CDP_LOST');this.onclose?.();};
 }
 fail(code){if(this.stopping)return;this.stats.fatal??=code;this.stopping=true;this.emergency();for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('GUARD_STOPPED'));}this.pending.clear();}
 call(method,params={},sessionId){this.lastCommand=method;return new Promise((resolve,reject)=>{if(this.stopping)return reject(Error('GUARD_STOPPED'));const id=++this.ownId;const timer=setTimeout(()=>{this.fail('CDP_TIMEOUT');reject(Error('CDP_TIMEOUT'));},5000);this.pending.set(id,{resolve,reject,timer});this.wire.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
 forward(value){
  if(value.method==='Target.attachedToTarget'){
   if(!this.forwarding||!this.onmessage){this.queue.push(value);return;}
   if(value.sessionId&&!this.delivered.has(value.sessionId)){this.deferred.push(value);return;}
   this.onmessage(JSON.stringify(value));this.delivered.add(value.params.sessionId);
   const waiting=this.deferred.splice(0);for(const e of waiting)this.forward(e);return;
  }
  if(this.onmessage)this.onmessage(JSON.stringify(value));else this.queue.push(value);
 }
 async protect(p){
  const t=p.targetInfo,id=p.sessionId;
  if(!['page','tab'].includes(t.type)){this.fail('TARGET_REJECTED');return false;}
  const prior=[...this.targets.values()].find(x=>x.type===t.type&&x.targetId!==t.targetId);
  if(prior){this.fail('TARGET_REJECTED');return false;}
  if(t.url&&t.url!=='about:blank'&&t.url!==TARGET){this.fail('TARGET_REJECTED');return false;}
  const previous=this.targets.get(t.targetId);
  if(previous){this.sessions.set(id,{ready:true,auxiliary:true});return true;}
  // An already running non-blank target was never protected from creation.
  if(!p.waitingForDebugger&&t.url&&t.url!=='about:blank'){this.fail('UNPAUSED_TARGET');return false;}
  this.targets.set(t.targetId,{targetId:t.targetId,type:t.type,sessionId:id});this.sessions.set(id,{ready:false});
  await this.call('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},id);
  if(t.type==='page'){
   await this.call('Network.enable',{},id);
   await this.call('Network.setBypassServiceWorker',{bypass:true},id);
   await this.call('Network.setBlockedURLs',{urls:['ws://*','wss://*']},id);
   await this.call('Fetch.enable',{handleAuthRequests:true,patterns:[{urlPattern:'*',requestStage:'Request'},{urlPattern:'*',requestStage:'Response'}]},id);
   const tree=await this.call('Page.getFrameTree',{},id);this.sessions.get(id).frame=tree.frameTree.frame.id;
  }
  this.sessions.get(id).ready=true;return true;
 }
 async receive(raw){let m;try{m=JSON.parse(raw);}catch{this.fail('CDP_FORMAT');return;}
  if(this.pending.has(m.id)){const p=this.pending.get(m.id);this.pending.delete(m.id);clearTimeout(p.timer);if(m.error)p.reject(Error('CDP_COMMAND_FAILED'));else p.resolve(m.result||{});return;}
  if(this.stopping)return;
  try{
   if(m.method==='Target.attachedToTarget'){if(await this.protect(m.params))this.forward(m);return;}
   if(m.method==='Target.detachedFromTarget'&&this.sessions.has(m.params.sessionId)&&!this.sessions.get(m.params.sessionId).auxiliary){this.fail('PROTECTION_LOST');return;}
   if(m.method==='Inspector.detached'||m.method==='Inspector.targetCrashed'){this.fail('PROTECTION_LOST');return;}
   if(m.method==='Fetch.requestPaused'&&this.sessions.has(m.sessionId)){await this.request(m.params,m.sessionId);return;}
   if(m.method==='Fetch.authRequired'){await this.call('Fetch.continueWithAuth',{requestId:m.params.requestId,authChallengeResponse:{response:'CancelAuth'}},m.sessionId);this.fail('AUTH_REJECTED');return;}
   this.forward(m);
  }catch{this.fail('GUARD_FAILURE');}
 }
 send(raw){if(this.stopping)return;let m;try{m=JSON.parse(raw);}catch{this.fail('CDP_FORMAT');return;}
  if(m.method==='Network.loadNetworkResource'){this.onmessage?.(JSON.stringify({id:m.id,sessionId:m.sessionId,error:{code:-32000,message:'Direct resource fetch disabled'}}));return;}
  if(m.method==='Target.detachFromTarget'&&this.sessions.has(m.params?.sessionId)&&!this.sessions.get(m.params.sessionId).auxiliary){this.fail('PROTECTION_LOST');return;}
  if(m.method==='Network.setBlockedURLs'){m.params={urls:[...new Set([...(m.params?.urls||[]),'ws://*','wss://*'])]};raw=JSON.stringify(m);}
  if(m.method==='Network.setBypassServiceWorker'&&m.params?.bypass!==true){this.fail('PROTECTION_MUTATION');return;}
  if(['Fetch.disable','Fetch.enable','Fetch.continueRequest','Fetch.continueResponse','Fetch.fulfillRequest','Fetch.failRequest','Fetch.continueWithAuth','Security.setIgnoreCertificateErrors'].includes(m.method)){this.fail('PROTECTION_MUTATION');return;}
  if(m.method==='Target.setAutoAttach'&&(!m.params?.autoAttach||!m.params.waitForDebuggerOnStart||!m.params.flatten)){this.fail('PROTECTION_MUTATION');return;}
  if(m.method==='Runtime.runIfWaitingForDebugger'&&!this.sessions.get(m.sessionId)?.ready){this.fail('EARLY_RESUME');return;}
  if(m.method==='Target.setAutoAttach'){m.params.filter=m.sessionId?[{type:'browser',exclude:true},{}]:[{type:'page',exclude:true},{type:'browser',exclude:true},{}];raw=JSON.stringify(m);}
  this.wire.send(raw);
  if(m.method==='Target.setAutoAttach'&&!this.forwarding){this.forwarding=true;for(const e of this.queue.splice(0))this.forward(e);}
 }
 async request(e,id){
  const abort=()=>this.call('Fetch.failRequest',{requestId:e.requestId,errorReason:'BlockedByClient'},id);
  if(e.responseStatusCode!==undefined||e.responseErrorReason){
   if(e.responseErrorReason){this.fail('RESPONSE_ERROR');return;}
   if(e.responseStatusCode>=300&&e.responseStatusCode<400){await abort();this.fail('REDIRECT');return;}
   if(e.resourceType==='Document'){
    const mime=(e.responseHeaders||[]).find(h=>h.name.toLowerCase()==='content-type')?.value||'';
    if(e.responseStatusCode!==200||!/^text\/html\b/i.test(mime)){await abort();this.fail('HTML_HTTP');return;}
    this.stats.html200=true;
   }
   await this.call('Fetch.continueResponse',{requestId:e.requestId},id);return;
  }
  if(e.redirectedRequestId){await abort();this.fail('REDIRECT');return;}
  const h=e.request.headers||{};if(/prefetch/i.test(h['sec-purpose']||h['Sec-Purpose']||h.Purpose||h.purpose||'')){this.stats.prefetch_blocked++;await abort();if(this.stats.prefetch_blocked>256)this.fail('PREFETCH_LIMIT');return;}
  if(e.resourceType==='Other'){
   const expression='[...document.querySelectorAll("link[rel]")].filter(e=>/^(icon|shortcut icon|apple-touch-icon|apple-touch-icon-precomposed)$/i.test(e.rel)).map(e=>e.href)';
   const v=await this.call('Runtime.evaluate',{expression,returnByValue:true},id);this.icons=new Set(v.result?.value||[]);
  }
  if(!allowed(e.request,e.resourceType,this.icons)){
   this.stats.blocked++;await abort();if(e.resourceType==='Document')this.fail('NAVIGATION_SCOPE');return;
  }
  if(e.resourceType==='Document'&&(e.frameId!==this.sessions.get(id).frame||++this.documents>1)){await abort();this.fail('NAVIGATION_SCOPE');return;}
  if(++this.stats.allowed>120){await abort();this.fail('REQUEST_LIMIT');return;}
  if(this.fixture){
   const response=await this.fixture(e);if(!response){await abort();return;}
   await this.call('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:response.mime}],body:Buffer.from(response.body).toString('base64')},id);
   if(e.resourceType==='Document')this.stats.html200=true;return;
  }
  await this.call('Fetch.continueRequest',{requestId:e.requestId,headers:headerSafe(e.request.headers)},id);
 }
 close(){this.fail('CDP_LOST');this.wire.close();}
 dispose(){this.stopping=true;this.wire.close();}
}
