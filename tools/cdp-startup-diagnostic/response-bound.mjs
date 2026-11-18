// Candidates remain paused. Only createTarget's returned TAB ID can own the page.
import{Observer,autoAttachParams,main}from'./diagnostic.mjs';
export function classifyUnpausedUI(m,sessions,boundTab){
 const t=m.params?.targetInfo,sid=m.params?.sessionId;
 if(typeof sid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(sid)||typeof t?.targetId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(t.targetId))return {relation:'INVALID_IDENTIFIERS',prior_guard:'NONE',prior_kind:'NONE',prior_scope:'NONE',parent_relation:'UNKNOWN'};
 const bySession=sessions.get(sid),byTarget=[...sessions.entries()].find(([,s])=>s.target===t.targetId);
 const prior=bySession||byTarget?.[1],parent=m.sessionId? sessions.get(m.sessionId):null;
 let scope='NONE';if(prior){let cursor=bySession?sid:byTarget[0];const seen=new Set();while(cursor&&!seen.has(cursor)&&seen.size<8){seen.add(cursor);const item=sessions.get(cursor);if(item?.kind==='TAB'){scope=boundTab?(cursor===boundTab?'SELECTED_TAB':'OTHER_TAB'):'UNBOUND_TAB';break;}cursor=item?.parent;}}
 return {relation:bySession?(bySession.target===t.targetId?'SAME_SESSION_SAME_TARGET':'SAME_SESSION_DIFFERENT_TARGET'):byTarget?'SAME_TARGET_OTHER_SESSION':'NEW_TARGET',prior_guard:prior?(prior.ready?'READY':'INITIALIZING'):'NONE',prior_kind:['TAB','PAGE','BROWSER_UI'].includes(prior?.kind)?prior.kind:'NONE',prior_scope:scope,parent_relation:!m.sessionId?'ROOT':['TAB','PAGE','BROWSER_UI'].includes(parent?.kind)?parent.kind:'UNKNOWN'};
}
export class ResponseBoundObserver extends Observer{
 constructor(...args){super(...args);this.bound=false;this.unpausedUI=null;}
 reconcile(){
  if(!this.createdTab||this.stopped)return;
  const tabs=[...this.sessions.entries()].filter(([,s])=>s.kind==='TAB'&&s.target===this.createdTab);
  if(tabs.length>1){this.stop('TAB_BINDING_FAILED');return;}
  if(!tabs.length)return;
  if(tabs[0][1].parent){this.stop('TAB_BINDING_FAILED');return;}
  this.tabSession=tabs[0][0];this.bound=true;
  const pages=[...this.sessions.entries()].filter(([,s])=>s.kind==='PAGE').filter(([sid])=>{const seen=new Set();while(sid&&!seen.has(sid)){seen.add(sid);if(sid===this.tabSession)return true;sid=this.sessions.get(sid)?.parent;}return false;});
  if(pages.length>1){this.stop('EXTRA_PAGE_REJECTED');return;}
  if(pages.length)this.pageSession=pages[0][0];
 }
 async attach(m,k){
  const p=m.params,t=p.targetInfo,sid=p.sessionId,parent=m.sessionId||null;
  if(!p.waitingForDebugger){if(k==='BROWSER_UI')this.unpausedUI=classifyUnpausedUI(m,this.sessions,this.tabSession);this.stop('TARGET_NOT_PAUSED');return;}
  if(!['PAGE','TAB','BROWSER_UI'].includes(k)){this.stop('AUXILIARY_TARGET_STOP');return;}
  if(typeof sid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(sid)||typeof t.targetId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(t.targetId)){this.stop('INVALID_SESSION');return;}
  if(this.sessions.has(sid)||[...this.sessions.values()].some(s=>s.target===t.targetId)){this.stop('PROTECTION_LOST');return;}
  if(parent&&!this.sessions.has(parent)){this.stop('PAGE_LINEAGE_REJECTED');return;}
  if(k==='TAB'){
   const tabs=[...this.sessions.values()].filter(s=>s.kind==='TAB');
   if(!this.createIssued||parent||tabs.length>=3||this.createdTab&&t.targetId!==this.createdTab){this.stop('EXTRA_TAB_REJECTED');return;}
   if(t.url&&t.url!=='about:blank'){this.stop('BLANK_FRAME_MISMATCH');return;}
  }
  if(k==='PAGE'){
   if(!parent){this.stop('PAGE_LINEAGE_REJECTED');return;}
   if(t.url&&t.url!=='about:blank'){this.stop('BLANK_FRAME_MISMATCH');return;}
   if([...this.sessions.values()].filter(s=>s.kind==='PAGE').length>=3){this.stop('EXTRA_PAGE_REJECTED');return;}
  }
  if(k==='BROWSER_UI'&&++this.uiSeen>4){this.stop('BROWSER_UI_LIMIT');return;}
  const s={kind:k,target:t.targetId,parent,ready:false};this.sessions.set(sid,s);
  await this.call('Target.setAutoAttach',autoAttachParams(true),sid);s.ready=true;
  if(k==='BROWSER_UI'){this.uiCount++;this.record('BROWSER_UI_QUARANTINED',k);}
  this.reconcile();await this.initializePage();
 }
 async collect(){
  try{
   await this.call('Target.setAutoAttach',autoAttachParams());this.record('AUTOATTACH_READY');await this.readVersion();
   await this.call('Target.setDiscoverTargets',{discover:true});const snapshot=await this.call('Target.getTargets');
   for(const t of snapshot.targetInfos||[]){if(!['browser'].includes(t.type)){this.stop('TAB_BINDING_FAILED');return this.result();}}
   this.record('BLANK_CREATE_REQUEST');const made=await this.call('Target.createTarget',{url:'about:blank',forTab:true});
   if(typeof made.targetId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(made.targetId)){this.stop('TAB_BINDING_FAILED');return this.result();}
   this.createdTab=made.targetId;this.reconcile();if(this.bound)this.record('TAB_BOUND','TAB');await this.initializePage();
   for(let i=0;i<50&&!this.stopped;i++)await new Promise(r=>setTimeout(r,100));
   if(!this.stopped)this.stop(this.bound?'PAGE_NOT_OBSERVED':'TAB_BINDING_FAILED');
   await Promise.allSettled([...this.tasks]);
  }catch{if(!this.stopped)this.stop('PROTOCOL_OR_CAPTURE_FAILED');}
  return this.result();
 }
 result(){return {...super.result(),unpaused_ui:this.unpausedUI,response_id_bound:this.bound===true,candidate_tabs:[...this.sessions.values()].filter(s=>s.kind==='TAB').length,quarantined_tabs:[...this.sessions.entries()].filter(([sid,s])=>s.kind==='TAB'&&sid!==this.tabSession).length};}
}
if(process.argv[1]===new URL(import.meta.url).pathname){try{const r=await main(ResponseBoundObserver);console.log(JSON.stringify(r));if(r.status!=='success')process.exitCode=1;}catch{console.log('{"code":"DIAGNOSTIC_INTERNAL_FAILED","status":"failed"}');process.exitCode=1;}}
