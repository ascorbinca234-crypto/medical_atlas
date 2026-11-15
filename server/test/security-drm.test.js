'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), vm = require('node:vm');
const { config } = require('../src/config');
const { createApp } = require('../src/app');
const { memoryStore } = require('../src/store/memory');
const { topicFixture } = require('./topic-fixture');

const root = path.resolve(__dirname, '../..');

function makeServer(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-drm-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const id of ['farma', 'biochem', 'micro', 'pathophys', 'patan', 'chemistry']) {
    topicFixture(dir, id, 'window.OK=true;');
  }
  const cfg = config({
    SITE_URL: 'https://ma.example',
    API_URL: 'https://api.example',
    SECRET: 'z'.repeat(40),
    STORE: 'memory',
    MAIL_TRANSPORT: 'log',
    CONTENT_DIR: dir,
    MAX_DEVICES: '3',
    MAX_SHARE_DEVICES: '10',
  });
  const sent = [];
  const store = memoryStore();
  const app = createApp({ cfg, store, mail: { send: async m => { sent.push(m); } }, log: { error() {} } });
  const call = (method, p, body, headers = {}) => app.handle({
    method,
    path: p,
    query: {},
    headers: Object.assign({ origin: 'https://ma.example' }, headers),
    body: body ? JSON.stringify(body) : '',
    ip: headers['x-ip'] || '10.0.0.1',
  });
  return { app, call, sent, store, cfg };
}

test('лимит 3 устройств строго блокирует 4-е устройство и отвязка освобождает слот', async t => {
  const { call, sent } = makeServer(t);
  await call('POST', '/auth/register', { email: 'dev@example.com', password: 'secret-password-1', name: 'Student', consent: true });
  const codeMatch = /код подтверждения:\s*(\d{3})\s*(\d{3})/i.exec(sent[0].text);
  assert.ok(codeMatch);

  // Device 1 verifies account
  const d1 = { 'x-device-id': 'dev-one-1111', 'x-device-name': encodeURIComponent('Desktop Chrome') };
  const v = await call('POST', '/auth/verify-code', { email: 'dev@example.com', code: codeMatch[1] + codeMatch[2] }, d1);
  assert.equal(v.status, 200);
  const s1 = JSON.parse(v.body);
  assert.equal(s1.user.devicesCount, 1);
  assert.equal(s1.user.maxDevices, 3);

  // Device 2 & 3 log in
  const d2 = { 'x-device-id': 'dev-two-2222', 'x-device-name': encodeURIComponent('iPhone Safari') };
  const d3 = { 'x-device-id': 'dev-three-3333', 'x-device-name': encodeURIComponent('iPad Safari') };
  const l2 = await call('POST', '/auth/login', { email: 'dev@example.com', password: 'secret-password-1' }, d2);
  const l3 = await call('POST', '/auth/login', { email: 'dev@example.com', password: 'secret-password-1' }, d3);
  assert.equal(l2.status, 200);
  assert.equal(l3.status, 200);
  assert.equal(JSON.parse(l3.body).user.devicesCount, 3);

  // Device 4 is rejected on login AND when replaying Device 1 token
  const d4 = { 'x-device-id': 'dev-four-4444', 'x-device-name': encodeURIComponent('Android Chrome') };
  const l4 = await call('POST', '/auth/login', { email: 'dev@example.com', password: 'secret-password-1' }, d4);
  assert.equal(l4.status, 403);
  assert.equal(JSON.parse(l4.body).error, 'device_limit_exceeded');
  assert.equal(JSON.parse(l4.body).maxDevices, 3);

  const replay = await call('GET', '/access', null, { authorization: 'Bearer ' + s1.accessToken, ...d4 });
  assert.equal(replay.status, 403);
  assert.equal(JSON.parse(replay.body).error, 'device_limit_exceeded');

  // Inspect state and unlink Device 2
  const st = await call('GET', '/security/state', null, { authorization: 'Bearer ' + s1.accessToken, ...d1 });
  assert.equal(st.status, 200);
  const stateBody = JSON.parse(st.body);
  assert.equal(stateBody.registeredDevices.length, 3);
  assert.equal(stateBody.status, 'ACTIVE');

  const unlink = await call('POST', '/security/remove-device', { deviceId: 'dev-two-2222' }, { authorization: 'Bearer ' + s1.accessToken, ...d1 });
  assert.equal(unlink.status, 200);
  assert.equal(JSON.parse(unlink.body).registeredDevices.length, 2);

  // Now Device 4 succeeds
  const l4ok = await call('POST', '/auth/login', { email: 'dev@example.com', password: 'secret-password-1' }, d4);
  assert.equal(l4ok.status, 200);
  assert.equal(JSON.parse(l4ok.body).user.devicesCount, 3);
});

