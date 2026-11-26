import{closedGateway}from'../staging-cloudflare-origin/closed-only-gateway.mjs';
export async function approvedGateway({hash}={}){const{admit}=await import('./admission.mjs');await admit({live:true,...(hash?{hash}:{})});return class extends closedGateway(){constructor(...a){super(...a);this.memory=false;}};}
