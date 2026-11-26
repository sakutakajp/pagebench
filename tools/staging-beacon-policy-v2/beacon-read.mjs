// Narrow raw identity: never expand a match via URL normalization or decoding.
const urls=['https://static.cloudflareinsights.com/beacon.min.js','https://static.cloudflareinsights.com:443/beacon.min.js'];
export const SUFFIX_SHAPE='V_HEX32_DECIMAL13_ONE_SEGMENT';
// Observed shape only, not a claim about version/hash/timestamp semantics.
export function isBeaconURL(u){
 if(typeof u!=='string')return false;
 if(urls.includes(u))return true;
 const prefix=urls.find(x=>u.startsWith(x+'/'));if(!prefix)return false;
 const suffix=u.slice(prefix.length+1);
 // Exact length also forbids the final-newline exception of a JS '$' anchor.
 return suffix.length===46&&/^v[0-9a-f]{32}[0-9]{13}$/.test(suffix);
}
export const javascriptMime=m=>m==='text/javascript'||m==='application/javascript';
export function beaconRead(r,type){if(type!=='Script'||r?.method!=='GET'||!isBeaconURL(r.url)||r.postData!==undefined||r.postDataEntries!==undefined||r.hasPostData===true)return false;const h=r.headers??{};return h!==null&&typeof h==='object'&&!Array.isArray(h)&&![...Object.keys(h)].some(k=>/^(cookie|authorization|proxy-authorization|x-api-key|x-goog-api-key)$/i.test(k));}
export function javascriptResponse(r){if(!javascriptMime(r?.mimeType))return false;const h=Object.entries(r.headers??{}).filter(([k])=>k.toLowerCase()==='content-type');return h.length===1&&typeof h[0][1]==='string'&&h[0][1].length<=256&&javascriptMime(h[0][1].split(';',1)[0].trim().toLowerCase());}
