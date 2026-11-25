import {spawnSync} from 'node:child_process';
export const KINDS=['SCRIPT_SRC','LINK_PRELOAD_SCRIPT','LINK_MODULEPRELOAD','LINK_PREFETCH_SCRIPT','LINK_PREFETCH_UNTYPED','HEADER_LINK_SCRIPT','HEADER_LINK_UNTYPED_PREFETCH'];
export const POSITIONS=['HEAD','BODY','AFTER_EXPLICIT_BODY_END','OUTSIDE_EXPLICIT_HEAD_BODY','INERT_OR_AMBIGUOUS','HEADER'];
export const DEPS=['GTM','ADSENSE','TURNSTILE','TWITTER','RELATIVE_REFERENCE','OTHER_OR_UNKNOWN'];
const exact=(o,keys)=>o&&Object.getPrototypeOf(o)===Object.prototype&&Object.keys(o).sort().join(',')===[...keys].sort().join(',');
const count=(n,max)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
export function safeScan(v){
 if(!exact(v,['coverage','tags','script_tags','inline_script_tags','references','rows','delivery_signature'])||!['LIMITED','AMBIGUOUS','STATIC_TOKEN_SCAN_COMPLETE_NOT_BROWSER_DOM'].includes(v.coverage)||v.delivery_signature!=='NO_INDEPENDENTLY_VERIFIED_SIGNATURE_IMPLEMENTED'||!count(v.tags,2048)||!count(v.script_tags,v.tags)||!count(v.inline_script_tags,v.script_tags)||!count(v.references,256)||!Array.isArray(v.rows)||v.rows.length>256)return null;
 const seen=new Set();let total=0,scripts=0;
 for(const r of v.rows){if(!exact(r,['kind','position','dependency','count'])||!KINDS.includes(r.kind)||!POSITIONS.includes(r.position)||!DEPS.includes(r.dependency)||!count(r.count,256)||r.count===0||r.kind.startsWith('HEADER_')!==(r.position==='HEADER'))return null;const k=[r.kind,r.position,r.dependency].join(':');if(seen.has(k))return null;seen.add(k);total+=r.count;if(r.kind==='SCRIPT_SRC')scripts+=r.count;}
 if(total!==v.references||scripts>v.script_tags-v.inline_script_tags)return null;
 return JSON.parse(JSON.stringify(v));
}
export function parse(html,link){
 const p=spawnSync('python3',[new URL('./parser.py',import.meta.url).pathname],{input:JSON.stringify({html,link}),encoding:'utf8',timeout:2000,maxBuffer:65536,env:{PATH:process.env.PATH,LANG:'C.UTF-8',PYTHONDONTWRITEBYTECODE:'1'}});
 if(p.status!==0||p.signal||p.error||p.stderr)return null;
 try{return safeScan(JSON.parse(p.stdout));}catch{return null;}
}
export function fixedResult(s){return{kind:'PASSIVE_HTML_BASELINE_FIXED_V1',scope:s,status:'NOT_STARTED',phase:'ADMISSION',reason:'ADMISSION',request_attempts:0,http_status:null,cleanup:'NOT_STARTED',scan:null,interpretation:'CURRENT_NODE_HTTPS_BASELINE_NOT_HISTORICAL_CHROME_VARIANT_NOT_SOURCE_CAUSALITY',score_measured:false,report_saved:false};}
export function safeResult(v){
 if(!exact(v,Object.keys(fixedResult(null)))||v.kind!=='PASSIVE_HTML_BASELINE_FIXED_V1'||!['NOT_STARTED','FAILED','SCANNED'].includes(v.status)||!['ADMISSION','DNS','REQUEST','HEADERS','BODY','DECODE','COMPLETE','PARSE','PERSIST','UNKNOWN'].includes(v.phase)||!['NONE','ADMISSION','DNS','TLS','NETWORK','TIMEOUT','REDIRECT','HTTP','HEADERS','MIME','ENCODING','OVERSIZE','TRUNCATED','PARSER','STORAGE','UNKNOWN'].includes(v.reason)||v.request_attempts!==null&&!count(v.request_attempts,1)||v.http_status!==null&&(!Number.isInteger(v.http_status)||v.http_status<100||v.http_status>599)||!['NOT_STARTED','CLOSED','UNKNOWN'].includes(v.cleanup)||v.interpretation!==fixedResult(null).interpretation||v.score_measured!==false||v.report_saved!==false)return null;
 if(v.scope!==null&&(!exact(v.scope,['sha','run','ref','attempt'])||!/^[a-f0-9]{40}$/.test(v.scope.sha)||!/^[1-9][0-9]{0,23}$/.test(v.scope.run)||v.scope.ref!=='refs/heads/diag/passive-html-ja-once-20261125'||v.scope.attempt!==1))return null;
 if(v.scan!==null&&!safeScan(v.scan))return null;
 if(v.status==='SCANNED'&&(v.phase!=='COMPLETE'||v.reason!=='NONE'||v.request_attempts!==1||v.http_status!==200||v.cleanup!=='CLOSED'||v.scan===null))return null;
 if(v.status!=='SCANNED'&&v.scan!==null)return null;
 return JSON.parse(JSON.stringify(v));
}
