'use strict';
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');
const { config } = require('../src/config');
const { createApp } = require('../src/app');
const { memoryStore } = require('../src/store/memory');
const { ydbStore } = require('../src/store/ydb');
const P = require('../src/progress');

const SITE = 'https://ma.example/medical_atlas', API = 'https://api.example';
function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-'));
  const cfg = config({ SITE_URL: SITE, API_URL: API, SECRET: 's'.repeat(40), STORE: 'memory', MAIL_TRANSPORT: 'log', CONTENT_DIR: dir });
  const sent = [], store = memoryStore();
  const app = createApp({ cfg, store, mail: { send: async m => { sent.push(m); } }, log: { error() {} } });
  let ip = 0;
  const call = (method, p, body, tok, query = {}) => app.handle({ method, path: p, query, headers: Object.assign({ origin: 'https://ma.example' }, tok ? { authorization: 'Bearer ' + tok } : {}), body: body ? JSON.stringify(body) : '', ip: '10.1.0.' + (++ip % 250) });
  const J = r => JSON.parse(r.body);
  async function user(name) {
    const email = name.toLowerCase().replace(/[^a-z]/g, '') + '@ex.ru';
    await call('POST', '/auth/register', { email, password: 'secret-123', name, consent: true });
    const m = sent[sent.length - 1];
    const tok = decodeURIComponent(/#verify\?token=([^\s<"&]+)/.exec(m.text)[1]);
    const r = J(await call('POST', '/auth/verify', { token: tok }));
    return { tok: r.accessToken, id: r.user.id };
  }
  return { app, call, J, store, user };
}
const today = P.todayFor(-180);
const day = n => P.isoAdd(today, n);

test('правила: дневная цель, стрик, дефибриллятор, опыт', () => {
  const t = '2026-10-17';
  const D = (n, c = 12, ok = 0, f = 0) => [P.isoAdd(t, n), [c, ok, f]];
  // 10 дней подряд до вчера, сегодня ещё не занимался
  let days = Object.fromEntries(Array.from({ length: 10 }, (_, i) => D(i - 10)));
  let c = P.compute(days, t, 0);
  assert.strictEqual(c.streak, 10); assert.strictEqual(c.best, 10); assert.strictEqual(c.freezes, 2); assert.strictEqual(c.todayDone, false);
  // опыт: 12 карточек × 5 + бонус цели 20 + 2 × день стрика
  assert.strictEqual(c.dayXp[P.isoAdd(t, -10)], 60 + 20 + 2);
  // два пропуска спасает дефибриллятор, третий обнуляет стрик
  days = Object.fromEntries([D(-6), D(-5)]);
  assert.deepStrictEqual(P.compute(days, t, 0).frozen, [P.isoAdd(t, -4), P.isoAdd(t, -3)]);
  assert.strictEqual(P.compute(days, t, 0).streak, 0);
  days = Object.fromEntries([D(-3), D(-2)]);
  c = P.compute(days, t, 0);
  assert.strictEqual(c.streak, 2); assert.strictEqual(c.freezes, 1, 'вчерашний пропуск съел заряд');
  // меньше цели — день не засчитан, но опыт за карточки идёт
  days = Object.fromEntries([D(0, 4, 4)]);
  c = P.compute(days, t, 0);
  assert.strictEqual(c.streak, 0); assert.strictEqual(c.xp, 4 * 8); assert.strictEqual(c.todayCards, 4);
  // ночные и утренние занятия
  c = P.compute(Object.fromEntries([D(-1, 3, 0, 1), D(0, 3, 0, 2)]), t, 7);
  assert.ok(c.night && c.morning); assert.strictEqual(c.xp, 30 + 7);
  // заряд восстанавливается за 7 дней стрика
  days = Object.fromEntries([D(-12), ...Array.from({ length: 10 }, (_, i) => D(i - 10))]);
  c = P.compute(days, t, 0);
  assert.strictEqual(c.frozen.length, 1); assert.strictEqual(c.freezes, 2);
});

