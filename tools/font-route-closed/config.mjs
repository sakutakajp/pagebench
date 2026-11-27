export const BASE='95be87bb8915beb781e5bb7ea6eb145d2300a893';
export const REF='refs/heads/diag/font-route-closed-once-20261127';
export const SUBJECT='diagnostic: observed closed font transport once (20261127-ao1)';
export const DIR='tools/font-route-closed',WORKFLOW='.github/workflows/font-route-closed-once-20261127.yml';
export const PUBLIC='font-route-fixed.json',UNITS='font-route-units.json';
export function scope(e=process.env){if(e.GITHUB_ACTIONS!=='true'||e.GITHUB_REPOSITORY!=='sakutakajp/pagebench'||e.GITHUB_REF!==REF||e.GITHUB_EVENT_NAME!=='push'||e.GITHUB_RUN_ATTEMPT!=='1'||!/^[a-f0-9]{40}$/.test(e.GITHUB_SHA||'')||!/^[1-9][0-9]{0,23}$/.test(e.GITHUB_RUN_ID||'')||'GITHUB_TOKEN'in e||'GH_TOKEN'in e||Object.keys(e).some(k=>k.startsWith('PB_')))throw Error('SCOPE');return {sha:e.GITHUB_SHA,run:e.GITHUB_RUN_ID,ref:REF,attempt:1};}
