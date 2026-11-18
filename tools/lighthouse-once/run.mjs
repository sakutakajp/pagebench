import puppeteer from 'puppeteer';
import lighthouse from 'lighthouse';
import {mkdtemp,rm,writeFile}from'node:fs/promises';
import {tmpdir}from'node:os';
import {join}from'node:path';
import {TARGET,SETTINGS,tunnel,installGuard,summarize}from'./guard.mjs';
let browser,proxy,profile,stats;let stage='BROWSER_START_FAILED';
let result={kind:'restricted-staging-lighthouse-cli',status:'failed',reason:'LOCAL_OR_BROWSER_FAILURE',performance:null};
try{
 proxy=await tunnel();profile=await mkdtemp(join(tmpdir(),'pagebench-lh-'));
 browser=await puppeteer.launch({headless:true,ignoreDefaultArgs:true,userDataDir:profile,args:['--headless=new','--no-first-run','--proxy-server='+proxy.url,'--proxy-bypass-list=<-loopback>','--disable-background-networking','--force-webrtc-ip-handling-policy=disable_non_proxied_udp']});
 stage='CHROME_VERSION_MISMATCH';const chrome=await browser.version();if(!chrome.endsWith('/157.0.8103.78'))throw Error('VERSION');
 const page=await browser.newPage();const session=await page.createCDPSession();const {frameTree}=await session.send('Page.getFrameTree');
 stats=await installGuard(session,frameTree.frame.id);
 // One navigation, no operation tests. Never serialize the Lighthouse raw report.
 stage='LIGHTHOUSE_OR_TRANSPORT_FAILED';
 const report=await lighthouse(TARGET,{logLevel:'silent'}, {extends:'lighthouse:default',settings:SETTINGS},page);
 stage='RESULT_VALIDATION_FAILED';result=summarize(report.lhr,stats,chrome);
}catch{result.reason=stats?.fatal||stage; /* Fixed enums only; no raw exception. */ }
finally{if(browser)await browser.close().catch(()=>{});if(proxy)await proxy.close();if(profile)await rm(profile,{recursive:true,force:true});}
await writeFile('result.json',JSON.stringify(result,null,2),{mode:0o600});
console.log(JSON.stringify(result));
if(process.env.GITHUB_STEP_SUMMARY)await writeFile(process.env.GITHUB_STEP_SUMMARY,'Restricted staging Lighthouse CLI\n\n```json\n'+JSON.stringify(result,null,2)+'\n```\n',{flag:'a'});
if(result.status!=='success')process.exitCode=1;
