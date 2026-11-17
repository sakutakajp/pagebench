/* Screenshot-free DOM/layout/style and action comparison. Captures stay in memory. */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {chromium} = require('playwright');
const stable = v => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
const hash = v => crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
function save(file, data) {
  const temp = file + '.tmp';
  const fd = fs.openSync(temp, 'w', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(data, null, 2)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temp, file);
}
function origin(s) {
  const u = new URL(s);
  if (u.origin !== s || u.username || u.password || !(u.protocol === 'https:' || (u.protocol === 'http:' && ['127.0.0.1','localhost'].includes(u.hostname)))) throw Error('ORIGIN');
  return s;
}
async function capture(browser, base, pathname, cfg) {
  const ctx = await browser.newContext({viewport:{width:412,height:823},deviceScaleFactor:1.75,isMobile:true,hasTouch:true,locale:'ja-JP',timezoneId:'UTC',reducedMotion:'reduce',serviceWorkers:'block'});
  const page = await ctx.newPage();
  page.setDefaultTimeout(3000); page.setDefaultNavigationTimeout(15000);
  const allowed = new Set([base,...(cfg.asset_origins || []).map(origin)]);
  await ctx.route('**/*', r => allowed.has(new URL(r.request().url()).origin) && !r.request().redirectedFrom() ? r.continue() : r.abort());
  await page.addInitScript(() => {
    const NativeDate = Date;
    globalThis.Date = class extends NativeDate { constructor(...a){super(...(a.length?a:[1767225600000]));} static now(){return 1767225600000;} };
  });
  const errors = []; page.on('pageerror', () => errors.push('JAVASCRIPT_ERROR'));
  try {
    const response = await page.goto(base+pathname,{waitUntil:'networkidle'});
    if (!response || response.status()!==200 || !response.headers()['content-type']?.includes('text/html') || page.url()!==base+pathname) throw Error('PUBLIC_HTML');
    await page.addStyleTag({content:'*,*::before,*::after {animation:none!important;transition:none!important;caret-color:transparent!important}'});
    await page.evaluate(() => document.fonts.ready);
    const matches = (cfg.actions || []).filter(a => new RegExp(a.path).test(pathname));
    if (matches.length>1) throw Error('AMBIGUOUS_ACTION_PROFILE');
    const profile = matches[0];
    if (profile?.ready) await page.locator(profile.ready).waitFor({state:'visible'});
    const snapshot = async () => page.evaluate(() => {
      if (document.documentElement.scrollHeight>20000) throw Error('PAGE_SIZE');
      const normalize = value => {
        try { const u = new URL(value,location.href); return u.origin===location.origin?'@site'+u.pathname+u.search+u.hash:u.href; } catch { return value; }
      };
      const visible = e => { const s=getComputedStyle(e); return s.visibility!=='hidden' && s.visibility!=='collapse' && s.display!=='none' && Number(s.opacity)!==0 && e.getClientRects().length>0; };
      const all = [document.body,...document.body.querySelectorAll('*')].filter(visible);
      if(all.length>10000) throw Error('ELEMENT_LIMIT');
      return all.map(e => {
        const s=getComputedStyle(e), r=e.getBoundingClientRect();
        const styles={};
        for(const k of ['display','position','color','backgroundColor','backgroundImage','fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','textAlign','borderTopWidth','borderTopStyle','borderTopColor','borderRadius','padding','margin','opacity','transform','overflow','visibility']) styles[k]=s[k].replaceAll(location.origin,'@site');
        return {tag:e.tagName,role:e.getAttribute('role'),ariaLabel:e.getAttribute('aria-label'),
          labelledBy:(e.getAttribute('aria-labelledby')||'').split(/\s+/).filter(Boolean).map(id=>document.getElementById(id)?.textContent||''),
          labels:e.labels?[...e.labels].map(l=>l.innerText):[],text:[...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').replace(/\s+/g,' ').trim(),
          href:e.hasAttribute('href')?normalize(e.getAttribute('href')):null,
          src:e.hasAttribute('src')?normalize(e.getAttribute('src')):null,
          alt:e.getAttribute('alt'),title:e.getAttribute('title'),value:'value' in e?String(e.value):null,
          checked:'checked' in e?e.checked:null,disabled:'disabled' in e?e.disabled:null,
          rect:[r.x+scrollX,r.y+scrollY,r.width,r.height],styles,
          before:getComputedStyle(e,'::before').content,after:getComputedStyle(e,'::after').content};
      });
    });
    const initial = await snapshot(); let actions = 'unconfigured'; const outcomes=[];
    if (profile) {
      if (!Array.isArray(profile.steps) || profile.steps.length>20 || !profile.steps.some(s=>s.action==='expectText')) throw Error('ASSERTION_REQUIRED');
      actions='passed';
      try {
        for(const step of profile.steps) {
          const loc=page.locator(step.selector);
          if(await loc.count()!==1) throw Error('SELECTOR_NOT_UNIQUE');
          if(step.action==='fill') await loc.fill(step.value);
          else if(step.action==='click') await loc.click();
          else if(step.action==='expectText') {
            const actual=(await loc.innerText()).replace(/\s+/g,' ').trim();
            outcomes.push(actual);
            if(actual!==step.value) throw Error('ASSERTION_FAILED');
          } else throw Error('ACTION');
        }
      } catch { actions='failed'; }
    }
    return {initial,final:await snapshot(),actions,outcomes,errors};
  } finally { await ctx.close(); }
}
function compare(a,b) {
  const initial=hash(a.initial)===hash(b.initial), final=hash(a.final)===hash(b.final);
  const actions=a.actions==='unconfigured'||b.actions==='unconfigured'?'unverified':a.actions==='passed'&&b.actions==='passed'&&hash(a.outcomes)===hash(b.outcomes)?'passed':'changed';
  const differences=[];
  for(const [phase,x,y] of [['initial',a.initial,b.initial],['post_action',a.final,b.final]]) {
    if(x.length!==y.length) differences.push({phase,category:'element_count'});
    for(const category of ['rect','styles','text','role','ariaLabel','labelledBy','labels','href','src','alt','title','value','checked','disabled','tag','before','after']) {
      if(hash(x.map(e=>e[category]))!==hash(y.map(e=>e[category]))) differences.push({phase,category});
    }
  }
  return {differences,status:!initial||!final||actions==='changed'||a.errors.length||b.errors.length?'changed':actions==='unverified'?'matched_actions_unverified':'passed',
    content_layout_style:initial?'matched':'changed',post_action:final?'matched':'changed',actions,
    before_elements:a.initial.length,after_elements:b.initial.length,javascript_errors:a.errors.length+b.errors.length,
    before_hash:hash(a.initial),after_hash:hash(b.initial)};
}
async function run(manifestFile,configFile,folder,limit) {
  if(!Number.isInteger(limit)||limit<1||limit>100) throw Error('LIMIT');
  // One canonical implementation for both CLIs, stdlib-only, no network.
  const m=JSON.parse(execFileSync('python3',['-c','from common import manifest; import json,sys; print(json.dumps(manifest(sys.argv[1])))',path.resolve(manifestFile)],{cwd:__dirname,encoding:'utf8'}));
  const cfg=JSON.parse(fs.readFileSync(configFile));origin(cfg.before);origin(cfg.after);
  if(cfg.before===cfg.after) throw Error('DISTINCT_ORIGINS');
  if(cfg.masks || cfg.tolerance || cfg.scope) throw Error('UNSUPPORTED_HIDING_CONFIG');
  fs.mkdirSync(folder,{recursive:true,mode:0o700}); const lock=path.join(folder,'running.lock'), fd=fs.openSync(lock,'wx',0o600);
  let browser;
  try {
    browser=await chromium.launch(cfg.executable_path?{executablePath:cfg.executable_path}:{});
    const identity=hash({manifest:m.sha256,cfg,browser:browser.version(),source:fs.readFileSync(__filename,'utf8'),canonical:fs.readFileSync(path.join(__dirname,'common.py'),'utf8')});
    const file=path.join(folder,'run.json'); const s=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{identity,manifest_hash:m.sha256,browser:browser.version(),results:{}};
    if(s.identity!==identity) throw Error('IDENTITY');
    for(const r of Object.values(s.results)) if(r.status==='in_flight') r.status='interrupted_not_retried';
    for(const {url} of m.records) {
      if(!limit) break; if(s.results[url]) continue;
      s.results[url]={status:'in_flight'};save(file,s);
      try {s.results[url]=compare(await capture(browser,cfg.before,new URL(url).pathname,cfg),await capture(browser,cfg.after,new URL(url).pathname,cfg));}
      catch {s.results[url]={status:'failed',reason:'CAPTURE_FAILED'};}
      save(file,s);limit--;
      console.error(JSON.stringify({processed:Object.keys(s.results).length,target:m.records.length,status:s.results[url].status}));
    }
    s.summary={target:m.records.length,processed:Object.keys(s.results).length,pending:m.records.filter(r=>!s.results[r.url]).map(r=>r.url),counts:{}};
    for(const r of Object.values(s.results)) s.summary.counts[r.status]=(s.summary.counts[r.status]||0)+1;
    save(file,s);return s;
  } finally {if(browser) await browser.close();fs.closeSync(fd);fs.unlinkSync(lock);}
}
module.exports={run,capture,compare,hash};
if(require.main===module){const [m,c,d,n]=process.argv.slice(2);run(m,c,d,Number(n)).then(s=>console.log(JSON.stringify(s.summary))).catch(()=>{console.log('{"status":"failed","reason":"RENDER_RUN_FAILED"}');process.exitCode=1;});}