test('массовый вход с 10+ разных устройств автоматически банит аккаунт', async t => {
  const { call, sent } = makeServer(t);
  await call('POST', '/auth/register', { email: 'share@example.com', password: 'secret-password-1', consent: true });
  const m = /код подтверждения:\s*(\d{3})\s*(\d{3})/i.exec(sent[0].text);
  const d1 = { 'x-device-id': 'share-dev-01', 'x-device-name': 'PC-1' };
  const v = await call('POST', '/auth/verify-code', { email: 'share@example.com', code: m[1] + m[2] }, d1);
  const tok = JSON.parse(v.body).accessToken;

  for (let i = 2; i <= 3; i++) {
    const r = await call('POST', '/auth/login', { email: 'share@example.com', password: 'secret-password-1' }, { 'x-device-id': 'share-dev-0' + i });
    assert.equal(r.status, 200);
  }
  for (let i = 4; i <= 9; i++) {
    const r = await call('POST', '/auth/login', { email: 'share@example.com', password: 'secret-password-1' }, { 'x-device-id': 'share-dev-0' + i });
    assert.equal(r.status, 403);
    assert.equal(JSON.parse(r.body).error, 'device_limit_exceeded');
  }
  const tenth = await call('POST', '/auth/login', { email: 'share@example.com', password: 'secret-password-1' }, { 'x-device-id': 'share-dev-10' });
  assert.equal(tenth.status, 403);
  assert.equal(JSON.parse(tenth.body).error, 'account_banned');

  const blockedFirst = await call('GET', '/access', null, { authorization: 'Bearer ' + tok, ...d1 });
  assert.equal(blockedFirst.status, 403);
  assert.equal(JSON.parse(blockedFirst.body).error, 'account_banned');
});

