// TEST ONLY: controlled producer inputs. Never real Chrome or a live proof.
import {writeFileSync,readFileSync} from 'node:fs';import {join} from 'node:path';
import {runStartupTop,persistStartupTop} from '../natural-reads/startup-proof.mjs';
import {modelCases,CHROME,HASH} from '../public-top-run/case-model.mjs';
import {runClosedBrowser} from '../natural-reads/browser.mjs';
import {closedScopedCases} from '../natural-reads/scoped240-proof-control.mjs';
import {scoped240BrowserSummary} from '../natural-reads/scoped240-browser.mjs';
import {produce400Control} from '../natural-reads/scoped400-proof-control.mjs';
import {counterClosedSummary} from '../public-rejection-logs/closed-browser.mjs';
import {rejectionCounts} from '../public-rejection-logs/counts.mjs';
import {TEST_COUNT as FS_COUNT} from '../rejected-paths-filesystem/config.mjs';
import {TEST_COUNT as COUNTER_COUNT} from '../public-rejection-logs/config.mjs';
import {NODE24_TESTS as TOP24,NODE22_TESTS as TOP22} from '../public-top-run/config.mjs';
import {NODE24_TESTS,NODE22_TESTS,REF,WORKFLOW,UNITS} from './config.mjs';
export async function proofFixtures(directory,sha,run){
 const save=(file,v)=>writeFileSync(join(directory,file),JSON.stringify(v),{mode:0o600});
 const inventory=JSON.parse(readFileSync(new URL('../rejected-paths-chrome/unit-inventory.json',import.meta.url)));
 save('rejected-paths-unit-proof.json',{kind:'FIXED_REJECTED_PATH_UNIT_PROOF',status:'passed',sha,groups:inventory.map(g=>({name:g.name,node:g.node,status:'passed',counts:{tests:g.expected,pass:g.expected,fail:0,skipped:0,cancelled:0},stderr_present:false}))});
 const units=(kind,counts)=>({kind,sha,status:'passed',groups:counts.map((n,i)=>({node:['v24.19.0','v22.19.0'][i],tests:n,pass:n,fail:0,skipped:0,cancelled:0,todo:0,status:'passed'}))});
 save('rejected-paths-filesystem-units.json',units('CLOSED_FILESYSTEM_UNIT_PROOF',[FS_COUNT,FS_COUNT]));
 save('public-rejection-units.json',units('PUBLIC_COUNTER_UNIT_PROOF',[COUNTER_COUNT,COUNTER_COUNT]));
 save('public-top-units.json',units('PUBLIC_TOP_UNIT_PROOF',[TOP24,TOP22]));
 save(UNITS,units('PUBLIC_ENTRY_UNIT_PROOF',[NODE24_TESTS,NODE22_TESTS]));
 const stamp={workflow_sha:sha,run_id:run},native={...await runClosedBrowser({run:async name=>({case:name,status:'passed',chrome:CHROME,continuation:'SAFE_CLOSED_NEXT_CASE'}),hash:async()=>HASH}),...stamp,binary_sha256:HASH};save('natural-native-closed-proof.json',native);
 const rows=modelCases(),top={...await runStartupTop({run:async name=>structuredClone(rows.get(name)),hash:async()=>HASH}),...stamp};persistStartupTop(top,{directory,sha,run});
 save('scoped240-closed-proof.json',{...scoped240BrowserSummary({cases:closedScopedCases(),chrome:CHROME,hash:HASH,stable:true}),...stamp});
 save('scoped400-closed-proof.json',{...await produce400Control({hash:HASH,chrome:CHROME}),...stamp});
 class G{constructor(){this.primary='P';this.createdPage='T';this.sessions=new Map([['P',{ready:true,frame:'F'}]]);this.stopping=false;this.boundary={reject:()=>{}};}request(e,id){return this.boundary.reject('SCOPE',e);}fail(){this.stopping=true;}}
 const counts=denied=>{const c=rejectionCounts(),g=new(c.instrument(G))();if(denied){g.request({requestId:'R',frameId:'F',resourceType:'Script',request:{url:'https://synthetic.invalid/fixed.js',method:'GET'}},'P');g.fail('AB_BOUNDARY_REJECTED');}return c.freeze();};
 const common={status:'passed',phase:'COMPLETE',initial:true,receiver_rejections:0,cleanup:'complete',upstream:0,open_sockets:0,proxy_closed:true,chrome:CHROME};
 save('public-rejection-closed.json',counterClosedSummary({sha,run,binary:HASH,chrome:CHROME,stable:true,cases:[{...common,case:'normal',armed:false,counts:counts(false)},{...common,case:'denied',armed:true,counts:counts(true)}]}));
 const scope={sha,run_id:run,attempt:1,ref:REF};for(const stage of ['native','top','scoped240','scoped400','counter'])save('public-stage-'+stage+'.json',{kind:'FIXED_PUBLIC_STAGE',scope,stage,phase:'EXIT',first_fault:null,exit_code:0,passed:true});
 return {hash:HASH,run:{total_count:1,workflow_runs:[{id:run,head_sha:sha,event:'push',run_attempt:1,path:WORKFLOW}]}};
}
