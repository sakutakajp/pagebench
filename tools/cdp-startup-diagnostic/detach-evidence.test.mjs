import{test}from'node:test';import assert from'node:assert/strict';
import{pairDetachSamples,safeDetachEvidence,installDetachEvidence,captureDetachSample}from'./detach-evidence.mjs';
const record=(phase,chars=40,width=412,loader='L')=>({phase,binding:['T','P','F',loader],sample:{width,height:823,chars,headings:1,target_match:true,heading_box:chars>20,heading_in_main:true,ancestor_none:chars<20,ancestor_hidden:false,closed_container:false,own_display:'BLOCK',own_visibility:'VISIBLE'}});
function h(capture,options={}){const sent=[],forwarded=[];let stops=0;const wire={send:s=>sent.push(JSON.parse(s))};const g={wire,primary:'P',createdPage:'T',sessions:new Map([['P',{ready:true,frame:'F'}],['A',{ready:true,auxiliary:true,frame:'F'}]]),stats:{fatal:null},traceReads:{snapshot:()=>({observation:'OWN_TRACE',adoptable:true,eof:true,close_confirmed:true,pending:0,uncommitted:0,failure:null,reads:1,completed:1})},forward:m=>forwarded.push(m),fail:code=>{stops++;g.stopping=true;g.stats.fatal??=code;}};const obs=installDetachEvidence({gateway:g},'https://fixture.invalid/',{capture,timeoutMs:250,...options});return{g,wire,sent,forwarded,obs,get stops(){return stops;}};}
const tick=()=>new Promise(r=>setTimeout(r,0));
const detach=x=>x.wire.send(JSON.stringify({id:7,method:'Target.detachFromTarget',params:{sessionId:'A'}}));
const event=x=>{x.g.sessions.delete('A');x.g.forward({method:'Target.detachedFromTarget',params:{sessionId:'A'}});};
const ack=x=>x.g.forward({id:7,result:{}});
test('pairing classifies exact same-kind width/text change and drops raw bindings/counts/strings',()=>{const r=pairDetachSamples(record('BEFORE'),record('AFTER',2,980));assert.equal(r.status,'OBSERVED');assert.equal(r.changes.width,'INCREASED');assert.equal(r.changes.chars,'DECREASED');assert.equal(r.before.body_text,'GE20');assert.equal(r.after.body_text,'LT20');assert(!JSON.stringify(r).includes('"binding":['));assert(!JSON.stringify(r).includes('980'));});
test('phase swap, same URL but different loader, invalid numeric fields and unknown sample are never compared',()=>{assert.equal(pairDetachSamples(record('AFTER'),record('BEFORE')).reason,'PHASE_MISMATCH');assert.equal(pairDetachSamples(record('BEFORE'),record('AFTER',40,412,'OTHER')).reason,'NAVIGATION_CHANGED');const bad=record('BEFORE');bad.sample.width=NaN;assert.equal(pairDetachSamples(bad,record('AFTER')).status,'INVALID_PAIR');});
test('public projection rejects internally contradictory phase labels and leaks no injected data',()=>{const p=pairDetachSamples(record('BEFORE'),record('AFTER',0));p.changes.chars='INCREASED';p.raw='PRIVATE_BODY';assert.equal(safeDetachEvidence(p).status,'INVALID_PAIR');assert(!JSON.stringify(safeDetachEvidence({...p,reason:'PRIVATE_URL'})).includes('PRIVATE'));});
test('before observation completes before forwarding detach; after waits for both exact event and ack',async()=>{const order=[];const x=h(async phase=>{order.push(phase);return record(phase,phase==='BEFORE'?40:2);});detach(x);assert.equal(x.sent.length,0);await tick();assert.equal(x.sent.length,1);assert.deepEqual(order,['BEFORE']);ack(x);await tick();assert.deepEqual(order,['BEFORE']);assert.equal(x.forwarded.length,0);event(x);await tick();assert.deepEqual(order,['BEFORE','AFTER']);assert.equal(x.obs.snapshot().changes.chars,'DECREASED');assert.equal(x.forwarded.filter(m=>m.id===7).length,1);x.obs.dispose();assert.equal(x.stops,0);});
test('event-before-ack order is supported, while wrong root id/session cannot trigger the after sample',async()=>{const calls=[];const x=h(async phase=>{calls.push(phase);return record(phase);});detach(x);await tick();x.g.forward({id:7,sessionId:'OTHER',result:{}});x.g.forward({id:8,result:{}});x.g.forward({method:'Target.detachedFromTarget',params:{sessionId:'OTHER'}});await tick();assert.deepEqual(calls,['BEFORE']);event(x);ack(x);await tick();assert.deepEqual(calls,['BEFORE','AFTER']);assert.equal(x.obs.snapshot().status,'OBSERVED');x.obs.dispose();});
test('trace incomplete/guard fatal path forwards the original detach and performs no observation',()=>{let calls=0;const x=h(()=>calls++);x.g.traceReads.snapshot=()=>({adoptable:false});detach(x);assert.equal(x.sent.length,1);assert.equal(calls,0);assert.equal(x.obs.snapshot().reason,'TRACE_NOT_CLOSED');x.obs.dispose();});
test('missing detach reply/event is bounded and held reply is released without changing the guard',async()=>{const x=h(async p=>record(p),{timeoutMs:5});detach(x);await tick();ack(x);await new Promise(r=>setTimeout(r,12));assert.equal(x.obs.snapshot().reason,'DETACH_EVENT_OR_REPLY_MISSING');assert.equal(x.forwarded.filter(m=>m.id===7).length,1);assert.equal(x.stops,0);x.obs.dispose();});
test('late failed or timed out observations cannot replace unavailable evidence or retain a report',async()=>{let resolve;const x=h(()=>new Promise(r=>resolve=r),{timeoutMs:5});detach(x);await new Promise(r=>setTimeout(r,12));assert.equal(x.obs.snapshot().reason,'BEFORE_TIMEOUT');assert.equal(x.sent.length,1);resolve(record('BEFORE'));await tick();assert.equal(x.obs.snapshot().reason,'BEFORE_TIMEOUT');assert.equal(x.obs.snapshot().before,null);assert.equal(x.stops,0);x.obs.dispose();});
test('cleanup restores both hooks and releases ack; post-cleanup callback cannot become an observation',async()=>{let release;const x=h(p=>p==='BEFORE'?Promise.resolve(record(p)):new Promise(r=>release=r));const originalSend=x.wire.send;detach(x);await tick();event(x);ack(x);await tick();x.obs.dispose();assert.equal(x.forwarded.filter(m=>m.id===7).length,1);assert.equal(x.obs.snapshot().reason,'CLEANUP_INCOMPLETE');release(record('AFTER'));await tick();assert.equal(x.obs.snapshot().status,'UNAVAILABLE');assert.notEqual(x.wire.send,originalSend);});
test('normal traffic and unexpected/error detach response preserve original forwarding and no raw error output',async()=>{const x=h(async p=>record(p));x.wire.send('{"id":1,"method":"Runtime.enable","sessionId":"P"}');assert.equal(x.sent[0].method,'Runtime.enable');detach(x);await tick();x.g.forward({id:7,error:{message:'PRIVATE_EXCEPTION'}});assert.equal(x.obs.snapshot().reason,'DETACH_ERROR');assert.equal(x.forwarded.at(-1).error.message,'PRIVATE_EXCEPTION');assert(!JSON.stringify(x.obs.snapshot()).includes('PRIVATE'));assert.equal(x.stops,0);x.obs.dispose();});

