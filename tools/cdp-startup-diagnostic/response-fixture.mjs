// Diagnostic-only HTTP proxy: fixed loopback synthetic resources, NO CONNECT/upstream client.
import http from'node:http';import{writeFile,appendFile}from'node:fs/promises';
import{openGuarded}from'./fixture-runner.mjs';import{StagingGateway,STAGING_TARGET}from'./staging-gateway.mjs';import{FIXTURE_URL}from'./fixture-gateway.mjs';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const HTML='<!doctype html><html><head><link rel="icon" href="data:,"><script>window.__NUXT__={config:{public:{IS_PRODUCTION:false}}};window.loaded=0;</script><script src="/fixture.js" defer></script></head><body><main><h1>Response path fixture</h1><p>Known memory-only content.</p></main></body></html>';
export async function closedFixtureProxy(mode){const sockets=new Set();let served=0,refused=0;const server=http.createServer((q,r)=>{let u;try{u=new URL(q.url);}catch{r.destroy();return;}
 if(q.method!=='GET'||u.origin!=='http://127.0.0.1:47500'||u.search||u.hash||!/^\/(fixture|fixture\.js|parallel[0-7]\.js)$/.test(u.pathname)){refused++;r.writeHead(403);r.end();return;}
 if(++served>20){r.destroy();return;}
 if(u.pathname==='/fixture'){r.writeHead(200,{'Content-Type':'text/html'});r.end(HTML);return;}
 if(mode==='network'){q.socket.destroy();return;}if(mode==='redirect'){r.writeHead(302,{Location:FIXTURE_URL});r.end();return;}
 const body=u.pathname==='/fixture.js'?"for(let i=0;i<8;i++){let s=document.createElement('script');s.src='/parallel'+i+'.js';document.head.append(s);}":'window.loaded++;';
 setTimeout(()=>{r.writeHead(200,{'Content-Type':'text/javascript'});r.end(body);},u.pathname==='/fixture.js'?0:20);
 });server.on('connect',(_q,s)=>{refused++;s.destroy();});server.on('upgrade',(_q,s)=>{refused++;s.destroy();});server.on('connection',s=>{sockets.add(s);s.on('error',()=>{});s.on('close',()=>sockets.delete(s));});await new Promise(r=>server.listen(0,'127.0.0.1',r));return{url:'http://127.0.0.1:'+server.address().port,get served(){return served;},get refused(){return refused;},disable(){for(const s of sockets)s.destroy();},async close(){this.disable();await new Promise(r=>server.close(r));}};}
export function fixtureGateway(mode){return class extends StagingGateway{
 get documentURL(){return FIXTURE_URL;}
 async request(e,id){let transformed=e;if(e.request){let u;try{u=new URL(e.request.url);}catch{}if(u?.origin==='http://127.0.0.1:47500'&&!u.search&&!u.hash&&/^\/(fixture|fixture\.js|parallel[0-7]\.js)$/.test(u.pathname))transformed={...e,request:{...e.request,url:u.pathname==='/fixture'?STAGING_TARGET:'https://staging.hirameki.dev'+u.pathname}};}
 if(mode==='missing_metadata'&&e.responseStatusCode!==undefined&&this.liveRequestMeta.get(e.requestId)?.type==='Script')this.liveRequestMeta.delete(e.requestId);
 return super.request(transformed,id);
 }
};}
export async function runResponseFixture(){const cases=[];let ctx,stage='START';try{
 for(const mode of ['parallel_success','network','missing_metadata','redirect']){stage=mode;let proxy;ctx=await openGuarded(fixtureGateway(mode),async()=>proxy=await closedFixtureProxy(mode));ctx.gateway.trace.mark('FIXTURE_NAVIGATION_START');await ctx.page.goto(FIXTURE_URL,{waitUntil:'load',timeout:10000}).catch(()=>{});
 if(mode==='parallel_success'){await ctx.page.waitForFunction(()=>window.loaded===8,{timeout:3000});if(ctx.gateway.stats.fatal||!ctx.gateway.stats.html_validated||ctx.gateway.stats.max_inflight>6||ctx.gateway.stats.continued_requests!==10)throw Error('POSITIVE');ctx.gateway.trace.mark('FIXTURE_NAVIGATION_COMPLETE');}
 else{for(let i=0;i<100&&!ctx.gateway.stats.fatal;i++)await pause(10);const first=ctx.gateway.trace.snapshot().first_failure?.event;const expected={network:'RESPONSE_NETWORK_ERROR',missing_metadata:'RESPONSE_NO_METADATA',redirect:'REDIRECT_OBSERVED'}[mode];if(first!==expected||ctx.gateway.stats.fatal!==(mode==='redirect'?'REDIRECT':'RESPONSE_SCOPE_OR_NETWORK_ERROR'))throw Error('NEGATIVE');ctx.gateway.trace.mark('FIXTURE_NAVIGATION_STOPPED');}
 const trace=ctx.gateway.trace.snapshot(),chrome=ctx.chrome,continued=ctx.gateway.stats.continued_requests,max_inflight=ctx.gateway.stats.max_inflight;const cleanup=await ctx.cleanup();ctx=null;if(cleanup.status!=='complete')throw Error('CLEANUP');cases.push({case:mode,status:'passed',chrome,continued_requests:continued,max_inflight,trace,cleanup:'complete',outbound_forwarding:0});
 }
 return{kind:'isolated-response-path-proof',status:'passed',cases,outbound_forwarding:0,live_pages_attempted:0};
 }catch(error){const cleanup=await ctx?.cleanup();return{startup:error.fixed||null,kind:'isolated-response-path-proof',status:'failed',stage,cases,cleanup:cleanup?.status||error.fixed?.cleanup||'not-started',outbound_forwarding:0,live_pages_attempted:0};}}
if(process.argv[1]===new URL(import.meta.url).pathname){try{const result=await runResponseFixture();const text=JSON.stringify(result);await writeFile('response-path-proof.json',text,{mode:0o600});console.log(text);if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,'```json\n'+text+'\n```\n');if(result.status!=='passed')process.exitCode=1;}catch{console.log('{"kind":"isolated-response-path-proof","status":"failed","stage":"INTERNAL"}');process.exitCode=1;}}
