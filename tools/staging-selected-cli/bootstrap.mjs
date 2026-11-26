// No standard token injection, credential fallback or anonymous retry.
import{fileURLToPath}from'node:url';import{writeFileSync,renameSync}from'node:fs';
export async function bootstrap({env=process.env,transport=globalThis.fetch,load=async()=>({entry:await import('./entry.mjs'),admission:await import('./admission.mjs'),records:await import('./records.mjs')})}={}){
 const mode={'--admit-only':'PRECHECK','--closed-once':'JIT','--measure-once':'LIVE'}[process.argv[2]],state={kind:'SELECTED_BOOT_FIXED',mode:mode??'UNKNOWN',status:'NOT_STARTED',credential:'GITHUB_TOKEN'in env?'PRESENT_REJECTED':'ANONYMOUS_NO_TOKEN',api_dispatches:0};
 const save=()=>{const text=JSON.stringify(state);if(text.length>1024)throw Error('FIXED_DIAGNOSTIC_STORAGE');const p='selected-boot-'+(mode??'UNKNOWN')+'.json';writeFileSync(p+'.tmp',text,{flag:'wx',mode:0o600});renameSync(p+'.tmp',p);};
 try{if(!mode||process.argv.length!==3){state.status='ARGS_REJECTED';save();return false;}if(state.credential!=='ANONYMOUS_NO_TOKEN'){state.status='CREDENTIAL_REJECTED';save();return false;}state.status='READY';save();let m;try{m=await load();}catch{state.status='LOAD_FAILED';save();return false;}const record=m.records.createReceipt(mode),life={record,j:null,live:null,emergency:null};m.entry.lifecycle(life);
 const dispatch=async(u,o)=>{state.api_dispatches++;if(state.api_dispatches!==1||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||'')||u!=='https://api.github.com/repos/sakutakajp/pagebench/actions/runs?head_sha='+env.GITHUB_SHA+'&event=push&per_page=100'||o?.method!=='GET'||o.redirect!=='error'||JSON.stringify(o.headers)!==JSON.stringify({Accept:'application/vnd.github+json'})||!o.signal)throw Error('FIXED_RUN');save();return transport(u,o);};
 const ok=await m.entry.run(mode,{record,state:life,admit:options=>m.admission.admitClosed({...options,fetcher:dispatch,env})});state.status=ok?'PASSED':'FAILED';save();return ok;
 }catch{state.status='FAILED';try{save();}catch{}return false;}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const ok=await bootstrap();process.exitCode=ok?0:1;}