test('a reload during the DOM capture itself fails the two frame-tree fence, even on the same URL',async()=>{let calls=0,evaluated=0;const ctx={gateway:{primary:'P',createdPage:'T',sessions:new Map([['P',{frame:'F'}]]),call:async(method,params,session)=>{assert.equal(method,'Page.getFrameTree');assert.equal(session,'P');return{frameTree:{frame:{id:'F',loaderId:++calls===1?'L1':'L2',url:'https://fixture.invalid/'}}};}},page:{evaluate:async()=>{evaluated++;return{};}}};await assert.rejects(captureDetachSample(ctx,'https://fixture.invalid/','BEFORE'),/NAVIGATION_CHANGED/);assert.equal(evaluated,1);assert.equal(calls,2);});
test('duplicate completion cannot produce a paired observation, and the original messages are still forwarded',async()=>{const x=h(async p=>record(p));detach(x);await tick();ack(x);ack(x);assert.equal(x.obs.snapshot().reason,'DETACH_REPLY_DUPLICATE');assert.equal(x.obs.snapshot().before,null);assert.equal(x.forwarded.filter(m=>m.id===7).length,2);assert.equal(x.stops,0);x.obs.dispose();});

// The authorization passed by the synchronous gateway must still hold after
// the observer's await. These doubles never open a socket or launch a browser.
for(const cause of ['stopping','fatal'])for(const completion of ['success','timeout']){
 test('before '+completion+' after guard '+cause+' never sends the delayed command',async()=>{
  let resolve;const x=h(()=>new Promise(r=>resolve=r),{timeoutMs:5});detach(x);
  if(cause==='stopping')x.g.stopping=true;else x.g.stats.fatal='ORIGINAL_GUARD_REASON';
  if(completion==='success')resolve(record('BEFORE'));
  await new Promise(r=>setTimeout(r,12));
  assert.equal(x.sent.length,0);assert.equal(x.forwarded.length,0);assert.equal(x.obs.snapshot().reason,'GUARD_STOPPED');assert.equal(x.stops,0);
  resolve(record('BEFORE'));await tick();assert.equal(x.sent.length,0);assert.equal(x.obs.snapshot().status,'INVALID_PAIR');
  assert.equal(x.g.stats.fatal,cause==='fatal'?'ORIGINAL_GUARD_REASON':null);x.obs.dispose();
 });
}
const scopeChanges={
 primary_id:x=>x.g.primary='OTHER',target_id:x=>x.g.createdPage='OTHER',
 primary_replaced:x=>x.g.sessions.set('P',{ready:true,frame:'F'}),primary_removed:x=>x.g.sessions.delete('P'),
 primary_unready:x=>x.g.sessions.get('P').ready=false,primary_frame:x=>x.g.sessions.get('P').frame='OTHER',
 aux_removed:x=>x.g.sessions.delete('A'),aux_replaced:x=>x.g.sessions.set('A',{ready:true,auxiliary:true,frame:'F'}),
 aux_unready:x=>x.g.sessions.get('A').ready=false,aux_frame:x=>x.g.sessions.get('A').frame='OTHER',
 aux_role:x=>x.g.sessions.get('A').auxiliary=false,target_info:x=>x.g.pageInfo={targetId:'OTHER'},
};
for(const [name,change]of Object.entries(scopeChanges))test('delayed detach rejects stale scope: '+name,async()=>{
 let resolve;const x=h(()=>new Promise(r=>resolve=r));detach(x);change(x);resolve(record('BEFORE'));await tick();
 assert.equal(x.sent.length,0);assert.equal(x.forwarded.length,0);assert.equal(x.obs.snapshot().reason,'SCOPE_INVALID');assert.equal(x.stops,1);x.obs.dispose();
});
for(const cause of ['stopping','fatal'])test('held ACK is discarded when '+cause+' before timeout or dispose',async()=>{
 const x=h(async p=>record(p),{timeoutMs:5});detach(x);await tick();ack(x);assert.equal(x.forwarded.length,0);
 if(cause==='stopping')x.g.stopping=true;else x.g.stats.fatal='ORIGINAL_GUARD_REASON';
 await new Promise(r=>setTimeout(r,12));x.obs.dispose();assert.equal(x.forwarded.length,0);assert.equal(x.obs.snapshot().reason,'GUARD_STOPPED');assert.equal(x.stops,0);
});
for(const duplicate of ['ack','event'])test('matching '+duplicate+' duplicate during AFTER invalidates pending pair',async()=>{
 let resolve;const x=h(p=>p==='BEFORE'?Promise.resolve(record(p)):new Promise(r=>resolve=r));detach(x);await tick();event(x);ack(x);await tick();
 assert.equal(typeof resolve,'function');(duplicate==='ack'?ack:event)(x);
 assert.equal(x.obs.snapshot().reason,duplicate==='ack'?'DETACH_REPLY_DUPLICATE':'DETACH_EVENT_DUPLICATE');
 resolve(record('AFTER'));await tick();assert.equal(x.obs.snapshot().status,'INVALID_PAIR');assert.equal(x.obs.snapshot().before,null);assert.equal(x.stops,0);x.obs.dispose();
});
test('guard stop during AFTER discards held ACK even after successful capture',async()=>{
 let resolve;const x=h(p=>p==='BEFORE'?Promise.resolve(record(p)):new Promise(r=>resolve=r));detach(x);await tick();event(x);ack(x);await tick();
 x.g.stopping=true;resolve(record('AFTER'));await tick();assert.equal(x.obs.snapshot().reason,'GUARD_STOPPED');assert.equal(x.forwarded.filter(m=>m.id===7).length,0);assert.equal(x.stops,0);x.obs.dispose();
});
test('same ID auxiliary recreated after detach cannot authorize a held ACK',async()=>{
 let resolve;const x=h(p=>p==='BEFORE'?Promise.resolve(record(p)):new Promise(r=>resolve=r));detach(x);await tick();event(x);ack(x);await tick();
 x.g.sessions.set('A',{ready:true,auxiliary:true,frame:'F'});resolve(record('AFTER'));await tick();assert.equal(x.obs.snapshot().reason,'SCOPE_INVALID');assert.equal(x.forwarded.filter(m=>m.id===7).length,0);assert.equal(x.stops,1);x.obs.dispose();
});
test('dispose with already stopped guard drops held reply and ignores late AFTER result',async()=>{
 let resolve;const x=h(p=>p==='BEFORE'?Promise.resolve(record(p)):new Promise(r=>resolve=r));detach(x);await tick();ack(x);event(x);await tick();
 x.g.stopping=true;x.obs.dispose();resolve(record('AFTER'));await tick();assert.equal(x.obs.snapshot().reason,'GUARD_STOPPED');assert.equal(x.forwarded.filter(m=>m.id===7).length,0);assert.equal(x.stops,0);
});

