import {originTuple,sealOrigin,safeEnvelope,binding,publicKeyInfo} from './retry-crypto.mjs';
// Synchronous first-refusal side observer. Never calls the wire or changes a verdict.
export function instrumentOrigin(Base,{publicKey,scope,emit=()=>{}}){
  const bound=binding(scope);publicKeyInfo(publicKey);
  return class extends Base{
    constructor(...a){super(...a);let current=null,first=false,state='NOT_OBSERVED',envelope=null;const g=this,b=this.boundary,reject=b.reject,request=this.request;
      b.reject=function(code,e){try{if(!first){first=true;
        if(b.policy!==null||g.stopEvidence.refusal!==null||g.stopping||g.stats.fatal)state='PRIOR_STOP_OR_UNKNOWN';
        else if(code!=='ORIGIN'||e?.request?.method!=='GET'||e?.resourceType!=='Script')state='FIRST_REJECTION_NOT_TARGET';
        else if(!current||current.event!==e||current.session!==g.primary||!g.createdPage||!g.sessions.get(g.primary)?.ready||e.frameId!==g.sessions.get(g.primary).frame)state='SCOPE_UNCONFIRMED';
        else{const p=originTuple(e.request);state=p.state;if(p.tuple){envelope=sealOrigin(p.tuple,publicKey,bound);state='SEALED';try{emit(safeEnvelope(envelope));}catch{state='WRITE_UNCONFIRMED';}}}
      }}catch{state='CAPTURE_FAILED';envelope=null;}return Reflect.apply(reject,this,[code,e]);};
      this.request=function(e,id){current={event:e,session:id};try{return Reflect.apply(request,this,[e,id]);}finally{current=null;}};
      this.originCapture=()=>({kind:'BOUNDED_FIRST_REJECTED_ORIGIN',state,envelope:envelope?safeEnvelope(envelope):null,semantics:'ORIGIN_ONLY_NOT_URL_NOT_CAUSAL',score_saved:false,report_saved:false});
    }
  };
}
