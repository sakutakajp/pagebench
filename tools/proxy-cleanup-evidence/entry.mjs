// Exact closed entry. No live call, target argument or old-ref monitor activation.
import {fileURLToPath} from 'node:url';import {createReceipt} from './records.mjs';import {scope} from './config.mjs';
export async function run(mode,{record=createReceipt(mode),admit,execute,makeJournal,state={admitted:false,j:null}}={}){
 let j=null,admitted=false;
 try{
  if(!admit)({admitClosed:admit}=await import('./admission.mjs'));
  await admit({consume:mode==='JIT',record});admitted=true;state.admitted=true;
  if(mode==='PRECHECK')return true;
  if(!makeJournal)({createJournal:makeJournal}=await import('../native-score-proof/state.mjs'));
  j=makeJournal(scope());state.j=j;j.phase('ADMISSION');
  if(!execute){const{executeClosed}=await import('../native-score-proof/main.mjs');const{observedNative}=await import('./native.mjs');execute=opts=>executeClosed({...opts,native:j=>observedNative(j)});}
  return await execute({j});
 }catch(error){if(!admitted)record.reject(error);else{j?.fault(error);j?.finish(false);}return false;}
}
export function installLifecycle(record,state){const fault=error=>{if(state.admitted)state.j?.fault(error);else record.reject(error);},exit=code=>{state.j?.exit(code);record.exit(code);};process.on('uncaughtExceptionMonitor',fault);process.once('exit',exit);return()=>{process.removeListener('uncaughtExceptionMonitor',fault);process.removeListener('exit',exit);};}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const mode=process.argv[2]==='--admit-only'?'PRECHECK':'JIT';const record=createReceipt(mode),state={admitted:false,j:null};
 installLifecycle(record,state);
 try{if(process.argv.length!==3||!['--admit-only','--closed-once'].includes(process.argv[2]))throw Error('FIXED_ARGS');if(!await run(mode,{record,state}))process.exitCode=1;}catch(error){record.reject(error);process.exitCode=1;}
}
