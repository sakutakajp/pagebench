// Passive, bounded metadata only. Never inspect console args, exception descriptions or stacks.
import {classifyNetworkFailure} from '../cdp-startup-diagnostic/network-failure.mjs';
import {TARGET,TOTAL_REQUESTS} from './policy.mjs';
const kinds=['MAIN_HTML','PUBLIC_HTML','HOME_METADATA','PUBLIC_ROUTE_METADATA','HOME_DIRECTORY','NUXT_PAYLOAD_JSON','NUXT_PAYLOAD_JS','NUXT_STATIC','STATIC','FONT','PUBLIC_STATIC','IMAGE_STATIC'];
const labels=['DOCUMENT_BOUND','DOCUMENT_HTTP_200','DOCUMENT_HTTP_OTHER','FCP','CONSOLE_ERROR','UNCAUGHT_EXCEPTION','EXCEPTION_REVOKED','NETWORK_FAILED','CONTENT_BOUND','CONTENT_HEADERS','CONTENT_EOF','CONTENT_FAILED','SCOPE_LOST'];
const content=k=>['HOME_METADATA','PUBLIC_ROUTE_METADATA','HOME_DIRECTORY'].includes(k);
export class ReadSignals{
 constructor(g){this.g=g;this.owner=null;this.frame=null;this.loader=null;this.context=null;this.runtime=false;this.lost=false;this.closed=false;this.overflow=false;this.events=[];this.consoleErrors=0;this.uncaught=0;this.unscoped=0;this.late=0;this.content=new Map();this.starts=new Map();this.networkFailures=0;}
 mark(code,kind=null){if(this.closed){this.late=Math.min(120,this.late+1);return;}if(this.events.length>=32){this.overflow=true;return;}if(!labels.includes(code))return;this.events.push({order:this.events.length+1,code,resource:kinds.includes(kind)?kind:null});}
 runtimeReady(){if(this.g.stopping)return;this.owner=this.g.primary;this.frame=this.g.sessions.get(this.owner)?.frame;this.runtime=true;}
 bind(e,kind){if(this.closed)return;if(kind==='MAIN_HTML')this.mark('DOCUMENT_BOUND',kind);if(!content(kind))return;
  if(this.content.has(e.networkId)||this.content.size>=TOTAL_REQUESTS){this.overflow=true;return;}
  const pre=Object.entries(e.request.headers||{}).some(([k,v])=>['sec-purpose','purpose'].includes(k.toLowerCase())&&typeof v==='string'&&/prefetch/i.test(v));
  const row={kind,url:e.request.url,started:false,headers:false,eof:false,failed:false,status:null,speculative_marker:pre,ambiguous:false};this.content.set(e.networkId,row);this.matchStart(row,this.starts.get(e.networkId));this.mark('CONTENT_BOUND',kind);
 }
 matchStart(row,s){if(!s)return;if(s.session!==this.g.primary||s.frame!==this.frame||s.loader!==this.loader||s.url!==row.url||!this.loader)row.ambiguous=true;else row.started=true;}
 observe(m){const p=m?.params||{};if(m.sessionId!==this.g.primary)return;const notify=m.method==='Runtime.consoleAPICalled'&&p.type==='error'||m.method==='Runtime.exceptionThrown';
  if(this.closed){if(notify||m.method==='Network.loadingFailed')this.late=Math.min(120,this.late+1);return;}
  if(this.owner&&this.owner!==this.g.primary){this.lost=true;this.mark('SCOPE_LOST');return;}
  if(m.method==='Page.frameNavigated'&&p.frame?.id===this.g.sessions.get(this.g.primary)?.frame&&!p.frame.parentId){if(p.frame.url==='about:blank'&&!this.loader)return;if(p.frame.url!==TARGET||this.loader&&this.loader!==p.frame.loaderId){this.lost=true;this.mark('SCOPE_LOST');return;}this.frame=p.frame.id;this.loader=p.frame.loaderId;this.context=null;}
  if(m.method==='Runtime.executionContextCreated'&&p.context?.auxData?.frameId===this.frame&&p.context.auxData.isDefault===true&&Number.isInteger(p.context.id)&&this.loader)this.context=p.context.id;
  if(m.method==='Runtime.executionContextDestroyed'&&p.executionContextId===this.context||m.method==='Runtime.executionContextsCleared')this.context=null;
  if(notify){const ctx=m.method==='Runtime.exceptionThrown'?p.exceptionDetails?.executionContextId:p.executionContextId;if(!this.runtime||!this.loader||this.context===null||ctx!==this.context||this.lost)this.unscoped=Math.min(120,this.unscoped+1);else if(m.method==='Runtime.consoleAPICalled'){this.consoleErrors=Math.min(120,this.consoleErrors+1);this.mark('CONSOLE_ERROR');}else{this.uncaught=Math.min(120,this.uncaught+1);this.mark('UNCAUGHT_EXCEPTION');}}
  if(m.method==='Runtime.exceptionRevoked'&&this.runtime&&this.loader)this.mark('EXCEPTION_REVOKED');
  if(m.method==='Page.lifecycleEvent'&&p.name==='firstContentfulPaint'&&p.frameId===this.frame&&p.loaderId===this.loader)this.mark('FCP');
  if(m.method==='Network.requestWillBeSent'&&p.frameId===this.frame){if(this.starts.size>=TOTAL_REQUESTS&&!this.starts.has(p.requestId)){this.overflow=true;return;}this.starts.set(p.requestId,{session:m.sessionId,frame:p.frameId,loader:p.loaderId,url:p.request?.url});const r=this.content.get(p.requestId);if(r)this.matchStart(r,this.starts.get(p.requestId));}
  const prior=this.g.boundary.network.get(p.requestId),r=this.content.get(p.requestId);
  if(m.method==='Network.responseReceived'&&prior?.kind==='MAIN_HTML')this.mark(p.response?.status===200?'DOCUMENT_HTTP_200':'DOCUMENT_HTTP_OTHER','MAIN_HTML');
  if(m.method==='Network.loadingFailed'&&prior){this.networkFailures=Math.min(120,this.networkFailures+1);this.mark('NETWORK_FAILED',prior.kind);}
  if(r&&m.method==='Network.responseReceived'){r.headers=true;r.status=Number.isInteger(p.response?.status)&&p.response.status>=100&&p.response.status<=599?p.response.status:null;if(!r.started||p.response?.url!==r.url)r.ambiguous=true;this.mark('CONTENT_HEADERS',r.kind);}
  if(r&&m.method==='Network.loadingFinished'){if(!r.started||!r.headers||r.failed||r.eof)r.ambiguous=true;r.eof=true;this.mark('CONTENT_EOF',r.kind);}
  if(r&&m.method==='Network.loadingFailed'){r.failed=true;r.failure=classifyNetworkFailure(p).categories;this.mark('CONTENT_FAILED',r.kind);}
  if(['Network.loadingFinished','Network.loadingFailed'].includes(m.method))this.starts.delete(p.requestId);
 }
 stop(){this.closed=true;}
 snapshot(){const rows=[...this.content.values()];const known=this.runtime&&this.context!==null&&!!this.loader&&!this.lost&&!this.overflow;
  return{coverage:known?'SCOPED_WINDOW_WITH_PRE_CONTEXT_GAP':'UNKNOWN_OR_NOT_ENABLED',pre_context_gap:true,closed:this.closed,overflow:this.overflow,console_error:!known?'UNKNOWN':this.consoleErrors?'OBSERVED':'NOT_OBSERVED_IN_SCOPED_WINDOW',uncaught_exception:!known?'UNKNOWN':this.uncaught?'OBSERVED':'NOT_OBSERVED_IN_SCOPED_WINDOW',console_error_count:this.consoleErrors,uncaught_count:this.uncaught,unscoped_error_notifications:this.unscoped,network_failure_count:this.networkFailures,after_stop_or_cleanup_notifications:this.late,events:this.events.map(e=>({...e})),content:rows.map(r=>({kind:r.kind,started:r.started,headers:r.headers,network_eof:r.eof,failed:r.failed,status:r.status,speculative_marker:r.speculative_marker,binding:r.ambiguous?'AMBIGUOUS':r.started?'EXACT_SESSION_FRAME_LOADER_ID':'UNKNOWN',failure:r.failure??[],js_body_read:'NOT_OBSERVED'})),nuxt_handled_errors:'SEE_SEPARATE_EXISTING_HOOK_OR_PAYLOAD_EVIDENCE',exception_semantics:'CDP_NOTIFICATION_NOT_FINAL_UNHANDLED_STATE',ordering:'RECEIVED_NOTIFICATION_ORDER_NOT_CAUSAL'};
 }
}