test('before timeout after auxiliary expiration never forwards the original delayed detach',async()=>{
 const x=h(()=>new Promise(()=>{}),{timeoutMs:5});detach(x);x.g.sessions.delete('A');await new Promise(r=>setTimeout(r,12));
 assert.equal(x.sent.length,0);assert.equal(x.obs.snapshot().reason,'SCOPE_INVALID');assert.equal(x.stops,1);x.obs.dispose();
});
test('real gateway synchronous authorization cannot outlive stop while observer awaits',async()=>{
 const {FixtureGateway}=await import('./fixture-gateway.mjs');let resolve,kills=0;const sent=[],forwarded=[];
 const g=new FixtureGateway({send:raw=>sent.push(JSON.parse(raw)),close(){}},()=>kills++);
 g.createdPage='T';g.primary='P';g.sessions.set('P',{ready:true,frame:'F'});g.sessions.set('A',{ready:true,auxiliary:true,frame:'F'});
 g.traceReads.snapshot=()=>({observation:'OWN_TRACE',adoptable:true,eof:true,close_confirmed:true,pending:0,uncommitted:0,failure:null,reads:1,completed:1});
 g.onmessage=raw=>forwarded.push(JSON.parse(raw));const obs=installDetachEvidence({gateway:g},'https://fixture.invalid/',{capture:()=>new Promise(r=>resolve=r)});
 g.send(JSON.stringify({id:7,method:'Target.detachFromTarget',params:{sessionId:'A'}}));assert.equal(sent.length,0);assert.equal(g.client.get(7),'Target.detachFromTarget');
 g.fail('PROTECTION_LOST');resolve(record('BEFORE'));await tick();assert.equal(sent.length,0);assert.equal(forwarded.length,0);assert.equal(kills,1);assert.equal(g.stats.fatal,'PROTECTION_LOST');assert.equal(obs.snapshot().reason,'GUARD_STOPPED');obs.dispose();g.dispose();
});

test('scope rejection while handling duplicate cannot forward held or duplicate reply after stop',async()=>{
 let resolve;const x=h(p=>p==='BEFORE'?Promise.resolve(record(p)):new Promise(r=>resolve=r));detach(x);await tick();event(x);ack(x);await tick();
 x.g.primary='OTHER';ack(x);assert.equal(x.g.stopping,true);assert.equal(x.forwarded.filter(m=>m.id===7).length,0);assert.equal(x.obs.snapshot().reason,'SCOPE_INVALID');
 resolve(record('AFTER'));await tick();assert.notEqual(x.obs.snapshot().status,'OBSERVED');assert.equal(x.stops,1);x.obs.dispose();
});
