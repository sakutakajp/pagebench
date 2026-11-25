// Preserve an exact valid same-run prefix; never merge it into an adopted result.
import {safeSummary} from './records.mjs';
import {lstatSync,openSync,fstatSync,readSync,closeSync,constants} from 'node:fs';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function scopedSummary(v,s){const out=safeSummary(v);return out&&same(out.scope,s)?out:null;}
export function readSummary(path,s){let fd;try{const st=lstatSync(path);if(!st.isFile()||st.isSymbolicLink()||st.size>65536)return null;fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);const opened=fstatSync(fd);if(!opened.isFile()||opened.dev!==st.dev||opened.ino!==st.ino||opened.size>65536)return null;const b=Buffer.alloc(65537),n=readSync(fd,b,0,b.length,null);if(n>65536)return null;return scopedSummary(JSON.parse(b.subarray(0,n)),s);}catch{return null;}finally{if(fd!==undefined)try{closeSync(fd);}catch{}}}
export function selectSummary(previous,candidate,s){const old=scopedSummary(previous,s),next=scopedSummary(candidate,s);if(!old)return next;if(!next)return old;
 const known=['http_status','chrome'];if(known.some(k=>old[k]!==null&&!same(old[k],next[k])))return old;
 if(old.navigation_invocations!==null&&(next.navigation_invocations===null||next.navigation_invocations<old.navigation_invocations))return old;
 if(old.documents!==null&&(next.documents===null||next.documents<old.documents))return old;
 if(old.first_evidence&&!next.first_evidence)return old;
 for(const key of ['first_fatal','first_refusal'])if(old.first_evidence?.[key]!=null&&!same(old.first_evidence[key],next.first_evidence?.[key]))return old;
 if(old.samples?.first&&!same(old.samples.first,next.samples?.first))return old;
 if(old.samples?.end&&!same(old.samples.end,next.samples?.end))return old;
 if(old.rejections&&(next.rejections===null||old.rejections.total.value>next.rejections.total.value||old.rejections.first&&!same(old.rejections.first,next.rejections.first)))return old;
 return next;
}