test('журнал с двух устройств складывается, мусор отбрасывается', async () => {
  const { call, J, user } = setup();
  const a = await user('Anna');
  let r = await call('POST', '/progress', { device: 'dev-phone-1', tz: -180, days: { [day(-1)]: [12, 10, 0], [day(0)]: [3, 1, 1], '2001-01-01': [5, 0, 0], 'x': [1] } }, a.tok);
  assert.strictEqual(r.status, 200);
  r = await call('POST', '/progress', {
    device: 'dev-laptop', tz: -180, days: { [day(0)]: [8, 8, 2] },
    sec: { farma: { t: 5, list: [{ id: 'k1', n: 'Лекция I', total: 40, learned: 50, seen: 3 }] } },
    last: { atlas: 'farma', title: 'Холиномиметики', url: SITE + '/farma-atlas/#k3', t: 9 },
    ach: { first: day(-1), 'bad id!': day(0) },
  }, a.tok);
  const v = J(r);
  assert.deepStrictEqual(v.days[day(0)], [11, 9, 3]);
  assert.ok(!v.days['2001-01-01']);
  assert.strictEqual(v.stats.todayCards, 11); assert.strictEqual(v.stats.todayDone, true);
  assert.strictEqual(v.stats.streak, 2);
  assert.strictEqual(v.sec.farma.list[0].learned, 40, 'освоено не больше, чем всего');
  assert.strictEqual(v.last.title, 'Холиномиметики');
  assert.deepStrictEqual(v.ach, { first: day(-1) });
  assert.match(v.code, /^MA-\d{6}$/);
  // чужая ссылка в «последней теме» не принимается, старый снимок разделов не затирает новый
  r = J(await call('POST', '/progress', { device: 'dev-laptop', days: { [day(0)]: [8, 8, 2] }, last: { title: 'x', url: 'https://evil.example/', t: 99 }, sec: { farma: { t: 1, list: [{ id: 'k1', n: 'старое', total: 1 }] } } }, a.tok));
  assert.strictEqual(r.last.title, 'Холиномиметики'); assert.strictEqual(r.sec.farma.list[0].n, 'Лекция I');
  // профиль
  r = J(await call('PATCH', '/progress/profile', { uni: 'ПСПбГМУ', course: '3 курс', status: '  Готовлюсь   к зачёту ' }, a.tok));
  assert.strictEqual(r.profile.status, 'Готовлюсь к зачёту');
  assert.strictEqual(J(await call('GET', '/progress', null, a.tok)).profile.uni, 'ПСПбГМУ');
  assert.strictEqual((await call('GET', '/progress')).status, 401);
  assert.strictEqual(J(await call('POST', '/progress', { device: '1' }, a.tok)).error, 'bad_device');
});

