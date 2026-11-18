import puppeteer from 'puppeteer-core';
import lighthouse from 'lighthouse';
import {spawn,execFile}from'node:child_process';import{constants}from'node:fs';
import {mkdtemp,readFile,rm,access}from'node:fs/promises';
import {tmpdir}from'node:os';import{join}from'node:path';
import {Gateway,safeTargetRejection}from'./gateway.mjs';import{TARGET,SETTINGS,tunnel,summarize}from'./guard.mjs';
import{StartupError,evidence,classifyStderr,waitDevtools,bounded,fixedCode}from'./startup.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export async function open(fixture=null){
 const out=evidence();let profile,proxy,proc,gateway,browser;let finished=false;
 const emergency=()=>{proxy?.disable();proc?.kill('SIGKILL');};
 const cleanup=async()=>{if(finished)return;finished=true;proxy?.disable();gateway?.dispose();proc?.kill('SIGKILL');if(proxy)await proxy.close();if(profile)await rm(profile,{recursive:true,force:true});};
 try{
  const executable=process.env.CHROME_PATH||'/opt/google/chrome/chrome';await access(executable,constants.X_OK);out.binary_executable=true;
  // --version does not launch a page; retain a numeric version only.
  out.chrome_version=await new Promise(resolve=>execFile(executable,['--version'],{encoding:'utf8',timeout:3000,maxBuffer:4096},(err,text)=>resolve(err?null:/(?:Chrome|Chromium)\s+(\d+\.\d+\.\d+\.\d+)/.exec(text)?.[1]||null)));
  out.phase='PROFILE_SETUP';profile=await mkdtemp(join(tmpdir(),'pagebench-lh-'));proxy=await tunnel();if(fixture)proxy.disable();
  out.phase='CHROME_SPAWN';proc=spawn(executable,['--headless=new','--no-startup-window','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-extensions','--disable-component-extensions-with-background-pages','--remote-debugging-port=0','--user-data-dir='+profile,'--proxy-server='+proxy.url,'--proxy-bypass-list=<-loopback>','--force-webrtc-ip-handling-policy=disable_non_proxied_udp'],{stdio:['ignore','ignore','pipe']});
  let startError=false;proc.on('error',()=>{startError=true;});let remaining=65536,tail='';
  proc.stderr.on('data',chunk=>{if(remaining<=0)return;const part=chunk.subarray(0,remaining);remaining-=part.length;const text=tail+part.toString('utf8');classifyStderr(text,out);tail=text.slice(-512);});
  out.phase='DEVTOOLS_FILE';const endpoint=await waitDevtools(proc,()=>readFile(join(profile,'DevToolsActivePort'),'utf8'),sleep,out,{spawnFailed:()=>startError});
  out.phase='DEVTOOLS_WEBSOCKET';const ws=new WebSocket(endpoint);
  try{await bounded(new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',()=>reject(Error('DEVTOOLS_WS_FAILED')),{once:true});}),5000,'DEVTOOLS_WS_TIMEOUT');}catch(e){ws.close();throw e;}
  gateway=new Gateway(ws,emergency,fixture);
  out.phase='CDP_BOOTSTRAP';await gateway.call('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true,filter:[{type:'tab',exclude:false},{exclude:true}]});
  out.phase='PUPPETEER_CONNECT';browser=await bounded(puppeteer.connect({transport:gateway}),10000,'PUPPETEER_CONNECT_TIMEOUT');
  out.phase='INITIAL_TARGET';const page=await bounded(browser.newPage(),10000,'INITIAL_TARGET_TIMEOUT');if(gateway.stats.fatal)throw Error('INITIAL_TARGET_GUARD_FAILED');
  out.phase='READY';if(!fixture)proxy.enable();return {browser,page,gateway,proxy,cleanup};
 }catch(error){
  if(gateway){
   out.target_rejection=safeTargetRejection(gateway.stats.target_rejection);
   const steps=['Target.setAutoAttach','Network.enable','Network.setBypassServiceWorker','Network.setBlockedURLs','Fetch.enable','Page.getFrameTree'];
   if(steps.includes(gateway.lastCommand))out.guard_step=gateway.lastCommand;
   const failures=['CDP_LOST','CDP_TIMEOUT','CDP_FORMAT','TARGET_REJECTED','UNPAUSED_TARGET','PROTECTION_LOST','GUARD_FAILURE','AUTH_REJECTED','PROTECTION_MUTATION','EARLY_RESUME'];
   if(failures.includes(gateway.stats.fatal))out.guard_failure=gateway.stats.fatal;
  }
  if(!(error instanceof StartupError)){out.code=fixedCode(error,out.phase);}
  await cleanup().catch(()=>{});throw error instanceof StartupError?error:new StartupError(out);
 }
}
export async function measure(ctx){
 const chrome=await ctx.browser.version();
 const report=await lighthouse(TARGET,{logLevel:'silent'},{extends:'lighthouse:default',settings:SETTINGS},ctx.page);
 return summarize(report.lhr,ctx.gateway.stats,chrome);
}
