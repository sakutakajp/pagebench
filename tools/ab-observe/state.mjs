// Shared read-only samples; not the B-only Nuxt hooks, identity observer or body inspection.
// No text, IDs, attribute values, URLs or error messages leave the renderer.
export function sampleState(){const unknownViewport=()=>({meta:'UNKNOWN',layout:'UNKNOWN',screen:'UNKNOWN',dpr:'UNKNOWN'});let viewport=unknownViewport();try{
 const meta=document.querySelectorAll('meta[name="viewport" i]');const screenKnown=Number.isFinite(screen.width)&&Number.isFinite(screen.height),dprKnown=Number.isFinite(devicePixelRatio);let layout='UNKNOWN';
 if(meta.length===0)layout='NOT_COMPARED';else if(meta.length===1&&Number.isFinite(innerWidth)&&Number.isFinite(innerHeight))layout=innerWidth===412&&innerHeight===823?'MATCH':'DIFFERENT';
 viewport={meta:meta.length===0?'ABSENT':meta.length===1?'PRESENT':'AMBIGUOUS',layout,screen:!screenKnown?'UNKNOWN':screen.width===412&&screen.height===823?'MATCH':'DIFFERENT',dpr:!dprKnown?'UNKNOWN':devicePixelRatio===1.75?'MATCH':'DIFFERENT'};
 }catch{}
 try{
 const b=document.body;if(!b)return{state:'UNKNOWN',body:'UNKNOWN',original_main:false,original_heading:false,heading:false,error_status:null,viewport};
 const text=b.innerText,main=document.querySelector('main#home-content'),original=document.querySelector('main#home-content h1#home-title'),heading=document.querySelector('main h1,main h2');
 const markers=document.querySelectorAll('main img[src="/error.webp"]');let status=null;
 if(markers.length===1){const m=markers[0].closest('main'),p=m.querySelectorAll(':scope > div > p');if(p.length===1&&m.querySelectorAll('h1').length===1&&m.querySelectorAll('a[href="/"]').length===1){const ns=p[0].childNodes;if(ns.length<=3&&Array.from(ns).every(n=>n.nodeType===3&&n.length<=16)&&Array.from(ns).reduce((n,v)=>n+v.length,0)<=16){const t=Array.from(ns,n=>n.data).join('');if(/^\s*[45][0-9]{2}\s*$/.test(t))status=Number(t.trim());}}}
 const body=typeof text==='string'?(text.trim().length>=20?'GE20':'LT20'):'UNKNOWN';return{state:status===500?'ERROR_500':main&&original&&body==='GE20'?'ORIGINAL_CONTENT':body==='LT20'?'SHORT_CONTENT':'OTHER_OR_UNKNOWN',body,original_main:!!main,original_heading:!!original,heading:!!heading,error_status:status,viewport};
 }catch{return{state:'UNKNOWN',body:'UNKNOWN',original_main:false,original_heading:false,heading:false,error_status:null,viewport};}}
const STATES=['UNKNOWN','ERROR_500','ORIGINAL_CONTENT','SHORT_CONTENT','OTHER_OR_UNKNOWN'];
export function safeViewport(v){if(!v||!['ABSENT','PRESENT','AMBIGUOUS','UNKNOWN'].includes(v.meta)||!['MATCH','DIFFERENT','NOT_COMPARED','UNKNOWN'].includes(v.layout)||!['MATCH','DIFFERENT','UNKNOWN'].includes(v.screen)||!['MATCH','DIFFERENT','UNKNOWN'].includes(v.dpr))return null;
 if(v.meta==='ABSENT'&&v.layout!=='NOT_COMPARED'||v.meta==='PRESENT'&&!['MATCH','DIFFERENT','UNKNOWN'].includes(v.layout)||['AMBIGUOUS','UNKNOWN'].includes(v.meta)&&v.layout!=='UNKNOWN')return null;return{meta:v.meta,layout:v.layout,screen:v.screen,dpr:v.dpr};}
