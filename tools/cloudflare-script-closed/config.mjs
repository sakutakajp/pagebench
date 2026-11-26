export const BASE='073aff0277fe64668412f7c0f434e2ee54ae4ecb';
export const REF='refs/heads/diag/cloudflare-script-closed-once-20261126';
export const SUBJECT='diagnostic: Cloudflare Script closed browser proof once (20261126-ab1)';
export const WORKFLOW='.github/workflows/cloudflare-script-closed-once-20261126.yml';
export const UNIT_FILE='cloudflare-script-closed-units.json',TESTS=35;
export const PUBLIC_FILE='cloudflare-script-closed-fixed.json';
export const MODES=Object.freeze(['script','image','forbidden_path','other_host','post']);
export function scope(env=process.env){if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_REPOSITORY!=='sakutakajp/pagebench'||env.GITHUB_REF!==REF||env.GITHUB_RUN_ATTEMPT!=='1'||env.GITHUB_EVENT_NAME!=='push'||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||'')||!/^[1-9][0-9]{0,23}$/.test(env.GITHUB_RUN_ID||'')||'GITHUB_TOKEN'in env)throw Error('CLOSED_SCOPE');return{sha:env.GITHUB_SHA,run:env.GITHUB_RUN_ID,ref:REF,attempt:1};}
