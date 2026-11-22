// Controlled CDP through the original runArm, not real Chrome or site data.
import vm from 'node:vm';import {runArm} from '../ab-observe/runner.mjs';import {NaturalReadGateway} from './gateway.mjs';import {TARGET} from './policy.mjs';
export const META='https://staging.hirameki.dev/api/_content/query/fixed.json?_params='+encodeURIComponent('{"first":true,"where":[{"_path":"/ja"}],"sort":[{"_stem":1,"$numeric":true}]}');
export const PAGE='https://staging.hirameki.dev/ja/font/serif/';export const PAYLOAD=PAGE+'_payload.json';export const ASSET='https://staging.hirameki.dev/_nuxt/fixture.js';
export const CONTROL_MODES=['normal','marked','fetch_other','metadata_marked','directory','post','credential','external','production','api','admin','redirect','new_document','private_response','wrong_mime','network_failure','concurrent_violation','cleanup_failure','late_response','limit'];
export async function runReadControl(mode){if(!CONTROL_MODES.includes(mode))throw Error('MODE');let g,resolveNav,rejectNav,frameURL='about:blank',finished=false;const timers=[],counts={main_continues:0,resource_continues:0,aborts:0,metadata_continues:0},event=(method,params,s='P')=>g.wire.onmessage({data:JSON.stringify({method,params,sessionId:s})}),later=(f,n=0)=>timers.push(setTimeout(f,n));
 const req=(id,url,type='Fetch',headers={})=>({requestId:'F'+id,networkId:id,frameId:'FRAME',resourceType:type,request:{url,method:'GET',headers}}),rows=new Map();
 function dispatch(e){rows.set(e.requestId,e);event('Network.requestWillBeSent',{requestId:e.networkId,frameId:'FRAME',loaderId:'LOADER',documentURL:TARGET,type:e.resourceType==='Fetch'?'Other':e.resourceType,request:e.request});event('Fetch.requestPaused',e);}
 async function open(Gateway){const wire={send(raw){const m=JSON.parse(raw),e=rows.get(m.params?.requestId);if(m.method==='Fetch.failRequest'){counts.aborts++;queueMicrotask(()=>wire.onmessage({data:JSON.stringify({id:m.id,sessionId:m.sessionId,result:{}})}));return;}
  if(m.method==='Fetch.continueRequest'){
   if(e.request.url===TARGET)counts.main_continues++;else{counts.resource_continues++;if(e.request.url===META)counts.metadata_continues++;}
  }
  const result=m.method==='Page.getFrameTree'?{frameTree:{frame:{id:'FRAME',loaderId:'LOADER',url:frameURL}}}:m.method==='Runtime.evaluate'?{result:{value:0}}:{};
  queueMicrotask(()=>{wire.onmessage({data:JSON.stringify({id:m.id,sessionId:m.sessionId,result})});if(m.method!=='Fetch.continueRequest')return;
   const doc=e.request.url===TARGET;event('Network.responseReceived',{requestId:e.networkId,type:e.resourceType,response:{url:e.request.url,status:200,mimeType:doc?'text/html':mode==='wrong_mime'?'text/plain':e.request.url===PAGE?'text/html':e.request.url===ASSET?'text/javascript':'application/json',headers:mode==='private_response'&&!doc?{'cache-control':'private'}:{}}});
   if(mode==='network_failure'&&!doc)event('Network.loadingFailed',{requestId:e.networkId,errorText:'net::ERR_CONNECTION_RESET'});else event('Network.loadingFinished',{requestId:e.networkId});
   if(doc){frameURL=TARGET;event('Page.frameNavigated',{frame:{id:'FRAME',loaderId:'LOADER',url:TARGET}});event('Runtime.executionContextCreated',{context:{id:10,auxData:{frameId:'FRAME',isDefault:true}}});event('Page.lifecycleEvent',{name:'firstContentfulPaint',frameId:'FRAME',loaderId:'LOADER',timestamp:1});later(resources,1);}else if(!finished){finished=true;later(()=>resolveNav(),5);}
  });},close(){}};
  g=new Gateway(wire,()=>rejectNav?.(Error('FIXED_STOP')));g.primary='P';g.createdPage='TARGET';g.pageInfo={targetId:'TARGET'};g.released=true;g.sessions.set('P',{ready:true,frame:'FRAME'});g.readSignals.runtimeReady();g.onmessage=()=>{};
  const doc={body:{innerText:'Fixed synthetic visible home content longer than twenty characters.'},querySelector(s){return ['main#home-content','main#home-content h1#home-title','main h1,main h2'].includes(s)?{}:null;},querySelectorAll(s){return s==='meta[name="viewport" i]'?[{}]:[];}};
  const ctx={document:doc,screen:{width:412,height:823},innerWidth:412,innerHeight:823,devicePixelRatio:1.75,navigator:{userAgent:'Android 11; moto g power (2022) Mobile'}};
  const page={evaluate:async f=>vm.runInNewContext('('+f.toString()+')()',ctx),goto(){return new Promise((res,rej)=>{resolveNav=res;rejectNav=rej;dispatch(req('DOC',TARGET,'Document'));});}};
  return{gateway:g,page,wire,chrome:'Chrome/157.0.8103.78',proxy:{enable(){},disable(){}},async cleanup(){g.beginCleanup();g.dispose();for(const t of timers)clearTimeout(t);if(mode==='cleanup_failure')throw Error('FIXED_CLEANUP');return{status:'complete'};}};
 }
 function resources(){if(g.stopping)return;const headers=['marked','fetch_other','metadata_marked'].includes(mode)?{'Sec-Purpose':'prefetch'}:{};
  let e=req('ONE',mode==='metadata_marked'?META:PAGE,mode==='fetch_other'?'Other':'Fetch',headers);
  if(mode==='normal'||mode==='marked'||mode==='fetch_other'){dispatch(e);dispatch(req('TWO',PAYLOAD,'Fetch',headers));dispatch(req('THREE',ASSET,'Fetch',headers));dispatch(req('META',META,'XHR'));return;}
  if(mode==='directory'){const v={where:[{homepage:true,_partial:false,_path:{$not:'--REGEX /^\\/ja\\/blog/'}},{_path:'--REGEX /^\\/ja/'}],only:['_path','title','description','category'],sort:[{_stem:1,$numeric:true}]};e.request.url=META.split('?')[0]+'?_params='+encodeURIComponent(JSON.stringify(v));}
  if(mode==='post')e.request.method='POST';if(mode==='credential')e.request.headers.Authorization='NEVER_SAVE';if(mode==='external')e.request.url='https://other.invalid/a';if(mode==='production')e.request.url='https://hirameki.dev/ja/';if(mode==='api')e.request.url='https://staging.hirameki.dev/api/users';if(mode==='admin')e.request.url='https://staging.hirameki.dev/admin/';if(mode==='redirect')e.redirectedRequestId='OLD';if(mode==='new_document')e.resourceType='Document';if(mode==='limit')g.boundary.total=120;
  dispatch(e);if(mode==='concurrent_violation')dispatch(req('BAD','https://other.invalid/a'));if(mode==='late_response')later(()=>{g.fail('AB_BOUNDARY_REJECTED');event('Network.loadingFailed',{requestId:e.networkId,errorText:'NEVER_SAVE'});},1);
 }
 let result;try{result=await runArm('A',null,{Gateway:NaturalReadGateway,open,fixture:true,windowMs:1});}finally{for(const t of timers)clearTimeout(t);}
 return{kind:'CONTROLLED_CDP_NOT_CHROME',case:mode,status:result.status,reason:result.reason,cleanup:result.cleanup,documents:result.documents,http_status:result.http_status,commands:counts,signals:g.readSignals.snapshot(),first_refusal:result.stop_evidence?.first_refusal??null,score_saved:false};
}
