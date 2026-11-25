// Observe the original context cleanup; no command, wait, socket or verdict change.
import {nativeStage} from '../native-score-proof/native.mjs';import {closedBrowserCase} from '../natural-reads/browser.mjs';import {caseRow,evidence} from './cleanup-evidence.mjs';
export async function observedNative(j,{diagnostics=evidence(),run=closedBrowserCase,open,hash}={}){
 const proof=await nativeStage(j,{...(open?{open}:{}),...(hash?{hash}:{}),run:async(mode,chrome,{open})=>{
  const b={point:'STARTED',cleanup:null,cleanupCalls:0,cleanupOutcome:'NOT_CALLED',wireBinding:'NOT_REGISTERED',wireEvents:0,proxy:null};let ctx,wire,listener,raw;
  const snapshot=()=>{let proxy=null;try{proxy=b.proxy?.snapshot();}catch{}return caseRow(mode,raw,{...b,proxy,wireBinding:(()=>{try{return ctx&&wire&&ctx.gateway.wire!==wire?'OWNER_CHANGED':b.wireBinding;}catch{return'OWNER_CHANGED';}})()});};diagnostics.note(snapshot());
  try{raw=await run(mode,chrome,{open:async(G,factory)=>{ctx=await open(G,async()=>{b.proxy=await factory();return b.proxy;});
    try{const close=ctx.cleanup;ctx.cleanup=async function(...args){b.cleanupCalls=Math.min(2,b.cleanupCalls+1);try{const result=await Reflect.apply(close,this,args);b.cleanup=result;b.cleanupOutcome='RETURNED';return result;}catch(error){b.cleanupOutcome='THREW';throw error;}};}catch{}
    try{wire=ctx.gateway.wire;if(wire?.readyState===1&&typeof wire.addEventListener==='function'){listener=()=>{b.wireEvents=Math.min(2,b.wireEvents+1);};wire.addEventListener('close',listener);b.wireBinding='REGISTERED_ON_OPEN_WIRE';}else b.wireBinding='UNAVAILABLE_OR_LATE';}catch{b.wireBinding='UNAVAILABLE_OR_LATE';}return ctx;
   }});b.point='RETURNED';return raw;}catch(error){b.point='THREW';throw error;}
  finally{diagnostics.note(snapshot());if(listener)try{wire.removeEventListener('close',listener);}catch{}}
 }});
 for(const r of proof.cases)if(r.status==='not_run')diagnostics.note(caseRow(r.case,r,{point:'NOT_RUN_CONFIRMED'}));
 if(diagnostics.snapshot().recording!=='COMPLETE_PREFIX')throw Error('FIXED_DIAGNOSTIC_STORAGE');if(diagnostics.snapshot().cases.some(r=>r.attestation==='NOT_CONFIRMED'))throw Error('FIXED_CLOSED_CLEANUP_UNCONFIRMED');return proof;
}
