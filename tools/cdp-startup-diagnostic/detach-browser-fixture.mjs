// Closed real-Chrome gate only. Uses the established font fixture proxy with
// zero external forwarding; never imports or invokes the live staging entry.
import{readFile,writeFile}from'node:fs/promises';import{createRequire}from'node:module';import{pathToFileURL}from'node:url';
import{ObservedFontFixture,fontLighthouseReport}from'./font-observe-fixture.mjs';
import{fontProxy}from'./font-fixture.mjs';import{openGuarded}from'./fixture-runner.mjs';import{FIXTURE_URL}from'./fixture-gateway.mjs';
import{installDetachEvidence,captureDetachSample,safeDetachEvidence}from'./detach-evidence.mjs';
import{observeVisibleDocument}from'./visible-evidence.mjs';import{sealMeasurement,verifyMeasurementSeal}from'./measurement-cutoff.mjs';
import{safetyFingerprint,workflowSha}from'./proof.mjs';import{SETTINGS}from'../lighthouse-once/guard.mjs';
const require=createRequire(new URL('../lighthouse-once/package.json',import.meta.url));
export function validDetachBrowserProof(p,sha,fingerprint){
 if(p?.kind!=='closed-detach-browser-proof'||p.status!=='passed'||p.workflow_sha!==sha||p.fingerprint!==fingerprint||p.lighthouse!=='13.6.0'||!/^Chrome\/\d+\.\d+\.\d+\.\d+$/.test(p.chrome)||p.outbound_forwarding!==0||p.live_pages_attempted!==0||p.screenshots_saved!==0||p.json_readback!==true||JSON.stringify(p.cases?.map(c=>c.case))!==JSON.stringify(['display_stable','display_changed']))return false;
 return p.cases.every(c=>{const d=safeDetachEvidence(c.detach),changed=c.case==='display_changed';return c.status==='passed'&&c.chrome===p.chrome&&c.cleanup==='complete'&&c.font_expected>=1&&c.font_verified===c.font_expected&&c.lhr_validated===true&&c.report_adoptable===!changed&&c.visible_rejected===changed&&c.raw_report_saved===false&&c.controlled_dom_change===changed&&d.status==='OBSERVED'&&d.before.body_text==='GE20'&&d.after.body_text===(changed?'LT20':'GE20')&&d.changes.chars===(changed?'DECREASED':'UNCHANGED')&&d.before.heading_box===true&&d.after.heading_box===!changed;});
}
export async function runDetachBrowserFixture(){
 const cases=[];let ctx,observer,stage='START';
 try{
  const{default:lighthouse}=await import(pathToFileURL(require.resolve('lighthouse')).href);
  for(const mode of ['display_stable','display_changed']){
   stage=mode;ctx=await openGuarded(ObservedFontFixture,()=>fontProxy('font_ok'));
   observer=installDetachEvidence(ctx,FIXTURE_URL,{capture:async phase=>{if(mode==='display_changed'&&phase==='AFTER')await ctx.page.evaluate(()=>{const main=document.createElement('main');for(const child of Array.from(document.body.childNodes))main.append(child);document.body.append(main);main.style.display='none';const marker=document.createElement('span');marker.textContent='OK';document.body.append(marker);});return captureDetachSample(ctx,FIXTURE_URL,phase);}});
   let timer,run;try{run=await Promise.race([lighthouse(FIXTURE_URL,{logLevel:'silent'},{extends:'lighthouse:default',settings:SETTINGS},ctx.page),new Promise((_,reject)=>timer=setTimeout(()=>{ctx.gateway.fail('FONT_FIXTURE_DEADLINE');reject(Error());},120000))]);}finally{clearTimeout(timer);}
   fontLighthouseReport(run.lhr,ctx);const detach=observer.snapshot();observer.dispose();observer=null;
   const v=await observeVisibleDocument(ctx.page,FIXTURE_URL,run.lhr.configSettings.screenEmulation);const rejected=v.body_characters<20||v.headings<1;
   if(rejected!==(mode==='display_changed'))throw Error();
   const fonts=ctx.gateway.fonts.snapshot();let cutoff;if(!rejected)cutoff=await sealMeasurement(ctx,1);
   const cleanup=await ctx.cleanup();if(cutoff)verifyMeasurementSeal(ctx,cutoff);
   cases.push({case:mode,status:'passed',chrome:ctx.chrome,cleanup:cleanup.status,font_expected:fonts.expected,font_verified:fonts.verified,lhr_validated:true,report_adoptable:!rejected,visible_rejected:rejected,raw_report_saved:false,controlled_dom_change:mode==='display_changed',detach});ctx=null;
  }
  const result={kind:'closed-detach-browser-proof',status:'passed',workflow_sha:workflowSha(),fingerprint:await safetyFingerprint(),chrome:cases[0].chrome,lighthouse:'13.6.0',cases,json_readback:true,outbound_forwarding:0,live_pages_attempted:0,screenshots_saved:0};
  if(!validDetachBrowserProof(result,result.workflow_sha,result.fingerprint))throw Error();
  const bytes=JSON.stringify(result);await writeFile('detach-browser-proof.json',bytes,{mode:0o600});if(await readFile('detach-browser-proof.json','utf8')!==bytes)throw Error();return result;
 }catch(error){observer?.dispose();const cleanup=await ctx?.cleanup().catch(()=>({status:'failed'}));return{kind:'closed-detach-browser-proof',status:'failed',stage,cases,startup_phase:error.fixed?.phase==='CHROME_SANDBOX_FAILED'?'CHROME_SANDBOX_FAILED':error.fixed?'OTHER_FIXED_START_FAILURE':null,cleanup:cleanup?.status||error.fixed?.cleanup||'not-started',performance:null,json_readback:false,outbound_forwarding:0,live_pages_attempted:0,screenshots_saved:0};}
}
if(process.argv[1]===new URL(import.meta.url).pathname){const result=await runDetachBrowserFixture();await writeFile('detach-browser-proof.json',JSON.stringify(result),{mode:0o600});console.log(JSON.stringify(result));if(result.status!=='passed')process.exitCode=1;}
