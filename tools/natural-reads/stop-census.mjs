// Bounded metadata observer. No permission, forwarding or browser operation.
import{RESOURCES}from'./live-protocol.mjs';
const TYPES=['Document','Script','Stylesheet','Font','Image','Fetch','XHR','Other','Media','TextTrack','UNKNOWN'];
export const COUNTER_MAX=65535;
export function boundedCount(v){return Number.isSafeInteger(v)&&v>=0?{value:Math.min(v,COUNTER_MAX),certainty:v>COUNTER_MAX?'AT_LEAST':'EXACT'}:{value:null,certainty:'UNKNOWN'};}
export function safeCount(v){if(!v||!['EXACT','AT_LEAST','UNKNOWN'].includes(v.certainty))return null;if(v.certainty==='UNKNOWN')return v.value===null?{value:null,certainty:'UNKNOWN'}:null;if(!Number.isInteger(v.value)||v.value<0||v.value>COUNTER_MAX||v.certainty==='AT_LEAST'&&v.value!==COUNTER_MAX)return null;return{value:v.value,certainty:v.certainty};}
class Counter{constructor(){this.value=0;this.saturated=false;}add(){if(this.value<COUNTER_MAX)this.value++;else this.saturated=true;}subtractOne(){if(!this.saturated&&this.value>0)this.value--;}snapshot(){return{value:this.value,certainty:this.saturated?'AT_LEAST':'EXACT'};}}
const keys=['received','before_first_limit','first_limit_messages','after_first_limit_before_stop','after_stop','checked_before_stop','checked_after_stop'];
export class StopCensus{
 constructor(){for(const k of keys)this[k]=new Counter();this.firstLimit=null;this.stopAt=null;}
 receivedFetch(stopped){this.received.add();this[stopped?'after_stop':this.firstLimit?'after_first_limit_before_stop':'before_first_limit'].add();}
 checked(code,stopped,total,meta={}){this[stopped?'checked_after_stop':'checked_before_stop'].add();if(code==='LIMIT'&&!this.firstLimit){this.before_first_limit.subtractOne();this.first_limit_messages.add();this.firstLimit={resource:RESOURCES.includes(meta.resource)?meta.resource:'UNKNOWN',resource_type:TYPES.includes(meta.resource_type)?meta.resource_type:'UNKNOWN',boundary_total:boundedCount(total),received_ordinal:this.received.snapshot(),stage:stopped?'AFTER_STOP':'BEFORE_STOP'};}}
 stopping(){this.stopAt??=this.received.snapshot();}
 snapshot(){return{kind:'BOUNDED_FETCH_CENSUS_NOT_SEND_COUNTS',...Object.fromEntries(keys.map(k=>[k,this[k].snapshot()])),first_limit:this.firstLimit?{resource:this.firstLimit.resource,resource_type:this.firstLimit.resource_type,boundary_total:{...this.firstLimit.boundary_total},received_ordinal:{...this.firstLimit.received_ordinal},stage:this.firstLimit.stage}:null,stop_at_received:this.stopAt?{...this.stopAt}:null};}
}
export function safeCensus(v){try{if(v?.kind!=='BOUNDED_FETCH_CENSUS_NOT_SEND_COUNTS')return null;const out={kind:v.kind};for(const k of keys){out[k]=safeCount(v[k]);if(!out[k])return null;}
 if(v.first_limit!==null){const f=v.first_limit,a=safeCount(f.boundary_total),b=safeCount(f.received_ordinal);if(!a||!b||!RESOURCES.concat('UNKNOWN').includes(f.resource)||!TYPES.includes(f.resource_type)||!['BEFORE_STOP','AFTER_STOP'].includes(f.stage))return null;out.first_limit={resource:f.resource,resource_type:f.resource_type,boundary_total:a,received_ordinal:b,stage:f.stage};}else out.first_limit=null;
 out.stop_at_received=v.stop_at_received===null?null:safeCount(v.stop_at_received);if(v.stop_at_received!==null&&!out.stop_at_received)return null;return out;
 }catch{return null;}}
