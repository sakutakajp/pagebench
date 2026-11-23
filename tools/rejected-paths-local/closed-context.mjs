// Controlled CDP transport, not Chrome. No network, URL argument or arbitrary opener.
import vm from'node:vm';import{TARGET}from'../natural-reads/policy.mjs';
export const CASES=Object.freeze(['normal','burst401','duplicates','longest401','overflow1100','cleanup_failure','abort_ack_failure','mixed401','redacted401','forged_abort_ack']);
export function closedContextFactory(Gateway,mode){
 if(!CASES.includes(mode))throw Error('CLOSED_CASE');
 let g,ctx,script=null,frame='about:blank',resolveNav,rejectNav,dispatchTask=null,ended=false;
 const counts={navigations:0,aborts:0,abort_acks:0,abort_responses:0,abort_ack_failures:0,abort_success_responses_sent:0,abort_error_responses_sent:0,abort_unconfirmed_responses:0,fulfilled:0,continues:0,upstream:0,post_stop_pauses:0,wire_closed:false};const replies=[];
 const event=(method,params)=>g.wire.onmessage({data:JSON.stringify({sessionId:'P',method,params})});
 const app={isHydrating:false,payload:{error:null},hook(){return()=>{};}},root={__vue_app__:{config:{globalProperties:{$nuxt:app}}}};
 const doc={body:{innerText:'Fixed visible synthetic home content longer than twenty characters.'},getElementById:s=>s==='__nuxt'?root:null,querySelector:s=>['main#home-content','main#home-content h1#home-title','main h1,main h2'].includes(s)?{}:null,querySelectorAll:s=>s==='meta[name="viewport" i]'?[{}]:[]};
 ctx=vm.createContext({document:doc,screen:{width:412,height:823},innerWidth:412,innerHeight:823,devicePixelRatio:1.75,navigator:{userAgent:'Android 11; moto g power (2022) Mobile'},setInterval:()=>1,clearInterval:()=>{}});
 const wire={send(raw){const m=JSON.parse(raw);let result={};if(m.method==='Page.getFrameTree')result={frameTree:{frame:{id:'F',loaderId:'L',url:frame}}};if(m.method==='Page.addScriptToEvaluateOnNewDocument'){script=m.params.source;result={identifier:'FIXED_CLOSED_SCRIPT'};}if(m.method==='Runtime.evaluate')try{result={result:{value:vm.runInContext(m.params.expression,ctx)}};}catch{result={exceptionDetails:{}};}
  if(m.method==='Fetch.continueRequest'){counts.continues++;throw Error('CLOSED_FORWARD_FORBIDDEN');}
  if(m.method==='Fetch.failRequest'){counts.aborts++;replies.push(m);return;}
  if(m.method==='Fetch.fulfillRequest')counts.fulfilled++;
  queueMicrotask(()=>wire.onmessage({data:JSON.stringify({id:m.id,sessionId:m.sessionId,result})}));
  if(m.method==='Fetch.fulfillRequest'&&m.params.requestId==='DOC')queueMicrotask(()=>{event('Network.responseReceived',{requestId:'DOC',type:'Document',response:{url:TARGET,status:200,mimeType:'text/html',headers:{}}});event('Network.loadingFinished',{requestId:'DOC',timestamp:0.3,encodedDataLength:128});event('Page.lifecycleEvent',{name:'firstContentfulPaint',frameId:'F',loaderId:'L',timestamp:0.5});});
 },close(){counts.wire_closed=true;}};
 g=new Gateway(wire,()=>rejectNav?.(Error('FIXED_CLOSED_STOP')));g.primary='P';g.createdPage='T';g.pageInfo={targetId:'T'};g.released=true;g.sessions.set('P',{ready:true,frame:'F'});g.onmessage=()=>{};
 const dispatch=(i,url,type='Script',headers={},method='GET')=>{const request={url,method,headers};event('Network.requestWillBeSent',{requestId:i,frameId:'F',loaderId:'L',documentURL:TARGET,type,request});event('Fetch.requestPaused',{requestId:i,networkId:i,frameId:'F',resourceType:type,request});};
 const longPath=i=>{const base='/'+Array(80).fill('ab').join('/')+'/p'+i;return base+'c'.repeat(256-base.length);};
 const page={evaluate:async f=>vm.runInContext('('+f.toString()+')()',ctx),goto(){counts.navigations++;return new Promise((resolve,reject)=>{resolveNav=resolve;rejectNav=reject;frame=TARGET;if(script)vm.runInContext(script,ctx);event('Page.frameNavigated',{frame:{id:'F',loaderId:'L',url:TARGET}});event('Runtime.executionContextCreated',{context:{id:8,origin:'https://staging.hirameki.dev',auxData:{frameId:'F',isDefault:true}}});dispatch('DOC',TARGET,'Document');
  dispatchTask=new Promise(r=>setImmediate(r)).then(async()=>{
   const total=mode==='normal'?7:399;for(let i=0;i<total;i++)dispatch('A'+i,'https://staging.hirameki.dev/_nuxt/fixture-cap-'+i+'.js','Script',i%2?{'Sec-Purpose':'prefetch'}:{});
   if(mode!=='normal'){
    const n=mode==='overflow1100'?1100:401;for(let i=0;i<n;i++){let url='https://closed-rejected.invalid'+(mode==='longest401'?longPath(i):mode==='redacted401'?'/token-'+i:'/p'+i+'.js'),method='GET',headers={};if(mode==='mixed401'&&i%4!==0){url='https://staging.hirameki.dev/'+(i%4===2?'api/unapproved-':'_nuxt/fixture-cap-')+i+'.js';if(i%4===1)method='POST';if(i%4===3)headers={Cookie:'CLOSED_NOT_A_REAL_CREDENTIAL'};}dispatch('R'+i,url,['Script','XHR','Image'][i%3],headers,method);}
    if(mode==='duplicates'||mode==='overflow1100')for(let i=0;i<5;i++)dispatch('D'+i,'https://closed-rejected.invalid/p0.js?discard=SYNTHETIC#discard','Script');
    for(const [i,m]of replies.splice(0).entries()){const error=mode==='abort_ack_failure'&&i===0,id=mode==='forged_abort_ack'&&i===0?m.id+1000000:m.id;counts.abort_responses++;if(error)counts.abort_error_responses_sent++;else counts.abort_success_responses_sent++;const pending=id===m.id&&m.sessionId===g.primary&&g.pending.has(m.id);wire.onmessage({data:JSON.stringify({id,sessionId:m.sessionId,...(error?{error:{code:-1}}:{result:{}})})});if(pending&&!g.pending.has(m.id)){if(error)counts.abort_ack_failures++;else counts.abort_acks++;}else counts.abort_unconfirmed_responses++;}
    for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));
    for(let i=0;i<3;i++){counts.post_stop_pauses++;dispatch('L'+i,'https://closed-rejected.invalid/late'+i+'.js');}
   }else resolveNav();
  }).catch(()=>rejectNav?.(Error('FIXED_CLOSED_DISPATCH')));
 });}};
 const context={gateway:g,wire,page,chrome:'Chrome/157.0.8103.78',proxy:{enable(){},disable(){}},async cleanup(){if(ended)return{status:'complete'};ended=true;g.beginCleanup();g.dispose();if(mode==='cleanup_failure')throw Error('FIXED_CLEANUP_FAILURE');return{status:'complete'};}};
 return{context,counts,async settle(){await dispatchTask;return await g.settleReceives(1000);}};
}
