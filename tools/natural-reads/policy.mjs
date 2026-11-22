// Local diagnostic only. Purpose headers never decide permission or limits.
import {readFileSync} from 'node:fs';
import {allowed} from '../lighthouse-once/guard.mjs';
export const TARGET='https://staging.hirameki.dev/ja/';
export const ORIGINS=Object.freeze(['https://staging.hirameki.dev','https://image.hirameki.dev']);
export const TOTAL_REQUESTS=120,INFLIGHT=6;
const catalog=JSON.parse(readFileSync(new URL('./public-routes.json',import.meta.url),'utf8'));
const publicStatic=new Set(catalog.public_static_paths),routes=new Set(catalog.paths),metaPaths=new Set(catalog.paths.map(p=>p==='/'?'/':p.replace(/\/$/,'')));
const forbidden=/(^|\/)(api|graphql|collect|analytics|telemetry|tracking|track|beacon|ads|adsense|gtm|ga4|metrics|admin|manage|management|account|auth|login|logout|debug|__nuxt_error)(\/|[._-]|$)/i;
const creds=/^(cookie|authorization|proxy-authorization|x-api-key|x-goog-api-key)$/i;
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function contentKind(u){
 if(u.origin!==ORIGINS[0]||!/^\/api\/_content\/query\/[A-Za-z0-9_.-]{1,100}\.json$/.test(u.pathname)||u.search.length>4500||!eq([...u.searchParams.keys()],['_params']))return null;
 let v=u.searchParams.get('_params');try{try{v=JSON.parse(v);}catch{v=JSON.parse(decodeURIComponent(v));}}catch{return null;}
 if(!plain(v)||!Array.isArray(v.sort)||v.sort.length!==1||!plain(v.sort[0]))return null;
 const s=v.sort[0],k=Object.keys(s);if(k.length!==2||s.$numeric!==true||!['_stem','_file'].some(x=>s[x]===1&&k.includes(x)))return null;
 const keys=Object.keys(v).sort();
 if(eq(keys,['first','sort','where'])&&v.first===true&&Array.isArray(v.where)&&v.where.length===1&&plain(v.where[0])&&eq(Object.keys(v.where[0]),['_path'])&&metaPaths.has(v.where[0]._path))return v.where[0]._path==='/ja'?'HOME_METADATA':'PUBLIC_ROUTE_METADATA';
 const expectedWhere=[{homepage:true,_partial:false,_path:{$not:'--REGEX /^\\/ja\\/blog/'}},{_path:'--REGEX /^\\/ja/'}];
 if(eq(keys,['only','sort','where'])&&eq(v.only,['_path','title','description','category'])&&eq(v.where,expectedWhere))return'HOME_DIRECTORY';
 return null;
}
export function classifyRequest(e){
 const r=e?.request||{};let u,p;try{if(typeof r.url!=='string'||r.url.length>8192)return{code:'URL'};u=new URL(r.url);p=decodeURIComponent(u.pathname);}catch{return{code:'URL'};}
 if(e.redirectedRequestId!==undefined)return{code:'REDIRECT'};
 if(!ORIGINS.includes(u.origin)||u.username||u.password||u.hash)return{code:'ORIGIN'};
 if(!['GET','HEAD'].includes(r.method)||r.postData||r.hasPostData||r.postDataEntries)return{code:'METHOD'};
 if(!plain(r.headers||{})||Object.keys(r.headers||{}).some(k=>creds.test(k)))return{code:'CREDENTIAL'};
 if(/%|\\|[\x00-\x20]/.test(p))return{code:'SCOPE'};
 if(e.resourceType==='Document')return u.href===TARGET&&r.method==='GET'?{code:'ALLOW',kind:'MAIN_HTML'}:{code:'NAVIGATION'};
 const reading=['Fetch','XHR','Other','Prefetch','Script'].includes(e.resourceType);
 const content=reading?contentKind(u):null;if(content)return{code:'ALLOW',kind:content};
 if(forbidden.test(p))return{code:'SCOPE'};
 const staticSafe=allowed(r,'Script');
 if(reading&&staticSafe&&u.origin===ORIGINS[0]&&publicStatic.has(p))return{code:'ALLOW',kind:'PUBLIC_STATIC'};
 if(reading&&staticSafe&&u.origin===ORIGINS[1]&&/\.(webp|png|jpe?g|gif|avif|svg|ico)$/i.test(p))return{code:'ALLOW',kind:'IMAGE_STATIC'};
 if(u.origin===ORIGINS[0]&&reading){
  if(!u.search&&routes.has(p))return{code:'ALLOW',kind:'PUBLIC_HTML'};
  const q=u.search;const bareHash=!q||/^\?(?:[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}|[0-9]{10,16})$/.test(q);
  const payload=p.match(/^(.*\/)_(?:payload)\.(?:json|js)$/);if(payload&&routes.has(payload[1])&&(bareHash||staticSafe))return{code:'ALLOW',kind:p.endsWith('.js')?'NUXT_PAYLOAD_JS':'NUXT_PAYLOAD_JSON'};
  if(p.startsWith('/_nuxt/')&&p.length>8&&staticSafe)return{code:'ALLOW',kind:'NUXT_STATIC'};
 }
 const imageOther=e.resourceType==='Other'&&(Object.entries(r.headers||{}).some(([k,v])=>k.toLowerCase()==='sec-fetch-dest'&&v==='image')||['/favicon.ico','/favicon-32x32.png','/favicon-16x16.png'].includes(p));
 if((['Script','Stylesheet','Image','Font','Media','TextTrack'].includes(e.resourceType)||imageOther)&&staticSafe)return{code:'ALLOW',kind:e.resourceType==='Font'?'FONT':'STATIC'};
 return{code:'SCOPE'};
}
export function responseMime(kind,mime){
 if(['MAIN_HTML','PUBLIC_HTML'].includes(kind))return mime==='text/html';
 if(['HOME_METADATA','PUBLIC_ROUTE_METADATA','HOME_DIRECTORY','NUXT_PAYLOAD_JSON'].includes(kind))return mime==='application/json';
 if(kind==='NUXT_PAYLOAD_JS')return /^(application|text)\/(javascript|ecmascript)$/.test(mime);
 if(kind==='PUBLIC_STATIC'&&/^(text\/(plain|xml)$|application\/(xml|manifest\+json)$)/.test(mime))return true;
 if(kind==='IMAGE_STATIC')return /^image\//.test(mime);
 if(kind==='FONT')return /^(font\/|application\/(font|octet-stream))/.test(mime);
 return /^(image\/|font\/|audio\/|video\/|text\/(css|javascript|ecmascript|vtt)$|application\/(javascript|ecmascript|json|font[^/]*|octet-stream)$)/.test(mime);
}
export const routeEvidence=Object.freeze({kind:catalog.kind,source_sha:catalog.source_sha,route_count:routes.size,current_deployment_match:'UNKNOWN'});
