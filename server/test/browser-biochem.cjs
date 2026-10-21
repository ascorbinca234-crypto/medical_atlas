'use strict';
// Acceptance for the original standalone atlas, with no accounts or API access.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const {chromium} = require(process.env.ATLAS_PLAYWRIGHT || '../../pathophys-atlas/node_modules/playwright');
const root = path.resolve(__dirname, '../..');
(async () => {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname).slice(1);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.resolve(root, rel);
    if (!file.startsWith(path.join(root,'biochem-atlas')+path.sep)) {res.writeHead(404); return res.end();}
    try {res.setHeader('Content-Type','text/html; charset=utf-8'); res.end(fs.readFileSync(file));}
    catch {res.writeHead(404); res.end();}
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:'+server.address().port;
  const browser = await chromium.launch({headless:true, executablePath:process.env.ATLAS_BROWSER || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  try {
    const context = await browser.newContext({viewport:{width:1365,height:900},reducedMotion:'reduce'});
    context.setDefaultTimeout(10000);
    const apiRequests = [], errors = [];
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.includes('/auth/') || url.pathname.includes('/content-') || url.hostname.includes('apigw')) apiRequests.push(url.href);
      return url.origin === origin ? route.continue() : route.abort();
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin+'/biochem-atlas/');
    await page.locator('#grid .card').first().waitFor();
    assert.equal(await page.locator('#grid .card').count(),131);
    assert.equal(await page.locator('#chroma .seg').count(),10);
    assert.equal(await page.locator('#rxAll .rx').count(),275);
    assert.match(await page.locator('#lede').textContent(),/131.*275/);
    assert.equal(await page.locator('#grid .mol svg').count()>0,true);
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('#chroma .seg')).every(e=>e.getAnimations().every(a=>a.playState==='finished')));
    fs.mkdirSync(path.join(root,'outputs'),{recursive:true});
    await page.screenshot({path:path.join(root,'outputs/biochem-original-desktop.png')});
    // The original category bar filters substance cards in place.
    await page.locator('#legend [data-sec="aa"]').click();
    assert.equal(await page.locator('#grid .card:visible').count(),20);
    await page.locator('#legend [data-sec=""]').click();
    await page.locator('#q').fill('неттакоговещества');assert.equal(await page.locator('#empty').isVisible(),true);
    await page.locator('#reset').click();assert.equal(await page.locator('#grid .card:visible').count(),131);
    await page.locator('#grid .card').filter({has:page.locator('.cname',{hasText:'Глицин'})}).first().click();
    await page.locator('#sheet.open').waitFor();assert.equal(await page.locator('#dName').textContent(),'Глицин');
    assert.equal(await page.locator('#dMol svg').count()>0,true);
    await page.locator('#dStar').click();await page.locator('#dClose').click();
    await page.locator('#sheet').waitFor({state:'hidden'});await page.locator('#aFav').click();
    assert.equal(await page.locator('#grid .card:visible').count(),1);
    await page.reload();await page.locator('#grid .card').first().waitFor();
    assert.equal(await page.locator('#aFavN').textContent(),'1');
    await page.locator('[data-view="rx"]').click();await page.locator('#v-rx').waitFor({state:'visible'});
    await page.locator('#rq').fill('гексокиназа');assert.equal(await page.locator('#rxAll .rx:visible').count()>0,true);
    await page.locator('#rq').fill('');
    await page.locator('#rxAll .rx').first().locator('summary').click();
    assert.equal(await page.locator('#rxAll .rx').first().locator('.rx-body').isVisible(),true);
    await page.locator('[data-view="paths"]').click();
    assert.equal(await page.locator('#pTabs button').count(),4);
    for (const id of ['glyc','tca','urea','trp']) {
      await page.locator('#pTabs [data-path="'+id+'"]').click();
      assert.equal((await page.locator('#pSteps li').count())>0,true);
      assert.equal((await page.locator('#pDiag svg,#pDiag .flow').count())>0,true);
    }
    await page.locator('[data-view="anim"]').click();
    assert.equal(await page.locator('#anList button').count(),5);
    for (const id of ['etc','kin','hb','box','camp']) {
      await page.locator('#anList [data-an="'+id+'"]').click();
      assert.equal(await page.locator('#anBox svg').count()>0,true);
      assert.equal(await page.locator('#anList [data-an="'+id+'"]').getAttribute('aria-pressed'),'true');
    }
    await page.locator('[data-view="study"]').click();
    assert.equal(await page.locator('#sTabs button').count(),4);
    await page.locator('#sGo').click();assert.equal(await page.locator('#sBody .scard').isVisible(),true);
    await page.locator('#sTabs [data-st="build"]').click();assert.equal(await page.locator('#bWrap .bchip').count()>0,true);
    await page.locator('#sTabs [data-st="pairs"]').click();assert.equal(await page.locator('#pList .pair').count(),49);
    await page.locator('#sTabs [data-st="cheat"]').click();assert.equal(await page.locator('.cheat .ctab').count(),2);
    await page.locator('[data-view="atlas"]').click();
    await page.locator('#themeBtn').click();await page.locator('#themeBtn').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
    await page.locator('#themeBtn').click();
    await page.setViewportSize({width:390,height:844});
    // Preserve the original mobile layout as well; this is an exact restoration.
    assert.equal(await page.locator('#grid .card').count(),131);
    await page.screenshot({path:path.join(root,'outputs/biochem-original-mobile.png')});
    assert.deepEqual(apiRequests,[]);assert.deepEqual(errors,[]);
    console.log('Original biochemistry passed: 131 cards, 275 reactions, detail/formulas/favorites, all four pathways, all five animations, four study modes, theme, mobile; no account/API required.');
  } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
