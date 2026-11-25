export const BASE='5f19827fbe442840db801c568b7933633d058059';
export const REF='refs/heads/diag/passive-html-ja-once-20261125';
export const SUBJECT='diagnostic: passive single document html baseline once (20261125-z4)';
export const WORKFLOW='.github/workflows/passive-html-ja-once-20261125.yml';
export const TARGET='https://staging.hirameki.dev/ja/';
export const HOST='staging.hirameki.dev';
export const MAX_BODY=262144, MAX_HEADERS=16384, MAX_LINK=8192, DEADLINE=15000;
export const UNIT_COUNT=92;
// Slot26 binary milestone, matched by Lighthouse's existing UA implementation.
// No claims about recorded request headers, client hints, TLS, or serving equivalence.
export const HEADERS=Object.freeze({
 'User-Agent':'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Mobile Safari/537.36',
 'Accept':'text/html', 'Accept-Encoding':'identity', 'Connection':'close',
});
export function identity(env=process.env){
 if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_REPOSITORY!=='sakutakajp/pagebench'||env.GITHUB_REF!==REF||env.GITHUB_RUN_ATTEMPT!=='1'||env.GITHUB_EVENT_NAME!=='push'||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||'')||!/^[1-9][0-9]{0,23}$/.test(env.GITHUB_RUN_ID||''))throw Error('ADMISSION');
 return{sha:env.GITHUB_SHA,run:env.GITHUB_RUN_ID,ref:REF,attempt:1};
}
