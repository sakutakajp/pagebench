export const BASE='c205c2eeaa2b2a90ebcf5208d366f3c1d44bf4b6';
export const REF='refs/heads/diag/connect-postflush-closed-once-20261126';
export const SUBJECT='diagnostic: post-flush CONNECT closed comparison once (20261126-af1)';
export const WORKFLOW='.github/workflows/connect-postflush-closed-once-20261126.yml';
export const DIR='tools/connect-postflush-closed',PUBLIC='connect-postflush-fixed.json',UNITS='connect-postflush-units.json';
export const TESTS=88;
export const CONDITIONS=['ALONE','SEQUENCE'];
export function scope(e=process.env){if(e.GITHUB_ACTIONS!=='true'||e.GITHUB_REPOSITORY!=='sakutakajp/pagebench'||e.GITHUB_REF!==REF||e.GITHUB_EVENT_NAME!=='push'||e.GITHUB_RUN_ATTEMPT!=='1'||!/^[a-f0-9]{40}$/.test(e.GITHUB_SHA||'')||!/^[1-9][0-9]{0,23}$/.test(e.GITHUB_RUN_ID||'')||'GITHUB_TOKEN'in e||Object.keys(e).some(k=>k.startsWith('PB_')))throw Error('CLOSED_SCOPE');return{sha:e.GITHUB_SHA,run:e.GITHUB_RUN_ID,ref:REF,attempt:1};}
