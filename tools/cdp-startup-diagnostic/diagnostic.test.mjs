import{test}from'node:test';import assert from'node:assert/strict';
import http from'node:http';import net from'node:net';
import{Observer,kindOf,autoAttachParams,commandAllowed,denyProxy,endpoint}from'./diagnostic.mjs';
function harness(){let ended=0,observer;const sent=[];const wire={send(raw){const m=JSON.parse(raw);sent.push(m);queueMicrotask(()=>{wire.onmessage(JSON.stringify({id:m.id,result:m.method==='Target.getTargets'?{targetInfos:[{type:'browser',url:'SECRET',title:'SECRET',targetId:'SECRET'}]}:{}}));if(m.method==='Target.createTarget'){
 wire.onmessage(JSON.stringify({method:'Target.targetCreated',params:{targetInfo:{type:'tab',url:'SECRET',targetId:'T'}}}));wire.onmessage(JSON.stringify({method:'Target.attachedToTarget',params:{sessionId:'tab-session',targetInfo:{type:'tab',targetId:'T'},waitingForDebugger:true}}));
 }if(m.method==='Target.setAutoAttach'&&m.sessionId==='tab-session')wire.onmessage(JSON.stringify({method:'Target.attachedToTarget',sessionId:'tab-session',params:{sessionId:'page-session',targetInfo:{type:'page',targetId:'P'},waitingForDebugger:true}}));});},close(){}};observer=new Observer(wire,()=>ended++);return{observer,wire,sent,get ended(){return ended;}};}