test('ординаторская: ID, коллеги, рукопожатие, дуэль, уведомления', async () => {
  const { call, J, user, store } = setup();
  const a = await user('Anna'), b = await user('Boris');
  const codeA = J(await call('GET', '/progress', null, a.tok)).code;
  const codeB = J(await call('GET', '/social', null, b.tok)).me.code;
  assert.notStrictEqual(codeA, codeB);
  // поиск
  assert.strictEqual(J(await call('GET', '/social/find', null, a.tok, { code: codeA })).error, 'self');
  assert.strictEqual(J(await call('GET', '/social/find', null, a.tok, { code: 'MA-000000' === codeB ? 'MA-000001' : 'MA-000000' })).error, 'no_user');
  assert.strictEqual(J(await call('GET', '/social/find', null, a.tok, { code: 'abc' })).error, 'bad_code');
  let r = J(await call('GET', '/social/find', null, a.tok, { code: 'https://site/cabinet/#invite=' + codeB.toLowerCase() }));
  assert.strictEqual(r.user.name, 'Boris'); assert.strictEqual(r.user.friend, false);
  // добавить: взаимно, второй раз — 409
  assert.strictEqual((await call('POST', '/social/friends', { code: codeB }, a.tok)).status, 200);
  assert.strictEqual((await call('POST', '/social/friends', { code: codeB }, a.tok)).status, 409);
  let sb = J(await call('GET', '/social', null, b.tok));
  assert.deepStrictEqual(sb.friends.map(f => f.name), ['Anna']);
  assert.strictEqual(sb.inbox[0].t, 'friend'); assert.strictEqual(sb.inbox[0].code, codeA);
  // занятия Бориса видны Анне
  await call('POST', '/progress', { device: 'dev-b-1', tz: -180, days: { [day(0)]: [20, 20, 0] } }, b.tok);
  let sa = J(await call('GET', '/social', null, a.tok));
  assert.strictEqual(sa.friends[0].streak, 1); assert.ok(sa.friends[0].week > 0); assert.strictEqual(sa.friends[0].todayDone, true);
  // рукопожатие: +5 обоим, раз в день
  assert.strictEqual(J(await call('POST', '/social/hand', { code: codeB }, a.tok)).xp, 5);
  assert.strictEqual((await call('POST', '/social/hand', { code: codeB }, a.tok)).status, 409);
  assert.strictEqual(J(await call('GET', '/progress', null, a.tok)).stats.xp, 5);
  sa = J(await call('GET', '/social', null, a.tok));
  assert.strictEqual(sa.friends[0].handToday, true);
  sb = J(await call('GET', '/social', null, b.tok));
  assert.strictEqual(sb.inbox[0].t, 'hand');
  assert.strictEqual(sb.me.xp, 20 * 8 + 20 + 2 + 5);
  // уведомления прочитаны
  await call('POST', '/social/seen', {}, b.tok);
  assert.ok(J(await call('GET', '/social', null, b.tok)).inbox.every(x => x.read));
  // дуэль: одна на пару
  r = J(await call('POST', '/social/duel', { code: codeB }, a.tok));
  assert.strictEqual(r.days, 3);
  assert.strictEqual((await call('POST', '/social/duel', { code: codeA }, b.tok)).status, 409);
  sa = J(await call('GET', '/social', null, a.tok));
  assert.strictEqual(sa.duels.length, 1); assert.strictEqual(sa.duels[0].theirs, 20 * 8 + 22); assert.strictEqual(sa.duels[0].mine, 0);
  assert.strictEqual(sa.friends[0].duel, true);
  // дуэль закончилась: сдвигаем даты в прошлое и проверяем итог и приз
  for (const uid of [a.id, b.id]) {
    const doc = await store.getDoc('s:' + uid);
    Object.assign(doc.d.duels[0], { start: day(-5), end: day(-3) });
    await store.putDoc('s:' + uid, doc.d, doc.v);
  }
  const pb = await store.getDoc('p:' + b.id);
  pb.d.dev['dev-b-1'].d[day(-4)] = [30, 30, 0];
  await store.putDoc('p:' + b.id, pb.d, pb.v);
  sb = J(await call('GET', '/social', null, b.tok));
  assert.strictEqual(sb.duels[0].res, 'win'); assert.strictEqual(sb.duels[0].theirs, 0);
  sa = J(await call('GET', '/social', null, a.tok));
  assert.strictEqual(sa.duels[0].res, 'loss');
  assert.strictEqual(J(await call('GET', '/progress', null, b.tok)).stats.bonus, 5 + 50);
  // убрать коллегу: у обоих
  assert.strictEqual((await call('DELETE', '/social/friends/' + codeB, null, a.tok)).status, 200);
  assert.strictEqual(J(await call('GET', '/social', null, b.tok)).friends.length, 0);
  assert.strictEqual(J(await call('POST', '/social/hand', { code: codeB }, a.tok)).error, 'not_friend');
});

