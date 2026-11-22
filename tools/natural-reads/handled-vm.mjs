// Original runner + same managed capture/core + memory gateway, controlled CDP/VM only.
import{readFile}from'node:fs/promises';import{AsyncLocalStorage}from'node:async_hooks';import{runHandledCore}from'./handled-runtime.mjs';import{closedHandledGateway,HANDLED_CASES}from'./handled-closed.mjs';import{handledRecord}from'./handled-record.mjs';
const storage=new AsyncLocalStorage(),url=new URL('./driver-double.mjs',import.meta.url),original=await readFile(url,'utf8');
export async function controlledHandledCore(options){const s=storage.getStore();if(!s)throw Error('CLOSED_OWNER');return runHandledCore({Gateway:closedHandledGateway(s.mode),open:options.open,proxyFactory:()=>{},fixture:true,windowMs:1,onProgress:options.onProgress,persist:s.persist});}
export async function runHandledVM(mode,{onProgress=()=>{},persist=()=>{}}={}){if(!HANDLED_CASES.includes(mode))throw Error('CLOSED_MODE');let source=original;const once=(a,b)=>{if(source.split(a).length!==2)throw Error('FIXED_VM_SOURCE');source=source.replace(a,b);};
 once("ended=false;","ended=false,mounted=mode!=='pre_registration_cap';");
 once("import {observeNaturalReads} from './runner.mjs'","import {controlledHandledCore as observeNaturalReads} from '"+new URL('./handled-vm.mjs',import.meta.url).href+"'");
 once("['handled500','handled500_console'].includes(mode)","mode==='app500_cap'");
 once("const root={get __vue_app__(){return", "const root={get __vue_app__(){if(mode==='not_ready_cap'||mode==='pre_registration_cap'&&!mounted)return null;return");
 once("innerText:errorMode?'500':'Fixed ordinary visible home body longer than twenty characters.'", "innerText:'Fixed ordinary visible home body longer than twenty characters.'");
 once("ctx=vm.createContext({document:doc,","const ticks=[];ctx=vm.createContext({console:{debug:value=>event('Runtime.consoleAPICalled',{type:'debug',executionContextId:8,args:[{type:'string',value}]})},document:doc,");
 once('setInterval:()=>1','setInterval:fn=>{ticks.push(fn);return ticks.length;}');
 once("if(m.method==='Fetch.continueRequest')counts.continues++;", "if(m.method==='Fetch.fulfillRequest')counts.continues++;");
 once("if(m.method==='Fetch.continueRequest')queueMicrotask", "if(m.method==='Fetch.fulfillRequest'&&e.requestId==='DOC')queueMicrotask");
 const begin=" if(errorMode){const e=";once(begin," if(mode==='pre_registration_cap'){const early=vm.runInContext('Object.assign(new TypeError(\"NEVER_SAVE\"),{statusCode:500})',ctx);hooks.get('app:error')?.(early);mounted=true;for(const tick of ticks)tick();}\n if(mode==='owner_loss_cap'){app={payload:{error:null},hook:app.hook};for(const tick of ticks)tick();}\n if(errorMode){const e=");
 const tail=" if(mode!=='missing_fcp')event('Page.lifecycleEvent'";const at=source.indexOf(tail),end=source.indexOf("}},async cleanup()",at);if(at<0||end<0)throw Error('FIXED_VM_LAYOUT');source=source.slice(0,at)+" for(let i=0;i<240;i++)event('Fetch.requestPaused',{requestId:'CAP'+i,networkId:'CAP'+i,frameId:'F',resourceType:'Fetch',request:{url:'https://staging.hirameki.dev/_nuxt/fixed-handled-'+i+'.js',method:'GET',headers:{}}});await new Promise(r=>setImmediate(r));"+source.slice(end);
 source=source.replace(/from '(\.\/[^']+)'/g,(_,p)=>"from '"+new URL(p,url).href+"'");
 const{runDriverDouble}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const r=await storage.run({mode,persist},()=>runDriverDouble(mode,{onProgress}));const result=r.result;const transport={kind:'CLOSED_ABSENT',forwarding:'ABSENT',upstream:0,open_sockets:0,closed:true};
 return handledRecord(result,transport,{case:mode,initial_visible:true,arm_ack:true,console_error_count:0,pageerror_count:0,hook_ready_at_arm:mode!=='not_ready_cap',pre_registration_dispatch:mode==='pre_registration_cap'});
}
