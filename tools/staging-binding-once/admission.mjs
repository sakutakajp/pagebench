import{validBeaconProof}from'./beacon-native.mjs';
// Same closed predicates as the published parent; only exact one-use identity changes.
import {readFileSync,writeFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {plainData} from '../native-score-proof/case-project.mjs';
import {readReceipt,safeReceipt} from './records.mjs';
import {BASE,REF,SUBJECT,WORKFLOW,UNIT_FILE,NODE24_TESTS,NODE22_TESTS,scope} from './config.mjs';
import {unitValid} from '../rejected-paths-chrome/unit-contract.mjs';import {newUnitsValid as fsUnitsValid} from '../rejected-paths-filesystem/admission.mjs';import {publicUnitsValid,topUnitsValid} from '../entry-recovery/prior-unit-contract.mjs';
import {ownUnitsValid as priorAdmissionUnitsValid} from '../admission-evidence/admission.mjs';
import {ownUnitsValid as proxyUnitsValid} from '../proxy-cleanup-evidence/admission.mjs';
import {readJournal,safeJournal} from '../native-score-proof/state.mjs';import {readEvidence,safeEvidence} from '../proxy-cleanup-evidence/cleanup-evidence.mjs';import {validCounterparts} from '../standalone-score/closed.mjs';import {browserFileHash} from '../ab-observe/config.mjs';
import {unitsValid,historyValid} from '../native-score-proof/admission.mjs';
import {ownUnitsValid as standaloneUnitsValid} from '../standalone-score/admission.mjs';
import {validOwnerProof} from '../script-owner/native.mjs';
import {ownUnitsValid as priorStorageUnitsValid} from '../script-owner-storage/admission.mjs';
import {ownUnitsValid as ownerUnitsValid} from '../script-owner/admission.mjs';
import {storageHistoryValid} from './storage-history.mjs';
import {validCFProof} from './native.mjs';
let readyGrant=null;
const read=p=>JSON.parse(readFileSync(p)),git=(...a)=>execFileSync('git',a,{encoding:'utf8',maxBuffer:1048576,stdio:['ignore','pipe','pipe']}).trim();
const digest=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
export const eventValid=e=>e.repo==='sakutakajp/pagebench'&&e.ref===REF&&e.attempt==='1'&&e.event==='push'&&e.created===true&&e.forced===false&&e.deleted===false&&e.parent===BASE&&e.count===1&&e.subject===SUBJECT&&/^[a-f0-9]{40}$/.test(e.sha||'')&&e.sha===e.head&&e.sha===e.eventHead;
export const unique=(v,s)=>v?.total_count===1&&v.workflow_runs?.length===1&&String(v.workflow_runs[0].id)===s.run&&v.workflow_runs[0].head_sha===s.sha&&v.workflow_runs[0].event==='push'&&v.workflow_runs[0].run_attempt===1&&[WORKFLOW,WORKFLOW+'@'+REF,WORKFLOW+'@'+REF.slice(11)].includes(v.workflow_runs[0].path);
const verdict=(actual,expected)=>actual===undefined?'UNKNOWN':actual===expected?'PASS':'FAIL';
export function eventDetails(e){return{repo:verdict(e.repo,'sakutakajp/pagebench'),ref:verdict(e.ref,REF),attempt:verdict(e.attempt,'1'),event:verdict(e.event,'push'),created:verdict(e.created,true),forced:verdict(e.forced,false),deleted:verdict(e.deleted,false),parent:verdict(e.parent,BASE),count:verdict(e.count,1),subject:verdict(e.subject,SUBJECT),sha_format:typeof e.sha==='string'&&/^[a-f0-9]{40}$/.test(e.sha)?'PASS':'FAIL',head:verdict(e.head,e.sha),event_head:verdict(e.eventHead,e.sha)};}
export function apiDetails(v,s){const r=v?.workflow_runs?.[0];return{total:verdict(v?.total_count,1),rows:verdict(v?.workflow_runs?.length,1),run_id:r?.id===undefined?'UNKNOWN':verdict(String(r.id),s.run),sha:verdict(r?.head_sha,s.sha),event:verdict(r?.event,'push'),attempt:verdict(r?.run_attempt,1),path:r?.path===undefined?'UNKNOWN':[WORKFLOW,WORKFLOW+'@'+REF,WORKFLOW+'@'+REF.slice(11)].includes(r.path)?'PASS':'FAIL'};}
export function ownUnitsValid(v,sha){return v?.kind==='STAGING_BINDING_ONCE_UNIT_PROOF'&&v.sha===sha&&v.status==='passed'&&v.groups?.length===2&&v.groups.every((g,i)=>JSON.stringify(g)===JSON.stringify({node:['v24.19.0','v22.19.0'][i],tests:[NODE24_TESTS,NODE22_TESTS][i],pass:[NODE24_TESTS,NODE22_TESTS][i],fail:0,skipped:0,cancelled:0,todo:0,status:'passed'}));}
export async function admitClosed({live=false,consume=false,fetcher=()=>{throw Error('FIXED_RUN')},record,env=process.env,nodeVersion=process.version,hash=browserFileHash,loadJournal=readJournal,loadEvidence=readEvidence,loadReceipt=readReceipt,io={read,git,digest,write:(p,v)=>writeFileSync(p,JSON.stringify(v),{flag:'wx',mode:0o600})}}={}){
 if(live)readyGrant=null;
 if(!record)throw Error('FIXED_ARGS');
 const check=async(stage,fn)=>{record.begin(stage);const value=await fn();record.pass(stage);return value;};
 try{
 const s=await check('SCOPE',()=>scope(env));
 const e=await check('EVENT_READ',()=>io.read(env.GITHUB_EVENT_PATH));
 await check('RUNTIME',()=>{if(nodeVersion!=='v22.19.0'||(live||consume)&&env.CHROME_PATH!=='/opt/google/chrome/chrome')throw Error('FIXED_EVENT');});
 const g=await check('GIT_IDENTITY',()=>({parent:io.git('rev-parse','HEAD^'),count:Number(io.git('rev-list','--count',BASE+'..HEAD')),subject:io.git('show','-s','--format=%s'),head:io.git('rev-parse','HEAD')}));
 record.begin('EVENT');const ev={repo:env.GITHUB_REPOSITORY,ref:env.GITHUB_REF,event:env.GITHUB_EVENT_NAME,attempt:env.GITHUB_RUN_ATTEMPT,created:e.created,forced:e.forced,deleted:e.deleted,...g,sha:s.sha,eventHead:e.head_commit?.id};record.details('event',eventDetails(ev));
 await check('EVENT',()=>{if(!eventValid(ev))throw Error('FIXED_EVENT');});
 await check('CLEAN_TREE',()=>io.git('diff','--quiet','HEAD','--'));
 const pins=await check('PINS_READ',()=>io.read('tools/staging-binding-once/source-pins.json'));
 await check('PINS_HASH',()=>{if(pins.parent!==BASE||Object.entries(pins.files).some(([p,h])=>io.digest(p)!==h))throw Error('FIXED_SOURCE');});
 const paths=await check('PATHS_READ',()=>io.read('tools/staging-binding-once/added-paths.json'));
 await check('PATHS_MATCH',()=>{const actual=io.git('diff','--name-status',BASE,'HEAD').split('\n').map(x=>x.split('\t'));if(actual.length!==paths.length||actual.some(([a,p])=>a!=='A'||!paths.includes(p)))throw Error('FIXED_SOURCE');});
 const tests=[['UNIT_CHROME',()=>unitValid(io.read('rejected-paths-unit-proof.json'),s.sha,io.read('tools/rejected-paths-chrome/unit-inventory.json'))],['UNIT_FILESYSTEM',()=>fsUnitsValid(io.read('rejected-paths-filesystem-units.json'),s.sha)],['UNIT_PUBLIC',()=>publicUnitsValid(io.read('public-rejection-units.json'),s.sha)],['UNIT_TOP',()=>topUnitsValid(io.read('public-top-units.json'),s.sha)],['UNIT_NATIVE',()=>unitsValid(io.read('native-score-units.json'),s.sha)],['UNIT_HISTORY',()=>historyValid(io.read('native-score-history.json'))],['UNIT_ADMISSION',()=>priorAdmissionUnitsValid(io.read('admission-evidence-units.json'),s.sha)],['UNIT_PROXY',()=>proxyUnitsValid(io.read('proxy-cleanup-evidence-units.json'),s.sha)],['UNIT_STANDALONE',()=>standaloneUnitsValid(io.read('standalone-score-units.json'),s.sha)&&ownerUnitsValid(io.read('script-owner-units.json'),s.sha)&&priorStorageUnitsValid(io.read('script-owner-storage-units.json'),s.sha)&&storageHistoryValid(io.read('staging-selected-storage-history.json'),s.sha)&&ownUnitsValid(io.read(UNIT_FILE),s.sha)]];
 for(const [stage,valid]of tests)await check(stage,()=>{if(!valid())throw Error('FIXED_UNITS');});
 let binary=null,chrome=null;let closed=null;
 await check('CLOSED_RECEIPTS',()=>{if(live){for(const m of ['PRECHECK','JIT']){const r=loadReceipt(m,s);if(!safeReceipt(r,s,m)||r?.status!=='ADMITTED'||r.exit_code!==0||r.recording!=='COMPLETE_PREFIX')throw Error('FIXED_CLOSED_PROOF');}if(JSON.stringify(io.read('staging-binding-once-closed-attempt.json'))!==JSON.stringify(s))throw Error('FIXED_CLOSED_PROOF');}});
 await check('CLOSED_NATIVE',()=>{if(!live)return;const j=loadJournal(s),e=loadEvidence(s);if(!safeJournal(j,s)||!safeEvidence(e,s)||!j||j.stage_status!=='PASSED'||j.recording!=='COMPLETE_PREFIX'||j.score?.status!=='PASSED'||j.budget?.status!=='passed'||j.native_status!=='passed'||j.cases.some(c=>c.status!=='passed')||!e||e.recording!=='COMPLETE_PREFIX'||e.cases.some(c=>c.attestation!=='CONFIRMED'))throw Error('FIXED_CLOSED_PROOF');chrome=j.score.chrome;closed=io.read('standalone-counterparts.json');});
 await check('CLOSED_BINARY',async()=>{if(live){binary=await hash();if(closed?.binary!==binary||closed?.chrome!==chrome)throw Error('FIXED_CLOSED_PROOF');}});
 await check('CLOSED_COUNTERPART',()=>{if(live&&(!validCounterparts(closed,s,binary,chrome)||!validOwnerProof(io.read('script-owner-native.json'),s,binary,chrome)||!validCFProof(io.read('cloudflare-native.json'),s,binary,chrome)||!validBeaconProof(io.read('beacon-native.json'),s,binary,chrome)))throw Error('FIXED_CLOSED_PROOF');});
 const r=await check('API_TRANSPORT',()=>fetcher('https://api.github.com/repos/sakutakajp/pagebench/actions/runs?head_sha='+s.sha+'&event=push&per_page=100',{method:'GET',redirect:'error',headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(10000)}));
 record.http(r);await check('API_HTTP',()=>{if(!r.ok)throw Error('FIXED_RUN');if(Number(r.headers.get('content-length')||0)>262144)throw Error('FIXED_API_SIZE');});
 const v=await check('API_JSON',async()=>{let n=0,chunks=[];for await(const b of r.body){n+=b.length;if(n>262144)throw Error('FIXED_API_SIZE');chunks.push(b);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));});
 await check('API_METADATA',()=>{record.details('api',apiDetails(v,s));if(!unique(v,s))throw Error('FIXED_RUN');});
 await check('CONSUME',()=>{if(live){const grant={...s,binary,chrome};if(consume)io.write('staging-binding-once-live-attempt.json',grant);else if(JSON.stringify(io.read('staging-binding-once-live-attempt.json'))!==JSON.stringify(grant))throw Error('FIXED_RUN');}else if(consume)io.write('staging-binding-once-closed-attempt.json',s);});
 record.admitted();const grant=live?{...s,binary,chrome}:s;if(live&&consume)readyGrant=Object.freeze(grant);return grant;
 }catch(error){record.reject(error);throw error;}
}

