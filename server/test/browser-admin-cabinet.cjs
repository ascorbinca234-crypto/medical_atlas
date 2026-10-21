'use strict';
// Local acceptance: actual access API with disposable users, no production changes.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const {chromium} = require('../../pathophys-atlas/node_modules/playwright');
const {config} = require('../src/config'), {createApp} = require('../src/app'), {memoryStore} = require('../src/store/memory'), {jwtSign, keys, now} = require('../src/tokens');
const root = path.resolve(__dirname, '../..');
(async () => {
  const cfg = config({SITE_URL: 'http://127.0.0.1', API_URL: 'https://local-api.invalid', SECRET: 'local-cabinet-acceptance-secret-not-production', STORE: 'memory', MAIL_TRANSPORT: 'log', CONTENT_DIR: path.join(root, 'server/content')});
  const store = memoryStore();
  await store.putUser({id: 'admin', tv: 0, name: 'Администратор', contentAdmin: true});
  await store.putUser({id: 'student', tv: 0, name: 'Студент'});
  const subjects = ['farma', 'biochem', 'micro', 'pathophys'];
  await store.putDoc('access:student', Object.fromEntries(subjects.map(id => [id, {expiresAt:Date.now()+3600000}])), 0);
  for (const id of ['admin','student']) await store.putDoc('p:'+id, {dev:{},sec:{farma:{t:Date.now(),list:[{id:'k-adr',n:'Адренергические средства',sub:'Фармакология',total:5,learned:0,seen:0,locked:true}]}},last:null,ach:{},profile:{},tz:-180,code:null}, 0);
  const app = createApp({cfg, store, mail: {}, log: {error: console.error}});
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname).slice(1); if (!rel || rel.endsWith('/')) rel += 'index.html';
    const file = path.resolve(root, rel);
    if (!file.startsWith(root + path.sep) || rel.split('/').some(s => s.startsWith('.'))) {res.writeHead(404); return res.end();}
    try {res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : 'text/html; charset=utf-8'); res.end(fs.readFileSync(file));}
    catch {res.writeHead(404); res.end();}
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:' + server.address().port; cfg.origins.push(origin);
  const browser = await chromium.launch({headless: true, executablePath: process.env.ATLAS_BROWSER || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const errors = [], contexts = [];
  async function cabinet(id, clientAdmin = false, gate = null) {
    const context = await browser.newContext({viewport:{width:1365,height:900},reducedMotion:'reduce'}); contexts.push(context); context.setDefaultTimeout(15000);
    const controls = {failAccess:false};
    const token = jwtSign({sub:id,tv:0,typ:'a',exp:now()+3600},keys(cfg.secret).jwt);
    await context.addInitScript(session => {
      if (!localStorage.getItem('cabinet-fixture')) {localStorage.setItem('ma-session',JSON.stringify(session));localStorage.setItem('cabinet-fixture','1');}
    }, {access:token,accessExp:now()+3600,refresh:'local',refreshExp:now()+3600,user:{id,name:id==='admin'?'Администратор':'Студент',isAdmin:clientAdmin}});
    await context.route('**/*', async route => {
      const req=route.request(),url=new URL(req.url());
      if(url.pathname==='/auth/config.js')return route.fulfill({contentType:'application/javascript',body:'window.MA_CONFIG={api:"https://local-api.invalid"};'});
      if(url.hostname==='local-api.invalid') {
        if(url.pathname==='/access' && gate) {gate.started();await gate.promise;}
        if(url.pathname==='/access' && controls.failAccess)return route.fulfill({status:503,contentType:'application/json',body:'{"error":"test_offline"}'});
        const r=await app.handle({method:req.method(),path:url.pathname,query:Object.fromEntries(url.searchParams),headers:req.headers(),body:req.postData()||'',ip:'local'});
        return route.fulfill({status:r.status,headers:r.headers,body:r.base64?Buffer.from(r.body,'base64'):r.body});
      }
      return url.origin===origin?route.continue():route.abort();
    });
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/cabinet/#achievements');
    return {page,context,controls};
  }
  try {
    // Server role wins even when the cached profile does not yet show isAdmin.
    const admin=await cabinet('admin',false),page=admin.page;
    await page.waitForFunction(()=>document.querySelectorAll('#achGrid [data-state="preview"]').length===10);
    assert.equal(await page.locator('#achGrid [data-state="locked"], #badgesMini [data-state="locked"], #achGrid .lock').count(),0);
    assert.equal(await page.locator('#masBody .sys-row.locked').count(),0);
    assert.match(await page.locator('#achCount2').textContent(),/Доступны все 10.*получено 0/);
    assert.equal(await page.evaluate(()=>window.MAP.view().stats.xp),0);
    assert.deepEqual(await page.evaluate(()=>window.MAP.view().ach),{});
    await page.evaluate(()=>window.MAP.sync());assert.deepEqual((await store.getDoc('p:admin')).d.ach,{});
    assert.equal(await store.getDoc('access:admin'),null);
    const role=await app.handle({method:'GET',path:'/access',query:{},headers:{authorization:'Bearer '+await page.evaluate(()=>JSON.parse(localStorage.getItem('ma-session')).access)},ip:'local'});
    assert.deepEqual(Object.keys(JSON.parse(role.body).grants),subjects);
    await page.locator('#tab-settings').click();
    assert.ok((await page.locator('[data-atlas-access]').allTextContents()).every(t=>t==='Полный доступ · администратор'));
    await page.locator('#tab-achievements').click();await page.locator('#achGrid').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(root,'outputs/admin-achievements-local.png')});
    await page.setViewportSize({width:390,height:844});await page.locator('#achGrid').scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:path.join(root,'outputs/admin-achievements-mobile.png')});
    // Learning still earns real awards; administrator preview never writes all awards.
    await page.evaluate(()=>window.MAP.card({atlas:'farma',ok:true}));
    await page.evaluate(()=>window.MAP.sync());
    await page.waitForFunction(()=>document.querySelector('#ach-first')?.dataset.state==='open');
    assert.ok(await page.evaluate(()=>!!window.MAP.view().ach.first));
    assert.ok(Object.keys(await page.evaluate(()=>window.MAP.view().ach)).length<10);
    // A regular purchaser of all subjects gets all subject rights, not administrator preview.
    const paid=await cabinet('student',true);
    await paid.page.waitForFunction(()=>Array.from(document.querySelectorAll('[data-atlas-access]')).every(x=>x.textContent==='Подписка активна'));
    assert.equal(await paid.page.locator('#achGrid [data-state="preview"]').count(),0);
    assert.equal(await paid.page.locator('#achGrid [data-state="locked"]').count(),10);
    assert.equal(await paid.page.locator('#masBody .sys-row.locked').count(),0);
    // Revoking the role or failing to check access removes preview and stale subscription overrides.
    await store.updateUser('admin',u=>{u.contentAdmin=false;});
    await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForFunction(()=>document.querySelectorAll('#achGrid [data-state="preview"]').length===0);
    assert.ok(await page.locator('#achGrid [data-state="locked"]').count()>0);
    assert.equal(await page.locator('#masBody .sys-row.locked').count(),1);
    await store.updateUser('admin',u=>{u.contentAdmin=true;});
    await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForFunction(()=>document.querySelectorAll('#achGrid [data-state="preview"]').length>0);
    admin.controls.failAccess=true;await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForFunction(()=>document.querySelectorAll('#achGrid [data-state="preview"]').length===0);
    admin.controls.failAccess=false;
    // A late administrator response cannot restore privileges after logout.
    let release,started;const startedPromise=new Promise(r=>started=r),promise=new Promise(r=>release=r);
    const delayedPromise=cabinet('admin',true,{promise,started});await startedPromise;
    const delayed=await delayedPromise;
    await delayed.page.evaluate(()=>window.MA.logout(false));release();
    await delayed.page.waitForFunction(()=>document.querySelector('#accessBody')?.textContent.includes('Пробная версия'));
    assert.equal(await delayed.page.locator('#achGrid [data-state="preview"]').count(),0);
    assert.deepEqual(errors,[]);
    console.log('Cabinet: all administrator entitlements, achievement preview without fake progress, paid-user parity, real rewards, role revocation, API failure, stale logout response and mobile layout passed.');
  } finally {for(const context of contexts)await context.close();await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
