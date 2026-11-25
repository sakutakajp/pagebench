// RAM-only accepted-resource completeness, separate from the historical120 diagnostic
// correlation buffer. Never changes a decision, emits traffic, or exports identity.
export function resourceObserver(Base){return class extends Base{
 constructor(...a){super(...a);const g=this,b=this.boundary,check=b.check,passive=b.passive;const rows=new Map();let headers=0,completed=0,invalid=false,overflow=false,phase='MEASURING',after=0,sealed=null;
 b.check=function(e){const c=Reflect.apply(check,this,[e]);if(c==='ALLOW'){if(rows.size>=400||rows.has(e.networkId))overflow=true;else rows.set(e.networkId,{url:e.request.url,headers:false,done:false});}return c;};
 b.passive=function(m){if(m.sessionId===g.primary){const p=m.params||{},r=rows.get(p.requestId);if(r&&['Network.responseReceived','Network.loadingFinished','Network.loadingFailed'].includes(m.method)){
  const expectedCleanupAbort=phase==='CLEANUP'&&r.done&&m.method==='Network.loadingFailed'&&(p.canceled===true||p.errorText==='net::ERR_ABORTED'||p.blockedReason==='inspector');
  if(!expectedCleanupAbort){if(phase!=='MEASURING')after=Math.min(65535,after+1);
   if(m.method==='Network.responseReceived'){if(r.headers||r.done||p.response?.url!==r.url||p.response?.status!==200)invalid=true;else{r.headers=true;headers++;}}
   else if(m.method==='Network.loadingFinished'){if(!r.headers||r.done)invalid=true;else{r.done=true;completed++;}}
   else invalid=true;
  }
 }}return Reflect.apply(passive,this,[m]);};
 const snapshot=()=>({accepted:rows.size,headers,completed,invalid,overflow,after_seal:after,phase});this.resourceProof={snapshot,seal(){const s=snapshot();if(invalid||overflow||s.accepted!==b.total||headers!==rows.size||completed!==rows.size)throw Error('RESOURCE_INCOMPLETE');phase='SEALED';sealed=Object.freeze(snapshot());return sealed;},valid(s){return s===sealed&&!invalid&&!overflow&&after===0&&headers===s.headers&&completed===s.completed&&rows.size===s.accepted;},cleanup(){phase='CLEANUP';}};
 }
 beginCleanup(){this.resourceProof.cleanup();return super.beginCleanup();}
};}
export function safeResources(v){return v&&Object.keys(v).sort().join(',')==='accepted,after_seal,completed,headers,invalid,overflow,phase'&&['MEASURING','SEALED','CLEANUP'].includes(v.phase)&&['accepted','headers','completed'].every(k=>Number.isInteger(v[k])&&v[k]>=0&&v[k]<=400)&&Number.isInteger(v.after_seal)&&v.after_seal>=0&&v.after_seal<=65535&&typeof v.invalid==='boolean'&&typeof v.overflow==='boolean'?{accepted:v.accepted,headers:v.headers,completed:v.completed,invalid:v.invalid,overflow:v.overflow,after_seal:v.after_seal,phase:v.phase}:null;}
