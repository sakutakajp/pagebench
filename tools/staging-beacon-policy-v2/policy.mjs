import{classifyRequest as base}from'../staging-measurement-policy/policy.mjs';import{beaconRead}from'./beacon-read.mjs';import{allowed}from'./static-policy.mjs';
export{TARGET,contentKind,responseMime,routeEvidence}from'../staging-measurement-policy/policy.mjs';
export function classifyRequest(e){const c=base(e);if(c.code==='SCOPE'&&beaconRead(e.request,e.resourceType)&&allowed(e.request,e.resourceType))return{code:'ALLOW',kind:'STATIC'};return c;}
