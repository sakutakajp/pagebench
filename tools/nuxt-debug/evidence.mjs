import {currentSink} from './sink.mjs';
import {safeMetadata} from './metadata.mjs';
// Fixed metadata only. No message/URL/header/body/ID is retained in a snapshot.
const PHASES=['OPEN','CONFIG','NAVIGATION','WINDOW','SHARED_SAMPLE','B_OBSERVERS','DISPOSE','SEAL','CLEANUP','FINISHED'];
const POLICY=['URL','REDIRECT','ORIGIN','METHOD','CREDENTIAL','SCOPE','NAVIGATION','LIMIT','BINDING','RESPONSE','PUBLIC_SCOPE','HTML','NETWORK'];
const FATAL=['AB_BOUNDARY_REJECTED','AB_BOUNDARY_REDIRECT','AB_BOUNDARY_RESPONSE','AB_BOUNDARY_HTML','AB_BOUNDARY_NETWORK','AB_BOUNDARY_BINDING','AB_CONFIG_MUTATION','AB_CONFIG_SCOPE','AB_DEADLINE','AB_ASYNC_RECEIVE_FAILED','GATEWAY_INTERNAL_FAILED','CDP_LOST','CDP_TIMEOUT','FONT_LOADING_FAILED','FONT_BINDING_MISMATCH'];
const TYPES=['Document','Script','Stylesheet','Image','Font','Fetch','XHR','Other','Media','TextTrack'];
export const fixedFatal=v=>FATAL.includes(v)?v:'OTHER_GUARD_STOP';
const one=(v,a,d)=>a.includes(v)?v:d;
const count=n=>Number.isInteger(n)&&n>=0&&n<=65535?n:null;
export class StopEvidence{
 constructor(g){this.g=g;this.phase='OPEN';this.first=null;this.refusal=null;this.secondary=0;this.active=0;this.peak=0;this.receiver_rejections=0;this.emergency='NOT_REQUESTED';this.cleanup='NOT_STARTED';this.sink=currentSink();this.meta=null;}
 publish(){try{this.sink?.(this.snapshot());}catch{this.secondary=Math.min(65535,this.secondary+1);}}
 stage(p){if(PHASES.includes(p)){this.phase=p;this.publish();}}
 rejected(code,e){if(!this.refusal){this.refusal={category:POLICY.includes(code)?code:'UNKNOWN',method:one(e?.request?.method,['GET','HEAD','POST'],'OTHER'),resource_type:one(e?.resourceType,TYPES,'UNKNOWN')};this.publish();}}
 fatal(code){if(!this.first){this.first=fixedFatal(code);this.publish();}}
 secondaryFailure(){this.secondary=Math.min(65535,this.secondary+1);this.publish();}
 snapshot(){const b=this.g.boundary?.snapshot();return{phase:this.phase,first_fatal:this.first,first_refusal:this.refusal?{...this.refusal}:null,documents:b&&Number.isInteger(b.documents)&&b.documents<=1?b.documents:null,http_status:b&&Number.isInteger(b.http_status)?b.http_status:null,receiver_active:this.active,receiver_peak:this.peak,receiver_rejections:this.receiver_rejections,secondary_failures:this.secondary,emergency:this.emergency,cleanup:this.cleanup,metadata:this.meta?.snapshot()??null};}
}
export function safeEvidence(v){if(!v||!PHASES.includes(v.phase)||v.first_fatal!==null&&!FATAL.concat('OTHER_GUARD_STOP').includes(v.first_fatal)||v.documents!==null&&![0,1].includes(v.documents)||v.http_status!==null&&(!Number.isInteger(v.http_status)||v.http_status<100||v.http_status>599)||!['NOT_REQUESTED','REQUESTED','RETURNED','THREW'].includes(v.emergency)||!['NOT_STARTED','REQUESTED','COMPLETE','FAILED','UNKNOWN'].includes(v.cleanup))return null;
 const r=v.first_refusal;if(r!==null&&(!r||!POLICY.concat('UNKNOWN').includes(r.category)||!['GET','HEAD','POST','OTHER'].includes(r.method)||!TYPES.concat('UNKNOWN').includes(r.resource_type)))return null;
 if(['receiver_active','receiver_peak','receiver_rejections','secondary_failures'].some(k=>count(v[k])===null))return null;
 const metadata=v.metadata===null?null:safeMetadata(v.metadata);if(v.metadata!==null&&!metadata)return null;return{phase:v.phase,first_fatal:v.first_fatal,first_refusal:r?{category:r.category,method:r.method,resource_type:r.resource_type}:null,documents:v.documents,http_status:v.http_status,...Object.fromEntries(['receiver_active','receiver_peak','receiver_rejections','secondary_failures'].map(k=>[k,v[k]])),emergency:v.emergency,cleanup:v.cleanup,metadata};
}
