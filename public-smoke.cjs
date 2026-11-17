/* Fixed public access/capture smoke. No snapshots, screenshots, or page data output. */
const fs=require('node:fs');
const {chromium}=require('playwright');
const {capture}=require('./render.cjs');
const TARGETS=Object.freeze([
 'https://hirameki.dev/ja/',
 'https://hirameki.dev/ja/amidakuji/',
 'https://hirameki.dev/ja/font/serif/list/%E6%9C%9D/'
]);
function networkCategory(value){
 if(/ERR_CERT_|ERR_SSL_/.test(value))return 'TLS_ERROR';
 if(/ERR_NAME_NOT_RESOLVED/.test(value))return 'DNS_ERROR';
 if(/TIMED_OUT/.test(value))return 'TIMEOUT';
 return 'NETWORK_ERROR';
}
function category(e){
 if(e.http===403)return 'HTTP_403';
 if(e.http && e.http!==200)return 'HTTP_ERROR';
 return e.network||'CAPTURE_REJECTED';
}
// Targets/browser are injectable only to exercise localhost fixtures, not CLI inputs.
async function run(browser,targets=TARGETS){
 if(!targets.length||targets.length>3)throw Error('LIMIT');
 const summary={target:targets.length,attempted:0,captured:0,failed:0,pending:targets.length,operations_unverified:0,categories:{},snapshots_saved:0,google_psi_calls:0};
 for(const url of targets){
  const u=new URL(url),observed={};
  // Each capture creates a fresh unauthenticated context. Block non-read requests
  // in addition to capture's origin/redirect guard, without retry or spoofing.
  const wrapper={newContext:async options=>{
   const context=await browser.newContext(options),route=context.route.bind(context),newPage=context.newPage.bind(context);
   context.route=(pattern,handler)=>route(pattern,r=>['GET','HEAD'].includes(r.request().method())?handler(r):r.abort());
   context.newPage=async()=>{
    const page=await newPage();
    page.on('response',r=>{if(r.request().isNavigationRequest()&&r.frame()===page.mainFrame())observed.http=r.status();});
    page.on('requestfailed',r=>{if(r.isNavigationRequest())observed.network=networkCategory(r.failure()?.errorText||'');});
    return page;
   };return context;
  }};
  summary.attempted++;summary.pending--;
  try{
   const snapshot=await capture(wrapper,u.origin,u.pathname,{actions:[],persist_public:true});
   if(snapshot.errors.length)throw Error('CAPTURE_REJECTED');
   summary.captured++;summary.operations_unverified++;
  }catch{
   summary.failed++;const code=category(observed);summary.categories[code]=(summary.categories[code]||0)+1;
   break; // no retries, no attempts at remaining targets after first failure
  }
 }
 summary.status=summary.failed?'failed':summary.captured===summary.target?'capture_complete_operations_unverified':'incomplete';
 return summary;
}
module.exports={run,TARGETS,networkCategory};
if(require.main===module){
 (async()=>{
  if(process.argv.length!==2)throw Error('NO_INPUTS');
  const browser=await chromium.launch();
  let result;try{result=await run(browser);}finally{await browser.close();}
  const output=JSON.stringify(result);console.log(output);
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'Public capture smoke (no operation verification)\n\n```json\n'+output+'\n```\n');
  if(result.failed||result.pending)process.exitCode=1;
 })().catch(()=>{console.log('{"status":"failed","reason":"SMOKE_SETUP_FAILED"}');process.exitCode=1;});
}