function guardHarness(pathname, hash, selectorsPresent = new Set()) {
  const winListeners = {};
  const docListeners = {};
  const elementsById = {};
  const storage = new Map();

  function classList(init = []) {
    const set = new Set(init);
    return {
      add: (...xs) => xs.forEach(x => set.add(x)),
      remove: (...xs) => xs.forEach(x => set.delete(x)),
      toggle: (x, force) => (force === undefined ? (set.has(x) ? (set.delete(x), false) : (set.add(x), true)) : (force ? (set.add(x), true) : (set.delete(x), false))),
      contains: x => set.has(x),
      _set: set,
    };
  }

  function makeEl(tag) {
    const listeners = {};
    const queried = {};
    const el = {
      tagName: tag.toUpperCase(),
      id: '',
      _html: '',
      textContent: '',
      style: {},
      classList: classList(),
      children: [],
      attributes: {},
      hidden: false,
      setAttribute(k, v) { this.attributes[k] = String(v); },
      getAttribute(k) { return this.attributes[k] || null; },
      appendChild(child) {
        this.children.push(child);
        if (child.id) elementsById[child.id] = child;
        return child;
      },
      addEventListener(ev, fn) {
        (listeners[ev] = listeners[ev] || []).push(fn);
      },
      click() {
        (listeners.click || []).forEach(fn => fn({ target: el, preventDefault() {} }));
      },
      querySelector(sel) {
        if (sel.startsWith('#')) return elementsById[sel.slice(1)] || (queried[sel] = queried[sel] || makeEl('div'));
        return (queried[sel] = queried[sel] || makeEl('div'));
      },
      querySelectorAll() { return []; },
    };
    Object.defineProperty(el, 'innerHTML', {
      get: () => el._html,
      set: v => { el._html = String(v); },
    });
    return el;
  }

  const body = makeEl('body');
  const head = makeEl('head');
  const getDisplayMediaCalls = [];
  const doc = {
    readyState: 'complete',
    hidden: false,
    head,
    body,
    createElement: makeEl,
    getElementById: id => elementsById[id] || (selectorsPresent.has('#' + id) ? { id, hidden: false } : null),
    querySelector: sel => (selectorsPresent.has(sel) ? { sel } : null),
    addEventListener(ev, fn) { (docListeners[ev] = docListeners[ev] || []).push(fn); },
  };
  let nowTick = 100000;
  const FakeDate = class extends Date {
    constructor(...args) { super(...(args.length ? args : [nowTick])); }
    static now() { return nowTick; }
  };
  const win = {
    location: { hostname: 'localhost', pathname, hash },
    addEventListener(ev, fn) { (winListeners[ev] = winListeners[ev] || []).push(fn); },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
  };
  const ctx = vm.createContext({
    window: win,
    document: doc,
    location: win.location,
    navigator: {
      userAgent: 'TestAgent',
      platform: 'Linux',
      clipboard: { writeText: () => Promise.resolve() },
      mediaDevices: { getDisplayMedia: () => { getDisplayMediaCalls.push(1); return Promise.resolve(); } },
    },
    screen: { width: 1440, height: 900 },
    Intl,
    Date: FakeDate,
    DOMException: class extends Error { constructor(m, n) { super(m); this.name = n; } },
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) },
    fetch: () => Promise.resolve({ ok: false, status: 401 }),
    setTimeout,
    clearTimeout,
    setInterval: () => 1,
    clearInterval() {},
  });
  Object.assign(win, { localStorage: ctx.localStorage, navigator: ctx.navigator });
  vm.runInContext(fs.readFileSync(path.join(root, 'assets/anti-theft-guard.js'), 'utf8'), ctx, { filename: 'anti-theft-guard.js' });

  return {
    ctx,
    body,
    elementsById,
    winListeners,
    docListeners,
    getDisplayMediaCalls,
    advance(ms) { nowTick += ms; },
    state: () => JSON.parse(storage.get('ma-drm-security-state-v4') || '{"strikes":[]}'),
    fireWin(ev, payload = {}) {
      const e = Object.assign({ key: '', code: '', keyCode: 0, preventDefault() {} }, payload);
      (winListeners[ev] || []).forEach(fn => fn(e));
    },
    fireDoc(ev, payload = {}) {
      (docListeners[ev] || []).forEach(fn => fn(payload));
    },
  };
}

