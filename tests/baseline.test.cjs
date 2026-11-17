const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const {captureRun,compareRuns,loadFrozen,hash}=require('../baseline.cjs');
const original=chromium.launch.bind(chromium);let screenshots=0;
chromium.launch=async(...args)=>{const b=await original(...args),nc=b.newContext.bind(b);b.newContext=async(...a)=>{const c=await nc(...a),np=c.newPage.bind(c);c.newPage=async()=>{const p=await np();p.screenshot=async()=>{screenshots++;throw Error('FORBIDDEN');};return p;};return c;};return b;};
test('freeze, restart origin, offline comparison, resume, privacy and incompatible metadata',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pagebench-baseline-'));let requests=0;
 const routes=['same','extra','remove','text','style','action','unconfigured','missing','private','query','personal'];
 const m={schema:1,origin:'https://example.org',records:routes.map(p=>({url:`https://example.org/${p}/`}))};m.sha256=hash(m);
 const mf=path.join(dir,'manifest.json');fs.writeFileSync(mf,JSON.stringify(m));
 const policy={data_policy:'public-reviewed',executable_path:process.env.PAGEBENCH_TEST_CHROMIUM||'/usr/bin/chromium',actions:[{path:'^/(same|extra|remove|text|style|action|missing)/$',steps:[{action:'click',selector:'button'},{action:'expectText',selector:'#out',value:'OK'}]}]};
 async function serve(after){const s=http.createServer((req,res)=>{requests++;res.setHeader('Content-Type','text/html');if(after&&req.url==='/missing/'){res.statusCode=404;return res.end('Not found');}
 const r=req.url;res.end(`<html><body><h1 style="color:${after&&r==='/style/'?'red':'black'}">${after&&r==='/text/'?'Changed':'Stable'}</h1>${after&&r==='/extra/'?'<aside>Added</aside>':''}${after&&r==='/remove/'?'':'<p>Keep</p>'}<a href="/next/">Next</a><button onclick="document.querySelector('#out').textContent='${after&&r==='/action/'?'BAD':'OK'}'">Run</button><output id="out"></output>${r==='/private/'?'<p>authorization: Bearer fixture-only-value</p>':''}${r==='/query/'?'<a href="/a/?session=fixture-only-value">Private</a>':''}${r==='/personal/'?'<input type="email" value="private@example.org">':''}</body></html>`);});await new Promise(r=>s.listen(0,'127.0.0.1',r));return s;}
 const a=path.join(dir,'before'),b=path.join(dir,'after'),cf=path.join(dir,'profile.json');let server=await serve(false);
 try{
  fs.writeFileSync(cf,JSON.stringify({...policy,origin:'http://127.0.0.1:'+server.address().port,build_label:'before'}));
  let report=await captureRun(mf,cf,a,2);assert.equal(report.pending,9);assert.equal(report.frozen,false);
  report=await captureRun(mf,cf,a,100);assert.equal(report.frozen,true);assert.equal(report.counts.captured,8);assert.equal(report.counts.failed_unverified,3);
  const frozenBytes=fs.readFileSync(path.join(a,'state.json'));const n=requests;
  await captureRun(mf,cf,a,100);assert.equal(requests,n);assert.deepEqual(fs.readFileSync(path.join(a,'state.json')),frozenBytes);
  await new Promise(r=>server.close(r));server=await serve(true);
  fs.writeFileSync(cf,JSON.stringify({...policy,origin:'http://127.0.0.1:'+server.address().port,build_label:'after'}));
  await captureRun(mf,cf,b,100);await new Promise(r=>server.close(r));server=null;
  const out=path.join(dir,'comparison.json');const sum=compareRuns(a,b,out);const rows=JSON.parse(fs.readFileSync(out)).results;
  assert.equal(rows[0].status,'passed');for(let i=1;i<=5;i++)assert.equal(rows[i].status,'changed');assert.equal(rows[6].status,'matched_actions_unverified');for(let i=7;i<11;i++)assert.equal(rows[i].status,'unverified');
  assert.throws(()=>compareRuns(a,b,path.join(a,'report.json')),/BASELINE_OUTPUT_FORBIDDEN/);
  assert.throws(()=>compareRuns(a,b,out)); // immutable report too
  assert.equal(screenshots,0);
  for(const folder of [a,b])for(const file of fs.readdirSync(folder)){assert.ok(file.endsWith('.json'));const data=fs.readFileSync(path.join(folder,file),'utf8');assert.ok(!data.includes('fixture-only-value'));assert.ok(!data.includes('private@example.org'));assert.equal(fs.statSync(path.join(folder,file)).mode&0o777,0o600);}
  function clone(name){const target=path.join(dir,name);fs.cpSync(b,target,{recursive:true});return target;}
  const missing=clone('missing-file');fs.unlinkSync(path.join(missing,'000000.json'));assert.throws(()=>compareRuns(a,missing,path.join(dir,'no-result.json')));
  for(const kind of ['manifest','profile','browser']){
   const bad=clone(kind),state=JSON.parse(fs.readFileSync(path.join(bad,'state.json')));
   if(kind==='manifest')state.manifest_hash='different';else{if(kind==='profile')state.settings.actions=[];else state.settings.browser='different';state.fingerprint=hash(state.settings);}
   fs.writeFileSync(path.join(bad,'state.json'),JSON.stringify(state));fs.writeFileSync(path.join(bad,'frozen.json'),JSON.stringify({version:1,state_hash:hash(state)}));
   assert.throws(()=>compareRuns(a,bad,path.join(dir,'bad-'+kind+'.json')),/INCOMPATIBLE/);
  }
  const tamper=clone('tamper');fs.appendFileSync(path.join(tamper,'000000.json'),'x');assert.throws(()=>loadFrozen(tamper));
  console.log(JSON.stringify({baseline:report,comparison:sum,screenshots}));
 }finally{if(server)await new Promise(r=>server.close(r));}
});
