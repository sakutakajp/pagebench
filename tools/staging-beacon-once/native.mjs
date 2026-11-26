import{runCFControls as original}from'../staging-first-scope/native.mjs';
import{postFlushOpen}from'../connect-postflush-closed/open.mjs';
export{safeCFProof,validCFProof}from'../staging-first-scope/native.mjs';
export function runCFControls(options={}){return original({...options,open:options.open??postFlushOpen});}
