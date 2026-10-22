'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '../../micro-atlas');
function demo() {
  const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const scripts = [...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x => x[1]);
  const data = scripts.find(x => x.includes('const MICRO_CATALOG ='));
  assert.ok(data);
  const ctx = vm.createContext({ window: {}, document:{addEventListener(){}}, localStorage: { getItem: () => null }, location: { hash: '' } });
  vm.runInContext(data, ctx);
  const app = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8').split('/* ---------- старт ---------- */')[0];
  vm.runInContext(app, ctx);
  return ctx;
}
test('публичная микробиология содержит ровно две темы; закрытые досье и вопросы не встроены', () => {
  const ctx = demo();
  assert.equal(vm.runInContext('JSON.stringify(TH.filter(t=>!t.locked).map(t=>t.id))', ctx), '["g1","g2"]');
  assert.equal(vm.runInContext('TH.filter(t=>t.locked).length', ctx), 27);
  assert.equal(vm.runInContext('TH.filter(t=>t.locked).every(t=>t.blocks.length===0&&!t.lead)', ctx), true);
  assert.equal(vm.runInContext('PG.length+QS.length', ctx), 0);
  assert.doesNotMatch(vm.runInContext('homePage()', ctx), /NaN|Infinity/);
});
test('версия 8 сохраняет полный каталог, оба набора вопросов и раздельную загрузку новых разделов',()=>{
  const catalog=JSON.parse(fs.readFileSync(path.join(root,'src/catalog.json')));
  assert.equal(catalog.version,8);assert.equal(catalog.topics.length,29);assert.equal(catalog.clusters.length,7);
  assert.equal(catalog.pathogens,118);assert.equal(catalog.questions,440);assert.equal(catalog.photos,130);
  assert.equal(catalog.animations.length,23);assert.equal(catalog.drugs,67);assert.equal(catalog.classes,21);
  const nav=JSON.parse(fs.readFileSync(path.join(root,'topics.json')));
  assert.equal(nav.aliases['gallery/11'],'gallery-11');assert.equal(nav.aliases['learn/ph/2'],'gallery-2');
  assert.equal(nav.aliases['anim/v-hiv'],'anim-v-hiv');assert.equal(nav.aliases['abx/ceftriaxone'],'abx');
  const ctx=demo();
  assert.equal(vm.runInContext('Object.keys(ZTX).join(",")',ctx),'g1,g2');
  assert.ok(vm.runInContext('Object.values(FIG).every(f=>f.svg||f.img)',ctx));
  assert.equal(vm.runInContext('AN_LIST.map(a=>a.id).sort().join(",")',ctx),'biofilm,gram,growth');
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
