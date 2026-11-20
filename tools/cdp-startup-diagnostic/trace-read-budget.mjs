// Bound only the stream exported by our own ReturnAsStream trace. No CDP input
// cap, network policy, Lighthouse parser, or generic IO command is changed.
const LIMITS=Object.freeze({chunk_bytes:65536,total_bytes:33554432,reads:1024,export_ms:10000});
const valid=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(s);
const key=m=>JSON.stringify([m.sessionId,m.id]);
export class TraceReadBudget{
 #state=null;#pending=new Map();#uncommitted=new Set();#done=new Set();#timer=null;#sealed=null;#final=null;
 constructor(fail,{now=()=>Date.now(),schedule=setTimeout,cancel=clearTimeout}={}){this.failGuard=fail;this.now=now;this.schedule=schedule;this.cancelTimer=cancel;this.phase='MEASURING';this.failure=null;this.reads=0;this.completed=0;this.bytes=0;this.late=0;}
 clearTimer(){if(this.#timer!==null){this.cancelTimer(this.#timer);this.#timer=null;}}
 reject(code){if(!this.failure)this.failure=code;this.clearTimer();this.failGuard(code);return null;}
 timeValid(){if(this.#state?.exportAt!==null&&this.#state&&this.now()-this.#state.exportAt>=LIMITS.export_ms){this.reject('TRACE_READ_DEADLINE');return false;}return!this.failure;}
 prepare(m,trusted){
  if(!trusted||this.failure)return{message:m,ticket:null};
  const state=this.#state;
  if(m.method==='Tracing.start'&&m.params?.transferMode==='ReturnAsStream'){
   if(this.phase!=='MEASURING'||state)return this.reject('TRACE_READ_PROVENANCE');
   if(!valid(m.sessionId)||!Number.isSafeInteger(m.id)||m.id<1)return this.reject('TRACE_READ_PROVENANCE');
   this.#state={session:m.sessionId,startOk:false,endIssued:false,endOk:false,eventSeen:false,handle:null,exportAt:null,eof:false,closeIssued:false,closed:false,decoder:new TextDecoder('utf-8',{fatal:true})};
   return this.track(m,'START');
  }
  if(!state||m.sessionId!==state.session)return{message:m,ticket:null};
  if(m.method==='Tracing.end'){
   if(this.phase!=='MEASURING'||!state.startOk||state.endIssued)return this.reject('TRACE_READ_PROVENANCE');
   state.endIssued=true;state.exportAt=this.now();this.#timer=this.schedule(()=>this.reject('TRACE_READ_DEADLINE'),LIMITS.export_ms);
   return this.track(m,'END');
  }
  if(!['IO.read','IO.close'].includes(m.method)||m.params?.handle!==state.handle||!state.eventSeen)return{message:m,ticket:null};
  if(m.method==='IO.close'){
   if(state.closeIssued)return this.reject('TRACE_READ_CLOSE_DUPLICATE');if([...this.#pending.values()].some(p=>p.kind==='READ'))return this.reject('TRACE_READ_CONCURRENT');state.closeIssued=true;return this.track(m,'CLOSE');
  }
  if(this.phase!=='MEASURING'||state.closeIssued||state.eof)return this.reject('TRACE_READ_AFTER_END');
  if(!this.timeValid())return null;
  if([...this.#pending.values()].some(p=>p.kind==='READ'))return this.reject('TRACE_READ_CONCURRENT');
  if(this.reads>=LIMITS.reads)return this.reject('TRACE_READ_COUNT_LIMIT');
  if(m.params.size!==undefined&&(!Number.isSafeInteger(m.params.size)||m.params.size<1))return this.reject('TRACE_READ_SIZE');
  if(m.params.offset!==undefined)return this.reject('TRACE_READ_OFFSET');
  this.reads++;
  const message={...m,params:{...m.params,size:Math.min(m.params.size??LIMITS.chunk_bytes,LIMITS.chunk_bytes)}};
  return this.track(message,'READ');
 }
 track(message,kind){
  if(!Number.isSafeInteger(message.id)||message.id<1||this.#pending.has(key(message))||this.#done.has(key(message))||this.#pending.size>=4||this.#uncommitted.size>=4)return this.reject('TRACE_READ_CORRELATION');
  const ticket={kind,key:key(message),committed:false,ok:false};this.#pending.set(ticket.key,ticket);this.#uncommitted.add(ticket);return{message,ticket};
 }
 sent(ticket){if(ticket){ticket.committed=true;this.#uncommitted.delete(ticket);this.finishIfClosed();}}
 reply(m){
  if(!this.#state)return;
  const k=key(m),ticket=this.#pending.get(k);
  if(!ticket){if(this.#done.has(k)){if(['SEALED','CLEANUP'].includes(this.phase)){this.late++;this.reject('TRACE_READ_LATE_EVENT');}else this.reject('TRACE_READ_DUPLICATE');}return;}
  if(!this.timeValid())return;
  if(m.error!==undefined||!m.result||typeof m.result!=='object'||Array.isArray(m.result)){this.reject('TRACE_READ_COMMAND_FAILED');return;}
  const state=this.#state;
  if(ticket.kind==='READ'){
   const result=m.result;
   if(typeof result.data!=='string'||typeof result.eof!=='boolean'||result.base64Encoded!==undefined&&typeof result.base64Encoded!=='boolean'||Object.keys(result).some(p=>!['data','eof','base64Encoded'].includes(p))){this.reject('TRACE_READ_RESPONSE');return;}
   let length;
   if(result.base64Encoded){
    if(result.data.length%4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(result.data)){this.reject('TRACE_READ_BASE64');return;}
    length=Buffer.byteLength(result.data,'base64');
   }else{
    if(!result.data.isWellFormed()){this.reject('TRACE_READ_UTF8');return;}length=Buffer.byteLength(result.data,'utf8');
   }
   if(length>LIMITS.chunk_bytes||this.bytes+length>LIMITS.total_bytes||length===0&&!result.eof){this.reject('TRACE_READ_BYTE_LIMIT');return;}
   const data=Buffer.from(result.data,result.base64Encoded?'base64':'utf8');
   try{state.decoder.decode(data,{stream:!result.eof});}catch{this.reject('TRACE_READ_UTF8');return;}
   this.bytes+=data.length;this.completed++;state.eof=result.eof;
  }
  if(ticket.kind==='START')state.startOk=true;
  if(ticket.kind==='END')state.endOk=true;
  if(ticket.kind==='CLOSE'){state.closed=true;state.handle=null;}
  ticket.ok=true;this.#pending.delete(k);this.#done.add(k);this.finishIfClosed();
 }
 event(m){
  const state=this.#state;if(!state||m.method!=='Tracing.tracingComplete'||m.sessionId!==state.session)return;
  if(this.phase!=='MEASURING'){this.late++;this.reject('TRACE_READ_LATE_EVENT');return;}
  const p=m.params;
  if(!state.startOk||!state.endIssued||state.eventSeen||typeof p?.stream!=='string'||p.stream.length<1||p.stream.length>256||/[\x00-\x20]/.test(p.stream)||p.dataLossOccurred===true||p.traceFormat&&p.traceFormat!=='json'||p.streamCompression&&p.streamCompression!=='none'){this.reject('TRACE_READ_PROVENANCE');return;}
  state.eventSeen=true;state.handle=p.stream;
 }
 finishIfClosed(){const s=this.#state;if(s?.closed&&s.eof&&s.endOk&&this.#pending.size===0&&this.#uncommitted.size===0)this.clearTimer();}
 adoptable(){if(this.#final)return this.#final.adoptable&&!this.failure&&this.late===0;const s=this.#state;return!this.failure&&(!s||s.startOk&&s.endOk&&s.eventSeen&&s.eof&&s.closed&&this.#pending.size===0&&this.#uncommitted.size===0&&this.reads>0&&this.reads===this.completed&&this.bytes>0);}
 seal(){if(this.#sealed||this.phase!=='MEASURING'||!this.adoptable())throw Error('TRACE_READ_INCOMPLETE');this.phase='SEALED';this.#sealed=Object.freeze(this.snapshot());return this.#sealed;}
 validSeal(proof){return proof===this.#sealed&&!this.failure&&this.late===0;}
 stop(){this.clearTimer();if((this.#state||this.#final?.observation==='OWN_TRACE')&&!this.failure)this.failure='GUARD_STOPPED';this.phase='STOPPED';}
 beginCleanup(){this.clearTimer();this.phase='CLEANUP';}
 dispose(){this.clearTimer();this.#final??=this.snapshot();this.#pending.clear();this.#uncommitted.clear();this.#done.clear();this.#state=null;}
 snapshot(){if(this.#final)return structuredClone({...this.#final,adoptable:this.adoptable(),phase:this.phase,failure:this.failure,late_events:this.late});return{observation:this.#state?'OWN_TRACE':'NOT_OBSERVED',adoptable:this.adoptable(),reads:this.reads,completed:this.completed,bytes:this.bytes,eof:this.#state?.eof??false,close_confirmed:this.#state?.closed??false,pending:this.#pending.size,uncommitted:this.#uncommitted.size,phase:this.phase,failure:this.failure,late_events:this.late,limits:{...LIMITS}};}
}
