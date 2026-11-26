// Pure WHATWG URL projection. No request, persistence, URL/host/path/hash output.
import {ORIGINS} from '../natural-reads/policy.mjs';
import {originMask} from '../standalone-score/origin-mask.mjs';
export const ORIGIN_LABELS=['STAGING_HTTPS','IMAGE_HTTPS','OUTSIDE_APPROVED','INVALID_OR_UNKNOWN'];
export const USERINFO=['ABSENT','EMPTY_MARKER','NONEMPTY','UNKNOWN'];
export const PORTS=['DEFAULT_OR_ABSENT','NONDEFAULT','UNKNOWN'];
export const FRAGMENTS=['ABSENT','EMPTY_MARKER','NONEMPTY','UNKNOWN'];
export const GUARDS=['PASS_ORIGIN_ONLY','REJECT_ON_ATTRIBUTE','UNKNOWN'];
export const UNKNOWN_ORIGIN=Object.freeze({origin:'INVALID_OR_UNKNOWN',guard_on_attribute:'UNKNOWN',userinfo:'UNKNOWN',port:'UNKNOWN',fragment:'UNKNOWN'});
export function classifyOrigin(raw){
 if(typeof raw!=='string'||raw.length>8192||!/^https:\/\//i.test(raw)||/[\x00-\x20\x7f\\]/.test(raw))return{...UNKNOWN_ORIGIN};
 try{
  const u=new URL(raw);decodeURIComponent(u.pathname); // Same URL precheck as the measurement policy.
  if(u.protocol!=='https:')return{...UNKNOWN_ORIGIN};
  const mask=originMask({url:raw}),member=ORIGINS.includes(u.origin);
  if(mask.parse!=='VALID'||mask.approved_origin!==(member?'YES':'NO')||ORIGINS.length!==2)return{...UNKNOWN_ORIGIN};
  const origin=member?(u.origin===ORIGINS[0]?'STAGING_HTTPS':u.origin===ORIGINS[1]?'IMAGE_HTTPS':'INVALID_OR_UNKNOWN'):'OUTSIDE_APPROVED';
  const authority=raw.slice(raw.indexOf('//')+2).split(/[/?#]/,1)[0];
  const userinfo=mask.userinfo==='YES'?'NONEMPTY':authority.includes('@')?'EMPTY_MARKER':'ABSENT';
  const fragment=mask.fragment==='YES'?'NONEMPTY':raw.includes('#')?'EMPTY_MARKER':'ABSENT';
  return{origin,guard_on_attribute:member&&mask.userinfo==='NO'&&mask.fragment==='NO'?'PASS_ORIGIN_ONLY':'REJECT_ON_ATTRIBUTE',userinfo,port:mask.default_port==='YES'?'DEFAULT_OR_ABSENT':'NONDEFAULT',fragment};
 }catch{return{...UNKNOWN_ORIGIN};}
}
