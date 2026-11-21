// Observation only. Existing transport validation runs BEFORE this wire hook.
// No incoming raw packet is parsed here; forward() receives accepted messages.
const NUM=['width','height','chars','headings'];
const REASONS=['PAIRED','NOT_REACHED','TRACE_NOT_CLOSED','BEFORE_TIMEOUT','AFTER_TIMEOUT','BEFORE_FAILED','AFTER_FAILED','INVALID_SAMPLE','PHASE_MISMATCH','NAVIGATION_CHANGED','DETACH_ERROR','DETACH_REPLY_SHAPE','DETACH_EVENT_OR_REPLY_MISSING','DUPLICATE_DETACH','CLEANUP_INCOMPLETE','SEND_FAILED','DETACH_REPLY_DUPLICATE','DETACH_EVENT_DUPLICATE','FORWARD_FAILED','GUARD_STOPPED','SCOPE_INVALID'];
const STATES=['NOT_REACHED','OBSERVED','UNAVAILABLE','INVALID_PAIR'];
const DISPLAYS=['NONE','CONTENTS','BLOCK','INLINE','INLINE_BLOCK','FLEX','GRID','MIXED','NO_HEADINGS','OTHER','UNKNOWN'];
const VIS=['VISIBLE','HIDDEN','COLLAPSE','MIXED','NO_HEADINGS','OTHER','UNKNOWN'];
const DELTA=['UNCHANGED','INCREASED','DECREASED'];
const BOOLS=['heading_box','heading_in_main','ancestor_none','ancestor_content_hidden','ancestor_hidden','closed_container','target_match'];
const one=(v,a,f)=>a.includes(v)?v:f;
function clean(record,phase){
 if(record?.phase!==phase)throw Error('PHASE_MISMATCH');
 if(!Array.isArray(record.binding)||record.binding.length!==4||!record.binding.every(v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,256}$/.test(v)))throw Error('INVALID_SAMPLE');
 const s=record.sample;if(!s||NUM.some(k=>!Number.isFinite(s[k])||s[k]<0||s[k]>10000000)||!Number.isInteger(s.chars)||!Number.isInteger(s.headings)||s.target_match!==true)throw Error('INVALID_SAMPLE');
 return{phase,binding:[...record.binding],sample:{...Object.fromEntries(NUM.map(k=>[k,s[k]])),...Object.fromEntries(BOOLS.map(k=>[k,typeof s[k]==='boolean'?s[k]:null])),own_display:one(s.own_display,DISPLAYS,'UNKNOWN'),own_visibility:one(s.own_visibility,VIS,'UNKNOWN')}};
}
function summary(r){const s=r.sample;return{width_nonzero:s.width>0,height_nonzero:s.height>0,body_text:s.chars>=20?'GE20':'LT20',headings:s.headings>=1?'PRESENT':'NONE',...Object.fromEntries(BOOLS.map(k=>[k,s[k]])),own_display:s.own_display,own_visibility:s.own_visibility};}
const unavailable=(reason,status='UNAVAILABLE')=>({status,reason,before:null,after:null,changes:null,binding:'NOT_VERIFIED'});
export function pairDetachSamples(before,after){
 let a,b;try{a=clean(before,'BEFORE');b=clean(after,'AFTER');}catch(e){return unavailable(one(e.message,REASONS,'INVALID_SAMPLE'),'INVALID_PAIR');}
 if(a.binding.some((v,i)=>v!==b.binding[i]))return unavailable('NAVIGATION_CHANGED','INVALID_PAIR');
 const changes=Object.fromEntries(NUM.map(k=>[k,a.sample[k]===b.sample[k]?'UNCHANGED':a.sample[k]<b.sample[k]?'INCREASED':'DECREASED']));
 return{status:'OBSERVED',reason:'PAIRED',before:summary(a),after:summary(b),changes,binding:'SAME_TARGET_PRIMARY_FRAME_LOADER'};
}
export function safeDetachEvidence(v){
 if(v?.status!=='OBSERVED')return unavailable(one(v?.reason,REASONS,'NOT_REACHED'),one(v?.status,STATES,'NOT_REACHED'));
 if(v.reason!=='PAIRED'||v.binding!=='SAME_TARGET_PRIMARY_FRAME_LOADER'||v.before?.target_match!==true||v.after?.target_match!==true)return unavailable('INVALID_SAMPLE','INVALID_PAIR');
 const side=s=>{if(!s||!['GE20','LT20'].includes(s.body_text)||!['PRESENT','NONE'].includes(s.headings)||typeof s.width_nonzero!=='boolean'||typeof s.height_nonzero!=='boolean'||BOOLS.some(k=>s[k]!==null&&typeof s[k]!=='boolean')||!DISPLAYS.includes(s.own_display)||!VIS.includes(s.own_visibility))throw Error();return{width_nonzero:s.width_nonzero,height_nonzero:s.height_nonzero,body_text:s.body_text,headings:s.headings,...Object.fromEntries(BOOLS.map(k=>[k,s[k]])),own_display:s.own_display,own_visibility:s.own_visibility};};
 try{if(!v.changes||NUM.some(k=>!DELTA.includes(v.changes[k])))throw Error();if(v.before.body_text==='GE20'&&v.after.body_text==='LT20'&&v.changes.chars!=='DECREASED'||v.before.body_text==='LT20'&&v.after.body_text==='GE20'&&v.changes.chars!=='INCREASED')throw Error();return{status:'OBSERVED',reason:'PAIRED',before:side(v.before),after:side(v.after),changes:Object.fromEntries(NUM.map(k=>[k,v.changes[k]])),binding:'SAME_TARGET_PRIMARY_FRAME_LOADER'};}catch{return unavailable('INVALID_SAMPLE','INVALID_PAIR');}
}
// Self-contained serialized DOM function. No text, URL or arbitrary CSS returns.
export function sampleDetachDocument(target){
 const hs=Array.from(document.querySelectorAll('h1,h2'));const s={width:innerWidth,height:innerHeight,chars:document.body?.innerText.trim().length||0,headings:hs.length,target_match:location.href===target,heading_box:hs.some(h=>Array.from(h.getClientRects()).some(r=>r.width>0&&r.height>0)),heading_in_main:hs.some(h=>!!h.closest('main')),ancestor_none:false,ancestor_content_hidden:false,ancestor_hidden:false,closed_container:false,own_display:'NO_HEADINGS',own_visibility:'NO_HEADINGS'};
 try{
  if(hs.length>32)throw Error();const displays=new Set(),vis=new Set();
  const display=v=>({'none':'NONE','contents':'CONTENTS','block':'BLOCK','inline':'INLINE','inline-block':'INLINE_BLOCK','flex':'FLEX','grid':'GRID'})[v]||'OTHER';
  const visibility=v=>({'visible':'VISIBLE','hidden':'HIDDEN','collapse':'COLLAPSE'})[v]||'OTHER';
  for(const h of hs){let n=h,depth=0;const own=window.getComputedStyle(h);displays.add(display(own.display));vis.add(visibility(own.visibility));while(n){if(++depth>32)throw Error();const css=window.getComputedStyle(n);if(n!==h&&css.display==='none')s.ancestor_none=true;if(n!==h&&css.contentVisibility==='hidden')s.ancestor_content_hidden=true;if(n.hidden)s.ancestor_hidden=true;if(n.tagName==='DIALOG'&&!n.open)s.closed_container=true;if(n.tagName==='DETAILS'&&!n.open){const summary=n.querySelector(':scope > summary');if(!summary?.contains(h))s.closed_container=true;}n=n.parentElement;}}
  if(displays.size)s.own_display=displays.size===1?[...displays][0]:'MIXED';if(vis.size)s.own_visibility=vis.size===1?[...vis][0]:'MIXED';
 }catch{s.ancestor_none=null;s.ancestor_content_hidden=null;s.ancestor_hidden=null;s.closed_container=null;s.own_display='UNKNOWN';s.own_visibility='UNKNOWN';}
 return s;
}
export async function captureDetachSample(ctx,target,phase){
 const g=ctx.gateway,primary=g.primary,created=g.createdPage;
 const read=()=>g.call('Page.getFrameTree',{},primary);
 const a=(await read()).frameTree?.frame;
 const sample=await ctx.page.evaluate(sampleDetachDocument,target);
 const b=(await read()).frameTree?.frame;
 if(!a||!b||a.id!==b.id||a.loaderId!==b.loaderId||a.url!==target||b.url!==target||a.id!==g.sessions.get(primary)?.frame)throw Error('NAVIGATION_CHANGED');
 return{phase,binding:[created,primary,a.id,a.loaderId],sample};
}
export function installDetachEvidence(ctx,target,{capture=phase=>captureDetachSample(ctx,target,phase),timeoutMs=750}={}){
 const waitMs=Number.isFinite(timeoutMs)&&timeoutMs>0&&timeoutMs<=750?timeoutMs:750;
 const g=ctx.gateway,w=g.wire,send=w.send,forward=g.forward;
 let active=true,started=false,phase='IDLE',record=unavailable('NOT_REACHED','NOT_REACHED'),before=null,aux=null,id=null,ack=null,event=false,timer=null,scope=null;
 // Delayed work never inherits the earlier synchronous gateway authorization.
 const halted=()=>g.stopping||g.stats.fatal;
 const scopeValid=(detached=false)=>scope&&scope.primaryState&&scope.auxState&&typeof scope.primary==='string'&&typeof scope.target==='string'&&typeof scope.frame==='string'&&g.primary===scope.primary&&g.createdPage===scope.target&&g.sessions.get(scope.primary)===scope.primaryState&&scope.primaryState.ready===true&&!scope.primaryState.internalUI&&scope.primaryState.frame===scope.frame&&(!g.pageInfo||g.pageInfo.targetId===scope.target)&&(detached?!g.sessions.has(aux):g.sessions.get(aux)===scope.auxState&&scope.auxState.ready===true&&scope.auxState.auxiliary===true&&!scope.auxState.internalUI&&scope.auxState.frame===scope.frame);
 const rejectScope=()=>{ack=null;record=unavailable(halted()?'GUARD_STOPPED':'SCOPE_INVALID','INVALID_PAIR');phase='DONE';clearTimeout(timer);if(!halted())g.fail('PROTECTION_LOST');};
 const pass=m=>{if(!halted())return forward.call(g,m);};
 const release=()=>{const held=ack;ack=null;if(!held)return;if(halted()||!scopeValid(event)){rejectScope();return;}try{forward.call(g,held);}catch{record=unavailable('FORWARD_FAILED');g.fail('GATEWAY_INTERNAL_FAILED');}};
 const stop=(reason,status='UNAVAILABLE')=>{if(phase==='DONE'&&['UNAVAILABLE','INVALID_PAIR'].includes(record.status))return;clearTimeout(timer);record=unavailable(reason,status);phase='DONE';release();};
 const collect=async which=>{let t;try{return await Promise.race([capture(which),new Promise((_,reject)=>t=setTimeout(()=>reject(Error(which+'_TIMEOUT')),waitMs))]);}finally{clearTimeout(t);}};
 const transmit=raw=>{if(!active||halted()||!scopeValid()){rejectScope();return;}try{return send.call(w,raw);}catch{stop('SEND_FAILED');g.fail('CLIENT_COMMAND_FORMAT');}};
 const after=()=>{if(!active||phase!=='WAIT'||!ack||!event)return;if(halted()||!scopeValid(true)){rejectScope();return;}phase='AFTER';clearTimeout(timer);collect('AFTER').then(r=>{if(!active||phase!=='AFTER')return;if(halted()||!scopeValid(true)){rejectScope();return;}record=pairDetachSamples(before,r);phase='DONE';release();},e=>{if(active&&phase==='AFTER')stop(e.message==='NAVIGATION_CHANGED'?'NAVIGATION_CHANGED':e.message==='AFTER_TIMEOUT'?'AFTER_TIMEOUT':'AFTER_FAILED',e.message==='NAVIGATION_CHANGED'?'INVALID_PAIR':'UNAVAILABLE');});};
 w.send=function(raw){
  let m;try{if(typeof raw==='string'&&raw.length<4096)m=JSON.parse(raw);}catch{}
  const eligible=Number.isSafeInteger(m?.id)&&m.id>=0&&m.method==='Target.detachFromTarget'&&!m.sessionId&&g.sessions.get(m.params?.sessionId)?.auxiliary;
  if(halted())return;
  if(!active||!eligible)return send.call(w,raw);
  if(started){stop('DUPLICATE_DETACH','INVALID_PAIR');return send.call(w,raw);}started=true;
  const tr=g.traceReads?.snapshot();if(tr?.observation!=='OWN_TRACE'||tr.adoptable!==true||tr.eof!==true||tr.close_confirmed!==true||tr.pending!==0||tr.uncommitted!==0||tr.failure!==null||!(tr.reads>0)||tr.reads!==tr.completed||g.stats.fatal){stop('TRACE_NOT_CLOSED');return send.call(w,raw);}
  id=m.id;aux=m.params.sessionId;const primaryState=g.sessions.get(g.primary);
  scope={primary:g.primary,target:g.createdPage,primaryState,frame:primaryState?.frame,auxState:g.sessions.get(aux)};
  if(halted()||!scopeValid()){rejectScope();return;}phase='BEFORE';
  collect('BEFORE').then(r=>{
   if(!active||phase!=='BEFORE')return;
   try{before=clean(r,'BEFORE');}catch(e){stop(one(e.message,REASONS,'INVALID_SAMPLE'),'INVALID_PAIR');transmit(raw);return;}
   phase='WAIT';timer=setTimeout(()=>stop('DETACH_EVENT_OR_REPLY_MISSING'),waitMs);transmit(raw);
  },e=>{if(!active||phase!=='BEFORE')return;stop(e.message==='NAVIGATION_CHANGED'?'NAVIGATION_CHANGED':e.message==='BEFORE_TIMEOUT'?'BEFORE_TIMEOUT':'BEFORE_FAILED',e.message==='NAVIGATION_CHANGED'?'INVALID_PAIR':'UNAVAILABLE');transmit(raw);});
 };
 g.forward=function(m){
  if(halted()){if(active&&started)rejectScope();return;}
  if(active&&started&&['WAIT','AFTER'].includes(phase)){
   if(m.method==='Target.detachedFromTarget'&&m.params?.sessionId===aux){if(event){stop('DETACH_EVENT_DUPLICATE','INVALID_PAIR');return pass(m);}event=true;pass(m);after();return;}
   if(m.id===id&&!m.sessionId){
    if(ack){stop('DETACH_REPLY_DUPLICATE','INVALID_PAIR');return pass(m);}
    if(m.error){stop('DETACH_ERROR');return pass(m);}
    if(!m.result||typeof m.result!=='object'||Array.isArray(m.result)||Object.keys(m.result).length||Object.keys(m).some(k=>!['id','result'].includes(k))){stop('DETACH_REPLY_SHAPE');return pass(m);}
    ack=m;after();return;
   }
  }
  return pass(m);
 };
 return Object.freeze({snapshot:()=>safeDetachEvidence(record),dispose(){if(!active)return;active=false;if(phase!=='DONE'&&started)stop('CLEANUP_INCOMPLETE');clearTimeout(timer);release();w.send=send;g.forward=forward;before=null;aux=null;id=null;}});
}
