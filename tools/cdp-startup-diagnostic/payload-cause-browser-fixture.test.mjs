import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {mkdtemp,readFile,rm,stat} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import{createHash}from'node:crypto';
import{createNuxtErrorProbe,safeNuxtErrorProbe,safeNuxtErrorEvidence}from'./nuxt-error-evidence.mjs';
import{CAUSE_CASES,causeFixtureHtml,causePublicOutcome,causePublicReadback,validCauseCase,validCauseBrowserProof}from'./payload-cause-browser-fixture.mjs';
export function vmCauseCase(mode,{unsupported=false}={}){
 const root={},main={querySelectorAll(s){return s===':scope > div > p'?[{childNodes:[{nodeType:3,length:3,data:'500'}]}]:[{}];}};
 const env={document:{getElementById:()=>root,querySelectorAll:()=>[{closest:()=>main}]},setInterval:()=>1,clearInterval:()=>{}};
 const context=vm.createContext(env);context.window=context;
 if(unsupported)vm.runInContext('Error.isError=undefined',context);
 vm.runInContext('globalThis.probe=('+createNuxtErrorProbe.toString()+')(globalThis)',context);
 vm.runInContext(causeFixtureHtml(mode).match(/<script>([\s\S]*)<\/script>/)[1],context);
 const hooks=safeNuxtErrorProbe(context.probe.snapshot()),counters=context.__causeFixture.read();context.probe.dispose();
 const evidence=safeNuxtErrorEvidence({status:'OBSERVED_WITH_GAPS',reason:'SAME_DOCUMENT_NOT_CAUSAL',hooks,cdp:{coverage:'MAIN_CONTEXT_OBSERVED',pre_context_gap:true,unscoped_error_notifications:0,console_error_without_error_object:0,overflow:false,events:[]}});
 const p=causePublicOutcome(evidence);
 return {case:mode,status:'passed',chrome:'Chrome/1.2.3.4',standard_brand:counters.standard_brand,reflection_traps:counters.reflection_traps,getter_calls:counters.getter_calls,documents:1,cleanup:'complete',observer_cleanup:'complete',outbound_forwarding:0,public_readback:true,public_sha256:createHash('sha256').update(JSON.stringify(p)).digest('hex'),public:p,information:mode==='native_title'?'NATIVE_SHAPE_OBSERVED':'UNKNOWN'};
}
test('actual fixed HTML scripts with native Error brand preserve shape and zero-trap negatives in VM',()=>{
 assert.equal(typeof Error.isError,'function');
 for(const mode of CAUSE_CASES){const c=vmCauseCase(mode);assert.equal(c.standard_brand,true);assert.equal(c.reflection_traps,0);assert.equal(c.getter_calls,0);assert.equal(validCauseCase(c),true,mode);if(mode!=='native_title')assert.equal(c.information,'UNKNOWN');}
});
test('missing native brand is a failed mandatory fixture, never a silent positive',()=>{
 const c=vmCauseCase('native_title',{unsupported:true});assert.equal(c.standard_brand,false);assert.equal(c.public.nuxt_error.hooks.events[0].cause_detail.state,'UNSUPPORTED_BRAND_CHECK');assert.equal(validCauseCase(c),false);
});
test('the exact public writer redacts, saves mode0600 and reads back cause labels only',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pagebench-cause-public-'));try{
 const c=vmCauseCase('native_title'),file=join(dir,'public.json'),saved=await causePublicReadback(c.public,file);assert.equal(saved.public.nuxt_error.hooks.events[0].cause_detail.message_shape,'NULL_TITLE_READ');assert.equal(saved.public_readback,true);assert.equal((await stat(file)).mode&0o777,0o600);assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'),saved.public_sha256);
 const dirty={...c.public,body:'PRIVATE_BODY',raw:'PRIVATE_STACK'};await causePublicReadback(dirty,file);assert.doesNotMatch(await readFile(file,'utf8'),/PRIVATE|Cannot read properties|fixture\.invalid/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('cause admission rejects wrong identity, unsupported brands, traps, missing data and raw fields',()=>{
 const sha='a'.repeat(40),fp='b'.repeat(64),good=()=>({kind:'closed-payload-cause-proof',status:'passed',workflow_sha:sha,fingerprint:fp,chrome:'Chrome/1.2.3.4',cases:CAUSE_CASES.map(c=>vmCauseCase(c)),live_pages_attempted:0,outbound_forwarding:0,json_readback:true});
 assert.equal(validCauseBrowserProof(good(),sha,fp),true);
 for(const mutate of [p=>p.workflow_sha='z',p=>p.fingerprint='z',p=>p.json_readback=false,p=>p.cases.pop(),p=>p.cases[0].standard_brand=false,p=>p.cases[1].reflection_traps=1,p=>p.cases[4].getter_calls=1,p=>p.cases[3].information='NATIVE_SHAPE_OBSERVED',p=>p.cases[0].public.nuxt_error.hooks.events[0].cause_detail.message_shape='OTHER_OR_UNKNOWN',p=>p.cases[0].public_readback=false,p=>p.cases[0].public.raw='PRIVATE',p=>p.raw='PRIVATE',p=>p.outbound_forwarding=1]){const p=good();mutate(p);assert.equal(validCauseBrowserProof(p,sha,fp),false);}
});
