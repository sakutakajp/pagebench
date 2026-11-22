// Closed CDP/Page doubles. Uses the original runArm and request/start methods.
// This module cannot open a browser or connect to a URL: open and transport are always supplied here.
import vm from 'node:vm';
import {runArm,publicResult} from '../ab-observe/runner.mjs';
import {NoReinspectionGateway} from '../ab-observe/gateway.mjs';
import {BoundPrefetchCandidate} from './bound-prefetch.mjs';
const TARGET='https://staging.hirameki.dev/ja/';
const META='https://staging.hirameki.dev/api/_content/query/fixed.json?_params='+encodeURIComponent('{"first":true,"where":[{"_path":"/ja"}],"sort":[{"_stem":1,"$numeric":true}]}');
export const CONTROL_MODES=['positive','ordinary_fetch','purpose_only','script_initiator','missing_network','wrong_loader','wrong_frame','wrong_network_session','wrong_fetch_session','url_mismatch','credentials','external','post','redirect','ack_error','ack_shape','ack_missing_stop','competing_violation','response_before_abort','burst','pending_limit','unknown_target','cleanup_failure','metadata_before_ack','api_prefetch','query_prefetch','image_origin_prefetch','ack_missing_session','ack_wrong_session','ack_missing_result'];
export async function runControl(mode,{candidate=true}={}){
 if(!CONTROL_MODES.includes(mode))throw Error('CLOSED_CASE_REQUIRED');
 let gateway,wire,frameURL='about:blank',navigationResolve,navigationReject,physicalClosed=false,nextSpec=0;const timers=[];
 const c={document_continues:0,metadata_continues:0,speculative_continues:0,speculative_aborts:0,other_continues:0};
 const send=m=>wire.onmessage({data:JSON.stringify(m)}),later=(f,ms=0)=>{const id=setTimeout(f,ms);timers.push(id);};
 const event=(method,params,sessionId='P')=>send({method,params,sessionId});
 const request=(id,url,type='Fetch',headers={})=>({requestId:id,networkId:id,frameId:'F',resourceType:type,request:{url,method:'GET',headers}});
 function metadata(){if(gateway.stopping)return;event('Network.requestWillBeSent',{requestId:'META',frameId:'F',loaderId:'L',documentURL:TARGET,type:'Fetch',request:{url:META,method:'GET',headers:{}},initiator:{type:'script'}});event('Fetch.requestPaused',request('META',META));}
 function speculative(){
  if(gateway.stopping)return;const n=++nextSpec,id='SPEC'+n;
  const e=request(id,'https://staging.hirameki.dev/closed-prefetch-NEVER_SAVE','Fetch',mode==='purpose_only'?{Purpose:'prefetch'}:mode==='ordinary_fetch'?{}:{'Sec-Purpose':'prefetch'});
  if(mode==='credentials')e.request.headers.Cookie='NEVER_SAVE';
  if(mode==='external')e.request.url='https://telemetry.invalid/NEVER_SAVE';
  if(mode==='api_prefetch')e.request.url='https://staging.hirameki.dev/api/NEVER_SAVE';
  if(mode==='query_prefetch')e.request.url+='?unknown=NEVER_SAVE';
  if(mode==='image_origin_prefetch')e.request.url='https://image.hirameki.dev/NEVER_SAVE';
  if(mode==='post'){e.request.method='POST';e.request.postData='NEVER_SAVE';}
  if(mode==='redirect')e.redirectedRequestId='NEVER_SAVE';
  if(mode!=='missing_network')event('Network.requestWillBeSent',{requestId:id,frameId:mode==='wrong_frame'?'OTHER':'F',loaderId:mode==='wrong_loader'?'OTHER':'L',documentURL:TARGET,type:'Fetch',request:{...e.request,headers:{...e.request.headers}},initiator:mode==='script_initiator'?{type:'script',stack:{description:'NEVER_SAVE'}}:{type:'parser',url:TARGET}},mode==='wrong_network_session'?'OTHER':'P');
  if(mode==='url_mismatch')e.request.url='https://staging.hirameki.dev/other-NEVER_SAVE';
  event('Fetch.requestPaused',e,mode==='wrong_fetch_session'?'OTHER':'P');
  if(mode==='pending_limit'&&n<7)speculative();
 }
 async function open(Gateway){
  wire={send(raw){const m=JSON.parse(raw),rid=m.params?.requestId;
   if(m.method==='Fetch.continueRequest'){
    if(rid==='DOC')c.document_continues++;else if(rid==='META')c.metadata_continues++;else if(rid?.startsWith('SPEC'))c.speculative_continues++;else c.other_continues++;
   }
   if(m.method==='Fetch.failRequest'&&rid?.startsWith('SPEC')){
    c.speculative_aborts++;
    if(mode==='ack_missing_stop'){later(()=>gateway.fail('CDP_TIMEOUT'),5);return;}
    if(mode==='metadata_before_ack'){metadata();later(()=>send({id:m.id,sessionId:m.sessionId,result:{}}),100);return;}
    if(mode==='pending_limit')return;
    if(mode==='response_before_abort'){event('Network.responseReceived',{requestId:rid,response:{url:'https://staging.hirameki.dev/closed-prefetch-NEVER_SAVE',status:200,mimeType:'application/json'}});return;}
    if(mode==='competing_violation'){event('Fetch.requestPaused',request('OUTSIDE','https://telemetry.invalid/NEVER_SAVE'));later(()=>send({id:m.id,sessionId:m.sessionId,result:{}}),10);return;}
    later(()=>{
     send(mode==='ack_error'?{id:m.id,sessionId:m.sessionId,error:{code:-1,message:'NEVER_SAVE'}}:{id:m.id,...(mode==='ack_missing_session'?{}:{sessionId:mode==='ack_wrong_session'?'OTHER':m.sessionId}),...(mode==='ack_missing_result'?{}:{result:mode==='ack_shape'?{untrusted:'NEVER_SAVE'}:{}})});
     if(mode==='ack_error'||mode==='ack_shape')return;
     event('Network.loadingFailed',{requestId:rid,errorText:'net::ERR_BLOCKED_BY_CLIENT',canceled:false,blockedReason:'inspector'});
     later(()=>{if(mode==='burst'&&nextSpec<257)speculative();else if(mode==='unknown_target')event('Target.targetCreated',{targetInfo:{targetId:'UNKNOWN',type:'worker'}});else metadata();},1);
    },1);return;
   }
   const result=m.method==='Page.getFrameTree'?{frameTree:{frame:{id:'F',loaderId:'L',url:frameURL}}}:m.method==='Runtime.evaluate'?{result:{type:'number',value:0}}:{};
   queueMicrotask(()=>{send({id:m.id,sessionId:m.sessionId,result});if(m.method==='Fetch.continueRequest'&&rid==='DOC'){
    event('Network.responseReceived',{requestId:'DOC',type:'Document',response:{url:TARGET,status:200,mimeType:'text/html',headers:{'content-type':'text/html'}}});event('Network.loadingFinished',{requestId:'DOC'});frameURL=TARGET;
    event('Page.frameNavigated',{frame:{id:'F',loaderId:'L',url:TARGET}});event('Page.lifecycleEvent',{name:'firstContentfulPaint',frameId:'F',loaderId:'L',timestamp:1});later(speculative,1);
   }if(m.method==='Fetch.continueRequest'&&rid==='META'){
    event('Network.responseReceived',{requestId:'META',type:'Fetch',response:{url:META,status:200,mimeType:'application/json',headers:{'content-type':'application/json'}}});event('Network.loadingFinished',{requestId:'META'});navigationResolve();
   }});
  },close(){}};
  gateway=new Gateway(wire,()=>navigationReject?.(Error('FIXED_GUARD_STOP')));gateway.primary='P';gateway.createdPage='T';gateway.pageInfo={targetId:'T'};gateway.released=true;gateway.sessions.set('P',{ready:true,frame:'F'});gateway.onmessage=()=>{};
  const doc={body:{innerText:'Fixed synthetic visible home content with more than twenty characters.'},querySelector(s){return ['main#home-content','main#home-content h1#home-title','main h1,main h2'].includes(s)?{}:null;},querySelectorAll(s){return s==='meta[name="viewport" i]'?[{}]:[];}};
  const context={document:doc,screen:{width:412,height:823},innerWidth:412,innerHeight:823,devicePixelRatio:1.75,navigator:{userAgent:'Android 11; moto g power (2022) Mobile'}};
  const page={evaluate:async fn=>vm.runInNewContext('('+fn.toString()+')()',context),goto(){return new Promise((resolve,reject)=>{navigationResolve=resolve;navigationReject=reject;event('Fetch.requestPaused',request('DOC',TARGET,'Document'));});}};
  let cleanup;return{gateway,wire,page,chrome:'Chrome/157.0.8103.78',proxy:{enable(){},disable(){}},cleanup(){return cleanup??=(async()=>{gateway.beginCleanup();gateway.dispose();physicalClosed=true;for(const t of timers)clearTimeout(t);if(mode==='cleanup_failure')throw Error('FIXED_CLEANUP_FAILURE');return{status:'complete'};})();}};
 }
 let result;try{result=await runArm('A',null,{Gateway:candidate?BoundPrefetchCandidate:NoReinspectionGateway,open,windowMs:25,fixture:true});}
 finally{for(const t of timers)clearTimeout(t);}
 const p=publicResult({attempts:[result]},'1'.repeat(40)).attempts[0];
 const observation={mode:p.mode,status:p.status,reason:p.reason,documents:p.documents,http_status:p.http_status,html:p.html,cleanup:p.cleanup,phase:p.phase??'COMPLETED',classification:p.samples?.classification??null,prefetch_blocked:p.prefetch_blocked??null};
 return{kind:'controlled-prefetch-original-wrapper',case:mode,implementation:candidate?'LOCAL_CANDIDATE':'ORIGINAL',observation,first_refusal:result.stop_evidence?.first_refusal??null,first_fatal:result.stop_evidence?.first_fatal??null,metadata:result.stop_evidence?.metadata??null,discard:gateway.discardSnapshot?.()??null,transport:c,physical_cleanup:physicalClosed?'COMPLETE':'UNKNOWN',network:'CONTROLLED_CDP_ONLY_NO_BROWSER_NO_NETWORK',score_saved:false,report_saved:false};
}
