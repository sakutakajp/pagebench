// Same policy/counters/ownership and original reject. Labels sit at each branch,
// are captured synchronously in RAM, and never cause an await/write/command here.
import {forApprovedGateway as prior} from '../staging-beacon-policy-v2/boundary.mjs';
import {classifyRequest} from '../staging-beacon-policy-v2/policy.mjs';
import {ONE_RUN_REQUEST_LIMIT as STAGING_REQUEST_LIMIT} from '../natural-reads/scoped400-limit.mjs';
import {installBranch} from './branch.mjs';
export function exactCheck(e,capture){
 const c=classifyRequest(e);if(c.code!=='ALLOW'){capture('POLICY_REJECT',c.code,e);return this.reject(c.code,e);}
 if(this.g.stopping){capture('STOPPING','BINDING',e);return this.reject('BINDING',e);}
 if(!this.g.sessions.get(this.g.primary)?.ready){capture('PRIMARY_NOT_READY','BINDING',e);return this.reject('BINDING',e);}
 if(e.frameId!==this.g.sessions.get(this.g.primary).frame){capture('FRAME_MISMATCH','BINDING',e);return this.reject('BINDING',e);}
 if(c.kind==='MAIN_HTML'&&++this.documents!==1){capture('DOCUMENT_REPEAT','NAVIGATION',e);return this.reject('NAVIGATION',e);}
 if(++this.total>STAGING_REQUEST_LIMIT){capture('TOTAL_LIMIT','LIMIT',e);return this.reject('LIMIT',e);}
 if(typeof e.networkId!=='string'){capture(Object.hasOwn(e,'networkId')?'NETWORK_ID_NONSTRING':'NETWORK_ID_MISSING','BINDING',e);return this.reject('BINDING',e);}
 if(!e.networkId){capture('NETWORK_ID_EMPTY','BINDING',e);return this.reject('BINDING',e);}
 if(this.network.has(e.networkId)){capture('NETWORK_ID_ALREADY_BOUND','BINDING',e);return this.reject('BINDING',e);}
 this.network.set(e.networkId,{url:e.request.url,kind:c.kind,frame:e.frameId});this.g.stopEvidence.meta.bind(this.g.primary,e);this.g.readSignals?.bind(e,c.kind);return'ALLOW';
}
export function forApprovedGateway(Approved){const Prior=prior(Approved);return class extends Prior{constructor(...a){super(...a);const b=this.boundary,capture=installBranch(this,b);b.check=e=>{const stopped=this.stopping,c=exactCheck.call(b,e,capture);this.census.checked(c,stopped,b.total,{resource:classifyRequest(e).kind,resource_type:e.resourceType});return c;};}};}
