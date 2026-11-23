// Local-only integration: unchanged runner, actual 400 boundary, owned receiver,
// finishArm and private seal after settled cleanup. No configurable network opener.
import{readFileSync,writeFileSync,lstatSync}from'node:fs';import{join}from'node:path';import{createHash}from'node:crypto';
import{observeNaturalReads}from'../natural-reads/runner.mjs';import{closed400MemoryGateway}from'../natural-reads/retry400-gateway.mjs';
import{binding}from'../origin-capture/retry-crypto.mjs';import{localPrivateStore,FILE}from'./private-store.mjs';import{privateRejectedPaths,instrumentRejectedPaths}from'./journal.mjs';import{CASES,closedContextFactory}from'./closed-context.mjs';import{capacityProof,REASONS,RESOURCES,METHODS,fixed}from'./schema.mjs';
export const FIXED_FILE='closed-run.private-fixed.json';
const phaseReason=p=>({PRECHECK:'PRIVATE_DELIVERY_OR_CLOSED_PRECONDITION',RUNNER:'EXISTING_RUNNER_FAILED',SETTLE:'RECEIVE_SETTLEMENT_UNKNOWN',PRIVATE_SEAL:'PRIVATE_SEAL_OR_CLEANUP_FAILED',READBACK:'PRIVATE_READBACK_OR_FIXED_WRITE_FAILED'})[p]??'OTHER_OR_UNKNOWN';
const firstFields=raw=>({first_refusal:raw?.stop_evidence?.first_refusal?fixed(raw.stop_evidence.first_refusal.category,REASONS,'OTHER_OR_UNKNOWN'):null,first_refusal_type:raw?.stop_evidence?.first_refusal?fixed(raw.stop_evidence.first_refusal.resource_type,RESOURCES,'UNKNOWN'):null,first_refusal_method:raw?.stop_evidence?.first_refusal?fixed(raw.stop_evidence.first_refusal.method,METHODS,'UNKNOWN'):null,refusal_coverage:raw?.stop_evidence?'RETURNED_FIXED_EVIDENCE_ONLY':'UNAVAILABLE',first_fatal:['AB_BOUNDARY_REJECTED','GATEWAY_INTERNAL_FAILED','AB_ASYNC_RECEIVE_FAILED','CDP_TIMEOUT'].includes(raw?.stop_evidence?.first_fatal)?raw.stop_evidence.first_fatal:raw?.stop_evidence?.first_fatal?'OTHER_OR_UNKNOWN':null});
export async function runClosedRejectionPaths(options){
 let journal,store,fixture,raw,phase='PRECHECK',failure=null,settled=false,summary=null,hash=null;
 try{
  if(!options||Object.keys(options).sort().join(',')!=='case,directory,publicKey,scope'||!CASES.includes(options.case)||binding(options.scope).mode!=='CLOSED'||!['v22.19.0','v24.19.0'].includes(process.version)||!capacityProof().fits)throw Error();
  // Refuse before any opener, probe or fixture when private delivery is unavailable.
  store=localPrivateStore(options.directory);journal=privateRejectedPaths({store,publicKey:options.publicKey,scope:options.scope});
  const Gateway=instrumentRejectedPaths(closed400MemoryGateway('over'),journal);phase='RUNNER';fixture=closedContextFactory(Gateway,options.case);
  raw=await observeNaturalReads({open:async()=>fixture.context,proxyFactory:()=>{},fixture:true,windowMs:1});
  phase='SETTLE';settled=await fixture.settle();if(!settled)throw Error();
  phase='PRIVATE_SEAL';summary=journal.finalize();if(summary.private_save!=='SEALED_LOCAL_ONLY'||raw.cleanup!=='complete')throw Error();
  phase='READBACK';store.verify();hash=createHash('sha256').update(readFileSync(join(options.directory,FILE))).digest('hex');
 }catch{failure=phaseReason(phase);}
 finally{
  // A failing integration never skips physical cleanup; repeating its idempotent
  // fixture cleanup does not turn an earlier cleanup failure into a pass.
  if(fixture&&raw?.cleanup!=='complete'){try{await fixture.context.cleanup();}catch{}try{settled=await fixture.settle();}catch{settled=false;}}
  if(journal&&!summary)summary=journal.finalize();
 }
 const result={kind:'CLOSED_PRIVATE_REJECTION_PATHS_RUN',status:failure?(fixture?'FAILED_OR_UNKNOWN':'NOT_STARTED'):'PROOF_RECORDED_NOT_MEASUREMENT_ADOPTION',case:CASES.includes(options?.case)?options.case:'UNKNOWN',phase,reason:failure,measurement_status:raw?.status==='OBSERVED'?'OBSERVED':'FAILED_OR_UNKNOWN',...firstFields(raw),cleanup:raw?.cleanup==='complete'?'complete':raw?.cleanup==='failed'?'failed':'unknown',receives_settled:settled,counts:fixture?{...fixture.counts,max_inflight:fixture.context.gateway.stats.max_inflight,eligible_total:fixture.context.gateway.boundary.total}:null,capture:summary,private_readback:hash?'CIPHERTEXT_BYTES_MATCHED_NOT_DECRYPTED':'UNCONFIRMED',ciphertext_sha256:hash,capacity:capacityProof(),score_saved:false,report_saved:false};
 if(store)try{
  store.verify();const path=join(options.directory,FIXED_FILE),text=JSON.stringify(result);if(Buffer.byteLength(text)>8192)throw Error();writeFileSync(path,text,{flag:'wx',mode:0o600});if(readFileSync(path,'utf8')!==text||(lstatSync(path).mode&0o077))throw Error();
 }catch{result.status='FAILED_OR_UNKNOWN';result.reason='PRIVATE_FIXED_RECORD_UNCONFIRMED';}
 return result;
}
