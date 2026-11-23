// Reject-only loopback proxy: no DNS, upstream socket, forwarding client, or enable method.
import http from 'node:http';
export async function rejectOnlyProxy(){
 const sockets=new Set(),s={connections:0,http_rejected:0,connect_rejected:0,upgrade_rejected:0,bytes_received:0};let closed=false,disabled=false,closeState='NOT_STARTED',shutdown=null,serverClosed=false,finishShutdown=null,firstFault=null,socketErrors=0;
 const fixedCode=e=>{try{const d=Object.getOwnPropertyDescriptor(e,'code');return d&&['ECONNRESET','EPIPE','ETIMEDOUT'].includes(d.value)?d.value:'OTHER_OR_UNKNOWN';}catch{return'OTHER_OR_UNKNOWN';}};
 const maybeClosed=()=>{if(serverClosed&&sockets.size===0)finishShutdown?.(true);};
 // CONNECT/Upgrade hand the raw accepted Socket to us after Node removes its HTTP
 // error listener. Keep our listener through physical close, including cleanup.
 // A handled transport fault still invalidates the proof; it is never a pass.
 const stopSockets=()=>{disabled=true;for(const socket of sockets)socket.destroy();};
 const startShutdown=()=>{if(shutdown)return shutdown;closeState='CLOSING';shutdown=new Promise(resolve=>{
  let settled=false;const timer=setTimeout(()=>finish(false),3000);const finish=ok=>{if(settled)return;settled=true;clearTimeout(timer);closed=ok;closeState=ok?'CLOSED':'UNCONFIRMED';resolve(ok);};finishShutdown=finish;
  server.close(()=>{serverClosed=true;maybeClosed();});stopSockets();maybeClosed();
 });return shutdown;};
 const server=http.createServer((_q,r)=>{s.http_rejected++;r.writeHead(403,{'Content-Length':'0','Connection':'close'});r.end();});
 const stages=new WeakMap();
 server.on('connection',socket=>{s.connections++;sockets.add(socket);stages.set(socket,'ACCEPTED');socket.on('error',e=>{
  socketErrors=Math.min(65535,socketErrors+1);firstFault??=Object.freeze({resource:'ACCEPTED_DOWNSTREAM_PROXY_SOCKET',code:fixedCode(e),stage:stages.get(socket)||'OTHER_OR_UNKNOWN',lifecycle:closeState!=='NOT_STARTED'?closeState:disabled?'DISABLED':'ACTIVE'});startShutdown();
 });socket.on('data',b=>s.bytes_received=Math.min(104857600,s.bytes_received+b.length));socket.on('close',()=>{sockets.delete(socket);maybeClosed();});socket.setTimeout(3000,()=>socket.destroy());if(disabled)socket.destroy();});
 server.prependListener('request',q=>stages.set(q.socket,'HTTP_REQUEST'));
 server.on('connect',(_q,socket)=>{stages.set(socket,'CONNECT_HANDOFF');s.connect_rejected++;socket.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');});
 server.on('upgrade',(_q,socket)=>{stages.set(socket,'UPGRADE_HANDOFF');s.upgrade_rejected++;socket.destroy();});
 server.on('clientError',(_e,socket)=>socket.destroy());
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{server.off('error',reject);resolve();});});
 return{url:'http://127.0.0.1:'+server.address().port,disable:stopSockets,async close(){const confirmed=await startShutdown();if(!confirmed)throw Error('CLOSED_PROXY_CLOSE_UNCONFIRMED');if(firstFault)throw Error('CLOSED_PROXY_SOCKET_FAULT');},snapshot(){return{kind:'reject-only-proxy-counts',...s,open_sockets:sockets.size,closed,close_state:closeState,socket_errors:socketErrors,socket_errors_saturated:socketErrors===65535,first_socket_fault:firstFault,forwarding_capability:'ABSENT',upstream_sockets_opened:0};}};
}
