// Cleanup never substitutes exception text for the captured observation.
export function trackProcess(proc){
 const state={proc,closed:false};if(proc)proc.once('close',()=>{state.closed=true;});return state;
}
export async function waitClosed(state,ms=3000){
 if(!state)return false;
 if(!state.proc||state.closed||!state.proc.pid)return true;
 return new Promise(resolve=>{const finish=value=>{clearTimeout(timer);state.proc.removeListener('close',closed);resolve(value);};const closed=()=>finish(true);const timer=setTimeout(()=>finish(false),ms);state.proc.once('close',closed);if(state.closed)finish(true);});
}
export async function cleanupDiagnostic(r,hooks={}){
 const stages=[];if(r.observer)stages.push({stage:'EARLY_TERMINATE',code:r.observer.terminationFailed?'EARLY_TERMINATE_FAILED':'NO_EARLY_TERMINATE_ERROR'});let exitConfirmed=!r.proc?.pid;
 const attempt=async(stage,fn,ok,failed)=>{try{await fn();stages.push({stage,code:ok});}catch{stages.push({stage,code:failed});}};
 if(r.observer)await attempt('OBSERVER_DISPOSE',hooks.disposeObserver||(()=>r.observer.dispose()),'OBSERVER_DISPOSED','OBSERVER_DISPOSE_FAILED');else stages.push({stage:'OBSERVER_DISPOSE',code:'NO_OBSERVER'});
 if(r.wire)await attempt('WIRE_CLOSE',hooks.closeWire||(()=>r.wire.close()),'WIRE_CLOSED','WIRE_CLOSE_FAILED');else stages.push({stage:'WIRE_CLOSE',code:'NO_WIRE'});
 if(r.proc?.pid){
  if(!hooks.stopProcess&&(r.proc.exitCode!==null||r.proc.signalCode!==null))stages.push({stage:'PROCESS_KILL',code:'PROCESS_ALREADY_EXITED'});
  else await attempt('PROCESS_KILL',hooks.stopProcess||(()=>{if(r.proc.exitCode===null&&r.proc.signalCode===null)r.proc.kill('SIGKILL');}),'PROCESS_STOP_REQUESTED','PROCESS_KILL_FAILED');
  try{exitConfirmed=await(hooks.waitExit||(()=>waitClosed(r.tracked)))();stages.push({stage:'PROCESS_EXIT',code:exitConfirmed?'PROCESS_EXIT_CONFIRMED':'PROCESS_EXIT_TIMEOUT'});}catch{exitConfirmed=false;stages.push({stage:'PROCESS_EXIT',code:'PROCESS_EXIT_FAILED'});}
 }else stages.push({stage:'PROCESS_EXIT',code:'NO_PROCESS'});
 if(r.proxy)await attempt('PROXY_CLOSE',hooks.closeProxy||(()=>r.proxy.close()),'PROXY_CLOSED','PROXY_CLOSE_FAILED');else stages.push({stage:'PROXY_CLOSE',code:'NO_PROXY'});
 if(!r.profile)stages.push({stage:'PROFILE_DELETE',code:'NO_PROFILE'});
 else if(!exitConfirmed)stages.push({stage:'PROFILE_DELETE',code:'PROFILE_HELD_PROCESS_UNCONFIRMED'});
 else await attempt('PROFILE_DELETE',hooks.removeProfile||(()=>r.removeProfile(r.profile)),'PROFILE_DELETED','PROFILE_DELETE_FAILED');
 const failed=stages.some(s=>/FAILED|TIMEOUT|UNCONFIRMED/.test(s.code));return Object.freeze({status:failed?'failed':'complete',stages:Object.freeze(stages.map(s=>Object.freeze(s)))});
}
const VERSION_CODES=new Set(['VERSION_NOT_ATTEMPTED','VERSION_VERIFIED','VERSION_MISSING','VERSION_INVALID','VERSION_TIMEOUT','VERSION_COMMAND_FAILED','VERSION_CONTROL_LOST']);
export function freezeVersion(raw){
 const valid=raw?.code==='VERSION_VERIFIED'&&typeof raw.version==='string'&&/^\d{1,10}\.\d{1,10}\.\d{1,10}\.\d{1,10}$/.test(raw.version);
 const code=valid?'VERSION_VERIFIED':VERSION_CODES.has(raw?.code)&&raw.code!=='VERSION_VERIFIED'?raw.code:'VERSION_INVALID';
 return Object.freeze({code,version:valid?raw.version:null});
}
export function finishObservation(observation,cleanup,version){const browser_version=freezeVersion(version||{code:'VERSION_NOT_ATTEMPTED'});return Object.freeze({...observation,browser_version,status:observation.code==='BLANK_PAGE_PROTOCOL_READY'&&observation.page_protocol_initialized===true&&browser_version.code==='VERSION_VERIFIED'&&cleanup.status==='complete'?'success':'failed',cleanup});}
