// The only log exporter: exact fixed schema or a fixed unknown fallback.
import{readFileSync}from'node:fs';import{STAGES,stageComplete}from'./monitor.mjs';import{PROOF}from'./config.mjs';import{safeSummary,publicSummary,saveSummary}from'./records.mjs';
let value;try{const bytes=readFileSync(PROOF);if(bytes.length>65536)throw Error();value=safeSummary(JSON.parse(bytes));}catch{}if(!value)value=publicSummary();saveSummary(value);console.log(JSON.stringify(value));

const gates={kind:'PUBLIC_PREFLIGHT_STATUS',stages:STAGES.map(stage=>{let complete=false;try{complete=stageComplete(stage);}catch{}return{stage,status:complete?'COMPLETED_FIXED_PROCESS_PROOF':'UNCONFIRMED_OR_NOT_RUN'};}),score_status:'NOT_MEASURED_NO_LIGHTHOUSE_ON_THIS_PATH'};console.log(JSON.stringify(gates));
