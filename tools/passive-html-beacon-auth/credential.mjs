// A single fixed GitHub read capability. Never serializes or exposes the credential.
const plain=v=>v&&Object.getPrototypeOf(v)===Object.prototype;
const keys=(v,w)=>plain(v)&&Object.keys(v).sort().join(',')===[...w].sort().join(',');
export function takeApiReader(env,transport=globalThis.fetch){
 let token,readFailed=false,cleared=false;
 try{token=env.GITHUB_TOKEN;}catch{readFailed=true;}
 try{delete env.GITHUB_TOKEN;cleared=!('GITHUB_TOKEN' in env);}catch{}
 const failure=status=>{token=null;return Object.freeze({status,read:async()=>{throw Error('API_AUTH_UNAVAILABLE');},dispose:()=>{}});};
 if(!cleared)return failure('ENV_UNCLEARED');
 if(readFailed||typeof token!=='string')return failure(token===undefined&&!readFailed?'MISSING':'INVALID');
 if(token==='')return failure('MISSING');
 if(token.length>4096||!/^[-A-Za-z0-9._~+/]+={0,2}$/.test(token))return failure('INVALID');
 let sha;try{sha=env.GITHUB_SHA;}catch{sha=null;}
 const target=typeof sha==='string'&&/^[a-f0-9]{40}$/.test(sha)?'https://api.github.com/repos/sakutakajp/pagebench/actions/runs?head_sha='+sha+'&event=push&per_page=100':null;
 let used=false;
 const dispose=()=>{token=null;used=true;};
 const read=async(url,options)=>{
  if(used||token===null)throw Error('API_READ_ALREADY_USED');
  used=true;let value=token;token=null;
  let valid=false;try{valid=target!==null&&url===target&&keys(options,['method','redirect','headers','signal'])&&options.method==='GET'&&options.redirect==='error'&&keys(options.headers,['Accept'])&&options.headers.Accept==='application/vnd.github+json'&&options.signal instanceof AbortSignal;}catch{}
  if(!valid){value=null;throw Error('API_REQUEST_BINDING');}
  const headers={Accept:'application/vnd.github+json',Authorization:'Bearer '+value};value=null;
  try{return await transport(url,{...options,headers});}finally{delete headers.Authorization;}
 };
 return Object.freeze({status:'READY',read,dispose});
}
