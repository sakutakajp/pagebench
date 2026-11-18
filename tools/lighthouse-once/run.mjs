import {readFile,writeFile}from'node:fs/promises';import{createHash}from'node:crypto';
import{open,measure}from'./engine.mjs';
export async function fingerprint(){let text='';for(const f of ['startup.mjs','guard.mjs','gateway.mjs','engine.mjs','fixture.mjs','run.mjs','package-lock.json'])text+=await readFile(new URL(f,import.meta.url),'utf8');return createHash('sha256').update(text).digest('hex');}
export async function main(){let ctx;let result={kind:'restricted-staging-lighthouse-cli',status:'failed',reason:'BROWSER_OR_GUARD_OR_RESULT_FAILED',performance:null};
 try{
  const proof=JSON.parse(await readFile('fixture-proof.json','utf8'));if(proof.fingerprint!==await fingerprint()||proof.status!=='passed')throw Error('FIXTURE_REQUIRED');
  ctx=await open();if(await ctx.browser.version()!==proof.chrome)throw Error('BROWSER_CHANGED');
  result=await measure(ctx);
 }catch{if(ctx?.gateway.stats.fatal)result.reason=ctx.gateway.stats.fatal;}
 finally{await ctx?.cleanup();}
 await writeFile('result.json',JSON.stringify(result,null,2),{mode:0o600});console.log(JSON.stringify(result));
 if(process.env.GITHUB_STEP_SUMMARY)await writeFile(process.env.GITHUB_STEP_SUMMARY,'Restricted staging Lighthouse CLI\n\n```json\n'+JSON.stringify(result,null,2)+'\n```\n',{flag:'a'});
 if(result.status!=='success')process.exitCode=1;
}
if(process.argv[1]===new URL(import.meta.url).pathname)await main();
