// CLOSED TEST ONLY. Decorate the exact inherited factory, preserving its returned
// object and caller's captured reference. Never used by a live transport.
import http from 'node:http';
const owned=new WeakSet(),states=new WeakMap();let constructing=false;
export function proxyState(p){return states.has(p)?{...states.get(p)}:null;}
export async function postFlushProxy(factory){
 if(constructing||typeof factory!=='function')throw Error('CLOSED_PROXY_FACTORY');
 const original=http.createServer,servers=[];let pending,hook,constructionFailed=false;
 constructing=true;http.createServer=function(...args){const s=Reflect.apply(original,this,args);servers.push(s);return s;};
 try{pending=factory();}catch{constructionFailed=true;}finally{http.createServer=original;constructing=false;}
 const state={connect_handoffs:0,response_end_observed:0,post_flush_close_requested:0,invalid_handoffs:0};
 const bump=k=>state[k]=Math.min(65535,state[k]+1);
 if(!constructionFailed&&servers.length===1&&servers[0].listenerCount('connect')===1){
  hook=(_request,socket)=>{bump('connect_handoffs');if(socket.writableEnded!==true){bump('invalid_handoffs');socket.emit('error',Object.assign(Error('CLOSED_HANDOFF_STATE'),{code:'OTHER_OR_UNKNOWN'}));socket.destroy();return;}bump('response_end_observed');bump('post_flush_close_requested');socket.destroySoon();};
  servers[0].on('connect',hook);
 }
 let p;try{p=await pending;}catch{throw Error('CLOSED_PROXY_FACTORY');}
 const snapshot=p?.snapshot?.();
 if(!hook||snapshot?.forwarding_capability!=='ABSENT'||snapshot.upstream_sockets_opened!==0||typeof p?.enable==='function'){
  try{p?.disable?.();await p?.close?.();}catch{}throw Error('CLOSED_PROXY_FACTORY');
 }
 owned.add(p);states.set(p,state);return p;
}
export const isPostFlushProxy=p=>owned.has(p);
