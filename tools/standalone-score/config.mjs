export const BASE='f1acd1f04449239d01739bc1fc5962fba880b1ae';
export const REF='refs/heads/diag/standalone-simulated-ja-once-20261125';
export const SUBJECT='diagnostic: standalone simulated ja score once (20261125-z1)';
export const WORKFLOW='.github/workflows/staging-standalone-simulated-ja-once-20261125.yml';
export const UNIT_FILE='standalone-score-units.json',UNIT_COUNT=59;
export const PUBLIC_FILE='standalone-score-public.json';
export const RECEIPTS=Object.freeze({PRECHECK:'standalone-admission-precheck.json',JIT:'standalone-admission-jit.json',LIVE:'standalone-admission-live.json'});
export function scope(env=process.env){if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_REF!==REF||env.GITHUB_RUN_ATTEMPT!=='1'||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||'')||!/^[1-9][0-9]{0,23}$/.test(env.GITHUB_RUN_ID||''))throw Error('CLOSED_SCOPE');return{mode:'GHA_STANDALONE_SIMULATED',sha:env.GITHUB_SHA,run:env.GITHUB_RUN_ID,ref:REF,attempt:1};}

// Exact Lighthouse13.6 mobile default, not the binary-derived locked AB UA.
export const LH_MOBILE_UA='Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36';
