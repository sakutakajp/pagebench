// Independent observation only. No Puppeteer/Lighthouse/measurement imports or forwarding path.
import http from 'node:http';
import{trackProcess,cleanupDiagnostic,finishObservation,freezeVersion}from'./cleanup.mjs';
import {spawn} from 'node:child_process';
import {access,mkdtemp,readFile,rm} from 'node:fs/promises';
import {constants} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
const KINDS=Object.freeze({tab:'TAB',page:'PAGE',iframe:'IFRAME',worker:'WORKER',shared_worker:'SHARED_WORKER',service_worker:'SERVICE_WORKER',worklet:'WORKLET',shared_storage_worklet:'SHARED_STORAGE_WORKLET',browser:'BROWSER',webview:'WEBVIEW',other:'OTHER',auction_worklet:'AUCTION_WORKLET',assistive_technology:'ASSISTIVE_TECHNOLOGY',browser_ui:'BROWSER_UI',background_page:'BACKGROUND_PAGE'});
export function kindOf(info){
 if(!info||typeof info!=='object'||!Object.hasOwn(info,'type'))return 'TYPE_MISSING';
 if(typeof info.type!=='string')return 'TYPE_NONSTRING';
 if(info.type==='')return 'TYPE_EMPTY';
 return Object.hasOwn(KINDS,info.type)?KINDS[info.type]:'TYPE_UNKNOWN_STRING';
}
const OBSERVATION_CODES=new Set(['OBSERVING','EVENT_LIMIT','CONTROL_LOST','COMMAND_REJECTED','CDP_TIMEOUT','INPUT_LIMIT','CDP_COMMAND_FAILED','TARGET_TYPE_UNCLASSIFIED','TARGET_NOT_PAUSED','AUXILIARY_TARGET_STOP','INVALID_SESSION','PROTOCOL_OR_CAPTURE_FAILED','PAUSED_PAGE_OBSERVED','NO_PAUSED_PAGE','CLEANUP','BINARY_UNAVAILABLE','CHROME_START_FAILED','CHROME_SANDBOX_FAILED','DEVTOOLS_FILE_INVALID','DEVTOOLS_FILE_TIMEOUT','DEVTOOLS_WS_FAILED','OBSERVATION_INVALID','BLANK_PAGE_PROTOCOL_READY','EXTRA_TAB_REJECTED','EXTRA_PAGE_REJECTED','PAGE_LINEAGE_REJECTED','TAB_BINDING_FAILED','BROWSER_UI_LIMIT','PROTECTION_LOST','BLANK_FRAME_MISMATCH','PAGE_PROTOCOL_FAILED','PAGE_NOT_OBSERVED']);
const EVENT_CODES=new Set(['CREATED','INFO_CHANGED','ATTACHED_PAUSED','ATTACHED_NOT_PAUSED','AUTOATTACH_READY','SNAPSHOT','BLANK_CREATE_REQUEST','BROWSER_UI_QUARANTINED','PAGE_PROTOCOL_START','PAGE_PROTOCOL_READY','TAB_BOUND']);
const SAFE_KINDS=new Set([...Object.values(KINDS),'TYPE_MISSING','TYPE_NONSTRING','TYPE_EMPTY','TYPE_UNKNOWN_STRING']);
export function freezeObservation(raw){
 let code=OBSERVATION_CODES.has(raw?.code)?raw.code:'OBSERVATION_INVALID';const sequence=[];
 for(const entry of (Array.isArray(raw?.sequence)?raw.sequence:[]).slice(0,48)){
  if(!EVENT_CODES.has(entry?.event)||(entry.kind!==undefined&&!SAFE_KINDS.has(entry.kind))){code='OBSERVATION_INVALID';continue;}
  sequence.push(Object.freeze({n:sequence.length+1,event:entry.event,...(entry.kind?{kind:entry.kind}:{})}));
 }
 return Object.freeze({schema:2,kind:'isolated-cdp-startup-observation',code,sequence:Object.freeze(sequence),site_navigations:0,outbound_forwarding:0,target_resumes:0,browser_ui_resumes:0,browser_ui_quarantined:Number.isInteger(raw?.browser_ui_quarantined)&&raw.browser_ui_quarantined>=0&&raw.browser_ui_quarantined<=4?raw.browser_ui_quarantined:0,page_protocol_initialized:raw?.page_protocol_initialized===true});
}
export function endpoint(text){
 const m=typeof text==='string'&&text.length<=512&&/^(\d{1,5})\n(\/devtools\/browser\/[a-f0-9-]{36})\n?$/i.exec(text);
 if(!m||+m[1]<1||+m[1]>65535)throw Error('DEVTOOLS_FILE_INVALID');
 return 'ws://127.0.0.1:'+Number(m[1])+m[2];
}
export function autoAttachParams(child=false){return {autoAttach:true,waitForDebuggerOnStart:true,flatten:true,filter:child?[{type:'browser',exclude:true},{}]:[{type:'page',exclude:true},{type:'browser',exclude:true},{}]};}
export function commandAllowed(method,p,child=false){
 if(!p||typeof p!=='object'||Array.isArray(p))return false;
 if(method==='Target.setAutoAttach')return p?.autoAttach===true&&p.waitForDebuggerOnStart===true&&p.flatten===true&&Object.keys(p).sort().join(',')==='autoAttach,filter,flatten,waitForDebuggerOnStart'&&JSON.stringify(p.filter)===JSON.stringify(autoAttachParams(child).filter);
 if(method==='Target.setDiscoverTargets')return p?.discover===true&&Object.keys(p).length===1;
 if(method==='Browser.getVersion')return !child&&Object.keys(p).length===0;
 if(method==='Target.getTargets')return Object.keys(p||{}).length===0;
 return method==='Target.createTarget'&&p?.url==='about:blank'&&p.forTab===true&&Object.keys(p).length===2;
}
export async function denyProxy(){
 const sockets=new Set();const server=http.createServer((q,r)=>{r.writeHead(403);r.end();});
 // There is deliberately no upstream client, DNS lookup, net.connect or enable method.
 server.on('connection',s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));s.setTimeout(3000,()=>s.destroy());});
 server.on('connect',(_q,s)=>s.destroy());server.on('upgrade',(_q,s)=>s.destroy());
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 return {url:'http://127.0.0.1:'+server.address().port,close:async()=>{for(const s of sockets)s.destroy();await new Promise(r=>server.close(r));}};
}
export class Observer{
 constructor(wire,terminate){this.wire=wire;this.terminate=terminate;this.pending=new Map();this.serial=0;this.sequence=[];this.stopped=false;this.code='OBSERVING';this.sessions=new Map();this.tasks=new Set();this.createIssued=false;this.createdTab=null;this.tabSession=null;this.pageSession=null;this.uiCount=0;this.uiSeen=0;this.initializing=false;this.pageInitialized=false;this.browserVersion=freezeVersion({code:'VERSION_NOT_ATTEMPTED'});
  wire.onmessage=e=>{const task=this.receive(typeof e==='string'?e:e.data);this.tasks.add(task);task.finally(()=>this.tasks.delete(task));};
  wire.onclose=()=>this.stop('CONTROL_LOST');wire.onerror=()=>this.stop('CONTROL_LOST');
 }
 record(event,kind){if(this.stopped)return;if(this.sequence.length>=48){this.stop('EVENT_LIMIT');return;}this.sequence.push({n:this.sequence.length+1,event,...(kind?{kind}:{})});}
 stop(code){if(this.stopped)return;this.stopped=true;this.code=code;this.snapshot=freezeObservation(this.result());try{this.terminate();}catch{this.terminationFailed=true;}for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('DIAGNOSTIC_STOPPED'));}this.pending.clear();}
 lineage(){
  if(!this.pageSession||!this.tabSession||!this.createdTab)return false;
  const tab=this.sessions.get(this.tabSession);if(tab.target!==this.createdTab)return false;
  let sid=this.pageSession;const seen=new Set();
  while(sid){if(seen.has(sid)||seen.size>6)return false;seen.add(sid);const s=this.sessions.get(sid);if(!s?.ready)return false;if(s.kind==='TAB')return sid===this.tabSession;if(!['PAGE','BROWSER_UI'].includes(s.kind))return false;sid=s.parent;}
  return false;
 }
 call(method,params={},sessionId){
  const pageQuery=['Page.enable','Page.getFrameTree'].includes(method)&&sessionId===this.pageSession&&this.lineage()&&params&&Object.keys(params).length===0;
  if((!pageQuery&&!commandAllowed(method,params,!!sessionId))||sessionId!==undefined&&(typeof sessionId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(sessionId))){this.stop('COMMAND_REJECTED');return Promise.reject(Error('COMMAND_REJECTED'));}
  if(this.stopped)return Promise.reject(Error('DIAGNOSTIC_STOPPED'));
  if(method==='Target.createTarget'){if(this.createIssued){this.stop('EXTRA_TAB_REJECTED');return Promise.reject(Error('COMMAND_REJECTED'));}this.createIssued=true;}
  return new Promise((resolve,reject)=>{const id=++this.serial;const versionQuery=method==='Browser.getVersion';const timer=setTimeout(()=>{if(versionQuery){this.pending.delete(id);reject(Error('VERSION_TIMEOUT'));}else{this.stop('CDP_TIMEOUT');reject(Error('CDP_TIMEOUT'));}},2000);this.pending.set(id,{resolve,reject,timer,versionQuery});try{this.wire.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));}catch{this.stop('CONTROL_LOST');}});
 }
 async initializePage(){
  if(this.initializing||this.stopped||!this.lineage())return;
  this.initializing=true;this.record('PAGE_PROTOCOL_START','PAGE');
  try{
   await this.call('Page.enable',{},this.pageSession);
   const tree=await this.call('Page.getFrameTree',{},this.pageSession);
   if(tree.frameTree?.frame?.url!=='about:blank'||tree.frameTree.childFrames?.length){this.stop('BLANK_FRAME_MISMATCH');return;}
   this.pageInitialized=true;this.record('PAGE_PROTOCOL_READY','PAGE');this.stop('BLANK_PAGE_PROTOCOL_READY');
  }catch{if(!this.stopped)this.stop('PAGE_PROTOCOL_FAILED');}
 }
 async attach(m,k){
  const p=m.params,t=p.targetInfo,sid=p.sessionId,parent=m.sessionId||null;
  if(!p.waitingForDebugger){this.stop('TARGET_NOT_PAUSED');return;}
  if(!['PAGE','TAB','BROWSER_UI'].includes(k)){this.stop('AUXILIARY_TARGET_STOP');return;}
  if(typeof sid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(sid)||typeof t.targetId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(t.targetId)){this.stop('INVALID_SESSION');return;}
  if(this.sessions.has(sid)||[...this.sessions.values()].some(s=>s.target===t.targetId)){this.stop('PROTECTION_LOST');return;}
  if(parent&&!this.sessions.has(parent)){this.stop('PAGE_LINEAGE_REJECTED');return;}
  if(k==='TAB'){
   if(!this.createIssued||this.tabSession||parent){this.stop('EXTRA_TAB_REJECTED');return;}
   if(this.createdTab&&this.createdTab!==t.targetId){this.stop('TAB_BINDING_FAILED');return;}
   this.tabSession=sid;
  }
  if(k==='PAGE'){
   if(this.pageSession){this.stop('EXTRA_PAGE_REJECTED');return;}
   let ancestor=parent;while(ancestor&&this.sessions.get(ancestor)?.kind==='BROWSER_UI')ancestor=this.sessions.get(ancestor).parent;
   if(!ancestor||ancestor!==this.tabSession){this.stop('PAGE_LINEAGE_REJECTED');return;}
   if(t.url&&t.url!=='about:blank'){this.stop('BLANK_FRAME_MISMATCH');return;}
   this.pageSession=sid;
  }
  if(k==='BROWSER_UI'&&++this.uiSeen>4){this.stop('BROWSER_UI_LIMIT');return;}
  const s={kind:k,target:t.targetId,parent,ready:false};this.sessions.set(sid,s);
  // Only auto-attach metadata is sent to UI. It stays paused; the proxy stays deny-all.
  await this.call('Target.setAutoAttach',autoAttachParams(true),sid);s.ready=true;
  if(k==='BROWSER_UI'){this.uiCount++;this.record('BROWSER_UI_QUARANTINED',k);}
  await this.initializePage();
 }
 async receive(raw){
  if(this.stopped)return;
  try{
   if(typeof raw!=='string'||raw.length>262144){this.stop('INPUT_LIMIT');return;}
   const m=JSON.parse(raw);
   if(this.pending.has(m.id)){const p=this.pending.get(m.id);this.pending.delete(m.id);clearTimeout(p.timer);if(m.error){p.reject(Error(p.versionQuery?'VERSION_COMMAND_FAILED':'CDP_COMMAND_FAILED'));if(!p.versionQuery)this.stop('CDP_COMMAND_FAILED');}else p.resolve(m.result||{});return;}
   if(m.method==='Target.detachedFromTarget'&&this.sessions.has(m.params?.sessionId)||m.method==='Inspector.detached'||m.method==='Inspector.targetCrashed'){this.stop('PROTECTION_LOST');return;}
   if(m.method==='Target.targetDestroyed'&&[...this.sessions.values()].some(s=>s.target===m.params?.targetId)){this.stop('PROTECTION_LOST');return;}
   const labels={'Target.targetCreated':'CREATED','Target.targetInfoChanged':'INFO_CHANGED','Target.attachedToTarget':m.params?.waitingForDebugger?'ATTACHED_PAUSED':'ATTACHED_NOT_PAUSED'};
   if(Object.hasOwn(labels,m.method)){
    const t=m.params?.targetInfo,k=kindOf(t);this.record(labels[m.method],k);
    if(k.startsWith('TYPE_')){this.stop('TARGET_TYPE_UNCLASSIFIED');return;}
    const existing=[...this.sessions.values()].find(s=>s.target===t.targetId);
    if(existing&&(existing.kind!==k||k==='PAGE'&&t.url&&t.url!=='about:blank')){this.stop('PROTECTION_LOST');return;}
    if(m.method==='Target.attachedToTarget')await this.attach(m,k);
   }
  }catch{this.stop('PROTOCOL_OR_CAPTURE_FAILED');}
 }
 async readVersion(){
  try{
   const result=await this.call('Browser.getVersion');
   const product=result.product;
   if(product===undefined||product===null||product===''){this.browserVersion=freezeVersion({code:'VERSION_MISSING'});return;}
   const match=typeof product==='string'&&/^(?:Chrome|HeadlessChrome)\/(\d{1,10}\.\d{1,10}\.\d{1,10}\.\d{1,10})$/.exec(product);
   this.browserVersion=freezeVersion(match?{code:'VERSION_VERIFIED',version:match[1]}:{code:'VERSION_INVALID'});
  }catch(error){this.browserVersion=freezeVersion({code:['VERSION_TIMEOUT','VERSION_COMMAND_FAILED'].includes(error.message)?error.message:'VERSION_CONTROL_LOST'});}
 }
 async collect(){
  try{
   await this.call('Target.setAutoAttach',autoAttachParams());this.record('AUTOATTACH_READY');
   await this.readVersion();
   await this.call('Target.setDiscoverTargets',{discover:true});
   const snapshot=await this.call('Target.getTargets');
   for(const t of snapshot.targetInfos||[]){const k=kindOf(t);this.record('SNAPSHOT',k);if(k.startsWith('TYPE_'))this.stop('TARGET_TYPE_UNCLASSIFIED');}
   this.record('BLANK_CREATE_REQUEST');const made=await this.call('Target.createTarget',{url:'about:blank',forTab:true});
   if(typeof made.targetId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(made.targetId)){this.stop('TAB_BINDING_FAILED');return this.result();}
   this.createdTab=made.targetId;
   if(this.tabSession&&this.sessions.get(this.tabSession).target!==this.createdTab){this.stop('TAB_BINDING_FAILED');return this.result();}
   this.record('TAB_BOUND','TAB');await this.initializePage();
   for(let i=0;i<50&&!this.stopped;i++)await new Promise(r=>setTimeout(r,100));
   if(!this.stopped)this.stop('PAGE_NOT_OBSERVED');
   await Promise.allSettled([...this.tasks]);
  }catch{if(!this.stopped)this.stop('PROTOCOL_OR_CAPTURE_FAILED');}
  return this.result();
 }
 result(){return this.snapshot||{schema:2,kind:'isolated-cdp-startup-observation',code:this.code,sequence:this.sequence,site_navigations:0,outbound_forwarding:0,target_resumes:0,browser_ui_resumes:0,browser_ui_quarantined:this.uiCount,page_protocol_initialized:this.pageInitialized};}
 dispose(){if(!this.stopped)this.stop('CLEANUP');this.wire.close();}
}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
export async function main(){
 let profile,proxy,proc,observer,wire,tracked,observation;let code='BINARY_UNAVAILABLE';let sandbox=false;let spawnedError=false;
 const kill=()=>proc?.kill('SIGKILL');
 try{
  const executable=process.env.CHROME_PATH||'/opt/google/chrome/chrome';await access(executable,constants.X_OK);
  profile=await mkdtemp(join(tmpdir(),'cdp-observe-'));proxy=await denyProxy();code='CHROME_START_FAILED';
  proc=spawn(executable,['--headless=new','--no-startup-window','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-extensions','--disable-component-extensions-with-background-pages','--remote-debugging-port=0','--user-data-dir='+profile,'--proxy-server='+proxy.url,'--proxy-bypass-list=<-loopback>','--force-webrtc-ip-handling-policy=disable_non_proxied_udp'],{stdio:['ignore','ignore','pipe']});
  tracked=trackProcess(proc);
  proc.on('error',()=>{spawnedError=true;});let left=65536,tail='';proc.stderr.on('data',chunk=>{if(left<=0)return;const part=chunk.subarray(0,left);left-=part.length;const text=tail+part.toString('utf8');sandbox ||= /SUID sandbox helper|No usable sandbox|Failed to move to new namespace/i.test(text);tail=text.slice(-256);});
  let address;
  for(let i=0;i<100;i++){
   if(spawnedError||proc.exitCode!==null||proc.signalCode!==null)throw Error('START_FAILED');
   let text;try{text=await readFile(join(profile,'DevToolsActivePort'),'utf8');}catch{await pause(100);continue;}
   code='DEVTOOLS_FILE_INVALID';address=endpoint(text);break;
  }
  if(!address){code='DEVTOOLS_FILE_TIMEOUT';throw Error('TIMEOUT');}
  code='DEVTOOLS_WS_FAILED';wire=new WebSocket(address);
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{wire.close();reject(Error('TIMEOUT'));},3000);wire.onopen=()=>{clearTimeout(timer);resolve();};wire.onerror=()=>{clearTimeout(timer);reject(Error('CONNECTION_FAILED'));};});
  observer=new Observer(wire,kill);observation=await observer.collect();
 }catch{observation=observer?.result()||{schema:1,kind:'isolated-cdp-startup-observation',code:sandbox?'CHROME_SANDBOX_FAILED':code,sequence:[],site_navigations:0,outbound_forwarding:0,target_resumes:0};}
 const captured=freezeObservation(observation),capturedVersion=freezeVersion(observer?.browserVersion||{code:'VERSION_NOT_ATTEMPTED'});
 const cleanup=await cleanupDiagnostic({observer,wire,proc,tracked,proxy,profile,removeProfile:p=>rm(p,{recursive:true,force:true})});
 return finishObservation(captured,cleanup,capturedVersion);
}
if(process.argv[1]===new URL(import.meta.url).pathname){try{const result=await main();console.log(JSON.stringify(result));if(result.status!=='success')process.exitCode=1;}catch{console.log('{"kind":"isolated-cdp-startup-observation","code":"DIAGNOSTIC_INTERNAL_FAILED","status":"failed","site_navigations":0,"outbound_forwarding":0,"target_resumes":0}');process.exitCode=1;}}
