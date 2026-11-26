export const BASE='6de97ba4830e03b6fc380c7f707a11bbcbc44a30';
export const REF='refs/heads/diag/binding-branch-ja-once-20261126';
export const SUBJECT='diagnostic: synchronous binding branch staging once (20261126-al1)';
export const WORKFLOW='.github/workflows/staging-binding-branch-ja-once-20261126.yml';
export const UNIT_FILE='staging-binding-once-units.json',NODE24_TESTS=499,NODE22_TESTS=505;
export const PUBLIC_FILE='staging-binding-once-public.json';
export const RECEIPTS=Object.freeze({PRECHECK:'staging-binding-once-admission-precheck.json',JIT:'staging-binding-once-admission-jit.json',LIVE:'staging-binding-once-admission-live.json'});
export function scope(env=process.env){if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_REF!==REF||env.GITHUB_RUN_ATTEMPT!=='1'||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||'')||!/^[1-9][0-9]{0,23}$/.test(env.GITHUB_RUN_ID||''))throw Error('CLOSED_SCOPE');return{mode:'GHA_STANDALONE_SIMULATED',sha:env.GITHUB_SHA,run:env.GITHUB_RUN_ID,ref:REF,attempt:1};}

// Exact Lighthouse13.6 mobile default, not the binary-derived locked AB UA.
export const LH_MOBILE_UA='Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36';
