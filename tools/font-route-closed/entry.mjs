import {fileURLToPath} from 'node:url';
import {scope} from './config.mjs';import {admit} from './admission.mjs';import {empty,save,publish} from './record.mjs';
import {nodeControl} from './control.mjs';import {observedNative} from './native.mjs';import {browserEnvironment} from '../font-http-closed/native.mjs';
export async function main({env=process.env,admission=admit,control=nodeControl,native=observedNative,write=save,network,strip=true}={}){
 const v=empty();const persist=()=>{if(network){v.network=network();v.native.network=network();}write(v);};
 try{persist();v.scope=scope(env);v.native.scope=v.scope;admission({env,stage:s=>{v.admission=s;persist();}});if(v.admission!=='ADMITTED')throw Error('ADMISSION');v.native.admission='ADMITTED';
  if(!network){const g=await import('../connect-postflush-closed/net-guard.mjs');g.install();network=g.snapshot;}
  if(strip){const clean=browserEnvironment(env);for(const k of Object.keys(process.env))delete process.env[k];Object.assign(process.env,clean);}
  process.once('uncaughtExceptionMonitor',()=>{v.status='FAILED_OR_UNKNOWN';try{persist();}catch{}});
  const c=await control();v.node=c.receipt;persist();if(v.node.status!=='PASSED'||typeof c.privatePort!=='string')return false;
  const ok=await native(v,c.privatePort,{persist});persist();if(ok&&v.native.status==='PASSED'&&v.network.blocked_connects===0&&v.network.dns_attempts===0&&v.audits.every(a=>a.audit?.coverage==='COMPLETE_HTTP_RECEIVE_WINDOW'))v.status='PASSED';persist();return v.status==='PASSED';
 }catch{v.status='FAILED_OR_UNKNOWN';try{persist();}catch{}return false;}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){if(process.argv.length!==3)process.exitCode=1;else if(process.argv[2]==='--closed-once')process.exitCode=await main()?0:1;else if(process.argv[2]==='--publish')publish();else process.exitCode=1;}
