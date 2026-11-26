import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {git} from './admission.mjs';
import {UNIT_COUNT} from './config.mjs';
let unexpectedToken=false,cleared=false;try{unexpectedToken='GITHUB_TOKEN' in process.env;delete process.env.GITHUB_TOKEN;cleared=!('GITHUB_TOKEN' in process.env);}catch{}
const label=process.argv[2];
let proof={kind:'PASSIVE_HTML_BEACON_AUTH_UNIT_FIXED_V1',label:['node22','node24'].includes(label)?label:'UNKNOWN',sha:cleared?git('rev-parse','HEAD'):null,passed:false,tests:0};
try{
 if(unexpectedToken||!cleared)throw Error();
 if((label==='node22'&&process.version!=='v22.19.0')||(label==='node24'&&process.version!=='v24.19.0')||!['node22','node24'].includes(label))throw Error();
 const r=spawnSync(process.execPath,['--unhandled-rejections=strict','--test','--test-reporter=tap','tools/passive-html/test.mjs','tools/passive-html-channels/test.mjs','tools/passive-html-beacon-auth/test.mjs','tools/passive-html-origin-joint/origin-test.mjs','tools/passive-html-beacon-match/beacon-test.mjs','tools/passive-html-beacon-auth/auth-test.mjs'],{encoding:'utf8',timeout:60000,maxBuffer:1048576});
 const tests=/^# tests (\d+)$/m.exec(r.stdout||''),pass=/^# pass (\d+)$/m.exec(r.stdout||''),fail=/^# fail (\d+)$/m.exec(r.stdout||'');
 proof.tests=tests?Number(tests[1]):0;proof.passed=r.status===0&&!r.signal&&!r.error&&pass?.[1]===tests?.[1]&&fail?.[1]==='0'&&proof.tests===UNIT_COUNT;
}catch{}
writeFileSync('passive-html-beacon-auth-'+proof.label+'.json',JSON.stringify(proof),{mode:0o600});console.log(JSON.stringify(proof));process.exitCode=proof.passed?0:1;
