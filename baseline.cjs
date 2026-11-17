/* Local immutable snapshots, sharing render.cjs capture and comparison semantics. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const {capture,compare,hash}=require('./render.cjs');
const VERSION=1;
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
function publicData(v){
  const s=JSON.stringify(v);
  if(/authorization|x-goog-api-key|(?:password|cookie|credential|access_token|api_key)\s*["']?\s*[:=]|AIza[\w-]{30,}|gh[pousr]_[\w]{20,}|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|https?:\/\/[^\s/"\\]+:[^\s/"\\]+@/i.test(s))throw Error('SENSITIVE_DATA_REJECTED');
}
function write(file,data,exclusive=false){
  publicData(data);
  const temp=file+'.'+crypto.randomUUID()+'.tmp';
  const fd=fs.openSync(temp,'wx',0o600);
  try{fs.writeFileSync(fd,JSON.stringify(data,null,2));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  try{if(exclusive)fs.linkSync(temp,file);else fs.renameSync(temp,file);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
  const dir=fs.openSync(path.dirname(file),'r');try{fs.fsyncSync(dir);}finally{fs.closeSync(dir);}
}
function manifest(file){return JSON.parse(execFileSync('python3',['-c','from common import manifest; import json,sys; print(json.dumps(manifest(sys.argv[1])))',path.resolve(file)],{cwd:__dirname,encoding:'utf8'}));}
function profile(file){
  const c=read(file),allowed=['origin','build_label','data_policy','actions','asset_origins','executable_path'];
  if(Object.keys(c).some(k=>!allowed.includes(k))||c.data_policy!=='public-reviewed')throw Error('PROFILE');
  const u=new URL(c.origin);
  if(u.origin!==c.origin||u.username||u.password||!(u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname))))throw Error('ORIGIN');
  if(c.build_label!==undefined && (typeof c.build_label!=='string'||!/^[-\w.]{1,80}$/.test(c.build_label)))throw Error('BUILD_LABEL');
  if(c.asset_origins!==undefined && (!Array.isArray(c.asset_origins)||c.asset_origins.some(value=>{
    const a=new URL(value);return a.origin!==value||a.username||a.password||a.protocol!=='https:';
  })))throw Error('ASSET_ORIGIN');
  if(c.actions!==undefined && (!Array.isArray(c.actions)||c.actions.length>100))throw Error('ACTIONS');
  for(const a of c.actions||[]){
    if(Object.keys(a).some(k=>!['path','ready','steps'].includes(k))||typeof a.path!=='string'||a.path.length>500||!Array.isArray(a.steps)||a.steps.length>20)throw Error('ACTIONS');
    new RegExp(a.path);
    if(a.ready!==undefined && typeof a.ready!=='string')throw Error('ACTIONS');
    for(const step of a.steps){
      if(Object.keys(step).some(k=>!['action','selector','value'].includes(k))||!['click','fill','expectText'].includes(step.action)||typeof step.selector!=='string'||step.selector.length>500)throw Error('ACTIONS');
      if(step.action!=='click'&&(typeof step.value!=='string'||step.value.length>1000))throw Error('ACTIONS');
    }
  }
  publicData(c);return c;
}
function contract(c,browser){return {version:VERSION,browser,viewport:{width:412,height:823},dpr:1.75,locale:'ja-JP',timezone:'UTC',normalization:'render-exact-v1',
  actions:c.actions||[],asset_origins:c.asset_origins||[],
  source_hash:hash(['render.cjs','baseline.cjs','common.py'].map(f=>fs.readFileSync(path.join(__dirname,f),'utf8')))};}
function privateDir(folder){
  if(fs.existsSync(folder)){const st=fs.lstatSync(folder);if(!st.isDirectory()||st.isSymbolicLink()||(st.mode&0o077)!==0)throw Error('PRIVATE_DIRECTORY_REQUIRED');}
  else fs.mkdirSync(folder,{recursive:true,mode:0o700});
}
function summary(s){const counts={};for(const e of Object.values(s.entries))counts[e.status]=(counts[e.status]||0)+1;return {target:s.urls.length,processed:Object.keys(s.entries).length,pending:s.urls.length-Object.keys(s.entries).length,counts};}
function validateState(s,m,c,fingerprint){
  if(s.version!==VERSION||s.manifest_hash!==m.sha256||hash(s.urls)!==hash(m.records.map(r=>r.url))||s.origin!==c.origin||s.build_label!==(c.build_label||null)||s.fingerprint!==fingerprint)throw Error('RESUME_IDENTITY');
}
async function captureRun(mfile,cfile,folder,limit){
  if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('LIMIT');
  const m=manifest(mfile),c=profile(cfile);publicData(m);
  privateDir(folder);
  let browser,lock;
  const stateFile=path.join(folder,'state.json'),sealFile=path.join(folder,'frozen.json');
  try{
    browser=await chromium.launch(c.executable_path?{executablePath:c.executable_path}:{});
    const settings=contract(c,browser.version()),fingerprint=hash(settings);
    if(fs.existsSync(sealFile)){
      const s=loadFrozen(folder);validateState(s,m,c,fingerprint);return {...summary(s),frozen:true,id:s.id};
    }
    lock=fs.openSync(path.join(folder,'running.lock'),'wx',0o600);
    let s;
    if(fs.existsSync(stateFile)){s=read(stateFile);validateState(s,m,c,fingerprint);}
    else{
      if(fs.readdirSync(folder).some(f=>f!=='running.lock'))throw Error('UNOWNED_DIRECTORY');
      s={version:VERSION,id:crypto.randomUUID(),manifest_hash:m.sha256,urls:m.records.map(r=>r.url),origin:c.origin,build_label:c.build_label||null,settings,fingerprint,entries:{}};
    }
    for(const e of Object.values(s.entries))if(e.status==='in_flight')e.status='interrupted_unverified';
    write(stateFile,s);
    for(let i=0;i<s.urls.length&&limit;i++){
      if(s.entries[i])continue;
      s.entries[i]={status:'in_flight'};write(stateFile,s);
      try{
        const snapshot=await capture(browser,c.origin,new URL(s.urls[i]).pathname,{...c,persist_public:true});
        publicData(snapshot);
        const page={version:VERSION,url:s.urls[i],snapshot};const name=String(i).padStart(6,'0')+'.json';
        write(path.join(folder,name),page,true);
        s.entries[i]={status:'captured',sha256:hash(page)};
      }catch{s.entries[i]={status:'failed_unverified',reason:'CAPTURE_OR_DATA_REJECTED'};}
      write(stateFile,s);limit--;
    }
    const report=summary(s);
    if(!report.pending)write(sealFile,{version:VERSION,state_hash:hash(s)},true);
    return {...report,frozen:!report.pending,id:s.id};
  }finally{if(browser)await browser.close();if(lock!==undefined){fs.closeSync(lock);fs.unlinkSync(path.join(folder,'running.lock'));}}
}
function loadFrozen(folder){
  const seal=read(path.join(folder,'frozen.json')),s=read(path.join(folder,'state.json'));
  if(seal.version!==VERSION||s.version!==VERSION||seal.state_hash!==hash(s)||hash(s.settings)!==s.fingerprint||Object.keys(s.entries).length!==s.urls.length)throw Error('INVALID_BASELINE');
  for(let i=0;i<s.urls.length;i++){
    const e=s.entries[i];if(!e||!['captured','failed_unverified','interrupted_unverified'].includes(e.status))throw Error('INVALID_ENTRY');
    if(e.status==='captured'){
      const page=read(path.join(folder,String(i).padStart(6,'0')+'.json'));
      if(page.url!==s.urls[i]||page.version!==VERSION||hash(page)!==e.sha256)throw Error('PAGE_INTEGRITY');
      publicData(page);
    }
  }
  return s;
}
function compareRuns(before,after,out){
  for(const dir of [before,after]){const relative=path.relative(path.resolve(dir),path.resolve(out));if(relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative)))throw Error('BASELINE_OUTPUT_FORBIDDEN');}
  const a=loadFrozen(before),b=loadFrozen(after);
  if(a.manifest_hash!==b.manifest_hash||hash(a.urls)!==hash(b.urls)||a.fingerprint!==b.fingerprint)throw Error('INCOMPATIBLE_BASELINES');
  const result={version:VERSION,before_id:a.id,after_id:b.id,manifest_hash:a.manifest_hash,fingerprint:a.fingerprint,results:[],counts:{}};
  for(let i=0;i<a.urls.length;i++){
    let row;
    if(a.entries[i].status!=='captured'||b.entries[i].status!=='captured')row={status:'unverified',before:a.entries[i].status,after:b.entries[i].status};
    else row=compare(read(path.join(before,String(i).padStart(6,'0')+'.json')).snapshot,read(path.join(after,String(i).padStart(6,'0')+'.json')).snapshot);
    result.results.push({url:a.urls[i],...row});result.counts[row.status]=(result.counts[row.status]||0)+1;
  }
  write(out,result,true);return {target:a.urls.length,counts:result.counts};
}
module.exports={captureRun,compareRuns,loadFrozen,hash};
if(require.main===module){
  const [command,...a]=process.argv.slice(2);
  Promise.resolve().then(()=>command==='capture'?captureRun(a[0],a[1],a[2],Number(a[3])):command==='compare'?compareRuns(a[0],a[1],a[2]):Promise.reject(Error('COMMAND')))
    .then(r=>console.log(JSON.stringify(r))).catch(()=>{console.log('{"status":"failed","reason":"BASELINE_COMMAND_FAILED"}');process.exitCode=1;});
}
