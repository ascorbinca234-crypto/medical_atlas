'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const tick = () => new Promise(resolve => setImmediate(resolve));
function home(api, owner = {id: 'admin'}) {
  let change, visibility, timer, user = owner;
  const cards = ['farma', 'biochem', 'micro', 'pathophys'].map(atlas => {
    const status = {}, note = {textContent: 'demo:' + atlas};
    return {dataset: {maAtlas: atlas}, status, note, querySelector: selector => selector.includes('status') ? status : note};
  });
  const ctx = {window: {MA: {user: () => user, api, onChange: fn => change = fn}},
    document: {hidden: false, querySelectorAll: () => cards, addEventListener: (_, fn) => visibility = fn},
    Date, setTimeout: fn => { timer = fn; }, clearTimeout: () => { timer = null; }};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/atlas-access.js'), 'utf8'), ctx);
  return {cards, logout() {user = null; change();}, refresh() {visibility();}, expire() {timer();}};
}
const grants = subjects => Object.fromEntries(subjects.map(s => [s, {expiresAt: Date.now() + 60000}]));
test('главная показывает администратору полный доступ ко всем четырём атласам', async () => {
  const h = home(async () => ({policy: 'subject-subscription-v1', admin: true, grants: grants(['farma', 'biochem', 'micro', 'pathophys'])}));
  await tick();
  assert.ok(h.cards.every(c => c.status.textContent === 'Открыт' && c.note.textContent.includes('администратору')));
  h.logout();
  assert.ok(h.cards.every(c => c.status.textContent === 'Пробная версия' && c.note.textContent === 'demo:' + c.dataset.maAtlas));
});
test('главная учитывает отдельные подписки, истечение прав и ошибки проверки', async () => {
  let result = {policy: 'subject-subscription-v1', grants: grants(['micro'])};
  const h = home(async () => {if (result instanceof Error) throw result; return result;});
  await tick();
  assert.deepEqual(h.cards.map(c => c.status.textContent), ['Пробная версия', 'Пробная версия', 'Открыт', 'Пробная версия']);
  result.grants.micro.expiresAt = Date.now() - 1;
  h.expire(); await tick(); assert.ok(h.cards.every(c => c.status.textContent === 'Пробная версия'));
  result = new Error('offline'); h.refresh(); await tick();
  assert.ok(h.cards.every(c => c.status.textContent === 'Не удалось проверить доступ'));
});
test('гость не запрашивает права; поздний ответ не возвращает полный доступ после выхода', async () => {
  let calls = 0, finish;
  const guest = home(() => {calls++;}, null);
  assert.equal(calls, 0); assert.ok(guest.cards.every(c => c.status.textContent === 'Пробная версия'));
  const h = home(() => new Promise(resolve => {finish = resolve;})); h.logout();
  finish({policy: 'subject-subscription-v1', admin: true, grants: grants(['farma', 'biochem', 'micro', 'pathophys'])});
  await tick(); assert.ok(h.cards.every(c => c.status.textContent === 'Пробная версия'));
});
test('очистка кеша удаляет только три фотографии команды, сохраняя другие изображения', async () => {
  const removed = [], requests = [
    'https://site.invalid/medical_atlas/assets/team/ceo.jpg',
    'https://site.invalid/medical_atlas/assets/team/dev.jpg?v=old',
    'https://site.invalid/medical_atlas/assets/team/mkt.jpg',
    'https://site.invalid/medical_atlas/assets/lesson.jpg',
    'https://site.invalid/other/assets/team/ceo.jpg',
    'https://other.invalid/medical_atlas/assets/team/dev.jpg',
    'https://site.invalid/medical_atlas/assets/team/other.jpg'
  ].map(url => ({url}));
  const caches = {keys: async () => ['site-images'], open: async () => ({keys: async () => requests, delete: async request => {removed.push(request.url); return true;}})};
  const ctx = {URL, window: {MA_CONFIG: {}, caches, addEventListener() {}}, document: {currentScript: {src: 'https://site.invalid/medical_atlas/auth/auth.js'}, addEventListener() {}},
    location: {href: 'https://site.invalid/medical_atlas/'}, indexedDB: {deleteDatabase() {}}, localStorage: {getItem: () => null}, console};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'auth/auth.js'), 'utf8'), ctx);
  await tick(); assert.deepEqual(removed.sort(), requests.slice(0, 3).map(r => r.url).sort());
});
