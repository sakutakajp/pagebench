import{test}from'node:test';import assert from'node:assert/strict';
import{ResponseBoundObserver,classifyUnpausedUI}from'./response-bound.mjs';import{freezeObservation,freezeUnpausedUI}from'./diagnostic.mjs';
const info=(sid,target,parent)=>({method:'Target.attachedToTarget',...(parent?{sessionId:parent}:{}),params:{sessionId:sid,targetInfo:{type:'browser_ui',targetId:target,url:'SECRET?query=SECRET',title:'SECRET'},waitingForDebugger:false}});
function sessions(ready=false){return new Map([['T',{target:'TAB',kind:'TAB',parent:null,ready:true}],['U',{target:'UI',kind:'BROWSER_UI',parent:'T',ready}]]);}
test('unpaused UI is classified by memory identity only, never by raw content',()=>{
 for(const[sid,target,relation]of [['U','UI','SAME_SESSION_SAME_TARGET'],['U','OTHER','SAME_SESSION_DIFFERENT_TARGET'],['U2','UI','SAME_TARGET_OTHER_SESSION'],['U2','OTHER','NEW_TARGET']]){const r=classifyUnpausedUI(info(sid,target),sessions(),'T');assert.equal(r.relation,relation);assert.ok(!JSON.stringify(r).includes('SECRET'));}
 assert.equal(classifyUnpausedUI(info('U2','UI'),sessions(false),'T').prior_guard,'INITIALIZING');assert.equal(classifyUnpausedUI(info('U2','UI'),sessions(true),'T').prior_guard,'READY');
 assert.equal(classifyUnpausedUI(info('U2','UI'),sessions(),'T').prior_scope,'SELECTED_TAB');assert.equal(classifyUnpausedUI(info('U2','UI'),sessions(),'OTHER').prior_scope,'OTHER_TAB');assert.equal(classifyUnpausedUI(info('U2','UI','T'),sessions(),null).prior_scope,'UNBOUND_TAB');
 assert.equal(classifyUnpausedUI(info('U2','NEW','T'),sessions(),'T').parent_relation,'TAB');assert.equal(classifyUnpausedUI(info('U2','NEW','UNKNOWN'),sessions(),'T').parent_relation,'UNKNOWN');
});
test('all unpaused variants still terminate with zero commands, never ignore or resume a duplicate',async()=>{
 for(const[sid,target]of [['U','UI'],['U','OTHER'],['U2','UI'],['U2','OTHER']])for(const ready of [true,false]){
  let sent=0,killed=0;const o=new ResponseBoundObserver({send(){sent++;},close(){}},()=>killed++);o.sessions=sessions(ready);o.tabSession='T';o.bound=true;
  await o.receive(JSON.stringify(info(sid,target)));assert.equal(o.code,'TARGET_NOT_PAUSED');assert.equal(sent,0);assert.equal(killed,1);assert.equal(o.result().target_resumes,0);assert.ok(o.result().unpaused_ui);const frozen=freezeObservation(o.result());assert.ok(Object.isFrozen(frozen.unpaused_ui));assert.ok(!JSON.stringify(frozen).includes('SECRET'));
 }
});
test('invalid/missing identifiers and arbitrary classifier keys never escape',()=>{
 assert.equal(classifyUnpausedUI(info(undefined,{}),sessions(),'T').relation,'INVALID_IDENTIFIERS');assert.equal(freezeUnpausedUI({relation:'SECRET'}),null);
 const r=freezeUnpausedUI({...classifyUnpausedUI(info('U2','UI'),sessions(),'T'),raw_url:'SECRET'});assert.ok(!JSON.stringify(r).includes('SECRET'));assert.deepEqual(Object.keys(r).sort(),['parent_relation','prior_guard','prior_kind','prior_scope','relation']);
});
