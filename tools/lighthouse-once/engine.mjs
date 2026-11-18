import puppeteer from 'puppeteer-core';
import lighthouse from 'lighthouse';
import {spawn}from'node:child_process';
import {mkdtemp,readFile,rm,access}from'node:fs/promises';
import {tmpdir}from'node:os';import{join}from'node:path';
import {Gateway}from'./gateway.mjs';import{TARGET,SETTINGS,tunnel,summarize}from'./guard.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export async function open(fixture=null){
 const executable=process.env.CHROME_PATH||'/opt/google/chrome/chrome';await access(executable);
 const profile=await mkdtemp(join(tmpdir(),'pagebench-lh-'));
 const proxy=await tunnel(); // CONNECT only to the two exact HTTPS hosts; no TLS termination.
 // In fixture mode no CONNECT is ever forwarded. Guard.fulfilling bypasses network.
 if(fixture)proxy.disable();
 const proc=spawn(executable,['--headless=new','--no-startup-window','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,'--proxy-server='+proxy.url,'--proxy-bypass-list=<-loopback>','--force-webrtc-ip-handling-policy=disable_non_proxied_udp'],{stdio:['ignore','ignore','pipe']});
 let startError=false;proc.on('error',()=>{startError=true;});proc.stderr.resume();let gateway,browser;let finished=false;
 const emergency=()=>{proxy.disable();proc.kill('SIGKILL');};
 const cleanup=async()=>{if(finished)return;finished=true;proxy.disable();gateway?.dispose();proc.kill('SIGKILL');await proxy.close();await rm(profile,{recursive:true,force:true});};
 try{
  let lines;for(let i=0;i<100;i++){if(startError||proc.exitCode!==null||proc.signalCode!==null)throw Error('BROWSER_START_FAILED');try{lines=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).trim().split('\n');break;}catch{await sleep(100);}}
  if(!lines)throw Error('BROWSER_START_FAILED');
  const ws=new WebSocket('ws://127.0.0.1:'+lines[0]+lines[1]);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  gateway=new Gateway(ws,emergency,fixture);
  await gateway.call('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true,filter:[{type:'tab',exclude:false},{exclude:true}]});
  browser=await puppeteer.connect({transport:gateway});
  const page=await browser.newPage();
  if(gateway.stats.fatal)throw Error('GUARD_SETUP_FAILED');
  if(!fixture)proxy.enable();
  return {browser,page,gateway,proxy,cleanup};
 }catch{await cleanup();throw Error('BROWSER_OR_GUARD_START_FAILED');}
}
export async function measure(ctx){
 const chrome=await ctx.browser.version();
 const report=await lighthouse(TARGET,{logLevel:'silent'},{extends:'lighthouse:default',settings:SETTINGS},ctx.page);
 return summarize(report.lhr,ctx.gateway.stats,chrome);
}
