// This module has no live entry or live factory; only the fixed no-forward proxy.
import {openGuarded} from '../cdp-startup-diagnostic/fixture-runner.mjs';
import {browserFileHash} from '../ab-observe/config.mjs';
import {FontGateway} from './gateway.mjs';import {fixtureProxy} from './fixture.mjs';
import {USES,DOCUMENT} from './config.mjs';
import {startupPhases} from './record.mjs';
export function browserEnvironment(env=process.env){const out={};for(const k of ['PATH','HOME','LANG','LC_ALL','TMPDIR','CHROME_PATH'])if(typeof env[k]==='string')out[k]=env[k];return out;}
export async function runNative(v,{open=openGuarded,hash=browserFileHash,persist=()=>{}}={}){
 const binary=await hash();if(!/^[a-f0-9]{64}$/.test(binary))throw Error('BINARY');
 let complete=true;for(const c of v.cases){let ctx,proxy,ok=false,startupCleanup;try{
  c.status='STARTED';c.phase='OPEN';persist();
  if(await hash()!==binary)throw Error('BINARY');
  ctx=await open(FontGateway,async()=>proxy=await fixtureProxy(c.mode));ctx.gateway.mode=c.mode;
  if(v.chrome!==null&&v.chrome!==ctx.chrome)throw Error('BINARY');v.chrome??=ctx.chrome;
  c.phase='NAVIGATION';persist();await ctx.page.goto(DOCUMENT,{waitUntil:'load',timeout:15000});
  c.phase='FONTS';persist();await ctx.page.evaluate(async()=>{await Promise.race([document.fonts.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('LOCAL_FONT_TIMEOUT')),5000))]);});
  c.phase='READBACK';persist();const observed=await ctx.page.evaluate(()=>({a:document.querySelectorAll('.a').length,b:document.querySelectorAll('.b').length,ready:document.fonts.status==='loaded',aLoaded:[...document.fonts].some(f=>f.family==='FixtureA'&&f.status==='loaded'),bLoaded:[...document.fonts].some(f=>f.family==='FixtureB'&&f.status==='loaded')}));
  const u=USES[c.mode];if(observed.a!==u.a||observed.b!==u.b||!observed.ready||!observed.aLoaded||u.b&&!observed.bLoaded||ctx.gateway.stats.fatal||!ctx.gateway.stats.html200)throw Error('NATIVE_READBACK');c.render='LOADED_EXPECTED_FACES_AND_DOM';
  const h=proxy.snapshot(),observations=ctx.gateway.events.snapshot();if(h.documents!==1||h.font_a<1||u.b&&h.font_b<1||!u.b&&h.font_b!==0||h.denied||h.overflow||h.socket_errors||h.client_errors||observations.coverage!=='COMPLETE_BOUNDED_WINDOW'||await hash()!==binary)throw Error('NATIVE_RECEIPTS');ok=true;
 }catch(e){startupCleanup=e?.fixed?.cleanup;c.failure_phase=c.phase;if(!ctx)c.startup=startupPhases.includes(e?.fixed?.phase)?e.fixed.phase:'UNKNOWN';c.reason=ctx?.gateway.localReason??'UNKNOWN';ok=false;}
 finally{
  c.phase='CLEANUP';try{persist();}catch{ok=false;}
  try{const r=await ctx?.cleanup();c.cleanup=r?.status==='complete'?'COMPLETE':r?.status==='failed'?'FAILED':startupCleanup==='complete'?'COMPLETE':'UNKNOWN';}catch{c.cleanup='FAILED';}
  c.http=proxy?.snapshot()??null;c.events=ctx?.gateway.events.snapshot()??null;c.abort_ack=ctx?.gateway.abortAck??0;c.continued=ctx?.gateway.continues??0;c.documents=ctx?.gateway.stats.fixture_documents??0;
  if(c.cleanup!=='COMPLETE'||!c.http?.closed||c.http?.open_sockets||c.http?.socket_errors||c.http?.client_errors){ok=false;if(c.failure_phase==='NONE')c.failure_phase='CLEANUP';}
  c.status=ok?'PASSED':'FAILED';c.phase=ok?'COMPLETE':c.phase;persist();
 }
 if(!ok){complete=false;break;}}
 const seen=v.cases.some(c=>c.events&&c.events.duplicate!=='NONE_OBSERVED');v.comparison=seen?'OBSERVED_IN_THIS_CLOSED_CONTROL_ONLY':complete?'NOT_REPRODUCED_IN_THIS_CLOSED_CONTROL':'UNKNOWN_NOT_COMPLETED';v.status=complete?'PASSED':'FAILED_OR_UNKNOWN';persist();return complete;
}
