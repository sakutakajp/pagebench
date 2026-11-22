// Diagnostic projection only. Never used to grant, modify, or forward a request.
// Source contract: existing lighthouse-once/guard.mjs; site ja/index.vue uses queryContent(route.path).findOne().
const META='{"first":true,"where":[{"_path":"/ja"}],"sort":[{"_stem":1,"$numeric":true}]}';
const KINDS=['CONTENT_QUERY_PATH_MISMATCH','CONTENT_PARAMS_SHAPE_MISMATCH','CONTENT_PARAMS_VALUE_MISMATCH','CONTENT_CONTRACT_MATCH','OTHER_API','OTHER_OR_UNKNOWN'];
const unknown=()=>({kind:'OTHER_OR_UNKNOWN',prefetch:null});
const data=(o,k)=>{if(!o||typeof o!=='object')return undefined;const d=Object.getOwnPropertyDescriptor(o,k);return d&&Object.hasOwn(d,'value')?d.value:undefined;};
export function scopeFetch(e){
 try{
  const r=data(e,'request'),method=data(r,'method'),url=data(r,'url');if(data(e,'resourceType')!=='Fetch'||!r||!['GET','HEAD'].includes(method)||typeof url!=='string'||url.length>8192)return unknown();
  const headers=data(r,'headers');if(!headers||typeof headers!=='object'||Array.isArray(headers))return unknown();
  const names=Object.getOwnPropertyNames(headers);if(names.length>128)return unknown();
  const entries=names.map(k=>[k,data(headers,k)]);if(entries.some(([k,v])=>k.length>256||typeof v!=='string'||v.length>1024))return unknown();
  const prefetch=entries.some(([k,v])=>['sec-purpose','purpose'].includes(k.toLowerCase())&&/prefetch/i.test(v));
  const result=kind=>({kind,prefetch});const u=new URL(url);
  if(u.origin!=='https://staging.hirameki.dev'||u.username||u.password||u.hash)return result('OTHER_OR_UNKNOWN');
  let p;try{p=decodeURIComponent(u.pathname);}catch{return result('OTHER_OR_UNKNOWN');}
  if(/%|\\|[\x00-\x20]/.test(p))return result('OTHER_OR_UNKNOWN');
  if(/^\/api\/_content\/query(?:\/|$)/.test(p)){
   if(!/^\/api\/_content\/query\/[A-Za-z0-9_.-]{1,100}\.json$/.test(p))return result('CONTENT_QUERY_PATH_MISMATCH');
   if(u.search.length>4500||JSON.stringify([...u.searchParams.keys()])!=='["_params"]')return result('CONTENT_PARAMS_SHAPE_MISMATCH');
   let v=u.searchParams.get('_params');try{try{v=JSON.parse(v);}catch{v=JSON.parse(decodeURIComponent(v));}}catch{return result('CONTENT_PARAMS_SHAPE_MISMATCH');}
   return result(JSON.stringify(v)===META?'CONTENT_CONTRACT_MATCH':'CONTENT_PARAMS_VALUE_MISMATCH');
  }
  return result(/^\/api(?:\/|$)/.test(p)?'OTHER_API':'OTHER_OR_UNKNOWN');
 }catch{return unknown();}
}
export function safeScopeFetch(v){return v&&KINDS.includes(v.kind)&&[true,false,null].includes(v.prefetch)?{kind:v.kind,prefetch:v.prefetch}:null;}
