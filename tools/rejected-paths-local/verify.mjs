// Fixed local test summary only; never writes or forwards subprocess output.
import{spawnSync}from'node:child_process';
const supported=['v22.19.0','v24.19.0'];
if(!supported.includes(process.version)||!process.execArgv.includes('--unhandled-rejections=strict'))throw Error('LOCAL_RUNTIME_OR_STRICT_MODE_REQUIRED');
const result=spawnSync(process.execPath,['--unhandled-rejections=strict','--test-reporter=tap','--test','tools/rejected-paths-local/test.mjs'],{encoding:'utf8',timeout:60000,maxBuffer:1048576});
const counts=Object.fromEntries([...result.stdout.matchAll(/^# (tests|pass|fail|skipped|cancelled|todo) (\d+)$/gm)].map(m=>[m[1],Number(m[2])]));
const failed=[...result.stdout.matchAll(/^not ok \d+ - (.+)$/gm)].map(m=>/^[A-Za-z0-9 _-]{1,160}$/.test(m[1])?m[1]:'UNNORMALIZED_LOCAL_TEST_NAME');
const passed=result.status===0&&counts.tests===113&&counts.pass===113&&['fail','skipped','cancelled','todo'].every(k=>counts[k]===0)&&!result.stderr;
console.log(JSON.stringify({kind:'LOCAL_REJECTED_PATHS_NODE_PROOF',node:process.version,status:passed?'passed':'failed',counts,failed_cases:failed,stderr_present:!!result.stderr,real_chrome:false,site_requests:0,score_saved:false,report_saved:false}));
if(!passed)process.exitCode=1;
