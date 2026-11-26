export const BASE='df29ee7204cc6bd82db2f59d5fff4cb124d6cded';
export const REF='refs/heads/diag/native-order-ja-once-20261126';
export const SUBJECT='diagnostic: closed native post-flush staging once (20261126-ak1)';
export const WORKFLOW='.github/workflows/staging-native-order-ja-once-20261126.yml';
export const UNIT_FILE='staging-native-order-once-units.json',NODE24_TESTS=452,NODE22_TESTS=458;
export const PUBLIC_FILE='staging-native-order-once-public.json';
export const RECEIPTS=Object.freeze({PRECHECK:'staging-native-order-once-admission-precheck.json',JIT:'staging-native-order-once-admission-jit.json',LIVE:'staging-native-order-once-admission-live.json'});
export function scope(env=process.env){if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_REF!==REF||env.GITHUB_RUN_ATTEMPT!=='1'||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||'')||!/^[1-9][0-9]{0,23}$/.test(env.GITHUB_RUN_ID||''))throw Error('CLOSED_SCOPE');return{mode:'GHA_STANDALONE_SIMULATED',sha:env.GITHUB_SHA,run:env.GITHUB_RUN_ID,ref:REF,attempt:1};}

// Exact Lighthouse13.6 mobile default, not the binary-derived locked AB UA.
export const LH_MOBILE_UA='Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36';
