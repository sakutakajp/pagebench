// Root catches every type (except the Browser itself); discovery remains unfiltered.
// Internal UI is captured paused at root, never recursively attached or resumed.
import{ResponseBoundObserver}from'./response-bound.mjs';import{commandAllowed,kindOf}from'./diagnostic.mjs';
export const ROOT_FILTER=Object.freeze([{type:'browser',exclude:true},{}]);
export const CHILD_FILTER=Object.freeze([{type:'browser',exclude:true},{type:'browser_ui',exclude:true},{type:'tab',exclude:true},{type:'page',exclude:true},{}]);
export const captureParams=child=>({autoAttach:true,waitForDebuggerOnStart:true,flatten:true,filter:child?CHILD_FILTER:ROOT_FILTER});
const valid=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(id);
export class ScopedCaptureObserver extends ResponseBoundObserver{
 constructor(wire,kill,mode='ROOT_PAGE'){super(wire,kill);if(!['ROOT_PAGE','SELECTED_TAB'].includes(mode))throw Error('MODE_INVALID');this.captureMode=mode;this.selectedTabConfigured=false;this.selectedTabConfiguring=false;this.parentEvidence='MISSING';}
 allowedCommand(method,p,child){
  if(method==='Target.setAutoAttach')return JSON.stringify(p)===JSON.stringify(captureParams(child));
  if(method==='Target.setDiscoverTargets')return JSON.stringify(p)==='{"discover":true,"filter":[{}]}';
  if(method==='Target.getTargets')return JSON.stringify(p)==='{"filter":[{}]}';
  return commandAllowed(method,p,child);
 }
 lineage(){const page=this.sessions.get(this.pageSession),tab=this.sessions.get(this.tabSession);return this.bound&&page?.kind==='PAGE'&&page.ready&&tab?.kind==='TAB'&&tab.target===this.createdTab&&page.parentTarget===tab.target&&(this.captureMode!=='SELECTED_TAB'||this.selectedTabConfigured);}
 reconcile(){
  if(!this.createdTab||this.stopped)return;
  const tabs=[...this.sessions.entries()].filter(([,s])=>s.kind==='TAB'&&s.target===this.createdTab);
  if(tabs.length!==1)return;
  if(tabs[0][1].parent){this.stop('TAB_BINDING_FAILED');return;}
  this.tabSession=tabs[0][0];this.bound=true;
  const pages=[...this.sessions.entries()].filter(([,s])=>s.kind==='PAGE'&&s.parentTarget===this.createdTab);
  if(pages.length>1){this.stop('EXTRA_PAGE_REJECTED');return;}
  if(pages.length){this.pageSession=pages[0][0];this.parentEvidence=pages[0][1].parentEvidence;}
 }
 async configureSelected(){
  this.reconcile();
  if(this.captureMode==='SELECTED_TAB'&&this.bound&&!this.selectedTabConfigured&&!this.selectedTabConfiguring&&!this.stopped){this.selectedTabConfiguring=true;await this.call('Target.setAutoAttach',captureParams(true),this.tabSession);this.selectedTabConfigured=true;}
  await this.initializePage();
 }
 async attach(m,k){
  const p=m.params,t=p.targetInfo,sid=p.sessionId,parent=m.sessionId||null;
  if(!p.waitingForDebugger){if(k==='BROWSER_UI')return super.attach(m,k);this.stop('TARGET_NOT_PAUSED');return;}
  if(!['TAB','BROWSER_UI','PAGE'].includes(k)){this.stop('AUXILIARY_TARGET_STOP');return;}
  if(!valid(sid)||!valid(t.targetId)){this.stop('INVALID_SESSION');return;}
  if(this.sessions.has(sid)||[...this.sessions.values()].some(s=>s.target===t.targetId)){this.stop('PROTECTION_LOST');return;}
  if(parent&&!this.sessions.has(parent)){this.stop('PAGE_LINEAGE_REJECTED');return;}
  if(k==='TAB'&&(!this.createIssued||parent||[...this.sessions.values()].filter(s=>s.kind==='TAB').length>=3||this.createdTab&&t.targetId!==this.createdTab)){this.stop('EXTRA_TAB_REJECTED');return;}
  if(k!=='BROWSER_UI'&&t.url&&t.url!=='about:blank'){this.stop('BLANK_FRAME_MISMATCH');return;}
  if(k==='BROWSER_UI'&&++this.uiSeen>4){this.stop('BROWSER_UI_LIMIT');return;}
  let parentTarget=null,parentEvidence='MISSING';
  if(k==='PAGE'){
   const envelope=this.sessions.get(parent);if(valid(t.parentId)){parentTarget=t.parentId;parentEvidence='TARGETINFO';}
   if(envelope){if(envelope.kind!=='TAB'||parentTarget&&parentTarget!==envelope.target){this.stop('PAGE_LINEAGE_REJECTED');return;}parentTarget=envelope.target;parentEvidence=parentEvidence==='TARGETINFO'?'BOTH':'ENVELOPE';}
   if(!parentTarget){this.stop('PAGE_LINEAGE_REJECTED');return;}
   if(![...this.sessions.values()].some(s=>s.kind==='TAB'&&s.target===parentTarget)){this.stop('PAGE_LINEAGE_REJECTED');return;}
   if([...this.sessions.values()].filter(s=>s.kind==='PAGE').length>=3){this.stop('EXTRA_PAGE_REJECTED');return;}
  }
  const s={kind:k,target:t.targetId,parent,parentTarget,parentEvidence,ready:k!=='PAGE'};this.sessions.set(sid,s);
  if(k==='BROWSER_UI'){this.uiCount++;this.record('BROWSER_UI_QUARANTINED',k);}
  if(k==='PAGE'){await this.call('Target.setAutoAttach',captureParams(true),sid);s.ready=true;}
  await this.configureSelected();
 }
 async receive(raw){
  try{if(typeof raw==='string'&&raw.length<=262144){const m=JSON.parse(raw);if(['Target.targetCreated','Target.targetInfoChanged'].includes(m.method)){
   const k=kindOf(m.params?.targetInfo);if(k.startsWith('TYPE_')){this.stop('TARGET_TYPE_UNCLASSIFIED');return;}
   if(!['TAB','PAGE','BROWSER_UI','BROWSER'].includes(k)){this.stop('AUXILIARY_TARGET_STOP');return;}
   if(k==='PAGE'&&this.createdTab&&m.params.targetInfo.parentId!==this.createdTab&&!this.sessions.has(m.sessionId)){this.stop('PAGE_LINEAGE_REJECTED');return;}
   if(k==='TAB'&&this.createdTab&&m.params.targetInfo.targetId!==this.createdTab&&![...this.sessions.values()].some(s=>s.target===m.params.targetInfo.targetId)){this.stop('EXTRA_TAB_REJECTED');return;}
  }}}catch{this.stop('PROTOCOL_OR_CAPTURE_FAILED');return;}
  return super.receive(raw);
 }
 async collect(){
  try{
   await this.call('Target.setAutoAttach',captureParams(false));this.record('AUTOATTACH_READY');await this.readVersion();
   await this.call('Target.setDiscoverTargets',{discover:true,filter:[{}]});const snap=await this.call('Target.getTargets',{filter:[{}]});
   if((snap.targetInfos||[]).some(t=>t.type!=='browser')){this.stop('TAB_BINDING_FAILED');return this.result();}
   this.record('BLANK_CREATE_REQUEST');const made=await this.call('Target.createTarget',{url:'about:blank',forTab:true});
   if(!valid(made.targetId)){this.stop('TAB_BINDING_FAILED');return this.result();}this.createdTab=made.targetId;this.reconcile();if(this.bound)this.record('TAB_BOUND','TAB');await this.configureSelected();
   for(let i=0;i<50&&!this.stopped;i++)await new Promise(r=>setTimeout(r,100));if(!this.stopped)this.stop(this.bound?'PAGE_NOT_OBSERVED':'TAB_BINDING_FAILED');await Promise.allSettled([...this.tasks]);
  }catch{if(!this.stopped)this.stop('PROTOCOL_OR_CAPTURE_FAILED');}return this.result();
 }
}
