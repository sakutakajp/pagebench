import{test}from'node:test';import assert from'node:assert/strict';
import{spawn}from'node:child_process';import{once}from'node:events';
import{mkdtemp,mkdir,writeFile,rm,access}from'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';
import{freezeObservation}from'./diagnostic.mjs';import{cleanupDiagnostic,finishObservation,trackProcess,waitClosed}from'./cleanup.mjs';
const raw=()=>({code:'PAUSED_PAGE_OBSERVED',sequence:[{n:99,event:'ATTACHED_PAUSED',kind:'PAGE',url:'SECRET'}],url:'SECRET'});
async function child(){const proc=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});const tracked=trackProcess(proc);await once(proc,'spawn');return{proc,tracked};}
async function profile(){const root=await mkdtemp(join(tmpdir(),'cdp-cleanup-'));const path=join(root,'SECRET-profile');await mkdir(path);await writeFile(join(path,'state'),'fixture');return{root,path};}
const exists=async p=>access(p).then(()=>true,()=>false);
test('observation is narrowly frozen before cleanup mutations and arbitrary error text',async()=>{
 const original=raw(),snapshot=freezeObservation(original);assert.ok(Object.isFrozen(snapshot.sequence[0]));assert.throws(()=>snapshot.sequence.push({}));
 const cleanup=await cleanupDiagnostic({observer:{dispose(){}},wire:{close(){}},proxy:{close(){}},profile:'/not-used',removeProfile:async()=>{}},{disposeObserver:()=>{original.sequence[0].kind='SECRET';throw Error('https://private.invalid/?token=SECRET')},closeWire:()=>{throw Error('authorization SECRET')},closeProxy:()=>{throw Error('URL SECRET')},removeProfile:()=>{throw Error('PROFILE SECRET')}});
 const result=finishObservation(snapshot,cleanup);assert.equal(result.status,'failed');assert.equal(result.code,'PAUSED_PAGE_OBSERVED');assert.deepEqual(result.sequence,[{n:1,event:'ATTACHED_PAUSED',kind:'PAGE'}]);assert.deepEqual(cleanup.stages.filter(s=>s.code.endsWith('_FAILED')).map(s=>s.stage),['OBSERVER_DISPOSE','WIRE_CLOSE','PROXY_CLOSE','PROFILE_DELETE']);assert.ok(!JSON.stringify(result).includes('SECRET'));assert.ok(!JSON.stringify(result).includes('private.invalid'));
});
test('real child process closes before real temporary directory is deleted',async()=>{
 const c=await child(),p=await profile(),order=[];
 try{const cleanup=await cleanupDiagnostic({...c,observer:{dispose(){order.push('observer')}},wire:{close(){order.push('wire')}},proxy:{close(){order.push('proxy')}},profile:p.path,removeProfile:async path=>{assert.equal(c.tracked.closed,true);order.push('delete');await rm(path,{recursive:true,force:true});}});
 assert.equal(cleanup.status,'complete');assert.equal(c.tracked.closed,true);assert.equal(await exists(p.path),false);assert.deepEqual(order,['observer','wire','proxy','delete']);assert.ok(cleanup.stages.findIndex(s=>s.code==='PROCESS_EXIT_CONFIRMED')<cleanup.stages.findIndex(s=>s.code==='PROFILE_DELETED'));
 }finally{c.proc.kill('SIGKILL');await waitClosed(c.tracked);await rm(p.root,{recursive:true,force:true});}
});
test('real filesystem removal error retains captured sequence and failed status',async()=>{
 const c=await child(),p=await profile(),snapshot=freezeObservation(raw());
 try{
 await assert.rejects((async()=>{try{return snapshot;}finally{await rm(p.path,{recursive:false});}})());
 const cleanup=await cleanupDiagnostic({...c,profile:p.path,removeProfile:path=>rm(path,{recursive:false})});const result=finishObservation(snapshot,cleanup);assert.equal(result.status,'failed');assert.equal(result.code,'PAUSED_PAGE_OBSERVED');assert.equal(result.sequence[0].kind,'PAGE');assert.equal(c.tracked.closed,true);assert.ok(cleanup.stages.some(s=>s.code==='PROFILE_DELETE_FAILED'));assert.equal(await exists(p.path),true);assert.ok(!JSON.stringify(result).includes('SECRET'));}
 finally{c.proc.kill('SIGKILL');await waitClosed(c.tracked);await rm(p.root,{recursive:true,force:true});}
});
test('real kill followed by injected error remains failed even after confirmed exit',async()=>{
 const c=await child(),p=await profile();try{const cleanup=await cleanupDiagnostic({...c,profile:p.path,removeProfile:path=>rm(path,{recursive:true,force:true})},{stopProcess:()=>{c.proc.kill('SIGKILL');throw Error('SECRET kill error')}});assert.equal(cleanup.status,'failed');assert.ok(cleanup.stages.some(s=>s.code==='PROCESS_KILL_FAILED'));assert.ok(cleanup.stages.some(s=>s.code==='PROCESS_EXIT_CONFIRMED'));assert.equal(await exists(p.path),false);}
 finally{c.proc.kill('SIGKILL');await waitClosed(c.tracked);await rm(p.root,{recursive:true,force:true});}
});
test('unconfirmed live process keeps profile, never calls deletion, and fails',async()=>{
 const c=await child(),p=await profile();let deleted=false;try{const cleanup=await cleanupDiagnostic({...c,profile:p.path,removeProfile:async()=>{deleted=true;}},{stopProcess:()=>{},waitExit:()=>waitClosed(c.tracked,20)});assert.equal(cleanup.status,'failed');assert.equal(c.tracked.closed,false);assert.equal(deleted,false);assert.equal(await exists(p.path),true);assert.ok(cleanup.stages.some(s=>s.code==='PROCESS_EXIT_TIMEOUT'));assert.ok(cleanup.stages.some(s=>s.code==='PROFILE_HELD_PROCESS_UNCONFIRMED'));}
 finally{c.proc.kill('SIGKILL');await waitClosed(c.tracked);await rm(p.root,{recursive:true,force:true});}
});
test('exit confirmation failure is separate and original rejected target remains failed',async()=>{
 const snapshot=freezeObservation({code:'TARGET_TYPE_UNCLASSIFIED',sequence:[{event:'ATTACHED_PAUSED',kind:'TYPE_UNKNOWN_STRING',title:'SECRET'}]});const cleanup=await cleanupDiagnostic({proc:{pid:123,exitCode:0,signalCode:null},profile:'/not-used',removeProfile:()=>assert.fail('deletion forbidden')},{waitExit:()=>{throw Error('SECRET / URL')}});const result=finishObservation(snapshot,cleanup);assert.equal(result.status,'failed');assert.equal(result.code,'TARGET_TYPE_UNCLASSIFIED');assert.equal(result.sequence[0].kind,'TYPE_UNKNOWN_STRING');assert.ok(cleanup.stages.some(s=>s.code==='PROCESS_EXIT_FAILED'));assert.ok(!JSON.stringify(result).includes('SECRET'));
 const complete=await cleanupDiagnostic({});assert.equal(finishObservation(snapshot,complete).status,'failed');assert.equal(finishObservation(freezeObservation({code:'raw SECRET',sequence:[]}),complete).code,'OBSERVATION_INVALID');
});
test('observer freezes its sequence before immediate Chrome stop, even when stop throws',async()=>{
 const{Observer}=await import('./diagnostic.mjs');let observer;observer=new Observer({send(){},close(){}},()=>{assert.equal(observer.snapshot.code,'PAUSED_PAGE_OBSERVED');assert.equal(observer.snapshot.sequence[0].kind,'PAGE');observer.sequence[0].kind='SECRET';throw Error('SECRET stop URL');});
 observer.record('ATTACHED_PAUSED','PAGE');observer.stop('PAUSED_PAGE_OBSERVED');assert.equal(observer.result().sequence[0].kind,'PAGE');assert.equal(observer.terminationFailed,true);const cleanup=await cleanupDiagnostic({observer});const result=finishObservation(observer.result(),cleanup);assert.equal(result.status,'failed');assert.ok(cleanup.stages.some(s=>s.code==='EARLY_TERMINATE_FAILED'));assert.ok(!JSON.stringify(result).includes('SECRET'));
});
