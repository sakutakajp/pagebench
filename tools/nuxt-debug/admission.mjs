import {readFile,writeFile,appendFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {BASE,REF,SUBJECT,WORKFLOW,browserFileHash} from './config.mjs';
import {safetyFingerprint} from '../cdp-startup-diagnostic/proof.mjs';
import {validCauseBrowserProof} from '../cdp-startup-diagnostic/payload-cause-browser-fixture.mjs';
import {validNuxtErrorBrowserProof} from '../cdp-startup-diagnostic/nuxt-error-browser-fixture.mjs';
import {validLineageBrowserProof} from '../cdp-startup-diagnostic/node-lineage-browser-fixture.mjs';
import {validMainPaintProof} from '../cdp-startup-diagnostic/main-paint-browser-fixture.mjs';
import {validDetachBrowserProof} from '../cdp-startup-diagnostic/detach-browser-fixture.mjs';
import {validBrowserTraceProof} from '../cdp-startup-diagnostic/trace-read-browser-fixture.mjs';
export const REQUIRED=['unit','capture','closed','memory','response','fonts','real_stages','trace_browser','detach_browser','main_paint_browser','node_lineage_browser','nuxt_errors','payload_cause','measurement_runtime','ab_unit','ab_closed','nuxt_strict','nuxt_scope'];
export function eventValid(e){return e.event==='push'&&e.ref===REF&&e.attempt==='1'&&e.parent===BASE&&e.subject===SUBJECT&&/^[a-f0-9]{40}$/.test(e.sha)&&e.sha===e.head&&e.sha===e.eventHead&&e.commitCount===1;}
export function stepsValid(s){return REQUIRED.every(k=>s?.[k]?.outcome==='success')&&s.capture.outputs?.fixture_ready==='true';}
export async function noOtherRuns(fetcher=fetch,runId=process.env.GITHUB_RUN_ID,sha=process.env.GITHUB_SHA){
 if(!/^\d{1,20}$/.test(runId||'')||!/^[a-f0-9]{40}$/.test(sha||''))return false;
 for(const status of ['in_progress','queued','waiting']){
  const r=await fetcher('https://api.github.com/repos/sakutakajp/pagebench/actions/runs?status='+status+'&per_page=100',{method:'GET',redirect:'error',signal:AbortSignal.timeout(5000),headers:{Accept:'application/vnd.github+json'}});
  if(r.status!==200)return false;const chunks=[];let size=0;for await(const chunk of r.body){size+=chunk.length;if(size>1048576)return false;chunks.push(chunk);}const d=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(!Number.isInteger(d.total_count)||d.total_count<0||d.total_count>=100||!Array.isArray(d.workflow_runs)||d.workflow_runs.length!==d.total_count)return false;
  if(d.workflow_runs.some(v=>String(v.id)!==runId||v.head_sha!==sha||v.event!=='push'||v.run_attempt!==1))return false;
 }return true;
}
export const CLOSED_CASES=['A_normal','B_normal','A_no_meta','B_no_meta','A_transition','B_transition','A_short','B_short','A_missing_original','B_missing_original','A_POST','B_POST','A_external','B_external','A_redirect','B_redirect','A_config_mutation','B_config_mutation','A_loss','B_loss'];
export function closedValid(p,sha,fingerprint,now=Date.now()){
 return p?.kind==='closed-ab-real-chrome-proof'&&p.status==='passed'&&p.sha===sha&&p.fingerprint===fingerprint&&/^Chrome\/\d+\.\d+\.\d+\.\d+$/.test(p.chrome)&&/^[a-f0-9]{64}$/.test(p.binary_sha256)&&Number.isFinite(p.finished_ms)&&now>=p.finished_ms&&now-p.finished_ms<120000&&p.upstream_connections===0&&p.live_navigations===0&&p.readback===true&&Array.isArray(p.cases)&&JSON.stringify(p.cases.map(c=>c.case))===JSON.stringify(CLOSED_CASES)&&p.cases.every((c,i)=>c.status==='passed'&&c.chrome===p.chrome&&c.cleanup==='complete'&&c.actual_config===true&&(i>=10||c.viewport_check==='EXPECTED_CLASSIFICATION'));
}
export function scopeProofValid(p,sha){return p?.kind==='nuxt-scope-fixed-proof'&&p.status==='passed'&&p.sha===sha&&p.node==='v22.19.0'&&p.strict_mode==='strict'&&p.tests===23&&p.pass===23&&p.fail===0&&p.skipped===0&&p.cancelled===0;}
const load=async p=>JSON.parse(await readFile(p,'utf8'));
const git=(...a)=>execFileSync('git',a,{encoding:'utf8',maxBuffer:1048576}).trim();
export async function debugAdmission(){
 if(process.version!=='v22.19.0')throw Error('RUNTIME');const sha=process.env.GITHUB_SHA,steps=JSON.parse(process.env.STEP_OUTCOMES||'{}'),event=await load(process.env.GITHUB_EVENT_PATH);
 if(!eventValid({event:process.env.GITHUB_EVENT_NAME,ref:process.env.GITHUB_REF,attempt:process.env.GITHUB_RUN_ATTEMPT,parent:git('rev-parse','HEAD^'),subject:git('log','-1','--format=%s'),sha,head:git('rev-parse','HEAD'),eventHead:event.head_commit?.id,commitCount:Number(git('rev-list','--count',BASE+'..HEAD'))})||!stepsValid(steps))throw Error('EVENT_OR_STEPS');
 const manifest=await load('tools/nuxt-debug/source-manifest.json');const files=Object.keys(manifest).sort();
 if(JSON.stringify(git('diff','--name-only','HEAD^','HEAD').split('\n').sort())!==JSON.stringify([...files,'tools/nuxt-debug/source-manifest.json'].sort()))throw Error('FILES');
 for(const [p,h] of Object.entries(manifest)){if(!/^[a-f0-9]{64}$/.test(h)||createHash('sha256').update(await readFile(p)).digest('hex')!==h)throw Error('SOURCE');}
 const unit=await load('offline-unit-proof.json'),extra=await load('ab-unit-proof.json');if(unit.status!=='passed'||unit.workflow_sha!==sha||unit.node!=='v24.19.0'||unit.tests!==474||unit.pass!==474||unit.fail!==0||unit.skipped!==0||unit.cancelled!==0||extra.status!=='passed'||extra.sha!==sha||extra.node!=='v24.19.0'||extra.pass!==extra.tests||extra.tests!==48||extra.fail!==0||extra.skipped!==0||extra.cancelled!==0)throw Error('UNIT');
 const strict=await load('nuxt-debug-strict-proof.json');if(strict.status!=='passed'||strict.sha!==sha||strict.node!=='v22.19.0'||strict.strict_mode!=='strict'||strict.tests!==27||strict.pass!==27||strict.fail!==0||strict.skipped!==0||strict.cancelled!==0)throw Error('STRICT_RECEIVER_PROOF');
 if(!scopeProofValid(await load('nuxt-scope-fixed-proof.json'),sha))throw Error('SCOPE_CLASSIFICATION_PROOF');
 const f=await safetyFingerprint();const [fixture,memory,response,font,stage,ab]=await Promise.all(['fixture-lighthouse-status.json','staging-memory-proof.json','response-path-proof.json','font-observed-proof.json','real-chrome-stage-proof.json','ab-closed-proof.json'].map(load));
 if([fixture,memory,response].some(p=>p.status!=='passed'||p.run_sha!==sha||p.safety_fingerprint!==f||p.outbound_forwarding!==0)||[memory,response].some(p=>p.chrome!==fixture.chrome)||fixture.cleanup!=='complete'||fixture.json_readback!==true||fixture.ui_resumes!==0||memory.continued_requests!==0||memory.blocked_requests<3)throw Error('BASE_GATES');
 if(JSON.stringify(fixture.cases)!==JSON.stringify(['positive-render','POST-and-external-denied','popup-stopped','worker-stopped','iframe-stopped','loss-stopped','mutation-stopped','websocket-no-handshake']))throw Error('GUARD_CASES');
 if(JSON.stringify(response.cases?.map(c=>c.case))!==JSON.stringify(['parallel_success','network','missing_metadata','redirect'])||response.cases.some(c=>c.status!=='passed'||c.cleanup!=='complete'||c.outbound_forwarding!==0||c.chrome!==fixture.chrome))throw Error('RESPONSE');
 const fonts=['font_ok','font_status','font_bad_mime','font_private','font_disconnect','font_cors','font_redirect','font_missing_finish','font_wrong_session','font_mismatch_url','font_denied','font_write','font_credentials','font_late_final_failure','guard_popup','guard_worker','guard_loss','guard_mutation','guard_websocket'];
 if(font.status!=='passed'||font.outbound_forwarding!==0||font.live_pages_attempted!==0||font.json_readback!==true||JSON.stringify(font.cases?.map(c=>c.case))!==JSON.stringify(fonts)||font.cases.some(c=>c.status!=='passed'||c.cleanup!=='complete'||c.outbound_forwarding!==0||c.chrome!==fixture.chrome))throw Error('FONT');
 const fontReportBytes=await readFile('font-observed-lighthouse-report.json');const fr=JSON.parse(fontReportBytes),ff=fr.fonts,ft=fr.settings?.throttling;
 if(createHash('sha256').update(fontReportBytes).digest('hex')!==font.report_sha256||JSON.stringify(fr)!==JSON.stringify(font.lighthouse)||fr.status!=='adopted'||fr.chrome!==fixture.chrome||fr.lighthouse!=='13.6.0'||fr.cleanup!=='complete'||fr.outbound_forwarding!==0||fr.url_identity_validated!==true||fr.screenshots_saved!==0||fr.settings?.formFactor!=='mobile'||fr.settings.throttlingMethod!=='simulate'||ft?.rttMs!==300||ft.throughputKbps!==800||ft.cpuSlowdownMultiplier!==6||!ff?.adoptable||ff.expected<1||ff.verified!==ff.expected||ff.unbound!==0||ff.incomplete!==0||ff.fatal!==null||ff.phase!=='SEALED'||ff.minimum_required!==1||ff.observation!=='VERIFIED_FONTS'||ff.after_seal_events!==0||fr.measurement_boundary!=='AFTER_FINAL_BROWSER_OPERATION_AND_PRIMARY_SESSION_FENCE')throw Error('POSITIVE_FONT');
 if(stage.status!=='passed'||stage.workflow_sha!==sha||stage.fingerprint!==f||stage.chrome!==fixture.chrome||stage.fonts_verified<1||stage.fonts_verified!==stage.fonts_expected||stage.cleanup!=='complete'||stage.stages?.complete!==true||stage.stages?.limitation!==null||stage.outbound_forwarding!==0||stage.live_pages_attempted!==0)throw Error('STAGES');
 const late=font.cases.find(c=>c.case==='font_late_final_failure');if(late?.pre_final_adoptable!==true||late.finalization_rejected!==true||late.adoptable!==false||late.performance!==null)throw Error('LATE_FONT');
 const valid=[['trace-read-real-proof.json',validBrowserTraceProof],['detach-browser-proof.json',validDetachBrowserProof],['main-paint-browser-proof.json',validMainPaintProof],['node-lineage-browser-proof.json',validLineageBrowserProof],['closed-nuxt-error-proof.json',validNuxtErrorBrowserProof],['payload-cause-browser-proof.json',validCauseBrowserProof]];
 for(const [file,fn]of valid){const p=await load(file);if(!fn(p,sha,f)||p.chrome!==fixture.chrome)throw Error('CLOSED_PROOF');}
 if(!closedValid(ab,sha,f)||ab.chrome!==fixture.chrome||ab.binary_sha256!==await browserFileHash())throw Error('AB_CLOSED');
 if(process.env.GITHUB_REPOSITORY!=='sakutakajp/pagebench'||!await noOtherRuns())throw Error('COMPETING_RUN_OR_UNKNOWN');
 return{kind:'nuxt-debug-admission',status:'passed',sha,chrome:fixture.chrome,binary_sha256:ab.binary_sha256,fingerprint:f,network:'ACTUAL_CDP_300MS_800K_DOWN_800K_UP',cpu:'ACTUAL_CDP_X6',navigation_limits:{A:1,B:0},score_saved:false};
}
if(process.argv[1]===new URL(import.meta.url).pathname){try{const proof=await debugAdmission();await writeFile('nuxt-debug-admission.json',JSON.stringify(proof),{mode:0o600});if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,'ready=true\n');console.log(JSON.stringify(proof));}catch{console.log('{"kind":"nuxt-debug-admission","status":"failed","reason":"ADMISSION_FAILED","live_navigations":0}');process.exitCode=1;}}
