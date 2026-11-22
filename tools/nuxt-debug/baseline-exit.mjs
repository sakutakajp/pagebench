import {pathToFileURL} from 'node:url';
// Test-only exact parent checkout, never called by the live launcher.
if(process.argv.length!==3||!process.argv[2].endsWith('/tools/ab-observe/gateway.mjs'))process.exit(2);
const {NoReinspectionGateway}=await import(pathToFileURL(process.argv[2]).href);
const wire={send(raw){const m=JSON.parse(raw);if(m.method==='Fetch.failRequest')queueMicrotask(()=>wire.onmessage({data:JSON.stringify({id:m.id,result:{}})}));}};
const g=new NoReinspectionGateway(wire,()=>{});g.primary='P';g.sessions.set('P',{ready:true,frame:'F'});g.active.add('COMPLETE');g.waiting.push({requestId:'ALLOW',networkId:'N',frameId:'F',resourceType:'Image',request:{url:'https://staging.hirameki.dev/static',method:'GET',headers:{}}});
wire.onmessage({data:JSON.stringify({sessionId:'P',method:'Network.loadingFinished',params:{requestId:'COMPLETE'}})});
setImmediate(()=>wire.onmessage({data:JSON.stringify({sessionId:'P',method:'Fetch.requestPaused',params:{requestId:'DENY',networkId:'D',frameId:'F',resourceType:'Fetch',request:{url:'https://telemetry.invalid/blocked',method:'GET',headers:{}}}})}));
setTimeout(()=>{process.exitCode=99;},1000);
