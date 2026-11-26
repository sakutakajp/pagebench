// TEST ONLY: controlled CDP/readiness, actual original browser wrapper/policy,
// real reject-only TCP, child process, filesystem/profile and cleanup.
import assert from 'node:assert/strict';
import net from 'node:net';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {cleanupDiagnostic,trackProcess} from '../cdp-startup-diagnostic/cleanup.mjs';
import {BROWSER_MODES} from '../natural-reads/browser.mjs';
import {EXPECTED_STOP} from '../natural-reads/fixture-stop.mjs';
import {TARGET} from '../natural-reads/policy.mjs';
import {PAGE,PAYLOAD,ASSET,META} from '../natural-reads/control.mjs';
import {postFlushProxy} from '../connect-postflush-closed/proxy.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let n=0;n<200;n++){if(fn())return;await pause(5);}throw Error('CLOSED_TEST_TIMEOUT');}
export function model({variant='baseline',timing='NONE',faultCase='unapproved_api',ack='normal'}={}) {
  let index=0;const rows=[],physical=[];
  const open=async(G,makeProxy)=>{
    const mode=BROWSER_MODES[index++];if(!mode)throw Error('CLOSED_CASE_BOUND');
    const proxy=await(variant==='postflush'?postFlushProxy(makeProxy):makeProxy());
    const profile=await mkdtemp(join(tmpdir(),'native-order-fixed-'));
    await writeFile(join(profile,'fixed'),'fixed',{mode:0o600});
    const proc=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'}),tracked=trackProcess(proc);
    await once(proc,'spawn');
    let peer,g,armed=false,peerTriggered=false,afterArm=0,cleanup;
    const trace=[],mark=x=>{if(trace.length>=32)throw Error('CLOSED_TRACE_BOUND');trace.push(x);};
    const requests=new Map();
    const emit=(method,params)=>wire.onmessage({data:JSON.stringify({sessionId:'P',method,params})});
    const drain=async()=>{for(let i=0;i<12;i++)await tick();};
    const reset=async()=>{
      if(peerTriggered)throw Error('CLOSED_DUPLICATE_RESET');peerTriggered=true;
      mark('PEER_RST_REQUESTED');peer.resetAndDestroy();
      if(variant==='baseline')await until(()=>proxy.snapshot().socket_errors===1);
      else await until(()=>proxy.snapshot().open_sockets===0);
      mark(proxy.snapshot().socket_errors?'FAULT_OBSERVED':'LOCAL_CLOSE_CONFIRMED');
    };
    const wire=new EventTarget();wire.readyState=1;
    wire.close=()=>{if(wire.readyState===1){wire.readyState=3;wire.dispatchEvent(new Event('close'));}};
    wire.send=raw=>{
      const m=JSON.parse(raw),request=requests.get(m.params?.requestId);
      const reply=()=>{
        const result={id:m.id,sessionId:m.sessionId,result:{}};
        if(m.method==='Fetch.failRequest'&&ack==='error'){delete result.result;result.error={code:-1,message:'FIXED_SYNTHETIC_NOT_SAVED'};}
        wire.onmessage({data:JSON.stringify(result)});
        if(m.method==='Fetch.failRequest')mark('ABORT_ACK_DELIVERED');
        if(m.method==='Fetch.fulfillRequest'&&request){
          const mime=request.request.url===TARGET||request.request.url===PAGE?'text/html':request.request.url===ASSET?'text/javascript':request.request.url.includes('image.')?'image/png':'application/json';
          emit('Network.responseReceived',{requestId:request.networkId,type:request.resourceType,response:{url:request.request.url,status:200,mimeType:mime,headers:{}}});
          emit('Network.loadingFinished',{requestId:request.networkId});
        }
      };
      if(m.method==='Fetch.failRequest'){
        mark('ABORT_SENT');
        if(mode===faultCase&&timing==='ACK_PENDING'){
          setImmediate(()=>reset().then(reply).catch(()=>g.fail('GATEWAY_INTERNAL_FAILED')));return;
        }
      }
      queueMicrotask(reply);
    };
    g=new G(wire,()=>{mark('EMERGENCY_DISABLE');proxy.disable();proc.kill('SIGKILL');});
    g.primary='P';g.sessions.set('P',{ready:true,frame:'F'});g.onmessage=()=>{};
    const dispatch=(url,type='Fetch',method='GET',key='FIXED')=>{
      const e={requestId:'FETCH_'+key,networkId:key,frameId:'F',resourceType:type,request:{url,method,headers:{}}};requests.set(e.requestId,e);
      emit('Network.requestWillBeSent',{requestId:key,frameId:'F',loaderId:'L',documentURL:TARGET,type:type==='XHR'?'Fetch':type,request:e.request});emit('Fetch.requestPaused',e);
    };
    const c={proxy,gateway:g,chrome:'Chrome/158.0.8127.36',page:{
      async goto(){dispatch(TARGET,'Document','GET','DOC');dispatch('https://image.hirameki.dev/fixture.webp','Image','GET','IMAGE');await drain();if(!EXPECTED_STOP[mode]){for(const[u,key]of[[PAGE,'PAGE'],[PAYLOAD,'PAYLOAD'],[ASSET,'ASSET'],[META,'META']])dispatch(u,'Fetch','GET',key);await drain();}},
      async evaluate(fn){
        if(armed){afterArm++;throw Error('CLOSED_POST_ARM_COMMAND');}
        if(fn.name==='captureDeviceScreen')return{screenWidth:412,screenHeight:823,dpr:1.75,mobile:true};
        if(fn.name==='armNegativeFixture'){
          armed=true;mark('ARM_ACK_RETURNED');setImmediate(()=>{const e=EXPECTED_STOP[mode];dispatch(e.url,mode==='navigation'?'Document':'XHR',e.method,'NEGATIVE');});return{state:'ARMED',scheduled:true};
        }
        return{ready:true,prefetch:mode==='natural_prefetch'?3:0,rendered:true};
      },url(){if(armed){afterArm++;throw Error('CLOSED_POST_ARM_COMMAND');}return TARGET;}
    },async cleanup(){
      mark('CLEANUP_DISABLE');g.beginCleanup();proxy.disable();g.dispose();
      cleanup=await cleanupDiagnostic({wire,proc,tracked,proxy,profile,removeProfile:p=>rm(p,{recursive:true,force:true})});
      peer?.destroy();let deleted=false;try{await stat(profile);}catch(e){deleted=e.code==='ENOENT';}
      physical.push({case:mode,process_closed:tracked.closed,profile_deleted:deleted,wire_closed:wire.readyState===3,proxy_closed:proxy.snapshot().closed,open_sockets:proxy.snapshot().open_sockets});
      rows.push({case:mode,variant,timing:mode===faultCase?timing:'NONE',trace:[...trace],after_arm_browser_commands:afterArm,peer_triggered:peerTriggered});
      return cleanup;
    }};
    if(mode===faultCase&&timing!=='NONE'){
      peer=net.connect({host:'127.0.0.1',port:Number(new URL(proxy.url).port),allowHalfOpen:true});peer.on('error',()=>{});peer.setTimeout(1500,()=>peer.destroy());
      await once(peer,'connect');mark('PEER_CONNECTED');
      if(timing==='EARLY'){
        peer.write('CONNECT fixed');await pause(15);await reset();
      }else{
        const received=once(peer,'data');peer.write('CONNECT fixture.invalid:443 HTTP/1.1\r\nHost: fixture.invalid:443\r\n\r\n');
        const [data]=await received;assert.equal(data.toString(),'HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');mark('HTTP403_RECEIVED');
        if(variant==='postflush'){await until(()=>proxy.snapshot().open_sockets===0);mark('LOCAL_CLOSE_BEFORE_RESET');}
        else{assert.equal(proxy.snapshot().open_sockets,1);mark('BASELINE_HALF_OPEN');}
        if(timing==='BEFORE_ARM')await reset();
      }
    }
    return c;
  };
  return{open,rows,physical};
}
