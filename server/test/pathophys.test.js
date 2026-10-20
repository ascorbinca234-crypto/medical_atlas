'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '../..'), atlas = path.join(root, 'pathophys-atlas');
const catalog = JSON.parse(fs.readFileSync(path.join(atlas, 'topics.json')));
const { topicFixture } = require('./topic-fixture');

test('патофизиология: открыты ровно две темы; закрытые уроки и схемы отсутствуют в публичных исходниках', async () => {
  const { analyze } = await import('../../pathophys-atlas/source.mjs');
  const src = fs.readFileSync(path.join(atlas, 'src/PathoAtlas.jsx'), 'utf8');
  const parsed = analyze(src, false);
  assert.deepEqual(parsed.topics.map(t => t.id), ['disease', 'pathogenesis']);
  assert.equal(catalog.topics.length, 28);
  assert.equal(new Set(catalog.topics.map(t => t.id)).size, 28);
  for (const name of ['MicroCirc', 'CellDeath', 'MastCell', 'BasalGanglia', 'O2Curve', 'Thrombus']) assert.ok(!parsed.declarations.has(name), name);
  assert.match(fs.readFileSync(path.join(atlas, 'index.html'), 'utf8'), /bootAtlas\('pathophys','patho-app'\)/);
});

test('патофизиология: чужая подписка, истечение и отзыв не дают доступ к теме', async t => {
  const os = require('node:os'), { config } = require('../src/config'), { memoryStore } = require('../src/store/memory');
  const { createApp } = require('../src/app'), { keys, jwtSign, now } = require('../src/tokens');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-pathophys-')); t.after(() => fs.rmSync(dir, {recursive:true, force:true}));
  topicFixture(dir, 'pathophys', 'window.PATHO_ONE_TOPIC=true;', 'inflammation');
  const cfg = config({SITE_URL:'https://site.invalid', API_URL:'https://api.invalid', SECRET:'x'.repeat(40), STORE:'memory', MAIL_TRANSPORT:'log', CONTENT_DIR:dir});
  const store = memoryStore(); await store.putUser({id:'u', tv:0});
  const app = createApp({cfg, store, mail:{}, log:{error(){}}});
  const token = jwtSign({sub:'u',tv:0,typ:'a',exp:now()+600}, keys(cfg.secret).jwt);
  const call = (authenticated = true) => app.handle({method:'GET', path:'/content-v3/pathophys/inflammation', query:{}, ip:'local', headers:authenticated ? {authorization:'Bearer '+token} : {}});
  assert.equal((await call(false)).status, 401);
  await store.putDoc('access:u', {micro:{expiresAt:Date.now()+60000}}, 0);
  assert.equal((await call()).status, 403);
  await store.putDoc('access:u', {pathophys:{expiresAt:Date.now()+60000}}, 1);
  const result = await call(); assert.equal(result.status, 200);
  assert.match(result.body, /PATHO_ONE_TOPIC/); assert.match(result.body, /personal copy/);
  for (const grant of [{expiresAt:Date.now()-1}, {expiresAt:Date.now()+60000, revoked:true}]) {
    const prev = await store.getDoc('access:u'); await store.putDoc('access:u', {pathophys:grant}, prev.v);
    assert.equal((await call()).status, 403);
  }
  const subjects = require('../src/access').SUBJECTS;
  assert.equal(subjects.find(s => s.id === 'pathophys').available, true);
});

test('патофизиология: каждый частный пакет содержит одну тему и рабочие визуализации', {skip:!fs.existsSync(path.join(root,'server/content/topics/pathophys/manifest.json'))}, () => {
  const React = require('../../pathophys-atlas/node_modules/react');
  const { renderToStaticMarkup } = require('../../pathophys-atlas/node_modules/react-dom/server');
  const icons = require('../../pathophys-atlas/node_modules/lucide-react');
  const dir = path.join(root, 'server/content/topics/pathophys');
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json')));
  const publicText = fs.readFileSync(path.join(atlas, 'index.html'), 'utf8');
  assert.deepEqual(Object.keys(manifest.topics), catalog.topics.map(t => t.id));
  for (const {id} of catalog.topics) {
    const code = fs.readFileSync(path.join(dir,id+'.js'), 'utf8'), ctx = {window:{}};
    vm.runInNewContext(code, ctx);
    const loaded = ctx.window.MA_PATHO_TOPIC; assert.equal(loaded.topic.id, id);
    if (!catalog.demo.includes(id)) assert.ok(!publicText.includes(loaded.topic.definition), id+' definition leaked');
    for (const C of loaded.makeVisuals({React,...React,...icons})) {
      assert.match(renderToStaticMarkup(React.createElement(C)), /<svg/, id);
    }
  }
});
