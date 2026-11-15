'use strict';
// Run with ATLAS_PLAYWRIGHT and, optionally, ATLAS_BROWSER set for this machine.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.ATLAS_PLAYWRIGHT || '../../pathophys-atlas/node_modules/playwright');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'outputs');
const html = fs.readFileSync(path.join(root, 'biochem-atlas/index.html'), 'utf8');
const notes = JSON.parse(html.match(/const NOTES = (\[[\s\S]*?\]);\s*const NBY/)[1]);
assert.equal(notes.length, 15);
for (const t of notes) {
  assert.ok(t.secs.some(s => s.b.some(b => b[0] === 'steps')), t.id + ': missing mechanism');
  assert.ok(t.secs.some(s => /План устного/.test(s.h)), t.id + ': missing oral outline');
  assert.ok(t.secs.some(s => s.b.some(b => b[0] === 'source')), t.id + ': missing sources');
  assert.ok(t.quiz.length >= 6, t.id + ': missing self-check');
  assert.ok(t.secs.length >= 10, t.id + ': unexpectedly short');
}
(async () => {
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/biochem-atlas/' || pathname === '/biochem-atlas/index.html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html);
    } else { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({headless:true, ...(process.env.ATLAS_BROWSER ? {executablePath:process.env.ATLAS_BROWSER} : {})});
    const context = await browser.newContext({viewport:{width:1365,height:900}, reducedMotion:'reduce'});
    context.setDefaultTimeout(10000);
    await context.route('**/*', r => r.request().url().startsWith(origin) ? r.continue() : r.abort());
    const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + '/biochem-atlas/#n-carb1');
    await page.locator('#nArt [data-flow]').waitFor();
    assert.equal(await page.locator('#grid .card').count(), 131);
    assert.equal(await page.locator('#rxAll .rx').count(), 275);
    assert.equal(await page.locator('#nTocL [data-nt]').count(), 15);
    for (const t of notes) {
      await page.locator('#nTocL [data-nt="' + t.id + '"]').click();
      assert.equal(await page.locator('.ntitle').textContent(), t.title);
      assert.equal(await page.locator('#nArt .lesson-section').count(), t.secs.length);
      const f = page.locator('#nArt [data-flow]').first();
      const total = await f.locator('[data-flow-step]').count();
      assert.ok(total >= 4);
      await f.locator('[data-flow-next]').click();
      assert.equal(await f.locator('[data-flow-count]').textContent(), '2 / ' + total);
      await f.locator('[data-flow-step]').last().click();
      assert.ok(await f.locator('[data-flow-next]').isDisabled());
      await f.locator('[data-flow-prev]').click();
      assert.equal(await f.locator('[data-flow-count]').textContent(), (total-1) + ' / ' + total);
      await page.locator('[data-notes-collapse]').click();
      assert.equal(await page.locator('.lesson-section[open]').count(), 0);
      await page.locator('[data-nsec]').last().click();
      assert.ok(await page.locator('.lesson-section').last().getAttribute('open') !== null);
      assert.ok(await page.locator('.lesson-source a').first().isVisible());
      await page.locator('[data-notes-expand]').click();
      assert.equal(await page.locator('.lesson-section[open]').count(), t.secs.length);
      const q = page.locator('.nq').last(); await q.locator('summary').click();
      assert.ok(await q.locator('.nqa').isVisible());
    }
    // Search must find new reaction explanations AND reveal a non-first step.
    await page.locator('#nq').fill('ацилфосфатной');
    await page.locator('#nTocL [data-nt="carb1"]').click();
    assert.equal(await page.locator('[data-flow-count]').textContent(), '6 / 10');
    assert.ok(await page.locator('.flow-panel mark').first().isVisible());
    await page.locator('#nq').fill('');
    await page.locator('#nTocL [data-nt="carb1"]').click();
    const flow = page.locator('[data-flow]').first();
    await page.clock.install();
    await flow.locator('[data-flow-play]').click();
    await page.clock.runFor(6600);
    assert.equal(await flow.locator('[data-flow-count]').textContent(), '2 / 10');
    await flow.locator('[data-flow-play]').click();
    await page.clock.runFor(7000);
    assert.equal(await flow.locator('[data-flow-count]').textContent(), '2 / 10');
    await flow.locator('[data-flow-play]').click();
    await page.locator('[data-view="atlas"]').click();
    await page.locator('[data-view="notes"]').click();
    assert.equal(await flow.locator('[data-flow-play]').getAttribute('aria-pressed'), 'false');
    await page.clock.runFor(7000);
    assert.equal(await flow.locator('[data-flow-count]').textContent(), '2 / 10');
    fs.mkdirSync(output, {recursive:true});
    await flow.scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(output, 'biochem-lessons-desktop.png')});
    await page.locator('#themeBtn').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.screenshot({path:path.join(output, 'biochem-lessons-dark.png')});
    await page.locator('#themeBtn').click(); await page.locator('#themeBtn').click();
    await page.setViewportSize({width:390,height:844});
    await page.locator('#nMenu').click();
    await page.locator('#nTocL [data-nt="carb1"]').click();
    assert.equal(await page.locator('#nMenu').getAttribute('aria-expanded'), 'false');
    await page.locator('[data-notes-expand]').click();
    await flow.scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'mobile page overflows');
    await page.screenshot({path:path.join(output, 'biochem-lessons-mobile.png')});
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({topics:notes.length, sections:notes.reduce((n,t)=>n+t.secs.length,0), questions:notes.reduce((n,t)=>n+t.quiz.length,0), mechanisms:notes.flatMap(t=>t.secs.flatMap(s=>s.b)).filter(b=>b[0]==='steps').length, status:'PASS: all topics, search, step controls, playback, pause, view change, answers, sources, themes, mobile'}, null, 2));
  } finally { if (browser) await browser.close(); await new Promise(r => server.close(r)); }
})().catch(e => {console.error(e);process.exitCode=1;});
