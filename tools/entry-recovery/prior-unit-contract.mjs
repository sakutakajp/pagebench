// Pure inherited unit contract. Importing the older admission also starts its
// old-ref monitor when PB_PUBLIC_STAGE is set; never import it for this scalar.
import{TEST_COUNT}from'../public-rejection-logs/config.mjs';
export function publicUnitsValid(v,sha){return v?.kind==='PUBLIC_COUNTER_UNIT_PROOF'&&v.sha===sha&&v.status==='passed'&&v.groups?.length===2&&v.groups.every((g,i)=>JSON.stringify(g)===JSON.stringify({node:['v24.19.0','v22.19.0'][i],tests:TEST_COUNT,pass:TEST_COUNT,fail:0,skipped:0,cancelled:0,todo:0,status:'passed'}));}

import{NODE24_TESTS,NODE22_TESTS}from'../public-top-run/config.mjs';
export function topUnitsValid(v,sha){return v?.kind==='PUBLIC_TOP_UNIT_PROOF'&&v.sha===sha&&v.status==='passed'&&v.groups?.length===2&&v.groups.every((g,i)=>JSON.stringify(g)===JSON.stringify({node:['v24.19.0','v22.19.0'][i],tests:[NODE24_TESTS,NODE22_TESTS][i],pass:[NODE24_TESTS,NODE22_TESTS][i],fail:0,skipped:0,cancelled:0,todo:0,status:'passed'}));}
