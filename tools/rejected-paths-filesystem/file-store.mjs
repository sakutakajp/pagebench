// Genuine disk implementation, exclusively for an exact synthetic fixture.
// It is NOT a replacement for the production private-delivery constructor.
import{mkdtempSync,lstatSync,realpathSync,openSync,writeSync,fsyncSync,closeSync,readSync,fstatSync,linkSync,unlinkSync,readFileSync,writeFileSync,readdirSync,rmSync,existsSync,constants}from'node:fs';
import{tmpdir}from'node:os';import{join,dirname,basename}from'node:path';import{createHash}from'node:crypto';
import{isProxy}from'node:util/types';
import{safeEnvelope,openPrivate}from'../rejected-paths-local/crypto.mjs';import{LIMITS}from'../rejected-paths-local/schema.mjs';import{publicKeyInfo}from'../origin-capture/retry-crypto.mjs';import{syntheticPayload,fixedScope}from'./contract.mjs';import{CASES}from'./config.mjs';
const brands=new WeakSet(),FILE='fixed-synthetic.sealed',hash=b=>createHash('sha256').update(b).digest('hex');
export const isLocalPrivateStore=v=>!!v&&brands.has(v);
export function writeFailure(name,phase,error,originalPreserved){let code;try{if(error&&typeof error==='object'&&!isProxy(error)){const d=Object.getOwnPropertyDescriptor(error,'code');if(d&&Object.hasOwn(d,'value'))code=d.value;}}catch{}return name==='write_conflict'&&phase==='PUBLISH'&&code==='EEXIST'&&originalPreserved===true?'WRITE_CONFLICT':'WRITE_UNCONFIRMED';}
export function createClosedFileStore({name,scope,publicKey,privateKey}){
 scope=fixedScope(scope);if(!scope||!CASES.includes(name)||typeof privateKey!=='string')throw Error('FIXTURE_SCOPE');const key=publicKeyInfo(publicKey).key_id;
 const base=realpathSync(tmpdir()),directory=mkdtempSync(join(base,'pagebench-private-rejections-closed-fixture-')),path=join(directory,FILE),tmp=path+'.tmp';
 let expected=null,disposed=false,firstFault=null,writeAttempted=false,created=false,reads=0,syntheticValidated=false,injectionConfirmed=false;
 const fault=code=>{firstFault??=code;throw Error('CLOSED_FILE_STORE_FAILURE');};
 const check=()=>{if(disposed)fault('DISPOSED');const s=lstatSync(directory);if(!s.isDirectory()||s.isSymbolicLink()||realpathSync(directory)!==directory||s.uid!==process.getuid()||(s.mode&0o777)!==0o700||!basename(directory).startsWith('pagebench-private-rejections-closed-fixture-'))fault('DIRECTORY_SCOPE');for(let p=directory;;p=dirname(p)){const g=join(p,'.git');if(existsSync(g)){const m=lstatSync(g);if(!m.isDirectory()||existsSync(join(g,'HEAD')))fault('REPOSITORY_SCOPE');}if(dirname(p)===p)break;}};
 const read=()=>{check();let fd;try{const s=lstatSync(path);if(!s.isFile()||s.isSymbolicLink()||s.uid!==process.getuid()||(s.mode&0o777)!==0o600||s.nlink!==1||s.size>LIMITS.envelope)fault('FILE_SCOPE');fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);const f=fstatSync(fd);if(f.ino!==s.ino||f.dev!==s.dev||f.size!==s.size)fault('FILE_CHANGED');const b=Buffer.alloc(s.size+1),n=readSync(fd,b,0,b.length,null);if(n!==s.size)fault('READ_LENGTH');reads++;return b.subarray(0,n);}finally{if(fd!==undefined)closeSync(fd);}};
 check();
 const store=Object.freeze({verify(){check();if(expected!==null&&hash(read())!==expected)fault('READBACK_CHANGED');return true;},write(envelope){
  check();const e=safeEnvelope(envelope);if(!e||e.key_id!==key||!syntheticPayload(openPrivate(e,privateKey,scope)))fault('NON_SYNTHETIC_OR_UNAUTHENTICATED');syntheticValidated=true;const text=JSON.stringify(e);if(Buffer.byteLength(text)>LIMITS.envelope)fault('BUDGET');
  if(expected!==null){store.verify();if(hash(text)!==expected)fault('REWRITE');return;}
  writeAttempted=true;if(name==='write_conflict')writeFileSync(path,'FIXED_PREEXISTING_SENTINEL',{flag:'wx',mode:0o600});let fd,temporary=false,operation='OPEN_TEMP';
  try{fd=openSync(tmp,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);temporary=true;operation='WRITE_TEMP';writeSync(fd,text);operation='SYNC_TEMP';fsyncSync(fd);closeSync(fd);fd=undefined;operation='PUBLISH';linkSync(tmp,path);unlinkSync(tmp);temporary=false;created=true;expected=hash(text);store.verify();
   if(name==='readback_change'){const changed=JSON.parse(text);changed.tag=(changed.tag[0]==='A'?'B':'A')+changed.tag.slice(1);const injected=JSON.stringify(changed);writeFileSync(path,injected,{flag:'w',mode:0o600});if(hash(read())!==hash(injected))fault('WRITE_UNCONFIRMED');injectionConfirmed=true;}
   store.verify();
  }catch(error){if(!firstFault){let preserved=false;if(name==='write_conflict'&&operation==='PUBLISH')try{preserved=read().equals(Buffer.from('FIXED_PREEXISTING_SENTINEL'));}catch{}firstFault??=writeFailure(name,operation,error,preserved);if(firstFault==='WRITE_CONFLICT')injectionConfirmed=true;}throw Error('CLOSED_FILE_STORE_FAILURE');}finally{if(fd!==undefined)closeSync(fd);if(temporary)try{unlinkSync(tmp);}catch{firstFault??='TEMP_CLEANUP';}}
 },toJSON(){return{kind:'ACTUAL_FILESYSTEM_STATIC_SYNTHETIC_ONLY'};}});brands.add(store);
 const evidence=()=>({write_attempted:writeAttempted,file_created:created,readbacks:Math.min(65535,reads),first_fault:firstFault,synthetic_validated:syntheticValidated,fault_injected:injectionConfirmed});
 return Object.freeze({store,readCipher(){store.verify();return JSON.parse(read());},evidence,dispose(){if(disposed)return{status:'already-disposed',directory_absent:!existsSync(directory)};let success=false;try{check();const names=readdirSync(directory);if(names.some(n=>![FILE,FILE+'.tmp'].includes(n)))fault('UNEXPECTED_DIRECTORY_ENTRY');rmSync(directory,{recursive:true,force:false});success=!existsSync(directory);}catch{firstFault??='FILE_CLEANUP';}disposed=true;return{status:success?'complete':'unknown',directory_absent:success};}});
}