test('anti-theft-guard: водяной знак "Медицинский атлас 2026", переход в другое окно размывает конспект БЕЗ страйка, а PrintScreen и beforeprint начисляют страйки', () => {
  // 1. Open chemistry conspect (#lesson-1) -> active, watermark is "Медицинский атлас 2026", blur/visibilitychange => blurs screen with 0 strikes, PrintScreen => blur shield + strike
  const chemOpen = guardHarness('/chemistry-atlas/', '#lesson-1');
  assert.equal(chemOpen.body.classList.contains('ma-drm-active'), true);
  assert.equal(chemOpen.elementsById['ma-drm-watermark'].innerHTML.includes('Медицинский атлас 2026'), true);
  assert.equal(chemOpen.elementsById['ma-drm-watermark'].innerHTML.includes('ascorbinca234@gmail.com'), false);

  chemOpen.fireWin('blur');
  assert.equal(chemOpen.body.classList.contains('ma-drm-shielded'), true);
  assert.equal(chemOpen.body.classList.contains('ma-drm-window-blur'), true);
  assert.equal(chemOpen.elementsById['ma-drm-blur-shield'].classList.contains('is-open'), true);
  assert.equal(chemOpen.elementsById['ma-drm-blur-shield'].classList.contains('is-passive'), true);
  assert.equal(chemOpen.state().strikes.length, 0, 'Переход в другое окно не должен начислять страйк');

  // Unblur via button click, then test visibilitychange (document.hidden = true)
  chemOpen.elementsById['ma-drm-blur-shield'].querySelector('[data-drm-unblur]').click();
  assert.equal(chemOpen.body.classList.contains('ma-drm-shielded'), false);
  assert.equal(chemOpen.body.classList.contains('ma-drm-window-blur'), false);
  assert.equal(chemOpen.elementsById['ma-drm-blur-shield'].classList.contains('is-open'), false);

  chemOpen.ctx.document.hidden = true;
  chemOpen.fireDoc('visibilitychange');
  assert.equal(chemOpen.body.classList.contains('ma-drm-shielded'), true);
  assert.equal(chemOpen.body.classList.contains('ma-drm-window-blur'), true);
  assert.equal(chemOpen.elementsById['ma-drm-blur-shield'].classList.contains('is-open'), true);
  assert.equal(chemOpen.elementsById['ma-drm-blur-shield'].classList.contains('is-passive'), true);
  assert.equal(chemOpen.state().strikes.length, 0, 'Сворачивание вкладки не должно начислять страйк');

  chemOpen.ctx.document.hidden = false;
  chemOpen.elementsById['ma-drm-blur-shield'].querySelector('[data-drm-unblur]').click();
  assert.equal(chemOpen.body.classList.contains('ma-drm-shielded'), false);

  chemOpen.fireWin('keydown', { key: 'PrintScreen', code: 'PrintScreen', keyCode: 44 });
  assert.equal(chemOpen.body.classList.contains('ma-drm-shielded'), true);
  assert.equal(chemOpen.elementsById['ma-drm-blur-shield'].classList.contains('is-open'), true);
  assert.equal(chemOpen.elementsById['ma-drm-blur-shield'].classList.contains('is-passive'), false);
  assert.equal(chemOpen.state().strikes.length, 1);

  chemOpen.advance(2000);
  chemOpen.fireWin('beforeprint');
  assert.equal(chemOpen.state().strikes.length, 2);

  // 2. Open biochem note (#n-proteins) -> active, blurs on window blur with 0 strikes, & blocks screenshot with strike
  const bioOpen = guardHarness('/biochem-atlas/', '#n-proteins', new Set(['#v-notes']));
  assert.equal(bioOpen.body.classList.contains('ma-drm-active'), true);
  assert.equal(bioOpen.elementsById['ma-drm-watermark'].innerHTML.includes('Медицинский атлас 2026'), true);
  bioOpen.fireWin('blur');
  assert.equal(bioOpen.body.classList.contains('ma-drm-window-blur'), true);
  assert.equal(bioOpen.state().strikes.length, 0);
  bioOpen.fireWin('keydown', { key: 'PrintScreen', code: 'PrintScreen', keyCode: 44 });
  assert.equal(bioOpen.state().strikes.length, 1);

  // 3. Paywall or home or cabinet -> DRM inactive and triggers 0 strikes and no blur
  for (const [pathname, hash, sels] of [
    ['/', '', new Set()],
    ['/cabinet/', '', new Set()],
    ['/chemistry-atlas/', '#lesson-3', new Set(['[data-chem-locked="true"]'])],
    ['/biochem-atlas/', '#n-tca', new Set(['[data-biochem-locked="true"]'])],
  ]) {
    const h = guardHarness(pathname, hash, sels);
    assert.equal(h.body.classList.contains('ma-drm-active'), false, pathname + hash);
    h.fireWin('blur');
    assert.equal(h.body.classList.contains('ma-drm-shielded'), false, 'No blur outside open conspects: ' + pathname + hash);
    h.fireWin('keydown', { key: 'PrintScreen', code: 'PrintScreen', keyCode: 44 });
    h.fireWin('beforeprint');
    assert.equal(h.state().strikes.length, 0, 'No strikes outside open conspects: ' + pathname + hash);
  }
});

