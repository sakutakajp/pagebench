export const BASE='e688e567e3fc024201f7fc92cb756935f8a9474d';
export const REF='refs/heads/diag/proxy-cleanup-evidence-closed-once-20261125';
export const SUBJECT='diagnostic: fixed proxy cleanup closed proof once (20261125-x1)';
export const WORKFLOW='.github/workflows/proxy-cleanup-evidence-closed-once-20261125.yml';
export const UNIT_FILE='proxy-cleanup-evidence-units.json',UNIT_COUNT=16;
export const PUBLIC_FILE='proxy-cleanup-evidence-public.json';
export const RECEIPTS=Object.freeze({PRECHECK:'proxy-cleanup-admission-precheck.json',JIT:'proxy-cleanup-admission-jit.json'});
export function scope(env=process.env){if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_REF!==REF||env.GITHUB_RUN_ATTEMPT!=='1'||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||'')||!/^[1-9][0-9]{0,23}$/.test(env.GITHUB_RUN_ID||''))throw Error('CLOSED_SCOPE');return{mode:'GHA_CLOSED_ONLY',sha:env.GITHUB_SHA,run:env.GITHUB_RUN_ID,ref:REF,attempt:1};}
