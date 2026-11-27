import {fileURLToPath} from 'node:url';
import {admit} from './admission.mjs';import {scope} from './config.mjs';import {empty,save,read} from './record.mjs';
export async function main({admission=admit,execute,write=save,env=process.env,network}={}){
 const v=empty();try{
  write(v);v.scope=scope(env);admission({env,stage:s=>{v.admission=s;write(v);}});
  if(v.admission!=='ADMITTED')throw Error('ADMISSION');
  if(!network){const g=await import('../connect-postflush-closed/net-guard.mjs');g.install();network=g.snapshot;}
  if(!execute){const {runNative,browserEnvironment}=await import('./native.mjs');const clean=browserEnvironment();for(const k of Object.keys(process.env))delete process.env[k];Object.assign(process.env,clean);execute=runNative;}
  process.once('uncaughtExceptionMonitor',()=>{v.status='FAILED_OR_UNKNOWN';try{v.network=network();write(v);}catch{}});
  const ok=await execute(v,{persist:()=>{v.network=network();write(v);}});v.network=network();if(v.network.blocked_connects||v.network.dns_attempts){v.status='FAILED_OR_UNKNOWN';write(v);return false;}write(v);return ok&&v.status==='PASSED';
 }catch{v.status='FAILED_OR_UNKNOWN';try{if(network)v.network=network();write(v);}catch{}return false;}
}
export function publish({env=process.env,load=read,write=save,print=console.log}={}){let v=empty();try{const s=scope(env),r=load();if(r&&JSON.stringify(r.scope)===JSON.stringify(s))v=r;}catch{}write(v);print(JSON.stringify(v));return v;}
if(process.argv[1]===fileURLToPath(import.meta.url)){if(process.argv.length!==3)process.exitCode=1;else if(process.argv[2]==='--closed-once')process.exitCode=await main()?0:1;else if(process.argv[2]==='--publish')publish();else process.exitCode=1;}
