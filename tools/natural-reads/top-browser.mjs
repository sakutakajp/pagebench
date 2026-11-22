import{superviseNatural}from'./live-parent.mjs';import{TOP_CASES}from'./top-memory.mjs';import{browserFileHash}from'../ab-observe/config.mjs';
const CLOSED_FAILURES=new Set(['AB_BOUNDARY_RESPONSE','AB_BOUNDARY_NETWORK']);
export function topCaseVerdict(mode,r,chrome){
 const o=r?.observation,p=r?.progress,fail=p?.passive_signals?.first_response_failure;
 const parentValid=r?.child_started===true&&r.unexpected_stdout===false&&r.unexpected_stderr===false&&r.group_stop==='NOT_REQUESTED'&&(r.status==='OBSERVED'&&r.reason==='FIXED_OBSERVATION_COMPLETE'&&r.exit_code===0||r.status==='STOPPED'&&r.reason==='GUARD_OR_CHILD_FAILURE'&&r.exit_code===1);
 const safe=parentValid&&r?.cleanup==='COMPLETE'&&r.transport?.kind==='CLOSED_ABSENT'&&r.transport.upstream===0&&r.transport.open_sockets===0&&r.transport.closed===true&&r.transport.forwarding==='ABSENT';
 let ok=safe&&o?.navigation_invocations===1&&o.documents===1&&o.http_status===200;
 if(['normal','handled500','handled500_console'].includes(mode)){ok&&=r.status==='OBSERVED';if(mode!=='normal')ok&&=o?.samples?.end?.error_status===500&&o?.nuxt_error?.hooks?.events?.some(e=>e.source==='APP_ERROR_HOOK'&&e.status_code===500)&&o?.passive_signals?.console_error===(mode==='handled500_console'?'OBSERVED':'NOT_OBSERVED_IN_SCOPED_WINDOW');}
 else{ok&&=r.status==='STOPPED'&&!!p?.evidence?.first_fatal&&!!fail;if(mode==='metadata_http500')ok&&=fail?.category==='HTTP_STATUS'&&fail.resource==='HOME_METADATA'&&fail.status===500;if(mode==='static_http404')ok&&=fail?.category==='HTTP_STATUS'&&fail.resource==='NUXT_STATIC'&&fail.status===404;if(mode==='metadata_cancel')ok&&=fail?.category==='NETWORK_FAILURE'&&fail.network?.includes('CANCELED');}
 const stable=!!o?.chrome&&(!chrome||o.chrome===chrome);ok&&=stable;
 // Parent records are already projected by superviseNatural. Unknown errors/fatal/cleanup
 // never count as an expected negative, nor authorize another browser case.
 const e=p?.evidence??o?.evidence;
 const receiverSettled=e?.receiver_active===0&&e.secondary_failures===0&&e.cleanup==='COMPLETE';
 const known=(r?.status==='OBSERVED'&&!e?.first_fatal&&e?.first_refusal===null)||(r?.status==='STOPPED'&&CLOSED_FAILURES.has(e?.first_fatal)&&!!fail&&e?.emergency==='RETURNED');
 return{hook_registration:['handled500','handled500_console'].includes(mode)?o?.nuxt_error?.hooks?.events?.some(e=>e.source==='APP_ERROR_HOOK'&&e.status_code===500)?'PROVED_BY_APP_ERROR_HOOK':'NOT_CONFIRMED':'NOT_REQUIRED',status:ok&&receiverSettled&&known?'passed':'failed',continuation:safe&&stable&&receiverSettled&&known?'SAFE_CLOSED_NEXT_CASE':'STOP_UNCERTAIN_SAFETY_OR_FAILURE'};
}
export async function topBrowserProof({run=(mode)=>superviseNatural(new URL('./live-child.mjs',import.meta.url).pathname,[mode],{prerequisite:true,timeout:45000}),hash=browserFileHash}={}){
 const initialHash=await hash(),cases=[];let chrome=null,stopped=false;
 for(const mode of TOP_CASES){if(stopped){cases.push({case:mode,status:'not_run',reason:'PREVIOUS_UNCERTAIN_SAFETY_OR_FAILURE'});continue;}let r;try{r=await run(mode);}catch{r=null;}
  const v=topCaseVerdict(mode,r,chrome);chrome??=r?.observation?.chrome;cases.push({case:mode,...v,result:r});if(v.continuation!=='SAFE_CLOSED_NEXT_CASE')stopped=true;
 }
 let stable=false;try{stable=await hash()===initialHash;}catch{}
 return{kind:'TOP_RUNNER_REAL_CHROME_CLOSED_PROOF',workflow_sha:/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA||'')?process.env.GITHUB_SHA:null,status:cases.every(c=>c.status==='passed')&&stable?'passed':'failed',cases,continuation:!stopped&&stable?'SAFE_CLOSED_NEXT_SUITE':'STOP_UNCERTAIN_SAFETY_OR_FAILURE',chrome,binary_sha256:initialHash,upstream_forwarding:'ABSENT',real_site_navigations:0,score_saved:false,nuxt_vs_cdp_order:'SAME_WINDOW_ONLY_NOT_ORDERED'};
}
