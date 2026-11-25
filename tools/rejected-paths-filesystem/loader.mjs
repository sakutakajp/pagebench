// Original byte-pinned journal AND original normal schema/projector.
// Only the store import in this isolated module instance is fixture-specific.
import{registerHooks}from'node:module';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';
import{createClosedFileStore}from'./file-store.mjs';
let modulePromise;
export async function createFileJournal(options){
 if(!modulePromise)modulePromise=(async()=>{const source=new URL('../rejected-paths-local/journal.mjs',import.meta.url),url=new URL(source.href+'?closed-real-filesystem-v1'),pins=JSON.parse(readFileSync(new URL('./source-pins.json',import.meta.url)));for(const p of['journal.mjs','schema.mjs','crypto.mjs','private-store.mjs'])if(createHash('sha256').update(readFileSync(new URL('../rejected-paths-local/'+p,import.meta.url))).digest('hex')!==pins.files['tools/rejected-paths-local/'+p])throw Error('FIXTURE_SOURCE_PIN');const hook=registerHooks({resolve(spec,ctx,next){if(ctx.parentURL===url.href&&spec==='./private-store.mjs')return{url:new URL('./file-store.mjs',import.meta.url).href,shortCircuit:true};return next(spec,ctx);}});try{return await import(url.href);}finally{hook.deregister();}})();
 const module=await modulePromise,sink=createClosedFileStore(options);try{return{...sink,journal:module.privateRejectedPaths({store:sink.store,publicKey:options.publicKey,scope:options.scope}),instrument:module.instrumentRejectedPaths};}catch{sink.dispose();throw Error('FIXTURE_JOURNAL_INIT');}
}
