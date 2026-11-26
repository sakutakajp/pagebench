export const BASE='6fe75b1678ab9607835a4da8a91e9ac14dbb8459';
export const REF='refs/heads/diag/passive-html-admission-ja-once-20261126';
export const SUBJECT='diagnostic: passive html admission categories once (20261126-z6)';
export const WORKFLOW='.github/workflows/passive-html-admission-ja-once-20261126.yml';
export const UNIT_COUNT=193;
export {TARGET,HOST,HEADERS,MAX_BODY,MAX_HEADERS,MAX_LINK,DEADLINE} from '../passive-html/config.mjs';
export function identity(env=process.env){
 if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_REPOSITORY!=='sakutakajp/pagebench'||env.GITHUB_REF!==REF||env.GITHUB_RUN_ATTEMPT!=='1'||env.GITHUB_EVENT_NAME!=='push'||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||'')||!/^[1-9][0-9]{0,23}$/.test(env.GITHUB_RUN_ID||''))throw Error('ADMISSION');
 return{sha:env.GITHUB_SHA,run:env.GITHUB_RUN_ID,ref:REF,attempt:1};
}
