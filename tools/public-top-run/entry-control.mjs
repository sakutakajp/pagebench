// Test-only isolated import: real entry/record/cleanup with controlled VM/CDP.
// No actual admission, Chrome, pinned tunnel or live child is invoked.
import{registerHooks}from'node:module';
export async function controlledEntry({mismatch=false}={}){
 const entry=new URL('./entry.mjs?closed-entry-only-'+(mismatch?'mismatch':'matched'),import.meta.url),url=p=>new URL(p,import.meta.url).href;
 const source=`import{run400Control}from${JSON.stringify(url('../public-rejection-logs/control.mjs'))};import{scoped400Record}from${JSON.stringify(url('../natural-reads/scoped400-record.mjs'))};import{scope,writeCounts,fixedWrite}from${JSON.stringify(url('./records.mjs'))};import{join}from'node:path';export async function superviseNatural(module,args,{onProgress}){const r=await run400Control({profile:'CLOSED400',beforeAck:405,afterStop:40,rejectedDuplicate:true,earlyFcp:true}),record=scoped400Record(r.result,r.census,r.meter);if(!record)throw Error('CONTROLLED_RECORD');const observation=record.observation;const stored=structuredClone(record);if(${mismatch})stored.observation.navigation_invocations=0;fixedWrite(stored,join(args[1],'record.json'));writeCounts(args[1],r.rejections,scope());const p={status:'STOPPED',child_started:true,reason:'GUARD_OR_CHILD_FAILURE',cleanup:'COMPLETE',progress:observation,observation};onProgress(p);return p;}`;
 const parent='data:text/javascript;base64,'+Buffer.from(source).toString('base64'),admit='data:text/javascript;base64,'+Buffer.from('export async function admit(){return{chrome:"Chrome/157.0.8103.78"}}').toString('base64');
 const hook=registerHooks({resolve(spec,ctx,next){if(ctx.parentURL===entry.href&&spec==='./admission.mjs')return{url:admit,shortCircuit:true};if(ctx.parentURL===entry.href&&spec==='../natural-reads/live-parent.mjs')return{url:parent,shortCircuit:true};return next(spec,ctx);}});
 try{return await(await import(entry.href)).execute();}finally{hook.deregister();}
}
