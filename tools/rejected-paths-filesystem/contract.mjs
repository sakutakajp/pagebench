// Only an exact fabricated payload is writable by the dedicated closed store.
// Ordinary real-data constructors and their Actions denial remain unchanged.
import{safePayload}from'../rejected-paths-local/schema.mjs';
import{rowsFor}from'../rejected-paths-chrome/data.mjs';
import{binding}from'../origin-capture/retry-crypto.mjs';
import{SCOPE_RUN}from'./config.mjs';
const expected=new Map();for(const row of rowsFor('duplicates')){const path=new URL('http://127.0.0.1:47500'+row.path).pathname;expected.set(path,(expected.get(path)||0)+1);}
export function fixedScope(scope){try{const s=binding(scope);return s.mode==='CLOSED'&&s.run_id===SCOPE_RUN?s:null;}catch{return null;}}
export function syntheticPayload(value){
 const p=safePayload(value);if(!p||p.observed.value!==406||p.observed.saturated||p.rows.length!==401||p.signals.length||['omitted','capacity_omitted','losses','unassociated_stops','signals_omitted','unknown_metadata'].some(k=>p[k].value!==0||p[k].saturated))return null;
 const seen=new Set();for(const row of p.rows){if(!expected.has(row.path)||seen.has(row.path)||row.state!=='CAPTURED'||row.detail!=='NONE'||row.reason!=='ABORT_WITHOUT_POLICY_REASON'||!['XHR','Fetch'].includes(row.resource)||row.method!=='GET'||row.source!=='ABORT_COMMAND'||row.phase!=='BEFORE_STOP'||row.count.saturated||row.count.value!==expected.get(row.path))return null;seen.add(row.path);}
 return p;
}
