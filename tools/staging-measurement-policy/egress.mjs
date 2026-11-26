// Identical pinned DNS / CONNECT behavior with only one extra exact443 host.
import http from'node:http';import net from'node:net';import{lookup as defaultLookup}from'node:dns/promises';
import {PUBLIC_HOSTS} from './registry.mjs';export {PUBLIC_HOSTS} from './registry.mjs';
import {publicIPv4} from '../cdp-startup-diagnostic/staging-egress.mjs';
async function deadline(promise){let t;try{return await Promise.race([promise,new Promise((_,reject)=>t=setTimeout(()=>reject(Error('DNS_TIMEOUT')),5000))]);}finally{clearTimeout(t);}}
export async function pinnedTunnel({lookup=defaultLookup,connect=options=>net.connect(options),onFatal=()=>{}}={}){
 const pinned=new Map();for(const host of PUBLIC_HOSTS){let records;try{records=await deadline(lookup(host,{all:true,family:4,verbatim:true}));}catch{throw Error('DNS_LOOKUP_FAILED');}if(!Array.isArray(records)||!records.length||records.length>16||records.some(r=>r.family!==4||!publicIPv4(r.address)))throw Error('DNS_NONPUBLIC_OR_INVALID');pinned.set(host,records[0].address);}
 let enabled=false,admissions=0;const sockets=new Set(),stats={resolved_hosts:pinned.size,connect_attempts:0,forwarded_connections:0,blocked_connects:0,connect_errors:0,fatal:null};
 const disable=()=>{enabled=false;for(const s of sockets)s.destroy();};
 const fail=code=>{stats.fatal??=code;disable();onFatal(code);};
 const server=http.createServer((_q,r)=>{r.writeHead(403);r.end();});server.on('connection',s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));s.on('error',()=>{});});
 server.on('connect',(req,client,head)=>{
  stats.connect_attempts++;const host=PUBLIC_HOSTS.find(h=>req.url===h+':443');if(!enabled||!host){stats.blocked_connects++;client.destroy();return;}
  if(++admissions>32){fail('CONNECT_LIMIT');return;}
  let upstream;try{upstream=connect({host:pinned.get(host),port:443,family:4});}catch{stats.connect_errors++;fail('CONNECT_FAILED');return;}
  sockets.add(upstream);upstream.on('close',()=>sockets.delete(upstream));const timer=setTimeout(()=>{stats.connect_errors++;fail('CONNECT_TIMEOUT');},8000);
  upstream.on('connect',()=>{clearTimeout(timer);if(!enabled){upstream.destroy();return;}stats.forwarded_connections++;client.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head.length)upstream.write(head);upstream.pipe(client);client.pipe(upstream);});
  upstream.on('error',()=>{clearTimeout(timer);if(!enabled)return;stats.connect_errors++;fail('CONNECT_FAILED');});upstream.on('close',()=>clearTimeout(timer));client.on('error',()=>upstream.destroy());
 });server.on('upgrade',(_q,s)=>s.destroy());await new Promise(r=>server.listen(0,'127.0.0.1',r));
 return {url:'http://127.0.0.1:'+server.address().port,stats,enable:g=>{if(stats.fatal||g.memory||g.documentURL!=='https://staging.hirameki.dev/ja/'||!g.released||g.stats.fatal||!g.sessions.get(g.primary)?.ready)throw Error('GUARD_REQUIRED');enabled=true;},disable,close:async()=>{disable();await new Promise(r=>server.close(r));}};
}
