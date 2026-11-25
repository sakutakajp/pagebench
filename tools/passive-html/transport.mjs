import https from 'node:https';
import {lookup as dnsLookup} from 'node:dns/promises';
import {publicIPv4} from '../cdp-startup-diagnostic/staging-egress.mjs';
import {TARGET,HOST,HEADERS,MAX_BODY,MAX_HEADERS,MAX_LINK,DEADLINE} from './config.mjs';
export const REASONS=['NONE','ADMISSION','DNS','TLS','NETWORK','TIMEOUT','REDIRECT','HTTP','HEADERS','MIME','ENCODING','OVERSIZE','TRUNCATED','PARSER','STORAGE','UNKNOWN'];
const reject=code=>{throw Error(code);};
export async function getDocument({lookup=dnsLookup,request=https.request,onPhase=()=>{},deadlineMs=DEADLINE}={}){
 let timer,req,res,socket,requests=0,phase='DNS',http=null,reason='UNKNOWN',chunks=[],bytes=0,result,closed=false,socketClosed=false,closePromise;
 const change=p=>{phase=p;onPhase(p);};
 let cancel;
 const expired=new Promise((_,no)=>{cancel=()=>no(Error('TIMEOUT'));timer=setTimeout(cancel,Number.isInteger(deadlineMs)&&deadlineMs>0&&deadlineMs<=DEADLINE?deadlineMs:DEADLINE);});
 try{
  const records=await Promise.race([lookup(HOST,{all:true,family:4,verbatim:true}),expired]);
  if(!Array.isArray(records)||records.length<1||records.length>16||records.some(r=>r.family!==4||!publicIPv4(r.address)))reject('DNS');
  const address=records[0].address;change('REQUEST');
  const body=await Promise.race([new Promise((yes,no)=>{
   let ended=false;
   const fail=code=>{if(!ended){ended=true;no(Error(code));}};
   const options={protocol:'https:',hostname:HOST,port:443,path:'/ja/',method:'GET',headers:{...HEADERS},agent:false,rejectUnauthorized:true,servername:HOST,maxHeaderSize:MAX_HEADERS,family:4,
    lookup:(name,options,callback)=>{if(name!==HOST)return callback(Error('DNS'));callback(null,options?.all?[{address,family:4}]:address,4);}};
   requests++;req=request(options,r=>{
    res=r;change('HEADERS');http=Number.isInteger(r.statusCode)&&r.statusCode>=100&&r.statusCode<=599?r.statusCode:null;
    if(http!==200)return fail(http>=300&&http<400?'REDIRECT':'HTTP');
    const h=r.headers;
    if(!h||h['www-authenticate']||h['proxy-authenticate']||h['set-cookie']||h.location||/\bprivate\b|\bno-store\b/i.test(h['cache-control']||''))return fail('HEADERS');
    if(typeof h['content-type']!=='string'||!/^text\/html(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/i.test(h['content-type']))return fail('MIME');
    if(h['content-encoding']&&h['content-encoding']!=='identity')return fail('ENCODING');
    if(h['content-length']!==undefined&&(!/^\d{1,10}$/.test(h['content-length'])||Number(h['content-length'])>MAX_BODY))return fail('OVERSIZE');
    if(h.link!==undefined&&(typeof h.link!=='string'||Buffer.byteLength(h.link)>MAX_LINK))return fail('HEADERS');
    change('BODY');
    r.on('data',b=>{if(ended)return;if(!Buffer.isBuffer(b)||bytes+b.length>MAX_BODY){fail('OVERSIZE');return;}bytes+=b.length;chunks.push(b);});
    r.on('aborted',()=>fail('TRUNCATED'));r.on('error',()=>fail('NETWORK'));
    r.on('end',()=>{if(ended)return;if(r.complete!==true)return fail('TRUNCATED');if(h['content-length']!==undefined&&Number(h['content-length'])!==bytes)return fail('TRUNCATED');ended=true;yes({bytes:Buffer.concat(chunks),link:h.link??''});});
   });
   closePromise=new Promise(resolve=>{
    const check=()=>{if(closed&&(!socket||socketClosed))resolve();};
    req.once('close',()=>{closed=true;check();});
    req.on('socket',s=>{if(socket){fail('NETWORK');return;}socket=s;socket.once('close',()=>{socketClosed=true;check();});});
   });
   req.on('error',e=>fail(typeof e?.code==='string'&&/^(CERT_|ERR_TLS_|DEPTH_ZERO_|UNABLE_TO_)/.test(e.code)?'TLS':'NETWORK'));
   req.end();
  }),expired]);
  change('DECODE');let html;try{html=new TextDecoder('utf-8',{fatal:true}).decode(body.bytes);}catch{reject('ENCODING');}
  if(/<meta\b[^>]{0,512}\bcharset\s*=\s*["']?(?!utf-8\b)[a-z0-9_-]+/i.test(html))reject('ENCODING');
  change('COMPLETE');reason='NONE';return result={ok:true,phase,reason,requests,http,html,link:body.link};
 }catch(e){reason=REASONS.includes(e?.message)?e.message:phase==='DNS'?'DNS':'UNKNOWN';return result={ok:false,phase,reason,requests,http};}
 finally{clearTimeout(timer);res?.destroy();req?.destroy();socket?.destroy();chunks.length=0;
  if(req&&(!closed||socket&&!socketClosed)){let t;await Promise.race([closePromise,new Promise(r=>t=setTimeout(r,1000))]);clearTimeout(t);}
  const complete=closed&&(!socket||socketClosed);
  if(result){result.cleanup=!req?'NOT_STARTED':complete?'CLOSED':'UNKNOWN';if(req&&!complete){result.ok=false;result.reason='NETWORK';delete result.html;delete result.link;}}
 }
}
