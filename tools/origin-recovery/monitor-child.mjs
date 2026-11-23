// CLOSED process test only: no Chrome, site, private key or live entry.
import{requireParent}from'./parent-evidence.mjs';import{withParentStage}from'./stage.mjs';import{writeFileSync}from'node:fs';
const mode=process.argv[2],stage=process.env.PB_RECOVERY_STAGE,m=requireParent(stage),error=()=>Object.assign(new Error('PRIVATE_SENTINEL_NOT_SAVED'),{code:'ECONNRESET'});
if(mode==='baseline_socket'){m.mark('WORK_STARTED');const path=new URL('../proxy-fault/probe-child.mjs',import.meta.url).pathname;process.argv=[process.execPath,path,'baseline','connect_rst',process.cwd()];await import(path);}
else if(mode==='hang'){m.mark('WORK_STARTED');setInterval(()=>{},1000);}
else if(mode==='uncaught'){m.mark('WORK_STARTED');setImmediate(()=>{throw error();});}
else if(mode==='rejection'){m.mark('WORK_STARTED');Promise.reject(error());}
else if(mode==='overflow'){for(let i=0;i<40;i++)m.mark('WORK_STARTED');setImmediate(()=>{throw error();});}
else if(mode==='write_fault'){writeFileSync('origin-recovery-parent-'+stage+'.json.tmp','FIXED_BLOCKER',{flag:'wx'});await withParentStage(stage,async()=>true);}
else if(mode==='first_stable'){m.mark('WORK_STARTED');m.fault('CAUGHT_STAGE',error());m.fault('CAUGHT_STAGE',new TypeError('PRIVATE_SENTINEL_NOT_SAVED'));process.exitCode=1;}
else if(['complete','reported','caught','saved_then_uncaught'].includes(mode)){await withParentStage(stage,async({returned})=>{if(mode==='caught')throw error();returned();writeFileSync('closed-'+stage+'-proof.json','{"kind":"SYNTHETIC_STAGE_NOT_CHROME","status":"passed"}',{flag:'wx',mode:0o600});if(mode==='saved_then_uncaught')setImmediate(()=>{throw error();});return mode!=='reported';});}
else throw Error('FIXED_CLOSED_MODE');
