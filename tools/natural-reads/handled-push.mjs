// Fixed bounded addition inside the existing pre-navigation probe.
// No live installer/CLI, binding, request, timer, page source read, or arbitrary source option.
import {createNuxtErrorProbe} from '../cdp-startup-diagnostic/nuxt-error-evidence.mjs';
import {TARGET} from './policy.mjs';
export const PUSH_MARKER='PB_NUXT_FIXED_V1:';
const classes=['TYPE_ERROR','REFERENCE_ERROR','SYNTAX_ERROR','RANGE_ERROR','ERROR','NUXT_OR_H3_ERROR','OTHER_OR_UNKNOWN'];
const sources=['APP_ERROR_HOOK','VUE_ERROR_HOOK','PAYLOAD_AT_READY'];
const MAX_PACKETS=18,MAX_EVENTS=16,MAX_PACKET_UNITS=512;
export function closedPushProbeSource(){
 let s=createNuxtErrorProbe.toString();
 const once=(a,b)=>{if(s.split(a).length!==2)throw Error('FIXED_PROBE_SOURCE_DRIFT');s=s.replace(a,b);};
 once('  // Captured at document-start, before target application code.',`  const pbDebug=typeof env.console?.debug==='function'?env.console.debug.bind(env.console):null,pbJson=JSON.stringify;
  let pbSeq=0,pbLost=false;
  const pbEmit=(stage,value)=>{if(!pbDebug||pbSeq>=18)return;try{const packet={kind:'NUXT_FIXED_PUSH_V1',seq:++pbSeq,stage,...value};pbDebug('PB_NUXT_FIXED_V1:'+pbJson(packet));}catch{pbLost=true;}};
  const pbLoss=reason=>{if(!pbLost){pbLost=true;pbEmit('LOSS',{reason});}};
  // Captured at document-start, before target application code.`);
 once("if (events.length >= 16) { overflow = true; return; }", "if (events.length >= 16) { overflow = true; pbLoss('EVENT_LIMIT'); return; }");
 const record="try { events.push(source === 'PAYLOAD_AT_READY' ? { source, ...payloadMeta(error), cause_detail: payloadCause(error) } : { source, ...project(error) }); } catch { failed = true; }";
 once(record,"try { const fixed=source === 'PAYLOAD_AT_READY' ? { source, ...payloadMeta(error), cause_detail: payloadCause(error) } : { source, ...project(error) };events.push(fixed);pbEmit('EVENT',{source:fixed.source,error_class:fixed.error_class,status_code:fixed.status_code}); } catch { failed = true; pbLoss('PROBE_UNOBSERVABLE'); }");
 once('const release = () => { for (const off', "const release = () => { if(failed)pbLoss('PROBE_UNOBSERVABLE');for (const off");
 once('        const error = app.payload?.error;', "        pbEmit('READY',{});\n        const error = app.payload?.error;");
 return s;
}
// The trusted case object is Node fixture ownership, never supplied in a page packet.
export function makeClosedCaseOwner(){return Object.freeze({kind:'CLOSED_NUXT_HANDLED_CASE'});}
export function createHandledPushCollector(g,caseOwner){
 if(!caseOwner||caseOwner.kind!=='CLOSED_NUXT_HANDLED_CASE')throw Error('CLOSED_CASE_REQUIRED');
 const primary=g.primary,session=g.sessions.get(primary),target=g.createdPage,frame=session?.frame;
 let loader=null,context=null,anchor=null,armed=false,lost=false,frozen=false,reason=null,lastSeq=0,gap=false,ready=false,received=0,unbound=0,late=0;
 const events=[];let frozenScope=null;
 const alive=()=>g.primary===primary&&g.createdPage===target&&g.sessions.get(primary)===session&&session?.ready===true&&session.frame===frame&&typeof frame==='string'&&!!frame&&typeof target==='string'&&!!target&&(!anchor||g.forward===anchor);
 const stop=why=>{if(!frozen){frozenScope=armed&&!!loader&&context!==null&&alive()&&!lost;reason??=why;frozen=true;}};
 const lose=why=>{lost=true;reason??=why;};
 return Object.freeze({
  arm(){if(armed||!alive()||g.stopping||g.stats.fatal){lose('UNCONFIRMED_OWNER');return false;}anchor=g.forward;armed=true;return true;},
  accepted(m,owner){
   if(frozen){if(m?.sessionId===primary&&m?.method==='Runtime.consoleAPICalled'&&m?.params?.type==='debug')late=Math.min(MAX_PACKETS,late+1);return;}
   if(owner!==caseOwner){lose('CASE_OWNER_MISMATCH');return;}
   if(!alive()){lose('UNCONFIRMED_OWNER');return;}
   if(m?.sessionId!==primary)return;
   const p=m.params||{};
   if(frozen||g.stopping||g.stats.fatal){if(m.method==='Runtime.consoleAPICalled'&&p.type==='debug')late=Math.min(MAX_PACKETS,late+1);return;}
   if(!armed)return;
   if(m.method==='Page.frameNavigated'&&p.frame?.id===frame&&!p.frame.parentId){if(p.frame.url!==TARGET||typeof p.frame.loaderId!=='string'||!p.frame.loaderId||loader&&loader!==p.frame.loaderId){lose('DOCUMENT_SCOPE_LOST');return;}loader=p.frame.loaderId;context=null;}
   if(m.method==='Runtime.executionContextCreated'&&p.context?.auxData?.frameId===frame&&p.context.auxData.isDefault===true&&Number.isInteger(p.context.id)){if(!loader){gap=true;return;}if(context!==null&&context!==p.context.id){lose('CONTEXT_SCOPE_LOST');return;}context=p.context.id;}
   if(m.method==='Runtime.executionContextsCleared'||m.method==='Runtime.executionContextDestroyed'&&p.executionContextId===context){context=null;lose('CONTEXT_SCOPE_LOST');return;}
   if(m.method!=='Runtime.consoleAPICalled'||p.type!=='debug'||!Array.isArray(p.args)||p.args.length!==1||p.args[0]?.type!=='string')return;
   const text=p.args[0].value;if(typeof text!=='string'||!text.startsWith(PUSH_MARKER))return;
   received=Math.min(MAX_PACKETS+1,received+1);if(received>MAX_PACKETS){lose('PACKET_BUDGET');return;}
   if(!loader||context===null||p.executionContextId!==context||lost){unbound=Math.min(MAX_PACKETS,unbound+1);gap=true;return;}
   if(text.length>MAX_PACKET_UNITS){lose('PACKET_SIZE');return;}
   let v;try{v=JSON.parse(text.slice(PUSH_MARKER.length));}catch{lose('INVALID_FIXED_PACKET');return;}
   const exact=keys=>Object.keys(v).sort().join(',')===keys.sort().join(',');
   if(v.kind!=='NUXT_FIXED_PUSH_V1'||!Number.isInteger(v.seq)||v.seq<1||v.seq>MAX_PACKETS||v.seq<=lastSeq){lose('INVALID_SEQUENCE');return;}
   gap ||=v.seq!==lastSeq+1;lastSeq=v.seq;
   if(v.stage==='READY'&&exact(['kind','seq','stage']))ready=true;
   else if(v.stage==='EVENT'&&exact(['kind','seq','stage','source','error_class','status_code'])&&sources.includes(v.source)&&classes.includes(v.error_class)&&(v.status_code===null||Number.isInteger(v.status_code)&&v.status_code>=400&&v.status_code<=599)){
    if(events.length>=MAX_EVENTS){lose('EVENT_BUDGET');return;}events.push({source:v.source,error_class:v.error_class,status_code:v.status_code});
   }else if(v.stage==='LOSS'&&exact(['kind','seq','stage','reason'])&&['EVENT_LIMIT','PROBE_UNOBSERVABLE'].includes(v.reason))lose(v.reason);
   else lose('INVALID_FIXED_PACKET');
  },
  freeze(){stop('GUARD_STOP_OR_WINDOW_END');},
  snapshot(){const bound=frozen?frozenScope:armed&&!!loader&&context!==null&&alive()&&!lost;return{kind:'FIXED_HANDLED_NUXT_CAPTURE',status:lost||events.length>0&&!bound?'UNKNOWN_WITH_PRESERVED_RECORDS':events.some(e=>e.status_code!==null)?'REPORTED_ERROR_WITH_GAPS':'UNKNOWN_NO_REPORTED_ERROR',scope:bound?'PRIMARY_FRAME_CONTEXT_OBSERVED':'UNKNOWN',reason,registration_packet_observed:ready,events:events.map(e=>({...e})),sequence_gap:gap,received_packets:Math.min(MAX_PACKETS,received),packet_budget_exceeded:received>MAX_PACKETS,unbound_packets:unbound,after_stop_debug_notifications:late,frozen,pre_ready_gap:true,source_authenticity:'PROBE_OR_PAGE_REPORTED_NOT_AUTHENTICATED_SOURCE',channel:'LOCAL_DIAGNOSTIC_DEBUG_CDP_NOT_EXTERNAL_TELEMETRY',additional_cdp_calls:0,additional_scripts:0,score_saved:false,report_saved:false};}
 });
}

