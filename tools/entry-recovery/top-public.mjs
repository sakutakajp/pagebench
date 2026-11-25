import {readProjection,projectReceipt} from '../public-top-diagnostic/project.mjs';
import {readJournal,validScope} from './signals.mjs';
import {fixedWrite} from './records.mjs';
import {join} from 'node:path';
export const TOP_PUBLIC='public-top-diagnostics.json';
export function topPublic(directory,identity){
 const s=validScope(identity),receipt=s?readProjection(directory,{sha:s.sha,run:s.run_id}):projectReceipt(null,null),signals=s?readJournal(directory,s):{state:'UNBOUND_SCOPE',value:null};let agreement='UNKNOWN';
 const j=signals.value;
 if(j?.phase==='PRODUCER_RETURNED'&&receipt.receipt_state==='VALID_FIXED_SCHEMA_ONLY'){
  const states={PASSED:'passed',FAILED:'failed',NOT_RUN:'not_run'};
  const complete=j.cases.every(c=>states[c.case_status]);
  if(complete&&j.producer_status!=='UNKNOWN')agreement=j.cases.every((c,i)=>states[c.case_status]===receipt.cases[i].status)&&j.producer_status===(receipt.top_status==='RECEIPT_PASSED'?'PASSED':'FAILED')?'MATCH_FIXED_CASE_FIELDS_ONLY':'MISMATCH';
 }
 return{kind:'PUBLIC_CLOSED_TOP_CASE_DIAGNOSTIC',scope:s,receipt,signals,agreement,authority:'DIAGNOSTIC_ONLY_NEVER_LIVE_ADMISSION',sample_evidence:'EXISTING_POST_FCP_ASYNC_SAMPLE_NOT_FCP_ITSELF_OR_PIXEL_PROOF',hook_evidence:'PROBE_REPORTED_NOT_INDEPENDENT_EXCEPTION_OR_CAUSALITY',version_evidence:'ORIGINAL_PRODUCER_FIELDS_NOT_A_SEPARATE_VERSION_COMMAND',live_page_evidence:false,score_status:'NOT_MEASURED_NO_LIGHTHOUSE_ON_THIS_PATH',score_saved:false,report_saved:false};
}
export function publishTop(directory,identity){const out=topPublic(directory,identity);fixedWrite(out,join(directory,TOP_PUBLIC),65536);return out;}
