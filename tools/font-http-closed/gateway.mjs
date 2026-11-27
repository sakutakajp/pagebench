// Independent CLOSED fixture transport. Existing runtime/operational guards untouched.
import {FixtureGateway} from '../cdp-startup-diagnostic/fixture-gateway.mjs';
import {FontEvents} from './observer.mjs';
import {USES,DOCUMENT,FONT_A,FONT_B} from './config.mjs';
export class FontGateway extends FixtureGateway{
 constructor(...a){super(...a);this.mode='SINGLE';this.events=new FontEvents();this.continues=0;this.abortAck=0;this.localReason=null;this.total=0;this.fontActive=new Set();const send=this.wire.send,self=this;this.wire.send=function(raw){const result=Reflect.apply(send,this,[raw]);try{self.events.sent(JSON.parse(raw),self.primary);}catch{self.events.overflow=true;}return result;};}
 fetchPatterns(){return [{urlPattern:'*',requestStage:'Request'}];}
 async receive(raw){if(typeof raw==='string'&&raw.length<=1048576){let m;try{m=JSON.parse(raw);}catch{}if(m){this.events.reply(m);this.events.network(m,this.primary,this.sessions.get(this.primary)?.frame);if(m.sessionId===this.primary&&m.method==='Network.responseReceived'){
   const p=m.params||{},r=p.response;if([DOCUMENT,FONT_A,FONT_B].includes(r?.url)&&(!r||r.status!==200||r.fromServiceWorker||p.type==='Font'&&r.mimeType!=='font/ttf'))this.fail('FIXTURE_RESPONSE');
   if(r?.url===DOCUMENT&&r.status===200&&r.mimeType==='text/html')this.stats.html200=true;
  }if(m.sessionId===this.primary&&['Network.loadingFinished','Network.loadingFailed'].includes(m.method))this.fontActive.delete(m.params?.requestId);}}
  return super.receive(raw);
 }
 async request(e,id){const abort=async code=>{this.localReason??=code;await this.call('Fetch.failRequest',{requestId:e.requestId,errorReason:'BlockedByClient'},id);this.abortAck++;this.events.stop();this.fail('FIXTURE_STOP');};
  const r=e.request||{},frame=this.sessions.get(this.primary)?.frame;
  if(id!==this.primary||e.frameId!==frame)return abort('SCOPE');
  if(e.resourceType==='Font'&&e.redirectedRequestId)this.events.noteRedirect('FETCH');
  if(e.redirectedRequestId||Object.hasOwn(e,'responseStatusCode')||Object.hasOwn(e,'responseErrorReason'))return abort('STAGE_OR_REDIRECT');
  if(r.method!=='GET'||r.postData||Object.keys(r.headers||{}).some(k=>/^(cookie|authorization|proxy-authorization|x-api-key|x-goog-api-key)$/i.test(k)))return abort('METHOD_OR_CREDENTIAL');
  const doc=r.url===DOCUMENT&&e.resourceType==='Document',font=e.resourceType==='Font'&&(r.url===FONT_A||r.url===FONT_B&&USES[this.mode].b);
  if(!doc&&!font)return abort('FIXED_ROUTE');
  if(++this.total>64)return abort('LOCAL_EVENT_LIMIT');
  if(typeof e.networkId!=='string'||!e.networkId||typeof e.requestId!=='string'||!e.requestId)return abort('IDENTITY');
  if(doc&&++this.stats.fixture_documents!==1)return abort('NAVIGATION');
  if(font){const relation=this.events.pause(e,frame);if(relation==='DUPLICATE')return abort('DUPLICATE_FONT_ID');if(relation!=='FIRST'||this.events.overflow)return abort('OBSERVER_UNKNOWN');if(this.fontActive.size>=6)return abort('LOCAL_INFLIGHT_LIMIT');this.fontActive.add(e.networkId);}
  await this.call('Fetch.continueRequest',{requestId:e.requestId},id);this.continues++;
 }
 beginCleanup(){this.events.stop();return super.beginCleanup();}
}
