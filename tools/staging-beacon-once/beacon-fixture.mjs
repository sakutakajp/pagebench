// CLOSED-only synthetic fixture. All accepted reads are fulfilled from fixed RAM bytes.
import{fixtureGateway as original,html as oldHTML}from'../cloudflare-socket-closed/fixture.mjs';
import{forApprovedGateway}from'../staging-beacon-policy-v2/boundary.mjs';
import{TARGET}from'../staging-beacon-policy-v2/policy.mjs';
export const MODES=['canonical_script','versioned_script','non_js','post','redirect'];
export const CANONICAL='https://static.cloudflareinsights.com/beacon.min.js';
export const VERSIONED=CANONICAL+'/v'+'a'.repeat(32)+'1'.repeat(13);
export const selectedURL=mode=>mode==='canonical_script'?CANONICAL:VERSIONED;
export function html(mode){if(!MODES.includes(mode))throw Error('CLOSED_CASE');const base=oldHTML('script'),i=base.indexOf('let fixedArmed=false;');if(i<0||base.indexOf('let fixedArmed=false;',i+1)!==-1)throw Error('CLOSED_CASE');
 const action=mode==='post'?'fetch('+JSON.stringify(selectedURL(mode))+',{method:"POST",mode:"no-cors",credentials:"omit",body:"fixed"}).catch(()=>{})':'const x=document.createElement("script");x.src='+JSON.stringify(selectedURL(mode))+';document.head.append(x)';
 return base.slice(0,i)+'let fixedArmed=false;window.fixedArmNegative=()=>{if(fixedArmed)return{state:"DUPLICATE",scheduled:false};fixedArmed=true;setTimeout(()=>{'+action+'},250);return{state:"ARMED",scheduled:true}}</script></body></html>';
}
export function readBeacon(){return window.fixedBeaconLoaded===true;}
export function fixtureGateway(mode){if(!MODES.includes(mode))throw Error('CLOSED_CASE');return class extends forApprovedGateway(original('script')){
 constructor(...a){super(...a);this.beacon={scope_bound:false,fixture_match:false,decision:'NOT_SEEN',method:'UNKNOWN',type:'UNKNOWN',response:'NOT_SEEN',eof:false,duplicate:false};this.beaconId=null;this.beaconRequests=0;const check=this.boundary.check,g=this;
 this.boundary.check=e=>{const candidate=e.request?.url===selectedURL(mode)&&!g.stopping;let bound=false;if(candidate){const owner=g.sessions.get(g.primary);bound=!!g.arm&&g.current?.event===e&&g.current.session===g.arm.primary&&g.primary===g.arm.primary&&owner===g.arm.owner&&owner?.ready&&owner.frame===g.arm.frame&&e.frameId===g.arm.frame&&g.boundary.loader===g.arm.loader&&!g.stats.fatal&&g.closedPhase==='WAIT_STOP';}
 const result=check(e);if(candidate){if(g.beaconRequests++===0){g.beaconId=e.networkId;g.beacon.scope_bound=!!bound;g.beacon.fixture_match=mode==='post'?e.request.method==='POST'&&['XHR','Fetch'].includes(e.resourceType):e.request.method==='GET'&&e.resourceType==='Script';g.beacon.decision=['ALLOW','METHOD','SCOPE','REDIRECT','ORIGIN','CREDENTIAL','BINDING','NAVIGATION','LIMIT','URL'].includes(result)?result:'UNKNOWN';g.beacon.method=['GET','HEAD','POST'].includes(e.request.method)?e.request.method:'UNKNOWN';g.beacon.type=['Script','XHR','Fetch'].includes(e.resourceType)?e.resourceType:'UNKNOWN';}
 else if(!(mode==='redirect'&&result==='REDIRECT'&&e.redirectedRequestId!==undefined&&bound))g.beacon.duplicate=true;}return result;};
 }
 async receive(raw){try{const m=JSON.parse(raw),p=m.params||{},r=p.response??p.redirectResponse,owner=this.sessions.get(this.primary);if(this.beaconId&&m.sessionId===this.primary&&p.requestId===this.beaconId&&this.arm&&owner===this.arm.owner&&owner?.frame===this.arm.frame&&this.boundary.loader===this.arm.loader&&this.closedPhase==='WAIT_STOP'&&!this.stopping){
 if(r&&r.url===selectedURL(mode)&&['Network.responseReceived','Network.requestWillBeSent'].includes(m.method))this.beacon.response=r.status===302?'REDIRECT_302':r.status===200&&r.mimeType==='text/css'?'NON_JS_200':r.status===200&&r.mimeType==='text/javascript'?'JS_200':'UNKNOWN';if(m.method==='Network.loadingFinished')this.beacon.eof=true;
 }}catch{this.beacon.duplicate=true;}return super.receive(raw);}
 async start(e){if(this.stopping)return;if(e.request.url!==TARGET&&e.request.url!==selectedURL(mode))return super.start(e);
 if(!this.boundary.network.has(e.networkId)||this.active.has(e.networkId)){this.fail('AB_BOUNDARY_BINDING');return;}
 const document=e.request.url===TARGET;this.active.add(e.networkId);this.stats.max_inflight=Math.max(this.stats.max_inflight,this.active.size);if(document)this.delivered.document++;
 const responseCode=!document&&mode==='redirect'?302:200,type=document?'text/html':mode==='non_js'?'text/css':'text/javascript',body=document?html(mode):mode==='non_js'?'/* Fixed non-JS response */':mode==='redirect'?'':'window.fixedBeaconLoaded=true;';
 const headers=[{name:'Content-Type',value:type},{name:'Cache-Control',value:'public,max-age=60'}];if(responseCode===302)headers.push({name:'Location',value:selectedURL(mode)});
 await this.call('Fetch.fulfillRequest',{requestId:e.requestId,responseCode,responseHeaders:headers,body:Buffer.from(body).toString('base64')},this.primary);
 }
};}
