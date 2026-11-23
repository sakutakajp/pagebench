import {readFileSync,lstatSync,openSync,fstatSync,readSync,closeSync,constants,existsSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {instrumentOrigin} from './retry-observer.mjs';
import {binding,publicKeyInfo} from './retry-crypto.mjs';
import {writeSealedOnce,readSealed} from './retry-store.mjs';
import {saveParentFixed} from '../natural-reads/live-entry.mjs';
const PUBLIC_KEY=readFileSync(new URL('./public-key.pem',import.meta.url),'utf8');
export const KEY_ID=publicKeyInfo(PUBLIC_KEY).key_id;
const SUMMARY='origin400-capture-fixed.json';
const STATES=['NOT_OBSERVED','PRIOR_STOP_OR_UNKNOWN','FIRST_REJECTION_NOT_TARGET','SCOPE_UNCONFIRMED','URL_UNAVAILABLE','URL_TOO_LONG','ORIGIN_UNSUPPORTED','URL_INVALID','SEALED','WRITE_UNCONFIRMED','CAPTURE_FAILED','UNKNOWN'];
export function runtimeScope(env=process.env){return binding({repository:env.GITHUB_REPOSITORY,ref:env.GITHUB_REF,sha:env.GITHUB_SHA,run_id:env.GITHUB_RUN_ID,attempt:Number(env.GITHUB_RUN_ATTEMPT),mode:'GHA'});}
function readBounded(path){let fd;try{const st=lstatSync(path);if(!st.isFile()||st.isSymbolicLink()||st.size>4096)return null;fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);const s=fstatSync(fd);if(!s.isFile()||s.size>4096)return null;const b=Buffer.alloc(4097),n=readSync(fd,b,0,b.length,null);if(n>4096)return null;return JSON.parse(b.subarray(0,n));}catch{return null;}finally{if(fd!==undefined)try{closeSync(fd);}catch{}}}
function safeState(v,scope){try{if(v?.kind!=='FIRST_ORIGIN_CAPTURE_STATE'||v.key_id!==KEY_ID||!STATES.includes(v.state)||v.private_auth!=='NOT_PERFORMED_IN_ACTIONS'||v.score_saved!==false||v.report_saved!==false||JSON.stringify(binding(v.binding))!==JSON.stringify(binding(scope)))return null;return{kind:v.kind,binding:binding(scope),key_id:KEY_ID,state:v.state,private_auth:v.private_auth,score_saved:false,report_saved:false};}catch{return null;}}
export function persistCaptureState(directory,snapshot,scope){
  const path=join(directory,'origin-status.json');if(existsSync(path))return;
  const state=STATES.includes(snapshot?.state)?snapshot.state:'UNKNOWN';
  saveParentFixed({kind:'FIRST_ORIGIN_CAPTURE_STATE',binding:binding(scope),key_id:KEY_ID,state,private_auth:'NOT_PERFORMED_IN_ACTIONS',score_saved:false,report_saved:false},path);
}
export function captureGateway(Base,{directory,scope}){
  const sealed=instrumentOrigin(Base,{publicKey:PUBLIC_KEY,scope,emit:envelope=>writeSealedOnce(directory,envelope)});
  return class extends sealed{constructor(...a){super(...a);const g=this,b=this.boundary,reject=b.reject;let recorded=false;
    b.reject=function(code,e){try{return Reflect.apply(reject,this,[code,e]);}finally{if(!recorded){recorded=true;try{persistCaptureState(directory,g.originCapture(),scope);}catch{}}}};
  }};
}
const OUTCOMES=['SEALED_BOUND_FIRST_REFUSAL','SEALED_BOUND_UNCONFIRMED_PROVENANCE','NO_ENVELOPE_UNCONFIRMED','FOREIGN_OR_INVALID_ENVELOPE','NOT_STARTED_OR_UNAVAILABLE','PUBLIC_EXPORT_FAILED'];
function fixed(outcome,scope=null,state='UNKNOWN',hash=null){return{kind:'FIRST_REJECTED_SCRIPT_ORIGIN_FIXED',outcome,binding:scope,key_id:KEY_ID,capture_state:state,envelope_sha256:hash,private_auth:'NOT_PERFORMED_IN_ACTIONS',origin_plaintext:'NEVER_OUTPUT',score_saved:false,report_saved:false};}
export function finalizeOriginOutput({directory,scope,firstRefusal,output='.'}){
  const expected=binding(scope),state=safeState(readBounded(join(directory,'origin-status.json')),expected),read=readSealed(join(directory,'origin-sealed.json'));
  let summary=fixed('NO_ENVELOPE_UNCONFIRMED',expected,state?.state??'UNKNOWN');
  if(read.envelope){const e=read.envelope;
    if(e.key_id!==KEY_ID||JSON.stringify(e.binding)!==JSON.stringify(expected))summary=fixed('FOREIGN_OR_INVALID_ENVELOPE',expected,state?.state??'UNKNOWN');
    else{const text=JSON.stringify(e),hash=createHash('sha256').update(text).digest('hex');
      try{const final=join(output,'origin400-sealed.json');if(existsSync(final))throw Error();saveParentFixed(e,final);
        const matched=state?.state==='SEALED'&&firstRefusal?.category==='ORIGIN'&&firstRefusal.method==='GET'&&firstRefusal.resource_type==='Script';
        summary=fixed(matched?'SEALED_BOUND_FIRST_REFUSAL':'SEALED_BOUND_UNCONFIRMED_PROVENANCE',expected,state?.state??'UNKNOWN',hash);
      }catch{summary=fixed('PUBLIC_EXPORT_FAILED',expected,state?.state??'UNKNOWN');}
    }
  }
  saveParentFixed(summary,join(output,SUMMARY));return summary;
}
export function writeOriginFallback(output='.'){const r=fixed('NOT_STARTED_OR_UNAVAILABLE');try{saveParentFixed(r,join(output,SUMMARY));}catch{}return r;}
export function readOriginSummary(output='.',expected=null){const v=readBounded(join(output,SUMMARY));try{if(!v||v.kind!=='FIRST_REJECTED_SCRIPT_ORIGIN_FIXED'||!OUTCOMES.includes(v.outcome)||v.key_id!==KEY_ID||!STATES.includes(v.capture_state)||v.private_auth!=='NOT_PERFORMED_IN_ACTIONS'||v.origin_plaintext!=='NEVER_OUTPUT'||v.score_saved!==false||v.report_saved!==false||v.envelope_sha256!==null&&(typeof v.envelope_sha256!=='string'||!/^[a-f0-9]{64}$/.test(v.envelope_sha256)))throw Error();const scope=v.binding===null?null:binding(v.binding);if(expected&&JSON.stringify(scope)!==JSON.stringify(binding(expected)))throw Error();return fixed(v.outcome,scope,v.capture_state,v.envelope_sha256);}catch{return fixed('NOT_STARTED_OR_UNAVAILABLE');}}

export function readCurrentOriginSummary(){try{return readOriginSummary('.',runtimeScope());}catch{return fixed('NOT_STARTED_OR_UNAVAILABLE');}}
