import{isBeaconURL,javascriptResponse}from'./beacon-read.mjs';
// The same reviewed check, applied only after the caller's existing approved factory.
import{RequestMeter400}from'../natural-reads/scoped400-meter.mjs';
import{NaturalReadBoundary}from'../natural-reads/gateway.mjs';import{classifyRequest}from'./policy.mjs';import{ONE_RUN_REQUEST_LIMIT as STAGING_REQUEST_LIMIT}from'../natural-reads/scoped400-limit.mjs';
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
export function forApprovedGateway(Approved){if(typeof Approved!=='function')throw Error('STAGING_APPROVED_GATEWAY_REQUIRED');return class extends Approved{constructor(...a){super(...a);if(!(this.boundary instanceof NaturalReadBoundary)||!this.census||!(this.requestMeter instanceof RequestMeter400)||this.boundary.total!==0||this.boundary.documents!==0||this.boundary.network.size!==0)throw Error('STAGING_APPROVED_400_GATEWAY_REQUIRED');const check=Fixed400Boundary.prototype.check.bind(this.boundary);const passive=this.boundary.passive;this.boundary.passive=function(m){const p=m.params||{},prior=this.network.get(p.requestId),beacon=m.sessionId===this.g.primary&&prior?.url&&isBeaconURL(prior.url)&&m.method==='Network.responseReceived';const out=Reflect.apply(passive,this,[m]);if(beacon&&!this.g.stopping&&!javascriptResponse(p.response)){this.policy??='MIME';this.g.fail('AB_BOUNDARY_RESPONSE');}return out;};this.boundary.check=e=>{const stopped=this.stopping,c=check(e);this.census.checked(c,stopped,this.boundary.total,{resource:classifyRequest(e).kind,resource_type:e.resourceType});return c;};}};}
