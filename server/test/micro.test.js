'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '../../micro-atlas');
function demo() {
  const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const scripts = [...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x => x[1]);
  const data = scripts.find(x => x.includes('const MICRO_CATALOG ='));
  assert.ok(data);
  const ctx = vm.createContext({ window: {}, localStorage: { getItem: () => null }, location: { hash: '' } });
  vm.runInContext(data, ctx);
  const app = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8').split('/* ---------- старт ---------- */')[0];
  vm.runInContext(app, ctx);
  return ctx;
}
test('публичная микробиология содержит ровно две темы; закрытые досье и вопросы не встроены', () => {
  const ctx = demo();
  assert.equal(vm.runInContext('JSON.stringify(TH.filter(t=>!t.locked).map(t=>t.id))', ctx), '["g1","g2"]');
  assert.equal(vm.runInContext('TH.filter(t=>t.locked).length', ctx), 20);
  assert.equal(vm.runInContext('TH.filter(t=>t.locked).every(t=>t.blocks.length===0&&!t.lead)', ctx), true);
  assert.equal(vm.runInContext('PG.length+QS.length', ctx), 0);
  assert.doesNotMatch(vm.runInContext('homePage()', ctx), /NaN|Infinity/);
});
test('прямая ссылка, каталог, вопросы и тренажёр не обходят ограничение пробной версии', () => {
  const ctx = demo();
  for (const source of ["topicPage(TMAP.g3)", 'catalogPage()', 'questionsPage()', 'learnPage()']) {
    assert.match(vm.runInContext(source, ctx), /Этот материал входит в подписку/);
  }
  assert.doesNotMatch(vm.runInContext('topicPage(TMAP.g1)', ctx), /Этот материал входит в подписку/);
  assert.equal(vm.runInContext("searchAll('Криптококкоз').length", ctx), 0);
});
test('публичные исходники микробиологии не содержат закрытых файлов или полной сборки', () => {
  const names = fs.readdirSync(path.join(root, 'src'));
  assert.deepEqual(names.filter(x=>/^g\d/.test(x)).sort(), ['g01_morph.js', 'g02_phys.js']);
  assert.ok(!names.some(x=>/^p\d|^pathogens_|^questions/.test(x)));
  assert.ok(!fs.existsSync(path.join(root, 'dist')));
});
test('микробиология использует единый загрузчик подписок', () => {
  const calls = [];
  vm.runInNewContext(fs.readFileSync(path.join(root, 'src/boot.js'), 'utf8'), {window:{MA:{bootAtlas:(...args)=>calls.push(args)}}});
  assert.deepEqual(calls, [['micro', 'micro-app']]);
});
