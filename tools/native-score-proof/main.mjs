// CLOSED entry only. No target argument, live opener or upstream proxy import.
import {nativeStage} from './native.mjs';import {closedScore} from './score.mjs';
import {journal} from './monitor.mjs';import {admitClosed} from './admission.mjs';
import {runScoped400Browser} from '../natural-reads/scoped400-browser.mjs';
import {projectBudget} from './budget.mjs';
import {fileURLToPath} from 'node:url';
export async function executeClosed({native=nativeStage,budget=runScoped400Browser,score=closedScore,j=journal()}={}){try{j.phase('NATIVE');const n=await native(j);j.native(n);if(n.continuation!=='SAFE_CLOSED_NEXT_SUITE'){j.finish(false);return false;}j.phase('CAP400');const b=await budget();j.budget(projectBudget(b));if(b.status!=='passed'){j.finish(false);return false;}j.phase('SCORE');const s=await score();j.score(s);const ok=n.status==='passed'&&s.status==='PASSED'&&s.chrome===n.cases[0]?.chrome&&s.chrome===b.chrome;j.finish(ok);return ok&&j.snapshot().stage_status==='PASSED'&&j.snapshot().recording==='COMPLETE_PREFIX';}catch(e){j.fault(e);j.finish(false);return false;}}
if(process.argv[1]===fileURLToPath(import.meta.url)){try{if(process.argv.length!==3||process.argv[2]!=='--closed-once'||process.env.GITHUB_ACTIONS!=='true')throw Error('FIXED_ARGS');const j=journal();j.phase('ADMISSION');await admitClosed({consume:true});if(!await executeClosed({j}))process.exitCode=1;}catch(e){journal().fault(e);journal().finish(false);process.exitCode=1;}}
