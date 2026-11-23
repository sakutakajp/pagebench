// Control-plane read only; no browser, site, key, live admission or dispatch.
import{readFileSync}from'node:fs';import{createHash}from'node:crypto';import{execFileSync}from'node:child_process';import{BASE,REF,SUBJECT,WORKFLOW,UNIT_PROOF}from'./config.mjs';import{unitValid}from'./unit-contract.mjs';
const git=(...a)=>execFileSync('git',a,{encoding:'utf8',maxBuffer:1048576}).trim();
export function eventValid(e){return e.repository==='sakutakajp/pagebench'&&e.event==='push'&&e.ref===REF&&e.subject===SUBJECT&&e.parent===BASE&&e.attempt==='1'&&e.created===true&&e.forced===false&&e.deleted===false&&/^[a-f0-9]{40}$/.test(e.sha)&&e.sha===e.head&&e.sha===e.eventHead&&e.commitCount===1;}
export function sourceValid(pins,read=path=>readFileSync(path)){try{return pins.baseline===BASE&&Object.keys(pins.files).length>=11&&Object.entries(pins.files).every(([path,hash])=>/^(tools\/|\.github\/workflows\/)[A-Za-z0-9_./-]+$/.test(path)&&!path.includes('..')&&/^[a-f0-9]{64}$/.test(hash)&&createHash('sha256').update(read(path)).digest('hex')===hash);}catch{return false;}}
export function singleRun(v,sha,run){return !!v&&v.total_count===1&&Array.isArray(v.workflow_runs)&&v.workflow_runs.length===1&&String(v.workflow_runs[0].id)===run&&v.workflow_runs[0].head_sha===sha&&v.workflow_runs[0].event==='push'&&v.workflow_runs[0].run_attempt===1&&[WORKFLOW,WORKFLOW+'@'+REF,WORKFLOW+'@'+REF.slice(11)].includes(v.workflow_runs[0].path);}

export async function admitClosed(){
 const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')),sha=process.env.GITHUB_SHA,run=process.env.GITHUB_RUN_ID;
 if(!eventValid({repository:process.env.GITHUB_REPOSITORY,event:process.env.GITHUB_EVENT_NAME,ref:process.env.GITHUB_REF,attempt:process.env.GITHUB_RUN_ATTEMPT,created:event.created,forced:event.forced,deleted:event.deleted,subject:git('log','-1','--format=%s'),parent:git('rev-parse','HEAD^'),sha,head:git('rev-parse','HEAD'),eventHead:event.head_commit?.id,commitCount:Number(git('rev-list','--count',BASE+'..HEAD'))}))throw Error('CLOSED_EVENT');
 const units=JSON.parse(readFileSync(UNIT_PROOF,'utf8')),inventory=JSON.parse(readFileSync('tools/rejected-paths-chrome/unit-inventory.json','utf8'));if(!unitValid(units,sha,inventory))throw Error('CLOSED_UNITS');
 const pins=JSON.parse(readFileSync('tools/rejected-paths-chrome/source-pins.json','utf8'));if(!sourceValid(pins))throw Error('CLOSED_SOURCE');
 const changed=git('diff','--name-status',BASE,'HEAD').split('\n').map(x=>x.split('\t'));const allowed=JSON.parse(readFileSync('tools/rejected-paths-chrome/added-paths.json','utf8'));if(changed.length!==allowed.length||changed.some(([status,path])=>status!=='A'||!allowed.includes(path)))throw Error('CLOSED_PATHS');
 const response=await fetch('https://api.github.com/repos/sakutakajp/pagebench/actions/runs?head_sha='+sha+'&event=push&per_page=10',{headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(10000)});if(!response.ok||!singleRun(await response.json(),sha,run))throw Error('CLOSED_RUN_UNIQUENESS');
 return{sha,run,attempt:1,mode:'CLOSED_ONLY_NO_LIVE_ENTRY'};
}
if(process.argv[1]===new URL(import.meta.url).pathname){try{await admitClosed();}catch{process.exitCode=1;}}
