// CLOSED fixture evidence only. Never changes a policy decision, command or timing.
import{META,PAGE}from'./control.mjs';
const METHODS=['GET','HEAD','POST'],TYPES=['Document','Fetch','XHR','Image','Other'];
export const FIXTURE_PHASES=['OPEN','CONFIG','RUNTIME_ENABLE','GOTO','READINESS_SAMPLE','CLASSIFY','CLEANUP','DONE'];
// Fixed CLOSED fixture fingerprints only, not a live request permission.
// Chrome157.0.8103.78 has reported script fetch/POST as Fetch-paused XHR.
export const EXPECTED_STOP=Object.freeze({post:{code:'METHOD',method:'POST',types:['Fetch','XHR'],url:META},unapproved_api:{code:'SCOPE',method:'GET',types:['Fetch','XHR'],url:'https://staging.hirameki.dev/api/users'},external:{code:'ORIGIN',method:'GET',types:['Fetch','XHR'],url:'https://other.invalid/fixture'},navigation:{code:'NAVIGATION',method:'GET',types:['Document'],url:PAGE}});
const id=v=>typeof v==='string'&&v.length>0&&v.length<=256;
export class FixtureStopProof{
 #candidate=null;#owner=null;#frame=null;#command=null;#count=0;#ack=0;#sent=0;#forward=0;#invalid=false;#cleanup=false;
 constructor(g,mode){this.g=g;this.mode=mode;this.phase='OPEN';this.first=null;this.firstFatalPhase=null;}
 stage(v){if(FIXTURE_PHASES.includes(v))this.phase=v;else this.#invalid=true;}
 rejected(code,e){this.#count=Math.min(2,this.#count+1);if(this.#candidate){this.#invalid=true;return;}const g=this.g,s=g.sessions.get(g.primary);
  this.#owner=s;this.#frame=s?.frame;this.#candidate={request:e?.requestId,session:g.primary};this.first={fixture_url_match:typeof e?.request?.url==='string'&&e.request.url===EXPECTED_STOP[this.mode]?.url,code:['METHOD','SCOPE','ORIGIN','NAVIGATION'].includes(code)?code:'OTHER',method:METHODS.includes(e?.request?.method)?e.request.method:'OTHER',resource_type:TYPES.includes(e?.resourceType)?e.resourceType:'OTHER',phase:this.phase,bound_primary_frame:s?.ready===true&&id(g.primary)&&id(e?.requestId)&&e?.frameId===s.frame};
 }
 checkOwner(){if(this.#candidate&&(this.g.primary!==this.#candidate.session||this.g.sessions.get(this.#candidate.session)!==this.#owner||this.#owner?.ready!==true||this.#owner.frame!==this.#frame))this.#invalid=true;}
 fatal(){this.checkOwner();this.firstFatalPhase??=this.phase;}
 sent(raw,send){let m;try{if(typeof raw!=='string'||raw.length>1048576)throw Error();m=JSON.parse(raw);}catch{this.#invalid=true;return send();}
  const selected=this.#candidate&&m.params?.requestId===this.#candidate.request;
  if(selected&&['Fetch.continueRequest','Fetch.continueResponse','Fetch.fulfillRequest'].includes(m.method))this.#forward=Math.min(2,this.#forward+1);
  const abort=selected&&m.method==='Fetch.failRequest';if(abort){this.checkOwner();if(this.#command||!Number.isSafeInteger(m.id)||m.sessionId!==this.#candidate.session||m.params.errorReason!=='BlockedByClient'||this.g.stopping||this.#cleanup)this.#invalid=true;this.#command={id:m.id,session:m.sessionId};}
  const out=send();if(abort)this.#sent=Math.min(2,this.#sent+1);return out;
 }
 received(raw){if(!this.#command||typeof raw!=='string'||raw.length>1048576)return;let m;try{m=JSON.parse(raw);}catch{return;}if(m.id!==this.#command.id)return;
  this.checkOwner();this.#ack=Math.min(2,this.#ack+1);if(this.#ack!==1||m.sessionId!==this.#command.session||!this.g.pending?.has(m.id)||this.g.stopping||this.#cleanup||!m.result||typeof m.result!=='object'||Array.isArray(m.result)||Object.keys(m.result).length||Object.keys(m).some(k=>!['id','sessionId','result'].includes(k)))this.#invalid=true;
 }
 beginCleanup(){this.#cleanup=true;}
 snapshot(){return{candidate_count:this.#count,first_candidate:this.first?{...this.first}:null,first_fatal_phase:this.firstFatalPhase,abort_sent:this.#sent,abort_ack:this.#ack,selected_forward_or_fulfill:this.#forward,consistent:!this.#invalid};}
}
export function blockConfirmed(mode,proof,evidence,boundary){const x=EXPECTED_STOP[mode],p=proof?.first_candidate,r=evidence?.first_refusal;return !!x&&proof?.consistent===true&&proof.candidate_count===1&&proof.abort_sent===1&&proof.abort_ack===1&&proof.selected_forward_or_fulfill===0&&p?.bound_primary_frame===true&&p.code===x.code&&p.method===x.method&&p.fixture_url_match===true&&x.types.includes(p.resource_type)&&r?.category===x.code&&r.method===x.method&&r.resource_type===p.resource_type&&boundary?.boundary_reason===x.code&&boundary.documents===1&&boundary.http_status===200&&boundary.html===true&&evidence.first_fatal==='AB_BOUNDARY_REJECTED'&&evidence.emergency==='RETURNED'&&proof.first_fatal_phase!==null;}
export function closedTransport(p){return p?.forwarding_capability==='ABSENT'&&p.upstream_sockets_opened===0&&p.closed===true&&p.open_sockets===0;}
export function quietCleanup(cleanup,e,pending){return pending===0&&cleanup==='complete'&&e?.cleanup==='COMPLETE'&&e.receiver_active===0&&e.secondary_failures===0;}
export function nativeVerdict({mode,reason,error,proof,evidence,boundary,delivered,proxy,cleanup,pending}){
 const safe=closedTransport(proxy)&&quietCleanup(cleanup,evidence,pending),positive=!Object.hasOwn(EXPECTED_STOP,mode),block=blockConfirmed(mode,proof,evidence,boundary);
 const stoppedError=error===null||['TARGET_CLOSED','CONNECTION_CLOSED'].includes(error?.code)&&['GOTO','READINESS_SAMPLE'].includes(error.phase);
 const positiveOk=positive&&error===null&&reason==='RENDERED_SAME_DOCUMENT'&&proof?.consistent===true&&proof.candidate_count===0&&proof.abort_sent===0&&proof.abort_ack===0&&proof.selected_forward_or_fulfill===0&&!evidence?.first_fatal&&!evidence?.first_refusal&&evidence?.receiver_rejections===0&&boundary?.documents===1&&boundary.http_status===200&&boundary.html===true&&Object.keys(delivered||{}).sort().join(',')==='asset,html,image,metadata,page,payload'&&Object.values(delivered).every(x=>x===1);
 const status=safe&&(positiveOk||!positive&&block&&stoppedError)?'passed':'failed';
 // A known harmless fixture assertion failure can be recorded and the next isolated case run.
 // Unconfirmed blocking or physical cleanup/egress uncertainty stops the suite.
 // An unknown sampling exception still fails, but full independent block/cleanup proof
 // permits collecting the next CLOSED case; it never permits the live step.
 const next=safe&&(positive?error===null&&!evidence?.first_fatal&&proof?.consistent===true&&proof.candidate_count===0&&proof.abort_sent===0&&proof.abort_ack===0:block&&(error===null||['GOTO','READINESS_SAMPLE'].includes(error.phase)));
 return{status,block_confirmed:block,continuation:next?'SAFE_CLOSED_NEXT_CASE':'STOP_UNCERTAIN_SAFETY_OR_FAILURE'};
}
