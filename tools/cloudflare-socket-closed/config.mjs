export const BASE='492104c9f4c3ad73da8ae26d4f0cad8454642ebf';
export const REF='refs/heads/diag/cloudflare-socket-closed-once-20261126';
export const SUBJECT='diagnostic: fixed proxy fault closed browser proof once (20261126-ac1)';
export const WORKFLOW='.github/workflows/cloudflare-socket-closed-once-20261126.yml';
export const UNIT_FILE='cloudflare-socket-closed-units.json',TESTS=48;
export const PUBLIC_FILE='cloudflare-socket-closed-fixed.json';
export const MODES=Object.freeze(['script','image','forbidden_path','other_host','post']);
export function scope(env=process.env){if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_REPOSITORY!=='sakutakajp/pagebench'||env.GITHUB_REF!==REF||env.GITHUB_RUN_ATTEMPT!=='1'||env.GITHUB_EVENT_NAME!=='push'||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||'')||!/^[1-9][0-9]{0,23}$/.test(env.GITHUB_RUN_ID||'')||'GITHUB_TOKEN'in env)throw Error('CLOSED_SCOPE');return{sha:env.GITHUB_SHA,run:env.GITHUB_RUN_ID,ref:REF,attempt:1};}
