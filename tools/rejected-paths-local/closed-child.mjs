// Executable closed proof. No input URL, opener, network library or existing key.
import{mkdtempSync,rmSync,readFileSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';import{generateKeyPairSync}from'node:crypto';
import{REF}from'../origin-capture/retry-crypto.mjs';import{runClosedRejectionPaths}from'./closed-run.mjs';import{CASES}from'./closed-context.mjs';import{openPrivate}from'./crypto.mjs';import{FILE}from'./private-store.mjs';
if(process.argv[1]===new URL(import.meta.url).pathname){let directory,out={kind:'CLOSED_REJECTED_PATH_CHILD_PROOF',status:'NOT_STARTED',reason:'CLOSED_ARGUMENTS_OR_PRIVATE_ENVIRONMENT',score_saved:false,report_saved:false},good=false;
 try{
  const mode=process.argv[3];if(process.argv.length!==4||process.argv[2]!=='--closed-proof'||!CASES.includes(mode)||Object.hasOwn(process.env,'GITHUB_ACTIONS')||Object.hasOwn(process.env,'ACTIONS_RUNTIME_URL'))throw Error();
  directory=mkdtempSync(join(tmpdir(),'pagebench-private-rejections-'));const keys=generateKeyPairSync('rsa',{modulusLength:3072,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}}),scope={repository:'sakutakajp/pagebench',ref:REF,sha:'29b45c28f10ef666a6b9bda92fc249570c558618',run_id:'CLOSED_REJECTION_PATHS_CHILD',attempt:1,mode:'CLOSED'};
  const result=await runClosedRejectionPaths({case:mode,directory,publicKey:keys.publicKey,scope});let authenticated=false;
  if(result.capture?.private_save==='SEALED_LOCAL_ONLY'){const p=openPrivate(JSON.parse(readFileSync(join(directory,FILE))),keys.privateKey,scope);authenticated=p.observed.value===result.capture.observed.value&&p.omitted.value===result.capture.omitted.value;}
  good=result.status==='PROOF_RECORDED_NOT_MEASUREMENT_ADOPTION'&&result.cleanup==='complete'&&authenticated&&result.counts?.upstream===0&&result.counts?.continues===0&&result.counts?.max_inflight===6&&result.counts?.wire_closed===true&&result.receives_settled&&result.counts.navigations===1&&result.capture.path_values_complete_for_observed_callbacks===false;
  if(mode==='normal')good&&=result.measurement_status==='OBSERVED'&&result.capture.observed.value===0&&result.first_fatal===null;
  else good&&=mode!=='abort_ack_failure'&&result.measurement_status==='FAILED_OR_UNKNOWN'&&result.first_refusal==='ORIGIN'&&result.first_fatal==='AB_BOUNDARY_REJECTED'&&result.counts.eligible_total===400&&result.counts.aborts===result.capture.observed.value&&result.counts.abort_acks===result.counts.aborts&&result.counts.abort_unconfirmed_responses===0;
  out={kind:'CLOSED_REJECTED_PATH_CHILD_PROOF',status:good?'passed':'failed',private_auth:authenticated?'AUTHENTICATED_CLOSED_DATA':'UNKNOWN',result,score_saved:false,report_saved:false};
 }catch{good=false;}
 finally{if(directory)try{rmSync(directory,{recursive:true,force:true});out.private_directory_removed=true;}catch{good=false;out.status='failed';out.private_directory_removed=false;}}
 console.log(JSON.stringify(out));if(!good)process.exitCode=1;
}
