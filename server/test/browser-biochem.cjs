'use strict';
// Disposable local accounts and the real topic API; no production account changes.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const {chromium} = require(process.env.ATLAS_PLAYWRIGHT || '../../pathophys-atlas/node_modules/playwright');
const {config} = require('../src/config'), {createApp} = require('../src/app'), {memoryStore} = require('../src/store/memory'), {jwtSign, keys, now} = require('../src/tokens');
const root = path.resolve(__dirname, '../..');
(async () => {
  const cfg = config({SITE_URL:'http://127.0.0.1', API_URL:'https://local-api.invalid', SECRET:'local-biochem-acceptance-secret-not-production', STORE:'memory', MAIL_TRANSPORT:'log', CONTENT_DIR:path.join(root, 'server/content')});
  cfg.contentLimits = {minute:10000, hour:10000, day:10000, bytesDay:1024*1024*1024};
  const store = memoryStore();
  for (const user of [{id:'admin', contentAdmin:true}, {id:'subscriber'}, {id:'student'}]) await store.putUser({...user, tv:0, name:user.id});
  await store.putDoc('access:subscriber', {biochem:{expiresAt:Date.now()+3600000}}, 0);
  const app = createApp({cfg, store, mail:{}, log:{error:console.error}});
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname).slice(1);
    if (!rel || rel.endsWith('/')) rel += 'index.html';
    const file = path.resolve(root, rel);
    if (!file.startsWith(root+path.sep) || !['auth','progress','biochem-atlas'].includes(rel.split('/')[0])) {res.writeHead(404); return res.end();}
    try {res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : 'text/html; charset=utf-8'); res.end(fs.readFileSync(file));}
    catch {res.writeHead(404); res.end();}
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:'+server.address().port; cfg.origins.push(origin);
  const browser = await chromium.launch({headless:true, executablePath:process.env.ATLAS_BROWSER || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  try {
    const context = await browser.newContext({viewport:{width:1365, height:900}, reducedMotion:'reduce'});
    context.setDefaultTimeout(10000);
    const requests = [], errors = []; let failContent = false;
    await context.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.pathname === '/auth/config.js') return route.fulfill({contentType:'application/javascript', body:'window.MA_CONFIG={api:"https://local-api.invalid"};'});
      if (url.hostname === 'local-api.invalid') {
        if (url.pathname.startsWith('/content-')) {
          requests.push(url.pathname);
          if (failContent) return route.fulfill({status:503, contentType:'application/json', body:'{"message":"Test outage"}'});
        }
        const result = await app.handle({method:req.method(), path:url.pathname, query:Object.fromEntries(url.searchParams), headers:req.headers(), body:req.postData() || '', ip:'local'});
        return route.fulfill({status:result.status, headers:result.headers, body:result.base64 ? Buffer.from(result.body,'base64') : result.body});
      }
      return url.origin === origin ? route.continue() : route.abort();
    });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    async function visit(suffix = '') {
      await page.goto(origin+'/biochem-atlas/'+suffix);
      await page.waitForFunction(() => document.querySelector('#ma-topic-controls'));
    }
    async function signIn(id) {
      const token = jwtSign({sub:id, tv:0, typ:'a', exp:now()+3600}, keys(cfg.secret).jwt);
      await page.evaluate(session => localStorage.setItem('ma-session',JSON.stringify(session)), {access:token, accessExp:now()+3600, refresh:'local', refreshExp:now()+3600, user:{id}});
    }
    const visibleCards = () => page.locator('[data-biochem-topic]:visible');
    await visit();
    assert.equal(await page.title(), 'Атлас биохимии');
    assert.equal(await page.locator('h1').textContent(), 'Атлас биохимии');
    assert.equal(await page.locator('.views [data-view]').count(), 5);
    assert.equal(await visibleCards().count(), 10);
    assert.equal(await page.locator('[data-biochem-topic="sec-aa"] .lock-ico').count(), 1);
    assert.equal(await page.evaluate(() => typeof BX), 'undefined');
    assert.deepEqual(requests, []);
    assert.doesNotMatch(await page.locator('body').innerText(), /Начните с основ/);
    await page.locator('[data-view="paths"]').click();
    await page.waitForFunction(() => document.querySelector('#catalog-title').textContent === 'Метаболические пути');
    assert.equal(await visibleCards().count(), 4);
    await page.locator('[data-view="anim"]').click();
    await page.waitForFunction(() => document.querySelector('#catalog-title').textContent === 'Анимации');
    assert.equal(await visibleCards().count(), 5);
    await page.locator('#q').fill('кинетика'); assert.equal(await visibleCards().count(), 1);
    await page.locator('#q').fill('неттакого'); assert.equal(await page.locator('#catalog-empty').isVisible(), true);
    await page.locator('#q').fill('');
    await page.locator('[data-view="atlas"]').click();
    await page.locator('.free-card[href="#amino-acids"]').click();
    await page.locator('#amino-acids').waitFor({state:'visible'});
    assert.equal(await page.locator('#monosaccharides').isVisible(), false);
    await page.locator('#amino-acids a').click();
    await page.locator('.free-card[href="#monosaccharides"]').click();
    await page.locator('#monosaccharides').waitFor({state:'visible'});
    await page.goBack(); assert.equal(await visibleCards().count(), 10);
    await page.locator('#themeBtn').click(); assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    await page.locator('#themeBtn').click(); assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.locator('#themeBtn').click(); assert.equal(await page.locator('html').getAttribute('data-theme'), null);
    await visit('#topic/sec-lip');
    assert.match(await page.locator('#topic-notice').innerText(), /Войдите/);
    assert.equal(await page.locator('#topic-notice a.primary').count(), 1);
    assert.deepEqual(requests, []);
    await page.locator('#topic-notice a[href="#atlas"]').click();
    await page.waitForFunction(() => !document.querySelector('#topic-notice') || document.querySelector('#topic-notice').hidden);
    await signIn('student'); await visit('#topic/sec-lip');
    assert.match(await page.locator('#topic-notice').innerText(), /действующей подписке/);
    assert.equal(await page.evaluate(() => typeof BX), 'undefined');
    await signIn('admin'); requests.length = 0; await visit();
    assert.equal(await visibleCards().count(), 10);
    assert.equal(await page.locator('[data-biochem-topic] .lock-ico').count(), 0);
    assert.match(await page.locator('#access-note').textContent(), /администратору/);
    assert.deepEqual(requests, []);
    await page.locator('[data-biochem-topic="sec-aa"]').click();
    await page.locator('#ma-copy-label').waitFor();
    assert.equal(await page.evaluate(() => window.MA_COPY.topic), 'sec-aa');
    assert.equal(await page.locator('body').getAttribute('data-biochem-shell'), null);
    assert.equal(await page.locator('.controls a').filter({hasText:'Все разделы'}).count(), 1);
    assert.deepEqual(requests, ['/content-v3/biochem/sec-aa']);
    await page.locator('.controls a').filter({hasText:'Все разделы'}).click();
    await page.locator('#topic-grid').waitFor();
    assert.equal(await page.locator('[data-biochem-topic] .lock-ico').count(), 0);
    await page.locator('[data-view="rx"]').click();
    await page.locator('[data-biochem-topic="sec-aa"]').click();
    await page.locator('#v-rx').waitFor({state:'visible'});
    await visit('?view=study#topic/sec-aa');
    await page.locator('#v-study').waitFor({state:'visible'});
    for (const [topic, view] of [['path-glyc','paths'], ['anim-kin','anim']]) {
      await visit('#topic/'+topic); await page.locator('#v-'+view).waitFor({state:'visible'});
      assert.equal(await page.evaluate(() => window.MA_COPY.topic), topic);
    }
    failContent = true; await visit('#topic/sec-lip');
    assert.match(await page.locator('#topic-notice').innerText(), /Не удалось загрузить/);
    failContent = false; await page.locator('#topic-notice button').click();
    await page.locator('#ma-copy-label').waitFor();
    await signIn('subscriber'); await visit();
    assert.equal(await page.locator('[data-biochem-topic] .lock-ico').count(), 0);
    assert.match(await page.locator('#access-note').textContent(), /вашей подписке/);
    await visit('#amino-acids'); assert.equal(await page.locator('#amino-acids').isVisible(), true);
    await visit();
    const grant = await store.getDoc('access:subscriber');
    await store.putDoc('access:subscriber', {biochem:{expiresAt:Date.now()-1}}, grant.v);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForFunction(() => document.querySelector('[data-biochem-topic="sec-aa"] .lock-ico'));
    await signIn('admin'); await visit();
    await page.evaluate(() => window.MA.logout(false));
    await page.waitForFunction(() => document.querySelector('[data-biochem-topic="sec-aa"] .lock-ico'));
    fs.mkdirSync(path.join(root,'outputs'), {recursive:true});
    await page.screenshot({path:path.join(root,'outputs/biochem-desktop.png')});
    for (const width of [390, 320]) {
      await page.setViewportSize({width, height:844});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1), true, 'Mobile overflow: '+width);
      await page.locator('[data-view="anim"]').click();
      await page.waitForFunction(() => document.querySelector('#catalog-title').textContent === 'Анимации');
      assert.equal(await visibleCards().count(), 5);
      await page.locator('[data-view="atlas"]').click();
      await page.screenshot({path:path.join(root,'outputs/biochem-mobile-'+width+'.png')});
    }
    assert.deepEqual(errors, []);
    console.log('Biochemistry: guest/admin/subscriber home, five views, free notes, search, protected topic delivery, retry, expiry, logout and 320/390px layouts passed.');
  } finally {await browser.close(); await new Promise(r => server.close(r));}
})().catch(error => {console.error(error); process.exitCode = 1;});
