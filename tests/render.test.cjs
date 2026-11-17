const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const {run,hash}=require('../render.cjs');
// Any call to the screenshot API is a test failure, before fixture navigation.
const original=chromium.launch.bind(chromium);let screenshotCalls=0;
chromium.launch=async (...args)=>{
 const browser=await original(...args),newContext=browser.newContext.bind(browser);
 browser.newContext=async (...a)=>{const ctx=await newContext(...a),newPage=ctx.newPage.bind(ctx);ctx.newPage=async()=>{const p=await newPage();p.screenshot=async()=>{screenshotCalls++;throw Error('SCREENSHOT_FORBIDDEN');};return p;};return ctx;};return browser;
};
test('local fixture detects additions/removals/text/layout/style/actions; no screenshot',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pagebench-fixture-'));const servers=[];
 function html(route,after){
  const changed=after;
  return `<!doctype html><html><body><main style="${changed&&route==='/layout/'?'padding:20px':''}"><h1 style="color:${changed&&route==='/style/'?'red':'black'}">${changed&&route==='/text/'?'New':'Stable'}</h1>${changed&&route==='/remove/'?'':'<p>Keep</p>'}${changed&&route==='/extra/'?'<aside>New visible content</aside>':''}<a href="/next/">Next</a><label for="q">Input</label><input id="q"><button onclick="document.querySelector('#result').textContent='${changed&&route==='/action/'?'BAD':'OK'}'">Run</button><output id="result"></output></main></body></html>`;
 }
 async function serve(after){const s=http.createServer((q,r)=>{r.setHeader('Content-Type','text/html');r.end(html(q.url,after));});await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));servers.push(s);return 'http://127.0.0.1:'+s.address().port;}
 try{
  const before=await serve(false),after=await serve(true);
  const paths=['same','extra','remove','text','layout','style','action','unconfigured'];
  const m={schema:1,origin:'https://example.org',records:paths.map(p=>({url:`https://example.org/${p}/`}))};m.sha256=hash(m);
  const cfg={before,after,executable_path:process.env.PAGEBENCH_TEST_CHROMIUM||'/usr/bin/chromium',actions:[{path:'^/(same|extra|remove|text|layout|style|action)/$',steps:[{action:'click',selector:'button'},{action:'expectText',selector:'#result',value:'OK'}]}]};
  fs.writeFileSync(path.join(dir,'m.json'),JSON.stringify(m));fs.writeFileSync(path.join(dir,'c.json'),JSON.stringify(cfg));
  const s=await run(path.join(dir,'m.json'),path.join(dir,'c.json'),path.join(dir,'run'),100);
  assert.equal(s.results['https://example.org/same/'].status,'passed');
  for(const p of ['extra','remove','text','layout','style','action'])assert.equal(s.results[`https://example.org/${p}/`].status,'changed',p);
  assert.equal(s.results['https://example.org/unconfigured/'].status,'matched_actions_unverified');
  assert.equal(s.results['https://example.org/action/'].actions,'changed');
  assert.equal(screenshotCalls,0);
  assert.deepEqual(fs.readdirSync(path.join(dir,'run')),['run.json']);
  const serialized=fs.readFileSync(path.join(dir,'run/run.json'),'utf8');assert.ok(!serialized.includes('New visible content'));assert.ok(!serialized.includes('Stable'));
  const resumed=await run(path.join(dir,'m.json'),path.join(dir,'c.json'),path.join(dir,'run'),1);assert.deepEqual(resumed.results,s.results);
  console.log(JSON.stringify({browser:s.browser,summary:s.summary}));
 }finally{await Promise.all(servers.map(s=>new Promise(r=>s.close(r))));}
});
