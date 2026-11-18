// One-factor interventions only. All candidates remain paused and proxy is deny-only.
import{ResponseBoundObserver,classifyUnpausedUI}from'./response-bound.mjs';
import{autoAttachParams,main}from'./diagnostic.mjs';
export const MODES=Object.freeze(['NO_CREATE','FULL_CONTROL','HOLD_UI_AUTOATTACH','HOLD_FIRST_TAB_AUTOATTACH','HOLD_SECOND_TAB_AUTOATTACH','ONLY_FIRST_TAB_AUTOATTACH','ONLY_UI_AUTOATTACH','ONLY_SECOND_TAB_AUTOATTACH']);
export function probeClass(mode,capture=()=>{}){
 if(!MODES.includes(mode))throw Error('INVALID_COMPARISON_MODE');
 return class extends ResponseBoundObserver{
  constructor(...args){super(...args);this.mode=mode;this.operations=[];this.operationBySession=new Map();this.held=[];this.withheld=0;this.parentObservation=null;capture(this);}
  role(sid){const s=this.sessions.get(sid);if(s?.kind==='BROWSER_UI')return 'BROWSER_UI';if(s?.kind==='PAGE')return 'PAGE';if(s?.kind==='TAB'){const tabs=[...this.sessions.entries()].filter(([,v])=>v.kind==='TAB');const n=tabs.findIndex(([id])=>id===sid);return n===0?'FIRST_TAB':n===1?'SECOND_TAB':'OTHER_TAB';}return 'UNKNOWN';}
  operation(sid){const o=this.operationBySession.get(sid);if(!o)return {role:this.role(sid),state:'NOT_SENT',command_no:0};const responded=this.commandLog.entries.some(e=>e.command_no===o.command_no&&e.event==='RESPONDED');return {role:o.role,state:o.action==='WITHHELD'?'WITHHELD':responded?'ACKNOWLEDGED':'SENT_PENDING',command_no:o.command_no};}
  call(method,params={},sid){
   if(method==='Target.setAutoAttach'&&sid&&!this.stopped){
    const role=this.role(sid),onlyRole=mode==='ONLY_FIRST_TAB_AUTOATTACH'?'FIRST_TAB':mode==='ONLY_SECOND_TAB_AUTOATTACH'?'SECOND_TAB':mode==='ONLY_UI_AUTOATTACH'?'BROWSER_UI':null;
    const hold=onlyRole?role!==onlyRole:this.withheld===0&&((mode==='HOLD_UI_AUTOATTACH'&&role==='BROWSER_UI')||(mode==='HOLD_FIRST_TAB_AUTOATTACH'&&role==='FIRST_TAB')||(mode==='HOLD_SECOND_TAB_AUTOATTACH'&&role==='SECOND_TAB'));
    const op={role,action:hold?'WITHHELD':'SENT',command_no:hold?0:this.commandLog.serial+1};this.operations.push(op);this.operationBySession.set(sid,op);
    if(hold){this.withheld++;return new Promise((_,reject)=>this.held.push(reject));}
   }
   return super.call(method,params,sid);
  }
  async attach(m,k){
   if(k==='BROWSER_UI'&&!m.params?.waitingForDebugger&&!this.parentObservation){
    const p=m.params,prior=[...this.sessions.entries()].find(([,s])=>s.target===p.targetInfo.targetId);
    this.parentObservation={identity:classifyUnpausedUI(m,this.sessions,this.tabSession),notification_parent_operation:this.operation(m.sessionId),prior_primary_operation:prior?this.operation(prior[0]):{role:'UNKNOWN',state:'NOT_SENT',command_no:0},same_parent:prior?(prior[1].parent===(m.sessionId||null)?'SAME_PARENT':'DIFFERENT_PARENT'):'NO_PRIOR_TARGET'};
   }
   return super.attach(m,k);
  }
  evidence(){return {mode,operations:this.operations.map(o=>({...o})),withheld_operations:this.withheld,intervention_applied:mode==='NO_CREATE'||mode==='FULL_CONTROL'||(mode.startsWith('ONLY_')?this.operations.some(o=>o.action==='SENT'):this.withheld===1),unpaused_ui_parent:this.parentObservation};}
  stop(code){if(!this.stopped)this.probeSnapshot=this.evidence();super.stop(code);for(const reject of this.held||[])reject(Error('DIAGNOSTIC_STOPPED'));this.held=[];}
  async collect(){
   if(mode!=='NO_CREATE')return super.collect();
   try{await this.call('Target.setAutoAttach',autoAttachParams());this.record('AUTOATTACH_READY');await this.readVersion();await this.call('Target.setDiscoverTargets',{discover:true});await this.call('Target.getTargets');await new Promise(r=>setTimeout(r,1000));if(!this.stopped)this.stop('NO_PAUSED_PAGE');}catch{if(!this.stopped)this.stop('PROTOCOL_OR_CAPTURE_FAILED');}return this.result();
  }
 };
}
export async function compare(run=async(mode)=>{let probe;const result=await main(probeClass(mode,p=>probe=p));return {result,comparison:probe?.probeSnapshot||{mode,operations:[],withheld_operations:0,intervention_applied:false,unpaused_ui_parent:null}};},emit=()=>{}){
 const records=[];let version=null,stopReason=null;
 for(const mode of MODES){
  let record;try{record=await run(mode);}catch{stopReason='INTERNAL_FAILED';break;}
  if(record.comparison.mode!==mode)throw Error('COMPARISON_MODE_MISMATCH');
  records.push(record);emit(record);
  const r=record.result,v=r.browser_version?.code==='VERSION_VERIFIED'?r.browser_version.version:null;
  if(v){if(version&&v!==version){stopReason='BROWSER_VERSION_CHANGED';break;}version=v;}
  if(r.cleanup?.status!=='complete'||['site_navigations','outbound_forwarding','target_resumes','browser_ui_resumes'].some(k=>r[k]!==0)){stopReason='SAFETY_OR_CLEANUP_FAILED';break;}
 }
 const versions=records.map(r=>r.result.browser_version?.version).filter(Boolean);
 const summary={kind:'isolated-autoattach-operation-comparison',planned:MODES.length,completed:records.length,chrome:version,version_comparability:versions.length===MODES.length&&new Set(versions).size===1?'SAME_VERSION':'UNVERIFIED',unapplied_interventions:records.filter(r=>!['NO_CREATE','FULL_CONTROL'].includes(r.comparison.mode)&&!r.comparison.intervention_applied).length,terminal_status:stopReason||(versions.length===MODES.length?'OBSERVATIONS_COMPLETE':'OBSERVATIONS_INCOMPLETE'),scope:'isolated-no-navigation-no-resume-no-forwarding'};
 return {summary,records};
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 try{
 const{writeFile,rename,appendFile}=await import('node:fs/promises');const records=[];
 const persist=async value=>{await writeFile('operation-comparison.tmp',JSON.stringify(value),{mode:0o600});await rename('operation-comparison.tmp','operation-comparison.json');};
 // Each completed fresh-profile observation is persisted before the next begins.
 const output=await compare(async mode=>{let probe;const result=await main(probeClass(mode,p=>probe=p));const record={result,comparison:probe?.probeSnapshot||{mode,operations:[],withheld_operations:0,intervention_applied:false,unpaused_ui_parent:null}};records.push(record);await persist({records});return record;},r=>console.log(JSON.stringify(r)));
 await persist(output);console.log(JSON.stringify(output.summary));
 if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,'```json\n'+JSON.stringify(output)+'\n```\n');
 if(output.summary.terminal_status!=='OBSERVATIONS_COMPLETE')process.exitCode=1;
 }catch{console.log('{"kind":"isolated-autoattach-operation-comparison","terminal_status":"COMPARISON_INTERNAL_FAILED"}');process.exitCode=1;}
}
