export const BASE='baf82f6b190f5abef4f7fdf73b83540974c80739';
export const REF='refs/heads/diag/admission-evidence-closed-once-20261125';
export const SUBJECT='diagnostic: bounded closed admission evidence once (20261125-w1)';
export const WORKFLOW='.github/workflows/admission-evidence-closed-once-20261125.yml';
export const UNIT_FILE='admission-evidence-units.json';
export const UNIT_COUNT=53;
export const PUBLIC_FILE='admission-evidence-public.json';
export const RECEIPTS=Object.freeze({PRECHECK:'admission-evidence-precheck.json',JIT:'admission-evidence-jit.json'});
export function scope(env=process.env){
 if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_REF!==REF||env.GITHUB_RUN_ATTEMPT!=='1'||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||'')||!/^[1-9][0-9]{0,23}$/.test(env.GITHUB_RUN_ID||''))throw Error('CLOSED_SCOPE');
 return{mode:'GHA_CLOSED_ONLY',sha:env.GITHUB_SHA,run:env.GITHUB_RUN_ID,ref:REF,attempt:1};
}
