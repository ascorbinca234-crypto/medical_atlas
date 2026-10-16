'use strict';
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path'), zlib = require('zlib');
const { config } = require('../src/config');
const { createApp } = require('../src/app');
const { memoryStore } = require('../src/store/memory');

const SITE = 'https://ma.example/medical_atlas', API = 'https://api.example';
function setup(extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-'));
  fs.writeFileSync(path.join(dir, 'farma.js'), 'window.LOCKED_OK = true;');
  const cfg = config(Object.assign({ SITE_URL: SITE, API_URL: API, SECRET: 's'.repeat(40), STORE: 'memory', MAIL_TRANSPORT: 'log', CONTENT_DIR: dir,
    YANDEX_CLIENT_ID: 'yid', YANDEX_CLIENT_SECRET: 'ysec', VK_CLIENT_ID: 'vkid' }, extra));
  const sent = [], store = memoryStore();
  const prof = { yandex: { id: 111, login: 'ivan', default_email: 'ivan@yandex.ru', display_name: 'Иван', default_avatar_id: 'abc', is_avatar_empty: false }, vk: { user: { user_id: 222, first_name: 'Пётр', last_name: 'П', email: 'petr@mail.ru', avatar: 'https://vk/a.jpg' } } };
  const calls = [];
  const fetchImpl = async (url, o) => {
    calls.push({ url, o });
    const r = j => ({ ok: true, status: 200, text: async () => JSON.stringify(j) });
    if (url.startsWith('https://oauth.yandex.ru/token')) return r({ access_token: 'yat' });
    if (url.startsWith('https://login.yandex.ru/info')) return r(prof.yandex);
    if (url.startsWith('https://id.vk.ru/oauth2/auth')) return r({ access_token: 'vat', user_id: 222 });
    if (url.startsWith('https://id.vk.ru/oauth2/user_info')) return r(prof.vk);
    throw new Error('unexpected fetch ' + url);
  };
  const app = createApp({ cfg, store, mail: { send: async m => { sent.push(m); } }, fetchImpl, log: { error() {} } });
  let ipN = 0;
  const call = (method, p, body, headers = {}, query = {}) => app.handle({ method, path: p, query, headers: Object.assign({ origin: 'https://ma.example' }, headers), body: body ? JSON.stringify(body) : '', ip: '10.0.0.' + (headers.ip || 1) });
  const J = r => JSON.parse(r.body);
  const tokenFrom = (m, kind) => decodeURIComponent(new RegExp('#' + kind + '\\?token=([^\\s<"&]+)').exec(m.text)[1]);
  return { app, call, J, sent, store, calls, prof, tokenFrom, cfg };
}

test('регистрация → письмо → подтверждение → вход', async () => {
  const { call, J, sent, tokenFrom } = setup();
  let r = await call('POST', '/auth/register', { email: 'Anna@Example.com ', password: 'secret-123', name: ' Анна ', consent: true });
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.headers['Access-Control-Allow-Origin'], 'https://ma.example');
  assert.strictEqual(sent.length, 1); assert.strictEqual(sent[0].to, 'anna@example.com');
  assert.match(sent[0].text, /ma\.example\/medical_atlas\/auth\/#verify\?token=/);
  r = await call('POST', '/auth/login', { email: 'anna@example.com', password: 'secret-123' });
  assert.strictEqual(r.status, 403); assert.strictEqual(J(r).error, 'unverified');
  const tok = tokenFrom(sent[0], 'verify');
  r = await call('POST', '/auth/verify', { token: tok });
  assert.strictEqual(r.status, 200); assert.strictEqual(J(r).user.name, 'Анна'); assert.ok(J(r).accessToken);
  r = await call('POST', '/auth/verify', { token: tok });
  assert.strictEqual(r.status, 400, 'ссылка подтверждения одноразовая');
  r = await call('POST', '/auth/login', { email: 'anna@example.com', password: 'wrong-pass' });
  assert.strictEqual(r.status, 401);
  r = await call('POST', '/auth/login', { email: 'anna@example.com', password: 'secret-123' });
  assert.strictEqual(r.status, 200);
  r = await call('POST', '/auth/register', { email: 'anna@example.com', password: 'another-1', consent: true });
  assert.strictEqual(r.status, 409);
});

