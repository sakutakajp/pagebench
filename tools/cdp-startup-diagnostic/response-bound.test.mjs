import{test}from'node:test';import assert from'node:assert/strict';import{ResponseBoundObserver}from'./response-bound.mjs';
function harness(options={}){
 const sent=[];let killed=0;const attach=(type,id,sid,parent)=>wire.onmessage(JSON.stringify({method:'Target.attachedToTarget',...(parent?{sessionId:parent}:{}),params:{sessionId:sid,targetInfo:{type,targetId:id,url:'about:blank',title:'SECRET'},waitingForDebugger:!options.unpaused}}));
 const wire={send(raw){const m=JSON.parse(raw);sent.push(m);queueMicrotask(()=>{
  if(m.method==='Target.createTarget'){
   if(!options.responseFirst){attach('tab','A','A');attach('browser_ui','UI','UI','A');attach('tab','B','B');}
   wire.onmessage(JSON.stringify({id:m.id,result:{targetId:options.mismatch?'MISSING':'B'}}));
   if(options.responseFirst){attach('tab','B','B');}
   return;
  }
  let result=m.method==='Browser.getVersion'?{product:'Chrome/157.0.8103.50'}:m.method==='Target.getTargets'?{targetInfos:[]}:m.method==='Page.getFrameTree'?{frameTree:{frame:{url:'about:blank'}}}:{};
  wire.onmessage(JSON.stringify({id:m.id,result}));
  if(m.method==='Target.setAutoAttach'&&m.sessionId==='B'){
   if(options.extraAfter){queueMicrotask(()=>attach('tab','C','C'));return;}
   if(options.worker){attach('worker','W','W','B');return;}
   attach('page','P','P','B');
  }
 });},close(){}};
 const observer=new ResponseBoundObserver(wire,()=>killed++);return{observer,sent,get killed(){return killed;}};
}
test('response ID selects second paused root, not first; others never receive page or resume commands',async()=>{const h=harness(),r=await h.observer.collect();assert.equal(r.code,'BLANK_PAGE_PROTOCOL_READY');assert.equal(r.response_id_bound,true);assert.equal(r.candidate_tabs,2);assert.equal(r.quarantined_tabs,1);assert.equal(r.target_resumes,0);assert.equal(h.observer.tabSession,'B');assert.deepEqual(h.sent.filter(m=>m.method.startsWith('Page.')).map(m=>m.sessionId),['P','P']);assert.ok(h.sent.filter(m=>['A','UI'].includes(m.sessionId)).every(m=>m.method==='Target.setAutoAttach'));assert.ok(!JSON.stringify(r).includes('SECRET'));});
test('response before attachment also binds same ID',async()=>{const h=harness({responseFirst:true}),r=await h.observer.collect();assert.equal(r.code,'BLANK_PAGE_PROTOCOL_READY');assert.equal(h.observer.tabSession,'B');});
test('mismatching response ID times out closed without initializing any candidate',async()=>{const h=harness({mismatch:true}),r=await h.observer.collect();assert.equal(r.code,'TAB_BINDING_FAILED');assert.equal(r.response_id_bound,false);assert.equal(h.sent.filter(m=>m.method.startsWith('Page.')).length,0);assert.equal(h.killed,1);});
test('new root after binding, worker, and unpaused targets still stop closed',async()=>{for(const[options,code]of [[{extraAfter:true},'EXTRA_TAB_REJECTED'],[{worker:true},'AUXILIARY_TARGET_STOP'],[{unpaused:true},'TARGET_NOT_PAUSED']]){const h=harness(options),r=await h.observer.collect();assert.equal(r.code,code);assert.equal(r.target_resumes,0);assert.equal(h.killed,1);}});
test('candidate limit and inconsistent session ancestry never initialize an unbound page',async()=>{const h=harness();h.observer.createIssued=true;for(let i=0;i<4;i++)await h.observer.receive(JSON.stringify({method:'Target.attachedToTarget',params:{sessionId:'S'+i,targetInfo:{type:'tab',targetId:'T'+i,url:'about:blank'},waitingForDebugger:true}}));assert.equal(h.observer.code,'EXTRA_TAB_REJECTED');assert.ok(!h.sent.some(m=>m.method.startsWith('Page.')));const q=harness();q.observer.createIssued=true;await q.observer.receive(JSON.stringify({method:'Target.attachedToTarget',sessionId:'UNKNOWN',params:{sessionId:'P',targetInfo:{type:'page',targetId:'P'},waitingForDebugger:true}}));assert.equal(q.observer.code,'PAGE_LINEAGE_REJECTED');});
