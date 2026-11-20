// Offline investigation: execute the exact workflow wrapper with inert boundaries.
// No browser, DNS, HTTP, child process, credentials or live payload is used.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {liveReport} from './staging-once.mjs';
import {safeInputLimitDiagnostic} from './fixture-gateway.mjs';
import {STAGING_TARGET} from './staging-gateway.mjs';
const workflow='.github/workflows/staging-result-evidence-once-20261120.yml';
const yaml=await readFile(new URL('../../'+workflow,import.meta.url),'utf8');
function wrapper(s){return s.split('      - name: Exactly one authorized staging ja navigation\n')[1].split("          node --input-type=module <<'JS'\n")[1].split('\n          JS')[0].split('\n').map(l=>l.slice(10)).join('\n');}
const code=wrapper(yaml);
const executable=code.split('\n').filter(l=>!l.startsWith('import')).join('\n');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const run=new AsyncFunction('spawnSync','readFile','writeFile','appendFile','createHash','safeInputLimitDiagnostic','STAGING_TARGET','process','console',executable);
const clone=x=>structuredClone(x);
const fail=()=>({kind:'restricted-staging-lighthouse-cli',status:'measurement_failed',stage:'LIGHTHOUSE',reason:'LIVE_RESULT_SCOPE',performance:null,documents:1,http_status:200,cleanup:'complete',runtime_error_code:null,response_diagnostic:{counts:{LIGHTHOUSE_START:1,LIGHTHOUSE_RETURN:1}},cdp_stages:{cause:'NOT_ATTRIBUTED',events:[],counts:{},outstanding:{TRACE_START:0,TRACE_END:0,TRACE_READ:0,SCRIPT_SOURCE:0},observation:'OBSERVED',phase:'CLEANUP',complete:true,limitation:null}});
const trace=()=>({observation:'OWN_TRACE',adoptable:true,reads:2,completed:2,bytes:42,eof:true,close_confirmed:true,pending:0,uncommitted:0,phase:'CLEANUP',failure:null,late_events:0});
function lhr(){return{requestedUrl:STAGING_TARGET,finalUrl:STAGING_TARGET,finalDisplayedUrl:STAGING_TARGET,mainDocumentUrl:STAGING_TARGET,lighthouseVersion:'13.6.0',fetchTime:'2026-11-20T00:00:00.000Z',environment:{benchmarkIndex:100},configSettings:{formFactor:'mobile',throttlingMethod:'simulate',throttling:{rttMs:300,throughputKbps:800,cpuSlowdownMultiplier:6},disableStorageReset:false,screenEmulation:{}},categories:{performance:{score:0.75}},audits:Object.fromEntries(['first-contentful-paint','largest-contentful-paint','total-blocking-time','cumulative-layout-shift','speed-index'].map(k=>[k,{numericValue:1}]))};}
function context(){return{chrome:'Chrome/157.0.8103.78',gateway:{traceReads:{adoptable:()=>true},fonts:{snapshot:()=>({adoptable:true})},stats:{fatal:null,live_documents:1,html200:true,html_validated:true,http_status:200}},proxy:{stats:{}}};}
function success(){const d={...fail(),status:'success',reason:undefined,json_readback:true,screenshots_saved:0,requested_url:STAGING_TARGET,final_url:STAGING_TARGET,final_displayed_url:STAGING_TARGET,performance:75,metrics:{fcp:1,lcp:2,tbt:3,cls:0,si:4},trace_read:trace()};return d;}
async function execute(d,options={}){
 const logs=[],writes=new Map(),summaries=[];let calls=0,reads=[];
 const report=JSON.stringify(options.report??{performance:d?.performance,metrics:d?.metrics});
 if(d?.status==='success'&&d.report_sha256===undefined)d.report_sha256=createHash('sha256').update(report).digest('hex');
 const p={execPath:process.execPath,env:{GITHUB_SHA:'a'.repeat(40),GITHUB_STEP_SUMMARY:'PRIVATE_SUMMARY'},exitCode:0};
 await run((command,args,opts)=>{calls++;assert.equal(command,'env');assert.deepEqual(args,['-u','GITHUB_STEP_SUMMARY',process.execPath,'tools/cdp-startup-diagnostic/staging-once.mjs','--execute']);assert.equal(opts.timeout,150000);return{status:options.childStatus??0,stdout:'PRIVATE_CHILD_BODY',stderr:'PRIVATE_CHILD_ERROR'};},async path=>{reads.push(path);if(path==='staging-lighthouse-status.json'){if(options.missing)throw Error('PRIVATE_IO_ERROR');return options.raw??JSON.stringify(d);}assert.equal(path,'staging-lighthouse-report.json');return Buffer.from(report);},async(path,text,opts)=>{assert.equal(path,'public-stage-result.json');assert.equal(opts.mode,0o600);writes.set(path,text);},async(path,text)=>summaries.push(text),createHash,safeInputLimitDiagnostic,STAGING_TARGET,p,{log:s=>logs.push(s)});
 assert.equal(calls,1);assert.equal(writes.size,1);const text=writes.get('public-stage-result.json');assert.deepEqual(logs,[text]);assert(![...logs,...summaries].some(s=>s.includes('PRIVATE_')));
 const result=JSON.parse(text);if(result.status!=='success'){assert.equal(result.performance,null);assert.equal(result.metrics??null,null);assert.notEqual(result.json_readback,true);assert.equal(p.exitCode,1);if(d?.status!=='success')assert(!reads.includes('staging-lighthouse-report.json'));}
 return{result,reads,exitCode:p.exitCode,text};
}
const cases=[];
const add=(hypothesis,condition,check)=>cases.push({hypothesis,condition,check});
add('正常な完全レポートは診断追加でも採用できる','実liveReportの正常入力＋wrapper保存・読戻し',async()=>{assert.equal(liveReport(lhr(),context()).performance,75);const{result,exitCode}=await execute(success());assert.equal(exitCode,0);assert.equal(result.performance,75);assert.equal(result.json_readback,true);assert.equal(result.lighthouse_outcome,'RETURNED');});
function native(hypothesis,condition,mutate,reason,runtime=null){add(hypothesis,condition,async()=>{const r=lhr(),c=context();mutate(r,c);assert.throws(()=>liveReport(r,c),e=>e.message===reason);const d=fail();d.reason=reason;d.runtime_error_code=runtime;const{result}=await execute(d);assert.equal(result.reason,reason);assert.equal(result.runtime_error_code,runtime);});}
native('LHR返却済みPAGE_HUNGでもscope検証で不採用になり得る','runtimeError PAGE_HUNGを付加',r=>r.runtimeError={code:'PAGE_HUNG'},'LIVE_RESULT_SCOPE','PAGE_HUNG');
native('未列挙runtimeは既存側のOTHERとして観測可能','runtimeErrorの未知codeをproducer契約どおりOTHERに変換',r=>r.runtimeError={code:'SYNTHETIC_OTHER'},'LIVE_RESULT_SCOPE','OTHER');
native('最終URL相違はruntimeなしでもscope拒否になる','finalUrlだけ別の合成パス',r=>r.finalUrl=STAGING_TARGET+'different/','LIVE_RESULT_SCOPE');
native('mainDocument相違も同じscope拒否に合流する','mainDocumentUrlだけ別の合成パス',r=>r.mainDocumentUrl=STAGING_TARGET+'different/','LIVE_RESULT_SCOPE');
native('Lighthouse版相違は独立した固定理由になる','lighthouseVersionだけ変更',r=>r.lighthouseVersion='0.0.0','LIVE_SETTINGS_OR_VERSION');
native('CPU設定相違は採点結果に関係なく拒否される','cpuSlowdownMultiplierだけ5にする',r=>r.configSettings.throttling.cpuSlowdownMultiplier=5,'LIVE_SETTINGS_OR_VERSION');
native('非有限scoreはnumeric検証で拒否される','scoreをNaNにする',r=>r.categories.performance.score=NaN,'LIVE_NUMERIC_EVIDENCE');
native('benchmark欠陥はTrace完了後でも採点を拒否する','benchmarkIndexを0にする',r=>r.environment.benchmarkIndex=0,'LIVE_NUMERIC_EVIDENCE');
native('日時不正もnumeric検証に合流する','fetchTimeを非日時にする',r=>r.fetchTime='not-a-date','LIVE_NUMERIC_EVIDENCE');
native('単一指標の欠損はmetric検証で区別できる','LCPのnumericValueだけ除く',r=>delete r.audits['largest-contentful-paint'].numericValue,'LIVE_METRIC');
native('Font未採用は後段scopeとは異なる理由になる','font snapshot.adoptableだけfalse',(_r,c)=>c.gateway.fonts.snapshot=()=>({adoptable:false}),'LIVE_FONT_VALIDATION');
native('Trace不完全は他の検証より先に拒否される','traceReads.adoptableだけfalse',(_r,c)=>c.gateway.traceReads.adoptable=()=>false,'TRACE_READ_INCOMPLETE');
for(const [reason,hypothesis]of[
 ['LIVE_VISIBLE_CONTENT','返却後の可視内容不足を区別できる'],
 ['LIVE_CLEANUP','正常返却後の終了失敗を区別できる'],
 ['LIVE_READBACK','保存後の読戻し失敗を区別できる'],
 ['MEASUREMENT_SEAL_INVALIDATED','確定境界後のseal失効を区別できる'],
 ['MEASUREMENT_GUARD_FAILED','確定直前の保護失敗を区別できる'],
 ['MEASUREMENT_FONT_VALIDATION','確定時Font失敗を区別できる'],
 ['BROWSER_CHANGED','計測前のChrome相違を保持できる'],
 ['LIVE_SETUP_OR_MEASUREMENT_FAILED','既存汎用セットアップ失敗を任意例外と分けられる'],
 ['PREREQUISITE','前提証明失敗を計測失敗と区別できる'],
 ['LIVE_DEADLINE','全体期限の固定理由を保持できる'],
])add(hypothesis,'producerの固定reason='+reason,async()=>{const d=fail();d.reason=reason;if(reason==='LIVE_READBACK')d.stage='SAVE_READBACK';if(['BROWSER_CHANGED','PREREQUISITE'].includes(reason)){d.status='stopped_before_measurement';d.stage='PREREQUISITE';d.documents=0;d.response_diagnostic={counts:{}};}const{result}=await execute(d);assert.equal(result.reason,reason);});
add('任意reason文字列は公開されない','reasonに機密マーカーを混入',async()=>{const d=fail();d.reason='PRIVATE_REASON';assert.equal((await execute(d)).result.reason,'OTHER_FIXED_FAILURE');});
add('異種producer記録を診断として信用しない','kindだけ別値にする',async()=>{const d=fail();d.kind='PRIVATE_OTHER_RECORD';const{result}=await execute(d);assert.equal(result.reason,'OTHER_FIXED_FAILURE');assert.equal(result.lighthouse_outcome,'UNKNOWN');});
add('未知runtime文字列は固定値に落ちる','runtime_error_codeに機密マーカー',async()=>{const d=fail();d.runtime_error_code='PRIVATE_RUNTIME';assert.equal((await execute(d)).result.runtime_error_code,'UNKNOWN');});
add('runtime欠損は正常なnullと混同しない','runtime_error_codeキーを削除',async()=>{const d=fail();delete d.runtime_error_code;assert.equal((await execute(d)).result.runtime_error_code,'UNKNOWN');});
add('runtime型偽装は既知codeに昇格しない','runtime_error_codeをPAGE_HUNG配列',async()=>{const d=fail();d.runtime_error_code=['PAGE_HUNG'];assert.equal((await execute(d)).result.runtime_error_code,'UNKNOWN');});
add('Lighthouse rejectは返却済みと区別できる','START1 REJECT1 RETURNなし',async()=>{const d=fail();d.response_diagnostic.counts={LIGHTHOUSE_START:1,LIGHTHOUSE_REJECT:1};assert.equal((await execute(d)).result.lighthouse_outcome,'REJECTED');});
add('同一返却の重複を正常とみなさない','RETURNを2件にする',async()=>{const d=fail();d.response_diagnostic.counts.LIGHTHOUSE_RETURN=2;assert.equal((await execute(d)).result.lighthouse_outcome,'UNKNOWN');});
add('返却とrejectの混入は原因を断定しない','RETURN1とREJECT1を共存',async()=>{const d=fail();d.response_diagnostic.counts.LIGHTHOUSE_REJECT=1;assert.equal((await execute(d)).result.lighthouse_outcome,'UNKNOWN');});
add('STARTを欠くRETURNだけでは返却を証明しない','STARTキーを削除',async()=>{const d=fail();delete d.response_diagnostic.counts.LIGHTHOUSE_START;assert.equal((await execute(d)).result.lighthouse_outcome,'UNKNOWN');});
add('観測全体の欠損は実行なしと混同しない','response_diagnosticを削除',async()=>{const d=fail();delete d.response_diagnostic;assert.equal((await execute(d)).result.lighthouse_outcome,'UNKNOWN');});
add('counter型偽装を実行履歴とみなさない','countsを配列にする',async()=>{const d=fail();d.response_diagnostic.counts=[];assert.equal((await execute(d)).result.lighthouse_outcome,'UNKNOWN');});
add('負のcounterは欠損や0に丸めない','STARTを-1にする',async()=>{const d=fail();d.response_diagnostic.counts.LIGHTHOUSE_START=-1;assert.equal((await execute(d)).result.lighthouse_outcome,'UNKNOWN');});
add('小数counterは有効な1に丸めない','RETURNを0.5にする',async()=>{const d=fail();d.response_diagnostic.counts.LIGHTHOUSE_RETURN=0.5;assert.equal((await execute(d)).result.lighthouse_outcome,'UNKNOWN');});
add('開始のみの途中状態は返却と区別できる','START1 RETURN/REJECTなし',async()=>{const d=fail();d.response_diagnostic.counts={LIGHTHOUSE_START:1};assert.equal((await execute(d)).result.lighthouse_outcome,'PENDING');});
add('観測済みの実行なしは観測欠損と区別できる','存在するcountsを空にする',async()=>{const d=fail();d.response_diagnostic.counts={};d.runtime_error_code=null;assert.equal((await execute(d)).result.lighthouse_outcome,'NO_EVENTS_RECORDED');});
add('付随する任意データは公開projectionから落ちる','余分なURL/本文/IDとchild出力の混入',async()=>{const d=fail();d.raw='PRIVATE_BODY';d.response_diagnostic.events=[{event:'PRIVATE_EVENT',url:'PRIVATE_URL',id:'PRIVATE_ID'}];const{result}=await execute(d);assert.equal(result.lighthouse_outcome,'RETURNED');assert(!Object.hasOwn(result,'raw'));});
add('Trace側の既存の最初の停止理由を保持する','TRACE_READ_DEADLINE＋runtimeあり',async()=>{const d=fail();d.reason='TRACE_READ_DEADLINE';d.runtime_error_code='PAGE_HUNG';assert.equal((await execute(d)).result.reason,'TRACE_READ_DEADLINE');});
add('子プロセス失敗をsuccess記録だけで採用しない','status successだがchild終了1',async()=>{const{result}=await execute(success(),{childStatus:1});assert.equal(result.status,'INVALID_RESULT');});
add('読戻しhash不一致では点数を出さない','successのreport_sha256を変更',async()=>{const d=success();d.report_sha256='0'.repeat(64);const{result}=await execute(d);assert.equal(result.status,'INVALID_RESULT');});
add('reportとstatusの指標不一致は拒否を維持する','LCPだけ異なるreportを読戻し',async()=>{const d=success();const{result}=await execute(d,{report:{performance:75,metrics:{...d.metrics,lcp:99}}});assert.equal(result.status,'INVALID_RESULT');});
add('範囲外の点数は追加診断によって通過しない','status/report両方101点にする',async()=>{const d=success();d.performance=101;assert.equal((await execute(d)).result.status,'INVALID_RESULT');});
add('別URLの成功記録は引き続き不採用になる','success final_urlのみ別合成パス',async()=>{const d=success();d.final_url=STAGING_TARGET+'different/';assert.equal((await execute(d)).result.status,'INVALID_RESULT');});
add('native記録欠損でもstdoutを代替証拠にしない','readFileで合成IOエラー',async()=>{assert.equal((await execute(fail(),{missing:true})).result.status,'INVALID_RESULT');});
add('壊れたnative JSONは固定失敗に閉じる','JSON構文エラー文字列',async()=>{assert.equal((await execute(fail(),{raw:'PRIVATE_INVALID_JSON'})).result.reason,'PUBLIC_RESULT_VALIDATION_FAILED');});
add('stage記録不正は採点と診断の成功にすり替えない','cdp_stagesのeventを未知値にする',async()=>{const d=fail();d.cdp_stages.events=[{sequence:1,event:'PRIVATE_EVENT'}];assert.equal((await execute(d)).result.status,'INVALID_RESULT');});
add('遅延runtimeをrejectに誤帰属しない','REJECTのみの履歴にPAGE_HUNGを混入',async()=>{const d=fail();d.response_diagnostic.counts={LIGHTHOUSE_START:1,LIGHTHOUSE_REJECT:1};d.runtime_error_code='PAGE_HUNG';const{result}=await execute(d);assert.equal(result.lighthouse_outcome,'REJECTED');assert.equal(result.runtime_error_code,'UNKNOWN');});
add('公開診断以外の実行・採否・通信コードを変えていない','baseのworkflowと診断部分を除去してbyte比較',()=>{const baseline=execFileSync('git',['show','402f2d5ed7842dc6de40cd2cf038e026e43ba6ba:.github/workflows/staging-trace-read-once-20261120.yml'],{encoding:'utf8'});const strip=s=>s.replace(/\/\/ Only the producer[\s\S]*?(?=function traceRead\(p\))/,'').replace('...execution(d),',"reason:d.status==='success'?null:traceFailures.has(d.reason)?d.reason:'OTHER_FIXED_FAILURE',");assert.equal(strip(wrapper(yaml)),wrapper(baseline));});
assert.equal(cases.length,50);
for(const[c,i]of cases.map((c,i)=>[c,i]))test(`investigation ${String(i+1).padStart(2,'0')}: ${c.hypothesis} [${c.condition}]`,c.check);