test('валидация регистрации', async () => {
  const { call, J } = setup();
  assert.strictEqual(J(await call('POST', '/auth/register', { email: 'x', password: 'secret-123', consent: true })).error, 'bad_email');
  assert.strictEqual(J(await call('POST', '/auth/register', { email: 'a@b.ru', password: 'short', consent: true })).error, 'weak_password');
  assert.strictEqual(J(await call('POST', '/auth/register', { email: 'a@b.ru', password: 'secret-123' })).error, 'consent_required');
});

test('восстановление пароля: ссылка одноразовая, старые сессии закрываются', async () => {
  const { call, J, sent, tokenFrom } = setup();
  await call('POST', '/auth/register', { email: 'b@b.ru', password: 'secret-123', consent: true });
  const s1 = J(await call('POST', '/auth/verify', { token: tokenFrom(sent[0], 'verify') }));
  let r = await call('POST', '/auth/forgot', { email: 'b@b.ru' });
  assert.strictEqual(r.status, 200); assert.strictEqual(sent.length, 2);
  r = await call('POST', '/auth/forgot', { email: 'nobody@b.ru' });
  assert.strictEqual(r.status, 200, 'не раскрываем, есть ли аккаунт'); assert.strictEqual(sent.length, 2);
  const tok = tokenFrom(sent[1], 'reset');
  r = await call('POST', '/auth/reset', { token: tok, password: 'new-secret-1' });
  assert.strictEqual(r.status, 200);
  r = await call('POST', '/auth/reset', { token: tok, password: 'new-secret-2' });
  assert.strictEqual(r.status, 400, 'ссылка сброса одноразовая');
  r = await call('POST', '/auth/refresh', { refreshToken: s1.refreshToken });
  assert.strictEqual(r.status, 401, 'старая сессия закрыта');
  r = await call('POST', '/auth/login', { email: 'b@b.ru', password: 'new-secret-1' });
  assert.strictEqual(r.status, 200);
});

test('ограничение попыток входа', async () => {
  const { call } = setup();
  let last;
  for (let i = 0; i < 12; i++) last = await call('POST', '/auth/login', { email: 'c@b.ru', password: 'whatever-1' });
  assert.strictEqual(last.status, 429);
});

async function oauthLogin(ctx, p, cbQuery) {
  const { call, J } = ctx;
  const s = await call('GET', '/auth/' + p + '/start');
  assert.strictEqual(s.status, 302);
  const loc = new URL(s.headers.Location);
  const state = loc.searchParams.get('state');
  assert.ok(loc.searchParams.get('code_challenge')); assert.strictEqual(loc.searchParams.get('code_challenge_method'), 'S256');
  assert.strictEqual(loc.searchParams.get('redirect_uri'), API + '/auth/' + p + '/callback');
  const nonce = /ma_oauth=([^;]+)/.exec(s.headers['Set-Cookie'])[1];
  const cb = await call('GET', '/auth/' + p + '/callback', null, { cookie: 'ma_oauth=' + nonce }, cbQuery(state));
  assert.strictEqual(cb.status, 302);
  const m = /#done\?code=(.+)$/.exec(cb.headers.Location);
  assert.ok(m, 'редирект на страницу входа с кодом: ' + cb.headers.Location);
  const r = await call('POST', '/auth/exchange', { code: decodeURIComponent(m[1]) });
  assert.strictEqual(r.status, 200);
  const again = await call('POST', '/auth/exchange', { code: decodeURIComponent(m[1]) });
  assert.strictEqual(again.status, 400, 'код обмена одноразовый');
  return J(r);
}

