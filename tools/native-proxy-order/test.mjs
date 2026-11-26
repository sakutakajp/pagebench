import test from 'node:test';import assert from 'node:assert/strict';
import {writeFileSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {observedFixtureNative} from './native.mjs';
import {observedNative} from '../proxy-cleanup-evidence/native.mjs';
import {postFlushOpen} from '../connect-postflush-closed/open.mjs';
import {model} from './model.mjs';
import {createJournal} from '../native-score-proof/state.mjs';
import {evidence} from '../proxy-cleanup-evidence/cleanup-evidence.mjs';
import {install,snapshot as network} from '../connect-postflush-closed/net-guard.mjs';
install();
const S={mode:'GHA_STANDALONE_SIMULATED',sha:'a'.repeat(40),run:'1234',ref:'refs/heads/diag/beacon-api-read-ja-once-20261126',attempt:1};
const rows=[];
async function run(variant,timing='NONE',ack='normal'){
 const m=model({variant,timing,ack}),j=createJournal(S,{write:()=>{}}),d=evidence(S,{write:()=>{}});
 const p=await observedFixtureNative(j,{diagnostics:d,hash:async()=> 'f'.repeat(64),open:m.open});
 const r={variant,timing,ack,status:p.status,continuation:p.continuation,cases:j.snapshot().cases,cleanup:d.snapshot().cases,sequence:m.rows,physical:m.physical};
 rows.push(r);return r;
}
test('closed adapter only changes opener, all inherited verdict/cleanup/policy bytes unchanged',()=>{
 const base='df29ee7204cc6bd82db2f59d5fff4cb124d6cded';
 for(const p of ['tools/natural-reads/browser.mjs','tools/natural-reads/fixture-stop.mjs','tools/natural-reads/policy.mjs','tools/proxy-cleanup-evidence/native.mjs','tools/cdp-startup-diagnostic/cleanup.mjs','tools/nuxt-debug/natural-prefetch-proxy.mjs','tools/connect-postflush-closed/proxy.mjs','tools/connect-postflush-closed/open.mjs'])assert(readFileSync(p).equals(execFileSync('git',['show',base+':'+p])));
 const source=readFileSync('tools/native-proxy-order/native.mjs','utf8');assert(source.includes('open=postFlushOpen'));assert(source.includes('observedNative(j,{diagnostics,hash,open})'));assert.equal(typeof observedNative,'function');assert.equal(typeof postFlushOpen,'function');assert(!/pinnedTunnel|fetch\(|process.env|await import|buildLive|admit/.test(source));
});
for(const variant of['baseline','postflush'])test(variant+' six actual closed case wrappers retain positives/prefetch/POST and no fault',async()=>{
 const r=await run(variant);assert.equal(r.status,'passed');assert.equal(r.cases.length,6);assert(r.cases.every(x=>x.status==='passed'));assert(r.cleanup.every(x=>x.attestation==='CONFIRMED'));assert(r.physical.every(x=>x.process_closed&&x.profile_deleted&&x.wire_closed&&x.proxy_closed&&x.open_sockets===0));
});
for(const timing of['BEFORE_ARM','ACK_PENDING'])for(const variant of['baseline','postflush'])test(variant+' exact unapproved_api wrapper with actual TCP reset '+timing,async()=>{
 for(let iteration=0;iteration<6;iteration++){
 const r=await run(variant,timing),u=r.cases.find(x=>x.case==='unapproved_api'),d=r.cleanup.find(x=>x.case==='unapproved_api'),seq=r.sequence.find(x=>x.case==='unapproved_api');
 assert.equal(u.candidate.reason,'SCOPE');assert.equal(u.candidate.method,'GET');assert.equal(u.candidate.type,'XHR');assert.equal(u.abort_ack,1);assert.equal(u.selected_forward_or_fulfill,0);assert.equal(u.block_confirmed,'TRUE');assert.equal(d.proxy.upstream,0);assert.equal(d.proxy.open_sockets,0);assert.equal(d.proxy.physical_close,'CONFIRMED');assert.equal(seq.after_arm_browser_commands,0);assert(seq.peer_triggered);
 if(variant==='baseline'){
  assert.equal(u.status,'failed');assert.equal(u.cleanup,'failed');assert.equal(d.proxy.socket_errors,1);assert.deepEqual(d.proxy.first_socket_fault,{resource:'ACCEPTED_DOWNSTREAM_PROXY_SOCKET',code:'ECONNRESET',stage:'CONNECT_HANDOFF',lifecycle:'ACTIVE'});assert(r.cases.slice(4).every(x=>x.status==='not_run'));
 }else{assert.equal(u.status,'passed');assert.equal(u.cleanup,'complete');assert.equal(d.proxy.socket_errors,0);assert.equal(d.proxy.first_socket_fault,null);assert.equal(r.status,'passed');assert(seq.trace.indexOf('LOCAL_CLOSE_BEFORE_RESET')<seq.trace.indexOf('PEER_RST_REQUESTED'));}
 if(timing==='ACK_PENDING'){assert(seq.trace.indexOf('ABORT_SENT')<seq.trace.indexOf('PEER_RST_REQUESTED'));assert(seq.trace.indexOf('PEER_RST_REQUESTED')<seq.trace.indexOf('ABORT_ACK_DELIVERED'));}
 }
});
for(const variant of['baseline','postflush'])test(variant+' true reset before CONNECT handoff stays fatal and halts group',async()=>{
 const r=await run(variant,'EARLY'),u=r.cases.find(x=>x.case==='unapproved_api'),d=r.cleanup.find(x=>x.case==='unapproved_api');assert.equal(u.status,'failed');assert.equal(d.proxy.socket_errors,1);assert.equal(d.proxy.first_socket_fault.code,'ECONNRESET');assert.equal(d.proxy.first_socket_fault.stage,'ACCEPTED');assert.equal(u.cleanup,'failed');assert(r.cases.slice(4).every(x=>x.status==='not_run'));
});
test('invalid abort reply never becomes block confirmation with decorated proxy and halts',async()=>{
 const r=await run('postflush','NONE','error'),u=r.cases.find(x=>x.case==='post');assert.equal(u.status,'failed');assert.equal(u.abort_ack,1);assert.equal(u.proof_consistent,'FALSE');assert.equal(u.block_confirmed,'FALSE');assert(r.cases.slice(3).every(x=>x.status==='not_run'));
});
test('fixed proof contains no URLs/request/error data and independently guarded zero egress',()=>{
 const n=network();assert.equal(n.dns_attempts,0);assert.equal(n.blocked_connects,0);assert(n.loopback_connects>0);
 const p={kind:'LOCAL_NATIVE_PROXY_ORDER_PROOF',node:process.version,source:'CONTROLLED_CDP_REAL_LOOPBACK_TCP_REAL_PROCESS_FILES',real_chrome:false,historical_trigger:'UNPROVEN',network:n,score_saved:false,report_saved:false,site_requests:0,rows};const text=JSON.stringify(p);assert(Buffer.byteLength(text)<=1048576);
 for(const x of['https://','http://','fixture.invalid','CONNECT fixed','HTTP/1.1','FIXED_SYNTHETIC_NOT_SAVED','PRIVATE'])assert(!text.includes(x));
 if(process.env.NP_ORDER_PROOF)writeFileSync(process.env.NP_ORDER_PROOF,text+'\n',{mode:0o600});
});
