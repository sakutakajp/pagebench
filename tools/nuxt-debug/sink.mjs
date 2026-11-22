let sink=null;
export function setSink(fn){sink=typeof fn==='function'?fn:null;}
export function currentSink(){return sink;}