test('удаление аккаунта освобождает ID и убирает из ординаторских', async () => {
  const { call, J, user, store } = setup();
  const a = await user('Anna'), b = await user('Boris');
  const codeA = J(await call('GET', '/progress', null, a.tok)).code;
  const codeB = J(await call('GET', '/progress', null, b.tok)).code;
  await call('POST', '/social/friends', { code: codeA }, b.tok);
  await call('POST', '/social/duel', { code: codeA }, b.tok);
  assert.strictEqual((await call('DELETE', '/me', null, a.tok)).status, 200);
  assert.strictEqual(await store.getIdentity('code:' + codeA), null);
  assert.strictEqual(await store.getDoc('p:' + a.id), null);
  const sb = J(await call('GET', '/social', null, b.tok));
  assert.strictEqual(sb.friends.length, 0); assert.strictEqual(sb.duels.length, 0);
  assert.strictEqual(sb.me.code, codeB);
});

test('одновременная запись: конфликт версии повторяется, а не теряет данные', async () => {
  const { call, J, user, store } = setup();
  const a = await user('Anna');
  const put = store.putDoc;
  let conflicts = 2;
  store.putDoc = async (k, d, v) => {
    if (k.startsWith('p:') && conflicts > 0) {
      conflicts--;
      // параллельный запрос успел записать документ раньше нас
      const cur = await store.getDoc(k);
      const other = cur ? cur.d : { dev: {}, sec: {}, ach: {}, profile: {}, tz: -180 };
      other.profile = { status: 'с другого устройства' };
      await put(k, other, cur ? cur.v : 0);
    }
    return put(k, d, v);
  };
  const r = await call('POST', '/progress', { device: 'dev-phone-1', days: { [day(0)]: [5, 5, 0] } }, a.tok);
  assert.strictEqual(r.status, 200);
  const v = J(await call('GET', '/progress', null, a.tok));
  assert.deepStrictEqual(v.days[day(0)], [5, 5, 0]);
  assert.strictEqual(v.profile.status, 'с другого устройства');
});

test('YDB: документы пишутся с условием на версию', async () => {
  const reqs = [], items = {};
  const res = (status, j) => ({ ok: status < 300, status, text: async () => JSON.stringify(j) });
  const fake = async (url, o) => {
    const op = o.headers['X-Amz-Target'].split('.')[1], b = JSON.parse(o.body);
    reqs.push({ op, b });
    if (op === 'GetItem') return res(200, items[b.Key.id.S] ? { Item: items[b.Key.id.S] } : {});
    if (op === 'PutItem') {
      const cur = items[b.Item.id.S];
      const ok = b.ConditionExpression === 'attribute_not_exists(id)' ? !cur : cur && cur.v.N === b.ExpressionAttributeValues[':v'].N;
      if (!ok) return res(400, { __type: 'com.amazonaws.dynamodb.v20120810#ConditionalCheckFailedException', message: 'Condition not satisfied' });
      items[b.Item.id.S] = b.Item; return res(200, {});
    }
    if (op === 'DeleteItem') { delete items[b.Key.id.S]; return res(200, {}); }
    return res(200, {});
  };
  const s = ydbStore({ endpoint: 'https://docapi.example/ru-central1/b1g/etn', accessKeyId: 'AK', secretAccessKey: 'SK', prefix: 'ma_' }, fake);
  assert.strictEqual(await s.getDoc('p:u1'), null);
  assert.strictEqual(await s.putDoc('p:u1', { a: 1 }, 0), true);
  assert.strictEqual(await s.putDoc('p:u1', { a: 2 }, 0), false, 'документ уже есть');
  assert.deepStrictEqual(await s.getDoc('p:u1'), { d: { a: 1 }, v: 1 });
  assert.strictEqual(await s.putDoc('p:u1', { a: 3 }, 1), true);
  assert.strictEqual(await s.putDoc('p:u1', { a: 4 }, 1), false, 'версия устарела');
  assert.deepStrictEqual(await s.getDoc('p:u1'), { d: { a: 3 }, v: 2 });
  await s.deleteDoc('p:u1');
  assert.strictEqual(await s.getDoc('p:u1'), null);
  assert.strictEqual(reqs[1].b.TableName, 'ma_users'); assert.strictEqual(reqs[1].b.Item.id.S, 'doc:p:u1');
});
