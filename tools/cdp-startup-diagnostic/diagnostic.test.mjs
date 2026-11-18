import{test}from'node:test';import assert from'node:assert/strict';
import http from'node:http';import net from'node:net';
import{Observer,kindOf,autoAttachParams,commandAllowed,denyProxy,endpoint}from'./diagnostic.mjs';
function harness(options={}){let ended=0,observer;const sent=[];const wire={send(raw){const m=JSON.parse(raw);sent.push(m);queueMicrotask(()=>{
 if(m.method==='Page.getFrameTree'&&options.extraPage){wire.onmessage(JSON.stringify({method:'Target.attachedToTarget',sessionId:options.ui?'ui-session':'tab-session',params:{sessionId:'page2',targetInfo:{type:'page',targetId:'P2',url:'about:blank'},waitingForDebugger:true}}));return;}
 if(m.method==='Page.getFrameTree'&&options.detachUI){wire.onmessage(JSON.stringify({method:'Target.detachedFromTarget',params:{sessionId:'ui-session'}}));return;}
 const result=m.method==='Target.getTargets'?{targetInfos:[{type:'browser',url:'SECRET',title:'SECRET',targetId:'SECRET'}]}:m.method==='Target.createTarget'?{targetId:options.badTab?'wrong':'T'}:m.method==='Page.getFrameTree'?{frameTree:{frame:{url:options.badFrame?'https://not-permitted.invalid/?SECRET':'about:blank'}}}:{};
 wire.onmessage(JSON.stringify({id:m.id,result}));
 const attach=(type,sid,id,parent,waiting=true)=>wire.onmessage(JSON.stringify({method:'Target.attachedToTarget',...(parent?{sessionId:parent}:{}),params:{sessionId:sid,targetInfo:{type,targetId:id,url:type==='page'?'about:blank':'',title:'SECRET'},waitingForDebugger:waiting}}));
 if(m.method==='Target.createTarget')attach('tab','tab-session','T');
 if(m.method==='Target.setAutoAttach'&&m.sessionId==='tab-session'){
  if(options.worker)attach('service_worker','worker','W','tab-session');
  else if(options.ui)attach('browser_ui','ui-session','UI',options.orphan?null:'tab-session',!options.uiUnpaused);
  else if(!options.noPage)attach('page','page-session','P','tab-session');
 }
 if(m.method==='Target.setAutoAttach'&&m.sessionId==='ui-session'&&!options.noPage)attach('page','page-session','P','ui-session');
 });},close(){}};observer=new Observer(wire,()=>ended++);return{observer,wire,sent,get ended(){return ended;}};}
