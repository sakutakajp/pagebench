import {readFileSync,writeFileSync,renameSync,existsSync} from 'node:fs';import {spawnSync} from 'node:child_process';import {TEST_COUNT} from './admission.mjs';import {UNITS} from './config.mjs';
try{
 const label=process.argv[2],expected=label==='node24'?'v24.19.0':label==='node22'?'v22.19.0':null;if(process.version!==expected)throw Error('VERSION');
 const sha=process.env.GITHUB_SHA||spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim();if(!/^[a-f0-9]{40}$/.test(sha))throw Error('SHA');
 const v=existsSync(UNITS)?JSON.parse(readFileSync(UNITS,'utf8')):{kind:'FONT_ROUTE_UNITS_V1',sha,status:'INCOMPLETE',groups:[]};
 if(Object.keys(v).sort().join(',')!=='groups,kind,sha,status'||v.kind!=='FONT_ROUTE_UNITS_V1'||v.sha!==sha||v.groups.length!==(label==='node24'?0:1)||label==='node22'&&(v.status!=='INCOMPLETE'||JSON.stringify(v.groups[0])!==JSON.stringify({node:'v24.19.0',tests:TEST_COUNT,pass:TEST_COUNT,fail:0,skipped:0,cancelled:0,todo:0,status:'PASSED'})))throw Error('ORDER');
 const env={};for(const k of ['PATH','HOME','LANG','LC_ALL','TMPDIR'])if(typeof process.env[k]==='string')env[k]=process.env[k];
 const p=spawnSync(process.execPath,['--unhandled-rejections=strict','--test-reporter=tap','--test','tools/font-http-closed/test.mjs','tools/font-route-closed/test.mjs','tools/cdp-startup-diagnostic/font-monitor.test.mjs'],{env,encoding:'utf8',timeout:30000,maxBuffer:1048576});const counts=Object.fromEntries([...p.stdout.matchAll(/^# (tests|pass|fail|skipped|cancelled|todo) (\d+)$/gm)].map(x=>[x[1],Number(x[2])]));
 const ok=p.status===0&&!p.stderr&&counts.tests===TEST_COUNT&&counts.pass===TEST_COUNT&&['fail','skipped','cancelled','todo'].every(k=>counts[k]===0);
 v.groups.push({node:process.version,tests:counts.tests??0,pass:counts.pass??0,fail:counts.fail??0,skipped:counts.skipped??0,cancelled:counts.cancelled??0,todo:counts.todo??0,status:ok?'PASSED':'FAILED'});v.status=v.groups.length===2&&v.groups.every(g=>g.status==='PASSED')?'PASSED':ok?'INCOMPLETE':'FAILED';
 const t=JSON.stringify(v);writeFileSync(UNITS+'.tmp',t,{flag:'wx',mode:0o600});renameSync(UNITS+'.tmp',UNITS);if(readFileSync(UNITS,'utf8')!==t)throw Error('READBACK');if(!ok)process.exitCode=1;
}catch{process.exitCode=1;}