// Fixed projection used at child, parent and admission boundaries.
export function safeHandledCapture(v){try{
 const reasons=[null,'CASE_OWNER_MISMATCH','UNCONFIRMED_OWNER','DOCUMENT_SCOPE_LOST','CONTEXT_SCOPE_LOST','PACKET_BUDGET','PACKET_SIZE','INVALID_FIXED_PACKET','INVALID_SEQUENCE','EVENT_BUDGET','EVENT_LIMIT','PROBE_UNOBSERVABLE','GUARD_STOP_OR_WINDOW_END'];
 if(v?.kind!=='FIXED_HANDLED_NUXT_CAPTURE'||!['UNKNOWN_WITH_PRESERVED_RECORDS','REPORTED_ERROR_WITH_GAPS','UNKNOWN_NO_REPORTED_ERROR'].includes(v.status)||!['PRIMARY_FRAME_CONTEXT_OBSERVED','UNKNOWN'].includes(v.scope)||!reasons.includes(v.reason)||!Array.isArray(v.events)||v.events.length>16)return null;
 const bool=k=>{if(typeof v[k]!=='boolean')throw Error();return v[k];},count=k=>{if(!Number.isInteger(v[k])||v[k]<0||v[k]>18)throw Error();return v[k];};
 const events=v.events.map(e=>{if(!sources.includes(e.source)||!classes.includes(e.error_class)||e.status_code!==null&&(!Number.isInteger(e.status_code)||e.status_code<400||e.status_code>599))throw Error();return{source:e.source,error_class:e.error_class,status_code:e.status_code};});
 if(v.status==='REPORTED_ERROR_WITH_GAPS'&&!events.some(e=>e.status_code!==null)||v.status==='UNKNOWN_NO_REPORTED_ERROR'&&events.some(e=>e.status_code!==null))return null;
 if(v.pre_ready_gap!==true||v.source_authenticity!=='PROBE_OR_PAGE_REPORTED_NOT_AUTHENTICATED_SOURCE'||v.channel!=='LOCAL_DIAGNOSTIC_DEBUG_CDP_NOT_EXTERNAL_TELEMETRY'||v.additional_cdp_calls!==0||v.additional_scripts!==0||v.score_saved!==false||v.report_saved!==false)return null;
 if(v.events.length>v.received_packets||v.unbound_packets>v.received_packets||v.registration_packet_observed&&v.received_packets<1||v.packet_budget_exceeded&&v.received_packets!==18)return null;
 const out={kind:v.kind,status:v.status,scope:v.scope,reason:v.reason,registration_packet_observed:bool('registration_packet_observed'),events,sequence_gap:bool('sequence_gap'),received_packets:count('received_packets'),packet_budget_exceeded:bool('packet_budget_exceeded'),unbound_packets:count('unbound_packets'),after_stop_debug_notifications:count('after_stop_debug_notifications'),frozen:bool('frozen'),pre_ready_gap:true,source_authenticity:v.source_authenticity,channel:v.channel,additional_cdp_calls:0,additional_scripts:0,score_saved:false,report_saved:false};return Buffer.byteLength(JSON.stringify(out))<=8192?out:null;
 }catch{return null;}}
