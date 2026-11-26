// Only Node builtins and the reviewed pure credential factory load before purge.
import{fileURLToPath}from'node:url';import{writeFileSync,renameSync}from'node:fs';
import{takeApiReader}from'../passive-html-beacon-auth/credential.mjs';
export async function bootstrap({env=process.env,transport=globalThis.fetch,load=async()=>({entry:await import('./entry.mjs'),admission:await import('./admission.mjs'),records:await import('./records.mjs')})}={}){
 const api=takeApiReader(env,transport); // Consumes and deletes step env before app/Git/children.
 const mode={'--admit-only':'PRECHECK','--closed-once':'JIT','--measure-once':'LIVE'}[process.argv[2]],state={kind:'SELECTED_BOOT_FIXED',mode:mode??'UNKNOWN',status:'NOT_STARTED',credential:api.status==='READY'?'JOB_API_READ_TOKEN_CAPTURED':api.status==='MISSING'?'TOKEN_MISSING':api.status==='INVALID'?'TOKEN_INVALID':'ENV_UNCLEARED',api_dispatches:0};
 const save=()=>{const text=JSON.stringify(state);if(text.length>1024)throw Error('FIXED_DIAGNOSTIC_STORAGE');const p='selected-boot-'+(mode??'UNKNOWN')+'.json';writeFileSync(p+'.tmp',text,{flag:'wx',mode:0o600});renameSync(p+'.tmp',p);};
 try{if(!mode||process.argv.length!==3){state.status='ARGS_REJECTED';save();return false;}
 if(api.status!=='READY'||'GITHUB_TOKEN'in process.env){state.status='CREDENTIAL_REJECTED';if('GITHUB_TOKEN'in process.env)state.credential='ENV_UNCLEARED';save();return false;}
 if(['GH_TOKEN','GITHUB_PAT','GITHUB_AUTH_TOKEN','GH_ENTERPRISE_TOKEN'].some(k=>k in env||k in process.env)){state.credential='ALTERNATE_CREDENTIAL_PRESENT';state.status='CREDENTIAL_REJECTED';save();return false;}
 state.status='READY';save();let m;try{m=await load();}catch{state.status='LOAD_FAILED';save();return false;}const record=m.records.createReceipt(mode),life={record,j:null,live:null,emergency:null};m.entry.lifecycle(life);
 const dispatch=async(u,o)=>{state.api_dispatches++;if(state.api_dispatches!==1)throw Error('FIXED_RUN');save();return api.read(u,o);};
 const ok=await m.entry.run(mode,{record,state:life,admit:options=>m.admission.admitClosed({...options,fetcher:dispatch,env})});state.status=ok?'PASSED':'FAILED';save();return ok;
 }catch{state.status='FAILED';try{save();}catch{}return false;}finally{api.dispose();}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const ok=await bootstrap();process.exitCode=ok?0:1;}