test('Яндекс ID: новый пользователь, PKCE, повторный вход тем же аккаунтом', async () => {
  const ctx = setup();
  const a = await oauthLogin(ctx, 'yandex', st => ({ code: 'c1', state: st }));
  assert.strictEqual(a.user.name, 'Иван'); assert.strictEqual(a.user.email, 'ivan@yandex.ru'); assert.deepStrictEqual(a.user.providers.sort(), ['email', 'yandex']);
  const tokenCall = ctx.calls.find(c => c.url.startsWith('https://oauth.yandex.ru/token'));
  const body = new URLSearchParams(tokenCall.o.body);
  assert.ok(body.get('code_verifier') && body.get('client_secret') === 'ysec');
  const b = await oauthLogin(ctx, 'yandex', st => ({ code: 'c2', state: st }));
  assert.strictEqual(b.user.id, a.user.id);
});

test('VK ID с payload и привязка к аккаунту с той же почтой; неподтверждённый пароль сбрасывается', async () => {
  const ctx = setup();
  await ctx.call('POST', '/auth/register', { email: 'petr@mail.ru', password: 'attacker-1', consent: true });   // почта не подтверждена
  const a = await oauthLogin(ctx, 'vk', st => ({ payload: JSON.stringify({ code: 'v1', state: st, device_id: 'dev1', type: 'code_v2' }) }));
  assert.strictEqual(a.user.email, 'petr@mail.ru'); assert.strictEqual(a.user.hasPassword, false);
  assert.deepStrictEqual(a.user.providers.sort(), ['email', 'vk']);
  const tok = new URLSearchParams(ctx.calls.find(c => c.url.startsWith('https://id.vk.ru/oauth2/auth')).o.body);
  assert.strictEqual(tok.get('device_id'), 'dev1'); assert.ok(tok.get('code_verifier'));
  const r = await ctx.call('POST', '/auth/login', { email: 'petr@mail.ru', password: 'attacker-1' });
  assert.strictEqual(r.status, 400, 'пароль из неподтверждённой регистрации больше не работает');
});

