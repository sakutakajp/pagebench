import{STAGING_REQUEST_LIMIT}from'./staging-limits.mjs';
// Fixed one-off profile. This changes only bounded reporting, never a permission.
import{recordParts,availability,presence,denominators,passiveBounds,STOP_RECORD_MAX_BYTES}from'./stop-record.mjs';import{safeFinal}from'./live-protocol.mjs';import{safeCount,safeCensus}from'./stop-census.mjs';
export function scoped240Record(raw,census){const p=recordParts(raw,census);if(!p)return null;return safeScoped240Record({kind:'FIXED_240_JA_DIAGNOSTIC_RECORD',policy_limit:STAGING_REQUEST_LIMIT,status:p.observation.status==='OBSERVED'?'OBSERVED_WINDOW_NO_SCORE':'STOPPED_OR_INCOMPLETE',...p});}
export function safeScoped240Record(v){try{
 if(v?.kind!=='FIXED_240_JA_DIAGNOSTIC_RECORD'||v.policy_limit!==STAGING_REQUEST_LIMIT||v.score_saved!==false||v.report_saved!==false||v.total_semantics!=='BOUNDARY_CHECK_COUNTER_NOT_NETWORK_SENDS')return null;
 const o=safeFinal(v.observation),n=safeCount(v.request_total),c=safeCensus(v.census);if(!o||!n||!c||!['OBSERVED_WINDOW_NO_SCORE','STOPPED_OR_INCOMPLETE'].includes(v.status))return null;
 if(o.total_requests!==(n.certainty==='EXACT'&&n.value<=121?n.value:null)||JSON.stringify(v.denominators)!==JSON.stringify(denominators)||JSON.stringify(v.error_presence)!==JSON.stringify(presence(o))||JSON.stringify(v.passive_count_bounds)!==JSON.stringify(passiveBounds(o))||JSON.stringify(v.sample_availability)!==JSON.stringify(availability(o)))return null;
 if(o.evidence?.first_refusal&&o.boundary_reason!==o.evidence.first_refusal.category)return null;
 if(c.first_limit&&(c.first_limit.boundary_total.certainty!=='EXACT'||c.first_limit.boundary_total.value!==STAGING_REQUEST_LIMIT+1||n.certainty!=='UNKNOWN'&&n.value<STAGING_REQUEST_LIMIT+1))return null;
 if(o.status==='OBSERVED'){if(v.status!=='OBSERVED_WINDOW_NO_SCORE'||n.certainty!=='EXACT'||n.value>STAGING_REQUEST_LIMIT||o.evidence?.first_fatal||o.cleanup!=='complete'||o.evidence?.cleanup!=='COMPLETE'||o.passive_signals?.coverage!=='SCOPED_WINDOW_WITH_PRE_CONTEXT_GAP'||!o.samples?.first||!o.samples?.end||o.samples.same_document!==true)return null;}
 else if(v.status!=='STOPPED_OR_INCOMPLETE')return null;
 const mapped={complete:'COMPLETE',failed:'FAILED'}[o.cleanup];if(mapped&&o.evidence?.cleanup!==mapped||o.cleanup==='unknown'&&!['UNKNOWN','NOT_STARTED','REQUESTED'].includes(o.evidence?.cleanup))return null;
 const out={kind:'FIXED_240_JA_DIAGNOSTIC_RECORD',policy_limit:STAGING_REQUEST_LIMIT,status:v.status,observation:o,request_total:n,total_semantics:v.total_semantics,census:c,denominators,error_presence:presence(o),passive_count_bounds:passiveBounds(o),sample_availability:availability(o),score_saved:false,report_saved:false};return Buffer.byteLength(JSON.stringify(out))<=STOP_RECORD_MAX_BYTES?out:null;
 }catch{return null;}}
