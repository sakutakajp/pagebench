import{FixtureGateway}from'./fixture-gateway.mjs';import{allowed,headerSafe,extractIcons,TARGET}from'../lighthouse-once/guard.mjs';
export const STAGING_TARGET=TARGET;
const MEMORY_HTML='<!doctype html><html><head><script>window.__NUXT__={config:{public:{IS_PRODUCTION:false}}};window.fixtureReady=true;</script><link rel="icon" href="data:,"></head><body><h1>Staging policy memory fixture</h1><p>Known memory content.</p></body></html>';
const FALSE_MARKER=/IS_PRODUCTION(?:\\?["'])?\s*:\s*false\b/;
const TRUE_MARKER=/IS_PRODUCTION(?:\\?["'])?\s*:\s*true\b/;
export function htmlFlags(body){return {bounded_html:typeof body==='string'&&Buffer.byteLength(body)<=1048576,production_false:typeof body==='string'&&FALSE_MARKER.test(body),production_true:typeof body==='string'&&TRUE_MARKER.test(body),tracking_marker:typeof body==='string'&&/(googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net|adsbygoogle)/i.test(body)};}
export function checkPublicHtml(body){const f=htmlFlags(body);return f.bounded_html&&f.production_false&&!f.production_true&&!f.tracking_marker;}
export function denyCategory(request,type){let u;try{u=new URL(request.url);}catch{return'URL_INVALID';}if(!['GET','HEAD'].includes(request.method)||request.postData)return'METHOD_OR_BODY';if(/(google-analytics|googletagmanager|googlesyndication|doubleclick|adsbygoogle)/i.test(u.href))return'TELEMETRY_ADS';if(!['https://staging.hirameki.dev','https://image.hirameki.dev'].includes(u.origin))return'OUTSIDE_ORIGIN';if(u.username||u.password||u.hash)return'CREDENTIAL_OR_FRAGMENT';if(type==='Fetch'||type==='XHR'||/\/api\//.test(u.pathname))return'UNAPPROVED_API';if(u.search)return'UNSAFE_QUERY';return'UNAPPROVED_RESOURCE';}
export class StagingGateway extends FixtureGateway{
 get documentURL(){return TARGET;}
 constructor(...args){super(...args);this.memory=false;this.activeRequests=new Set();this.waitingRequests=[];this.liveRequestMeta=new Map();Object.assign(this.stats,{live_documents:0,http_status:null,html_validated:false,continued_requests:0,blocked_categories:{},prefetch_blocked:0,stripped_credentials:0,max_inflight:0});}
 block(category){this.stats.blocked_categories[category]=(this.stats.blocked_categories[category]||0)+1;this.stats.blocked++;}
 async startRequest(e){if(this.stopping)return;this.activeRequests.add(e.networkId);this.stats.max_inflight=Math.max(this.stats.max_inflight,this.activeRequests.size);this.stats.continued_requests++;const headers=headerSafe(e.request.headers||{}).filter(h=>!['x-api-key','x-goog-api-key'].includes(h.name.toLowerCase()));this.stats.stripped_credentials+=Object.keys(e.request.headers||{}).filter(k=>/^(cookie|authorization|proxy-authorization|x-api-key|x-goog-api-key)$/i.test(k)).length;await this.call('Fetch.continueRequest',{requestId:e.requestId,headers},this.primary);}
 async receive(raw){
  try{if(typeof raw==='string'&&raw.length<=1048576){const m=JSON.parse(raw);if(['Network.loadingFinished','Network.loadingFailed'].includes(m.method)&&m.sessionId===this.primary){this.activeRequests.delete(m.params?.requestId);while(!this.stopping&&this.waitingRequests.length&&this.activeRequests.size<6)await this.startRequest(this.waitingRequests.shift());}}}catch{this.fail('NETWORK_TRACKING_FAILED');return;}
  return super.receive(raw);
 }
 async request(e,id){
  const abort=()=>this.call('Fetch.failRequest',{requestId:e.requestId,errorReason:'BlockedByClient'},id);
  if(e.redirectedRequestId){await abort();this.fail('REDIRECT');return;}
  if(e.responseStatusCode!==undefined||e.responseErrorReason){
   const meta=this.liveRequestMeta.get(e.requestId);if(!meta||e.responseErrorReason){await abort();this.fail('RESPONSE_SCOPE_OR_NETWORK_ERROR');return;}
   const status=e.responseStatusCode;if(status>=300&&status<400){await abort();this.fail('REDIRECT');return;}
   const h=Object.fromEntries((e.responseHeaders||[]).map(h=>[h.name.toLowerCase(),h.value]));
   if(status!==200||h['www-authenticate']||h['proxy-authenticate']||/\bprivate\b/i.test(h['cache-control']||'')){if(meta.type==='Document')this.stats.http_status=status;await abort();this.fail('HTTP_OR_PUBLIC_SCOPE');return;}
   const mime=h['content-type']||'';const permitted=meta.type==='Document'?/^text\/html\b/i.test(mime):meta.type==='Script'?/^(application|text)\/(javascript|ecmascript)\b/i.test(mime):meta.type==='Stylesheet'?/^text\/css\b/i.test(mime):meta.type==='Font'?/^(font\/|application\/(font|octet-stream))/i.test(mime):['Image','Other'].includes(meta.type)?/^image\//i.test(mime):['Fetch','XHR'].includes(meta.type)?/^application\/json\b/i.test(mime):/^(audio\/|video\/|text\/vtt\b)/i.test(mime);
   if(!permitted){await abort();this.fail('RESOURCE_MIME');return;}
   if(meta.type==='Document'){
    this.stats.http_status=status;const data=await this.call('Fetch.getResponseBody',{requestId:e.requestId},id);let body;
    try{body=data.base64Encoded?Buffer.from(data.body,'base64').toString('utf8'):data.body;}catch{body=null;}
    this.stats.html_flags=htmlFlags(body);if(!checkPublicHtml(body)){await abort();this.fail('HTML_PUBLIC_OR_TRACKING_GUARD');return;}
    this.icons=extractIcons(body);this.stats.html_validated=true;this.stats.html200=true;
   }
   await this.call('Fetch.continueResponse',{requestId:e.requestId},id);return;
  }
  const request=e.request||{},headers=request.headers||{};
  if(/prefetch/i.test(headers['sec-purpose']||headers['Sec-Purpose']||headers.Purpose||headers.purpose||'')){this.stats.prefetch_blocked++;await abort();if(this.stats.prefetch_blocked>256)this.fail('PREFETCH_LIMIT');return;}
  if(request.postData||!allowed(request,e.resourceType,this.icons)){this.block(denyCategory(request,e.resourceType));await abort();if(e.resourceType==='Document')this.fail('NAVIGATION_SCOPE');return;}
  if(e.resourceType==='Document'&&(request.url!==TARGET||request.method!=='GET'||e.frameId!==this.sessions.get(this.primary)?.frame||++this.stats.live_documents>1)){await abort();this.fail('NAVIGATION_SCOPE');return;}
  if(++this.stats.allowed>120){await abort();this.fail('REQUEST_LIMIT');return;}
  this.liveRequestMeta.set(e.requestId,{type:e.resourceType});
  if(this.memory){const body=e.resourceType==='Document'?MEMORY_HTML:['Fetch','XHR'].includes(e.resourceType)?'{}':'window.resourceReady=true;';if(e.resourceType==='Document'){if(!checkPublicHtml(body)){this.fail('MEMORY_HTML_INVALID');return;}this.icons=extractIcons(body);this.stats.html200=true;this.stats.html_validated=true;this.stats.http_status=200;}await this.call('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:e.resourceType==='Document'?'text/html':['Fetch','XHR'].includes(e.resourceType)?'application/json':'text/javascript'}],body:Buffer.from(body).toString('base64')},id);return;}
  if(typeof e.networkId!=='string'||!e.networkId||this.activeRequests.has(e.networkId)){await abort();this.fail('NETWORK_ID_REQUIRED');return;}
  if(this.activeRequests.size>=6){this.waitingRequests.push(e);return;}await this.startRequest(e);
 }
}
export class MemoryStagingGateway extends StagingGateway{constructor(...args){super(...args);this.memory=true;}}
