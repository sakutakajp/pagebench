export const BASE='6f108e00c2a90b0cc0aadea87c0d0cad551fe8eb';
export const REF='refs/heads/diag/selected-staging-ja-once-20261126';
export const SUBJECT='diagnostic: selected staging policy measurement once (20261126-ad1)';
export const WORKFLOW='.github/workflows/staging-selected-policy-ja-once-20261126.yml';
export const UNIT_FILE='staging-selected-cli-units.json',NODE24_TESTS=188,NODE22_TESTS=193;
export const PUBLIC_FILE='staging-selected-cli-public.json';
export const RECEIPTS=Object.freeze({PRECHECK:'staging-selected-cli-admission-precheck.json',JIT:'staging-selected-cli-admission-jit.json',LIVE:'staging-selected-cli-admission-live.json'});
export function scope(env=process.env){if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_REF!==REF||env.GITHUB_RUN_ATTEMPT!=='1'||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||'')||!/^[1-9][0-9]{0,23}$/.test(env.GITHUB_RUN_ID||''))throw Error('CLOSED_SCOPE');return{mode:'GHA_STANDALONE_SIMULATED',sha:env.GITHUB_SHA,run:env.GITHUB_RUN_ID,ref:REF,attempt:1};}

// Exact Lighthouse13.6 mobile default, not the binary-derived locked AB UA.
export const LH_MOBILE_UA='Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36';
