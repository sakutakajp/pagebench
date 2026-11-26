import {writeFileSync,readFileSync,linkSync,unlinkSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {admit} from './admission.mjs';
import {getDocument} from '../passive-html/transport.mjs';
import {parse,fixedResult,safeResult} from './project.mjs';
import {fixedCategory} from './admission-category.mjs';
export async function run({admission=admit,get=getDocument,parser=parse,persist=v=>{const path='passive-html-origin-joint-public.json';const text=JSON.stringify(v);writeFileSync(path+'.tmp',text,{mode:0o600,flag:'wx'});if(readFileSync(path+'.tmp','utf8')!==text)throw Error('STORAGE');linkSync(path+'.tmp',path);unlinkSync(path+'.tmp');if(readFileSync(path,'utf8')!==text)throw Error('STORAGE');}}={}){
 let result=fixedResult(null);
 try{result.scope=await admission({observe:value=>{result.admission_category=fixedCategory(value);}});result.phase='DNS';result.request_attempts=null;result.cleanup='UNKNOWN';const v=await get();result.request_attempts=v.requests;result.http_status=v.http;result.cleanup=v.cleanup;result.phase=v.phase;result.reason=v.reason;result.status='FAILED';
  if(v.ok){result.phase='PARSE';result.reason='PARSER';const scan=parser(v.html,v.link);v.html=null;v.link=null;if(scan){result.scan=scan;result.phase='COMPLETE';result.reason='NONE';result.status='SCANNED';}}
 }catch{result.status='FAILED';result.reason=result.scope===null?'ADMISSION':'UNKNOWN';}
 const safe=safeResult(result);if(!safe)return{code:1,result:{...fixedResult(null),status:'FAILED',reason:'UNKNOWN'}};
 try{persist(safe);}catch{safe.status='FAILED';safe.reason='STORAGE';safe.phase='PERSIST';safe.scan=null;return{code:1,result:safe};}
 return{code:safe.status==='SCANNED'?0:1,result:safe};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const {code,result}=await run();console.log(JSON.stringify(result));process.exitCode=code;
}
