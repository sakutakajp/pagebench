// Only fixed rebuilt schemas reach public logs. Never read the raw top proof.
import{readFileSync}from'node:fs';import{STAGES,stageComplete}from'./monitor.mjs';import{PROOF}from'./config.mjs';import{scope,safeSummary,publicSummary,saveSummary}from'./records.mjs';import{publishTop}from'./top-public.mjs';
let value;try{const bytes=readFileSync(PROOF);if(bytes.length>65536)throw Error();value=safeSummary(JSON.parse(bytes));}catch{}if(!value)value=publicSummary();saveSummary(value);console.log(JSON.stringify(value));
const gates={kind:'PUBLIC_PREFLIGHT_STATUS',stages:STAGES.map(stage=>{let complete=false;try{complete=stageComplete(stage);}catch{}return{stage,status:complete?'COMPLETED_FIXED_PROCESS_PROOF':'UNCONFIRMED_OR_NOT_RUN'};}),score_status:'NOT_MEASURED_NO_LIGHTHOUSE_ON_THIS_PATH'};console.log(JSON.stringify(gates));
let identity=null;try{identity=scope();}catch{}console.log(JSON.stringify(publishTop('.',identity)));
