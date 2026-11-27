// READ-ONLY comparison state. Raw identities/URLs only in bounded RAM.
import {FONT_A,FONT_B} from './config.mjs';
export class FontEvents{
 constructor(){this.rows=new Map();this.starts=0;this.pauses=0;this.overflow=false;this.duplicate='NONE_OBSERVED';this.binding='UNKNOWN';this.late=0;this.stopped=false;this.documentLoader=null;this.commands=new Map();this.handles=new Map();this.firstContinue='NOT_SENT';this.secondOrder='NOT_OBSERVED';this.redirect='NONE_OBSERVED';}
 row(id){if(typeof id!=='string'||id.length<1||id.length>256)return null;if(!this.rows.has(id)){if(this.rows.size>=32){this.overflow=true;return null;}this.rows.set(id,{start:null,handles:new Set(),response:false,terminal:false});}return this.rows.get(id);}
 network(m,primary,frame){if(this.stopped){this.late=Math.min(64,this.late+1);return;}if(m.sessionId!==primary)return;const p=m.params||{};
  if(m.method==='Network.requestWillBeSent'&&p.type==='Document'&&p.frameId===frame&&p.request?.url==='http://127.0.0.1:47500/fixture'&&typeof p.loaderId==='string'&&p.loaderId&&!p.redirectResponse){this.documentLoader=p.loaderId;this.documentFrame=frame;}
  if(m.method==='Network.requestWillBeSent'&&p.type==='Font'){
   const r=this.row(p.requestId);if(p.redirectResponse)this.noteRedirect('NETWORK');if(!r){this.overflow=true;return;}this.starts=Math.min(64,this.starts+1);if(r.start){this.overflow=true;return;}
   r.start={url:p.request?.url,method:p.request?.method,frame:p.frameId,loader:p.loaderId,document:p.documentURL,redirect:!!p.redirectResponse};if(p.redirectResponse)this.noteRedirect('NETWORK');
  }
  const r=this.rows.get(p.requestId);if(!r)return;if(m.method==='Network.responseReceived')r.response=true;if(['Network.loadingFinished','Network.loadingFailed'].includes(m.method))r.terminal=true;
 }
 pause(e,frame){if(this.stopped)return 'STOPPED';this.pauses=Math.min(64,this.pauses+1);const r=this.row(e.networkId);if(!r){this.overflow=true;return 'UNKNOWN';}
  const duplicate=r.handles.size>0,same=r.handles.has(e.requestId);if(r.handles.size>=32){this.overflow=true;return 'UNKNOWN';}r.handles.add(e.requestId);
  if(!duplicate){this.handles.set(e.requestId,r);r.continue='NOT_SENT';return 'FIRST';}
  this.duplicateRow??=r;this.firstContinue=this.duplicateRow.continue??'UNKNOWN';
  this.secondOrder=r.continue==='NOT_SENT'?'BEFORE_SEND':r.continue==='SENT_PENDING_ACK'?'PENDING_ACK':r.continue==='ACKED'?'AFTER_ACK':'UNKNOWN';
  const s=r.start,match=!this.overflow&&s&&s.frame===frame&&this.documentLoader!==null&&s.loader===this.documentLoader&&s.document==='http://127.0.0.1:47500/fixture'&&!s.redirect&&s.url===e.request?.url&&[FONT_A,FONT_B].includes(s.url)&&s.method==='GET'&&e.frameId===frame&&e.resourceType==='Font'&&!Object.hasOwn(e,'responseStatusCode')&&!Object.hasOwn(e,'responseErrorReason')&&!e.redirectedRequestId;
  this.binding=match?'PRIMARY_FRAME_REQUEST_METADATA_MATCH':'UNKNOWN_OR_CONFLICT';
  this.duplicate=same?'SAME_FETCH_HANDLE_REDELIVERY':match&&!r.response&&!r.terminal?'SAME_NETWORK_NEW_FETCH_BEFORE_RESPONSE':'DUPLICATE_OTHER_OR_UNKNOWN';return 'DUPLICATE';
 }
 noteRedirect(kind){const next=kind==='NETWORK'?'NETWORK_REDIRECT':'FETCH_INDICATOR';this.redirect=this.redirect==='NONE_OBSERVED'||this.redirect===next?next:'BOTH';}
 sent(m,primary){if(this.stopped||m.sessionId!==primary||m.method!=='Fetch.continueRequest')return;const r=this.handles.get(m.params?.requestId);if(!r)return;if(this.commands.size>=32||r.continue!=='NOT_SENT'){this.overflow=true;r.continue='UNKNOWN';if(!this.duplicateRow||r===this.duplicateRow)this.firstContinue='UNKNOWN';return;}this.commands.set(m.id,r);r.continue='SENT_PENDING_ACK';if(!this.duplicateRow||r===this.duplicateRow)this.firstContinue='SENT_PENDING_ACK';}
 reply(m){if(this.stopped||!this.commands.has(m.id))return;const r=this.commands.get(m.id);r.continue=m.error?'ACK_ERROR':'ACKED';if(!this.duplicateRow||r===this.duplicateRow)this.firstContinue=r.continue;this.commands.delete(m.id);}
 stop(){this.stopped=true;}
 snapshot(){const complete=this.documentLoader!==null&&!this.overflow&&this.rows.size>0&&[...this.rows.values()].every(r=>r.start&&r.start.frame===this.documentFrame&&r.start.loader===this.documentLoader&&r.start.document==='http://127.0.0.1:47500/fixture'&&[FONT_A,FONT_B].includes(r.start.url)&&r.start.method==='GET'&&!r.start.redirect&&r.handles.size===1&&r.response&&r.terminal);return {network_font_starts:this.starts,font_pauses:this.pauses,logical_font_ids:this.rows.size,duplicate:this.duplicate,binding:this.binding,first_continue:this.firstContinue,second_pause_vs_continue:this.secondOrder,redirect:this.redirect,coverage:complete?'COMPLETE_BOUNDED_WINDOW':'UNKNOWN_OR_INCOMPLETE',overflow:this.overflow,late_after_stop:this.late,historical_identity:'NOT_ESTABLISHED'};}
}