test('official classifications, missing/empty/nonstring/unknown never echo raw values',()=>{
 for(const [info,k]of [[{},'TYPE_MISSING'],[{type:''},'TYPE_EMPTY'],[{type:77},'TYPE_NONSTRING'],[{type:'SECRET'},'TYPE_UNKNOWN_STRING'],[{type:'browser_ui'},'BROWSER_UI'],[{type:'worklet'},'WORKLET'],[{type:'auction_worklet'},'AUCTION_WORKLET'],[{type:'assistive_technology'},'ASSISTIVE_TECHNOLOGY'],[{type:'__proto__'},'TYPE_UNKNOWN_STRING']])assert.equal(kindOf(info),k);
});
test('about:blank only, no resume/navigation/network commands; no arbitrary filter',()=>{
 assert.ok(commandAllowed('Target.createTarget',{url:'about:blank'}));assert.ok(commandAllowed('Target.setAutoAttach',autoAttachParams()));assert.ok(commandAllowed('Target.setAutoAttach',autoAttachParams(true),true));
 for(const [m,p]of [['Target.createTarget',{url:'https://not-permitted.invalid/'}],['Page.navigate',{url:'about:blank'}],['Runtime.runIfWaitingForDebugger',{}],['Fetch.continueRequest',{}],['Target.setAutoAttach',{...autoAttachParams(),waitForDebuggerOnStart:false}],['Target.setAutoAttach',{...autoAttachParams(),filter:[{}]}]])assert.equal(commandAllowed(m,p),false);
 assert.equal(commandAllowed('Target.getTargets',null),false);assert.throws(()=>endpoint('9000\nws://external.invalid/SECRET'));assert.throws(()=>endpoint('0\n/devtools/browser/00000000-0000-0000-0000-000000000000'));
 assert.equal(endpoint('9222\n/devtools/browser/00000000-0000-0000-0000-000000000000\n'),'ws://127.0.0.1:9222/devtools/browser/00000000-0000-0000-0000-000000000000');
});
test('actual collector records bounded order and recursively pauses tab/page, never resumes',async()=>{
 const h=harness();const r=await h.observer.collect();assert.equal(r.code,'PAUSED_PAGE_OBSERVED');assert.ok(r.sequence.some(e=>e.event==='ATTACHED_PAUSED'&&e.kind==='PAGE'));assert.ok(r.sequence.some(e=>e.kind==='TAB'));assert.equal(h.ended,1);
 assert.equal(h.sent.filter(x=>x.method==='Target.createTarget').length,1);assert.ok(h.sent.every(x=>commandAllowed(x.method,x.params,!!x.sessionId)));assert.ok(!JSON.stringify(r).includes('SECRET'));assert.ok(r.sequence.every((e,i)=>e.n===i+1));assert.equal(r.target_resumes,0);assert.equal(r.outbound_forwarding,0);
});
test('unknown and auxiliary targets terminate before any resume, raw fields discarded',async()=>{
 for(const info of [{},{type:''},{type:[]},{type:'SECRET'},{type:'service_worker'},{type:'browser_ui'}]){
 const h=harness();await h.observer.receive(JSON.stringify({method:'Target.attachedToTarget',params:{sessionId:'SECRET',waitingForDebugger:true,targetInfo:{url:'SECRET?token=SECRET',title:'SECRET',targetId:'SECRET',...info}}}));const r=h.observer.result();assert.equal(h.ended,1);assert.ok(['TARGET_TYPE_UNCLASSIFIED','AUXILIARY_TARGET_STOP'].includes(r.code));assert.equal(h.sent.length,0);assert.ok(!JSON.stringify(r).includes('SECRET'));
 }
 const h=harness();await h.observer.receive(JSON.stringify({method:'Target.attachedToTarget',params:{waitingForDebugger:false,targetInfo:{type:'page'}}}));assert.equal(h.observer.code,'TARGET_NOT_PAUSED');
});
test('control loss, forbidden command and event flood are bounded/fail closed',async()=>{
 const h=harness();h.wire.onclose();assert.equal(h.observer.code,'CONTROL_LOST');await assert.rejects(h.observer.call('Target.getTargets'),/STOPPED/);
 const b=harness();await assert.rejects(b.observer.call('Runtime.runIfWaitingForDebugger',{}),/REJECTED/);assert.equal(b.sent.length,0);assert.equal(b.observer.code,'COMMAND_REJECTED');
 const f=harness();for(let i=0;i<70;i++)await f.observer.receive(JSON.stringify({method:'Target.targetCreated',params:{targetInfo:{type:'page'}}}));assert.equal(f.observer.sequence.length,48);assert.equal(f.observer.code,'EVENT_LIMIT');
});
test('real loopback proxy rejects HTTP, CONNECT and Upgrade without upstream access',async()=>{
 let upstreamCalls=0;const upstream=http.createServer((_q,r)=>{upstreamCalls++;r.end();});await new Promise(r=>upstream.listen(0,'127.0.0.1',r));const p=await denyProxy();
 try{
 assert.deepEqual(Object.keys(p).sort(),['close','url']);
 const status=await new Promise((resolve,reject)=>http.get(p.url,{path:'http://127.0.0.1:'+upstream.address().port+'/?SECRET',headers:{Cookie:'SECRET'}},r=>{r.resume();resolve(r.statusCode)}).on('error',reject));assert.equal(status,403);
 for(const request of ['CONNECT 127.0.0.1:'+upstream.address().port+' HTTP/1.1\r\nHost: local\r\n\r\n','GET / HTTP/1.1\r\nHost: local\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n'])await new Promise((resolve,reject)=>{const s=net.connect(+new URL(p.url).port,'127.0.0.1',()=>s.write(request));s.on('end',resolve);s.on('error',reject);});
 assert.equal(upstreamCalls,0);
 }finally{await p.close();await new Promise(r=>upstream.close(r));}
});
test('independent route has no measurement imports/target URLs/forwarding; startup failure is sanitized',async()=>{
 const{readFileSync,mkdtempSync,rmSync}=await import('node:fs');const{tmpdir}=await import('node:os');const{join}=await import('node:path');const{spawnSync}=await import('node:child_process');
 const source=readFileSync(new URL('./diagnostic.mjs',import.meta.url),'utf8');for(const prohibited of ['staging.hirameki.dev','image.hirameki.dev','puppeteer','from \'lighthouse\'','net.connect(',"'--no-sandbox'","'--ignore-certificate-errors'"])assert.ok(!source.includes(prohibited));
 const d=mkdtempSync(join(tmpdir(),'cdp-observe-test-'));try{const r=spawnSync(process.execPath,[new URL('./diagnostic.mjs',import.meta.url).pathname],{cwd:d,env:{CHROME_PATH:'/tmp/nonexistent-diagnostic-chrome'},encoding:'utf8',timeout:10000});assert.equal(r.status,1);assert.equal(r.stderr,'');const out=JSON.parse(r.stdout);assert.equal(out.code,'BINARY_UNAVAILABLE');assert.equal(out.site_navigations,0);assert.ok(!r.stdout.includes('nonexistent-diagnostic-chrome'));}finally{rmSync(d,{recursive:true,force:true});}
});
