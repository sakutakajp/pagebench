// No logging, filesystem, network or browser calls. Only an origin tuple is sealed.
import {createPublicKey,createPrivateKey,publicEncrypt,privateDecrypt,randomBytes,
  createCipheriv,createDecipheriv,createHash,constants} from 'node:crypto';
import {isProxy} from 'node:util/types';
const descriptor=Object.getOwnPropertyDescriptor,hasOwn=Object.hasOwn;
export const REF='refs/heads/diag/first-origin-recovery-once-20261123';
export const MAX_URL=8192,PLAIN_BYTES=1024;
const own=(o,k)=>{try{if(!o||typeof o!=='object'||isProxy(o))return undefined;const d=descriptor(o,k);return d&&hasOwn(d,'value')?d.value:undefined;}catch{return undefined;}};
const invalid=()=>{throw Error('SEALED_ORIGIN_INVALID');};
export function binding(v){
  if(!v||isProxy(v)||Object.keys(v).sort().join(',')!=='attempt,mode,ref,repository,run_id,sha')invalid();
  const b={repository:own(v,'repository'),ref:own(v,'ref'),sha:own(v,'sha'),run_id:own(v,'run_id'),attempt:own(v,'attempt'),mode:own(v,'mode')};
  if(b.repository!=='sakutakajp/pagebench'||b.ref!==REF||typeof b.sha!=='string'||!/^[a-f0-9]{40}$/.test(b.sha)||b.attempt!==1||!['CLOSED','GHA'].includes(b.mode)||typeof b.run_id!=='string'||!(b.mode==='GHA'?/^[1-9][0-9]{0,23}$/:/^CLOSED_[A-Z0-9_]{1,48}$/).test(b.run_id))invalid();
  return b;
}
const aad=b=>Buffer.from(JSON.stringify({kind:'FIRST_ORIGIN_GET_SCRIPT',version:1,binding:binding(b)}));
export function publicKeyInfo(pem){const key=createPublicKey(pem);if(key.asymmetricKeyType!=='rsa'||key.asymmetricKeyDetails?.modulusLength!==3072||key.asymmetricKeyDetails?.publicExponent!==65537n)invalid();const der=key.export({type:'spki',format:'der'});return{key,key_id:createHash('sha256').update(der).digest('hex')};}
export function originTuple(request){
  const url=own(request,'url');if(typeof url!=='string')return{state:'URL_UNAVAILABLE',tuple:null};if(url.length>MAX_URL)return{state:'URL_TOO_LONG',tuple:null};
  try{const u=new URL(url);if(!/^[a-z][a-z0-9+.-]{0,31}:$/.test(u.protocol)||u.hostname.length>253||!/^[-a-zA-Z0-9._:\[\]]*$/.test(u.hostname))return{state:'ORIGIN_UNSUPPORTED',tuple:null};
    return{state:'READY',tuple:{scheme:u.protocol,hostname:u.hostname,port:u.port||null,
      port_semantics:u.port?'EXPLICIT_NONDEFAULT':'URL_NORMALIZED_DEFAULT_OR_ABSENT',
      userinfo:u.username.length||u.password.length?'PRESENT_VALUE_NOT_CAPTURED':'ABSENT'}};
  }catch{return{state:'URL_INVALID',tuple:null};}
}
function tuple(v){const keys=['scheme','hostname','port','port_semantics','userinfo'];if(!v||Object.keys(v).sort().join(',')!==keys.sort().join(',')||typeof v.scheme!=='string'||!/^[a-z][a-z0-9+.-]{0,31}:$/.test(v.scheme)||typeof v.hostname!=='string'||v.hostname.length>253||!/^[-a-zA-Z0-9._:\[\]]*$/.test(v.hostname)||v.port!==null&&(typeof v.port!=='string'||!/^[0-9]{1,5}$/.test(v.port)||Number(v.port)>65535)||v.port_semantics!==(v.port?'EXPLICIT_NONDEFAULT':'URL_NORMALIZED_DEFAULT_OR_ABSENT')||!['PRESENT_VALUE_NOT_CAPTURED','ABSENT'].includes(v.userinfo))invalid();return{scheme:v.scheme,hostname:v.hostname,port:v.port,port_semantics:v.port_semantics,userinfo:v.userinfo};}
export function sealOrigin(v,pem,scope){
  const p=tuple(v),b=binding(scope),info=publicKeyInfo(pem),context=aad(b),key=randomBytes(32),iv=randomBytes(12),plain=randomBytes(PLAIN_BYTES);
  try{const bytes=Buffer.from(JSON.stringify(p));if(bytes.length>PLAIN_BYTES-2)invalid();plain.writeUInt16BE(bytes.length);bytes.copy(plain,2);bytes.fill(0);
    const c=createCipheriv('aes-256-gcm',key,iv);c.setAAD(context);const data=Buffer.concat([c.update(plain),c.final()]);
    const wrapped=publicEncrypt({key:info.key,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256',oaepLabel:createHash('sha256').update(context).digest()},key);
    return{kind:'FIRST_ORIGIN_GET_SCRIPT_SEALED',version:1,algorithm:'RSA3072_OAEP_SHA256_AES256_GCM',binding:b,key_id:info.key_id,iv:iv.toString('base64'),wrapped_key:wrapped.toString('base64'),ciphertext:data.toString('base64'),tag:c.getAuthTag().toString('base64')};
  }finally{key.fill(0);plain.fill(0);}
}
const fields=['algorithm','binding','ciphertext','iv','key_id','kind','tag','version','wrapped_key'];
const decode=(s,n)=>{if(typeof s!=='string'||s.length!==4*Math.ceil(n/3)||!/^[A-Za-z0-9+/]*={0,2}$/.test(s))invalid();const b=Buffer.from(s,'base64');if(b.length!==n||b.toString('base64')!==s)invalid();return b;};
export function safeEnvelope(raw){try{if(!raw||typeof raw!=='object'||isProxy(raw)||Object.keys(raw).sort().join(',')!==fields.join(','))return null;const v=Object.fromEntries(fields.map(k=>[k,own(raw,k)]));if(!v||v.kind!=='FIRST_ORIGIN_GET_SCRIPT_SEALED'||v.version!==1||v.algorithm!=='RSA3072_OAEP_SHA256_AES256_GCM'||typeof v.key_id!=='string'||!/^[a-f0-9]{64}$/.test(v.key_id))return null;decode(v.iv,12);decode(v.wrapped_key,384);decode(v.ciphertext,PLAIN_BYTES);decode(v.tag,16);return{kind:v.kind,version:1,algorithm:v.algorithm,binding:binding(v.binding),key_id:v.key_id,iv:v.iv,wrapped_key:v.wrapped_key,ciphertext:v.ciphertext,tag:v.tag};}catch{return null;}}
// PRIVATE LOCAL USE ONLY. Returns RAM data; no CLI or output path for plaintext.
export function openOrigin(envelope,privatePem,expected){let key,plain;try{const v=safeEnvelope(envelope);if(!v||JSON.stringify(v.binding)!==JSON.stringify(binding(expected)))invalid();const privateKey=createPrivateKey(privatePem),info=publicKeyInfo(createPublicKey(privateKey).export({type:'spki',format:'pem'}));if(v.key_id!==info.key_id)invalid();const context=aad(v.binding);key=privateDecrypt({key:privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256',oaepLabel:createHash('sha256').update(context).digest()},decode(v.wrapped_key,384));if(key.length!==32)invalid();const d=createDecipheriv('aes-256-gcm',key,decode(v.iv,12));d.setAAD(context);d.setAuthTag(decode(v.tag,16));plain=Buffer.concat([d.update(decode(v.ciphertext,PLAIN_BYTES)),d.final()]);const n=plain.readUInt16BE();if(n>PLAIN_BYTES-2)invalid();return tuple(JSON.parse(plain.subarray(2,n+2)));}catch{invalid();}finally{key?.fill(0);plain?.fill(0);}}
