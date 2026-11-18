import {test}from'node:test';import assert from'node:assert/strict';import {EventEmitter}from'node:events';import http from'node:http';import net from'node:net';
import {allowed,headerSafe,extractIcons,CSP,tunnel,installGuard,summarize,TARGET,SETTINGS}from'./guard.mjs';
const req=(url,method='GET')=>({url,method,headers:{Cookie:'fixture-private',Authorization:'fixture-private'}});
test('scope, API/query/write/third-party refusal; exact metadata and icons',()=>{
 for(const host of ['https://staging.hirameki.dev','https://image.hirameki.dev'])assert.ok(allowed(req(host+'/asset'),'Script'));
 for(const [u,m,t]of [['https://hirameki.dev/a','GET','Image'],['http://staging.hirameki.dev/a','GET','Script'],['https://staging.hirameki.dev:444/a','GET','Script'],[TARGET,'POST','Document'],[TARGET+'x','GET','Document'],['https://staging.hirameki.dev/api/private','GET','Image'],['https://image.hirameki.dev/x','GET','Fetch'],['https://image.hirameki.dev/a?token=private','GET','Image']])assert.equal(allowed(req(u,m),t),false);
 const icons=extractIcons('<link rel="icon" href="/favicon-32x32.png">');assert.ok(allowed(req('https://staging.hirameki.dev/favicon-32x32.png'),'Other',icons));assert.equal(allowed(req('https://staging.hirameki.dev/unknown'),'Other',icons),false);
 assert.deepEqual(headerSafe(req(TARGET).headers),[]);assert.match(CSP,/worker-src 'none'/);assert.match(CSP,/sandbox allow-scripts allow-same-origin/);
 const u='https://staging.hirameki.dev/api/_content/query/hash.json?_params='+encodeURIComponent(JSON.stringify({first:true,where:[{_path:'/ja'}],sort:[{_stem:1,$numeric:true}]}));assert.ok(allowed(req(u),'Fetch'));assert.equal(allowed(req(u+'&token=x'),'Fetch'),false);
});
class Session extends EventEmitter{calls=[];async send(method,params){this.calls.push({method,params});if(method==='Fetch.getResponseBody')return {base64Encoded:false,body:'<html><script>window.flags={IS_PRODUCTION:false}</script><link rel="icon" href="/favicon-32x32.png"></html>'};return {};}}
const pause=async(s,e)=>{s.emit('Fetch.requestPaused',e);await new Promise(r=>setImmediate(r));};
test('actual guard handler sequence; secret headers stripped; redirect/extra navigation stop',async()=>{
 const s=new Session(),st=await installGuard(s,'main');await pause(s,{requestId:'one',request:req(TARGET),resourceType:'Document',frameId:'main'});assert.ok(!JSON.stringify(s.calls).includes('fixture-private'));
 await pause(s,{requestId:'one',request:req(TARGET),resourceType:'Document',responseStatusCode:200,responseHeaders:[{name:'Content-Type',value:'text/html'}]});assert.equal(st.html200,true);assert.ok(JSON.stringify(s.calls).includes('Content-Security-Policy'));
 await pause(s,{requestId:'favicon',request:req('https://staging.hirameki.dev/favicon-32x32.png'),resourceType:'Other'});assert.equal(st.allowed,2);
 await pause(s,{requestId:'evil',request:req('https://third.invalid/a'),resourceType:'Script'});assert.equal(st.blocked,1);
 await pause(s,{requestId:'favicon',request:req(TARGET),resourceType:'Other',responseStatusCode:302,responseHeaders:[]});assert.equal(st.fatal,'REDIRECT');
 await pause(s,{requestId:'next',request:req(TARGET),resourceType:'Document',frameId:'main'});assert.equal(st.fatal,'REDIRECT');
});
test('120 cap; non-HTML HTTP failure',async()=>{
 const s=new Session(),st=await installGuard(s,'main');for(let i=0;i<121;i++)await pause(s,{requestId:String(i),request:req('https://image.hirameki.dev/x'+i),resourceType:'Image'});assert.equal(st.allowed,120);assert.equal(st.fatal,'REQUEST_LIMIT');
 const t=new Session(),b=await installGuard(t,'main');await pause(t,{requestId:'doc',request:req(TARGET),resourceType:'Document',responseStatusCode:403,responseHeaders:[{name:'Content-Type',value:'text/html'}]});assert.equal(b.fatal,'HTML_HTTP');
});
test('actual proxy denies HTTP and external CONNECT without outbound',async()=>{
 const p=await tunnel();try{
 const status=await new Promise((resolve,reject)=>{http.get(p.url,{path:'http://third.invalid/'},r=>{r.resume();resolve(r.statusCode)}).on('error',reject)});assert.equal(status,403);
 await new Promise((resolve,reject)=>{const s=net.connect(Number(new URL(p.url).port),'127.0.0.1',()=>s.write('CONNECT third.invalid:443 HTTP/1.1\r\nHost: third.invalid:443\r\n\r\n'));s.on('end',resolve);s.on('error',reject);});
 }finally{await p.close();}
});
test('actual LHR settings contract; mismatch/missing metrics fail; sanitized export',()=>{
 const l={requestedUrl:TARGET,finalUrl:TARGET,finalDisplayedUrl:TARGET,lighthouseVersion:'13.6.0',fetchTime:'2026-11-18T00:00:00.000Z',configSettings:{...SETTINGS,screenEmulation:{mobile:true}},categories:{performance:{score:0.81}},audits:{}};
 for(const id of ['largest-contentful-paint','total-blocking-time','cumulative-layout-shift','first-contentful-paint','speed-index'])l.audits[id]={numericValue:1};const st={fatal:null,html200:true};const out=summarize(l,st,'Chrome/157.0.8103.78');assert.equal(out.performance,81);assert.ok(!JSON.stringify(out).includes('audits'));assert.equal(out.screenshots_saved,0);
 for(const change of [{finalUrl:'https://hirameki.dev/ja/'},{runtimeError:{}},{lighthouseVersion:'13.5.0'},{audits:{}},{configSettings:{...l.configSettings,throttlingMethod:'devtools'}}])assert.throws(()=>summarize({...l,...change},st,'Chrome/157.0.8103.78'));
});
test('official Lighthouse resolves actual mobile simulator settings and screenshot exclusions',async()=>{
 const {initializeConfig}=await import('lighthouse/core/config/config.js');
 const resolved=await initializeConfig('navigation',{extends:'lighthouse:default',settings:SETTINGS},{logLevel:'silent'});
 const config=resolved.resolvedConfig;
 assert.equal(config.settings.formFactor,'mobile');assert.equal(config.settings.throttling.rttMs,300);assert.equal(config.settings.throttling.throughputKbps,800);assert.equal(config.settings.throttling.cpuSlowdownMultiplier,6);
 assert.equal(config.settings.disableFullPageScreenshot,true);assert.equal(config.audits.some(a=>['screenshot-thumbnails','final-screenshot'].includes(a.implementation.meta.id)),false);
});
