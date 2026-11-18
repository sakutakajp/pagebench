// Serial real diagnostic invocations only; no navigation, forwarding or retry path.
import {main,freezeObservation} from './diagnostic.mjs';
import {freezeVersion,finishObservation} from './cleanup.mjs';
import {performance} from 'node:perf_hooks';
const CLEANUP_CODES=new Set(['NO_EARLY_TERMINATE_ERROR','EARLY_TERMINATE_FAILED','OBSERVER_DISPOSED','OBSERVER_DISPOSE_FAILED','NO_OBSERVER','WIRE_CLOSED','WIRE_CLOSE_FAILED','NO_WIRE','PROCESS_ALREADY_EXITED','PROCESS_STOP_REQUESTED','PROCESS_KILL_FAILED','PROCESS_EXIT_CONFIRMED','PROCESS_EXIT_TIMEOUT','PROCESS_EXIT_FAILED','NO_PROCESS','PROXY_CLOSED','PROXY_CLOSE_FAILED','NO_PROXY','NO_PROFILE','PROFILE_HELD_PROCESS_UNCONFIRMED','PROFILE_DELETED','PROFILE_DELETE_FAILED']);
const STAGES=new Set(['EARLY_TERMINATE','OBSERVER_DISPOSE','WIRE_CLOSE','PROCESS_KILL','PROCESS_EXIT','PROXY_CLOSE','PROFILE_DELETE']);
const SAFETY_CODES=new Set(['CONTROL_LOST','COMMAND_REJECTED','INPUT_LIMIT','TARGET_NOT_PAUSED','INVALID_SESSION','PROTOCOL_OR_CAPTURE_FAILED','PROTECTION_LOST','OBSERVATION_INVALID','EVENT_LIMIT']);
export async function tenTrials(run=main,emit=()=>{},clock=()=>performance.now()){
 const attempts=[];let stopped=false;
 for(let n=1;n<=10;n++){
  const start=clock();let raw;
  try{raw=await run();}catch{const trial={attempt:n,status:'failed',code:'DIAGNOSTIC_INTERNAL_FAILED',elapsed_ms:Math.max(0,Math.round(clock()-start)),safety_stop:true};attempts.push(trial);emit(trial);stopped=true;break;}
  const observation=freezeObservation(raw),version=freezeVersion(raw?.browser_version);
  const validCleanup=Array.isArray(raw?.cleanup?.stages)&&['complete','failed'].includes(raw.cleanup.status)&&raw.cleanup.stages.length<=8&&raw.cleanup.stages.every(s=>STAGES.has(s?.stage)&&CLEANUP_CODES.has(s?.code));
  const cleanup=validCleanup?{status:raw.cleanup.status,stages:raw.cleanup.stages.map(s=>({stage:s.stage,code:s.code}))}:{status:'failed',stages:[]};
  // Never sanitize nonzero counters into an apparently safe zero.
  const unsafeCounters=['site_navigations','outbound_forwarding','target_resumes','browser_ui_resumes'].some(k=>raw?.[k]!==0);
  const safety_stop=unsafeCounters||!validCleanup||cleanup.status!=='complete'||SAFETY_CODES.has(observation.code);
  const result=finishObservation(observation,cleanup,version);
  const trial={attempt:n,...result,status:safety_stop?'failed':result.status,elapsed_ms:Math.max(0,Math.round(clock()-start)),safety_stop,...(unsafeCounters?{safety_code:'SAFETY_COUNTER_INVALID'}:!validCleanup?{safety_code:'CLEANUP_INVALID'}:{})};
  attempts.push(trial);emit(trial);if(safety_stop){stopped=true;break;}
 }
 const succeeded=attempts.filter(a=>a.status==='success').length;
 const summary={kind:'isolated-cdp-ten-trials',planned:10,attempted:attempts.length,succeeded,failed:attempts.length-succeeded,pending:10-attempts.length,terminal_status:stopped?'SAFETY_STOP':succeeded===10?'ALL_PASSED':'COMPLETED_WITH_FAILURES'};
 emit(summary);return summary;
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 const {appendFile}=await import('node:fs/promises');const records=[];
 const summary=await tenTrials(main,r=>{const text=JSON.stringify(r);records.push(text);console.log(text);});
 if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,'```json\n'+records.join('\n')+'\n```\n');
 if(summary.terminal_status!=='ALL_PASSED')process.exitCode=1;
}
