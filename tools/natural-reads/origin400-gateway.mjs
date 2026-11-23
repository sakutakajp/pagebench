import{captureGateway,runtimeScope}from'../origin-capture/once-output.mjs';
import{RequestMeter400}from'./scoped400-meter.mjs';import{PAGE,PAYLOAD,ASSET}from'./control.mjs';
import{ONE_RUN_REQUEST_LIMIT as STAGING_REQUEST_LIMIT}from'./scoped400-limit.mjs';
// Exact one-run400 policy; historical NaturalReadGateway remains byte-identical.
import{NaturalReadGateway,NaturalReadBoundary}from'./gateway.mjs';import{classifyRequest,TARGET}from'./policy.mjs';import{StopCensus}from'./stop-census.mjs';
class Fixed400Boundary extends NaturalReadBoundary{
 check(e){
  const c=classifyRequest(e);if(c.code!=='ALLOW')return this.reject(c.code,e);
  if(this.g.stopping||!this.g.sessions.get(this.g.primary)?.ready||e.frameId!==this.g.sessions.get(this.g.primary).frame)return this.reject('BINDING',e);
  if(c.kind==='MAIN_HTML'&&++this.documents!==1)return this.reject('NAVIGATION',e);
  if(++this.total>STAGING_REQUEST_LIMIT)return this.reject('LIMIT',e);
  if(typeof e.networkId!=='string'||!e.networkId||this.network.has(e.networkId))return this.reject('BINDING',e);
  this.network.set(e.networkId,{url:e.request.url,kind:c.kind,frame:e.frameId});this.g.stopEvidence.meta.bind(this.g.primary,e);this.g.readSignals?.bind(e,c.kind);return'ALLOW';
 }
}
function fixed400(Base){return class extends Base{
 constructor(...a){super(...a);this.boundary=new Fixed400Boundary(this);this.census=new StopCensus();this.requestMeter=new RequestMeter400(this);const check=this.boundary.check.bind(this.boundary);this.boundary.check=e=>{const stopped=this.stopping,c=check(e);this.census.checked(c,stopped,this.boundary.total,{resource:classifyRequest(e).kind,resource_type:e.resourceType});return c;};}
 async receive(raw){if(typeof raw==='string'&&raw.length<=1048576)try{const m=JSON.parse(raw);this.requestMeter.observe(m,this.stopping);if(m.method==='Fetch.requestPaused'&&m.sessionId===this.primary)this.census.receivedFetch(this.stopping);}catch{if(this.requestMeter)this.requestMeter.partial=true;}return super.receive(raw);}
 beginCleanup(){this.requestMeter?.freeze();return super.beginCleanup();}
 fail(code){this.requestMeter?.freeze();if(!this.stopping)this.census?.stopping();return super.fail(code);}
};}
export async function approved400Gateway({directory}){const{admission400}=await import('./origin400-admission.mjs');await admission400();return captureGateway(fixed400(NaturalReadGateway),{directory,scope:runtimeScope()});}
function fixtureHtml(n){return '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><script>window.fixed400={ready:false,armed:false,prefetch:0};</script>'+[PAGE,PAYLOAD,ASSET].map(u=>'<link rel="prefetch" href="'+u+'" onload="window.fixed400.prefetch++">').join('')+'</head><body><main><h1>Fixed bounded400 fixture</h1><p>Known fixed visible body longer than twenty characters.</p></main><script>window.fixed400Arm=function(){if(window.fixed400.armed)return null;window.fixed400.armed=true;globalThis.setTimeout(async()=>{try{const read=u=>fetch(u,{credentials:"omit",cache:"no-store"}).then(r=>r.text());await read("/_nuxt/fixture-cap-repeat.js");await read("/_nuxt/fixture-cap-repeat.js");await Promise.all(Array.from({length:'+n+'-2},(_,i)=>read("/_nuxt/fixture-cap-"+i+".js")));window.fixed400.ready=true;}catch{}},250);return{state:"ARMED",scheduled:true}};</script></body></html>';}
// The only ungated export has no continuation/upstream path: all content is fixed RAM.
export function closed400MemoryGateway(mode='within'){if(!['within','over'].includes(mode))throw Error('CLOSED_MODE');return class extends fixed400(NaturalReadGateway){
 async start(e){if(this.stopping)return;const c=classifyRequest(e);let type,body;if(c.code==='ALLOW'&&e.request.url===TARGET){type='text/html';body=fixtureHtml(mode==='within'?STAGING_REQUEST_LIMIT-4:STAGING_REQUEST_LIMIT+1);}else if(c.code==='ALLOW'&&e.request.url===PAGE){type='text/html';body='<!doctype html><h1>Fixed prefetched page</h1>';}else if(c.code==='ALLOW'&&e.request.url===PAYLOAD){type='application/json';body='{"fixed":true}';}else if(c.code==='ALLOW'&&e.request.url===ASSET){type='text/javascript';body='/* fixed prefetched asset */';}else if(c.code==='ALLOW'&&c.kind==='NUXT_STATIC'&&/^https:\/\/staging\.hirameki\.dev\/_nuxt\/fixture-cap-(?:\d+|repeat)\.js$/.test(e.request.url)){type='text/javascript';body='/* fixed closed resource */';}else{this.fail('AB_BOUNDARY_BINDING');return;}
 this.active.add(e.networkId);this.stats.max_inflight=Math.max(this.stats.max_inflight,this.active.size);await this.call('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:type},{name:'Cache-Control',value:'public,max-age=0'}],body:Buffer.from(body).toString('base64')},this.primary);
 }
};}
