import{validate400Proofs,validateOriginUnitProof}from'./origin400-admission.mjs';
import{readParentEvidence,parentComplete,scopeFromEnv}from'../origin-recovery/retry-parent-evidence.mjs';
import{validateOriginProof}from'../origin-capture/once-proof.mjs';
import{validateStartupReceipt}from'./startup-proof.mjs';
import{validate240Proofs}from'./scoped240-admission.mjs';import{safeMeter400}from'./scoped400-meter.mjs';
import{ONE_RUN_REQUEST_LIMIT as STAGING_REQUEST_LIMIT}from'./scoped400-limit.mjs';
import{readFile,writeFile}from'node:fs/promises';import{execFileSync}from'node:child_process';import{createHash}from'node:crypto';import{browserFileHash}from'../ab-observe/config.mjs';
export const SCOPED_REF='refs/heads/diag/first-origin-reviewed-once-20261123',SCOPED_BASE='9ccf0109648b670abc8563fd49b7d2f3be86b5da',SCOPED_SUBJECT='diagnostic: reviewed first origin retry once (20261123-p5)';
export async function admission400({consume=false}={}){
 const git=(...a)=>execFileSync('git',a,{encoding:'utf8',maxBuffer:1048576}).trim();if(process.version!=='v22.19.0'||process.env.GITHUB_REPOSITORY!=='sakutakajp/pagebench'||process.env.GITHUB_REF!==SCOPED_REF||process.env.GITHUB_EVENT_NAME!=='push'||process.env.GITHUB_RUN_ATTEMPT!=='1'||process.env.GITHUB_SHA!==git('rev-parse','HEAD')||git('rev-parse','HEAD^')!==SCOPED_BASE||git('rev-list','--count',SCOPED_BASE+'..HEAD')!=='1'||git('show','-s','--format=%s')!==SCOPED_SUBJECT)throw Error('FIXED_ADMISSION');
 const event=JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));if(event.head_commit?.id!==process.env.GITHUB_SHA)throw Error('FIXED_EVENT');
 execFileSync('git',['diff','--quiet','HEAD','--']);const manifestBytes=await readFile('tools/natural-reads/retry400-manifest.json');if(!manifestBytes.equals(execFileSync('git',['show','HEAD:tools/natural-reads/retry400-manifest.json'])))throw Error('FIXED_SOURCE');const m=JSON.parse(manifestBytes);if(m.parent!==SCOPED_BASE||m.role!=='FIXED_REVIEWED_ORIGIN_400_JA_ONCE_NO_SCORE'||JSON.stringify(git('diff','--name-only',SCOPED_BASE,'HEAD').split('\n').sort())!==JSON.stringify([...Object.keys(m.files),'tools/natural-reads/retry400-manifest.json'].sort()))throw Error('FIXED_SOURCE');for(const[p,h]of Object.entries(m.files))if(createHash('sha256').update(await readFile(p)).digest('hex')!==h)throw Error('FIXED_SOURCE');
 const unit=JSON.parse(await readFile('origin400-unit-proof.json','utf8'));validateOriginUnitProof(unit,m,{sha:process.env.GITHUB_SHA});
 const native=JSON.parse(await readFile('natural-native-closed-proof.json','utf8')),top=JSON.parse(await readFile('natural-top-closed-proof.json','utf8')),scoped=JSON.parse(await readFile('scoped400-closed-proof.json','utf8')),binary=await browserFileHash();const prior=JSON.parse(await readFile('scoped240-closed-proof.json','utf8'));validate240Proofs(native,top,prior,{sha:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID,binary});validate400Proofs(native,top,scoped,{sha:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID,binary});validateStartupReceipt(top,JSON.parse(await readFile('startup-closed-proof.json','utf8')),{sha:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID});validateOriginProof(JSON.parse(await readFile('origin-closed-proof.json','utf8')),{sha:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID,binary,chrome:top.chrome});
 validateRecoveredParentProofs();
 if(consume)await writeFile('origin400-attempt.json',JSON.stringify({sha:process.env.GITHUB_SHA}),{flag:'wx',mode:0o600});else if(JSON.parse(await readFile('origin400-attempt.json','utf8')).sha!==process.env.GITHUB_SHA)throw Error('FIXED_START_GRANT');
 return{policy_limit:STAGING_REQUEST_LIMIT,chrome:top.chrome,binary_sha256:binary,route_coverage:'CURRENT_2594_NOT_VERIFIED_UNKNOWN_PATHS_FAIL_CLOSED'};
}


export function validateRecoveredParentProofs({scope=scopeFromEnv(),directory='.'}={}){for(const stage of ['native','top','scoped240','scoped400','origin'])if(!parentComplete(readParentEvidence(stage,scope,directory)))throw Error('FIXED_PARENT_PROCESS_GATE');return true;}
