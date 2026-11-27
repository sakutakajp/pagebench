// Injects only an observing opener; Slot44 runner/gateway/proxy/verdict unchanged.
import {runNative} from '../font-http-closed/native.mjs';import {openGuarded} from '../cdp-startup-diagnostic/fixture-runner.mjs';
import {observedFactory,auditOf} from './audit.mjs';
export async function distinctPort(p,port){if(new URL(p.url).port===port){await p.close();throw Error('SEPARATE_PORT_REQUIRED');}}
export async function observedNative(v,port,{open=openGuarded,run=runNative,hash,persist=()=>{}}={}){
 const handles=new Map();const refresh=()=>{for(const [m,p]of handles)v.audits.find(a=>a.mode===m).audit=auditOf(p)?.snapshot()??null;};
 const mode=()=>v.native.cases.find(c=>c.status==='STARTED')?.mode;
 try{return await run(v.native,{...(hash?{hash}:{}),persist:()=>{refresh();persist();},open:async(G,factory)=>{
  const m=mode();let proxy;
  try{return await open(G,async()=>{proxy=await observedFactory(factory,m);handles.set(m,proxy);await distinctPort(proxy,port);v.separation='DISTINCT_PORT_AND_INSTANCE_CONFIRMED';v.audits.find(a=>a.mode===m).state='ATTACHED';refresh();persist();return proxy;});}
  finally{refresh();}
 }});}finally{refresh();persist();}
}
