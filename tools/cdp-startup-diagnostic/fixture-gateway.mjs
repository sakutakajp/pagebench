// Fixture-only transport. There is no HTTP client, upstream proxy or continueRequest path.
import{Gateway}from'../lighthouse-once/gateway.mjs';import{captureParams}from'./scoped-capture.mjs';
export const FIXTURE_URL='http://127.0.0.1:47500/fixture';
const HTML='<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Isolated fixture</title><link rel="icon" href="data:,"><script src="/fixture.js" defer></script></head><body><main><h1>Isolated Lighthouse fixture</h1><p>Known local content only.</p></main></body></html>';
const CLIENT_LABELS=new Set(['Browser.getVersion','Browser.getWindowForTarget','Browser.getWindowBounds','Browser.setDownloadBehavior','Target.getTargetInfo','Target.getBrowserContexts','Target.setAutoAttach','Target.setDiscoverTargets','Target.createTarget','Target.attachToTarget','Target.detachFromTarget','Runtime.runIfWaitingForDebugger','Fetch.disable','Security.setIgnoreCertificateErrors']);
const valid=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(s);
export class FixtureGateway extends Gateway{
 constructor(wire,kill){super(wire,kill);this.client=new Map();this.tabIds=new Set();this.uiIds=new Set();this.pageInfo=null;this.pageAttachment=null;this.pageCreatedEvent=null;this.primary=null;this.createdPage=null;this.createRequest=null;this.createReply=null;this.released=false;this.auxRequest=null;this.auxReply=null;this.auxEvent=null;this.stats.fixture_documents=0;this.stats.ui_resumes=0;this.stats.extra_targets=0;}
 forward(m){if(this.onmessage)this.onmessage(JSON.stringify(m));else this.queue.push(m);}
 flush(){for(const m of this.queue.splice(0))this.forward(m);}
 async releasePage(){if(this.released||!this.createReply||!this.primary||!this.sessions.get(this.primary)?.ready)return;
  if(this.pageInfo?.targetId!==this.createdPage){this.fail('PAGE_BINDING_FAILED');return;}this.released=true;
  if(this.pageCreatedEvent)this.forward(this.pageCreatedEvent);this.forward(this.pageAttachment);this.forward(this.createReply);
 }
 releaseAux(){if(!this.auxReply||!this.auxEvent)return;const p=this.auxEvent.params;
  if(p.sessionId!==this.auxReply.result?.sessionId||p.targetInfo.targetId!==this.createdPage||p.targetInfo.type!=='page'||!this.sessions.get(this.primary)?.ready){this.fail('AUXILIARY_BINDING_FAILED');return;}
  this.sessions.set(p.sessionId,{ready:true,auxiliary:true,frame:this.sessions.get(this.primary).frame});this.forward(this.auxEvent);this.forward(this.auxReply);this.auxRequest=null;
 }
 async protectPage(m){const p=m.params,t=p.targetInfo,sid=p.sessionId;
  if(m.sessionId||!p.waitingForDebugger||!valid(sid)||!valid(t.targetId)||this.primary||!this.createRequest||t.url&&t.url!=='about:blank'){this.fail('UNPROTECTED_OR_EXTRA_PAGE');return;}
  this.primary=sid;this.pageInfo=t;this.pageAttachment=m;this.sessions.set(sid,{ready:false});
  await this.call('Target.setAutoAttach',captureParams(true),sid);
  await this.call('Network.enable',{},sid);await this.call('Network.setBypassServiceWorker',{bypass:true},sid);await this.call('Network.setBlockedURLs',{urls:['ws://*','wss://*']},sid);
  await this.call('Fetch.enable',{handleAuthRequests:true,patterns:[{urlPattern:'*',requestStage:'Request'},{urlPattern:'*',requestStage:'Response'}]},sid);
  const tree=await this.call('Page.getFrameTree',{},sid);if(tree.frameTree?.frame?.url!=='about:blank'||tree.frameTree?.childFrames?.length){this.fail('INITIAL_FRAME_SCOPE');return;}
  this.sessions.get(sid).frame=tree.frameTree.frame.id;this.sessions.get(sid).ready=true;await this.releasePage();
 }
 async receive(raw){
  if(this.stopping)return;
  try{
   if(typeof raw!=='string'||raw.length>1048576){this.fail('CDP_INPUT_LIMIT');return;}const m=JSON.parse(raw);
   if(this.pending.has(m.id)){await super.receive(raw);return;}
   if(this.client.has(m.id)){
    const method=this.client.get(m.id);this.client.delete(m.id);
    if(method==='Target.createTarget'){if(m.error||!valid(m.result?.targetId)){this.fail('PAGE_CREATE_FAILED');return;}this.createdPage=m.result.targetId;this.createReply=m;await this.releasePage();return;}
    if(method==='Target.attachToTarget'){if(m.error||!valid(m.result?.sessionId)){this.fail('AUXILIARY_BINDING_FAILED');return;}this.auxReply=m;this.releaseAux();return;}
    this.forward(m);return;
   }
   if(['Target.targetCreated','Target.targetInfoChanged'].includes(m.method)){
    const t=m.params?.targetInfo;if(!t||!valid(t.targetId)){this.fail('INVALID_TARGET');return;}
    if(t.type==='browser'){this.forward(m);return;}
    if(t.type==='tab'){if(this.createdPage&&!this.tabIds.has(t.targetId)||this.tabIds.size>=3&&!this.tabIds.has(t.targetId)){this.stats.extra_targets++;this.fail('UNEXPECTED_TAB');return;}this.tabIds.add(t.targetId);return;}
    if(t.type==='browser_ui'){if(this.uiIds.size>=4&&!this.uiIds.has(t.targetId)){this.fail('UI_LIMIT');return;}return;}
    if(t.type!=='page'){this.stats.extra_targets++;this.fail('UNEXPECTED_TARGET');return;}
    if(this.pageInfo&&t.targetId!==this.pageInfo.targetId||this.createdPage&&t.targetId!==this.createdPage||t.url&&!['about:blank',FIXTURE_URL].includes(t.url)){this.fail('PAGE_SCOPE');return;}
    if(m.method==='Target.targetCreated'){if(this.pageCreatedEvent&&this.pageCreatedEvent.params.targetInfo.targetId!==t.targetId){this.fail('UNEXPECTED_PAGE');return;}this.pageCreatedEvent=m;}
    if(this.released)this.forward(m);return;
   }
   if(m.method==='Target.attachedToTarget'){
    const p=m.params,t=p?.targetInfo;if(!t||!valid(t.targetId)||!valid(p.sessionId)){this.fail('INVALID_TARGET');return;}
    if(t.type==='browser_ui'){if(m.sessionId||!p.waitingForDebugger||this.uiIds.has(t.targetId)||this.sessions.has(p.sessionId)){this.fail('UI_NOT_QUARANTINED');return;}this.uiIds.add(t.targetId);this.sessions.set(p.sessionId,{ready:false,internalUI:true,target:t.targetId});return;}
    if(t.type!=='page'){this.stats.extra_targets++;this.fail('UNEXPECTED_TARGET');return;}
    if(this.primary){if(this.auxRequest&&t.targetId===this.createdPage&&this.sessions.get(this.primary)?.ready&&!this.auxEvent){this.auxEvent=m;this.releaseAux();return;}this.fail('UNEXPECTED_PAGE_SESSION');return;}
    await this.protectPage(m);return;
   }
   if(m.method==='Target.detachedFromTarget'){
    const s=this.sessions.get(m.params?.sessionId);if(s?.auxiliary){this.sessions.delete(m.params.sessionId);this.forward(m);return;}if(s){this.fail('PROTECTION_LOST');return;}
   }
   if(m.method==='Target.targetDestroyed'&&(m.params?.targetId===this.createdPage||this.uiIds.has(m.params?.targetId))||['Inspector.detached','Inspector.targetCrashed'].includes(m.method)){this.fail('PROTECTION_LOST');return;}
   if(m.method==='Fetch.authRequired'){this.fail('AUTH_REJECTED');return;}
   if(m.method==='Fetch.requestPaused'){if(m.sessionId!==this.primary){this.fail('FETCH_SCOPE');return;}await this.request(m.params,m.sessionId);return;}
   if(m.method==='Network.webSocketWillSendHandshakeRequest'){this.fail('WEBSOCKET_PROTECTION_FAILED');return;}
   if(m.sessionId&&!this.sessions.get(m.sessionId)?.ready)return;
   this.forward(m);
  }catch{this.fail('GATEWAY_INTERNAL_FAILED');}
 }
 send(raw){if(this.stopping)return;
  try{const m=JSON.parse(raw),p=m.params||{},s=this.sessions.get(m.sessionId);this.lastClientCommand=CLIENT_LABELS.has(m.method)?m.method:'OTHER';
   if(m.sessionId&&(!s?.ready||s.internalUI)){this.fail('UNGUARDED_SESSION_COMMAND');return;}
   if(['Fetch.disable','Fetch.enable','Fetch.continueRequest','Fetch.continueResponse','Fetch.fulfillRequest','Fetch.failRequest','Fetch.continueWithAuth','Security.setIgnoreCertificateErrors'].includes(m.method)){this.fail('PROTECTION_MUTATION');return;}
   if(m.method==='Network.loadNetworkResource'){this.forward({id:m.id,sessionId:m.sessionId,error:{code:-32000,message:'Direct fetch disabled'}});return;}
   if(m.method==='Network.setBypassServiceWorker'&&p.bypass!==true){this.fail('PROTECTION_MUTATION');return;}
   if(m.method==='Network.setBlockedURLs')m.params={urls:[...new Set([...(p.urls||[]),'ws://*','wss://*'])]};
   if(m.method==='Target.setAutoAttach'){if(!p.autoAttach||!p.waitForDebuggerOnStart||!p.flatten){this.fail('PROTECTION_MUTATION');return;}m.params=captureParams(!!m.sessionId);}
   if(m.method==='Target.setDiscoverTargets'){if(!p.discover||m.sessionId){this.fail('PROTECTION_MUTATION');return;}m.params={discover:true,filter:[{}]};}
   if(m.method==='Target.createTarget'){if(m.sessionId||this.createRequest||p.url!=='about:blank'||Object.keys(p).some(k=>k!=='url')){this.fail('UNEXPECTED_PAGE');return;}this.createRequest=m.id;}
   if(m.method==='Target.attachToTarget'){if(m.sessionId||p.targetId!==this.createdPage||!this.sessions.get(this.primary)?.ready||this.auxRequest||this.auxEvent||p.flatten!==true){this.fail('AUXILIARY_BINDING_FAILED');return;}this.auxRequest=m.id;}
   if(m.method==='Target.detachFromTarget'&&!this.sessions.get(p.sessionId)?.auxiliary){this.fail('PROTECTION_LOST');return;}
   if(m.method==='Page.navigate'&&(!s?.ready||!['about:blank',FIXTURE_URL].includes(p.url))){this.fail('NAVIGATION_SCOPE');return;}
   if(m.method==='Runtime.runIfWaitingForDebugger'&&!s?.ready){this.fail('EARLY_RESUME');return;}
   if(!m.sessionId&&!['Browser.getVersion','Target.getBrowserContexts','Target.setAutoAttach','Target.setDiscoverTargets','Target.createTarget','Target.attachToTarget','Target.detachFromTarget','Browser.getWindowForTarget','Browser.getWindowBounds'].includes(m.method)){this.fail('ROOT_COMMAND_SCOPE');return;}
   if(m.method==='Browser.getWindowForTarget'&&p.targetId!==this.createdPage){this.fail('ROOT_COMMAND_SCOPE');return;}
   this.client.set(m.id,m.method);this.wire.send(JSON.stringify(m));if(m.method==='Target.setAutoAttach'&&!m.sessionId)this.flush();
  }catch{this.fail('CLIENT_COMMAND_FORMAT');}
 }
 async request(e,id){
  const abort=()=>this.call('Fetch.failRequest',{requestId:e.requestId,errorReason:'BlockedByClient'},id);
  if(e.responseStatusCode!==undefined||e.responseErrorReason){if(e.responseErrorReason||e.responseStatusCode!==200){await abort();this.fail('RESPONSE_SCOPE');return;}await this.call('Fetch.continueResponse',{requestId:e.requestId},id);return;}
  if(e.redirectedRequestId){await abort();this.fail('REDIRECT');return;}
  let u;try{u=new URL(e.request.url);}catch{await abort();this.fail('REQUEST_FORMAT');return;}
  const ok=u.origin==='http://127.0.0.1:47500'&&!u.username&&!u.password&&!u.search&&!u.hash&&['GET','HEAD'].includes(e.request.method)&&((u.pathname==='/fixture'&&e.resourceType==='Document')||(u.pathname==='/fixture.js'&&e.resourceType==='Script'));
  if(!ok){this.stats.blocked++;await abort();if(e.resourceType==='Document')this.fail('NAVIGATION_SCOPE');return;}
  if(e.resourceType==='Document'&&(e.frameId!==this.sessions.get(this.primary)?.frame||++this.stats.fixture_documents>1)){await abort();this.fail('NAVIGATION_SCOPE');return;}
  if(++this.stats.allowed>120){await abort();this.fail('REQUEST_LIMIT');return;}
  const body=u.pathname==='/fixture'?HTML:'window.fixtureReady=true;';
  await this.call('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:u.pathname==='/fixture'?'text/html':'text/javascript'}],body:Buffer.from(e.request.method==='HEAD'?'':body).toString('base64')},id);if(e.resourceType==='Document')this.stats.html200=true;
 }
}
