// Exact a10b8da boundary core; only the memory-only constructor is exported.
import{NaturalReadGateway,NaturalReadBoundary}from'../natural-reads/gateway.mjs';import{classifyRequest,TARGET}from'./policy.mjs';import{StopCensus}from'../natural-reads/stop-census.mjs';import{RequestMeter400}from'../natural-reads/scoped400-meter.mjs';import{ONE_RUN_REQUEST_LIMIT as STAGING_REQUEST_LIMIT}from'../natural-reads/scoped400-limit.mjs';
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
export function closedGateway(){return class extends fixed400(NaturalReadGateway){constructor(...a){super(...a);this.memory=true;}};}
