// CONTROLLED CDP/LHR only; real local process, profile and proxy cleanup.
// Imported only by tests. No browser, remote DNS or forwarding.
import {control,BINARY,CHROME} from '../standalone-score/control.mjs';
import {measure} from './measure.mjs';
import {TARGET} from '../natural-reads/policy.mjs';
export {BINARY,CHROME};
export const SCRIPT='https://static.cloudflareinsights.com/static/fixed-script.js';
export function controlled(mode='cf_script'){
 const c=control();
 const emit=(method,params)=>c.g.wire.onmessage({data:JSON.stringify({method,params,sessionId:'P'})});
 const drain=async()=>{for(let i=0;i<16;i++)await new Promise(r=>setImmediate(r));};
 return{...c,get g(){return c.g},get context(){return c.context},get counts(){return c.counts},async open(G,f){const out=await c.open(G,f),evaluate=out.page.evaluate;out.page.evaluate=async(fn,arg)=>fn.name==='cfReady'?out.gateway.cfReads===1:evaluate(fn,arg);return out;},async lighthouse(...args){const result=await c.lighthouse(...args);const url=mode==='cf_image_denied'?'https://static.cloudflareinsights.com/static/fixed-image.png':mode==='beacon'?'https://static.cloudflareinsights.com/beacon.min.js':mode==='unapproved'?'https://fixed-unapproved.invalid/static/fixed.js':SCRIPT,type=mode==='cf_image_denied'?'Image':'Script',request={url,method:'GET',headers:{}},g=c.g;
 emit('Network.requestWillBeSent',{requestId:'CF',frameId:'F',loaderId:'L',documentURL:TARGET,type,request,initiator:{type:'parser',url:TARGET}});
 emit('Fetch.requestPaused',{requestId:'CF_FETCH',networkId:'CF',frameId:'F',resourceType:type,request});await drain();
 if(g.stopping||g.stats.fatal)throw Error('CONTROLLED_STOP');
 emit('Network.responseReceived',{requestId:'CF',type,response:{url,status:200,mimeType:'text/javascript',headers:{'content-type':'text/javascript'}}});emit('Network.loadingFinished',{requestId:'CF'});await drain();return result;
 }};
}
