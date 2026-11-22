// Metadata-only repair. Existing120 entry is untouched; the dedicated240 entry reuses these parts.
import{safeFinal}from'./live-protocol.mjs';import{boundedCount,safeCount,safeCensus}from'./stop-census.mjs';
export const STOP_RECORD_MAX_BYTES=131072;
export const availability=o=>({first:o.samples?.first?'OBSERVED':'MISSING',end:o.samples?.end?'OBSERVED':'MISSING',document_relation:o.samples?.first&&o.samples?.end&&o.samples.same_document===true?'SAME_DOCUMENT':'UNKNOWN'});
export const presence=o=>Object.fromEntries([['console','console_error_count'],['exception','uncaught_count']].map(([label,key])=>[label,{notification:(o.passive_signals?.[key]??0)>0?'SCOPED_NOTIFICATION_OBSERVED':o.passive_signals?.coverage==='SCOPED_WINDOW_WITH_PRE_CONTEXT_GAP'?'NOT_OBSERVED_IN_SCOPED_WINDOW':'UNKNOWN',coverage:o.passive_signals?.coverage??'UNKNOWN_OR_NOT_ENABLED'}]));
export const denominators=Object.freeze({request_total:'COUNT_ELIGIBLE_BOUNDARY_CHECKS_MAIN_INCLUDED',census_received:'FETCH_PAUSE_MESSAGES_IN_OBSERVATION_WINDOW',before_first_limit:'EXCLUDES_THE_CROSSING_MESSAGE',first_limit_messages:'THE_ONE_FIRST_CROSSING_MESSAGE',post_stop:'RECEIVED_MESSAGES_NOT_POLICY_CHECKS',proxy:'NOT_HTTP_REQUEST_COUNTS'});
export const passiveBounds=o=>Object.fromEntries(['console_error_count','uncaught_count','unscoped_error_notifications','network_failure_count','after_stop_or_cleanup_notifications'].map(k=>{const n=o.passive_signals?.[k];return[k,n===undefined?{value:null,certainty:'UNKNOWN'}:{value:n,certainty:n===120?'AT_LEAST':'EXACT'}];}));
export function recordParts(input,census){try{
 const keys=['kind','status','score_saved','report_saved','phase','navigation_invocations','chrome','configuration','documents','http_status','html','total_requests','boundary_reason','samples','nuxt_error','passive_signals','stop_evidence','evidence','cleanup'];const raw={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(input,k);if(d){if(!Object.hasOwn(d,'value'))return null;raw[k]=d.value;}}
 if(raw.score_saved!==false||raw.report_saved!==false)return null;const total=boundedCount(raw.total_requests),legacy=total.certainty==='EXACT'&&total.value<=121?total.value:null,o=safeFinal({...raw,total_requests:legacy}),c=safeCensus(census);if(!o||!c)return null;
 return{observation:o,request_total:total,total_semantics:'BOUNDARY_CHECK_COUNTER_NOT_NETWORK_SENDS',census:c,denominators,error_presence:presence(o),passive_count_bounds:passiveBounds(o),sample_availability:availability(o),score_saved:false,report_saved:false};
 }catch{return null;}}
export function stoppedRecord(raw,census){const p=recordParts(raw,census);return p&&p.observation.status==='FAILED_OR_UNKNOWN'&&p.observation.evidence?.first_fatal?safeStoppedRecord({kind:'BOUNDED_STOP_RECORD_OFFLINE_CANDIDATE',status:'STOPPED_NOT_ADOPTED',...p}):null;}
export function safeStoppedRecord(v){try{
 if(v?.kind!=='BOUNDED_STOP_RECORD_OFFLINE_CANDIDATE'||v.status!=='STOPPED_NOT_ADOPTED'||v.score_saved!==false||v.report_saved!==false||v.total_semantics!=='BOUNDARY_CHECK_COUNTER_NOT_NETWORK_SENDS')return null;
 const o=safeFinal(v.observation),n=safeCount(v.request_total),c=safeCensus(v.census);if(!o||o.status!=='FAILED_OR_UNKNOWN'||!o.evidence?.first_fatal||!n||!c)return null;
 const legacy=n.certainty==='EXACT'&&n.value<=121?n.value:null;if(o.total_requests!==legacy)return null;
 const expected=availability(o),bounds=passiveBounds(o);if(JSON.stringify(v.denominators)!==JSON.stringify(denominators)||JSON.stringify(v.error_presence)!==JSON.stringify(presence(o)))return null;if(JSON.stringify(expected)!==JSON.stringify(v.sample_availability)||JSON.stringify(bounds)!==JSON.stringify(v.passive_count_bounds))return null;
 if(o.evidence.first_refusal&&o.boundary_reason!==o.evidence.first_refusal.category)return null;
 const mapped={complete:'COMPLETE',failed:'FAILED'}[o.cleanup];if(mapped&&o.evidence.cleanup!==mapped||o.cleanup==='unknown'&&!['UNKNOWN','NOT_STARTED','REQUESTED'].includes(o.evidence.cleanup))return null;
 if(c.first_limit&&n.certainty!=='UNKNOWN'&&n.value<c.first_limit.boundary_total.value)return null;
 const out={kind:'BOUNDED_STOP_RECORD_OFFLINE_CANDIDATE',status:'STOPPED_NOT_ADOPTED',observation:o,request_total:n,total_semantics:'BOUNDARY_CHECK_COUNTER_NOT_NETWORK_SENDS',census:c,denominators,error_presence:presence(o),passive_count_bounds:bounds,sample_availability:expected,score_saved:false,report_saved:false};
 if(Buffer.byteLength(JSON.stringify(out))>STOP_RECORD_MAX_BYTES)return null;return out;
 }catch{return null;}}