test('админ-панель: выдача отдельных занятий, предметов целиком, всех атласов сразу, а также бан, разбан, сброс страйков и устройств', async t => {
  const { call, sent, cfg } = makeServer(t);
  topicFixture(cfg.contentDir, 'chemistry', 'window.LESSON3=true;', 'lesson-3');
  topicFixture(cfg.contentDir, 'chemistry', 'window.LESSON4=true;', 'lesson-4');

  // Register and verify student
  await call('POST', '/auth/register', { email: 'student@example.com', password: 'secret-password-1', name: 'Алексей', consent: true });
  const m = /код подтверждения:\s*(\d{3})\s*(\d{3})/i.exec(sent[0].text);
  const d1 = { 'x-device-id': 'stud-dev-1', 'x-device-name': 'MacBook Safari' };
  const v = await call('POST', '/auth/verify-code', { email: 'student@example.com', code: m[1] + m[2] }, d1);
  assert.equal(v.status, 200);
  const tok = JSON.parse(v.body).accessToken;
  const authHdr = { authorization: 'Bearer ' + tok, ...d1 };

  // Initially lesson-3 and lesson-4 are locked (403)
  assert.equal((await call('GET', '/content-v3/chemistry/lesson-3', null, authHdr)).status, 403);
  assert.equal((await call('GET', '/content-v3/chemistry/lesson-4', null, authHdr)).status, 403);

  // Admin grants individual topic lesson-3 in chemistry for 30 days
  const grantTopic = await call('POST', '/admin/grant', {
    email: 'student@example.com',
    scope: 'topics',
    atlas: 'chemistry',
    topics: ['lesson-3'],
    days: 30,
  });
  assert.equal(grantTopic.status, 200);
  const grantTopicBody = JSON.parse(grantTopic.body);
  assert.deepEqual(Object.keys(grantTopicBody.user.topicGrants.chemistry), ['lesson-3']);

  // Now lesson-3 is unlocked (200), lesson-4 remains locked (403)
  const c3 = await call('GET', '/content-v3/chemistry/lesson-3', null, authHdr);
  assert.equal(c3.status, 200);
  assert.ok(c3.body.includes('window.LESSON3=true;'));
  const c4 = await call('GET', '/content-v3/chemistry/lesson-4', null, authHdr);
  assert.equal(c4.status, 403);

  // Check /access returns topicGrants
  const acc1 = JSON.parse((await call('GET', '/access', null, authHdr)).body);
  assert.deepEqual(Object.keys(acc1.topicGrants.chemistry), ['lesson-3']);
  assert.equal(acc1.grants.chemistry, undefined);

  // Admin grants all atlases at once
  const grantAll = await call('POST', '/admin/grant', {
    email: 'student@example.com',
    scope: 'all',
    days: 365,
  });
  assert.equal(grantAll.status, 200);
  const c4AfterAll = await call('GET', '/content-v3/chemistry/lesson-4', null, authHdr);
  assert.equal(c4AfterAll.status, 200);

  // Admin revokes chemistry subject grant (lesson-3 topic grant still works until revoked)
  await call('POST', '/admin/grant', { email: 'student@example.com', scope: 'atlas', atlas: 'chemistry', revoke: true });
  assert.equal((await call('GET', '/content-v3/chemistry/lesson-4', null, authHdr)).status, 403);
  assert.equal((await call('GET', '/content-v3/chemistry/lesson-3', null, authHdr)).status, 200);

  // Admin revokes lesson-3 topic grant
  await call('POST', '/admin/grant', { email: 'student@example.com', scope: 'topics', atlas: 'chemistry', topics: ['lesson-3'], revoke: true });
  assert.equal((await call('GET', '/content-v3/chemistry/lesson-3', null, authHdr)).status, 403);

  // Record 2 strikes on student account
  await call('POST', '/security/strike', { reason: 'PrintScreen' }, authHdr);
  await call('POST', '/security/strike', { reason: 'DevTools' }, authHdr);

  // Admin bans user with custom reason
  const banRes = await call('POST', '/admin/security', {
    email: 'student@example.com',
    action: 'ban',
    reason: 'Передача аккаунта третьим лицам',
  });
  assert.equal(banRes.status, 200);
  assert.equal(JSON.parse(banRes.body).user.banned, true);
  assert.equal((await call('GET', '/access', null, authHdr)).status, 403);

  // Admin unbans user in 1 click
  const unbanRes = await call('POST', '/admin/security', {
    email: 'student@example.com',
    action: 'unban',
  });
  assert.equal(unbanRes.status, 200);
  assert.equal(JSON.parse(unbanRes.body).user.banned, false);
  assert.equal((await call('GET', '/access', null, authHdr)).status, 200);

  // Admin resets strikes and clears devices
  const resetStrikes = await call('POST', '/admin/security', {
    email: 'student@example.com',
    action: 'reset_strikes',
  });
  assert.equal(JSON.parse(resetStrikes.body).user.strikesCount, 0);

  const clearDevs = await call('POST', '/admin/security', {
    email: 'student@example.com',
    action: 'clear_devices',
  });
  assert.equal(JSON.parse(clearDevs.body).user.devicesCount, 0);
});

