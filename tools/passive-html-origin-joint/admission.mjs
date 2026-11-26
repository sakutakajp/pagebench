import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,lstatSync,constants,openSync,closeSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {BASE,REF,SUBJECT,WORKFLOW,UNIT_COUNT,identity} from './config.mjs';
import {reporter} from './admission-category.mjs';
export const git=(...a)=>execFileSync('git',a,{encoding:'utf8',maxBuffer:2**20,stdio:['ignore','pipe','ignore']}).trim();
export const digest=b=>createHash('sha256').update(b).digest('hex');
export const read=p=>JSON.parse(readFileSync(p,'utf8'));
export function eventValid(e,s){return e?.repository?.full_name==='sakutakajp/pagebench'&&e.ref===REF&&e.before==='0'.repeat(40)&&e.created===true&&e.forced===false&&e.deleted===false&&e.after===s.sha&&e.head_commit?.id===s.sha&&e.head_commit?.message===SUBJECT&&Array.isArray(e.commits)&&e.commits.length===1&&e.commits[0]?.id===s.sha;}
export function unique(v,s){return v?.total_count===1&&Array.isArray(v.workflow_runs)&&v.workflow_runs.length===1&&v.workflow_runs[0].id===Number(s.run)&&v.workflow_runs[0].head_sha===s.sha&&v.workflow_runs[0].head_branch===REF.slice(11)&&v.workflow_runs[0].event==='push'&&v.workflow_runs[0].run_attempt===1&&v.workflow_runs[0].path===WORKFLOW;}
export function sources(s){
 if(git('rev-parse','HEAD')!==s.sha||git('show','-s','--format=%P','HEAD')!==BASE||git('show','-s','--format=%s','HEAD')!==SUBJECT||git('status','--porcelain','--untracked-files=no')!=='')throw Error('ADMISSION');
 const pins=read('tools/passive-html-origin-joint/source-pins.json'),paths=read('tools/passive-html-origin-joint/added-paths.json');
 if(pins.parent!==BASE||JSON.stringify(git('diff','--name-status',BASE,'HEAD').split('\n').sort())!==JSON.stringify(paths.map(p=>'A\t'+p).sort())||Object.entries(pins.files).some(([p,h])=>!paths.includes(p)||lstatSync(p).isSymbolicLink()||digest(readFileSync(p))!==h)||Object.keys(pins.files).length!==paths.length-1)throw Error('ADMISSION');
 const py=execFileSync('python3',['--version'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();if(!/^Python 3\.12\.\d+$/.test(py))throw Error('ADMISSION');
}
export function unitValid(v,s,label){return v&&JSON.stringify(Object.keys(v).sort())===JSON.stringify(['kind','label','sha','passed','tests'].sort())&&v.kind==='PASSIVE_HTML_ORIGIN_JOINT_UNIT_FIXED_V1'&&v.label===label&&v.sha===s.sha&&v.passed===true&&v.tests===UNIT_COUNT;}
export async function admit({env=process.env,runtime=process.version,fetcher=fetch,checkSources=sources,readProof=read,observe=()=>{},consume=()=>{const fd=openSync('passive-html-origin-joint-attempt.json',constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL,0o600);try{writeFileSync(fd,JSON.stringify(identity(env)));}finally{closeSync(fd);}}}={}){
 const mark=reporter(observe);mark('SCOPE');const s=identity(env);
 mark('RUNTIME');if(runtime!=='v22.19.0')throw Error('ADMISSION');
 mark('EVENT_READ');const event=readProof(env.GITHUB_EVENT_PATH);
 mark('EVENT_VALIDATION');if(!eventValid(event,s))throw Error('ADMISSION');
 mark('SOURCE');checkSources(s);
 mark('UNIT22_READ');const u22=readProof('passive-html-origin-joint-node22.json');mark('UNIT22_VALIDATE');if(!unitValid(u22,s,'node22'))throw Error('ADMISSION');
 mark('UNIT24_READ');const u24=readProof('passive-html-origin-joint-node24.json');mark('UNIT24_VALIDATE');if(!unitValid(u24,s,'node24'))throw Error('ADMISSION');
 mark('API_REQUEST');
 const r=await fetcher('https://api.github.com/repos/sakutakajp/pagebench/actions/runs?head_sha='+s.sha+'&event=push&per_page=100',{method:'GET',redirect:'error',headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(10000)});
 mark('API_HTTP');if(!r.ok||Number(r.headers.get('content-length')||0)>262144)throw Error('ADMISSION');
 mark('API_READ');let n=0,chunks=[];for await(const b of r.body){n+=b.length;if(n>262144)throw Error('ADMISSION');chunks.push(b);}
 mark('API_JSON');const metadata=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 mark('API_METADATA');if(!unique(metadata,s))throw Error('ADMISSION');
 mark('CONSUME');consume();mark('ADMITTED');return s;
}
