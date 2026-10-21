'use strict';
// Local acceptance: actual access API with disposable users, no production changes.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const {chromium} = require('../../pathophys-atlas/node_modules/playwright');
const {config} = require('../src/config'), {createApp} = require('../src/app'), {memoryStore} = require('../src/store/memory'), {jwtSign, keys, now} = require('../src/tokens');
const root = path.resolve(__dirname, '../..');
(async () => {
  const cfg = config({SITE_URL: 'http://127.0.0.1', API_URL: 'https://local-api.invalid', SECRET: 'local-locks-acceptance-secret-not-production', STORE: 'memory', MAIL_TRANSPORT: 'log', CONTENT_DIR: path.join(root, 'server/content')});
  const store = memoryStore();
  await store.putUser({id: 'admin', tv: 0, name: 'Администратор', contentAdmin: true});
  await store.putUser({id: 'student', tv: 0, name: 'Студент'});
  await store.putDoc('access:student', {micro: {expiresAt: Date.now() + 60000}}, 0);
  cfg.contentLimits = {minute:1000,hour:1000,day:1000,bytesDay:1024*1024*1024};
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
  try {
    const context = await browser.newContext({viewport: {width: 1365, height: 900}, reducedMotion: 'reduce'});
    context.setDefaultTimeout(10000);
    await context.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.pathname === '/auth/config.js') return route.fulfill({contentType: 'application/javascript', body: 'window.MA_CONFIG={api:"https://local-api.invalid"};'});
      if (url.hostname === 'local-api.invalid') {
        const r = await app.handle({method: req.method(), path: url.pathname, query: Object.fromEntries(url.searchParams), headers: req.headers(), body: req.postData() || '', ip: 'local'});
        return route.fulfill({status: r.status, headers: r.headers, body: r.base64 ? Buffer.from(r.body, 'base64') : r.body});
      }
      return url.origin === origin ? route.continue() : route.abort();
    });
    const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    async function visit(atlas, hash = '') {
      await page.goto(origin + '/' + atlas + '-atlas/#' + hash);
      await page.locator('#ma-topic-controls').waitFor();
    }
    async function signIn(id) {
      const token = jwtSign({sub: id, tv: 0, typ: 'a', exp: now() + 3600}, keys(cfg.secret).jwt);
      await page.evaluate(session => localStorage.setItem('ma-session', JSON.stringify(session)), {access: token, accessExp: now() + 3600, refresh: 'local', refreshExp: now() + 3600, user: {id}});
    }
    async function locks(atlas) {
      if (atlas === 'micro') return (await page.locator('.nav').textContent()).includes('🔒');
      const selectors = {farma:'#nav .lock-ico, .pcard .lock-tag', pathophys:'.pa-nav [aria-label="По подписке"], .pa-card .lucide-lock', biochem:'#pTabs .lock-ico, #anList .lock-ico'};
      return await page.locator(selectors[atlas]).count() > 0;
    }
    await visit('micro', 'g1'); assert.equal(await locks('micro'), true);
    await signIn('admin');
    for (const [atlas, hash] of [['micro','g6'],['micro','g1'],['farma','k-adr'],['farma','k-gen'],['farma',''],['pathophys','inflammation'],['pathophys','disease'],['pathophys','']]) {
      await visit(atlas, hash);
      assert.equal(await page.evaluate(a => window.MA.hasAtlasAccess(a), atlas), true);
      assert.equal(await locks(atlas), false, atlas + ' ' + hash + ' still has a lock');
      if (atlas === 'micro') assert.match(await page.locator('.brand').textContent(), /Полный доступ/);
      console.log(atlas + ' #' + hash + ': unlocked');
    }
    await page.goto(origin + '/biochem-atlas/');
    await page.locator('#grid .card').first().waitFor();
    assert.equal(await page.locator('#grid .card').count(), 131);
    assert.equal(await page.locator('.lock-ico').count(), 0);
    // An unloaded lesson remains a stub; its content still requires server delivery.
    await visit('micro','g6');
    assert.equal(await page.evaluate(() => TMAP.g3.locked), true);
    await page.locator('.nav a[data-id="g3"]').click();
    await page.waitForFunction(() => window.MA_COPY?.topic === 'g3');
    assert.equal(await page.evaluate(() => TMAP.g3.locked), undefined);
    assert.equal(await locks('micro'), false);
    await page.setViewportSize({width:390,height:844});
    await page.locator('#burger').click();
    await page.screenshot({path:path.join(root,'outputs/micro-unlocked-mobile.png')});
    await page.setViewportSize({width:1365,height:900});
    await signIn('student'); await visit('micro','g1'); assert.equal(await locks('micro'), false);
    await visit('farma','k-gen'); assert.equal(await locks('farma'), true);
    await visit('pathophys','disease'); assert.equal(await locks('pathophys'), true);
    await visit('micro','g1');
    const previous = await store.getDoc('access:student');
    await store.putDoc('access:student', {micro:{expiresAt:Date.now()-1}}, previous.v);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForFunction(() => document.querySelector('.nav')?.textContent.includes('🔒'));
    assert.equal(await page.evaluate(() => window.MA.hasAtlasAccess('micro')), false);
    const expired = await store.getDoc('access:student');
    await store.putDoc('access:student', {micro:{expiresAt:Date.now()+60000}}, expired.v);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForFunction(() => window.MA?.hasAtlasAccess('micro') && !document.querySelector('.nav')?.textContent.includes('🔒'));
    assert.equal(await locks('micro'), false);
    await signIn('admin'); await visit('micro','g1');
    await page.evaluate(() => window.MA.logout(false));
    await page.waitForFunction(() => document.querySelector('.nav')?.textContent.includes('🔒'));
    assert.equal(await page.evaluate(() => window.MA.hasAtlasAccess('micro')), false);
    assert.deepEqual(errors, []);
    console.log('Protected atlases: access, topic API, expiry and logout passed. Original biochemistry: all 131 cards available.');
  } finally {await browser.close(); await new Promise(r => server.close(r));}
})().catch(e => {console.error(e); process.exitCode = 1;});
