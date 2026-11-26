export const BASE='40344b83c1120202be92f261f39b267034a47d8e';
export const REF='refs/heads/diag/passive-html-beacon-match-ja-once-20261126';
export const SUBJECT='diagnostic: passive official beacon match once (20261126-z8)';
export const WORKFLOW='.github/workflows/passive-html-beacon-match-ja-once-20261126.yml';
export const UNIT_COUNT=304;
export {TARGET,HOST,HEADERS,MAX_BODY,MAX_HEADERS,MAX_LINK,DEADLINE} from '../passive-html/config.mjs';
export function identity(env=process.env){
 if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_REPOSITORY!=='sakutakajp/pagebench'||env.GITHUB_REF!==REF||env.GITHUB_RUN_ATTEMPT!=='1'||env.GITHUB_EVENT_NAME!=='push'||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||'')||!/^[1-9][0-9]{0,23}$/.test(env.GITHUB_RUN_ID||''))throw Error('ADMISSION');
 return{sha:env.GITHUB_SHA,run:env.GITHUB_RUN_ID,ref:REF,attempt:1};
}
