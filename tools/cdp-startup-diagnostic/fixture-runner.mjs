// No live mode. Every HTTP request is fulfilled from fixed strings or aborted.
import{FixtureGateway,FIXTURE_URL}from'./fixture-gateway.mjs';import{captureParams}from'./scoped-capture.mjs';
import{denyProxy,waitForDevtools}from'./diagnostic.mjs';import{trackProcess,cleanupDiagnostic}from'./cleanup.mjs';
import{spawn}from'node:child_process';import{access,mkdtemp,rm,readFile,writeFile,rename,appendFile}from'node:fs/promises';import{constants}from'node:fs';import{join}from'node:path';import{tmpdir}from'node:os';import{createRequire}from'node:module';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const require=createRequire(new URL('../lighthouse-once/package.json',import.meta.url));
async function bounded(task,ms){let timer;try{return await Promise.race([task,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('FIXTURE_DEADLINE')),ms))]);}finally{clearTimeout(timer);}}
export async function openFixture(){
 let phase='BINARY',proc,profile,proxy,wire,gateway,browser,tracked,cleaned=false,cleanupResult;let sandbox=false;
 const cleanup=async()=>{if(cleaned)return cleanupResult;cleaned=true;gateway?.dispose();browser?.disconnect();cleanupResult=await cleanupDiagnostic({wire,proc,tracked,proxy,profile,removeProfile:p=>rm(p,{recursive:true,force:true})});return cleanupResult;};
 try{
  const executable=process.env.CHROME_PATH||'/opt/google/chrome/chrome';await access(executable,constants.X_OK);profile=await mkdtemp(join(tmpdir(),'pagebench-isolated-lh-'));proxy=await denyProxy();phase='CHROME_START';let failed=false;
  proc=spawn(executable,['--headless=new','--no-startup-window','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-extensions','--disable-component-extensions-with-background-pages','--remote-debugging-port=0','--user-data-dir='+profile,'--proxy-server='+proxy.url,'--proxy-bypass-list=<-loopback>','--force-webrtc-ip-handling-policy=disable_non_proxied_udp'],{stdio:['ignore','ignore','pipe']});tracked=trackProcess(proc);proc.on('error',()=>failed=true);let remaining=65536;proc.stderr.on('data',chunk=>{if(remaining<=0)return;const text=chunk.subarray(0,remaining).toString();remaining-=chunk.length;sandbox ||= /SUID sandbox helper|No usable sandbox|Failed to move to new namespace/.test(text);});
  const start=await waitForDevtools(profile,proc,()=>failed);if(!start.address){phase=sandbox?'CHROME_SANDBOX_FAILED':start.code;throw Error('START_FAILED');}
  phase='CDP_CONNECT';wire=new WebSocket(start.address);await bounded(new Promise((resolve,reject)=>{wire.onopen=resolve;wire.onerror=()=>reject(Error('CDP_CONNECT_FAILED'));}),3000);
  gateway=new FixtureGateway(wire,()=>proc.kill('SIGKILL'));phase='ROOT_GUARD';await gateway.call('Target.setAutoAttach',captureParams(false));await gateway.call('Target.setDiscoverTargets',{discover:true,filter:[{}]});
  const version=await gateway.call('Browser.getVersion');if(typeof version.product!=='string'||!(/^(Chrome|HeadlessChrome)\/\d+\.\d+\.\d+\.\d+$/).test(version.product))throw Error('VERSION_INVALID');
  phase='PUPPETEER_CONNECT';const{default:puppeteer}=await import(pathToFileURL(require.resolve('puppeteer-core')).href);browser=await bounded(puppeteer.connect({transport:gateway,defaultViewport:null,protocolTimeout:10000}),10000);
  phase='BOUND_PAGE';const page=await bounded(browser.newPage(),15000);if(gateway.stats.fatal||!gateway.released||!gateway.sessions.get(gateway.primary)?.ready)throw Error('PAGE_GUARD_FAILED');
  return {browser,page,gateway,chrome:version.product,cleanup};
 }catch{const cleanupStatus=await cleanup();const error=Error('FIXTURE_OPEN_FAILED');error.fixed={phase,fatal:gateway?.stats.fatal||null,last_client_command:gateway?.lastClientCommand||'NONE',guard_command:['Target.setAutoAttach','Network.enable','Network.setBypassServiceWorker','Network.setBlockedURLs','Fetch.enable','Page.getFrameTree'].includes(gateway?.lastCommand)?gateway.lastCommand:'NONE',cleanup:cleanupStatus?.status||'failed'};throw error;}
}
export function validateLhr(lhr,gateway,chrome){
 if(gateway.stats.fatal||!gateway.stats.html200||lhr.runtimeError||[lhr.requestedUrl,lhr.finalUrl,lhr.finalDisplayedUrl].some(u=>u!==FIXTURE_URL)||lhr.lighthouseVersion!=='13.6.0')throw Error('FIXTURE_RESULT_INVALID');
 const c=lhr.configSettings;if(c.formFactor!=='mobile'||c.throttlingMethod!=='simulate'||c.throttling.rttMs!==300||c.throttling.throughputKbps!==800||c.throttling.cpuSlowdownMultiplier!==6||c.disableStorageReset!==false)throw Error('FIXTURE_SETTINGS_INVALID');
 const score=lhr.categories.performance.score;if(!Number.isFinite(score)||score<0||score>1)throw Error('FIXTURE_SCORE_INVALID');
 const metrics={};for(const[id,k]of [['first-contentful-paint','fcp'],['largest-contentful-paint','lcp'],['total-blocking-time','tbt'],['cumulative-layout-shift','cls'],['speed-index','si']]){const v=lhr.audits[id]?.numericValue;if(!Number.isFinite(v)||v<0)throw Error('FIXTURE_METRIC_INVALID');metrics[k]=v;}
 const text=JSON.stringify(lhr);if(/data:image\//i.test(text)||lhr.fullPageScreenshot?.screenshot)throw Error('IMAGE_ARTIFACT_FORBIDDEN');
 return {kind:'isolated-fixture-lighthouse',status:'passed',chrome,lighthouse:lhr.lighthouseVersion,performance:Math.round(score*100),metrics,fixture_url:FIXTURE_URL,outbound_forwarding:0,ui_resumes:gateway.stats.ui_resumes,screenshots_saved:0};
}
export async function runFixture(){
 let active,stage='PREREQUISITE';const cases=[];
 const close=async()=>{const c=await active?.cleanup();active=null;if(c?.status!=='complete')throw Error('FIXTURE_CLEANUP_FAILED');};
 try{
  const pre=JSON.parse(await readFile('scoped-capture-comparison.json','utf8'));if(pre.summary.version_comparability!=='SAME_VERSION'||!pre.summary.safe_fixture_modes.includes('ROOT_PAGE'))throw Error('SCOPED_GUARD_REQUIRED');
  const fresh=async()=>{active=await openFixture();if(active.chrome.split('/')[1]!==pre.summary.chrome)throw Error('BROWSER_CHANGED');return active;};
  stage='POSITIVE_AND_NETWORK_DENIAL';let c=await fresh();await c.page.goto(FIXTURE_URL,{waitUntil:'load',timeout:15000});if(!await c.page.evaluate(()=>window.fixtureReady===true&&document.querySelector('h1')?.textContent==='Isolated Lighthouse fixture'))throw Error('FIXTURE_RENDER_FAILED');
  await c.page.evaluate(async()=>Promise.allSettled([fetch('/private',{method:'POST'}),fetch('https://telemetry.invalid/collect')]));if(c.gateway.stats.blocked<2||c.gateway.stats.fatal)throw Error('BLOCKING_FAILED');cases.push('positive-render','POST-and-external-denied');await close();
  for(const mode of ['popup','worker','iframe','loss','mutation']){
   stage='ADVERSARIAL_'+mode.toUpperCase();c=await fresh();await c.page.goto(FIXTURE_URL,{waitUntil:'load',timeout:15000});
   if(mode==='popup')await c.page.evaluate(()=>window.open('/fixture','_blank')).catch(()=>{});
   if(mode==='worker')await c.page.evaluate(()=>new Worker('/fixture.js')).catch(()=>{});
   if(mode==='iframe')await c.page.evaluate(()=>{const f=document.createElement('iframe');f.src='/fixture';document.body.append(f);}).catch(()=>{});
   if(mode==='loss')c.gateway.wire.close();
   if(mode==='mutation')c.gateway.send(JSON.stringify({id:99999,sessionId:c.gateway.primary,method:'Fetch.disable'}));
   for(let i=0;i<50&&!c.gateway.stats.fatal;i++)await pause(20);if(!c.gateway.stats.fatal)throw Error('ADVERSARIAL_GUARD_FAILED');cases.push(mode+'-stopped');await close();
  }
  stage='WEBSOCKET';c=await fresh();await c.page.goto(FIXTURE_URL,{waitUntil:'load',timeout:15000});let handshake=false;c.page._client().on('Network.webSocketWillSendHandshakeRequest',()=>handshake=true);await c.page.evaluate(()=>{const w=new WebSocket('wss://telemetry.invalid/socket');w.onerror=()=>{};});await pause(300);if(handshake||c.gateway.stats.fatal)throw Error('WEBSOCKET_GUARD_FAILED');cases.push('websocket-no-handshake');await close();
  stage='LIGHTHOUSE';c=await fresh();const{default:lighthouse}=await import(pathToFileURL(require.resolve('lighthouse')).href);const{SETTINGS}=await import('../lighthouse-once/guard.mjs');
  const report=await bounded(lighthouse(FIXTURE_URL,{logLevel:'silent'},{extends:'lighthouse:default',settings:SETTINGS},c.page),90000);const summary=validateLhr(report.lhr,c.gateway,c.chrome);await close();
  stage='JSON_SAVE_AND_READBACK';const text=JSON.stringify(report.lhr);await writeFile('fixture-lighthouse.lhr.tmp',text,{mode:0o600});await rename('fixture-lighthouse.lhr.tmp','fixture-lighthouse.lhr.json');const readback=await readFile('fixture-lighthouse.lhr.json','utf8');if(readback!==text||JSON.parse(readback).categories.performance.score!==report.lhr.categories.performance.score)throw Error('READBACK_FAILED');
  const result={...summary,cases,cleanup:'complete',json_readback:true,report_sha256:createHash('sha256').update(readback).digest('hex')};await writeFile('fixture-lighthouse-summary.json',JSON.stringify(result),{mode:0o600});return result;
 }catch(error){const cleanupStatus=await active?.cleanup();return {kind:'isolated-fixture-lighthouse',status:'failed',stage,...(error.fixed?{startup:error.fixed}:{}),cases,cleanup:cleanupStatus?.status||'not-started',outbound_forwarding:0,live_pages_attempted:0,json_report_saved:false};}
}
if(process.argv[1]===new URL(import.meta.url).pathname){try{const result=await runFixture();console.log(JSON.stringify(result));await writeFile('fixture-lighthouse-status.json',JSON.stringify(result),{mode:0o600});if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,'```json\n'+JSON.stringify(result)+'\n```\n');if(result.status!=='passed')process.exitCode=1;}catch{console.log('{"kind":"isolated-fixture-lighthouse","status":"failed","stage":"INTERNAL_FAILED"}');process.exitCode=1;}}
