export const BASE='ee9067b89b894bfa16cbebbb38ddd2d7600206ee';
export const REF='refs/heads/diag/beacon-read-ja-once-20261126';
export const SUBJECT='diagnostic: guarded versioned beacon staging once (20261126-ai1)';
export const WORKFLOW='.github/workflows/staging-beacon-read-ja-once-20261126.yml';
export const UNIT_FILE='staging-beacon-once-units.json',NODE24_TESTS=403,NODE22_TESTS=409;
export const PUBLIC_FILE='staging-beacon-once-public.json';
export const RECEIPTS=Object.freeze({PRECHECK:'staging-beacon-once-admission-precheck.json',JIT:'staging-beacon-once-admission-jit.json',LIVE:'staging-beacon-once-admission-live.json'});
export function scope(env=process.env){if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_REF!==REF||env.GITHUB_RUN_ATTEMPT!=='1'||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||'')||!/^[1-9][0-9]{0,23}$/.test(env.GITHUB_RUN_ID||''))throw Error('CLOSED_SCOPE');return{mode:'GHA_STANDALONE_SIMULATED',sha:env.GITHUB_SHA,run:env.GITHUB_RUN_ID,ref:REF,attempt:1};}

// Exact Lighthouse13.6 mobile default, not the binary-derived locked AB UA.
export const LH_MOBILE_UA='Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36';
