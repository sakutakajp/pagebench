// Fixed candidate from the review instruction; no lookup or external verification.
import {classifyOrigin} from '../passive-html-origin-joint/origin.mjs';
export const HOST_CLASSES=['EXACT_CANDIDATE_HOST','OTHER_HOST','UNKNOWN'];
export const PATH_CLASSES=['EXACT_OFFICIAL_PATH','OTHER_PATH','NOT_APPLICABLE','UNKNOWN'];
export const UNKNOWN_MATCH=Object.freeze({host:'UNKNOWN',path:'UNKNOWN'});
export function classifyBeacon(raw){
 if(classifyOrigin(raw).origin!=='OUTSIDE_APPROVED')return{...UNKNOWN_MATCH};
 try{
  const u=new URL(raw);
  // URL.hostname is the WHATWG-normalized hostname; trailing-dot lookalikes do not match.
  if(u.hostname!=='static.cloudflareinsights.com')return{host:'OTHER_HOST',path:'NOT_APPLICABLE'};
  // Exact serialized pathname only: no percent-decoding, suffix, prefix or query matching.
  return{host:'EXACT_CANDIDATE_HOST',path:u.pathname==='/beacon.min.js'?'EXACT_OFFICIAL_PATH':'OTHER_PATH'};
 }catch{return{...UNKNOWN_MATCH};}
}
