import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{execFileSync}from'node:child_process';import{classifyRequest as v1}from'../staging-measurement-policy/policy.mjs';import{classifyRequest as v2}from'./policy.mjs';import{allowed}from'./static-policy.mjs';import{selectPolicy,POLICY_ID}from'./registry.mjs';import{javascriptResponse}from'./beacon-read.mjs';import{forApprovedGateway}from'./boundary.mjs';import{measureSelected}from'./selected-run.mjs';import{closedGateway}from'../staging-cloudflare-origin/closed-only-gateway.mjs';import{NaturalReadGateway}from'../natural-reads/gateway.mjs';import{controlled,BINARY,CHROME}from'../staging-selected-cli/control.mjs';
const url='https://static.cloudflareinsights.com/beacon.min.js',event=(u=url,method='GET',type='Script',headers={})=>({resourceType:type,request:{url:u,method,headers}});
for(const id of ['CANONICAL','EXPLICIT_443'])test(id,()=>{const e=event(id==='CANONICAL'?url:url.replace('.com/','.com:443/'));assert.equal(v1(e).code,'SCOPE');assert.equal(v2(e).code,'ALLOW');assert(allowed(e.request,e.resourceType));});
for(const[id,u,m,t,h]of[['VERSION_SUFFIX',url+'/v'+'a'.repeat(32)],['TRAILING_SLASH',url+'/'],['EXTRA_SUFFIX',url+'.extra'],['QUERY',url+'?v=a'],['EMPTY_QUERY',url+'?'],['FRAGMENT',url+'#x'],['ENCODING',url.replace('/beacon','/%62eacon')],['DOT_SEGMENT',url.replace('/beacon','/x/../beacon')],['DOUBLE_SLASH',url.replace('/beacon','//beacon')],['HTTP',url.replace('https:','http:')],['PORT',url.replace('.com/','.com:444/')],['HOST',url.replace('.com/','.com.invalid/')],['USERINFO',url.replace('https://','https://fixed@')],['POST',url,'POST'],['HEAD',url,'HEAD'],['NON_SCRIPT',url,'GET','Image'],['COOKIE',url,'GET','Script',{Cookie:'FIXED'}],['AUTH',url,'GET','Script',{Authorization:'FIXED'}]])test(id,()=>{const e=event(u,m??'GET',t??'Script',h??{});assert.deepEqual(v2(e),v1(e));assert.notEqual(v2(e).code,'ALLOW');assert(!allowed(e.request,e.resourceType));});
for(const key of ['postData','postDataEntries','hasPostData'])test('BODY_'+key,()=>{const e=event();e.request[key]=key==='hasPostData'?true:key==='postData'?'fixed':[];assert.notEqual(v2(e).code,'ALLOW');});
test('redirect and other origins public resources remain unchanged',()=>{const e=event();e.redirectedRequestId='FIXED';assert.equal(v2(e).code,'REDIRECT');for(const u of ['https://staging.hirameki.dev/_nuxt/fixed.js','https://image.hirameki.dev/fixed.webp','https://static.cloudflareinsights.com/static/fixed.js','https://static.cloudflareinsights.com/collect'])for(const m of ['GET','HEAD','POST']){const x=event(u,m);assert.deepEqual(v2(x),v1(x));}});
for(const mime of ['text/javascript','application/javascript'])test('MIME_ALLOW_'+mime,()=>assert(javascriptResponse({mimeType:mime,headers:{'Content-Type':mime+'; charset=utf-8'}})));
for(const mime of ['application/json','text/html','text/css','application/octet-stream','',null])test('MIME_DENY_'+(mime??'null'),()=>assert(!javascriptResponse({mimeType:mime,headers:{'content-type':mime}})));
test('MIME header mismatch missing and duplicates fail',()=>{for(const h of [{},{'content-type':'text/html'},{'Content-Type':'text/javascript','content-type':'text/javascript'}])assert(!javascriptResponse({mimeType:'text/javascript',headers:h}));});
class Approved extends closedGateway(){constructor(...a){super(...a);this.memory=false;}async start(e){return NaturalReadGateway.prototype.start.call(this,e);}}
async function model(mode='beacon',mutate){const c=controlled(mode);return measureSelected({policyId:POLICY_ID,approvedGatewayFactory:async()=>Approved,hash:async()=>BINARY,expectedBinary:BINARY,expectedChrome:CHROME,lighthouse:c.lighthouse,open:async(...args)=>{const x=await c.open(...args);if(mutate){const receive=x.gateway.wire.onmessage;x.gateway.wire.onmessage=e=>{const m=JSON.parse(e.data);mutate(m);return receive({data:JSON.stringify(m)});};}return x;},proxyOptions:{lookup:async()=>[{address:'104.16.1.2',family:4}],connect:()=>{throw Error('NO_UPSTREAM')}}});}
test('actual selector/boundary/measure canonical controlled positive; no persistence',async()=>{const x=await model();assert.equal(x.policy_id,POLICY_ID);assert.equal(x.result.status,'PASSED');assert.equal(x.result.score_written_to_db,false);assert.equal(x.result.report_file_written,false);assert.equal(x.result.cleanup,'COMPLETE');});
for(const mode of ['BAD_MIME','HEADER_MISMATCH','RESPONSE_REDIRECT','REQUEST_REDIRECT','POST','VERSION_SUFFIX'])test('actual score boundary fail closed '+mode,async()=>{const x=await model('beacon',m=>{if(m.params?.requestId==='CF_FETCH'&&m.method==='Fetch.requestPaused'){if(mode==='POST')m.params.request.method='POST';if(mode==='REQUEST_REDIRECT')m.params.redirectedRequestId='FIXED';if(mode==='VERSION_SUFFIX')m.params.request.url+='/v'+'a'.repeat(32);}if(m.method==='Network.responseReceived'&&m.params?.requestId==='CF'){if(mode==='BAD_MIME')m.params.response.mimeType='application/json';if(mode==='HEADER_MISMATCH')m.params.response.headers={'content-type':'text/html'};if(mode==='RESPONSE_REDIRECT')m.params.response.status=302;}});assert.equal(x.result.status,'FAILED');assert.equal(x.result.performance,null);assert.equal(x.result.score_written_to_db,false);assert.equal(x.result.report_file_written,false);});
test('explicit version selection, original policy and thresholds immutable',()=>{const p=selectPolicy(POLICY_ID);assert.equal(p.request_limit,400);assert.equal(p.inflight_limit,6);assert.equal(p.beacon_read.suffix,'V_HEX32_DECIMAL13_ONE_SEGMENT');assert.throws(()=>selectPolicy('staging-ja-cloudflare-script-400-v1'));for(const path of ['config/staging-measurement-policy.json','tools/staging-measurement-policy/policy.mjs','tools/staging-measurement-policy/static-policy.mjs','tools/staging-measurement-policy/measure.mjs','tools/staging-measurement-policy/egress.mjs'])assert(readFileSync(path).equals(execFileSync('git',['show','ee9067b89b894bfa16cbebbb38ddd2d7600206ee:'+path])));});

