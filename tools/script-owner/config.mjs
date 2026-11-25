export const BASE='1b18780a79c73721e59585ebfeb3369c9ae74c0f';
export const REF='refs/heads/diag/script-owner-ja-once-20261125';
export const SUBJECT='diagnostic: first refused script owner once (20261125-z2)';
export const WORKFLOW='.github/workflows/staging-script-owner-ja-once-20261125.yml';
export const UNIT_FILE='script-owner-units.json',UNIT_COUNT=112;
export const PUBLIC_FILE='script-owner-public.json';
export const RECEIPTS=Object.freeze({PRECHECK:'script-owner-admission-precheck.json',JIT:'script-owner-admission-jit.json',LIVE:'script-owner-admission-live.json'});
export function scope(env=process.env){if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_REF!==REF||env.GITHUB_RUN_ATTEMPT!=='1'||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||'')||!/^[1-9][0-9]{0,23}$/.test(env.GITHUB_RUN_ID||''))throw Error('CLOSED_SCOPE');return{mode:'GHA_STANDALONE_SIMULATED',sha:env.GITHUB_SHA,run:env.GITHUB_RUN_ID,ref:REF,attempt:1};}

// Exact Lighthouse13.6 mobile default, not the binary-derived locked AB UA.
export const LH_MOBILE_UA='Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36';
