// Sparse fixed process evidence; never intercept default exception termination.
import{fixedError}from'../origin-recovery/retry-parent-evidence.mjs';import{scope,fixedWrite}from'./records.mjs';import{readFileSync,existsSync}from'node:fs';
export const STAGES=['native','top','scoped240','scoped400','counter','live'];let current=null;
export function install(stage,s=scope()){
 if(!STAGES.includes(stage)||existsSync('public-stage-'+stage+'.json'))throw Error('FIXED_STAGE');const v={kind:'FIXED_PUBLIC_STAGE',scope:s,stage,phase:'ENTRY',first_fault:null,exit_code:null,passed:false};
 const save=()=>fixedWrite(v,'public-stage-'+stage+'.json',4096),fault=(e)=>{v.first_fault??=fixedError(e);try{save();}catch{v.passed=false;}};
 const uncaught=e=>fault(e),exit=code=>{v.exit_code=Number.isInteger(code)?code:null;v.phase='EXIT';try{save();}catch{}};process.on('uncaughtExceptionMonitor',uncaught);process.once('exit',exit);save();
 return{async work(fn){try{v.phase='WORK';save();const good=await fn();v.phase='SAVED';v.passed=good===true;save();if(!v.passed)process.exitCode=1;return v.passed;}catch(e){fault(e);process.exitCode=1;return false;}},dispose(){process.off('uncaughtExceptionMonitor',uncaught);process.off('exit',exit);}};
}
export function stageComplete(stage,s=scope()){try{const v=JSON.parse(readFileSync('public-stage-'+stage+'.json'));return v.kind==='FIXED_PUBLIC_STAGE'&&JSON.stringify(v.scope)===JSON.stringify(s)&&v.stage===stage&&v.phase==='EXIT'&&v.exit_code===0&&v.first_fault===null&&v.passed===true;}catch{return false;}}
export function monitor(){if(current)return current;return current=install(process.env.PB_PUBLIC_STAGE);}
if(process.env.PB_PUBLIC_STAGE)monitor();