// These are controlled protocol tests, not native Chrome or Lighthouse measurements.
test('beacon prefetch markers have no policy or dispatch special case',async()=>{
 for(const headers of [{purpose:'prefetch'},{'sec-purpose':'prefetch'},{purpose:'prefetch',Cookie:'FIXED'}]){
  const e=event(url,'GET','Script',headers);assert.equal(v2(e).code,headers.Cookie?'CREDENTIAL':'ALLOW');
 }
 const x=await model('beacon',m=>{if(m.method==='Fetch.requestPaused'&&m.params?.requestId==='CF_FETCH')m.params.request.headers.purpose='prefetch';});
 assert.equal(x.result.status,'PASSED');assert.equal(x.result.policy_limit,400);assert(x.result.max_inflight<=6);
});
test('V2 400/401 boundary no request exemption',()=>{
 const G=forApprovedGateway(closedGateway()),g=new G({send(){}},()=>{});g.primary='P';g.sessions.set('P',{ready:true,frame:'F'});
 try{for(let n=1;n<=400;n++)assert.equal(g.boundary.check({...event(),frameId:'F',requestId:'R'+n,networkId:'N'+n}),'ALLOW');assert.equal(g.boundary.check({...event(),frameId:'F',requestId:'R401',networkId:'N401'}),'LIMIT');assert.equal(g.boundary.total,401);assert.equal(g.census.snapshot().first_limit.boundary_total.value,401);}finally{g.dispose();}
});
test('V2 six active and seventh queued without prefetch exception',async()=>{
 const G=forApprovedGateway(closedGateway()),g=new G({send(){}},()=>{});g.primary='P';g.sessions.set('P',{ready:true,frame:'F'});g.released=true;
 g.start=async e=>{g.active.add(e.networkId);g.stats.max_inflight=Math.max(g.stats.max_inflight,g.active.size);};
 try{for(let n=1;n<=7;n++)await g.request({...event(url,'GET','Script',{purpose:'prefetch'}),frameId:'F',networkId:'N'+n,requestId:'R'+n},'P');assert.equal(g.active.size,6);assert.equal(g.waiting.length,1);assert.equal(g.boundary.total,7);}finally{g.beginCleanup();g.dispose();}
});
test('V2 refuses stopped wrong-frame missing-binding and second navigation',()=>{
 for(const mode of ['stopped','frame','network','navigation']){
  const G=forApprovedGateway(closedGateway()),g=new G({send(){}},()=>{});g.primary='P';g.sessions.set('P',{ready:true,frame:'F'});
  let e={...event(),frameId:'F',networkId:'N',requestId:'R'};
  if(mode==='stopped')g.stopping=true;if(mode==='frame')e.frameId='OTHER';if(mode==='network')delete e.networkId;
  if(mode==='navigation'){e={...e,...event('https://staging.hirameki.dev/ja/','GET','Document')};assert.equal(g.boundary.check(e),'ALLOW');e.networkId='N2';}
  try{assert.equal(g.boundary.check(e),mode==='navigation'?'NAVIGATION':'BINDING');}finally{g.dispose();}
 }
});
test('not selected or missing prior admission/opener never reaches DNS or browser',async()=>{
 let dns=0,open=0;for(const opts of [{},{policyId:POLICY_ID},{policyId:POLICY_ID,approvedGatewayFactory:async()=>{throw Error('FIXED_ADMISSION_REJECT');},open:async()=>{open++;}}])await assert.rejects(measureSelected({...opts,proxyOptions:{lookup:()=>{dns++;}}}));assert.equal(dns,0);assert.equal(open,0);
});
test('ordinary shared 240 and exact proxy implementation unchanged',async()=>{
 const a=await import('../natural-reads/staging-limits.mjs');assert.equal(a.STAGING_REQUEST_LIMIT,240);
 for(const path of ['tools/natural-reads/staging-limits.mjs','tools/natural-reads/scoped400-limit.mjs','tools/natural-reads/gateway.mjs','tools/ab-observe/gateway.mjs','tools/staging-measurement-policy/result.mjs','tools/staging-selected-cli/admission.mjs','tools/staging-selected-cli/gateway.mjs'])assert(readFileSync(path).equals(execFileSync('git',['show','ee9067b89b894bfa16cbebbb38ddd2d7600206ee:'+path])));
 const p=await import('../staging-measurement-policy/registry.mjs');assert.deepEqual(selectPolicy(POLICY_ID).origins,p.ORIGINS);
});
test('inert CLI emits only fixed configuration and cannot execute or echo input',()=>{
 const cli='tools/staging-beacon-policy-v2/select.mjs';
 for(const args of [['--policy',POLICY_ID],['--execute'],['--policy','PRIVATE_FIXED_SENTINEL']]){
  let out;try{out=execFileSync(process.execPath,[cli,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']});}catch(e){assert.equal(e.status,1);assert.equal(String(e.stderr),'');out=String(e.stdout);}
  const p=JSON.parse(out);assert.equal(p.selected,args[1]===POLICY_ID);assert.equal(p.measurement_authorized,false);assert.equal(p.network_calls,0);assert(!out.includes('PRIVATE_FIXED_SENTINEL'));assert(!out.includes('https://'));
 }
});
test('finite old-denial corpus changes only the exact new exception',()=>{
 const origins=['https://staging.hirameki.dev','https://image.hirameki.dev','https://static.cloudflareinsights.com','https://fixed-invalid.invalid'];
 const paths=['/static/fixed.js','/beacon.min.js','/beacon.min.js/v'+'a'.repeat(32),'/collect','/api/fixed','/analytics/fixed.js','/admin/fixed.js','/_nuxt/fixed.js','/%62eacon.min.js','/x/../beacon.min.js','/beacon.min.js?','/beacon.min.js?v=1'];
 for(const o of origins)for(const p of paths)for(const m of ['GET','HEAD','POST'])for(const t of ['Document','Script','Image','Fetch','XHR','Other','Prefetch'])for(const h of [{},{purpose:'prefetch'},{Authorization:'FIXED'}]){
  const e=event(o+p,m,t,h),a=v1(e),b=v2(e);
  const exact=o==='https://static.cloudflareinsights.com'&&p==='/beacon.min.js'&&m==='GET'&&t==='Script'&&!h.Authorization;
  if(exact){assert.equal(a.code,'SCOPE');assert.deepEqual(b,{code:'ALLOW',kind:'STATIC'});}else assert.deepEqual(b,a);
 }
});

const versioned=url+'/v'+'a'.repeat(32)+'1'.repeat(13);
function useVersion(m,replacement=versioned){if(m.params?.request?.url===url)m.params.request.url=replacement;if(m.params?.response?.url===url)m.params.response.url=replacement;}
for(const id of ['VERSIONED','VERSIONED_EXPLICIT_443'])test(id,async()=>{
 const u=id==='VERSIONED'?versioned:versioned.replace('.com/','.com:443/');const e=event(u);
 assert.equal(v1(e).code,'SCOPE');assert.equal(v2(e).code,'ALLOW');assert(allowed(e.request,e.resourceType));
 const x=await model('beacon',m=>useVersion(m,u));assert.equal(x.result.status,'PASSED');assert.equal(x.result.cleanup,'COMPLETE');assert.equal(x.result.score_written_to_db,false);assert.equal(x.result.report_file_written,false);assert.equal(x.result.policy_limit,400);assert(x.result.max_inflight<=6);
});
for(const[id,u]of [
 ['SUFFIX_SHORT',versioned.slice(0,-1)],['SUFFIX_LONG',versioned+'a'],['SUFFIX_UPPER',url+'/v'+'A'.repeat(32)+'1'.repeat(13)],['UPPER_V',url+'/V'+'a'.repeat(32)+'1'.repeat(13)],['NONHEX',url+'/v'+'g'.repeat(32)+'1'.repeat(13)],['NONDECIMAL_TAIL',url+'/v'+'a'.repeat(45)],
 ['SECOND_LEVEL',versioned+'/fixed.js'],['SUFFIX_SLASH',versioned+'/'],['SUFFIX_DOT',versioned+'.js'],['SUFFIX_QUERY',versioned+'?v=1'],['SUFFIX_EMPTY_QUERY',versioned+'?'],['SUFFIX_FRAGMENT',versioned+'#fixed'],
 ['SUFFIX_NEWLINE',versioned+'\n'],['SUFFIX_CRLF',versioned+'\r\n'],['SUFFIX_NUL',versioned+'\0'],['SUFFIX_ENCODE',url+'/%76'+'a'.repeat(45)],['SUFFIX_DOT_SEGMENT',url+'/fixed/../v'+'a'.repeat(45)],['SUFFIX_PERCENT_SLASH',versioned+'%2f']
])test(id,()=>{const e=event(u);assert.deepEqual(v2(e),v1(e));assert.notEqual(v2(e).code,'ALLOW');assert(!allowed(e.request,'Script'));});
for(const[id,method,type,headers]of [['VERSION_POST','POST','Script',{}],['VERSION_HEAD','HEAD','Script',{}],['VERSION_IMAGE','GET','Image',{}],['VERSION_CREDENTIAL','GET','Script',{Cookie:'FIXED'}]])test(id,()=>{const e=event(versioned,method,type,headers);assert.deepEqual(v2(e),v1(e));assert.notEqual(v2(e).code,'ALLOW');assert(!allowed(e.request,type));});
for(const mode of ['VERSION_BAD_MIME','VERSION_HEADER_MISMATCH','VERSION_REDIRECT','VERSION_REQUEST_REDIRECT','VERSION_POST','VERSION_LOADING_FAILED'])test('versioned actual score boundary rejects '+mode,async()=>{
 const x=await model('beacon',m=>{useVersion(m);if(m.params?.requestId==='CF_FETCH'&&m.method==='Fetch.requestPaused'){if(mode==='VERSION_POST')m.params.request.method='POST';if(mode==='VERSION_REQUEST_REDIRECT')m.params.redirectedRequestId='FIXED';}if(m.method==='Network.responseReceived'&&m.params?.requestId==='CF'){if(mode==='VERSION_BAD_MIME')m.params.response.mimeType='application/json';if(mode==='VERSION_HEADER_MISMATCH')m.params.response.headers={'content-type':'text/html'};if(mode==='VERSION_REDIRECT')m.params.response.status=302;}if(mode==='VERSION_LOADING_FAILED'&&m.method==='Network.loadingFinished'&&m.params?.requestId==='CF')m.method='Network.loadingFailed';});
 assert.equal(x.result.status,'FAILED');assert.equal(x.result.performance,null);assert.equal(x.result.score_written_to_db,false);assert.equal(x.result.report_file_written,false);assert.equal(x.result.cleanup,'COMPLETE');
});
test('versioned prefetch retains same policy and no navigation privilege',async()=>{
 const e=event(versioned,'GET','Script',{purpose:'prefetch'});assert.equal(v2(e).code,'ALLOW');assert.notEqual(v2(event(versioned,'GET','Document')).code,'ALLOW');
 const x=await model('beacon',m=>{useVersion(m);if(m.method==='Fetch.requestPaused'&&m.params?.requestId==='CF_FETCH')m.params.request.headers.purpose='prefetch';});assert.equal(x.result.status,'PASSED');assert.equal(x.result.policy_limit,400);assert(x.result.max_inflight<=6);
});
test('adopted suffix predicate has direct fixed RAM-observation support without retained value',()=>{
 const x=JSON.parse(readFileSync('tools/staging-beacon-policy-v2/observation.json'));
 assert.equal(x.request_attempts,1);assert.equal(x.http_status,200);assert.equal(x.candidate_script_count,1);assert.equal(x.parser_ambiguity,false);assert.equal(x.body_saved,false);assert.equal(x.suffix_value_saved,false);assert.equal(x.query_values_saved,false);
 const r=x.rows[0];assert.equal(r.origin_guard,'PASS');assert.equal(r.raw_origin_spelling,'CANONICAL');assert.equal(r.query,'ABSENT');assert.equal(r.fragment,'ABSENT');assert.equal(r.suffix_length,46);assert.equal(r.segments,1);assert.equal(r.narrow_v_hex32_decimal13,true);
 assert.equal(x.build_identity,'NOT_ESTABLISHED');assert.equal(x.same_as_preview_441,'UNKNOWN');assert(!JSON.stringify(x).includes('https://'));
});
test('versioned 400/401 and six-active guard have no new exception',async()=>{
 const G=forApprovedGateway(closedGateway()),make=()=>{const g=new G({send(){}},()=>{});g.primary='P';g.sessions.set('P',{ready:true,frame:'F'});g.released=true;return g;};
 const g=make();try{for(let n=1;n<=400;n++)assert.equal(g.boundary.check({...event(versioned),frameId:'F',requestId:'R'+n,networkId:'N'+n}),'ALLOW');assert.equal(g.boundary.check({...event(versioned),frameId:'F',requestId:'R401',networkId:'N401'}),'LIMIT');assert.equal(g.boundary.total,401);}finally{g.dispose();}
 const q=make();q.start=async e=>{q.active.add(e.networkId);};try{for(let n=1;n<=7;n++)await q.request({...event(versioned),frameId:'F',networkId:'N'+n,requestId:'R'+n},'P');assert.equal(q.active.size,6);assert.equal(q.waiting.length,1);assert.equal(q.boundary.total,7);}finally{q.beginCleanup();q.dispose();}
});
for(const[id,u]of [['VERSION_WRONG_PORT',versioned.replace('.com/','.com:444/')],['VERSION_ZERO_PORT',versioned.replace('.com/','.com:0443/')],['VERSION_SIMILAR_HOST',versioned.replace('.com/','.com.invalid/')],['VERSION_USERINFO',versioned.replace('https://','https://fixed@')],['VERSION_HTTP',versioned.replace('https:','http:')]])test(id,()=>{const e=event(u);assert.deepEqual(v2(e),v1(e));assert.notEqual(v2(e).code,'ALLOW');assert(!allowed(e.request,'Script'));});
