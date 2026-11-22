import {createReadStream} from 'node:fs';import {createHash} from 'node:crypto';
export const BASE='2d851705facce2749307e21363404429abec9995';
export const REF='refs/heads/diag/ab-gateway-observe-once-20261122';
export const SUBJECT='diagnostic: guarded gateway AB observation once (20261122-o1)';
export const WORKFLOW='.github/workflows/staging-ab-gateway-observe-once-20261122.yml';
export const TARGET='https://staging.hirameki.dev/ja/';
export const LIMITS=Object.freeze({window_ms:45000,navigation_ms:30000,total_ms:150000,normal_requests:120,prefetch_requests:256,inflight:6});
export const NETWORK=Object.freeze({offline:false,latency:300,downloadThroughput:102400,uploadThroughput:102400}); // 800*1024/8 bytes/s, both directions.
export const DEVICE=Object.freeze({width:412,height:823,deviceScaleFactor:1.75,mobile:true});
export const CPU=Object.freeze({rate:6});
export async function browserFileHash(){const h=createHash('sha256');for await(const b of createReadStream(process.env.CHROME_PATH||'/opt/google/chrome/chrome'))h.update(b);return h.digest('hex');}
export function equal(a,b){return JSON.stringify(a)===JSON.stringify(b);}
export function configParams(chrome){const m=/^(Chrome|HeadlessChrome)\/(\d+)\.\d+\.\d+\.\d+$/.exec(chrome);if(!m)throw Error('VERSION');return {
 'Network.setUserAgentOverride':{userAgent:`Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${m[2]}.0.0.0 Mobile Safari/537.36`,userAgentMetadata:{brands:[{brand:'Chromium',version:m[2]},{brand:'Google Chrome',version:m[2]}],fullVersion:`${m[2]}.0.0.0`,platform:'Android',platformVersion:'11.0',architecture:'',model:'moto g power (2022)',mobile:true}},
 'Emulation.setDeviceMetricsOverride':DEVICE,'Emulation.setTouchEmulationEnabled':{enabled:true},'Network.emulateNetworkConditions':NETWORK,'Emulation.setCPUThrottlingRate':CPU};}
// about:blank has no viewport meta; its layout viewport need not equal the device screen.
export function captureDeviceScreen(){return{screenWidth:screen.width,screenHeight:screen.height,dpr:devicePixelRatio,mobile:/Android 11; moto g power \(2022\)/.test(navigator.userAgent)&&/Mobile/.test(navigator.userAgent)};}
export function deviceScreenMatches(v){return v?.screenWidth===412&&v.screenHeight===823&&v.dpr===1.75&&v.mobile===true;}
export async function applyLockedConfig(ctx){const g=ctx.gateway,w=g.wire,send=w.send,primary=g.primary,state=g.sessions.get(primary),expected=configParams(ctx.chrome),ack=[];let active=true;
 w.send=function(raw){if(!active)return send.call(w,raw);let m;try{if(typeof raw!=='string'||raw.length>1048576)throw Error();m=JSON.parse(raw);}catch{g.fail('AB_CONFIG_INPUT');return;}
  if(Object.hasOwn(expected,m.method)){if(m.sessionId!==primary||!equal(m.params,expected[m.method])){g.fail('AB_CONFIG_MUTATION');return;}}
  else if(['Emulation.clearDeviceMetricsOverride','Network.emulateNetworkConditionsByRule','Network.overrideNetworkState','Emulation.setEmulatedMedia','Emulation.setHardwareConcurrencyOverride','Emulation.setScriptExecutionDisabled'].includes(m.method)){g.fail('AB_CONFIG_MUTATION');return;}
  if(g.stopping||g.stats.fatal||g.primary!==primary||g.sessions.get(primary)!==state||!state?.ready){if(!g.stopping)g.fail('AB_CONFIG_SCOPE');return;}
  return send.call(w,raw);
 };
 for(const [method,params] of Object.entries(expected)){await g.call(method,params,primary);if(g.stopping||g.stats.fatal)throw Error('CONFIG');ack.push(method);}
 const observed=await ctx.page.evaluate(captureDeviceScreen);
 if(!deviceScreenMatches(observed))throw Error('CONFIG_READBACK');
 return{snapshot:()=>({settings_acknowledged:ack.length===5,mobile_device_readback:true,pre_navigation_screen_dpr_ua:'MATCH',pre_navigation_layout_viewport:'NOT_COMPARED',network:'ACTUAL_CDP_300MS_800K_DOWN_800K_UP',cpu:'ACTUAL_CDP_X6'}),dispose(){active=false;w.send=send;}};
}
