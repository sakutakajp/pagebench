import {scope,createJournal} from './state.mjs';let current;
export function journal(){return current??=createJournal(scope());}
if(process.env.PB_NATIVE_SCORE==='CLOSED'){const j=journal();process.on('uncaughtExceptionMonitor',e=>j.fault(e));process.once('exit',code=>j.exit(code));}
