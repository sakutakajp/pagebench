export const BASE='eb29bc22d02b9fe870632f3c1f90ca1422c1fa8c';
export const REF='refs/heads/diag/first-scope-ja-once-20261126';
export const SUBJECT='diagnostic: first scope rejection detail once (20261126-ae1)';
export const WORKFLOW='.github/workflows/staging-first-scope-ja-once-20261126.yml';
export const UNIT_FILE='staging-first-scope-units.json',NODE24_TESTS=244,NODE22_TESTS=251;
export const PUBLIC_FILE='staging-first-scope-public.json';
export const RECEIPTS=Object.freeze({PRECHECK:'staging-first-scope-admission-precheck.json',JIT:'staging-first-scope-admission-jit.json',LIVE:'staging-first-scope-admission-live.json'});
export function scope(env=process.env){if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_REF!==REF||env.GITHUB_RUN_ATTEMPT!=='1'||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||'')||!/^[1-9][0-9]{0,23}$/.test(env.GITHUB_RUN_ID||''))throw Error('CLOSED_SCOPE');return{mode:'GHA_STANDALONE_SIMULATED',sha:env.GITHUB_SHA,run:env.GITHUB_RUN_ID,ref:REF,attempt:1};}

// Exact Lighthouse13.6 mobile default, not the binary-derived locked AB UA.
export const LH_MOBILE_UA='Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36';
