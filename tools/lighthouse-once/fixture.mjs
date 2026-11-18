// Same engine/guard as live, but CONNECT forwarding remains unconditionally disabled.
import assert from'node:assert/strict';import{StartupError}from'./startup.mjs';import{writeFile,rm}from'node:fs/promises';
import{open,measure}from'./engine.mjs';import{TARGET}from'./guard.mjs';import{fingerprint}from'./run.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const HTML='<html><head><script src="https://staging.hirameki.dev/fixture-script"></script><link rel="icon" href="data:,"></head><body><h1>Local Lighthouse fixture</h1><p>Visible fixture body.</p><script>window.fixtureLoaded=true</script></body></html>';
let contexts=[];let chrome;let stage='BROWSER_OR_GUARD_START';
async function context(responder=null){const ctx=await open(responder|| (async e=>e.resourceType==='Document'?{mime:'text/html',body:HTML}:e.resourceType==='Script'?{mime:'text/javascript',body:'window.publicAssetLoaded=true'}:null));contexts.push(ctx);return ctx;}
await rm('fixture-proof.json',{force:true});
try{
 const ctx=await context();chrome=await ctx.browser.version();
 // The full Lighthouse integration is exercised first with in-memory HTML only.
 stage='LIGHTHOUSE_FIXTURE';const summary=await measure(ctx);assert.equal(summary.status,'success');assert.equal(summary.final_url,TARGET);assert.equal(ctx.proxy.forwarded,0);assert.equal(ctx.proxy.approvedConnectAttempts,0);
 await ctx.page.evaluate(async()=>{await Promise.allSettled([fetch('/api/private',{method:'POST'}),fetch('https://third.invalid/collect'),fetch('https://staging.hirameki.dev/api/private')]);});
 assert.ok(ctx.gateway.stats.blocked>=3);assert.equal(ctx.proxy.forwarded,0);assert.equal(ctx.proxy.approvedConnectAttempts,0);await ctx.cleanup();
 // Each dangerous path gets a fresh browser; first fatal closes every connection.
 for(const mode of ['popup','worker','detach','disconnect','mutation']){
  stage='TARGET_'+mode.toUpperCase();const c=await context();await c.page.goto(TARGET,{waitUntil:'load',timeout:10000});
  if(mode==='popup')await c.page.evaluate(()=>window.open('https://staging.hirameki.dev/api/private','_blank')).catch(()=>{});
  if(mode==='worker')await c.page.evaluate(()=>new Worker(URL.createObjectURL(new Blob(['fetch("https://staging.hirameki.dev/api/private",{method:"POST"})'],{type:'text/javascript'})))).catch(()=>{});
  if(mode==='disconnect')c.gateway.wire.close();
  if(mode==='mutation')c.gateway.send(JSON.stringify({id:500,method:'Fetch.disable',sessionId:[...c.gateway.sessions.keys()].find(k=>c.gateway.sessions.get(k).frame)}));
  if(mode==='detach')await c.gateway.receive(JSON.stringify({method:'Target.detachedFromTarget',params:{sessionId:[...c.gateway.sessions.keys()].find(k=>c.gateway.sessions.get(k).frame)}}));
  for(let i=0;i<50&&!c.gateway.stats.fatal;i++)await wait(20);
  assert.ok(c.gateway.stats.fatal,mode);assert.equal(c.proxy.forwarded,0);assert.equal(c.proxy.approvedConnectAttempts,0);await c.cleanup();
 }
 // WebSocket blocking must work in the actual Chrome, not only in mocked CDP.
 stage='WEBSOCKET';const c=await context();await c.page.goto(TARGET,{waitUntil:'load',timeout:10000});
 let handshake=false;const s=await c.page.createCDPSession();await s.send('Network.enable');s.on('Network.webSocketWillSendHandshakeRequest',()=>handshake=true);
 await c.page.evaluate(()=>{const w=new WebSocket('wss://staging.hirameki.dev/api/private');w.onerror=()=>{};});await wait(400);
 assert.equal(handshake,false);assert.equal(c.proxy.forwarded,0);assert.equal(c.proxy.approvedConnectAttempts,0);await c.cleanup();
 await writeFile('fixture-proof.json',JSON.stringify({status:'passed',chrome,fingerprint:await fingerprint(),cases:['lighthouse-local-html','POST/API/external','popup','worker','detach','disconnect','mutation','websocket'],outbound_forwarded:0}),{mode:0o600});
 console.log(JSON.stringify({status:'fixture_passed',chrome,outbound_forwarded:0}));
}catch(error){const result={...(error instanceof StartupError?{startup:error.startup}:{}),kind:'restricted-staging-lighthouse-cli',status:'fixture_failed',reason:stage,live_pages_attempted:0,performance:null};const text=JSON.stringify(result);await writeFile('result.json',text,{mode:0o600});if(process.env.GITHUB_STEP_SUMMARY)await writeFile(process.env.GITHUB_STEP_SUMMARY,'```json\n'+text+'\n```\n',{flag:'a'});console.log(text);process.exitCode=1;}
finally{for(const c of contexts)await c.cleanup();}
