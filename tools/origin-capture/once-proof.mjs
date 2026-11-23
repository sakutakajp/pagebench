import {runClosedOrigin} from './closed-browser.mjs';
import {browserFileHash} from '../ab-observe/config.mjs';
import {KEY_ID} from './once-output.mjs';
export function originProofSummary(result,{sha,run,binary,stable}){
  const proof={kind:'ORIGIN400_CLOSED_REAL_CHROME_PROOF',workflow_sha:/^[a-f0-9]{40}$/.test(sha||'')?sha:null,run_id:/^[1-9][0-9]{0,23}$/.test(run||'')?run:null,
    status:result?.status==='passed'&&stable===true?'passed':'failed',cases:result?.cases??[],binary_sha256:binary,
    live_key_id:KEY_ID,fixture_key_scope:'EPHEMERAL_TEST_DECODE_PLUS_PINNED_PUBLIC_FILE_ONLY',external_forwarding_capability:'ABSENT',real_site_navigations:0,score_saved:false,report_saved:false};
  try{validateOriginProof(proof,{sha,run,binary,chrome:proof.cases[0]?.chrome});}catch{proof.status='failed';}return proof;
}
export async function runOriginProof({run=runClosedOrigin,hash=browserFileHash}={}){
  const initial=await hash(),r=await run();let stable=false;try{stable=await hash()===initial;}catch{}
  return originProofSummary(r,{sha:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID,binary:initial,stable});
}
export function validateOriginProof(v,{sha,run,binary,chrome}){
  if(v?.kind!=='ORIGIN400_CLOSED_REAL_CHROME_PROOF'||v.status!=='passed'||v.workflow_sha!==sha||v.run_id!==run||v.binary_sha256!==binary||v.live_key_id!==KEY_ID||v.fixture_key_scope!=='EPHEMERAL_TEST_DECODE_PLUS_PINNED_PUBLIC_FILE_ONLY'||v.real_site_navigations!==0||v.score_saved!==false||v.report_saved!==false||v.external_forwarding_capability!=='ABSENT'||v.cases?.length!==2)throw Error('FIXED_ORIGIN_REAL_GATE');
  for(const c of v.cases)if(c.status!=='passed'||c.browser_initialized!==true||c.initial_visible!==true||c.armed!==true||c.page_error_count!==0||c.failure_phase!==null||c.cleanup!=='complete'||c.public_output_readback!==true||c.local_directory_cleanup!=='complete'||c.chrome!==chrome||!/^(Chrome|HeadlessChrome)\/\d+\.\d+\.\d+\.\d+$/.test(chrome||'')||c.proxy?.forwarding!=='ABSENT'||c.proxy.upstream!==0||c.proxy.closed!==true||c.proxy.open_sockets!==0||c.real_site_navigations!==0||c.score_saved!==false||c.report_saved!==false||c.guard?.receiver_active!==0||c.guard.receiver_rejections!==0||c.guard.secondary_failures!==0)throw Error('FIXED_ORIGIN_REAL_GATE');
  const [normal,rejected]=v.cases;if(normal.case!=='normal'||normal.loaded!==true||normal.origin_tuple_match!==false||normal.abort_sent!==0||normal.abort_ack!==0||normal.first_refusal!==null||normal.guard.fatal!==null||normal.guard.emergency!=='NOT_REQUESTED')throw Error('FIXED_ORIGIN_NORMAL_GATE');
  if(rejected.case!=='rejected_script'||rejected.loaded!==false||rejected.origin_tuple_match!==true||rejected.abort_sent!==1||rejected.abort_ack!==1||rejected.first_refusal?.category!=='ORIGIN'||rejected.first_refusal.method!=='GET'||rejected.first_refusal.resource_type!=='Script'||rejected.guard.fatal!=='AB_BOUNDARY_REJECTED'||rejected.guard.emergency!=='RETURNED')throw Error('FIXED_ORIGIN_REJECT_GATE');
  return true;
}
