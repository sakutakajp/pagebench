// Observer failures never skip physical cleanup; failed cleanup is never a pass.
export async function finishArm(ctx,disposers=[]){let failed=false;const g=ctx?.gateway,e=g?.stopEvidence;
 for(const fn of disposers)try{await fn?.();}catch{failed=true;e?.secondaryFailure();}
 let cleanup;try{cleanup=await ctx?.cleanup();}catch{failed=true;e?.secondaryFailure();}
 let settled=false;try{settled=await g?.settleReceives(1000)??true;}catch{failed=true;e?.secondaryFailure();}
 const status=!failed&&settled&&cleanup?.status==='complete'?'complete':cleanup?'failed':'unknown';
 if(e){e.cleanup=status==='complete'?'COMPLETE':status==='failed'?'FAILED':'UNKNOWN';e.publish();}
 return{status,evidence:e?.snapshot()??null};
}
