// CLOSED fixture only. This is never installed in a live page or runner.
export const NEGATIVE_ARM_DELAY_MS=250,NEGATIVE_STOP_WAIT_MS=2000;
export function armNegativeFixture(){return typeof window.fixedArmNegative==='function'?window.fixedArmNegative():null;}
export function validArmAck(v){return v?.state==='ARMED'&&v.scheduled===true&&Object.keys(v).sort().join(',')==='scheduled,state';}
export function negativeFlowComplete(v,proof){return v?.initial_navigation==='COMPLETED'&&v.initial_visible===true&&v.arm_reply==='ACKNOWLEDGED'&&v.stop_wait==='STOP_OBSERVED'&&proof?.arm_scope_bound===true&&proof.first_candidate?.phase==='WAIT_STOP'&&proof.first_fatal_phase==='WAIT_STOP';}
export async function waitForFixtureStop(g,{pause=ms=>new Promise(r=>setTimeout(r,ms)),now=Date.now}={}){
 const until=now()+NEGATIVE_STOP_WAIT_MS;for(let n=0;n<=100;n++){if(g.stopping)return'STOP_OBSERVED';if(now()>=until||n===100)return'STOP_WAIT_TIMEOUT';await pause(20);}return'STOP_WAIT_TIMEOUT';
}
