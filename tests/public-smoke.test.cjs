const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require('playwright');
const {run,TARGETS,networkCategory}=require('../public-smoke.cjs');
test('fixed targets and safe network enums',()=>{
 assert.equal(TARGETS.length,3);assert.equal(new Set(TARGETS).size,3);
 assert.equal(networkCategory('net::ERR_CERT_AUTHORITY_INVALID'),'TLS_ERROR');
 assert.equal(networkCategory('net::ERR_NAME_NOT_RESOLVED'),'DNS_ERROR');
 assert.equal(networkCategory('net::ERR_TIMED_OUT'),'TIMEOUT');
 assert.equal(networkCategory('arbitrary private value'),'NETWORK_ERROR');
});
test('localhost capture only; no screenshots/POST; forbidden stops remaining pages',async()=>{
 let requests=[],posts=0,screenshots=0;
 const s=http.createServer((q,r)=>{requests.push(q.url);if(q.method==='POST')posts++;
  r.setHeader('Content-Type','text/html');if(q.url==='/forbidden/'){r.statusCode=403;return r.end('private-error-body');}
  r.end('<html><body><p>fixture-page-text-not-for-output</p><script>fetch("/mutating/",{method:"POST"}).catch(()=>{})</script></body></html>');
 });
 await new Promise(r=>s.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+s.address().port;
 const browser=await chromium.launch({executablePath:process.env.PAGEBENCH_TEST_CHROMIUM||'/usr/bin/chromium'}),nc=browser.newContext.bind(browser);
 browser.newContext=async(...a)=>{const ctx=await nc(...a),np=ctx.newPage.bind(ctx);ctx.newPage=async()=>{const p=await np();p.screenshot=async()=>{screenshots++;throw Error('FORBIDDEN');};return p;};return ctx;};
 try{
  const ok=await run(browser,[origin+'/a/',origin+'/b/',origin+'/c/']);
  assert.equal(ok.captured,3);assert.equal(ok.operations_unverified,3);assert.equal(ok.snapshots_saved,0);assert.equal(posts,0);
  requests=[];
  const blocked=await run(browser,[origin+'/forbidden/',origin+'/never/',origin+'/also-never/']);
  assert.equal(blocked.failed,1);assert.equal(blocked.captured,0);assert.equal(blocked.pending,2);assert.equal(blocked.categories.HTTP_403,1);
  assert.deepEqual(requests,['/forbidden/']);assert.equal(screenshots,0);
  for(const value of [ok,blocked]){const text=JSON.stringify(value);assert.ok(!text.includes('fixture-page-text'));assert.ok(!text.includes('private-error-body'));assert.ok(!text.includes(origin));}
 }finally{await browser.close();await new Promise(r=>s.close(r));}
});
