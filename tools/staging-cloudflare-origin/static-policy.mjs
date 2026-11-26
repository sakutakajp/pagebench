// Exact existing static path/query/type/method predicates, bound only to the scoped origins.
import {ORIGINS} from './config.mjs';
import {TARGET} from '../natural-reads/policy.mjs';
const META='{"first":true,"where":[{"_path":"/ja"}],"sort":[{"_stem":1,"$numeric":true}]}';
export function allowed(request,type,icons=new Set()){
 let u;try{u=new URL(request.url);}catch{return false;}
 if(!ORIGINS.includes(u.origin)||u.username||u.password||u.hash||!['GET','HEAD'].includes(request.method))return false;
 if(u.origin===ORIGINS[2]&&type!=='Script')return false;
 if(type==='Document')return u.href===TARGET;
 let p;try{p=decodeURIComponent(u.pathname);}catch{return false;}
 if(/%|\\|[\x00-\x20]/.test(p))return false;
 if(type==='Fetch'||type==='XHR'){
  if(u.origin!==ORIGINS[0]||!/^\/api\/_content\/query\/[A-Za-z0-9_.-]{1,100}\.json$/.test(p)||u.search.length>4500||JSON.stringify([...u.searchParams.keys()])!=='["_params"]')return false;
  let v=u.searchParams.get('_params');try{try{v=JSON.parse(v);}catch{v=JSON.parse(decodeURIComponent(v));}return JSON.stringify(v)===META;}catch{return false;}
 }
 if(/(^|\/)(api|graphql|collect|analytics|telemetry|tracking|track|beacon|ads|adsense|gtm|ga4|metrics)(\/|[._-]|$)/i.test(p))return false;
 const seen=new Set();for(const [k,v]of u.searchParams){
  if(seen.has(k)||u.search.length>512)return false;seen.add(k);
  if(['w','h','width','height','quality','q','dpr'].includes(k)){if(!/^\d{1,5}(\.\d{1,2})?$/.test(v))return false;}
  else if(['v','ver','version','hash','t'].includes(k)){if(!/^[A-Fa-f0-9.-]{1,64}$/.test(v))return false;}
  else if(['fit','format','fm','auto'].includes(k)){if(!/^(cover|contain|crop|fill|scale-down|webp|avif|png|jpeg|jpg|format|compress|format,compress)$/.test(v))return false;}
  else return false;
 }
 return ['Script','Stylesheet','Image','Font','Media','TextTrack'].includes(type)||(type==='Other'&&icons.has(u.href));
}
