// Extra observer only; never suppresses exception handling or a nonzero exit.
import {ownerEvidence} from './evidence.mjs';let current=null;
export function evidence(){if(!current)current=ownerEvidence();return current;}
if(process.env.PB_PUBLIC_STAGE==='live'){const e=evidence();process.on('uncaughtExceptionMonitor',error=>e.failure(error));process.once('exit',code=>e.seal(code));}
