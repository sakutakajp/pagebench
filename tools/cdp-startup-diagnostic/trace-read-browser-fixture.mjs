// Hosted-runner gate only. Every page/resource is served by the existing closed
// fixture proxy; no upstream connection capability, raw trace artifact or retry.
import{openGuarded}from'./fixture-runner.mjs';
import{ObservedFontFixture,fontLighthouseReport}from'./font-observe-fixture.mjs';
import{fontProxy}from'./font-fixture.mjs';
import{FIXTURE_URL}from'./fixture-gateway.mjs';
import{SETTINGS}from'../lighthouse-once/guard.mjs';
import{sealMeasurement,verifyMeasurementSeal}from'./measurement-cutoff.mjs';
import{safetyFingerprint,workflowSha}from'./proof.mjs';
import{readFile,writeFile,mkdtemp,rm}from'node:fs/promises';
import{tmpdir}from'node:os';import{join}from'node:path';
import{createRequire}from'node:module';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';
const require=createRequire(new URL('../lighthouse-once/package.json',import.meta.url));
const digest=x=>createHash('sha256').update(x).digest('hex');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function completeTrace(p){return p?.observation==='OWN_TRACE'&&p.adoptable===true&&p.failure===null&&p.pending===0&&p.uncommitted===0&&p.reads>0&&p.reads===p.completed&&p.eof===true&&p.close_confirmed===true&&p.late_events===0&&p.limits?.chunk_bytes===65536&&p.limits.total_bytes===33554432&&p.limits.reads===1024&&p.limits.export_ms===10000;}
export function validBrowserTraceProof(p,sha,fingerprint){
 if(p?.status!=='passed'||p.workflow_sha!==sha||p.fingerprint!==fingerprint||!/^Chrome\/\d+\.\d+\.\d+\.\d+$/.test(p.chrome)||p.lighthouse!=='13.6.0'||p.outbound_forwarding!==0||p.live_pages_attempted!==0||p.screenshots_saved!==0)return false;
 const a=p.large,b=p.strict,c=p.abort;
 return a?.status==='passed'&&a.chrome===p.chrome&&a.unicode_expected===4000&&a.unicode_observed===4000&&a.order_verified===true&&a.same_trace_hash===true&&a.metadata_verified===true&&/^[a-f0-9]{64}$/.test(a.trace_hash)&&a.nonempty_reads>=2&&a.eof_reads===1&&a.close_attempts===1&&a.cleanup==='complete'&&completeTrace(a.trace_read)&&a.trace_read.reads===a.nonempty_reads+a.empty_reads&&b?.status==='passed'&&b.chrome===p.chrome&&b.raw_report_readback===true&&b.validated_report_readback===true&&b.metric_count===5&&/^[a-f0-9]{64}$/.test(b.raw_report_hash)&&/^[a-f0-9]{64}$/.test(b.validated_report_hash)&&b.fonts_expected>=1&&b.fonts_expected===b.fonts_verified&&b.cleanup==='complete'&&completeTrace(b.trace_read)&&c?.status==='passed'&&c.chrome===p.chrome&&c.reason==='TRACE_READ_DEADLINE'&&c.adopted===false&&c.seal_rejected===true&&c.raw_report_saved===false&&c.trace_read?.failure==='TRACE_READ_DEADLINE'&&c.trace_read.reads===0&&c.cleanup==='complete';
}
function driverSession(ctx){const client=ctx.page._client();return{sendCommand:(method,params)=>client.send(method,params),once:(name,fn)=>client.once(name,fn),off:(name,fn)=>client.off(name,fn)};}
async function visibleFont(ctx){await ctx.page.goto(FIXTURE_URL,{waitUntil:'load',timeout:15000});await ctx.page.waitForFunction(()=>window.fontStatus==='loaded',{timeout:15000});if(ctx.gateway.stats.fatal||!ctx.gateway.fonts.snapshot().adoptable)throw Error('FIXTURE_FONT');}
export async function runBrowserTraceProof(){
 let ctx,phase='START',directory,fullReport;const proof={kind:'real-chrome-trace-read-proof',status:'failed',workflow_sha:workflowSha(),fingerprint:await safetyFingerprint(),lighthouse:'13.6.0',outbound_forwarding:0,live_pages_attempted:0,screenshots_saved:0};
 try{
  directory=await mkdtemp(join(tmpdir(),'pagebench-private-trace-gate-'));
  const{default:Trace}=await import(pathToFileURL(require.resolve('lighthouse/core/gather/gatherers/trace.js')).href);
  const{default:lighthouse}=await import(pathToFileURL(require.resolve('lighthouse')).href);
  phase='LARGE_CHROME';ctx=await openGuarded(ObservedFontFixture,()=>fontProxy('font_ok'));proof.chrome=ctx.chrome;await visibleFont(ctx);
  const rawSession=driverSession(ctx),chunks=[];let bytes=0,nonempty=0,empty=0,eofs=0,closes=0;
  const session={...rawSession,sendCommand:async(method,params)=>{
   if(method==='IO.close')closes++;
   const result=await rawSession.sendCommand(method,params);
   // Only normal, already guarded replies produced by the real Trace reader.
   if(method==='IO.read'){
    const data=result.base64Encoded?Buffer.from(result.data,'base64'):Buffer.from(result.data,'utf8');bytes+=data.length;if(bytes>33554432)throw Error('PRIVATE_TOTAL');
    chunks.push(data);if(data.length)nonempty++;else empty++;if(result.eof)eofs++;
   }
   return result;
  }};
  const trace=new Trace();phase='LARGE_CAPTURE';await trace.startSensitiveInstrumentation({driver:{defaultSession:session},gatherMode:'navigation',settings:SETTINGS});
  phase='LARGE_MARKS';await ctx.page.evaluate(()=>{for(let i=0;i<4000;i++)performance.mark('Pagebench_日本語🙂_\\"\n_'+String(i).padStart(4,'0'));});
  phase='LARGE_EXPORT';await trace.stopSensitiveInstrumentation({driver:{defaultSession:session}});const result=trace.getArtifact();phase='LARGE_IDENTITY';const reference=JSON.parse(Buffer.concat(chunks).toString('utf8'));chunks.length=0;
  const traceHash=digest(JSON.stringify(result));if(traceHash!==digest(JSON.stringify(reference)))throw Error('TRACE_IDENTITY');
  const prefix='Pagebench_日本語🙂_\\"\n_',seen=new Set(),order=[];
  for(const event of result.traceEvents){if(typeof event.name!=='string'||!event.name.startsWith(prefix))continue;const suffix=event.name.slice(prefix.length);if(!/^\d{4}$/.test(suffix))continue;const n=Number(suffix);if(!seen.has(n)){seen.add(n);order.push(n);}}
  phase='LARGE_UNICODE';if(order.length!==4000||order.some((n,i)=>n!==i)||nonempty<2||eofs!==1||closes!==1)throw Error('TRACE_UNICODE_OR_ORDER');
  const visible=await ctx.page.evaluate(()=>({chars:document.body?.innerText.trim().length||0,headings:document.querySelectorAll('h1,h2').length}));if(visible.chars<1||visible.headings<1)throw Error('VISIBLE');
  phase='LARGE_SEAL';const seal=await sealMeasurement(ctx,1),cleanup=await ctx.cleanup();verifyMeasurementSeal(ctx,seal);if(cleanup.status!=='complete')throw Error('CLEANUP');
  proof.large={status:'passed',chrome:ctx.chrome,unicode_expected:4000,unicode_observed:order.length,order_verified:true,same_trace_hash:true,metadata_verified:digest(JSON.stringify(result.metadata??null))===digest(JSON.stringify(reference.metadata??null)),trace_hash:traceHash,nonempty_reads:nonempty,empty_reads:empty,eof_reads:eofs,close_attempts:closes,trace_read:ctx.gateway.traceReads.snapshot(),cleanup:'complete'};ctx=null;
  phase='STRICT_CHROME';ctx=await openGuarded(ObservedFontFixture,()=>fontProxy('font_ok'));if(ctx.chrome!==proof.chrome)throw Error('VERSION');
  let timer,run;phase='STRICT_LIGHTHOUSE';try{run=await Promise.race([lighthouse(FIXTURE_URL,{logLevel:'silent'},{extends:'lighthouse:default',settings:SETTINGS},ctx.page),new Promise((_,reject)=>timer=setTimeout(()=>{ctx.gateway.fail('FONT_FIXTURE_DEADLINE');reject(Error());},90000))]);}finally{clearTimeout(timer);}
  const validated=fontLighthouseReport(run.lhr,ctx);const final=await ctx.page.evaluate(()=>({font:window.fontStatus==='loaded',chars:document.body?.innerText.trim().length||0,headings:document.querySelectorAll('h1,h2').length}));if(!final.font||final.chars<1||final.headings<1)throw Error('VISIBLE');
  const finalSeal=await sealMeasurement(ctx,1),finalCleanup=await ctx.cleanup();verifyMeasurementSeal(ctx,finalSeal);if(finalCleanup.status!=='complete')throw Error('CLEANUP');
  phase='STRICT_SAVE';const raw=JSON.stringify(run.lhr),rawPath=join(directory,'private-fixture.lhr.json');await writeFile(rawPath,raw,{flag:'wx',mode:0o600});const back=await readFile(rawPath,'utf8');if(raw!==back)throw Error('RAW_READBACK');fullReport=JSON.parse(back);const revalidated=fontLighthouseReport(fullReport,ctx);if(digest(JSON.stringify(revalidated.metrics))!==digest(JSON.stringify(validated.metrics)))throw Error('METRICS');await rm(rawPath);
  const safe={kind:'validated-closed-lighthouse',chrome:ctx.chrome,lighthouse:validated.lighthouse,settings:validated.settings,metrics:validated.metrics,trace_read:ctx.gateway.traceReads.snapshot(),fonts_expected:finalSeal.fonts.expected,fonts_verified:finalSeal.fonts.verified,cleanup:'complete'};const safeText=JSON.stringify(safe),safePath=join(directory,'validated-report.json');await writeFile(safePath,safeText,{flag:'wx',mode:0o600});if(await readFile(safePath,'utf8')!==safeText)throw Error('VALIDATED_READBACK');
  proof.strict={status:'passed',chrome:ctx.chrome,raw_report_readback:true,validated_report_readback:true,raw_report_hash:digest(raw),validated_report_hash:digest(safeText),metric_count:Object.keys(validated.metrics).length,fonts_expected:finalSeal.fonts.expected,fonts_verified:finalSeal.fonts.verified,trace_read:ctx.gateway.traceReads.snapshot(),cleanup:'complete'};ctx=null;
  phase='ABORT_CHROME';ctx=await openGuarded(ObservedFontFixture,()=>fontProxy('font_ok'));if(ctx.chrome!==proof.chrome)throw Error('VERSION');await visibleFont(ctx);
  const abortSession=driverSession(ctx),abortTrace=new Trace();await abortTrace.startSensitiveInstrumentation({driver:{defaultSession:abortSession},gatherMode:'navigation',settings:SETTINGS});
  phase='ABORT_DEADLINE';await abortSession.sendCommand('Tracing.end');const until=Date.now()+11500;while(!ctx.gateway.stats.fatal&&Date.now()<until)await pause(50);
  if(ctx.gateway.stats.fatal!=='TRACE_READ_DEADLINE')throw Error('DEADLINE');let adopted=true,sealRejected=false;try{fontLighthouseReport(fullReport,ctx);}catch{adopted=false;}try{await sealMeasurement(ctx,1);}catch{sealRejected=true;}if(adopted||!sealRejected)throw Error('ABORT_ADOPTION');
  const abortCleanup=await ctx.cleanup();if(abortCleanup.status!=='complete')throw Error('CLEANUP');proof.abort={status:'passed',chrome:ctx.chrome,reason:'TRACE_READ_DEADLINE',adopted:false,seal_rejected:true,raw_report_saved:false,trace_read:ctx.gateway.traceReads.snapshot(),cleanup:'complete'};ctx=null;
  proof.status='passed';if(!validBrowserTraceProof(proof,workflowSha(),await safetyFingerprint()))throw Error('PROOF');
  return proof;
 }catch{
  const cleanup=await ctx?.cleanup().catch(()=>({status:'failed'}));return{kind:'real-chrome-trace-read-proof',status:'failed',phase,reason:'REAL_TRACE_READ_GATE_FAILED',cleanup:cleanup?.status??'not-started',outbound_forwarding:0,live_pages_attempted:0,performance:null};
 }finally{if(directory)await rm(directory,{recursive:true,force:true});}
}
if(process.argv[1]===new URL(import.meta.url).pathname){try{const result=await runBrowserTraceProof(),text=JSON.stringify(result);await writeFile('trace-read-real-proof.json',text,{flag:'wx',mode:0o600});if(await readFile('trace-read-real-proof.json','utf8')!==text)throw Error();console.log(text);if(result.status!=='passed')process.exitCode=1;}catch{console.log('{"kind":"real-chrome-trace-read-proof","status":"failed","reason":"PROOF_SAVE_FAILED"}');process.exitCode=1;}}
