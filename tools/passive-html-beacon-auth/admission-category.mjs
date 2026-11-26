// Diagnostics only. Never an admission predicate or an exception serializer.
export const ADMISSION_CATEGORIES=Object.freeze(['NOT_OBSERVED','API_TOKEN_MISSING','API_TOKEN_INVALID','API_TOKEN_ENV_UNCLEARED','BOOT_LOAD_UNKNOWN','BOOT_RUN_UNKNOWN','SCOPE','RUNTIME','EVENT_READ','EVENT_VALIDATION','SOURCE','UNIT22_READ','UNIT22_VALIDATE','UNIT24_READ','UNIT24_VALIDATE','API_REQUEST','API_HTTP','API_HTTP_403','API_HTTP_429','API_HTTP_OTHER_OR_UNKNOWN','API_CONTENT_LENGTH_LIMIT','API_READ','API_JSON','API_METADATA','CONSUME','ADMITTED','UNKNOWN']);
// Failure-only diagnostic. A missing/throwing status never changes rejection.
export function httpFailureCategory(response){try{const status=response.status;return status===403?'API_HTTP_403':status===429?'API_HTTP_429':'API_HTTP_OTHER_OR_UNKNOWN';}catch{return 'API_HTTP_OTHER_OR_UNKNOWN';}}
export const fixedCategory=value=>ADMISSION_CATEGORIES.includes(value)?value:'UNKNOWN';
export function reporter(observe=()=>{}){return value=>{try{observe(fixedCategory(value));}catch{}};}