// Private process-local capability: only successful consuming LIVE admission may
// authorize the immediately following factory, once. No old monitor/import runs.
export async function admit(options={}){
 if(options.live&&!options.consume){const g=readyGrant;readyGrant=null;if(!g||process.version!=='v22.19.0'||process.env.CHROME_PATH!=='/opt/google/chrome/chrome'||!validStartGrant(g,scope(),read('staging-binding-once-live-attempt.json'),await (options.hash??browserFileHash)()))throw Error('FIXED_RUN');return g;}
 const {createReceipt}=await import('./records.mjs');return admitClosed({...options,record:options.record??createReceipt(options.live?'LIVE':options.consume?'JIT':'PRECHECK')});
}

export function validStartGrant(g,s,marker,binary){try{return plainData(g)&&plainData(s)&&plainData(marker)&&Object.keys(g).sort().join(',')==='attempt,binary,chrome,mode,ref,run,sha'&&JSON.stringify(scope({GITHUB_ACTIONS:'true',GITHUB_REF:s.ref,GITHUB_SHA:s.sha,GITHUB_RUN_ID:s.run,GITHUB_RUN_ATTEMPT:String(s.attempt)}))===JSON.stringify(s)&&JSON.stringify(s)===JSON.stringify({mode:g.mode,sha:g.sha,run:g.run,ref:g.ref,attempt:g.attempt})&&/^([a-f0-9]{64})$/.test(binary)&&g.binary===binary&&/^(Chrome|HeadlessChrome)\/\d+\.\d+\.\d+\.\d+$/.test(g.chrome)&&JSON.stringify(marker)===JSON.stringify(g);}catch{return false;}}
