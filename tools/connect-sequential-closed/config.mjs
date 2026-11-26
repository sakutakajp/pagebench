export const BASE='8474813beb216a5363b200c05edf9ac87608bdc9';
export const REF='refs/heads/diag/connect-sequential-closed-once-20261126';
export const SUBJECT='diagnostic: sequential import closed comparison once (20261126-ag1)';
export const WORKFLOW='.github/workflows/connect-sequential-closed-once-20261126.yml';
export const DIR='tools/connect-sequential-closed',PUBLIC='connect-sequential-fixed.json',UNITS='connect-sequential-units.json';
export const TESTS=93;
export const CONDITIONS=['ALONE','SEQUENCE'];
export function scope(e=process.env){if(e.GITHUB_ACTIONS!=='true'||e.GITHUB_REPOSITORY!=='sakutakajp/pagebench'||e.GITHUB_REF!==REF||e.GITHUB_EVENT_NAME!=='push'||e.GITHUB_RUN_ATTEMPT!=='1'||!/^[a-f0-9]{40}$/.test(e.GITHUB_SHA||'')||!/^[1-9][0-9]{0,23}$/.test(e.GITHUB_RUN_ID||'')||'GITHUB_TOKEN'in e||Object.keys(e).some(k=>k.startsWith('PB_')))throw Error('CLOSED_SCOPE');return{sha:e.GITHUB_SHA,run:e.GITHUB_RUN_ID,ref:REF,attempt:1};}
