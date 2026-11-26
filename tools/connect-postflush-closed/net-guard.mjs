// Independent Node-side no-egress guard. Chrome keeps the inherited explicit
// reject-only HTTP proxy and memory-only CDP fixtures; no browser flags change.
import net from 'node:net';import dns from 'node:dns';import {syncBuiltinESMExports} from 'node:module';
let active=false;const counts={installed:false,loopback_connects:0,blocked_connects:0,dns_attempts:0};
export function install(){if(active)throw Error('CLOSED_NETWORK_GUARD');active=true;counts.installed=true;const connect=net.Socket.prototype.connect;
 net.Socket.prototype.connect=function(...args){const a=Array.isArray(args[0])?args[0]:args,o=a[0];const host=o&&typeof o==='object'?(o.host??o.hostname):typeof a[1]==='string'?a[1]:null,port=o&&typeof o==='object'?o.port:o;
  if(!['127.0.0.1','::1'].includes(host)||!/^\d{1,5}$/.test(String(port))||Number(port)<1||Number(port)>65535){counts.blocked_connects=Math.min(65535,counts.blocked_connects+1);throw Error('CLOSED_NON_LOOPBACK');}
  counts.loopback_connects=Math.min(65535,counts.loopback_connects+1);return Reflect.apply(connect,this,args);
 };
 const originalLookup=dns.lookup;const deny=()=>{counts.dns_attempts=Math.min(65535,counts.dns_attempts+1);throw Error('CLOSED_DNS');};for(const k of Object.keys(dns))if(k==='lookup'||k==='lookupService'||k.startsWith('resolve')||k==='reverse')dns[k]=deny;dns.lookup=function(host,...args){if(['127.0.0.1','::1'].includes(host))return Reflect.apply(originalLookup,this,[host,...args]);return deny();};for(const k of Object.keys(dns.promises))if(k==='lookup'||k.startsWith('resolve')||k==='reverse')dns.promises[k]=async()=>deny();syncBuiltinESMExports();return snapshot;
}
export function snapshot(){return {...counts};}
