export const BASE='4d1b6054c4be125e1402b2b5693d0529e9745553';
export const REF='refs/heads/diag/beacon-api-read-ja-once-20261126';
export const SUBJECT='diagnostic: job-token scoped beacon staging once (20261126-aj1)';
export const WORKFLOW='.github/workflows/staging-beacon-api-read-ja-once-20261126.yml';
export const UNIT_FILE='staging-beacon-api-read-units.json',NODE24_TESTS=434,NODE22_TESTS=440;
export const PUBLIC_FILE='staging-beacon-api-read-public.json';
export const RECEIPTS=Object.freeze({PRECHECK:'staging-beacon-api-read-admission-precheck.json',JIT:'staging-beacon-api-read-admission-jit.json',LIVE:'staging-beacon-api-read-admission-live.json'});
export function scope(env=process.env){if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_REF!==REF||env.GITHUB_RUN_ATTEMPT!=='1'||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||'')||!/^[1-9][0-9]{0,23}$/.test(env.GITHUB_RUN_ID||''))throw Error('CLOSED_SCOPE');return{mode:'GHA_STANDALONE_SIMULATED',sha:env.GITHUB_SHA,run:env.GITHUB_RUN_ID,ref:REF,attempt:1};}

// Exact Lighthouse13.6 mobile default, not the binary-derived locked AB UA.
export const LH_MOBILE_UA='Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36';
