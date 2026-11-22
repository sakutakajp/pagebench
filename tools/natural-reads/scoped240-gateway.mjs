import{STAGING_REQUEST_LIMIT}from'./staging-limits.mjs';
// Shared240 staging policy; historical NaturalReadGateway remains byte-identical.
import{NaturalReadGateway,NaturalReadBoundary}from'./gateway.mjs';import{classifyRequest,TARGET}from'./policy.mjs';import{StopCensus}from'./stop-census.mjs';
class Fixed240Boundary extends NaturalReadBoundary{
 check(e){
  const c=classifyRequest(e);if(c.code!=='ALLOW')return this.reject(c.code,e);
  if(this.g.stopping||!this.g.sessions.get(this.g.primary)?.ready||e.frameId!==this.g.sessions.get(this.g.primary).frame)return this.reject('BINDING',e);
  if(c.kind==='MAIN_HTML'&&++this.documents!==1)return this.reject('NAVIGATION',e);
  if(++this.total>STAGING_REQUEST_LIMIT)return this.reject('LIMIT',e);
  if(typeof e.networkId!=='string'||!e.networkId||this.network.has(e.networkId))return this.reject('BINDING',e);
  this.network.set(e.networkId,{url:e.request.url,kind:c.kind,frame:e.frameId});this.g.stopEvidence.meta.bind(this.g.primary,e);this.g.readSignals?.bind(e,c.kind);return'ALLOW';
 }
}
function fixed240(Base){return class extends Base{
 constructor(...a){super(...a);this.boundary=new Fixed240Boundary(this);this.census=new StopCensus();const check=this.boundary.check.bind(this.boundary);this.boundary.check=e=>{const stopped=this.stopping,c=check(e);this.census.checked(c,stopped,this.boundary.total,{resource:classifyRequest(e).kind,resource_type:e.resourceType});return c;};}
 async receive(raw){if(typeof raw==='string'&&raw.length<=1048576)try{const m=JSON.parse(raw);if(m.method==='Fetch.requestPaused'&&m.sessionId===this.primary)this.census.receivedFetch(this.stopping);}catch{}return super.receive(raw);}
 fail(code){if(!this.stopping)this.census?.stopping();return super.fail(code);}
};}
export async function approved240Gateway(){const{admission240}=await import('./scoped240-admission.mjs');await admission240();return fixed240(NaturalReadGateway);}
function fixtureHtml(n){return '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"></head><body><main><h1>Fixed bounded240 fixture</h1><p>Known fixed visible body longer than twenty characters.</p></main><script>window.fixed240={ready:false,armed:false};window.fixed240Arm=function(){if(window.fixed240.armed)return null;window.fixed240.armed=true;globalThis.setTimeout(()=>Promise.all(Array.from({length:'+n+'},(_,i)=>fetch("/_nuxt/fixture-cap-"+i+".js",{credentials:"omit"}).then(r=>r.text()))).then(()=>window.fixed240.ready=true).catch(()=>{}),250);return{state:"ARMED",scheduled:true}};</script></body></html>';}
// The only ungated export has no continuation/upstream path: all content is fixed RAM.
export function closed240MemoryGateway(mode='within'){if(!['within','over'].includes(mode))throw Error('CLOSED_MODE');return class extends fixed240(NaturalReadGateway){
 async start(e){if(this.stopping)return;const c=classifyRequest(e);let type,body;if(c.code==='ALLOW'&&e.request.url===TARGET){type='text/html';body=fixtureHtml(mode==='within'?STAGING_REQUEST_LIMIT-1:STAGING_REQUEST_LIMIT+4);}else if(c.code==='ALLOW'&&c.kind==='NUXT_STATIC'&&/^https:\/\/staging\.hirameki\.dev\/_nuxt\/fixture-cap-\d+\.js$/.test(e.request.url)){type='text/javascript';body='/* fixed closed resource */';}else{this.fail('AB_BOUNDARY_BINDING');return;}
 this.active.add(e.networkId);this.stats.max_inflight=Math.max(this.stats.max_inflight,this.active.size);await this.call('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:type},{name:'Cache-Control',value:'public,max-age=0'}],body:Buffer.from(body).toString('base64')},this.primary);
 }
};}
