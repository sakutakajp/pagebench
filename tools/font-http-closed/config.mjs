export const BASE='2da3a06948fab2c290ff83eebf55197ea834981b';
export const REF='refs/heads/diag/font-http-closed-once-20261126';
export const SUBJECT='diagnostic: closed font HTTP comparison once (20261126-an1)';
export const DIR='tools/font-http-closed';
export const WORKFLOW='.github/workflows/font-http-closed-once-20261126.yml';
export const PUBLIC='font-http-fixed.json',UNITS='font-http-units.json';
export const MODES=['SINGLE','SHARED','DISTINCT'];
export const USES={SINGLE:{a:1,b:0},SHARED:{a:12,b:0},DISTINCT:{a:12,b:12}};
export const ORIGIN='http://127.0.0.1:47500',DOCUMENT=ORIGIN+'/fixture';
export const FONT_A=ORIGIN+'/font-a.ttf',FONT_B=ORIGIN+'/font-b.ttf';
export function scope(e=process.env){
 if(e.GITHUB_ACTIONS!=='true'||e.GITHUB_REPOSITORY!=='sakutakajp/pagebench'||e.GITHUB_REF!==REF||e.GITHUB_EVENT_NAME!=='push'||e.GITHUB_RUN_ATTEMPT!=='1'||!/^[a-f0-9]{40}$/.test(e.GITHUB_SHA||'')||!/^[1-9][0-9]{0,23}$/.test(e.GITHUB_RUN_ID||'')||'GITHUB_TOKEN'in e||'GH_TOKEN'in e||Object.keys(e).some(k=>k.startsWith('PB_')))throw Error('SCOPE');
 return {sha:e.GITHUB_SHA,run:e.GITHUB_RUN_ID,ref:REF,attempt:1};
}
