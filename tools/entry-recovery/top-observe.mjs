// Same original producer/supervisor/child and options. Writes only fixed case
// metadata between child lifetimes. Diagnostics never replace gate predicates.
import {runStartupTop} from '../natural-reads/startup-proof.mjs';
import {superviseNatural} from '../natural-reads/startup-parent.mjs';
import {createJournal} from './signals.mjs';
const originalCase=mode=>superviseNatural(new URL('../natural-reads/startup-child.mjs',import.meta.url).pathname,[mode],{prerequisite:true,timeout:45000});
export async function runObservedTop({identity,directory='.',runCase=originalCase,hash,write}={}){
 const journal=createJournal(identity,{directory,...(write?{write}:{})});
 const run=async mode=>{journal.begin(mode);try{const result=await runCase(mode);journal.returned(mode,result);return result;}catch(error){journal.returned(mode,null,{thrown:true});throw error;}};
 try{const top=await runStartupTop({run,...(hash?{hash}:{})});journal.finished(top);return top;}catch(error){journal.failed();throw error;}
}
