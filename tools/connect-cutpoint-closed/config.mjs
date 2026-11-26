export const BASE='42191d284c97b7bcf9e02465ea45fcff1708dbf3';
export const REF='refs/heads/diag/connect-cutpoint-closed-once-20261126';
export const SUBJECT='diagnostic: bounded unit cutpoint closed comparison once (20261126-ah1)';
export const WORKFLOW='.github/workflows/connect-cutpoint-closed-once-20261126.yml';
export const DIR='tools/connect-cutpoint-closed',PUBLIC='connect-cutpoint-fixed.json',UNITS='connect-cutpoint-units.json';
export const TESTS=93;
export const CONDITIONS=['ALONE','SEQUENCE'];
export function scope(e=process.env){if(e.GITHUB_ACTIONS!=='true'||e.GITHUB_REPOSITORY!=='sakutakajp/pagebench'||e.GITHUB_REF!==REF||e.GITHUB_EVENT_NAME!=='push'||e.GITHUB_RUN_ATTEMPT!=='1'||!/^[a-f0-9]{40}$/.test(e.GITHUB_SHA||'')||!/^[1-9][0-9]{0,23}$/.test(e.GITHUB_RUN_ID||'')||'GITHUB_TOKEN'in e||Object.keys(e).some(k=>k.startsWith('PB_')))throw Error('CLOSED_SCOPE');return{sha:e.GITHUB_SHA,run:e.GITHUB_RUN_ID,ref:REF,attempt:1};}
