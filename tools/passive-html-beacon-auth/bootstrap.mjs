// Only pure factories / Node builtins load before the step-scoped token is removed.
import {pathToFileURL} from 'node:url';
import {takeApiReader} from './credential.mjs';
import {fixedResult} from './record.mjs';
import {persistFixed} from './persist.mjs';
const labels=Object.freeze({MISSING:'API_TOKEN_MISSING',INVALID:'API_TOKEN_INVALID',ENV_UNCLEARED:'API_TOKEN_ENV_UNCLEARED'});
const defaultLoad=async()=>({run:(await import('./entry.mjs')).run,admit:(await import('./admission.mjs')).admit,safeResult:(await import('./project.mjs')).safeResult});
export async function bootstrap({env=process.env,transport=globalThis.fetch,load=defaultLoad,persist=persistFixed}={}){
 const api=takeApiReader(env,transport); // Before application imports, Git, Python or other children.
 const fail=category=>{const result={...fixedResult(null),status:'FAILED',admission_category:category};try{persist(result);}catch{result.reason='STORAGE';result.phase='PERSIST';}return{code:1,result};};
 try{
  if(api.status!=='READY')return fail(labels[api.status]||'UNKNOWN');
  let modules;try{modules=await load();}catch{return fail('BOOT_LOAD_UNKNOWN');}
  try{const v=await modules.run({admission:({observe}={})=>modules.admit({env,fetcher:api.read,observe}),persist});const safe=modules.safeResult(v.result);if(!safe||![0,1].includes(v.code)||(v.code===0)!==(safe.status==='SCANNED'))return fail('BOOT_RUN_UNKNOWN');return{code:v.code,result:safe};}catch{return fail('BOOT_RUN_UNKNOWN');}
 }finally{api.dispose();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const v=await bootstrap();console.log(JSON.stringify(v.result));process.exitCode=v.code;}
