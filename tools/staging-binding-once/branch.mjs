// Exact decision labels only; no payload/identity values leave RAM.
import {isProxy} from 'node:util/types';
import {plainData} from '../native-score-proof/case-project.mjs';
import {FontMonitor} from '../cdp-startup-diagnostic/font-monitor.mjs';
const phases=['UNKNOWN','CONFIG','NAVIGATION','WINDOW','SHARED_SAMPLE','SEAL','CLEANUP','FINISHED'];
export const BRANCHES=Object.freeze(['UNKNOWN','POLICY_REJECT','STOPPING','PRIMARY_NOT_READY','FRAME_MISMATCH','DOCUMENT_REPEAT','TOTAL_LIMIT','NETWORK_ID_MISSING','NETWORK_ID_NONSTRING','NETWORK_ID_EMPTY','NETWORK_ID_ALREADY_BOUND']);
export const CATEGORIES=Object.freeze(['UNKNOWN','ALLOW','URL','ORIGIN','METHOD','CREDENTIAL','SCOPE','REDIRECT','BINDING','NAVIGATION','LIMIT']);
const types=['UNKNOWN','Document','Stylesheet','Image','Media','Font','Script','TextTrack','XHR','Fetch','Prefetch','EventSource','WebSocket','Manifest','SignedExchange','Ping','CSPViolationReport','Preflight','Other'];
const kinds=['UNKNOWN','MISSING','UNDEFINED','NULL','BOOLEAN','NUMBER','OBJECT','ARRAY','EMPTY_STRING','NONEMPTY_STRING','OTHER'];
const yn=['UNKNOWN','YES','NO'];const states=['NOT_INSTALLED','NO_BOUNDARY_REFUSAL_OBSERVED','CAPTURED','INSPECTION_UNKNOWN'];
const own=(o,k)=>{if(o===null||o===undefined)return undefined;if(typeof o!=='object'||isProxy(o))throw Error();const d=Object.getOwnPropertyDescriptor(o,k);if(d&&!Object.hasOwn(d,'value'))throw Error();return d?.value;};
export const emptyBranch=()=>({kind:'FIXED_SYNCHRONOUS_BOUNDARY_BRANCH_V1',state:'NOT_INSTALLED',branch:'UNKNOWN',category:'UNKNOWN',phase:'UNKNOWN',resource_type:'UNKNOWN',network_kind:'UNKNOWN',scope:'UNKNOWN',prior_kind:'UNKNOWN',prior_active:'UNKNOWN',prior_queued:'UNKNOWN',prior_font_stage:'UNKNOWN',legacy_replay_predicate:'UNKNOWN',request_order:0,order_saturated:false,clock:'NODE_CHECK_CALL_ORDER_NOT_BROWSER_CAUSALITY'});
export function safeBranch(v){try{const x=emptyBranch();if(!plainData(v)||Object.keys(v).sort().join(',')!==Object.keys(x).sort().join(',')||v.kind!==x.kind||v.clock!==x.clock||!states.includes(v.state)||!BRANCHES.includes(v.branch)||!CATEGORIES.includes(v.category)||!phases.includes(v.phase)||!types.includes(v.resource_type)||!kinds.includes(v.network_kind)||!['UNKNOWN','PRIMARY_FRAME_BOUND','UNCONFIRMED'].includes(v.scope)||!['UNKNOWN','ABSENT','FONT','OTHER'].includes(v.prior_kind)||!yn.includes(v.prior_active)||!yn.includes(v.prior_queued)||!yn.includes(v.legacy_replay_predicate)||!['UNKNOWN','ABSENT','START_UNBOUND','EXPECTED_NO_START','START_NO_RESPONSE','RESPONSE_HEADERS','FINISHED','FAILED'].includes(v.prior_font_stage)||!Number.isInteger(v.request_order)||v.request_order<0||v.request_order>65535||typeof v.order_saturated!=='boolean'||v.order_saturated&&v.request_order!==65535)return null;
 if(v.state==='CAPTURED'&&(v.branch==='UNKNOWN'||v.category==='UNKNOWN'||v.request_order===0))return null;
 if(v.state!=='CAPTURED'&&(v.branch!=='UNKNOWN'||v.category!=='UNKNOWN'))return null;
 return JSON.parse(JSON.stringify(v));}catch{return null;}}
