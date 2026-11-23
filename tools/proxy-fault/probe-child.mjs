// CLOSED local test process: no DNS/upstream, no Chrome, no site or live payload.
import http from 'node:http';import net from 'node:net';import {writeFileSync,lstatSync} from 'node:fs';import {join,basename,resolve} from 'node:path';
const [version,scenario,directory]=process.argv.slice(2),dir=resolve(directory);if(!['baseline','hardened'].includes(version)||!['connect_rst','http_control','connect_emit','upgrade_emit','disable_emit','closing_emit'].includes(scenario)||!basename(dir).startsWith('pagebench-proxy-fault-child-')||(lstatSync(dir).mode&0o077)!==0)throw Error('CLOSED_ARGS');
const evidence={kind:'CLOSED_PROXY_COMPONENT_NOT_CHROME',node:process.version,version,scenario,first_socket_error:null,uncaught:null,handoff:null,proxy:null,close_result:'NOT_CALLED',finished:false,client_error_count:0};
const fixedCode=e=>{const d=Object.getOwnPropertyDescriptor(e??{},'code');return d&&['ECONNRESET','EPIPE','ETIMEDOUT'].includes(d.value)?d.value:'OTHER_OR_UNKNOWN';};
const save=()=>writeFileSync(join(dir,'evidence.json'),JSON.stringify(evidence),{mode:0o600});save();
process.on('uncaughtExceptionMonitor',(e,origin)=>{evidence.uncaught={code:fixedCode(e),origin:origin==='unhandledRejection'?'UNHANDLED_REJECTION':'UNCAUGHT_EXCEPTION'};save();});
let captured=null,phase='ACCEPTED',proxy,client;const make=http.createServer;
http.createServer=function(...a){const server=Reflect.apply(make,this,a);server.prependListener('connection',socket=>{captured=socket;const emit=socket.emit;socket.emit=function(event,...args){if(event==='error'&&!evidence.first_socket_error){evidence.first_socket_error={resource:'ACCEPTED_DOWNSTREAM_PROXY_SOCKET',phase,error_listeners:this.listenerCount('error'),code:fixedCode(args[0])};save();}return Reflect.apply(emit,this,[event,...args]);};});
 server.prependListener('connect',(_q,s)=>{phase='CONNECT_HANDOFF';evidence.handoff={kind:'CONNECT',error_listeners:s.listenerCount('error')};save();if(scenario==='connect_emit')setImmediate(()=>s.emit('error',Object.assign(Error('FIXED_SYNTHETIC_ERROR'),{code:'ECONNRESET'})));});
 server.prependListener('upgrade',(_q,s)=>{phase='UPGRADE_HANDOFF';evidence.handoff={kind:'UPGRADE',error_listeners:s.listenerCount('error')};save();if(scenario==='upgrade_emit')setImmediate(()=>s.emit('error',Object.assign(Error('FIXED_SYNTHETIC_ERROR'),{code:'ECONNRESET'})));});
 server.prependListener('request',(_q,r)=>{phase='HTTP_REQUEST';evidence.handoff={kind:'HTTP',error_listeners:r.socket.listenerCount('error')};save();});return server;};
const error=()=>Object.assign(Error('FIXED_SYNTHETIC_ERROR'),{code:'ECONNRESET'});
try{
 const {rejectOnlyProxy}=await import(version==='baseline'?'./baseline-source.mjs':'../nuxt-debug/natural-prefetch-proxy.mjs');proxy=await rejectOnlyProxy();http.createServer=make;
 const port=Number(new URL(proxy.url).port);client=net.connect({host:'127.0.0.1',port,allowHalfOpen:true});client.on('error',()=>{evidence.client_error_count++;});client.resume();
 await new Promise((resolve,reject)=>{client.once('connect',resolve);client.once('error',reject);});
 if(scenario==='http_control')client.write('GET /fixed HTTP/1.1\r\nHost: fixture.invalid\r\nConnection: close\r\n\r\n');
 else if(scenario==='upgrade_emit')client.write('GET /fixed HTTP/1.1\r\nHost: fixture.invalid\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');
 else client.write('CONNECT fixture.invalid:443 HTTP/1.1\r\nHost: fixture.invalid:443\r\n\r\n');
 if(scenario==='connect_rst'){await new Promise(r=>client.once('data',r));await new Promise(r=>setTimeout(r,10));client.resetAndDestroy();await new Promise(r=>setTimeout(r,80));}
 else await new Promise(r=>setTimeout(r,40));
 if(scenario==='disable_emit'){phase='DISABLING';proxy.disable();captured.emit('error',error());}
 let closing;if(scenario==='closing_emit'){phase='CLOSING';closing=proxy.close();captured.emit('error',error());}
 client.destroy();try{await(closing??proxy.close());evidence.close_result='RETURNED';}catch{evidence.close_result='FIXED_PROXY_FAULT';}
 evidence.proxy=proxy.snapshot();evidence.finished=true;save();
}finally{http.createServer=make;client?.destroy();}
