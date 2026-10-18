'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib');
const { SUBJECTS, POLICY, grantFor } = require('./access');
const DELIVERY = 'topic-delivery-v1';
const idOK = s => /^[a-z0-9][a-z0-9-]{0,79}$/.test(s);

function createContent({ cfg, store, authUser, HttpError, json }) {
  const digest = s => crypto.createHmac('sha256', cfg.secret).update(s).digest('hex');
  // Only immutable source bytes are cached. Authorization, quotas and marks are per request.
  const cache = new Map();
  function manifest(atlas) {
    if (!SUBJECTS.some(s => s.id === atlas)) throw new HttpError(404, 'not_found', 'Нет такого предмета.');
    const m = JSON.parse(fs.readFileSync(path.join(cfg.contentDir, 'topics', atlas, 'manifest.json'), 'utf8'));
    if (m.policy !== DELIVERY || !m.topics || !Object.keys(m.topics).length) throw new Error('Invalid topic manifest');
    return m;
  }
  function source(atlas, topic, m) {
    if (!idOK(topic) || !Object.hasOwn(m.topics, topic)) throw new HttpError(404, 'not_found', 'Нет такой темы.');
    const expected = m.topics[topic].sha256, key = atlas + '/' + topic + '/' + expected;
    if (!cache.has(key)) {
      const raw = fs.readFileSync(path.join(cfg.contentDir, 'topics', atlas, topic + '.js'));
      if (crypto.createHash('sha256').update(raw).digest('hex') !== expected) throw new Error('Topic integrity check failed');
      cache.set(key, raw);
    }
    return cache.get(key);
  }
  function ready(atlas) {
    try { const m = manifest(atlas); for (const topic of Object.keys(m.topics)) source(atlas, topic, m); return true; }
    catch (_) { return false; }
  }
  async function allowed(req, atlas) {
    const user = await authUser(req);
    if (!SUBJECTS.some(s => s.id === atlas)) throw new HttpError(404, 'not_found', 'Нет такого предмета.');
    const record = await store.getDoc('access:' + user.id), grant = grantFor(record && record.d, atlas);
    if (!grant) throw new HttpError(403, 'subscription_required', 'Для этого предмета нужна действующая подписка.');
    return { user, grant };
  }
  // CAS in the shared database: all instances, tabs and parallel requests share limits.
  // Rolling counters live in one bounded document per account (no raw email/IP).
  async function reserve(user, atlas, topic, size) {
    const key = 'delivery:' + digest('mark|' + user.id).slice(0, 20);
    for (let attempt = 0; attempt < 12; attempt++) {
      const at = Date.now(), record = await store.getDoc(key), prev = record && record.d || {};
      const events = (prev.events || []).filter(e => e.t > at - 86400000);
      const minute = events.filter(e => e.t > at - 60000);
      const hour = events.filter(e => e.t > at - 3600000);
      const limits = cfg.contentLimits;
      let retryAt = 0;
      if (minute.length >= limits.minute) retryAt = Math.max(retryAt, minute[0].t + 60000);
      if (hour.length >= limits.hour) retryAt = Math.max(retryAt, hour[0].t + 3600000);
      if (events.length >= limits.day) retryAt = Math.max(retryAt, events[0].t + 86400000);
      let bytes = events.reduce((sum, e) => sum + e.b, 0);
      if (bytes + size > limits.bytesDay) {
        for (const e of events) { bytes -= e.b; retryAt = Math.max(retryAt, e.t + 86400000); if (bytes + size <= limits.bytesDay) break; }
        if (!retryAt) retryAt = at + 86400000;
      }
      if (retryAt) throw new HttpError(429, 'content_limit', 'Достигнут временный лимит загрузки материалов. Попробуйте позже.', { retryAfter: Math.max(1, Math.ceil((retryAt - at) / 1000)) });
      const stamp = { account: digest('mark|' + user.id).slice(0, 20), receipt: crypto.randomBytes(12).toString('hex'), issuedAt: new Date(at).toISOString(), atlas, topic };
      events.push({ t: at, b: size, a: atlas, p: topic, r: stamp.receipt });
      if (await store.putDoc(key, { userId: user.id, events }, record ? record.v : 0)) return stamp;
    }
    throw new HttpError(503, 'content_busy', 'Материалы сейчас загружаются в другой вкладке. Повторите запрос.', { retryAfter: 2 });
  }
  async function topic(req, atlas, topic) {
    const { user } = await allowed(req, atlas);
    let m;
    try { m = manifest(atlas); } catch (e) { if (e instanceof HttpError) throw e; throw new HttpError(503, 'content_unavailable', 'Материалы предмета временно недоступны.'); }
    const raw = source(atlas, topic, m);
    const stamp = await reserve(user, atlas, topic, raw.length);
    // Recheck after quota/database work: a revoked subscription cannot use a warm cache.
    const { grant } = await allowed(req, atlas);
    const mark = JSON.stringify(stamp);
    const code = '/* Medical Atlas personal copy: ' + mark + ' */\nwindow.MA_COPY=' + mark + ';\n' + raw.toString('utf8');
    const headers = { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'private, no-store, max-age=0',
      'Vary': 'Origin, Authorization, Accept-Encoding', 'X-Content-Type-Options': 'nosniff',
      'X-Access-Policy': POLICY, 'X-Content-Policy': DELIVERY, 'X-Access-Expires': String(grant.expiresAt),
      'X-Content-Hash': crypto.createHash('sha256').update(code).digest('hex'), 'X-Content-Receipt': stamp.receipt };
    if (cfg.gzip && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) return { status: 200, headers: { ...headers, 'Content-Encoding': 'gzip' }, body: zlib.gzipSync(code).toString('base64'), base64: true };
    return { status: 200, headers, body: code };
  }
  async function retired(req, atlas) {
    await allowed(req, atlas);
    throw new HttpError(410, 'content_retired', 'Этот способ загрузки закрыт. Обновите страницу и выберите тему.');
  }
  async function onDelete(uid) { await store.deleteDoc('delivery:' + digest('mark|' + uid).slice(0, 20)); }
  return { topic, retired, ready, onDelete };
}
module.exports = { createContent, DELIVERY };
