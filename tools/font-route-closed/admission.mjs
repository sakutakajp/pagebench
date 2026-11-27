import {readFileSync,writeFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {BASE,REF,SUBJECT,DIR,UNITS,scope} from './config.mjs';
export const TEST_COUNT=64;
export const unitsValid=(v,sha)=>v?.kind==='FONT_ROUTE_UNITS_V1'&&Object.keys(v).sort().join(',')==='groups,kind,sha,status'&&v.sha===sha&&v.status==='PASSED'&&v.groups?.length===2&&v.groups.every((g,i)=>JSON.stringify(g)===JSON.stringify({node:['v24.19.0','v22.19.0'][i],tests:TEST_COUNT,pass:TEST_COUNT,fail:0,skipped:0,cancelled:0,todo:0,status:'PASSED'}));
export function admit({env=process.env,version=process.version,stage=()=>{},io={read:p=>JSON.parse(readFileSync(p)),git:(...a)=>execFileSync('git',a,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim(),hash:p=>createHash('sha256').update(readFileSync(p)).digest('hex'),consume:s=>writeFileSync('font-route-consumed.json',JSON.stringify(s),{flag:'wx',mode:0o600})}}={}){
 stage('SCOPE');const s=scope(env);if(version!=='v22.19.0'||env.CHROME_PATH!=='/opt/google/chrome/chrome')throw Error('SCOPE');stage('EVENT');const e=io.read(env.GITHUB_EVENT_PATH);
 if(e.created!==true||e.forced!==false||e.deleted!==false||e.head_commit?.id!==s.sha||e.head_commit.message!==SUBJECT||io.git('rev-parse','HEAD')!==s.sha||io.git('rev-parse','HEAD^')!==BASE||io.git('rev-list','--count',BASE+'..HEAD')!=='1'||io.git('show','-s','--format=%s')!==SUBJECT)throw Error('EVENT');
 stage('SOURCE');io.git('diff','--quiet','HEAD','--');const pins=io.read(DIR+'/source-pins.json'),paths=io.read(DIR+'/added-paths.json');if(pins.parent!==BASE||!Object.keys(pins.files).length||Object.entries(pins.files).some(([p,h])=>io.hash(p)!==h))throw Error('SOURCE');
 const d=io.git('diff','--name-status',BASE,'HEAD').split('\n').map(x=>x.split('\t'));if(d.length!==paths.length||new Set(paths).size!==paths.length||d.some(([a,p])=>a!=='A'||!paths.includes(p)))throw Error('SOURCE');
 stage('UNITS');if(!unitsValid(io.read(UNITS),s.sha))throw Error('UNITS');stage('CONSUME');io.consume(s);stage('ADMITTED');return s;
}
