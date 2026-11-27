// CLOSED TEST ONLY. Fixed responses, no DNS, client socket or forwarding factory.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {USES,ORIGIN,DOCUMENT,FONT_A,FONT_B} from './config.mjs';
export async function assets(){const values=[];for(const [file,length,hash] of [
 ['font-a.ttf',759720,'57f73e11f51999432bf7ab22ce55b6f945d5eca1bf824404cfa9ec2e3718c84e'],
 ['font-b.ttf',380660,'8cb29f7db250ebb2551a6ce2c1e0bfd5a0eb520e9e233370db0493e82e1f36f7']]){
 const v=await readFile(new URL('./assets/'+file,import.meta.url));if(v.length!==length||v.readUInt32BE(0)!==65536||createHash('sha256').update(v).digest('hex')!==hash)throw Error('FONT_ASSET');values.push(v);
}return values;}
export function html(mode){if(!Object.hasOwn(USES,mode))throw Error('CASE');const u=USES[mode],nodes=(c,n)=>Array.from({length:n},()=>'<span class="'+c+'">Font comparison ABC 123</span>').join('');
 return '<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"><title>Local font comparison</title><style>@font-face{font-family:FixtureA;src:url(/font-a.ttf) format("truetype")}'+(u.b?'@font-face{font-family:FixtureB;src:url(/font-b.ttf) format("truetype")}':'')+'.a{font-family:FixtureA}.b{font-family:FixtureB}span{display:block;font-size:24px}</style></head><body>'+nodes('a',u.a)+nodes('b',u.b)+'</body></html>';
}
export async function fixtureProxy(mode){
 const [a,b]=await assets(),body=Buffer.from(html(mode)),sockets=new Set();let enabled=true,closed=false;
 const state={receipts:0,documents:0,font_a:0,font_b:0,denied:0,connect_denied:0,upgrade_denied:0,socket_errors:0,client_errors:0,overflow:false};
 const bump=k=>{if(state[k]>=64){state.overflow=true;return;}state[k]++;};
 const server=http.createServer((q,r)=>{
  bump('receipts');let target=q.url;if(target?.startsWith('/')&&q.headers.host==='127.0.0.1:47500')target=ORIGIN+target;
  const credentials=Object.keys(q.headers).some(k=>/^(cookie|authorization|proxy-authorization|x-api-key|x-goog-api-key)$/i.test(k));
  const label=target===DOCUMENT?'documents':target===FONT_A?'font_a':target===FONT_B&&USES[mode].b?'font_b':null;
  q.resume();if(!enabled||state.overflow||q.method!=='GET'||q.headers.host!=='127.0.0.1:47500'||credentials||!label){bump('denied');r.writeHead(403,{'Content-Length':0,'Connection':'close'});r.end();return;}
  bump(label);const data=label==='documents'?body:label==='font_a'?a:b;
  r.writeHead(200,{'Content-Type':label==='documents'?'text/html':'font/ttf','Content-Length':data.length,'Cache-Control':'no-store','Connection':'close','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"});r.end(data);
 });
 server.maxHeadersCount=32;server.headersTimeout=2000;server.requestTimeout=3000;server.timeout=3000;
 server.on('connection',s=>{sockets.add(s);s.on('error',()=>bump('socket_errors'));s.on('close',()=>sockets.delete(s));});
 server.on('clientError',(_e,s)=>{bump('client_errors');s.destroy();});
 for(const event of ['connect','upgrade'])server.on(event,(_q,s)=>{bump(event+'_denied');s.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');s.destroySoon();});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});server.on('error',()=>{enabled=false;});
 let closing;const snapshot=()=>({...state,closed,open_sockets:sockets.size,upstream_connections:0,forwarding:'ABSENT'});
 return {url:'http://127.0.0.1:'+server.address().port,snapshot,disable(){enabled=false;for(const s of sockets)s.destroy();},close(){return closing??=(async()=>{enabled=false;await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();for(const s of sockets)s.destroy();});closed=true;if(state.socket_errors||state.client_errors||sockets.size)throw Error('PROXY_CLEANUP');})();}};
}
