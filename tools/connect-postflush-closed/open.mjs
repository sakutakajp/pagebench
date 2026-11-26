// Only the closed five-case entry imports this opener. Passed factory remains
// the inherited reject-only factory: its captured proxy reference is preserved.
import {openGuarded} from '../cdp-startup-diagnostic/fixture-runner.mjs';
import {postFlushProxy,isPostFlushProxy,proxyState} from './proxy.mjs';
export async function postFlushOpen(G,factory){const c=await openGuarded(G,()=>postFlushProxy(factory));if(!isPostFlushProxy(c.proxy)||proxyState(c.proxy)?.invalid_handoffs!==0){await c.cleanup();throw Error('CLOSED_PROXY_FACTORY');}return c;}