test('OAuth без cookie или с чужим state отклоняется', async () => {
  const { call } = setup();
  const s = await call('GET', '/auth/yandex/start');
  const state = new URL(s.headers.Location).searchParams.get('state');
  let cb = await call('GET', '/auth/yandex/callback', null, {}, { code: 'x', state });
  assert.match(cb.headers.Location, /#error\?reason=state$/);
  cb = await call('GET', '/auth/yandex/callback', null, { cookie: 'ma_oauth=zzz' }, { code: 'x', state: 'garbage' });
  assert.match(cb.headers.Location, /#error\?reason=state$/);
  cb = await call('GET', '/auth/yandex/callback', null, {}, { error: 'access_denied' });
  assert.match(cb.headers.Location, /#error\?reason=cancel$/);
});

test('закрытая часть: только с токеном, gzip, хэш', async () => {
  const ctx = setup();
  let r = await ctx.call('GET', '/content/farma');
  assert.strictEqual(r.status, 401);
  const a = await oauthLogin(ctx, 'yandex', st => ({ code: 'c', state: st }));
  r = await ctx.call('GET', '/content/farma', null, { authorization: 'Bearer ' + a.accessToken });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body, 'window.LOCKED_OK = true;'); assert.match(r.headers['X-Content-Hash'], /^[0-9a-f]{16}$/);
  r = await ctx.call('GET', '/content/farma', null, { authorization: 'Bearer ' + a.accessToken, 'accept-encoding': 'gzip, br' });
  assert.strictEqual(r.headers['Content-Encoding'], 'gzip'); assert.strictEqual(zlib.gunzipSync(Buffer.from(r.body, 'base64')).toString(), 'window.LOCKED_OK = true;');
  r = await ctx.call('GET', '/content/..%2Fx', null, { authorization: 'Bearer ' + a.accessToken });
  assert.strictEqual(r.status, 404);
  r = await ctx.call('GET', '/content/nope', null, { authorization: 'Bearer ' + a.accessToken });
  assert.strictEqual(r.status, 404);
});

test('профиль, выход везде, удаление аккаунта, CORS', async () => {
  const ctx = setup();
  const a = await oauthLogin(ctx, 'yandex', st => ({ code: 'c', state: st }));
  const auth = { authorization: 'Bearer ' + a.accessToken };
  let r = await ctx.call('PATCH', '/me', { name: 'Иван Петров' }, auth);
  assert.strictEqual(ctx.J(r).user.name, 'Иван Петров');
  r = await ctx.call('POST', '/auth/refresh', { refreshToken: a.refreshToken });
  assert.strictEqual(r.status, 200);
  r = await ctx.call('POST', '/auth/logout-all', null, auth);
  assert.strictEqual(r.status, 200);
  r = await ctx.call('GET', '/me', null, auth);
  assert.strictEqual(r.status, 401, 'токены после «выйти везде» не работают');
  const b = await oauthLogin(ctx, 'yandex', st => ({ code: 'c', state: st }));
  r = await ctx.call('DELETE', '/me', null, { authorization: 'Bearer ' + b.accessToken });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(await ctx.store.getIdentity('yandex:111'), null);
  assert.strictEqual(await ctx.store.getIdentity('email:ivan@yandex.ru'), null);
  r = await ctx.call('OPTIONS', '/auth/login', null, { origin: 'https://evil.example' });
  assert.strictEqual(r.headers['Access-Control-Allow-Origin'], undefined);
  r = await ctx.call('OPTIONS', '/auth/login');
  assert.strictEqual(r.status, 204); assert.strictEqual(r.headers['Access-Control-Allow-Origin'], 'https://ma.example');
});

test('без настроек сервер отвечает 503 и подсказывает, что задать', async () => {
  const cfg = config({ STORE: 'memory', MAIL_TRANSPORT: 'log' });
  const app = createApp({ cfg, store: memoryStore(), mail: { send: async () => {} }, log: { error() {} } });
  const r = await app.handle({ method: 'POST', path: '/auth/login', query: {}, headers: {}, body: '{}', ip: '1' });
  assert.strictEqual(r.status, 503); assert.match(JSON.parse(r.body).message, /SITE_URL/);
  const h = await app.handle({ method: 'GET', path: '/health', query: {}, headers: {}, body: '', ip: '1' });
  assert.strictEqual(h.status, 200); assert.strictEqual(JSON.parse(h.body).ok, false);
});

test('код из письма подтверждает почту и даёт вход', async () => {
  const { call, J, sent } = setup();
  await call('POST', '/auth/register', { email: 'code@b.ru', password: 'secret-123', name: 'Кодов', consent: true });
  const code = /код подтверждения: (\d{3}) (\d{3})/i.exec(sent[0].text);
  assert.ok(code, sent[0].text);
  assert.match(sent[0].subject, /^Код \d{3} \d{3}/);
  let r = await call('POST', '/auth/verify-code', { email: 'code@b.ru', code: '000000' === code[1] + code[2] ? '111111' : '000000' });
  assert.strictEqual(r.status, 400);
  r = await call('POST', '/auth/verify-code', { email: 'code@b.ru', code: code[1] + ' ' + code[2] });
  assert.strictEqual(r.status, 200); assert.ok(J(r).accessToken);
  r = await call('POST', '/auth/verify-code', { email: 'code@b.ru', code: code[1] + code[2] });
  assert.strictEqual(J(r).error, 'already_verified');
  r = await call('POST', '/auth/login', { email: 'code@b.ru', password: 'secret-123' });
  assert.strictEqual(r.status, 200);
});

test('OAuth: state короткий и подходит под требования VK', async () => {
  const { call } = setup();
  const s = await call('GET', '/auth/vk/start');
  const state = new URL(s.headers.Location).searchParams.get('state');
  assert.match(state, /^[A-Za-z0-9_-]{32,64}$/);
});
