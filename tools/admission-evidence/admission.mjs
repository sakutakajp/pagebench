// Same closed predicates as the published parent; only exact one-use identity changes.
import {readFileSync,writeFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {BASE,REF,SUBJECT,WORKFLOW,UNIT_FILE,UNIT_COUNT,scope} from './config.mjs';
import {unitValid} from '../rejected-paths-chrome/unit-contract.mjs';import {newUnitsValid as fsUnitsValid} from '../rejected-paths-filesystem/admission.mjs';import {publicUnitsValid,topUnitsValid} from '../entry-recovery/prior-unit-contract.mjs';
import {unitsValid,historyValid} from '../native-score-proof/admission.mjs';
const read=p=>JSON.parse(readFileSync(p)),git=(...a)=>execFileSync('git',a,{encoding:'utf8',maxBuffer:1048576,stdio:['ignore','pipe','pipe']}).trim();
const digest=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
export const eventValid=e=>e.repo==='sakutakajp/pagebench'&&e.ref===REF&&e.attempt==='1'&&e.event==='push'&&e.created===true&&e.forced===false&&e.deleted===false&&e.parent===BASE&&e.count===1&&e.subject===SUBJECT&&/^[a-f0-9]{40}$/.test(e.sha||'')&&e.sha===e.head&&e.sha===e.eventHead;
export const unique=(v,s)=>v?.total_count===1&&v.workflow_runs?.length===1&&String(v.workflow_runs[0].id)===s.run&&v.workflow_runs[0].head_sha===s.sha&&v.workflow_runs[0].event==='push'&&v.workflow_runs[0].run_attempt===1&&[WORKFLOW,WORKFLOW+'@'+REF,WORKFLOW+'@'+REF.slice(11)].includes(v.workflow_runs[0].path);
const verdict=(actual,expected)=>actual===undefined?'UNKNOWN':actual===expected?'PASS':'FAIL';
export function eventDetails(e){return{repo:verdict(e.repo,'sakutakajp/pagebench'),ref:verdict(e.ref,REF),attempt:verdict(e.attempt,'1'),event:verdict(e.event,'push'),created:verdict(e.created,true),forced:verdict(e.forced,false),deleted:verdict(e.deleted,false),parent:verdict(e.parent,BASE),count:verdict(e.count,1),subject:verdict(e.subject,SUBJECT),sha_format:typeof e.sha==='string'&&/^[a-f0-9]{40}$/.test(e.sha)?'PASS':'FAIL',head:verdict(e.head,e.sha),event_head:verdict(e.eventHead,e.sha)};}
export function apiDetails(v,s){const r=v?.workflow_runs?.[0];return{total:verdict(v?.total_count,1),rows:verdict(v?.workflow_runs?.length,1),run_id:r?.id===undefined?'UNKNOWN':verdict(String(r.id),s.run),sha:verdict(r?.head_sha,s.sha),event:verdict(r?.event,'push'),attempt:verdict(r?.run_attempt,1),path:r?.path===undefined?'UNKNOWN':[WORKFLOW,WORKFLOW+'@'+REF,WORKFLOW+'@'+REF.slice(11)].includes(r.path)?'PASS':'FAIL'};}
export function ownUnitsValid(v,sha){return v?.kind==='ADMISSION_EVIDENCE_UNIT_PROOF'&&v.sha===sha&&v.status==='passed'&&v.groups?.length===2&&v.groups.every((g,i)=>JSON.stringify(g)===JSON.stringify({node:['v24.19.0','v22.19.0'][i],tests:UNIT_COUNT,pass:UNIT_COUNT,fail:0,skipped:0,cancelled:0,todo:0,status:'passed'}));}
export async function admitClosed({consume=false,fetcher=fetch,record,env=process.env,nodeVersion=process.version,io={read,git,digest,write:(p,v)=>writeFileSync(p,JSON.stringify(v),{flag:'wx',mode:0o600})}}={}){
 if(!record)throw Error('FIXED_ARGS');
 const check=async(stage,fn)=>{record.begin(stage);const value=await fn();record.pass(stage);return value;};
 try{
 const s=await check('SCOPE',()=>scope(env));
 const e=await check('EVENT_READ',()=>io.read(env.GITHUB_EVENT_PATH));
 await check('RUNTIME',()=>{if(nodeVersion!=='v22.19.0')throw Error('FIXED_EVENT');});
 const g=await check('GIT_IDENTITY',()=>({parent:io.git('rev-parse','HEAD^'),count:Number(io.git('rev-list','--count',BASE+'..HEAD')),subject:io.git('show','-s','--format=%s'),head:io.git('rev-parse','HEAD')}));
 record.begin('EVENT');const ev={repo:env.GITHUB_REPOSITORY,ref:env.GITHUB_REF,event:env.GITHUB_EVENT_NAME,attempt:env.GITHUB_RUN_ATTEMPT,created:e.created,forced:e.forced,deleted:e.deleted,...g,sha:s.sha,eventHead:e.head_commit?.id};record.details('event',eventDetails(ev));
 await check('EVENT',()=>{if(!eventValid(ev))throw Error('FIXED_EVENT');});
 await check('CLEAN_TREE',()=>io.git('diff','--quiet','HEAD','--'));
 const pins=await check('PINS_READ',()=>io.read('tools/admission-evidence/source-pins.json'));
 await check('PINS_HASH',()=>{if(pins.parent!==BASE||Object.entries(pins.files).some(([p,h])=>io.digest(p)!==h))throw Error('FIXED_SOURCE');});
 const paths=await check('PATHS_READ',()=>io.read('tools/admission-evidence/added-paths.json'));
 await check('PATHS_MATCH',()=>{const actual=io.git('diff','--name-status',BASE,'HEAD').split('\n').map(x=>x.split('\t'));if(actual.length!==paths.length||actual.some(([a,p])=>a!=='A'||!paths.includes(p)))throw Error('FIXED_SOURCE');});
 const tests=[['UNIT_CHROME',()=>unitValid(io.read('rejected-paths-unit-proof.json'),s.sha,io.read('tools/rejected-paths-chrome/unit-inventory.json'))],['UNIT_FILESYSTEM',()=>fsUnitsValid(io.read('rejected-paths-filesystem-units.json'),s.sha)],['UNIT_PUBLIC',()=>publicUnitsValid(io.read('public-rejection-units.json'),s.sha)],['UNIT_TOP',()=>topUnitsValid(io.read('public-top-units.json'),s.sha)],['UNIT_NATIVE',()=>unitsValid(io.read('native-score-units.json'),s.sha)],['UNIT_HISTORY',()=>historyValid(io.read('native-score-history.json'))],['UNIT_ADMISSION',()=>ownUnitsValid(io.read(UNIT_FILE),s.sha)]];
 for(const [stage,valid]of tests)await check(stage,()=>{if(!valid())throw Error('FIXED_UNITS');});
 const r=await check('API_TRANSPORT',()=>fetcher('https://api.github.com/repos/sakutakajp/pagebench/actions/runs?head_sha='+s.sha+'&event=push&per_page=100',{headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(10000)}));
 record.http(r);await check('API_HTTP',()=>{if(!r.ok)throw Error('FIXED_RUN');});
 const v=await check('API_JSON',()=>r.json());
 await check('API_METADATA',()=>{record.details('api',apiDetails(v,s));if(!unique(v,s))throw Error('FIXED_RUN');});
 await check('CONSUME',()=>{if(consume)io.write('native-score-attempt.json',s);});
 record.admitted();return s;
 }catch(error){record.reject(error);throw error;}
}
