// Closed VM/CDP control. No browser, network client, live opener, admission or CLI.
import{readFile}from'node:fs/promises';import{closedPushProbeSource,createHandledPushCollector,makeClosedCaseOwner}from'./handled-push.mjs';import{createNuxtErrorProbe}from'../cdp-startup-diagnostic/nuxt-error-evidence.mjs';import{closed240MemoryGateway}from'./scoped240-gateway.mjs';
const originalUrl=new URL('./driver-double.mjs',import.meta.url),original=await readFile(originalUrl,'utf8');
export async function runHandledPushClosed(mode,{enabled=true,delayed=false}={}){
 if(!['normal','handled500_push_stop','handled500_cap_stop'].includes(mode))throw Error('CLOSED_MODE');
 let source=original,g,collector,cap,armed=false;const commands=[],debug=[],proof={app_hook_registered:false,app_hook_invocations:0,console_error_notifications:0,source_substitutions:0,pending_at_app_error:null,pending_at_stop:null};
 const change=(a,b)=>{if(source.split(a).length!==2)throw Error('FIXED_DRIVER_DRIFT');source=source.replace(a,b);};
 change('{onProgress=()=>{}}={}','{onProgress=()=>{},decorate=()=>{},fixedDebug=()=>{},fixedProof={}}={}');
 change("['handled500','handled500_console'].includes(mode)","['handled500','handled500_console','handled500_push_stop','handled500_cap_stop'].includes(mode)");
 change('ctx=vm.createContext({document:doc,',"ctx=vm.createContext({console:{debug:fixedDebug},document:doc,");
 if(enabled)change('script=e.source;',"if(e.source.split("+JSON.stringify(createNuxtErrorProbe.toString())+").length!==2)throw Error('FIXED_PROBE_DRIFT');script=e.source.replace("+JSON.stringify(createNuxtErrorProbe.toString())+","+JSON.stringify(closedPushProbeSource())+");fixedProof.source_substitutions++;");
 change("if(m.method==='Fetch.continueRequest')queueMicrotask", "if(m.method==='Fetch.continueRequest'&&!e.requestId.startsWith('CAP'))queueMicrotask");
 change(' return{gateway:g,wire,chrome:', ' decorate(g);return{gateway:g,wire,chrome:');
 change("if(errorMode){const e=", "if(errorMode){fixedProof.app_hook_registered=hooks.has('app:error')&&hooks.has('vue:error');fixedProof.pending_at_app_error=g.pending.size;fixedProof.app_hook_invocations++;const e=");
 change("if(mode!=='missing_fcp')event", "if(!['missing_fcp','handled500_push_stop','handled500_cap_stop'].includes(mode))event");
 change("const url=mode==='scope_failure'?", "if(mode==='handled500_cap_stop'){for(let i=0;i<240;i++)event('Fetch.requestPaused',{requestId:'CAP'+i,networkId:'CAP'+i,frameId:'F',resourceType:'Fetch',request:{url:'https://staging.hirameki.dev/_nuxt/fixed-cap.js',method:'GET',headers:{}}});await new Promise(r=>setImmediate(r));return;}const url=['scope_failure','handled500_push_stop'].includes(mode)?");
 source=source.replace(/from '(\.\/[^']+)'/g,(_,p)=>"from '"+new URL(p,originalUrl).href+"'");
 const {runDriverDouble}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const d=new(closed240MemoryGateway())({send(){},close(){}},()=>{}),Boundary=d.boundary.constructor;d.dispose();
 const deliver=message=>g.wire.onmessage({data:JSON.stringify(message)});
 const r=await runDriverDouble(mode,{fixedProof:proof,fixedDebug(value){const message={sessionId:'P',method:'Runtime.consoleAPICalled',params:{type:'debug',executionContextId:8,args:[{type:'string',value}],stackTrace:{description:'DO_NOT_RECORD_STACK'}}};if(delayed){if(debug.length<18)debug.push(message);}else deliver(message);},decorate(gateway){g=gateway;g.boundary=new Boundary(g);cap=makeClosedCaseOwner();collector=createHandledPushCollector(g,cap);const forward=g.forward,fail=g.fail,call=g.call;g.forward=function(m){if(m.method==='Runtime.consoleAPICalled'&&m.params?.type==='error')proof.console_error_notifications++;collector.accepted(m,cap);return forward.call(this,m);};g.fail=function(code){if(proof.pending_at_stop===null)proof.pending_at_stop=g.pending.size;collector.freeze();return fail.call(this,code);};g.call=function(method,...args){commands.push(method);return call.call(this,method,...args);};},onProgress(p){if(p.phase==='NAVIGATION'&&!armed){armed=collector.arm();}if(['SEAL','CLEANUP'].includes(p.phase))collector.freeze();}});
 // Delayed one-way packets are never retroactively read after the real guard stops.
 for(const m of debug)deliver(m);await new Promise(r=>setImmediate(r));
 return{kind:'CLOSED_VM_ORIGINAL_RUNNER_HANDLED_PUSH_NOT_CHROME',mode,proof,observation:r.result,requests:r.counts,commands,max_inflight:g.stats.max_inflight,total:g.boundary.total,push:collector.snapshot(),real_browser:false,upstream:0,additional_cdp_calls:0};
}
