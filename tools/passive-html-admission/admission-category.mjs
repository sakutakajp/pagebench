// Diagnostics only. Never an admission predicate or an exception serializer.
export const ADMISSION_CATEGORIES=Object.freeze(['NOT_OBSERVED','SCOPE','RUNTIME','EVENT_READ','EVENT_VALIDATION','SOURCE','UNIT22_READ','UNIT22_VALIDATE','UNIT24_READ','UNIT24_VALIDATE','API_REQUEST','API_HTTP','API_READ','API_JSON','API_METADATA','CONSUME','ADMITTED','UNKNOWN']);
export const fixedCategory=value=>ADMISSION_CATEGORIES.includes(value)?value:'UNKNOWN';
export function reporter(observe=()=>{}){return value=>{try{observe(fixedCategory(value));}catch{}};}
