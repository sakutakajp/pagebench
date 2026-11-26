export const BASE='d14550d41bd0a8527cbab3e59b5cec5940726440';
export const REF='refs/heads/diag/passive-html-channels-ja-once-20261126';
export const SUBJECT='diagnostic: independent passive html channels once (20261126-z5)';
export const WORKFLOW='.github/workflows/passive-html-channels-ja-once-20261126.yml';
export const UNIT_COUNT=158;
export {TARGET,HOST,HEADERS,MAX_BODY,MAX_HEADERS,MAX_LINK,DEADLINE} from '../passive-html/config.mjs';
export function identity(env=process.env){
 if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_REPOSITORY!=='sakutakajp/pagebench'||env.GITHUB_REF!==REF||env.GITHUB_RUN_ATTEMPT!=='1'||env.GITHUB_EVENT_NAME!=='push'||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||'')||!/^[1-9][0-9]{0,23}$/.test(env.GITHUB_RUN_ID||''))throw Error('ADMISSION');
 return{sha:env.GITHUB_SHA,run:env.GITHUB_RUN_ID,ref:REF,attempt:1};
}
