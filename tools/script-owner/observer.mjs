// Passive metadata only. No command, policy verdict, wait, URL export or stack retention.
import {isProxy} from 'node:util/types';
import {TARGET,classifyRequest} from '../natural-reads/policy.mjs';
export const ROW_LIMIT=512;
export const DEPENDENCIES=Object.freeze({GTM:'https://www.googletagmanager.com',ADSENSE:'https://pagead2.googlesyndication.com',TURNSTILE:'https://challenges.cloudflare.com',TWITTER:'https://platform.twitter.com'});
const own=(o,k)=>{try{if(!o||typeof o!=='object'||isProxy(o))return;const d=Object.getOwnPropertyDescriptor(o,k);return d&&Object.hasOwn(d,'value')?d.value:undefined;}catch{}};
const id=x=>typeof x==='string'&&x.length>0&&x.length<=256;
const url=x=>typeof x==='string'&&x.length>0&&x.length<=8192;
const types=['PARSER','SCRIPT','PRELOAD','OTHER','UNKNOWN'];
export function dependencyOrigin(raw){if(!url(raw))return'OTHER_OR_UNKNOWN';try{const u=new URL(raw);if(u.protocol!=='https:'||u.port||u.username||u.password||u.hash)return'OTHER_OR_UNKNOWN';return Object.entries(DEPENDENCIES).find(([,v])=>v===u.origin)?.[0]??'OTHER_OR_UNKNOWN';}catch{return'OTHER_OR_UNKNOWN';}}
export function initiatorOwner(raw){if(!url(raw))return'UNKNOWN';try{const u=new URL(raw);if(u.username||u.password||u.hash||u.search)return'UNKNOWN';if(raw===TARGET)return'EXACT_DOCUMENT';if(u.origin==='https://staging.hirameki.dev'&&/\.m?js$/.test(u.pathname)&&classifyRequest({resourceType:'Script',request:{url:raw,method:'GET',headers:{}}}).kind==='NUXT_STATIC')return'APPROVED_NUXT_BUNDLE_FAMILY';if(dependencyOrigin(raw)!=='OTHER_OR_UNKNOWN')return'KNOWN_PUBLIC_DEPENDENCY_ORIGIN';}catch{}return'UNKNOWN';}
export function projectInitiator(v){try{const type=own(v,'type');let label=type==='parser'?'PARSER':type==='script'?'SCRIPT':type==='preload'?'PRELOAD':type==='other'?'OTHER':'UNKNOWN',raw;
 if(label==='PARSER')raw=own(v,'url');
 if(label==='SCRIPT'){const stack=own(v,'stack'),frames=own(stack,'callFrames');if(Array.isArray(frames)&&!isProxy(frames)&&frames.length>0&&frames.length<=64)raw=own(own(frames,'0'),'url');}
 return{initiator:label,initiator_owner:initiatorOwner(raw)};}catch{return{initiator:'UNKNOWN',initiator_owner:'UNKNOWN'};}
}
export function emptyOwner(){return{kind:'FIRST_REFUSED_SCRIPT_OWNER_FIXED',state:'NOT_SELECTED',binding:'NOT_REACHED',initiator:'UNKNOWN',request_origin:'OTHER_OR_UNKNOWN',initiator_owner:'UNKNOWN',rows_observed:0,overflow:false,attribution:'BOUND_NETWORK_METADATA_ONLY_NOT_SOURCE_OR_CAUSALITY',time:'AT_FIRST_SYNCHRONOUS_REFUSAL_LATER_METADATA_NOT_USED'};}
export function safeOwner(v){try{if(!v||isProxy(v)||Object.getPrototypeOf(v)!==Object.prototype||Object.keys(v).sort().join(',')!==Object.keys(emptyOwner()).sort().join(','))return null;const x=Object.fromEntries(Object.keys(emptyOwner()).map(k=>[k,own(v,k)]));if(x.kind!==emptyOwner().kind||!['NOT_SELECTED','FIRST_REFUSAL_NOT_SCRIPT','UNKNOWN_BINDING','BOUND_FIRST_SCRIPT'].includes(x.state)||!['NOT_REACHED','MATCHED_PRIOR_NETWORK','MISSING_PRIOR_NETWORK','AMBIGUOUS_OR_REUSED','SCOPE_LOST','BUFFER_OVERFLOW','INVALID_METADATA','UNKNOWN'].includes(x.binding)||!types.includes(x.initiator)||!['GTM','ADSENSE','TURNSTILE','TWITTER','OTHER_OR_UNKNOWN'].includes(x.request_origin)||!['EXACT_DOCUMENT','APPROVED_NUXT_BUNDLE_FAMILY','KNOWN_PUBLIC_DEPENDENCY_ORIGIN','UNKNOWN'].includes(x.initiator_owner)||!Number.isInteger(x.rows_observed)||x.rows_observed<0||x.rows_observed>ROW_LIMIT||typeof x.overflow!=='boolean'||x.attribution!==emptyOwner().attribution||x.time!==emptyOwner().time)return null;
 if(x.state==='BOUND_FIRST_SCRIPT'?(x.binding!=='MATCHED_PRIOR_NETWORK'||x.overflow):x.initiator!=='UNKNOWN'||x.initiator_owner!=='UNKNOWN'||x.request_origin!=='OTHER_OR_UNKNOWN'||x.binding==='MATCHED_PRIOR_NETWORK')return null;
 return x;}catch{return null;}}
