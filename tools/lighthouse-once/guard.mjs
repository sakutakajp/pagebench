import http from 'node:http';
import net from 'node:net';
export const TARGET='https://staging.hirameki.dev/ja/';
export const ORIGINS=['https://staging.hirameki.dev','https://image.hirameki.dev'];
export const SETTINGS={onlyCategories:['performance'],formFactor:'mobile',throttlingMethod:'simulate',throttling:{rttMs:300,throughputKbps:800,cpuSlowdownMultiplier:6},disableStorageReset:false,disableFullPageScreenshot:true,skipAudits:['screenshot-thumbnails','final-screenshot'],maxWaitForFcp:45000,maxWaitForLoad:60000};
const META='{"first":true,"where":[{"_path":"/ja"}],"sort":[{"_stem":1,"$numeric":true}]}';
export function allowed(request,type,icons=new Set()){
 let u;try{u=new URL(request.url);}catch{return false;}
 if(!ORIGINS.includes(u.origin)||u.username||u.password||u.hash||!['GET','HEAD'].includes(request.method))return false;
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
export function headerSafe(headers){return Object.entries(headers).filter(([k])=>!['cookie','authorization','proxy-authorization','referer'].includes(k.toLowerCase())).map(([name,value])=>({name,value:String(value)}));}
export function extractIcons(html){const result=new Set();for(const tag of html.match(/<link\b[^>]*>/gi)||[]){const attrs={};for(const m of tag.matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/g))attrs[m[1].toLowerCase()]=m[3];if(/^(icon|shortcut icon|apple-touch-icon|apple-touch-icon-precomposed)$/i.test(attrs.rel||'')){try{const u=new URL(attrs.href,TARGET);if(ORIGINS.includes(u.origin))result.add(u.href);}catch{}}}return result;}
export const CSP="worker-src 'none'; frame-src 'none'; form-action 'none'; connect-src https://staging.hirameki.dev/api/_content/query/; sandbox allow-scripts allow-same-origin";
export async function tunnel(){
 const sockets=new Set();const server=http.createServer((q,r)=>{r.writeHead(403);r.end();});
 server.on('connect',(req,client,head)=>{
  if(!['staging.hirameki.dev:443','image.hirameki.dev:443'].includes(req.url)){client.destroy();return;}
  const upstream=net.connect(443,req.url.split(':')[0]);for(const s of [client,upstream]){sockets.add(s);s.on('close',()=>sockets.delete(s));s.setTimeout(30000,()=>s.destroy());}
  upstream.on('connect',()=>{client.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head.length)upstream.write(head);upstream.pipe(client);client.pipe(upstream);});
  upstream.on('error',()=>client.destroy());client.on('error',()=>upstream.destroy());
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 return {url:'http://127.0.0.1:'+server.address().port,close:async()=>{for(const s of sockets)s.destroy();await new Promise(r=>server.close(r));}};
}
export async function installGuard(session, mainFrame){
 const stats={allowed:0,blocked:0,html200:false,fatal:null};let icons=new Set(),documents=0;const types=new Map();
 const stop=code=>{stats.fatal??=code;};
 await session.send('Network.enable');await session.send('Network.setBypassServiceWorker',{bypass:true});
 await session.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'},{urlPattern:'*',requestStage:'Response'}]});
 session.on('Fetch.requestPaused',async e=>{try{
  if(e.responseStatusCode!==undefined){
   if(e.responseStatusCode>=300&&e.responseStatusCode<400){stop('REDIRECT');await session.send('Fetch.failRequest',{requestId:e.requestId,errorReason:'BlockedByClient'});return;}
   const type=types.get(e.requestId)||e.resourceType;
   if(type==='Document'){
    const hs=e.responseHeaders||[],mime=hs.find(h=>h.name.toLowerCase()==='content-type')?.value||'';
    if(e.responseStatusCode!==200||!/^text\/html\b/i.test(mime)){stop('HTML_HTTP');await session.send('Fetch.failRequest',{requestId:e.requestId,errorReason:'BlockedByClient'});return;}
    const body=await session.send('Fetch.getResponseBody',{requestId:e.requestId});const html=body.base64Encoded?Buffer.from(body.body,'base64').toString():body.body;
    if(html.length>4194304||!/["']?IS_PRODUCTION["']?\s*:\s*false\b/.test(html)||/(google-analytics\.com|googletagmanager\.com|googlesyndication\.com|doubleclick\.net|googleadservices\.com)/i.test(html)){stop('HTML_ENV');await session.send('Fetch.failRequest',{requestId:e.requestId,errorReason:'BlockedByClient'});return;}
    icons=extractIcons(html);stats.html200=true;
    await session.send('Fetch.continueResponse',{requestId:e.requestId,responseCode:200,responseHeaders:[...hs,{name:'Content-Security-Policy',value:CSP}]});return;
   }
   const hs=e.responseHeaders||[];
   if(hs.some(h=>h.name.toLowerCase()==='set-cookie'||(h.name.toLowerCase()==='cache-control'&&/private|no-store/i.test(h.value)))){
    stop('NONPUBLIC_RESPONSE');await session.send('Fetch.failRequest',{requestId:e.requestId,errorReason:'BlockedByClient'});return;
   }
   await session.send('Fetch.continueResponse',{requestId:e.requestId});return;
  }
  const doc=e.resourceType==='Document';
  if(stats.fatal||!allowed(e.request,e.resourceType,icons)||(doc&&(e.frameId!==mainFrame||++documents>1))||stats.allowed>=120){
   stats.blocked++;if(doc)stop('NAVIGATION_SCOPE');if(stats.allowed>=120)stop('REQUEST_LIMIT');await session.send('Fetch.failRequest',{requestId:e.requestId,errorReason:'BlockedByClient'});return;
  }
  if(/prefetch/i.test(e.request.headers['Sec-Purpose']||e.request.headers['sec-purpose']||'')){stats.blocked++;await session.send('Fetch.failRequest',{requestId:e.requestId,errorReason:'BlockedByClient'});return;}
  stats.allowed++;types.set(e.requestId,e.resourceType);
  await session.send('Fetch.continueRequest',{requestId:e.requestId,headers:headerSafe(e.request.headers)});
 }catch{stop('GUARD_FAILURE');try{await session.send('Fetch.failRequest',{requestId:e.requestId,errorReason:'BlockedByClient'});}catch{}}});
 return stats;
}
export function summarize(lhr,stats,chrome){
 if(stats.fatal||!stats.html200||lhr.runtimeError||lhr.requestedUrl!==TARGET||lhr.finalDisplayedUrl!==TARGET||lhr.finalUrl!==TARGET)throw Error('RESULT_SCOPE');
 const c=lhr.configSettings;if(c.formFactor!=='mobile'||c.throttlingMethod!=='simulate'||c.disableStorageReset!==false||c.throttling.rttMs!==300||c.throttling.throughputKbps!==800||c.throttling.cpuSlowdownMultiplier!==6)throw Error('CONFIG_MISMATCH');
 if(lhr.lighthouseVersion!=='13.6.0'||!chrome.endsWith('/157.0.8103.78'))throw Error('VERSION_MISMATCH');
 const score=lhr.categories.performance.score;if(typeof score!=='number'||!Number.isFinite(score)||score<0||score>1)throw Error('SCORE');
 const metrics={};for(const [name,id]of Object.entries({lcp:'largest-contentful-paint',tbt:'total-blocking-time',cls:'cumulative-layout-shift',fcp:'first-contentful-paint',si:'speed-index'})){const v=lhr.audits[id]?.numericValue;if(typeof v!=='number'||!Number.isFinite(v)||v<0)throw Error('METRIC');metrics[name]=v;}
 return {kind:'restricted-staging-lighthouse-cli',status:'success',url:TARGET,final_url:lhr.finalUrl,lighthouse:lhr.lighthouseVersion,chrome,fetch_time:lhr.fetchTime,settings:{formFactor:c.formFactor,throttlingMethod:c.throttlingMethod,throttling:c.throttling,screenEmulation:c.screenEmulation,disableStorageReset:c.disableStorageReset},performance:Math.round(score*100),metrics,network:stats,restrictions:['two-origin-read-only','CSP-blocks-workers-frames-popups-forms','CDP-interception-overhead','fresh-profile'],screenshots_saved:0};
}
