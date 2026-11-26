import {createHash} from 'node:crypto';import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {spawnSync,execFileSync} from 'node:child_process';
const base='df29ee7204cc6bd82db2f59d5fff4cb124d6cded';
test('entry delta is only first-six CLOSED native adapter plus exact identity',()=>{
 const old=readFileSync('tools/staging-beacon-api-read/entry.mjs','utf8').replaceAll('staging-beacon-api-read','staging-native-order-once').replaceAll('STAGING_BEACON_API_READ','STAGING_NATIVE_ORDER_ONCE');
 const now=readFileSync('tools/staging-native-order-once/entry.mjs','utf8');
 const expected=old.replace("import {observedNative} from '../proxy-cleanup-evidence/native.mjs'","import {observedFixtureNative} from '../native-proxy-order/native.mjs'").replace('native:j=>observedNative(j,{diagnostics:evidence(s)})','native:j=>observedFixtureNative(j,{diagnostics:evidence(s)})');
 assert.equal(now,expected);assert.equal(now.slice(now.indexOf('export async function buildLive')),old.slice(old.indexOf('export async function buildLive')));
 assert(!now.includes('wiring-shim'));assert(!now.includes('registerHooks'));
});
test('reviewed adapter bytes and every old policy/guard source remain identical',()=>{
 const reviewed={"tools/native-proxy-order/native.mjs": "5bf0f4f8283b29c0e36d77bf5c3d6e68194f441bb878b98446da466f6b277baa", "tools/native-proxy-order/model.mjs": "1be47af8f808cbd00a27a539f01b189ae7610053813cd3559ba185469d70422e", "tools/native-proxy-order/test.mjs": "7c10b0929c05234217734f204fd969999ab63ca3175575f1062bddbf08ee65fd", "tools/native-proxy-order/README.md": "49cbde4c9d5811b4a73626b3f8d5fd568ffd91637ec31290fb3574886f8fd1fd"};for(const[p,h]of Object.entries(reviewed))assert.equal(createHash('sha256').update(readFileSync(p)).digest('hex'),h);
 for(const p of['tools/nuxt-debug/natural-prefetch-proxy.mjs','tools/connect-postflush-closed/proxy.mjs','tools/connect-postflush-closed/open.mjs','tools/cdp-startup-diagnostic/cleanup.mjs','tools/staging-beacon-policy-v2/selected-run.mjs','tools/staging-measurement-policy/measure.mjs','tools/staging-measurement-policy/egress.mjs'])assert(readFileSync(p).equals(execFileSync('git',['show',base+':'+p])));
});
for(const mode of['CLOSED_OK','CLOSED_EARLY_RST','PRECHECK','LIVE_OK','LIVE_REFUSAL'])test('actual entry/default native callback and separate default live opener '+mode,()=>{
 const env={...process.env};delete env.GH_TOKEN;delete env.GITHUB_TOKEN;
 const r=spawnSync(process.execPath,['--unhandled-rejections=strict','tools/staging-native-order-once/wiring-child.mjs',mode],{env,encoding:'utf8',timeout:15000});assert.equal(r.status,0,r.stderr);assert.equal(r.stderr,'');const p=JSON.parse(r.stdout);assert.equal(p.passed,true);assert.equal(p.upstream,0);assert.equal(p.site_requests,0);assert.equal(p.real_chrome,false);
 if(mode==='CLOSED_OK'){assert.equal(p.opens,6);assert.equal(p.postflush_selected,6);}
 if(mode.startsWith('LIVE'))assert.equal(p.postflush_selected,0);
});