export class ScriptOwner{
 constructor(g){this.g=g;this.rows=new Map();this.fetches=new Set();this.preScopeIds=new Set();this.scope=null;this.lost=false;this.overflow=false;this.selected=false;this.value=emptyOwner();}
 current(){const g=this.g,b=g.boundary,state=g.sessions.get(g.primary);if(g.stopping||g.stats.fatal||!state?.ready||b.documents!==1||!id(g.primary)||!id(state.frame)||!id(b.loader)||!id(g.createdPage)||g.pageInfo?.targetId!==g.createdPage||g.released!==true||state.auxiliary===true||g.wire?.readyState!==1){if(this.scope)this.lost=true;return null;}const s={primary:g.primary,state,frame:state.frame,loader:b.loader,wire:g.wire,boundary:b,target:g.createdPage};if(this.scope&&Object.keys(s).some(k=>s[k]!==this.scope[k])){this.lost=true;return null;}if(!this.scope)this.scope=s;return this.scope;}
 observe(m){if(this.selected)return;try{const g=this.g,p=own(m,'params'),method=own(m,'method');if(own(m,'sessionId')!==g.primary)return;
  if(method==='Page.frameNavigated'){if(this.scope&&!this.current())this.lost=true;return;}
  if(method!=='Network.requestWillBeSent')return;const key=own(p,'requestId');if(!id(key))return;const s=this.current();if(!s){if(!this.preScopeIds.has(key)){if(this.preScopeIds.size>=ROW_LIMIT)this.overflow=true;else this.preScopeIds.add(key);}return;}
  if(this.rows.has(key)){this.rows.get(key).ambiguous=true;return;}if(this.rows.size>=ROW_LIMIT){this.overflow=true;return;}
  const r=own(p,'request'),raw=own(r,'url'),methodValue=own(r,'method');const f=own(p,'frameId'),l=own(p,'loaderId'),d=own(p,'documentURL'),t=own(p,'type');const valid=url(raw)&&typeof methodValue==='string'&&methodValue.length<=16&&id(f)&&id(l)&&d===TARGET&&t==='Script';
  this.rows.set(key,{scope:s,url:valid?raw:null,method:valid?methodValue:null,frame:id(f)?f:null,loader:id(l)?l:null,document:d===TARGET?TARGET:null,type:t==='Script'?'Script':null,redirect:own(p,'redirectResponse')!==undefined,valid,ambiguous:this.preScopeIds.has(key),projection:projectInitiator(own(p,'initiator'))});
 }catch{this.lost=true;}}
 beforeFetch(e,session){if(this.selected)return null;try{const key=own(e,'networkId'),s=this.current(),reused=id(key)&&this.fetches.has(key);if(id(key)&&!this.fetches.has(key)){if(this.fetches.size>=ROW_LIMIT)this.overflow=true;else this.fetches.add(key);}return{event:e,session,scope:s,reused};}catch{this.lost=true;return null;}}
 select(e,token){if(this.selected)return;this.selected=true;const value=emptyOwner();value.rows_observed=this.rows.size;value.overflow=this.overflow;
 try{if(own(e,'resourceType')!=='Script')value.state='FIRST_REFUSAL_NOT_SCRIPT';else{value.state='UNKNOWN_BINDING';const now=this.current(),r=this.rows.get(own(e,'networkId')),request=own(e,'request');let reason=this.overflow?'BUFFER_OVERFLOW':this.lost?'SCOPE_LOST':!now||token?.event!==e||token.session!==now.primary||token.scope!==this.scope||own(e,'frameId')!==now.frame?'SCOPE_LOST':token.reused||r?.ambiguous||r?.redirect?'AMBIGUOUS_OR_REUSED':!r?'MISSING_PRIOR_NETWORK':!r.valid?'INVALID_METADATA':r.scope!==this.scope||r.frame!==now.frame||r.loader!==now.loader||r.document!==TARGET||r.type!=='Script'||r.url!==own(request,'url')||r.method!==own(request,'method')?'INVALID_METADATA':null;
 if(reason)value.binding=reason;else{value.state='BOUND_FIRST_SCRIPT';value.binding='MATCHED_PRIOR_NETWORK';value.request_origin=dependencyOrigin(r.url);Object.assign(value,r.projection);}}
 }catch{value.state='UNKNOWN_BINDING';value.binding='UNKNOWN';}
 this.value=safeOwner(value)??{...emptyOwner(),state:'UNKNOWN_BINDING',binding:'UNKNOWN'};this.rows.clear();this.fetches.clear();this.preScopeIds.clear();}
 snapshot(){return{...this.value};}
}
export function ownerObserver(Base,{onCaptured=()=>{}}={}){return class extends Base{
 constructor(...args){super(...args);const g=this,b=g.boundary,oldPassive=b.passive,oldReject=b.reject,oldRequest=g.request,c=new ScriptOwner(g);let current=null,flushed=false;this.scriptOwner=c;this.ownerRecordingFailed=false;
 b.passive=function(m){const out=Reflect.apply(oldPassive,this,[m]);c.observe(m);return out;};
 b.reject=function(code,e){if(!c.selected)c.select(e,current);return Reflect.apply(oldReject,this,[code,e]);};
 const flush=()=>{if(!c.selected||flushed)return;flushed=true;try{onCaptured(c.snapshot());}catch{g.ownerRecordingFailed=true;}};
 this.request=function(e,session){const before=current;current=c.beforeFetch(e,session);let out;try{out=Reflect.apply(oldRequest,this,[e,session]);}finally{current=before;}if(out&&typeof out.then==='function')out.then(flush,flush);else flush();return out;};
 this.ownerSnapshot=()=>c.snapshot();
 }
};}