test('official classifications, missing/empty/nonstring/unknown never echo raw values',()=>{
 for(const [info,k]of [[{},'TYPE_MISSING'],[{type:''},'TYPE_EMPTY'],[{type:77},'TYPE_NONSTRING'],[{type:'SECRET'},'TYPE_UNKNOWN_STRING'],[{type:'browser_ui'},'BROWSER_UI'],[{type:'worklet'},'WORKLET'],[{type:'auction_worklet'},'AUCTION_WORKLET'],[{type:'assistive_technology'},'ASSISTIVE_TECHNOLOGY'],[{type:'__proto__'},'TYPE_UNKNOWN_STRING']])assert.equal(kindOf(info),k);
});
test('about:blank only, no resume/navigation/network commands; no arbitrary filter',()=>{
 assert.ok(commandAllowed('Target.createTarget',{url:'about:blank',forTab:true}));assert.ok(commandAllowed('Target.setAutoAttach',autoAttachParams()));assert.ok(commandAllowed('Target.setAutoAttach',autoAttachParams(true),true));
 for(const [m,p]of [['Target.createTarget',{url:'https://not-permitted.invalid/'}],['Page.navigate',{url:'about:blank'}],['Runtime.runIfWaitingForDebugger',{}],['Fetch.continueRequest',{}],['Target.setAutoAttach',{...autoAttachParams(),waitForDebuggerOnStart:false}],['Target.setAutoAttach',{...autoAttachParams(),filter:[{}]}]])assert.equal(commandAllowed(m,p),false);
 assert.equal(commandAllowed('Target.getTargets',null),false);assert.throws(()=>endpoint('9000\nws://external.invalid/SECRET'));assert.throws(()=>endpoint('0\n/devtools/browser/00000000-0000-0000-0000-000000000000'));
 assert.equal(endpoint('9222\n/devtools/browser/00000000-0000-0000-0000-000000000000\n'),'ws://127.0.0.1:9222/devtools/browser/00000000-0000-0000-0000-000000000000');
});
test('actual collector records bounded order and recursively pauses tab/page, never resumes',async()=>{
 const h=harness();const r=await h.observer.collect();assert.equal(r.code,'BLANK_PAGE_PROTOCOL_READY');assert.ok(r.sequence.some(e=>e.event==='ATTACHED_PAUSED'&&e.kind==='PAGE'));assert.ok(r.sequence.some(e=>e.kind==='TAB'));assert.equal(h.ended,1);
 assert.equal(h.sent.filter(x=>x.method==='Target.createTarget').length,1);assert.ok(h.sent.every(x=>commandAllowed(x.method,x.params,!!x.sessionId)||['Page.enable','Page.getFrameTree'].includes(x.method)&&x.sessionId==='page-session'));assert.ok(!JSON.stringify(r).includes('SECRET'));assert.ok(r.sequence.every((e,i)=>e.n===i+1));assert.equal(r.target_resumes,0);assert.equal(r.outbound_forwarding,0);
});
test('unknown and auxiliary targets terminate before any resume, raw fields discarded',async()=>{
 for(const info of [{},{type:''},{type:[]},{type:'SECRET'},{type:'service_worker'}]){
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
test('BROWSER_UI is held paused, only the bound blank page receives metadata initialization',async()=>{
 const h=harness({ui:true}),r=await h.observer.collect();assert.equal(r.code,'BLANK_PAGE_PROTOCOL_READY');assert.equal(r.page_protocol_initialized,true);assert.equal(r.browser_ui_quarantined,1);assert.equal(r.browser_ui_resumes,0);assert.equal(r.target_resumes,0);
 assert.ok(r.sequence.some(x=>x.event==='BROWSER_UI_QUARANTINED'));assert.ok(h.sent.filter(x=>x.sessionId==='ui-session').every(x=>x.method==='Target.setAutoAttach'));assert.deepEqual(h.sent.filter(x=>x.method.startsWith('Page.')).map(x=>x.sessionId),['page-session','page-session']);assert.ok(!h.sent.some(x=>/Runtime|Fetch|Network/.test(x.method)));assert.ok(!JSON.stringify(r).includes('SECRET'));
});
test('wrong tab binding, orphan page, additional page, unpaused UI, and protection loss stop closed',async()=>{
 for(const [options,code]of [[{ui:true,badTab:true},'TAB_BINDING_FAILED'],[{ui:true,orphan:true},'PAGE_LINEAGE_REJECTED'],[{ui:true,extraPage:true},'EXTRA_PAGE_REJECTED'],[{ui:true,uiUnpaused:true},'TARGET_NOT_PAUSED'],[{ui:true,detachUI:true},'PROTECTION_LOST'],[{worker:true},'AUXILIARY_TARGET_STOP'],[{badFrame:true},'BLANK_FRAME_MISMATCH']]){const h=harness(options),r=await h.observer.collect();assert.equal(r.code,code,JSON.stringify(options));assert.equal(r.page_protocol_initialized,false);assert.equal(r.target_resumes,0);assert.ok(!h.sent.some(x=>x.method==='Runtime.runIfWaitingForDebugger'));}
});
test('no page while browser UI is paused produces an explicit no-page outcome without resuming UI',async()=>{
 const h=harness({ui:true,noPage:true}),r=await h.observer.collect();assert.equal(r.code,'PAGE_NOT_OBSERVED');assert.equal(r.browser_ui_quarantined,1);assert.equal(r.target_resumes,0);assert.equal(h.sent.filter(x=>x.method.startsWith('Page.')).length,0);
});
test('additional tab and page queries addressed to UI are refused',async()=>{
 const h=harness();h.observer.createIssued=true;await h.observer.receive(JSON.stringify({method:'Target.attachedToTarget',params:{sessionId:'tab1',targetInfo:{type:'tab',targetId:'T'},waitingForDebugger:true}}));await h.observer.receive(JSON.stringify({method:'Target.attachedToTarget',params:{sessionId:'tab2',targetInfo:{type:'tab',targetId:'T2'},waitingForDebugger:true}}));assert.equal(h.observer.code,'EXTRA_TAB_REJECTED');
 const q=harness();await assert.rejects(q.observer.call('Page.enable',{},'ui-session'),/REJECTED/);assert.equal(q.sent.length,0);
});
