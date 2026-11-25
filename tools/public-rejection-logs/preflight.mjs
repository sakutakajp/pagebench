// One separately persisted stage. No live opener or live admission here.
import{monitor}from'./monitor.mjs';import{fixedWrite,scope}from'./records.mjs';import{browserFileHash}from'../ab-observe/config.mjs';
const stage=process.argv[2];if(stage!==process.env.PB_PUBLIC_STAGE||!['native','top','scoped240','scoped400','counter'].includes(stage)||process.argv.length!==3)throw Error('FIXED_PREFLIGHT_STAGE');
await monitor().work(async()=>{const s=scope(),stamp={workflow_sha:s.sha,run_id:s.run_id};let result;
 if(stage==='native'){const{runClosedBrowser}=await import('../natural-reads/browser.mjs');const hash=await browserFileHash();result={...await runClosedBrowser(),...stamp,binary_sha256:hash};if(await browserFileHash()!==hash)throw Error('FIXED_BINARY');fixedWrite(result,'natural-native-closed-proof.json');}
 if(stage==='top'){const{runStartupTop,persistStartupTop}=await import('../natural-reads/startup-proof.mjs');result={...await runStartupTop(),...stamp};persistStartupTop(result,{sha:s.sha,run:s.run_id});}
 if(stage==='scoped240'){const{runScoped240Browser}=await import('../natural-reads/scoped240-browser.mjs');result={...await runScoped240Browser(),...stamp};fixedWrite(result,'scoped240-closed-proof.json');}
 if(stage==='scoped400'){const{runScoped400Browser}=await import('../natural-reads/scoped400-browser.mjs');result={...await runScoped400Browser(),...stamp};fixedWrite(result,'scoped400-closed-proof.json');}
 if(stage==='counter'){const{runCounterClosed}=await import('./closed-browser.mjs');result=await runCounterClosed();fixedWrite(result,'public-rejection-closed.json');}
 return result?.status==='passed'&&(!['native','top'].includes(stage)||result.continuation==='SAFE_CLOSED_NEXT_SUITE');});