function networkKind(e){if(!Object.hasOwn(e,'networkId'))return'MISSING';const v=own(e,'networkId');return v===undefined?'UNDEFINED':v===null?'NULL':typeof v==='string'?v?'NONEMPTY_STRING':'EMPTY_STRING':typeof v==='boolean'?'BOOLEAN':typeof v==='number'?'NUMBER':Array.isArray(v)?'ARRAY':typeof v==='object'?'OBJECT':'OTHER';}
export function installBranch(g,b){let first=false,current=null,order=0,saturated=false,failed=false,v={...emptyBranch(),state:'NO_BOUNDARY_REFUSAL_OBSERVED'};const request=g.request;
 g.request=function(e,id){if(order<65535)order++;else saturated=true;const prior=current;current={event:e,session:id,owner:g.sessions.get(g.primary)};try{return Reflect.apply(request,this,[e,id]);}finally{current=prior;}};
 const capture=(branch,category,e)=>{if(first)return;first=true;try{
  if(!BRANCHES.includes(branch)||!CATEGORIES.includes(category)||branch==='UNKNOWN'||category==='UNKNOWN')throw Error();
  const s=g.sessions.get(g.primary),frame=own(s,'frame'),n=own(e,'networkId'),prior=Map.prototype.get.call(b.network,n);
  v={...emptyBranch(),state:'CAPTURED',branch,category,request_order:order,order_saturated:saturated,network_kind:networkKind(e)};
  const type=own(e,'resourceType');v.resource_type=types.includes(type)?type:'UNKNOWN';const phase=own(g.stopEvidence,'phase');v.phase=phases.includes(phase)?phase:'UNKNOWN';
  v.scope=current?.event===e&&current.session===g.primary&&current.owner===s&&own(s,'ready')===true&&typeof frame==='string'&&frame.length>0&&own(e,'frameId')===frame?'PRIMARY_FRAME_BOUND':'UNCONFIRMED';
  if(branch==='NETWORK_ID_ALREADY_BOUND'){v.prior_kind=prior?own(prior,'kind')==='FONT'?'FONT':'OTHER':'ABSENT';v.prior_active=Set.prototype.has.call(g.active,n)?'YES':'NO';v.prior_queued=Array.prototype.some.call(g.waiting,x=>own(x,'networkId')===n)?'YES':'NO';}
  if(branch==='NETWORK_ID_ALREADY_BOUND'&&typeof g.primary==='string'&&g.primary.length<=256&&typeof n==='string'&&n.length<=256){
   const f=Map.prototype.get.call(g.fonts.entries,JSON.stringify([g.primary,n]));
   if(!f)v.prior_font_stage='ABSENT';else{const expected=own(f,'expected'),start=own(f,'start');v.prior_font_stage=own(f,'failed')?'FAILED':own(f,'finished')?'FINISHED':own(f,'response')?'RESPONSE_HEADERS':expected&&start?'START_NO_RESPONSE':expected?'EXPECTED_NO_START':start?'START_UNBOUND':'ABSENT';
    const r=own(e,'request'),id=own(e,'requestId');if(v.scope==='PRIMARY_FRAME_BOUND'&&v.resource_type==='Font'&&typeof id==='string'&&id.length>0&&id.length<=256&&typeof own(r,'url')==='string'&&typeof own(r,'method')==='string')v.legacy_replay_predicate=FontMonitor.prototype.canReplay.call(g.fonts,g.primary,e)?'YES':'NO';
   }
  }
  if(!safeBranch(v))throw Error();
 }catch{failed=true;v={...emptyBranch(),state:'INSPECTION_UNKNOWN',request_order:order,order_saturated:saturated};}};
 g.bindingSnapshot=()=>safeBranch(v);g.bindingObserverFailed=()=>failed;
 return capture;
}
