// Reject-only loopback proxy: no DNS, upstream socket, forwarding client, or enable method.
import http from 'node:http';
export async function rejectOnlyProxy(){
 const sockets=new Set(),s={connections:0,http_rejected:0,connect_rejected:0,upgrade_rejected:0,bytes_received:0};let closed=false;
 const server=http.createServer((_q,r)=>{s.http_rejected++;r.writeHead(403,{'Content-Length':'0','Connection':'close'});r.end();});
 server.on('connection',socket=>{s.connections++;sockets.add(socket);socket.on('data',b=>s.bytes_received=Math.min(104857600,s.bytes_received+b.length));socket.on('close',()=>sockets.delete(socket));socket.setTimeout(3000,()=>socket.destroy());});
 server.on('connect',(_q,socket)=>{s.connect_rejected++;socket.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');});
 server.on('upgrade',(_q,socket)=>{s.upgrade_rejected++;socket.destroy();});
 server.on('clientError',(_e,socket)=>socket.destroy());
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{server.off('error',reject);resolve();});});
 return{url:'http://127.0.0.1:'+server.address().port,disable(){for(const socket of sockets)socket.destroy();},async close(){if(closed)return;closed=true;for(const socket of sockets)socket.destroy();await new Promise(r=>server.close(r));},snapshot(){return{kind:'reject-only-proxy-counts',...s,open_sockets:sockets.size,closed,forwarding_capability:'ABSENT',upstream_sockets_opened:0};}};
}
