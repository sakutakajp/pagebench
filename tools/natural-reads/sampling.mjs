// Same sampleState and existing three-call fences; peek reads completed RAM samples only.
import{sampleState,safeSample,safeViewport,classifyPair}from'../ab-observe/state.mjs';
export async function commonObserverWithPeek(ctx,target){const g=ctx.gateway,primary=g.primary,ps=g.sessions.get(primary),forward=g.forward;let active=true,nav=null,first=null,pending=null,invalid=false,fcp=false;
 const healthy=()=>active&&!g.stopping&&!g.stats.fatal&&g.primary===primary&&g.sessions.get(primary)===ps&&ps?.ready;
 const sample=async()=>{if(!healthy()||!nav)return null;const a=(await g.call('Page.getFrameTree',{},primary)).frameTree?.frame;if(!healthy())return null;const value=safeSample(await ctx.page.evaluate(sampleState));if(!healthy())return null;const b=(await g.call('Page.getFrameTree',{},primary)).frameTree?.frame;
 if(!healthy()||!a||!b||a.url!==target||b.url!==target||a.id!==ps.frame||a.id!==b.id||a.loaderId!==nav||a.loaderId!==b.loaderId){invalid=true;return null;}return value;};
 g.forward=function(m){const result=forward.call(g,m);if(!healthy()||m.sessionId!==primary)return result;
  if(m.method==='Page.frameNavigated'&&m.params?.frame?.id===ps.frame&&!m.params.frame.parentId){const fr=m.params.frame;if(fr.url!==target||nav&&nav!==fr.loaderId)invalid=true;else if(typeof fr.loaderId==='string')nav=fr.loaderId;}
  if(m.method==='Page.lifecycleEvent'&&m.params?.name==='firstContentfulPaint'&&m.params.frameId===ps.frame&&m.params.loaderId===nav&&!fcp&&!invalid){fcp=true;pending=sample().then(v=>{first=v;ctx.gateway.onNaturalProgress?.();},()=>{invalid=true;});}return result;};
 await g.call('Page.enable',{},primary);await g.call('Page.setLifecycleEventsEnabled',{enabled:true},primary);
 return {peek(){return{first:safeSample(first),end:null,same_document:!!nav&&!invalid&&!!first,classification:'UNKNOWN',sampling:'FIRST_POST_FCP_AND_45S_DEADLINE',between_samples:'NOT_OBSERVED'};},async finish(){if(pending)await pending;if(!healthy())throw Error('OBSERVER_STOPPED');const end=await sample();return{first:safeSample(first),end:safeSample(end),same_document:!!nav&&!invalid&&!!first&&!!end,classification:classifyPair(first,end,!!nav&&!invalid),sampling:'FIRST_POST_FCP_AND_45S_DEADLINE',between_samples:'NOT_OBSERVED'};},dispose(){active=false;g.forward=forward;}};
}
