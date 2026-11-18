import{test}from'node:test';import assert from'node:assert/strict';
import{probeClass,compare,MODES}from'./operation-comparison.mjs';import{autoAttachParams}from'./diagnostic.mjs';
function model(mode,ack=false){const sent=[];const wire={send(raw){const m=JSON.parse(raw);sent.push(m);if(ack)queueMicrotask(()=>wire.onmessage(JSON.stringify({id:m.id,result:m.method==='Browser.getVersion'?{product:'Chrome/157.0.8103.50'}:{}})));},close(){}};const Type=probeClass(mode);const p=new Type(wire,()=>{});p.sessions=new Map([['A',{kind:'TAB',target:'TA',parent:null,ready:false}],['B',{kind:'TAB',target:'TB',parent:null,ready:false}],['U',{kind:'BROWSER_UI',target:'TU',parent:null,ready:false}]]);return{p,sent,wire};}
test('one-factor modes withhold exactly one operation; all other wire commands retain exact parameters',async()=>{
 const expected=['A','B','U'];for(const mode of MODES.filter(m=>m==='FULL_CONTROL'||m.startsWith('HOLD_'))){const h=model(mode);const tasks=expected.map(s=>h.p.call('Target.setAutoAttach',autoAttachParams(true),s));const settled=Promise.allSettled(tasks);const held=mode==='HOLD_FIRST_TAB_AUTOATTACH'?'A':mode==='HOLD_SECOND_TAB_AUTOATTACH'?'B':mode==='HOLD_UI_AUTOATTACH'?'U':null;assert.deepEqual(h.sent.map(m=>m.sessionId),expected.filter(s=>s!==held));assert.ok(h.sent.every(m=>JSON.stringify(m.params)===JSON.stringify(autoAttachParams(true))));assert.equal(h.p.withheld,held?1:0);h.p.stop('CLEANUP');await settled;assert.equal(h.p.held.length,0);assert.equal(h.p.result().target_resumes,0);assert.equal(h.p.probeSnapshot.intervention_applied,true);}
});
test('unpaused duplicate parent is correlated to the actual operation without IDs or URLs',async()=>{
 const h=model('FULL_CONTROL');h.p.createdTab='TB';h.p.tabSession='B';h.p.bound=true;const tasks=['A','B','U'].map(s=>h.p.call('Target.setAutoAttach',autoAttachParams(true),s));const settled=Promise.allSettled(tasks);
 await h.p.receive(JSON.stringify({method:'Target.attachedToTarget',sessionId:'B',params:{sessionId:'NEWSECRET',targetInfo:{type:'browser_ui',targetId:'TU',url:'SECRET',title:'SECRET'},waitingForDebugger:false}}));await settled;
 const e=h.p.probeSnapshot.unpaused_ui_parent;assert.equal(e.identity.relation,'SAME_TARGET_OTHER_SESSION');assert.equal(e.same_parent,'DIFFERENT_PARENT');assert.deepEqual(e.notification_parent_operation,{role:'SECOND_TAB',state:'SENT_PENDING',command_no:2});assert.deepEqual(e.prior_primary_operation,{role:'BROWSER_UI',state:'SENT_PENDING',command_no:3});assert.equal(h.p.code,'TARGET_NOT_PAUSED');assert.ok(!JSON.stringify(h.p.probeSnapshot).includes('SECRET'));assert.ok(!h.sent.some(m=>m.method.includes('Runtime')));
});
test('withheld and acknowledged operations are distinguished from unissued operations',async()=>{
 const h=model('HOLD_UI_AUTOATTACH',true);await h.p.call('Target.setAutoAttach',autoAttachParams(true),'A');const held=h.p.call('Target.setAutoAttach',autoAttachParams(true),'U');const settled=Promise.allSettled([held]);assert.equal(h.p.operation('A').state,'ACKNOWLEDGED');assert.equal(h.p.operation('B').state,'NOT_SENT');assert.equal(h.p.operation('U').state,'WITHHELD');h.p.stop('CLEANUP');await settled;
});
test('no-create control sends no target creation/resume/navigation and never claims initialization',async()=>{
 const h=model('NO_CREATE',true);h.p.sessions.clear();const r=await h.p.collect();assert.equal(r.code,'NO_PAUSED_PAGE');assert.equal(r.page_protocol_initialized,false);assert.ok(!h.sent.some(m=>/createTarget|Runtime|Page\./.test(m.method)));assert.equal(h.p.probeSnapshot.mode,'NO_CREATE');
});
test('unknown and active targets still stop, including under an intervention',async()=>{
 for(const type of ['service_worker','not_known']){const h=model('HOLD_UI_AUTOATTACH');await h.p.receive(JSON.stringify({method:'Target.attachedToTarget',params:{sessionId:'X',targetInfo:{targetId:'X',type},waitingForDebugger:true}}));assert.ok(['AUXILIARY_TARGET_STOP','TARGET_TYPE_UNCLASSIFIED'].includes(h.p.code));assert.equal(h.sent.length,0);}
});
const record=(mode,version='157.0.8103.50')=>({comparison:{mode,operations:[],intervention_applied:false},result:{code:'CDP_TIMEOUT',browser_version:{code:'VERSION_VERIFIED',version},cleanup:{status:'complete'},site_navigations:0,outbound_forwarding:0,target_resumes:0,browser_ui_resumes:0}});
test('comparison driver runs distinct modes serially, records unperformed interventions honestly',async()=>{let active=0;const seen=[];const out=await compare(async mode=>{assert.equal(++active,1);seen.push(mode);await Promise.resolve();active--;return record(mode);});assert.deepEqual(seen,MODES);assert.equal(out.summary.completed,MODES.length);assert.equal(out.summary.version_comparability,'SAME_VERSION');assert.ok(out.records.every(r=>r.comparison.intervention_applied===false));});
test('version changes, failed cleanup and nonzero safety counters prevent further comparisons',async()=>{
 let count=0;const changed=await compare(async mode=>record(mode,++count===1?'157.0.8103.50':'157.0.8103.78'));assert.equal(changed.summary.completed,2);assert.equal(changed.summary.terminal_status,'BROWSER_VERSION_CHANGED');
 for(const mutate of [r=>r.result.cleanup.status='failed',r=>r.result.outbound_forwarding=1]){let n=0;const out=await compare(async mode=>{n++;const r=record(mode);mutate(r);return r;});assert.equal(n,1);assert.equal(out.summary.terminal_status,'SAFETY_OR_CLEANUP_FAILED');}
});

test('single-operation arms send exactly the chosen candidate and hold every other candidate',async()=>{
 for(const [mode,wanted]of [['ONLY_FIRST_TAB_AUTOATTACH','A'],['ONLY_UI_AUTOATTACH','U'],['ONLY_SECOND_TAB_AUTOATTACH','B']]){
  const h=model(mode);const tasks=['A','B','U'].map(s=>h.p.call('Target.setAutoAttach',autoAttachParams(true),s));const settled=Promise.allSettled(tasks);assert.deepEqual(h.sent.map(m=>m.sessionId),[wanted]);assert.equal(h.p.withheld,2);h.p.stop('CLEANUP');await settled;assert.equal(h.p.probeSnapshot.intervention_applied,true);assert.equal(h.p.held.length,0);assert.ok(!h.sent.some(m=>/Runtime|Page/.test(m.method)));
 }
});
