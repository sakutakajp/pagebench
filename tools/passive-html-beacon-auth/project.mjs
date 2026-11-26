import {REF} from './config.mjs';
import {ADMISSION_CATEGORIES} from './admission-category.mjs';
import {safeScan} from '../passive-html-beacon-match/scan.mjs';
export {parse,safeScan} from '../passive-html-beacon-match/scan.mjs';
const exact=(v,keys)=>v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const integer=(n,max)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
export {fixedResult} from './record.mjs';
import {fixedResult} from './record.mjs';
export function safeResult(v){
 if(!exact(v,Object.keys(fixedResult(null)))||v.kind!=='PASSIVE_HTML_BEACON_AUTH_FIXED_V6'||!ADMISSION_CATEGORIES.includes(v.admission_category)||!['NOT_STARTED','FAILED','SCANNED'].includes(v.status)||!['ADMISSION','DNS','REQUEST','HEADERS','BODY','DECODE','COMPLETE','PARSE','PERSIST','UNKNOWN'].includes(v.phase)||!['NONE','ADMISSION','DNS','TLS','NETWORK','TIMEOUT','REDIRECT','HTTP','HEADERS','MIME','ENCODING','OVERSIZE','TRUNCATED','PARSER','STORAGE','UNKNOWN'].includes(v.reason)||v.request_attempts!==null&&!integer(v.request_attempts,1)||v.http_status!==null&&(!Number.isInteger(v.http_status)||v.http_status<100||v.http_status>599)||!['NOT_STARTED','CLOSED','UNKNOWN'].includes(v.cleanup)||v.interpretation!==fixedResult(null).interpretation||v.score_measured!==false||v.report_saved!==false)return null;
 if(v.scope!==null&&(!exact(v.scope,['sha','run','ref','attempt'])||!/^[a-f0-9]{40}$/.test(v.scope.sha)||!/^[1-9][0-9]{0,23}$/.test(v.scope.run)||v.scope.ref!==REF||v.scope.attempt!==1))return null;
 if(v.scan!==null&&!safeScan(v.scan))return null;
 if(v.status==='SCANNED'&&(v.phase!=='COMPLETE'||v.reason!=='NONE'||v.request_attempts!==1||v.http_status!==200||v.cleanup!=='CLOSED'||v.scan===null))return null;
 if(v.status!=='SCANNED'&&v.scan!==null)return null;
 return JSON.parse(JSON.stringify(v));
}
