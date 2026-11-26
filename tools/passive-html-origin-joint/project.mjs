import {REF} from './config.mjs';
import {ADMISSION_CATEGORIES} from './admission-category.mjs';
import {safeScan} from './scan.mjs';
export {parse,safeScan} from './scan.mjs';
const exact=(v,keys)=>v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const integer=(n,max)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
export function fixedResult(scope){return{kind:'PASSIVE_HTML_ORIGIN_JOINT_FIXED_V4',scope,status:'NOT_STARTED',phase:'ADMISSION',reason:'ADMISSION',admission_category:'NOT_OBSERVED',request_attempts:0,http_status:null,cleanup:'NOT_STARTED',scan:null,interpretation:'CURRENT_NODE_HTTPS_BASELINE_NOT_HISTORICAL_CHROME_VARIANT_NOT_SOURCE_CAUSALITY',score_measured:false,report_saved:false};}
export function safeResult(v){
 if(!exact(v,Object.keys(fixedResult(null)))||v.kind!=='PASSIVE_HTML_ORIGIN_JOINT_FIXED_V4'||!ADMISSION_CATEGORIES.includes(v.admission_category)||!['NOT_STARTED','FAILED','SCANNED'].includes(v.status)||!['ADMISSION','DNS','REQUEST','HEADERS','BODY','DECODE','COMPLETE','PARSE','PERSIST','UNKNOWN'].includes(v.phase)||!['NONE','ADMISSION','DNS','TLS','NETWORK','TIMEOUT','REDIRECT','HTTP','HEADERS','MIME','ENCODING','OVERSIZE','TRUNCATED','PARSER','STORAGE','UNKNOWN'].includes(v.reason)||v.request_attempts!==null&&!integer(v.request_attempts,1)||v.http_status!==null&&(!Number.isInteger(v.http_status)||v.http_status<100||v.http_status>599)||!['NOT_STARTED','CLOSED','UNKNOWN'].includes(v.cleanup)||v.interpretation!==fixedResult(null).interpretation||v.score_measured!==false||v.report_saved!==false)return null;
 if(v.scope!==null&&(!exact(v.scope,['sha','run','ref','attempt'])||!/^[a-f0-9]{40}$/.test(v.scope.sha)||!/^[1-9][0-9]{0,23}$/.test(v.scope.run)||v.scope.ref!==REF||v.scope.attempt!==1))return null;
 if(v.scan!==null&&!safeScan(v.scan))return null;
 if(v.status==='SCANNED'&&(v.phase!=='COMPLETE'||v.reason!=='NONE'||v.request_attempts!==1||v.http_status!==200||v.cleanup!=='CLOSED'||v.scan===null))return null;
 if(v.status!=='SCANNED'&&v.scan!==null)return null;
 return JSON.parse(JSON.stringify(v));
}
