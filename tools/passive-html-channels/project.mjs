import {spawnSync} from 'node:child_process';
import {REF} from './config.mjs';
export const POSITIONS=['HEAD','BODY','AFTER_EXPLICIT_BODY_END','OUTSIDE_EXPLICIT_HEAD_BODY','INERT_OR_AMBIGUOUS','HEADER'];
export const DEPS=['GTM','ADSENSE','TURNSTILE','TWITTER','OTHER_OR_UNKNOWN'];
export const FORMS=['RELATIVE','PROTOCOL_RELATIVE','ABSOLUTE_HTTPS','ABSOLUTE_OTHER','INVALID'];
export const SPECS={SCRIPT_SRC:[1024,['SCRIPT_SRC']],BODY_HINTS:[256,['LINK_PRELOAD_SCRIPT','LINK_MODULEPRELOAD','LINK_PREFETCH_SCRIPT','LINK_PREFETCH_UNTYPED']],HTTP_SCRIPT_HINTS:[128,['HEADER_LINK_SCRIPT']],HTTP_UNTYPED_PREFETCH:[128,['HEADER_LINK_UNTYPED_PREFETCH']]};
const exact=(v,keys)=>v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const integer=(n,max)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
const cover=v=>['COMPLETE_STATIC_LEXICAL_NOT_BROWSER_DOM','AMBIGUOUS','TOKEN_LIMITED'].includes(v);
export function safeScan(v){
 if(!exact(v,['body_token_coverage','tag_tokens','header_parts','base','script_tags','inline_script_tags','raw_text_elements_ignored','dynamic_sources','channels','delivery_signature'])||!cover(v.body_token_coverage)||!integer(v.tag_tokens,90000)||!integer(v.header_parts,8193)||!['ABSENT','PRESENT_NOT_RESOLVED','MULTIPLE_OR_INVALID','UNKNOWN'].includes(v.base)||!integer(v.script_tags,32768)||!integer(v.inline_script_tags,v.script_tags)||!integer(v.raw_text_elements_ignored,32768)||v.dynamic_sources!=='NOT_EVALUATED'||v.delivery_signature!=='NO_INDEPENDENTLY_VERIFIED_SIGNATURE_IMPLEMENTED'||!exact(v.channels,Object.keys(SPECS)))return null;
 for(const [name,[limit,kinds]] of Object.entries(SPECS)){
  const c=v.channels[name];if(!exact(c,['parse_coverage','count_coverage','count_limit','observed_count','kinds','positions','dependencies','forms'])||!cover(c.parse_coverage)||!['EXACT','SATURATED_LOWER_BOUNDS'].includes(c.count_coverage)||c.count_limit!==limit||!integer(c.observed_count,limit))return null;
  if(c.count_coverage==='SATURATED_LOWER_BOUNDS'&&c.observed_count!==limit)return null;
  for(const [key,keys] of [['kinds',kinds],['positions',POSITIONS],['dependencies',DEPS],['forms',FORMS]]){const bins=c[key];if(!exact(bins,keys)||Object.values(bins).some(n=>!integer(n,limit)))return null;const total=Object.values(bins).reduce((a,b)=>a+b,0);if(c.count_coverage==='EXACT'?total!==c.observed_count:total<c.observed_count)return null;}
  if(name.startsWith('HTTP_')?c.positions.HEADER!==c.observed_count:c.positions.HEADER!==0)return null;
  if(c.parse_coverage==='TOKEN_LIMITED'&&name.startsWith('HTTP_'))return null;
  if(!name.startsWith('HTTP_')&&v.body_token_coverage==='TOKEN_LIMITED'&&c.parse_coverage!=='TOKEN_LIMITED')return null;
  if(!name.startsWith('HTTP_')&&v.body_token_coverage==='AMBIGUOUS'&&c.parse_coverage!=='AMBIGUOUS')return null;
  const known=DEPS.filter(d=>d!=='OTHER_OR_UNKNOWN').map(d=>c.dependencies[d]);if(Math.max(...known)>c.forms.ABSOLUTE_HTTPS||c.count_coverage==='EXACT'&&known.reduce((a,b)=>a+b,0)>c.forms.ABSOLUTE_HTTPS||c.forms.INVALID>0&&c.parse_coverage==='COMPLETE_STATIC_LEXICAL_NOT_BROWSER_DOM')return null;
 }
 if(v.base==='ABSENT'&&v.body_token_coverage!=='COMPLETE_STATIC_LEXICAL_NOT_BROWSER_DOM')return null;
 if(v.channels.SCRIPT_SRC.observed_count>v.script_tags-v.inline_script_tags)return null;
 return JSON.parse(JSON.stringify(v));
}
export function parse(html,link){
 const p=spawnSync('python3',[new URL('./parser.py',import.meta.url).pathname],{input:JSON.stringify({html,link}),encoding:'utf8',timeout:2000,maxBuffer:65536,env:{PATH:process.env.PATH,LANG:'C.UTF-8',PYTHONDONTWRITEBYTECODE:'1'}});
 if(p.status!==0||p.signal||p.error||p.stderr)return null;try{return safeScan(JSON.parse(p.stdout));}catch{return null;}
}
export function fixedResult(scope){return{kind:'PASSIVE_HTML_CHANNELS_FIXED_V2',scope,status:'NOT_STARTED',phase:'ADMISSION',reason:'ADMISSION',request_attempts:0,http_status:null,cleanup:'NOT_STARTED',scan:null,interpretation:'CURRENT_NODE_HTTPS_BASELINE_NOT_HISTORICAL_CHROME_VARIANT_NOT_SOURCE_CAUSALITY',score_measured:false,report_saved:false};}
export function safeResult(v){
 if(!exact(v,Object.keys(fixedResult(null)))||v.kind!=='PASSIVE_HTML_CHANNELS_FIXED_V2'||!['NOT_STARTED','FAILED','SCANNED'].includes(v.status)||!['ADMISSION','DNS','REQUEST','HEADERS','BODY','DECODE','COMPLETE','PARSE','PERSIST','UNKNOWN'].includes(v.phase)||!['NONE','ADMISSION','DNS','TLS','NETWORK','TIMEOUT','REDIRECT','HTTP','HEADERS','MIME','ENCODING','OVERSIZE','TRUNCATED','PARSER','STORAGE','UNKNOWN'].includes(v.reason)||v.request_attempts!==null&&!integer(v.request_attempts,1)||v.http_status!==null&&(!Number.isInteger(v.http_status)||v.http_status<100||v.http_status>599)||!['NOT_STARTED','CLOSED','UNKNOWN'].includes(v.cleanup)||v.interpretation!==fixedResult(null).interpretation||v.score_measured!==false||v.report_saved!==false)return null;
 if(v.scope!==null&&(!exact(v.scope,['sha','run','ref','attempt'])||!/^[a-f0-9]{40}$/.test(v.scope.sha)||!/^[1-9][0-9]{0,23}$/.test(v.scope.run)||v.scope.ref!==REF||v.scope.attempt!==1))return null;
 if(v.scan!==null&&!safeScan(v.scan))return null;
 if(v.status==='SCANNED'&&(v.phase!=='COMPLETE'||v.reason!=='NONE'||v.request_attempts!==1||v.http_status!==200||v.cleanup!=='CLOSED'||v.scan===null))return null;
 if(v.status!=='SCANNED'&&v.scan!==null)return null;
 return JSON.parse(JSON.stringify(v));
}
