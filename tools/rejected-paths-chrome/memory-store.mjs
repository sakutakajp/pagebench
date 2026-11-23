// Test double ONLY. The real localPrivateStore and its Actions denial are unchanged.
// No filesystem, output or delivery. Retains only a validated encrypted test envelope.
import{safeEnvelope}from'../rejected-paths-local/crypto.mjs';import{createHash}from'node:crypto';
const stores=new WeakSet(),hash=s=>createHash('sha256').update(s).digest('hex');
export function createFixedMemoryStore(){let text=null,digest=null;const store=Object.freeze({verify(){if(text!==null&&hash(text)!==digest)throw Error('FIXED_MEMORY_CORRUPT');return true;},write(v){const e=safeEnvelope(v);if(!e)throw Error('FIXED_ENVELOPE');const next=JSON.stringify(e);if(text!==null&&next!==text)throw Error('FIXED_MEMORY_REWRITE');text=next;digest=hash(next);},toJSON(){return{kind:'FIXED_TEST_MEMORY_STORE_NO_DELIVERY'};}});stores.add(store);return{store,readCipher(){store.verify();if(text===null)throw Error('FIXED_MEMORY_MISSING');return JSON.parse(text);}};}
export const isLocalPrivateStore=value=>!!value&&stores.has(value);
