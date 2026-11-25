export const BASE='abfe68931d42e4785d67bba622b913a500aced1a';
export const REF='refs/heads/diag/script-owner-storage-ja-once-20261125';
export const SUBJECT='diagnostic: canonical owner storage once (20261125-z3)';
export const WORKFLOW='.github/workflows/staging-script-owner-storage-ja-once-20261125.yml';
export const UNIT_FILE='script-owner-storage-units.json',NODE24_TESTS=16,NODE22_TESTS=17;
export const PUBLIC_FILE='script-owner-storage-public.json';
export const RECEIPTS=Object.freeze({PRECHECK:'script-owner-storage-admission-precheck.json',JIT:'script-owner-storage-admission-jit.json',LIVE:'script-owner-storage-admission-live.json'});
export function scope(env=process.env){if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_REF!==REF||env.GITHUB_RUN_ATTEMPT!=='1'||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||'')||!/^[1-9][0-9]{0,23}$/.test(env.GITHUB_RUN_ID||''))throw Error('CLOSED_SCOPE');return{mode:'GHA_STANDALONE_SIMULATED',sha:env.GITHUB_SHA,run:env.GITHUB_RUN_ID,ref:REF,attempt:1};}

// Exact Lighthouse13.6 mobile default, not the binary-derived locked AB UA.
export const LH_MOBILE_UA='Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36';
