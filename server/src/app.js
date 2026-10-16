'use strict';
// HTTP-обработчик API: регистрация и вход, OAuth, профиль, выдача закрытых частей атласов.
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');
const { keys, jwtSign, jwtVerify, seal, open, randomId, now } = require('./tokens');
const { hashPassword, verifyPassword } = require('./passwords');
const { providers, pkce } = require('./oauth');
const emails = require('./emails');

class HttpError extends Error { constructor(status, code, message, extra) { super(message); this.status = status; this.code = code; this.extra = extra; } }
const bad = (code, message) => new HttpError(400, code, message);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUMMY_HASH = 's1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');

function createApp({ cfg, store, mail, fetchImpl = fetch, log = console }) {
  const K = keys(cfg.secret || 'x'.repeat(32));
  const prov = providers(cfg, fetchImpl);
  const contentCache = new Map();

  // ---------- helpers ----------
  const json = (status, obj, headers) => ({ status, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, headers), body: JSON.stringify(obj) });
  const redirect = (url, headers) => ({ status: 302, headers: Object.assign({ Location: url, 'Cache-Control': 'no-store' }, headers), body: '' });
  const toAuth = (hash, headers) => redirect(cfg.authPage + '#' + hash, headers);
  function cors(origin) {
    if (!origin || !cfg.origins.includes(origin)) return {};
    return { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Expose-Headers': 'X-Content-Hash', 'Access-Control-Max-Age': '600' };
  }
  function body(req) {
    if (!req.body) return {};
    try { const b = JSON.parse(req.body); return b && typeof b === 'object' ? b : {}; } catch (e) { throw bad('bad_json', 'Некорректный запрос.'); }
  }
  const normEmail = e => String(e || '').trim().toLowerCase();
  function checkEmail(e) { if (!EMAIL_RE.test(e) || e.length > 254) throw bad('bad_email', 'Проверьте адрес почты.'); return e; }
  function checkPassword(p) {
    p = String(p || '');
    if (p.length < 8) throw bad('weak_password', 'Пароль должен быть не короче 8 символов.');
    if (p.length > 128) throw bad('long_password', 'Пароль должен быть не длиннее 128 символов.');
    return p;
  }
  const cleanName = n => String(n || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  async function limit(key, max, ttl) {
    const n = await store.incr('rl:' + crypto.createHash('sha256').update(key).digest('hex').slice(0, 32), ttl);   // почта и IP не хранятся в открытом виде
    if (n > max) throw new HttpError(429, 'too_many', 'Слишком много попыток. Подождите немного и попробуйте снова.');
  }
  const fp = pw => crypto.createHash('sha256').update('fp:' + (pw || '')).digest('hex').slice(0, 16);
  const view = u => ({ id: u.id, name: u.name || '', email: u.email || null, emailVerified: !!u.emailVerified, avatar: u.avatar || null,
    providers: [...new Set((u.ids || []).map(k => k.split(':')[0]))], hasPassword: !!u.pw, createdAt: u.createdAt });
  function session(u) {
    const t = now();
    return {
      accessToken: jwtSign({ sub: u.id, tv: u.tv, typ: 'a', iat: t, exp: t + cfg.accessTtl }, K.jwt),
      refreshToken: jwtSign({ sub: u.id, tv: u.tv, typ: 'r', iat: t, exp: t + cfg.refreshTtl }, K.jwt),
      user: view(u),
    };
  }
  async function authUser(req) {
    const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
    const p = m && jwtVerify(m[1], K.jwt);
    if (!p || p.typ !== 'a') throw new HttpError(401, 'unauthorized', 'Нужно войти заново.');
    const u = await store.getUser(p.sub);
    if (!u || u.tv !== p.tv) throw new HttpError(401, 'unauthorized', 'Нужно войти заново.');
    return u;
  }
  const newUser = o => Object.assign({ id: randomId(12), email: null, emailVerified: false, name: '', avatar: null, pw: null, tv: 0, ids: [], createdAt: new Date().toISOString() }, o);
  const link = (hash) => cfg.authPage + '#' + hash;
  async function sendVerify(u) {
    const token = seal({ t: 'verify', u: u.id, e: u.email, j: randomId(), exp: now() + 24 * 3600 }, K.seal);
    const m = emails.verifyEmail(u.name, link('verify?token=' + token));
    await mail.send(Object.assign({ to: u.email }, m));
  }
  async function sendReset(u) {
    const token = seal({ t: 'reset', u: u.id, f: fp(u.pw), exp: now() + 3600 }, K.seal);
    await mail.send(Object.assign({ to: u.email }, emails.resetEmail(link('reset?token=' + token))));
  }
  async function userByEmail(email) { const id = await store.getIdentity('email:' + email); return id ? store.getUser(id) : null; }
  function cookie(req, name) {
    const m = new RegExp('(?:^|;\\s*)' + name + '=([^;]*)').exec(req.headers.cookie || '');
    return m ? decodeURIComponent(m[1]) : '';
  }

  // ---------- email + пароль ----------
  async function register(req) {
    const b = body(req);
    const email = checkEmail(normEmail(b.email)), pw = checkPassword(b.password), name = cleanName(b.name);
    if (b.consent !== true) throw bad('consent_required', 'Нужно согласие на обработку персональных данных.');
    await limit('reg:' + req.ip, 20, 3600);
    await limit('regmail:' + email, 5, 3600);
    let u = await userByEmail(email);
    if (u && (u.emailVerified || (u.ids || []).some(k => !k.startsWith('email:')))) {
      throw new HttpError(409, 'email_taken', 'Аккаунт с этой почтой уже есть. Войдите или восстановите пароль.');
    }
    if (u) {                                    // регистрировался, но почту не подтвердил — обновляем данные и шлём письмо снова
      Object.assign(u, { pw: await hashPassword(pw), name: name || u.name, consentAt: new Date().toISOString() });
      await store.putUser(u);
    } else {
      u = newUser({ email, name, pw: await hashPassword(pw), ids: ['email:' + email], consentAt: new Date().toISOString() });
      await store.putUser(u);
      if (!(await store.createIdentity('email:' + email, u.id))) { await store.deleteUser(u.id); throw new HttpError(409, 'email_taken', 'Аккаунт с этой почтой уже есть. Войдите или восстановите пароль.'); }
    }
    await sendVerify(u);
    return json(201, { ok: true, needVerify: true, email });
  }

  async function verify(req) {
    const t = open(body(req).token, K.seal);
    if (!t || t.t !== 'verify') throw bad('bad_token', 'Ссылка устарела или уже использована. Войдите, и мы пришлём новую.');
    const u = await store.getUser(t.u);
    if (!u || u.email !== t.e) throw bad('bad_token', 'Ссылка устарела или уже использована. Войдите, и мы пришлём новую.');
    if (!(await store.once('used:' + t.j, 2 * 24 * 3600))) throw bad('bad_token', 'Эта ссылка уже использована. Войдите с почтой и паролем.');
    u.emailVerified = true;
    await store.putUser(u);
    return json(200, session(u));
  }

  async function resend(req) {
    const email = checkEmail(normEmail(body(req).email));
    await limit('resend:' + email, 3, 3600);
    const u = await userByEmail(email);
    if (u && !u.emailVerified) await sendVerify(u);
    return json(200, { ok: true });
  }

  async function login(req) {
    const b = body(req);
    const email = checkEmail(normEmail(b.email)), pw = String(b.password || '');
    await limit('login:' + email, 10, 900);
    await limit('loginip:' + req.ip, 100, 900);
    const u = await userByEmail(email);
    const ok = await verifyPassword(pw, (u && u.pw) || DUMMY_HASH);
    if (u && !u.pw) throw bad('no_password', 'У этой почты нет пароля: вы входили через Яндекс ID или VK ID. Войдите тем же способом или задайте пароль через «Забыли пароль?».');
    if (!u || !ok) throw new HttpError(401, 'bad_credentials', 'Неверная почта или пароль.');
    if (!u.emailVerified) throw new HttpError(403, 'unverified', 'Почта ещё не подтверждена. Откройте ссылку из письма или запросите новое.');
    return json(200, session(u));
  }

  async function forgot(req) {
    const email = checkEmail(normEmail(body(req).email));
    await limit('forgot:' + email, 3, 3600);
    await limit('forgotip:' + req.ip, 30, 3600);
    const u = await userByEmail(email);
    if (u) await sendReset(u);
    return json(200, { ok: true });
  }

  async function reset(req) {
    const b = body(req);
    const t = open(b.token, K.seal), pw = checkPassword(b.password);
    if (!t || t.t !== 'reset') throw bad('bad_token', 'Ссылка устарела. Запросите восстановление ещё раз.');
    const u = await store.getUser(t.u);
    if (!u || fp(u.pw) !== t.f) throw bad('bad_token', 'Ссылка устарела или уже использована. Запросите восстановление ещё раз.');
    Object.assign(u, { pw: await hashPassword(pw), emailVerified: true, tv: (u.tv || 0) + 1 });
    await store.putUser(u);
    return json(200, session(u));
  }

  // ---------- Яндекс ID и VK ID ----------
  async function oauthStart(req, p) {
    const P = prov[p];
    if (!P || !P.enabled) return toAuth('error?reason=provider_off');
    const n = randomId(), { verifier, challenge } = pkce();
    const state = seal({ t: 'st', p, v: verifier, n, exp: now() + 600 }, K.seal);
    return redirect(P.authorizeUrl({ state, challenge }), { 'Set-Cookie': `ma_oauth=${n}; Path=/auth; Max-Age=600; HttpOnly; Secure; SameSite=Lax` });
  }

  async function loginWith(p, prof) {
    const ik = p + ':' + prof.id;
    let uid = await store.getIdentity(ik);
    let u = uid ? await store.getUser(uid) : null;
    if (!u) {
      if (prof.email) {
        u = await userByEmail(prof.email);
        // пароль, который никто не подтвердил, не должен открывать аккаунт владельца почты
        if (u && !u.emailVerified) Object.assign(u, { emailVerified: true, pw: null, tv: (u.tv || 0) + 1 });
      }
      if (!u) {
        u = newUser({ email: prof.email, emailVerified: !!prof.email });
        await store.putUser(u);
        if (prof.email && (await store.createIdentity('email:' + prof.email, u.id))) u.ids.push('email:' + prof.email);
      }
      if (!(await store.createIdentity(ik, u.id))) {          // кто-то успел привязать этот аккаунт параллельно
        const other = await store.getUser(await store.getIdentity(ik));
        if (other && other.id !== u.id) { if (!u.ids.length) await store.deleteUser(u.id); u = other; }
      }
      if (!u.ids.includes(ik)) u.ids.push(ik);
    }
    if (!u.name && prof.name) u.name = cleanName(prof.name);
    if (!u.avatar && prof.avatar) u.avatar = prof.avatar;
    u.lastLoginAt = new Date().toISOString();
    await store.putUser(u);
    return u;
  }

  async function oauthCallback(req, p) {
    const P = prov[p];
    const clear = { 'Set-Cookie': 'ma_oauth=; Path=/auth; Max-Age=0; HttpOnly; Secure; SameSite=Lax' };
    if (!P || !P.enabled) return toAuth('error?reason=provider_off', clear);
    let q = Object.assign({}, req.query);
    if (q.payload) { try { q = Object.assign(q, JSON.parse(q.payload)); } catch (e) { /* без payload */ } }
    if (q.error && !q.state) return toAuth('error?reason=cancel', clear);
    const st = open(q.state, K.seal);
    if (!st || st.t !== 'st' || st.p !== p || !st.n || cookie(req, 'ma_oauth') !== st.n) return toAuth('error?reason=state', clear);
    let prof;
    try { prof = await P.profile(q, st); } catch (e) {
      if (e.userCancel) return toAuth('error?reason=cancel', clear);
      log.error('oauth', p, e.message);
      return toAuth('error?reason=provider', clear);
    }
    if (!prof || !prof.id || prof.id === 'undefined') return toAuth('error?reason=provider', clear);
    const u = await loginWith(p, prof);
    const code = seal({ t: 'login', u: u.id, j: randomId(), exp: now() + 120 }, K.seal);
    return toAuth('done?code=' + code, clear);
  }

  async function exchange(req) {
    const t = open(body(req).code, K.seal);
    if (!t || t.t !== 'login') throw bad('bad_code', 'Вход не завершён: ссылка устарела. Попробуйте ещё раз.');
    if (!(await store.once('used:' + t.j, 600))) throw bad('bad_code', 'Вход уже выполнен по этой ссылке. Попробуйте ещё раз.');
    const u = await store.getUser(t.u);
    if (!u) throw bad('bad_code', 'Аккаунт не найден.');
    return json(200, session(u));
  }

  async function refresh(req) {
    const p = jwtVerify(body(req).refreshToken, K.jwt);
    if (!p || p.typ !== 'r') throw new HttpError(401, 'unauthorized', 'Нужно войти заново.');
    const u = await store.getUser(p.sub);
    if (!u || u.tv !== p.tv) throw new HttpError(401, 'unauthorized', 'Нужно войти заново.');
    return json(200, session(u));
  }

  // ---------- профиль ----------
  async function me(req) { return json(200, { user: view(await authUser(req)) }); }
  async function updateMe(req) {
    const u = await authUser(req), b = body(req);
    if (b.name !== undefined) u.name = cleanName(b.name);
    await store.putUser(u);
    return json(200, { user: view(u) });
  }
  async function logoutAll(req) {
    const u = await authUser(req);
    u.tv = (u.tv || 0) + 1;
    await store.putUser(u);
    return json(200, { ok: true });
  }
  async function deleteMe(req) {
    const u = await authUser(req);
    for (const k of u.ids || []) await store.deleteIdentity(k);
    await store.deleteUser(u.id);
    return json(200, { ok: true });
  }

  // ---------- закрытые части атласов ----------
  function loadContent(atlas) {
    if (contentCache.has(atlas)) return contentCache.get(atlas);
    const file = path.join(cfg.contentDir, atlas + '.js');
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file);
    const c = { raw, gz: zlib.gzipSync(raw, { level: 9 }), hash: crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16) };
    contentCache.set(atlas, c);
    return c;
  }
  async function content(req, atlas) {
    await authUser(req);
    if (!/^[a-z0-9-]{1,40}$/.test(atlas)) throw new HttpError(404, 'not_found', 'Нет такого атласа.');
    const c = loadContent(atlas);
    if (!c) throw new HttpError(404, 'not_found', 'Нет такого атласа.');
    const headers = { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Hash': c.hash };
    if (cfg.gzip && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) return { status: 200, headers: Object.assign(headers, { 'Content-Encoding': 'gzip' }), body: c.gz.toString('base64'), base64: true };
    return { status: 200, headers, body: c.raw.toString('utf8') };
  }

  // ---------- маршруты ----------
  const routes = [
    ['GET', /^\/health$/, async () => {
      let tables = 'ok';
      if (store.ensure && cfg.missing.length === 0) { try { await store.ensure(); } catch (e) { tables = 'ошибка: ' + e.message; } }
      return json(200, { ok: cfg.missing.length === 0 && tables === 'ok', missing: cfg.missing, store: store.kind, tables, providers: { yandex: prov.yandex.enabled, vk: prov.vk.enabled } });
    }],
    ['POST', /^\/auth\/register$/, register],
    ['POST', /^\/auth\/verify$/, verify],
    ['POST', /^\/auth\/resend$/, resend],
    ['POST', /^\/auth\/login$/, login],
    ['POST', /^\/auth\/forgot$/, forgot],
    ['POST', /^\/auth\/reset$/, reset],
    ['POST', /^\/auth\/exchange$/, exchange],
    ['POST', /^\/auth\/refresh$/, refresh],
    ['POST', /^\/auth\/logout-all$/, logoutAll],
    ['GET', /^\/auth\/(yandex|vk)\/start$/, (req, m) => oauthStart(req, m[1])],
    ['GET', /^\/auth\/(yandex|vk)\/callback$/, (req, m) => oauthCallback(req, m[1])],
    ['GET', /^\/me$/, me],
    ['PATCH', /^\/me$/, updateMe],
    ['DELETE', /^\/me$/, deleteMe],
    ['GET', /^\/content\/([^/]+)$/, (req, m) => content(req, m[1])],
  ];

  async function handle(req) {
    const h = cors(req.headers.origin);
    if (req.method === 'OPTIONS') return { status: 204, headers: h, body: '' };
    try {
      const pathName = (req.path || '/').replace(/\/+$/, '') || '/';
      if (cfg.missing.length && pathName !== '/health') throw new HttpError(503, 'misconfigured', 'Сервер не настроен: ' + cfg.missing.join(', '));
      for (const [method, re, fn] of routes) {
        const m = re.exec(pathName);
        if (m && method === req.method) { const res = await fn(req, m); res.headers = Object.assign({}, h, res.headers); return res; }
      }
      throw new HttpError(404, 'not_found', 'Нет такого адреса.');
    } catch (e) {
      if (e instanceof HttpError) return json(e.status, Object.assign({ error: e.code, message: e.message }, e.extra), h);
      log.error('server error', e && e.stack || e);
      return json(500, { error: 'server', message: 'На сервере ошибка. Попробуйте ещё раз через минуту.' }, h);
    }
  }

  return { handle };
}

module.exports = { createApp, HttpError };
