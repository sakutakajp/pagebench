// Observation only. Private correlation data never appear in snapshots.
const MAX_EVENTS=64,MAX_PENDING=64,MAX_COUNT=255;
const KINDS=new Set(['TRACE_START','TRACE_END','TRACE_READ','SCRIPT_SOURCE']);
const EVENTS=new Set(['TRACE_START_SENT','TRACE_START_COMPLETE','TRACE_START_ERROR','TRACE_END_SENT','TRACE_END_COMPLETE','TRACE_END_ERROR','STREAM_READY','TRACE_READ_SENT','TRACE_READ_COMPLETE','TRACE_READ_ERROR','SCRIPT_SOURCE_SENT','SCRIPT_SOURCE_COMPLETE','SCRIPT_SOURCE_ERROR','UNSCOPED_IO_READ_SENT','UNMATCHED_REPLY','INVALID_REPLY','INVALID_COMMAND','INVALID_STREAM','GUARD_STOP']);
const LIMITATIONS=new Set(['INTERNAL_ENUM','COUNT_LIMIT','BUFFER_LIMIT','INVALID_COMMAND','PENDING_LIMIT','DUPLICATE_COMMAND','TRACE_PROVENANCE','SEND_FAILED','DUPLICATE_REPLY','INVALID_REPLY','UNMATCHED_REPLY','INTERNAL_ERROR']);
const valid=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(s);
const key=(session,id)=>JSON.stringify([session,id]);
export class CdpStageJournal{
 #pending=new Map();#trace=null;#terminal=null;
 constructor(){this.events=[];this.counts={};this.n=0;this.complete=true;this.limitation=null;this.cleaning=false;this.stopped=false;this.cleanupCallbacks=0;this.cleanupLimited=false;this.cleanupGuardStop=false;}
 limit(code){this.complete=false;this.limitation??=LIMITATIONS.has(code)?code:'INTERNAL_ERROR';}
 mark(event){if(!EVENTS.has(event)){this.limit('INTERNAL_ENUM');return;}const previous=this.counts[event]||0;if(previous===MAX_COUNT){this.limit('COUNT_LIMIT');return;}this.counts[event]=previous+1;this.n=Math.min(this.n+1,MAX_COUNT);if(this.events.length<MAX_EVENTS)this.events.push({sequence:this.events.length+1,event});else this.limit('BUFFER_LIMIT');}
 begin(m,trusted){
  if(this.cleaning||this.stopped||!trusted)return null;
  let kind;
  if(m.method==='Tracing.start')kind='TRACE_START';
  else if(m.method==='Tracing.end')kind='TRACE_END';
  else if(m.method==='Debugger.getScriptSource')kind='SCRIPT_SOURCE';
  else if(m.method==='IO.read'){
   if(this.#trace?.ready&&m.sessionId===this.#trace.session&&m.params?.handle===this.#trace.handle)kind='TRACE_READ';
   else return{unscoped:true};
  }else return null;
  if(!valid(m.sessionId)||!Number.isSafeInteger(m.id)||m.id<1){this.mark('INVALID_COMMAND');this.limit('INVALID_COMMAND');return null;}
  const k=key(m.sessionId,m.id);
  if(this.#pending.size>=MAX_PENDING){this.limit('PENDING_LIMIT');return null;}
  if(this.#pending.has(k)){this.limit('DUPLICATE_COMMAND');return null;}
  const entry={kind,session:m.sessionId,id:m.id,sent:false,reply:null};
  if(kind==='TRACE_START'){
   if(this.#trace||m.params?.transferMode!=='ReturnAsStream'){this.limit('TRACE_PROVENANCE');entry.traceOwner=false;}
   else{this.#trace={session:m.sessionId,startOk:false,endSent:false,endPrepared:false,ready:false,handle:null,eventSeen:false};entry.traceOwner=true;}
  }
  if(kind==='TRACE_END'){
   entry.traceOwner=!!this.#trace&&this.#trace.session===m.sessionId&&this.#trace.startOk&&!this.#trace.endPrepared;
   if(entry.traceOwner)this.#trace.endPrepared=true;
   if(!entry.traceOwner)this.limit('TRACE_PROVENANCE');
  }
  this.#pending.set(k,entry);return entry;
 }
 sent(entry){
  if(!entry||this.cleaning||this.stopped)return;
  if(entry.unscoped){this.mark('UNSCOPED_IO_READ_SENT');return;}
  if(this.#pending.get(key(entry.session,entry.id))!==entry)return;
  entry.sent=true;this.mark(entry.kind+'_SENT');
  if(entry.kind==='TRACE_END'&&entry.traceOwner){this.#trace.endSent=true;this.ready();}
  if(entry.reply!==null)this.finish(entry);
 }
 cancel(entry){if(!entry||entry.unscoped)return;this.#pending.delete(key(entry.session,entry.id));this.limit('SEND_FAILED');}
 reply(m){
  if(this.cleaning){this.afterCleanup();return;}if(this.stopped)return;
  if(!Number.isSafeInteger(m.id)||!valid(m.sessionId))return;
  const entry=this.#pending.get(key(m.sessionId,m.id));
  if(!entry){if([...this.#pending.values()].some(p=>p.id===m.id)){this.mark('UNMATCHED_REPLY');this.limit('UNMATCHED_REPLY');}return;}
  if(entry.reply!==null){this.mark('INVALID_REPLY');this.limit('DUPLICATE_REPLY');return;}
  if(m.error!==undefined)entry.reply=false;
  else if(m.result&&typeof m.result==='object'&&!Array.isArray(m.result))entry.reply=true;
  else{this.mark('INVALID_REPLY');this.limit('INVALID_REPLY');return;}
  if(entry.sent)this.finish(entry);
 }
 finish(entry){
  this.mark(entry.kind+(entry.reply?'_COMPLETE':'_ERROR'));this.#pending.delete(key(entry.session,entry.id));
  if(entry.kind==='TRACE_START'&&entry.traceOwner){this.#trace.startOk=entry.reply;if(!entry.reply)this.limit('TRACE_PROVENANCE');}
  if(entry.kind==='TRACE_END'&&entry.traceOwner&&!entry.reply){this.#trace.ready=false;this.limit('TRACE_PROVENANCE');}
 }
 event(m){
  if(this.cleaning){this.afterCleanup();return;}if(this.stopped||m.method!=='Tracing.tracingComplete')return;
  const t=this.#trace,p=m.params;
  if(!t||m.sessionId!==t.session||!t.startOk||!t.endPrepared||t.eventSeen||typeof p?.stream!=='string'||p.stream.length<1||p.stream.length>256||/[\x00-\x20]/.test(p.stream)||p.dataLossOccurred===true||p.traceFormat&&p.traceFormat!=='json'||p.streamCompression&&p.streamCompression!=='none'){
   this.mark('INVALID_STREAM');this.limit('TRACE_PROVENANCE');return;
  }
  // Retain this opaque handle only in private memory for exact outgoing matches.
  t.eventSeen=true;t.handle=p.stream;this.ready();
 }
 ready(){const t=this.#trace;if(t&&!t.ready&&t.startOk&&t.endSent&&t.eventSeen){t.ready=true;this.mark('STREAM_READY');}}
 afterCleanup(){if(this.cleanupCallbacks<MAX_COUNT)this.cleanupCallbacks++;else this.cleanupLimited=true;}
 outstanding(){const out={TRACE_START:0,TRACE_END:0,TRACE_READ:0,SCRIPT_SOURCE:0};for(const p of this.#pending.values())if(KINDS.has(p.kind))out[p.kind]++;return out;}
 capture(){return{observation:Object.keys(this.counts).some(k=>k!=='GUARD_STOP')?'OBSERVED':'NO_STAGE_LOG',complete:this.complete,limitation:this.limitation,events:this.events.map(e=>({...e})),counts:{...this.counts},outstanding:this.outstanding(),cause:'NOT_ATTRIBUTED',ordering_scope:'LOCAL_COMMIT_ORDER_NOT_CHROME_CAUSALITY'};}
 stop(){if(this.cleaning){this.cleanupGuardStop=true;return;}if(this.stopped)return;this.mark('GUARD_STOP');this.stopped=true;this.#terminal=this.capture();this.#pending.clear();this.#trace=null;}
 cleanup(){if(this.cleaning)return;this.#terminal??=this.capture();this.cleaning=true;this.#pending.clear();this.#trace=null;}
 snapshot(){const base=this.#terminal??this.capture();return structuredClone({...base,phase:this.cleaning?'CLEANUP':this.stopped?'STOPPED':'OBSERVING',cleanup_started:this.cleaning,cleanup_callbacks:this.cleanupCallbacks,cleanup_callbacks_saturated:this.cleanupLimited,cleanup_guard_stop:this.cleanupGuardStop,limits:{events:MAX_EVENTS,pending:MAX_PENDING,count:MAX_COUNT}});}
}
export function cdpStageSnapshot(journal){if(journal instanceof CdpStageJournal){try{return journal.snapshot();}catch{return{observation:'UNAVAILABLE',complete:false,limitation:'INTERNAL_ERROR',events:[],counts:{},outstanding:{TRACE_START:0,TRACE_END:0,TRACE_READ:0,SCRIPT_SOURCE:0},cause:'NOT_ATTRIBUTED'};}}return{observation:'NO_CONTEXT',complete:false,limitation:'NO_CONTEXT',events:[],counts:{},outstanding:{TRACE_START:0,TRACE_END:0,TRACE_READ:0,SCRIPT_SOURCE:0},cause:'NOT_ATTRIBUTED'};}
