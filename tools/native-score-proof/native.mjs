// Original native producer/acceptance; sparse diagnostics are not admission.
import {runClosedBrowser,closedBrowserCase} from '../natural-reads/browser.mjs';
import {openGuarded} from '../cdp-startup-diagnostic/fixture-runner.mjs';
import {projectCase,own} from './case-project.mjs';
export * from './case-project.mjs';
export async function nativeStage(journal,{open=openGuarded,run=closedBrowserCase,hash}={}){
 const proof=await runClosedBrowser({...(hash?{hash}:{}),run:async(mode,chrome)=>{journal.case(projectCase(mode,null,{point:'STARTED'}));let ctx,openFailure=null;try{const raw=await run(mode,chrome,{open:async(...args)=>{try{ctx=await open(...args);return ctx;}catch(e){const x=own(e,'fixed');openFailure={phase:own(x,'phase'),cleanup:own(x,'cleanup')};throw e;}}});journal.case(projectCase(mode,raw,{point:'RETURNED',openFailure,pending:ctx?.gateway?.pending?.size}));return raw;}catch(error){journal.case(projectCase(mode,null,{point:'THREW',openFailure}));throw error;}}});
 for(const row of proof.cases)if(row.status==='not_run')journal.case(projectCase(row.case,row,{point:'NOT_RUN_CONFIRMED'}));return proof;
}
