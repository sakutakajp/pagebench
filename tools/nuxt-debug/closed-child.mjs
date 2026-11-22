// Controlled CDP/page doubles only. Uses the real runArm and real request method, no request override.
import vm from 'node:vm';import {runArm} from '../ab-observe/runner.mjs';import {writer,safeArm,awaitStart} from './protocol.mjs';import {setSink} from './sink.mjs';import {safeEvidence} from './evidence.mjs';
import {mkdirSync} from 'node:fs';
const mode=process.argv[2];const modes=['positive','policy_inflight','policy_late','continue_error','emergency_throws','cleanup_throws','dispose_throws','sink_throws','child_exit','invalid_ipc','slow_cleanup','after_cleanup_event','journal_disk_failure','file_only_exit','contradictory_record','scope_path','scope_shape','scope_value','scope_api','scope_other','scope_prefetch','scope_late'];
if(!modes.includes(mode))process.exit(2);
await awaitStart();
if(mode==='journal_disk_failure')mkdirSync(process.env.PB_DEBUG_DIRECTORY+'/journal.tmp');
const emit=writer(process.env.PB_DEBUG_DIRECTORY,mode==='file_only_exit'?null:process.send.bind(process));setSink(mode==='sink_throws'?v=>{emit(v);throw Error('FIXED_SINK');}:emit);
const scopeURLs={scope_path:'https://staging.hirameki.dev/api/_content/query/invalid/name.json',scope_shape:'https://staging.hirameki.dev/api/_content/query/fixed.json?unexpected=NEVER_SAVE',scope_value:'https://staging.hirameki.dev/api/_content/query/fixed.json?_params='+encodeURIComponent(JSON.stringify({first:true,where:[{_path:'/NEVER_SAVE'}]})),scope_api:'https://staging.hirameki.dev/api/not-allowed',scope_other:'https://staging.hirameki.dev/unknown-NEVER_SAVE',scope_prefetch:'https://staging.hirameki.dev/api/not-allowed',scope_late:'https://staging.hirameki.dev/api/_content/query/fixed.json?_params=null'};
const target='https://staging.hirameki.dev/ja/';let gateway,wire,frameURL='about:blank',navReject,cleanupCalls=0,physicalClosed=false;const timers=[];
const send=m=>wire.onmessage({data:JSON.stringify(m)}),later=(fn,ms=0)=>timers.push(setTimeout(fn,ms));
const request=(name,type='Image',url='https://staging.hirameki.dev/static')=>({requestId:name,networkId:name,frameId:'F',resourceType:type,request:{url,method:'GET',headers:{}}});
async function open(Gateway){
 wire={send(raw){const m=JSON.parse(raw);if(m.method==='Fetch.continueRequest'&&m.params.requestId==='ALLOW'){if(mode==='continue_error')queueMicrotask(()=>send({id:m.id,error:{code:-1,message:'fixed'}}));else if(mode==='policy_late')later(()=>send({id:m.id,result:{}}),10);return;}
  if(m.method==='Fetch.failRequest'&&['child_exit','file_only_exit'].includes(mode))process.exit(7);
  const result=m.method==='Page.getFrameTree'?{frameTree:{frame:{id:'F',loaderId:'L',url:frameURL}}}:m.method==='Runtime.evaluate'?{result:{type:'number',value:0}}:{};
  queueMicrotask(()=>{send({id:m.id,result});if(m.method==='Fetch.continueRequest'&&m.params.requestId==='DOC'){
   send({sessionId:'P',method:'Network.responseReceived',params:{requestId:'DOC',type:'Document',response:{url:target,status:200,mimeType:'text/html',headers:{'content-type':'text/html'}}}});
   send({sessionId:'P',method:'Network.loadingFinished',params:{requestId:'DOC'}});frameURL=target;
   send({sessionId:'P',method:'Page.frameNavigated',params:{frame:{id:'F',loaderId:'L',url:target}}});send({sessionId:'P',method:'Page.lifecycleEvent',params:{name:'firstContentfulPaint',frameId:'F',loaderId:'L',timestamp:1}});
  }});
 },close(){if(mode==='dispose_throws')throw Error('FIXED_CLOSE');}};
 gateway=new Gateway(wire,()=>{navReject?.(Error('FIXED_NAV_ABORT'));if(mode==='emergency_throws')throw Error('FIXED_EMERGENCY');});gateway.primary='P';gateway.createdPage='T';gateway.pageInfo={targetId:'T'};gateway.released=true;gateway.sessions.set('P',{ready:true,frame:'F'});gateway.onmessage=()=>{};
 const doc={body:{innerText:'Fixed synthetic content longer than twenty characters.'},querySelector(s){return ['main#home-content','main#home-content h1#home-title','main h1,main h2'].includes(s)?{}:null;},querySelectorAll(s){return s==='meta[name="viewport" i]'?[{}]:[];}};
 const context={document:doc,screen:{width:412,height:823},innerWidth:412,innerHeight:823,devicePixelRatio:1.75,navigator:{userAgent:'Android 11; moto g power (2022) Mobile'}};
 const page={evaluate:async fn=>vm.runInNewContext('('+fn.toString()+')()',context),goto(){return new Promise((resolve,reject)=>{navReject=reject;send({sessionId:'P',method:'Fetch.requestPaused',params:request('DOC','Document',target)});
  later(()=>{if(!mode.startsWith('scope_'))resolve();if(mode==='invalid_ipc'){process.send({kind:'unexpected',message:'NEVER_SAVE'});return;}if(mode==='contradictory_record'){gateway.stopEvidence.fatal('AB_BOUNDARY_REJECTED');gateway.stopEvidence.first='CDP_LOST';gateway.stopEvidence.publish();return;}
   if(mode!=='positive'&&mode!=='cleanup_throws'&&mode!=='dispose_throws'&&mode!=='slow_cleanup'&&mode!=='after_cleanup_event'){
    gateway.active.add('COMPLETE');gateway.waiting.push(request('ALLOW'));send({sessionId:'P',method:'Network.loadingFinished',params:{requestId:'COMPLETE'}});
    if(mode!=='continue_error')later(()=>{const e=request('DENY','Fetch',scopeURLs[mode]||'https://telemetry.invalid/blocked');if(mode==='scope_prefetch')e.request.headers={'Sec-Purpose':'prefetch'};send({sessionId:'P',method:'Fetch.requestPaused',params:e});if(mode==='scope_late')later(()=>send({sessionId:'P',method:'Fetch.requestPaused',params:request('LATE','Fetch',scopeURLs.scope_api)}),1);},1);
   }
  },5);
 });}};
 let cleanup;
 return{gateway,wire,page,chrome:'Chrome/157.0.8103.78',proxy:{enable(){},disable(){}},cleanup(){return cleanup??=(async()=>{cleanupCalls++;gateway.beginCleanup();if(mode==='slow_cleanup')await new Promise(r=>later(r,200));gateway.dispose();physicalClosed=true;for(const t of timers)clearTimeout(t);if(mode==='cleanup_throws')throw Error('FIXED_CLEANUP');return{status:'complete'};})();}};
}
try{const result=await runArm('A',null,{open,windowMs:25,fixture:true});const evidence=safeEvidence(result.stop_evidence);if(!evidence)throw Error('EVIDENCE');emit(evidence);await new Promise(resolve=>process.send({kind:'nuxt-debug-final',evidence,observation:safeArm(result,process.env.GITHUB_SHA)},()=>resolve()));process.exitCode=result.status==='completed'&&evidence.cleanup==='COMPLETE'&&!evidence.first_fatal&&evidence.receiver_rejections===0&&evidence.secondary_failures===0?0:1;
}catch{process.exitCode=1;}finally{setSink(null);for(const t of timers)clearTimeout(t);process.disconnect?.();}
