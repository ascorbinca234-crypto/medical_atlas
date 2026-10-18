'use strict';
// HTTP-обработчик API: регистрация и вход, OAuth, профиль, выдача закрытых частей атласов,
// прогресс и ординаторская (src/social.js).
const crypto = require('crypto');
const { createContent, DELIVERY } = require('./content');
const { keys, jwtSign, jwtVerify, seal, open, randomId, now } = require('./tokens');
const { hashPassword, verifyPassword } = require('./passwords');
const { providers, pkce } = require('./oauth');
const emails = require('./emails');
const { createSocial } = require('./social');
const { SUBJECTS, POLICY, grantFor } = require('./access');

class HttpError extends Error { constructor(status, code, message, extra) { super(message); this.status = status; this.code = code; this.extra = extra; } }
const bad = (code, message) => new HttpError(400, code, message);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_WIN = 3600, CODE_WINDOWS = 24;   // коды старого формата (до новых писем): действуют 24 часа
const CODE_TTL = 24 * 3600, CODE_KEEP = 3;  // каждый код живёт 24 часа, действуют три последних
const RESEND_GAP = 45;                        // не чаще одного письма с кодом в 45 секунд
const DUMMY_HASH = 's1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');

function createApp({ cfg, store, mail, fetchImpl = fetch, log = console }) {
  const K = keys(cfg.secret || 'x'.repeat(32));
  const prov = providers(cfg, fetchImpl);

  // ---------- helpers ----------
  const json = (status, obj, headers) => ({ status, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, headers), body: JSON.stringify(obj) });
  const redirect = (url, headers) => ({ status: 302, headers: Object.assign({ Location: url, 'Cache-Control': 'no-store' }, headers), body: '' });
  const toAuth = (hash, headers) => redirect(cfg.authPage + '#' + hash, headers);
  function cors(origin) {
    if (!origin || !cfg.origins.includes(origin)) return {};
    return { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Expose-Headers': 'X-Content-Hash, X-Access-Policy, X-Access-Expires, X-Content-Policy, X-Content-Receipt, Retry-After', 'Access-Control-Max-Age': '600' };
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
    if (!u || u.deleted || u.tv !== p.tv) throw new HttpError(401, 'unauthorized', 'Нужно войти заново.');
    return u;
  }
  async function changeUser(id, fn) {
    const u = await store.updateUser(id, fn);
    if (!u) throw new HttpError(401, 'unauthorized', 'Нужно войти заново.');
    return u;
  }
  async function changeAuthenticated(req, fn) {
    const snapshot = await authUser(req);
    return changeUser(snapshot.id, u => {
      if (u.tv !== snapshot.tv) throw new HttpError(401, 'unauthorized', 'Нужно войти заново.');
      fn(u);
    });
  }
  const newUser = o => Object.assign({ id: randomId(12), email: null, emailVerified: false, name: '', avatar: null, pw: null, tv: 0, ids: [], createdAt: new Date().toISOString() }, o);
  const link = (hash) => cfg.authPage + '#' + hash;
  // код старого формата: выводился из id, почты и часа отправки. Принимаем, чтобы уже отправленные письма работали
  const legacyCode = (u, w) => String(crypto.createHmac('sha256', K.jwt).update(`vcode|${u.id}|${u.email}|${w}`).digest().readUInt32BE(0) % 1000000).padStart(6, '0');
  // в базе лежит не сам код, а его HMAC
  const codeHash = (u, code) => crypto.createHmac('sha256', K.jwt).update(`vc2|${u.id}|${u.email}|${code}`).digest('hex').slice(0, 40);
  function codeOk(u, code) {
    const t = now(), h = Buffer.from(codeHash(u, code));
    let ok = false;
    for (const c of u.vcodes || []) if (c && c.exp > t && c.h && c.h.length === h.length && crypto.timingSafeEqual(Buffer.from(c.h), h)) ok = true;
    if (!u.vcodes) {                           // письма старого формата: пока не было ни одного нового кода
      const w = Math.floor(t / CODE_WIN);
      for (let i = 0; i <= CODE_WINDOWS; i++) if (crypto.timingSafeEqual(Buffer.from(legacyCode(u, w - i)), Buffer.from(code))) ok = true;
    }
    return ok;
  }
  /** Отправка письма. Сбой почты не прячем: клиент получает понятную ошибку, причина пишется в лог функции. */
  async function deliver(m) {
    try { await mail.send(m); }
    catch (e) {
      const detail = String((e && e.message) || e).slice(0, 300);
      log.error('mail failed:', detail);
      throw new HttpError(502, 'mail_failed', 'Не получилось отправить письмо. Попробуйте ещё раз через минуту.', { detail });
    }
  }
  // каждое письмо — новый код: у письма новая тема, и почтовик не склеивает его со старым
  async function sendVerify(u) {
    const t = now(), code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    u = await changeUser(u.id, current => {
      if (current.emailVerified) throw bad('already_verified', verifiedMsg(current));
      current.vcodes = [{ h: codeHash(current, code), exp: t + CODE_TTL }, ...(current.vcodes || []).filter(c => c && c.exp > t)].slice(0, CODE_KEEP);
      current.vsentAt = t;
    });
    const token = seal({ t: 'verify', u: u.id, e: u.email, j: randomId(), exp: t + CODE_TTL }, K.seal);
    const m = emails.verifyEmail(u.name, link('verify?token=' + token + '&email=' + encodeURIComponent(u.email)), code, new Date(t * 1000));
    await deliver(Object.assign({ to: u.email }, m));
  }
  async function sendReset(u) {
    const token = seal({ t: 'reset', u: u.id, f: fp(u.pw), exp: now() + 3600 }, K.seal);
    await deliver(Object.assign({ to: u.email }, emails.resetEmail(link('reset?token=' + token))));
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
      const hashed = await hashPassword(pw);
      u = await changeUser(u.id, current => {
        if (current.emailVerified || current.ids.some(k => !k.startsWith('email:'))) throw new HttpError(409, 'email_taken', 'Аккаунт уже подтверждён. Войдите или восстановите пароль.');
        Object.assign(current, { pw: hashed, name: name || current.name, tv: (current.tv || 0) + 1, consentAt: new Date().toISOString() });
      });
    } else {
      u = newUser({ email, name, pw: await hashPassword(pw), ids: ['email:' + email], consentAt: new Date().toISOString() });
      await store.putUser(u);
      if (!(await store.createIdentity('email:' + email, u.id))) { await store.deleteUser(u.id); throw new HttpError(409, 'email_taken', 'Аккаунт с этой почтой уже есть. Войдите или восстановите пароль.'); }
    }
    // аккаунт уже создан: если письмо не ушло, всё равно ведём на экран кода, там можно отправить его снова
    try { await sendVerify(u); }
    catch (e) { if (e.code !== 'mail_failed') throw e; return json(201, { ok: true, needVerify: true, email, mailError: e.message, detail: e.extra && e.extra.detail }); }
    return json(201, { ok: true, needVerify: true, email });
  }

  async function verify(req) {
    const t = open(body(req).token, K.seal);
    if (!t || t.t !== 'verify') throw bad('bad_token', 'Ссылка устарела или уже использована. Войдите, и мы пришлём новую.');
    const u = await store.getUser(t.u);
    if (!u || u.email !== t.e) throw bad('bad_token', 'Ссылка устарела или уже использована. Войдите, и мы пришлём новую.');
    if (!(await store.once('used:' + t.j, 2 * 24 * 3600))) throw bad('bad_token', 'Эта ссылка уже использована. Войдите с почтой и паролем.');
    const verified = await changeUser(u.id, current => {
      if (current.email !== t.e) throw bad('bad_token', 'Ссылка устарела.');
      current.emailVerified = true;
      delete current.vcodes; delete current.vsentAt;
    });
    return json(200, session(verified));
  }

  async function verifyCode(req) {
    const b = body(req);
    const email = checkEmail(normEmail(b.email)), code = String(b.code || '').replace(/\D/g, '');
    if (code.length !== 6) throw bad('bad_code', 'Код — это 6 цифр из письма.');
    await limit('vcode:' + email, 10, 900);
    const u = await userByEmail(email);
    if (u && u.emailVerified) throw bad('already_verified', verifiedMsg(u));
    if (!u || !codeOk(u, code)) throw bad('bad_code', 'Неверный или устаревший код. Проверьте последнее письмо или отправьте новое.');
    const verified = await changeUser(u.id, current => {
      if (current.emailVerified || !codeOk(current, code)) throw bad('bad_code', 'Код устарел или уже использован.');
      current.emailVerified = true;
      delete current.vcodes; delete current.vsentAt;
    });
    return json(200, session(verified));
  }
  const verifiedMsg = u => u.pw ? 'Почта уже подтверждена. Войдите с почтой и паролем.'
    : 'Почта уже подтверждена: вы входили через VK ID или Яндекс ID. Войдите тем же способом или задайте пароль через «Забыли пароль?».';

  async function resend(req) {
    const email = checkEmail(normEmail(body(req).email));
    await limit('resendip:' + req.ip, 30, 3600);
    const u = await userByEmail(email);
    if (!u) throw bad('no_account', 'Аккаунта с этой почтой нет. Проверьте адрес или зарегистрируйтесь.');
    if (u.emailVerified) throw bad('already_verified', verifiedMsg(u));
    const wait = (u.vsentAt || 0) + RESEND_GAP - now();
    if (wait > 0) throw new HttpError(429, 'resend_wait', `Письмо с кодом уже отправлено. Новое можно запросить через ${wait} с.`, { wait });
    await limit('resend:' + email, 6, 3600);
    await sendVerify(u);
    return json(200, { ok: true, email });
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
    const hashed = await hashPassword(pw);
    const updated = await changeUser(u.id, current => {
      if (fp(current.pw) !== t.f) throw bad('bad_token', 'Ссылка уже использована.');
      Object.assign(current, { pw: hashed, emailVerified: true, tv: (current.tv || 0) + 1 });
    });
    return json(200, session(updated));
  }

  // ---------- Яндекс ID и VK ID ----------
  async function oauthStart(req, p) {
    const P = prov[p];
    if (!P || !P.enabled) return toAuth('error?reason=provider_off');
    // state — короткая случайная строка (VK требует 32+ символа a-z, A-Z, 0-9, _ и -);
    // PKCE-verifier лежит в зашифрованной cookie, браузеру он не виден
    const n = randomId(24), { verifier, challenge } = pkce();
    const box = seal({ t: 'st', p, v: verifier, n, exp: now() + 600 }, K.seal);
    return redirect(P.authorizeUrl({ state: n, challenge }), { 'Set-Cookie': `ma_oauth=${box}; Path=/auth; Max-Age=600; HttpOnly; Secure; SameSite=Lax` });
  }

  async function loginWith(p, prof) {
    const ik = p + ':' + prof.id;
    let uid = await store.getIdentity(ik);
    let u = uid ? await store.getUser(uid) : null;
    if (!u) {
      if (prof.email) {
        u = await userByEmail(prof.email);
        // пароль, который никто не подтвердил, не должен открывать аккаунт владельца почты
        // Confirmation/password changes are applied atomically below.
      }
      if (!u) {
        u = newUser({ email: prof.email, emailVerified: !!prof.email });
        await store.putUser(u);
        if (prof.email) {
          if (await store.createIdentity('email:' + prof.email, u.id)) u.ids.push('email:' + prof.email);
          else {
            const other = await userByEmail(prof.email);
            await store.deleteUser(u.id);
            if (!other || other.deleted) throw bad('account_changed', 'Аккаунт изменился. Повторите вход.');
            u = other;
          }
        }
      }
      if (!(await store.createIdentity(ik, u.id))) {          // кто-то успел привязать этот аккаунт параллельно
        const other = await store.getUser(await store.getIdentity(ik));
        if (other && other.id !== u.id) { if (!u.ids.length) await store.deleteUser(u.id); u = other; }
      }
      if (!u.ids.includes(ik)) u.ids.push(ik);
    }
    const ids = u.ids || [];
    return changeUser(u.id, current => {
      if (prof.email && current.email === prof.email && !current.emailVerified) {
        Object.assign(current, { emailVerified: true, pw: null, tv: (current.tv || 0) + 1 });
      }
      current.ids = [...new Set([...(current.ids || []), ...ids, ik])];
      if (!current.name && prof.name) current.name = cleanName(prof.name);
      if (!current.avatar && prof.avatar) current.avatar = prof.avatar;
      current.lastLoginAt = new Date().toISOString();
    });
  }

  async function oauthCallback(req, p) {
    const P = prov[p];
    const clear = { 'Set-Cookie': 'ma_oauth=; Path=/auth; Max-Age=0; HttpOnly; Secure; SameSite=Lax' };
    if (!P || !P.enabled) return toAuth('error?reason=provider_off', clear);
    let q = Object.assign({}, req.query);
    if (q.payload) { try { q = Object.assign(q, JSON.parse(q.payload)); } catch (e) { /* без payload */ } }
    if (q.error && !q.state) return toAuth('error?reason=cancel', clear);
    const st = open(cookie(req, 'ma_oauth'), K.seal);
    if (!st || st.t !== 'st' || st.p !== p || !st.n || q.state !== st.n) return toAuth('error?reason=state', clear);
    let prof;
    try { prof = await P.profile(q, st); } catch (e) {
      if (e.userCancel) return toAuth('error?reason=cancel', clear);
      log.error('oauth', p, e.message);
      return toAuth('error?reason=provider&p=' + p + '&detail=' + encodeURIComponent(String(e.message).slice(0, 160)), clear);
    }
    if (!prof || !prof.id || prof.id === 'undefined') return toAuth('error?reason=provider&p=' + p + '&detail=' + encodeURIComponent('нет id пользователя в ответе'), clear);
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
    if (!u || u.deleted || u.tv !== p.tv) throw new HttpError(401, 'unauthorized', 'Нужно войти заново.');
    return json(200, session(u));
  }

  // ---------- заявки преподавателей ----------
  async function lead(req) {
    const b = body(req);
    if (b.website) return json(200, { ok: true });                 // поле-ловушка для ботов
    const name = cleanName(b.name), contact = String(b.contact || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    const role = String(b.role || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    const message = String(b.message || '').trim().slice(0, 1500);
    const page = String(b.page || '').slice(0, 200);
    if (!name) throw bad('no_name', 'Напишите, как к вам обращаться.');
    if (contact.length < 4) throw bad('no_contact', 'Оставьте почту или Telegram, чтобы мы могли ответить.');
    if (!cfg.mail.leadTo) throw new HttpError(503, 'no_inbox', 'Приём заявок пока не настроен.');
    await limit('lead:' + req.ip, 5, 3600);
    await limit('leadall', 60, 3600);
    const replyTo = EMAIL_RE.test(contact) ? contact : undefined;
    await deliver(Object.assign({ to: cfg.mail.leadTo, replyTo }, emails.leadEmail({ name, contact, role, message, page })));
    return json(200, { ok: true });
  }

  // ---------- профиль ----------
  async function me(req) { return json(200, { user: view(await authUser(req)) }); }
  async function updateMe(req) {
    const b = body(req);
    const u = await changeAuthenticated(req, current => { if (b.name !== undefined) current.name = cleanName(b.name); });
    return json(200, { user: view(u) });
  }
  async function logoutAll(req) {
    await changeAuthenticated(req, u => { u.tv = (u.tv || 0) + 1; });
    return json(200, { ok: true });
  }
  async function deleteMe(req) {
    const u = await changeAuthenticated(req, current => { current.deleted = true; current.tv = (current.tv || 0) + 1; });
    await social.onDelete(u.id);
    await store.deleteDoc('access:' + u.id);
    await content.onDelete(u.id);
    for (const k of u.ids || []) await store.deleteIdentity(k);
    await store.deleteUser(u.id);
    return json(200, { ok: true });
  }

  // ---------- прогресс и ординаторская ----------
  const social = createSocial({ store, cfg, HttpError, authUser, limit, json, body, randomId });

  // ---------- закрытые части атласов ----------
  const content = createContent({ cfg, store, authUser, HttpError, json });

  // ---------- маршруты ----------
  const routes = [
    ['GET', /^\/live$/, async () => json(200, { ok: true })],
    ['GET', /^\/health$/, async () => {
      let database = false;
      if (!cfg.missing.length) { try { await store.ready(); database = true; } catch (e) { log.error('readiness: database unavailable'); } }
      const contentStatus = {};
      for (const id of cfg.requiredContent || []) {
        contentStatus[id] = content.ready(id);
      }
      const ok = !cfg.missing.length && database && Object.values(contentStatus).every(Boolean);
      return json(ok ? 200 : 503, { ok, missing: cfg.missing, store: store.kind, database, content: contentStatus, policy: POLICY, delivery: DELIVERY,
        providers: { yandex: prov.yandex.enabled, vk: prov.vk.enabled } });
    }],
    ['GET', /^\/access$/, async req => {
      const u = await authUser(req), record = await store.getDoc('access:' + u.id), grants = {};
      for (const subject of SUBJECTS) { const g = grantFor(record && record.d, subject.id); if (g) grants[subject.id] = { expiresAt: g.expiresAt }; }
      return json(200, { policy: POLICY, subjects: SUBJECTS, grants });
    }],
    ['POST', /^\/auth\/register$/, register],
    ['POST', /^\/auth\/verify$/, verify],
    ['POST', /^\/auth\/verify-code$/, verifyCode],
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
    ['GET', /^\/content-v3\/([^/]+)\/([^/]+)$/, (req, m) => content.topic(req, m[1], m[2])],
    ['GET', /^\/content-v2\/([^/]+)$/, (req, m) => content.retired(req, m[1])],
    ['GET', /^\/content\/([^/]+)$/, (req, m) => content.retired(req, m[1])],
    ['POST', /^\/lead$/, lead],
    ...social.routes,
  ];

  async function handle(req) {
    const h = cors(req.headers.origin);
    if (req.method === 'OPTIONS') return { status: 204, headers: h, body: '' };
    try {
      const pathName = (req.path || '/').replace(/\/+$/, '') || '/';
      if (Buffer.byteLength(req.body || '', 'utf8') > 256 * 1024) throw new HttpError(413, 'body_too_large', 'Запрос слишком большой.');
      if (cfg.missing.length && !['/health', '/live'].includes(pathName)) throw new HttpError(503, 'misconfigured', 'Сервер не настроен: ' + cfg.missing.join(', '));
      for (const [method, re, fn] of routes) {
        const m = re.exec(pathName);
        if (m && method === req.method) { const res = await fn(req, m); res.headers = Object.assign({}, h, res.headers); return res; }
      }
      throw new HttpError(404, 'not_found', 'Нет такого адреса.');
    } catch (e) {
      if (e instanceof HttpError) return json(e.status, Object.assign({ error: e.code, message: e.message }, e.extra), e.extra && e.extra.retryAfter ? { ...h, 'Retry-After': String(e.extra.retryAfter) } : h);
      log.error('server error', e && e.stack || e);
      return json(500, { error: 'server', message: 'На сервере ошибка. Попробуйте ещё раз через минуту.' }, h);
    }
  }

  return { handle };
}

module.exports = { createApp, HttpError };
