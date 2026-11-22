import {StopEvidence} from './evidence.mjs';
import {MetadataEvidence} from './metadata.mjs';
// Own every receive Promise at the EventTarget boundary. Never resume after rejection.
export function ownedGateway(Base){return class extends Base{
 constructor(...args){super(...args);const e=this.stopEvidence=new StopEvidence(this);e.meta=new MetadataEvidence(this);const emergency=this.emergency;
  this.emergency=()=>{e.emergency='REQUESTED';e.publish();try{const r=emergency();e.emergency='RETURNED';e.publish();return r;}catch{e.emergency='THREW';e.publish();throw Error('FIXED_EMERGENCY_FAILURE');}};
  const settle=()=>{e.active=Math.max(0,e.active-1);if(e.active===0){this.receiveWaiter?.();this.receiveWaiter=null;}};
  this.wire.onmessage=event=>{
   e.active=Math.min(65535,e.active+1);e.peak=Math.max(e.peak,e.active);
   let task;try{task=Promise.resolve(this.receive(typeof event==='string'?event:event.data));}catch{task=Promise.reject(Error('FIXED_RECEIVE_FAILURE'));}
   task.then(()=>{try{settle();}catch{e.secondaryFailure();}},()=>{
    e.receiver_rejections=Math.min(65535,e.receiver_rejections+1);
    try{if(!this.stopping)this.fail('AB_ASYNC_RECEIVE_FAILED');}catch{e.secondaryFailure();}
    try{settle();e.publish();}catch{e.secondaryFailure();}
   });
   // Deliberately return undefined, never an unowned receive Promise.
  };
 }
 rejectPending(){for(const p of this.pending.values()){clearTimeout(p.timer);try{p.reject(Error('GUARD_STOPPED'));}catch{this.stopEvidence?.secondaryFailure();}}this.pending.clear();}
 fail(code){if(!this.stopping){this.stopEvidence?.fatal(code);this.stopEvidence?.meta.stop();}try{return super.fail(code);}catch{
  // An emergency callback must not prevent pending Promise rejection/settlement.
  this.stopping=true;this.stopEvidence?.secondaryFailure();
  this.rejectPending();
 }}
 beginCleanup(){if(this.stopEvidence){this.stopEvidence.meta.beginCleanup();this.stopEvidence.cleanup='REQUESTED';this.stopEvidence.publish();}try{return super.beginCleanup?.();}catch{this.stopEvidence?.secondaryFailure();}}
 dispose(){try{super.dispose();}catch{this.stopEvidence?.secondaryFailure();}this.stopping=true;this.rejectPending();}
 close(){try{return super.close();}catch{this.stopEvidence?.secondaryFailure();}}
 async settleReceives(ms=1000){if(!this.stopEvidence?.active)return true;let timer;try{return await Promise.race([new Promise(r=>this.receiveWaiter=()=>r(true)),new Promise(r=>timer=setTimeout(()=>r(false),Math.min(1000,ms)))]);}finally{clearTimeout(timer);this.receiveWaiter=null;}}
};}
