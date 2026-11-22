import {writeFileSync,renameSync,readFileSync,lstatSync,realpathSync} from 'node:fs';import {resolve,basename,join} from 'node:path';
import {safeEvidence} from './evidence.mjs';
import {publicResult} from '../ab-observe/runner.mjs';
export async function awaitStart(){let timer;try{await new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(Error('START_NOT_GRANTED')),5000);process.once('message',m=>m?.kind==='nuxt-debug-start'?resolve():reject(Error('START_NOT_GRANTED')));});}finally{clearTimeout(timer);}}
export function safeArm(v,sha){if(!v||v.mode!=='A')return null;return publicResult({attempts:[v]},sha).attempts[0]??null;}
export function writer(directory,send=process.send?.bind(process)){
 const dir=resolve(directory),stat=lstatSync(dir);if(!basename(dir).startsWith('pagebench-nuxt-child-')||!stat.isDirectory()||stat.isSymbolicLink()||realpathSync(dir)!==dir||(stat.mode&0o077)!==0)throw Error('PRIVATE_JOURNAL_REQUIRED');
 let seq=0,last=null,critical=null,regular=0,extra=0;
 return raw=>{const evidence=safeEvidence(raw);if(!evidence)return;const json=JSON.stringify(evidence);if(json===last)return;const next=JSON.stringify([evidence.first_fatal,evidence.first_refusal,evidence.cleanup,evidence.emergency]);
  if(regular>=64){if(next===critical||extra>=12)return;extra++;}else regular++;
  last=json;critical=next;const packet={kind:'nuxt-debug-journal',seq:++seq,evidence};const text=JSON.stringify(packet);if(text.length>8192)throw Error('JOURNAL_LIMIT');
  let durable=false;try{writeFileSync(join(dir,'journal.tmp'),text,{mode:0o600});renameSync(join(dir,'journal.tmp'),join(dir,'journal.json'));durable=true;}catch{}
  let sent=false;try{send?.({...packet,durable},()=>{});sent=!!send;}catch{}
  if(!durable&&!sent)throw Error('JOURNAL_UNAVAILABLE');
 };
}
export function readJournal(directory){try{const b=readFileSync(join(directory,'journal.json'));if(b.length>8192)return null;return safePacket(JSON.parse(b.toString()));}catch{return null;}}
export function safePacket(v){if(v?.kind!=='nuxt-debug-journal'||!Number.isInteger(v.seq)||v.seq<1||v.seq>76)return null;const evidence=safeEvidence(v.evidence);return evidence?{kind:'nuxt-debug-journal',seq:v.seq,evidence}:null;}
