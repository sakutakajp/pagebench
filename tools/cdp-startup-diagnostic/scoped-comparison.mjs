import{main}from'./diagnostic.mjs';import{ResponseBoundObserver}from'./response-bound.mjs';import{ScopedCaptureObserver}from'./scoped-capture.mjs';
export const CAPTURE_MODES=Object.freeze(['CONTROL','ROOT_PAGE','SELECTED_TAB']);
export async function runCaptureComparisons(run=async mode=>{
 let probe;const Type=mode==='CONTROL'?class extends ResponseBoundObserver{constructor(...args){super(...args);probe=this;}}:class extends ScopedCaptureObserver{constructor(...args){super(...args,mode);probe=this;}};
 const result=await main(Type),entries=result.commands.entries;
 const proof={root_filter:mode==='CONTROL'?'LEGACY_EXCLUDES_PAGE_BROWSER':'ALL_EXCEPT_BROWSER',discovery_filter:mode==='CONTROL'?'LEGACY_DEFAULT':'ALL_TYPES',page_parent_evidence:probe?.parentEvidence||'MISSING',ui_recursive_commands:entries.filter(e=>e.command==='Target.setAutoAttach'&&e.scope==='BROWSER_UI'&&e.event==='SENT').length,page_recursive_ack:entries.some(e=>e.command==='Target.setAutoAttach'&&e.scope==='PAGE'&&e.event==='RESPONDED')};
 const safe_for_fixture=mode!=='CONTROL'&&result.status==='success'&&result.response_id_bound&&proof.page_parent_evidence!=='MISSING'&&proof.ui_recursive_commands===0&&proof.page_recursive_ack;
 return {mode,result,proof,safe_for_fixture};
},emit=()=>{}){
 const records=[];let chrome=null,stop=null;
 for(const mode of CAPTURE_MODES){const record=await run(mode);records.push(record);emit(record);const v=record.result.browser_version?.version;if(v){if(chrome&&v!==chrome){stop='BROWSER_VERSION_CHANGED';break;}chrome=v;}if(record.result.cleanup?.status!=='complete'||['site_navigations','outbound_forwarding','target_resumes','browser_ui_resumes'].some(k=>record.result[k]!==0)){stop='SAFETY_OR_CLEANUP_FAILED';break;}}
 return {kind:'scoped-capture-comparison',records,summary:{attempted:records.length,chrome,version_comparability:records.length===3&&records.every(r=>r.result.browser_version?.version===chrome)&&chrome?'SAME_VERSION':'UNVERIFIED',safe_fixture_modes:records.filter(r=>r.safe_for_fixture).map(r=>r.mode),terminal_status:stop||'OBSERVATIONS_COMPLETE'}};
}
if(process.argv[1]===new URL(import.meta.url).pathname){try{
 const{writeFile,rename,appendFile}=await import('node:fs/promises');const records=[];const output=await runCaptureComparisons(undefined,r=>{records.push(r);console.log(JSON.stringify(r));});await writeFile('scoped-capture-comparison.tmp',JSON.stringify(output),{mode:0o600});await rename('scoped-capture-comparison.tmp','scoped-capture-comparison.json');console.log(JSON.stringify(output.summary));if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,'```json\n'+JSON.stringify(output)+'\n```\n');if(output.summary.terminal_status!=='OBSERVATIONS_COMPLETE')process.exitCode=1;
}catch{console.log('{"code":"SCOPED_COMPARISON_INTERNAL_FAILED"}');process.exitCode=1;}}