export function comparableViewport(v){v=safeViewport(v);return !!v&&v.screen==='MATCH'&&v.dpr==='MATCH'&&['PRESENT','ABSENT'].includes(v.meta)&&v.layout!=='UNKNOWN';}
export function safeSample(v){if(!v||!STATES.includes(v.state)||!['UNKNOWN','GE20','LT20'].includes(v.body)||['original_main','original_heading','heading'].some(k=>typeof v[k]!=='boolean')||v.error_status!==null&&(!Number.isInteger(v.error_status)||v.error_status<400||v.error_status>599))return null;
 const viewport=safeViewport(v.viewport);if(!viewport)return null;const s={state:v.state,body:v.body,original_main:v.original_main,original_heading:v.original_heading,heading:v.heading,error_status:v.error_status,viewport};
 if(s.original_heading&&!s.original_main||s.state==='ERROR_500'&&s.error_status!==500||s.error_status===500&&s.state!=='ERROR_500'||s.state==='ORIGINAL_CONTENT'&&(!s.original_main||!s.original_heading||s.body!=='GE20')||s.state==='SHORT_CONTENT'&&s.body!=='LT20')return null;return s;}
export function classifyPair(first,last,same){first=safeSample(first);last=safeSample(last);if(!first||!last||same!==true||first.state==='UNKNOWN'||last.state==='UNKNOWN')return'UNKNOWN';if(first.state==='ORIGINAL_CONTENT'&&last.state==='ERROR_500')return'SAME_DOCUMENT_500_TRANSITION';if(first.state==='ORIGINAL_CONTENT'&&last.state==='ORIGINAL_CONTENT')return'ORIGINAL_AT_BOTH_SAMPLES';if(last.state==='SHORT_CONTENT')return'SHORT_CONTENT';return'ORIGINAL_DOM_NOT_OBSERVED_OR_OTHER';}
export async function commonObserver(ctx,target){const g=ctx.gateway,primary=g.primary,ps=g.sessions.get(primary),forward=g.forward;let active=true,nav=null,first=null,pending=null,invalid=false,fcp=false;
 const healthy=()=>active&&!g.stopping&&!g.stats.fatal&&g.primary===primary&&g.sessions.get(primary)===ps&&ps?.ready;
 const sample=async()=>{if(!healthy()||!nav)return null;const a=(await g.call('Page.getFrameTree',{},primary)).frameTree?.frame;if(!healthy())return null;const value=safeSample(await ctx.page.evaluate(sampleState));if(!healthy())return null;const b=(await g.call('Page.getFrameTree',{},primary)).frameTree?.frame;
 if(!healthy()||!a||!b||a.url!==target||b.url!==target||a.id!==ps.frame||a.id!==b.id||a.loaderId!==nav||a.loaderId!==b.loaderId){invalid=true;return null;}return value;};
 g.forward=function(m){const result=forward.call(g,m);if(!healthy()||m.sessionId!==primary)return result;
  if(m.method==='Page.frameNavigated'&&m.params?.frame?.id===ps.frame&&!m.params.frame.parentId){const fr=m.params.frame;if(fr.url!==target||nav&&nav!==fr.loaderId)invalid=true;else if(typeof fr.loaderId==='string')nav=fr.loaderId;}
  if(m.method==='Page.lifecycleEvent'&&m.params?.name==='firstContentfulPaint'&&m.params.frameId===ps.frame&&m.params.loaderId===nav&&!fcp&&!invalid){fcp=true;pending=sample().then(v=>{first=v;},()=>{invalid=true;});}return result;};
 await g.call('Page.enable',{},primary);await g.call('Page.setLifecycleEventsEnabled',{enabled:true},primary);
 return {async finish(){if(pending)await pending;if(!healthy())throw Error('OBSERVER_STOPPED');const end=await sample();return{first:safeSample(first),end:safeSample(end),same_document:!!nav&&!invalid&&!!first&&!!end,classification:classifyPair(first,end,!!nav&&!invalid),sampling:'FIRST_POST_FCP_AND_45S_DEADLINE',between_samples:'NOT_OBSERVED'};},dispose(){active=false;g.forward=forward;}};
}
