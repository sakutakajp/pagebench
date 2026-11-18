// Fixed enums/booleans only. Never expose stderr, websocket addresses or exception text.
export const PHASES=['BINARY_ACCESS','PROFILE_SETUP','CHROME_SPAWN','DEVTOOLS_FILE','DEVTOOLS_WEBSOCKET','CDP_BOOTSTRAP','PUPPETEER_CONNECT','INITIAL_TARGET','READY'];
export class StartupError extends Error{constructor(startup){super('STARTUP_FAILED');this.startup=JSON.parse(JSON.stringify(startup));}}
export function evidence(){return {phase:'BINARY_ACCESS',code:null,guard_step:null,guard_failure:null,target_rejection:null,binary_executable:false,chrome_version:null,chrome_running:null,devtools_file_valid:false,devtools_listening:false,sandbox_error:false,dependency_error:false,exit_code:null,signalled:false};}
export function classifyStderr(text,out){
 out.devtools_listening ||= /DevTools listening on ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\//.test(text);
 out.sandbox_error ||= /SUID sandbox helper|setuid sandbox helper|No usable sandbox|Failed to move to new namespace/i.test(text);
 out.dependency_error ||= /error while loading shared libraries|symbol lookup error/i.test(text);
}
export function parseDevtools(text){
 if(typeof text!=='string'||text.length>512)throw Error('DEVTOOLS_FILE_INVALID');
 const m=/^(\d{1,5})\n(\/devtools\/browser\/[a-f0-9-]{36})\n?$/i.exec(text);
 if(!m||Number(m[1])<1||Number(m[1])>65535)throw Error('DEVTOOLS_FILE_INVALID');
 return 'ws://127.0.0.1:'+Number(m[1])+m[2];
}
export async function waitDevtools(proc,load,pause,out,{attempts=100,spawnFailed=()=>false}={}){
 for(let i=0;i<attempts;i++){
  out.exit_code=proc.exitCode;out.signalled=proc.signalCode!==null;out.chrome_running=proc.exitCode===null&&proc.signalCode===null&&!spawnFailed();
  if(!out.chrome_running){out.code=spawnFailed()?'CHROME_SPAWN_FAILED':out.sandbox_error?'CHROME_EXIT_SANDBOX':out.dependency_error?'CHROME_EXIT_DEPENDENCY':'CHROME_EXIT_OTHER';throw new StartupError(out);}
  let text;try{text=await load();}catch{await pause(100);continue;}
  try{const url=parseDevtools(text);out.devtools_file_valid=true;return url;}catch{out.code='DEVTOOLS_FILE_INVALID';throw new StartupError(out);}
 }
 out.code='DEVTOOLS_FILE_TIMEOUT';throw new StartupError(out);
}
export async function bounded(task,ms,code){let timer;try{return await Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(code)),ms);})]);}finally{clearTimeout(timer);}}
export function fixedCode(error,phase){
 const codes={BINARY_ACCESS:['BINARY_UNAVAILABLE'],PROFILE_SETUP:['PROFILE_SETUP_FAILED'],CHROME_SPAWN:['CHROME_SPAWN_FAILED'],DEVTOOLS_FILE:['DEVTOOLS_FILE_TIMEOUT','DEVTOOLS_FILE_INVALID','CHROME_EXIT_SANDBOX','CHROME_EXIT_DEPENDENCY','CHROME_EXIT_OTHER','CHROME_SPAWN_FAILED'],DEVTOOLS_WEBSOCKET:['DEVTOOLS_WS_TIMEOUT','DEVTOOLS_WS_FAILED'],CDP_BOOTSTRAP:['CDP_BOOTSTRAP_FAILED'],PUPPETEER_CONNECT:['PUPPETEER_CONNECT_TIMEOUT','PUPPETEER_CONNECT_FAILED'],INITIAL_TARGET:['INITIAL_TARGET_TIMEOUT','INITIAL_TARGET_GUARD_FAILED']};
 return codes[phase]?.includes(error?.message)?error.message:(codes[phase]?.at(-1)||'STARTUP_FAILED');
}
