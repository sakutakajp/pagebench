// Closed-top proof only. No new browser calls, traffic policy, or result adoption.
import {topBrowserProof} from './top-browser.mjs';
import {TOP_CASES} from './top-memory.mjs';
import {superviseNatural} from './startup-parent.mjs';
import {safeStartupEvidence} from './startup-evidence.mjs';
import {saveParentFixed} from './live-entry.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';

const enums = {
  start_grant_callback: ['NOT_CONFIRMED','CALLBACK_ERROR','QUEUED_NOT_CONSUMPTION_PROOF'],
  ipc_progress: ['OBSERVED','NOT_OBSERVED'],
  disk_progress: ['VALID','MISSING','INVALID_OR_UNREADABLE'],
  final_message: ['OBSERVED','NOT_OBSERVED'],
  close_signal: ['SIGKILL','SIGTERM','SIGABRT','OTHER_SIGNAL','NO_SIGNAL'],
  group_signal: ['NOT_REQUESTED','SENT','GROUP_NOT_PRESENT','FAILED'],
  group_after_close: ['NOT_CHECKED','NOT_PRESENT','STILL_PRESENT_AT_SINGLE_PROBE','UNKNOWN'],
  physical_browser_cleanup: ['UNKNOWN','COMPLETE','NOT_STARTED','REQUESTED','FAILED'],
};
export function projectStartup(v) {
  try {
    if(v?.semantics!=='NODE_PROCESS_STARTUP_NOT_BROWSER_OR_NUXT_ERROR'||v.preload_gap!==true||typeof v.child_close_seen!=='boolean')return null;
    const c=v.capture;if(!['VALID','MISSING','INVALID_OR_UNREADABLE'].includes(c?.state))return null;
    const evidence=c.state==='VALID'?safeStartupEvidence(c.evidence):null;
    if(c.state==='VALID'&&!evidence||c.state!=='VALID'&&c.evidence!==null)return null;
    const out={capture:{state:c.state,evidence},semantics:v.semantics,preload_gap:true,
      error_presence:evidence?.first_error?'FIXED_NODE_ERROR_OBSERVED':'UNKNOWN_NO_RECORDED_NODE_ERROR',child_close_seen:v.child_close_seen};
    for(const [key,allowed]of Object.entries(enums)){if(!allowed.includes(v[key]))return null;out[key]=v[key];}
    return out;
  }catch{return null;}
}
export function startupComplete(v) {
  const s=projectStartup(v),e=s?.capture.evidence;
  return !!e&&e.first_error===null&&e.secondary_errors===0&&!e.overflow&&!e.recording_failed&&
    e.events.includes('PRELOAD_READY')&&e.last_phase==='PROCESS_EXIT'&&[0,1].includes(e.exit_code)&&
    s.child_close_seen&&s.close_signal==='NO_SIGNAL'&&s.group_signal==='NOT_REQUESTED'&&s.physical_browser_cleanup==='COMPLETE'&&s.final_message==='OBSERVED';
}
export function validateStartupTop(top) {
  if(top?.status!=='passed'||top.cases?.length!==TOP_CASES.length||top.cases.some((c,i)=>c.case!==TOP_CASES[i]||c.status!=='passed'||!startupComplete(c.result?.startup)||c.result.startup.capture.evidence.exit_code!==c.result.exit_code))throw Error('FIXED_STARTUP_GATE');
  return true;
}
export async function runStartupTop(options={}) {
  // The browser/page/guard code is the original runner. Only Node supervision changes.
  return topBrowserProof({run:mode=>superviseNatural(new URL('./startup-child.mjs',import.meta.url).pathname,[mode],{prerequisite:true,timeout:45000}),...options});
}
const reasons=['CHILD_EXIT_WITHOUT_FINAL','CHILD_TIMEOUT','INVALID_CHILD_PROTOCOL','GUARD_OR_CHILD_FAILURE','FIXED_OBSERVATION_COMPLETE'];
export function startupSummary(top,{sha,run,proofHash=null}={}) {
  const cases=TOP_CASES.map(name=>{
    const matches=Array.isArray(top?.cases)?top.cases.filter(c=>c?.case===name):[];
    const c=matches.length===1?matches[0]:null,r=c?.result;
    return {case:name,status:['passed','failed','not_run'].includes(c?.status)?c.status:'failed',
      parent_reason:reasons.includes(r?.reason)?r.reason:'UNKNOWN_OR_NOT_REACHED',
      startup:projectStartup(r?.startup),cleanup:['COMPLETE','UNKNOWN_OR_FAILED','UNKNOWN'].includes(r?.cleanup)?r.cleanup:'UNKNOWN'};
  });
  let valid=false;try{valid=validateStartupTop(top);}catch{}
  return {kind:'FIXED_CLOSED_NODE_STARTUP_PROOF',workflow_sha:/^[a-f0-9]{40}$/.test(sha||'')?sha:null,
    run_id:/^(?:[0-9]{1,24}|CLOSED_CONTRACT_NOT_ACTIONS)$/.test(run||'')?run:null,
    status:valid?'passed':'failed',cases,top_proof_sha256:/^[a-f0-9]{64}$/.test(proofHash||'')?proofHash:null,
    raw_stderr_captured:false,semantics:'NODE_PROCESS_NOT_BROWSER_CONSOLE_OR_NUXT_CAUSE',real_site_navigations:0,score_saved:false,report_saved:false};
}
export function persistStartupTop(top,{directory='.',sha=process.env.GITHUB_SHA,run=process.env.GITHUB_RUN_ID}={}) {
  // Fixed summary is saved FIRST, so an old closed-gate failure cannot erase it.
  const clean={...top,cases:(top?.cases??[]).map(c=>c.result?{...c,result:{...c.result,startup:projectStartup(c.result.startup)}}:c)};
  const text=JSON.stringify(clean);if(Buffer.byteLength(text)>1048576)throw Error('FIXED_TOP_PROOF_BUDGET');
  const summary=startupSummary(clean,{sha,run,proofHash:createHash('sha256').update(text).digest('hex')});
  const summaryPath=join(directory,'startup-closed-proof.json'),topPath=join(directory,'natural-top-closed-proof.json');
  saveParentFixed(summary,summaryPath);
  // Preserve the original proof output format and size behavior; data came only
  // from its existing trusted producer plus projectStartup's fixed reconstruction.
  writeFileSync(topPath,text,{flag:'wx',mode:0o600});
  const back=JSON.parse(readFileSync(summaryPath,'utf8')),proof=JSON.parse(readFileSync(topPath,'utf8'));
  if(JSON.stringify(back)!==JSON.stringify(summary)||JSON.stringify(proof)!==JSON.stringify(clean))throw Error('FIXED_READBACK');
  return {top:proof,summary:back};
}
export function validateStartupReceipt(top,receipt,{sha,run}) {
  const text=JSON.stringify(top),expected=startupSummary(top,{sha,run,proofHash:createHash('sha256').update(text).digest('hex')});
  if(expected.status!=='passed'||JSON.stringify(receipt)!==JSON.stringify(expected))throw Error('FIXED_STARTUP_RECEIPT');
  return validateStartupTop(top);
}
