'use strict';
// Прогресс и ординаторская: журнал занятий со всех устройств, публичный ID, коллеги, дуэли, рукопожатия.
//
// Документы (store.getDoc / putDoc с версией, запись повторяется при одновременных изменениях):
//   p:<uid> — прогресс: журналы устройств, освоение разделов, последняя тема, достижения, профиль, ID;
//             пишет только сам пользователь.
//   s:<uid> — ординаторская: коллеги, дуэли, уведомления, бонусный опыт; пишут пользователь и его коллеги.
// Публичный ID «MA-123456» хранится в identities под ключом code:<ID>.
const crypto = require('crypto');
const P = require('./progress');

const MAX_FRIENDS = 100, MAX_DEVICES = 8, MAX_DUELS = 5, DUEL_DAYS = 3, DUEL_XP = 50, HAND_XP = 5, HANDS_PER_DAY = 30, INBOX = 30;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function createSocial({ store, cfg, HttpError, authUser, limit, json, body, randomId }) {
  const bad = (code, message) => new HttpError(400, code, message);
  const newProg = () => ({ dev: {}, sec: {}, last: null, ach: {}, profile: {}, tz: -180, code: null });
  const newSoc = () => ({ friends: [], duels: [], inbox: [], bonus: 0, hands: {}, handsDay: null });

  /** Читает документ, меняет его функцией fn и пишет, если версия не изменилась. fn → false: менять нечего. */
  async function mutate(key, init, fn) {
    for (let i = 0; i < 6; i++) {
      const cur = await store.getDoc(key);
      const d = cur ? cur.d : init();
      if ((await fn(d)) === false) return d;
      if (await store.putDoc(key, d, cur ? cur.v : 0)) return d;
      await new Promise(r => setTimeout(r, 20 + Math.random() * 100));
    }
    throw new HttpError(409, 'busy', 'Данные одновременно обновились с другого устройства. Повторите через секунду.');
  }
  const getProg = async uid => { const x = await store.getDoc('p:' + uid); return x ? x.d : newProg(); };
  const getSoc = async uid => { const x = await store.getDoc('s:' + uid); return x ? x.d : newSoc(); };
  const merged = p => P.mergeDays(Object.values(p.dev || {}).map(x => x.d));
  const todayOf = p => P.todayFor(p.tz);

  async function ensureCode(uid) {
    const cur = await getProg(uid);
    if (cur.code) return cur.code;
    for (let i = 0; i < 12; i++) {
      const code = 'MA-' + String(crypto.randomInt(0, 1000000)).padStart(6, '0');
      if (!(await store.createIdentity('code:' + code, uid))) continue;
      const d = await mutate('p:' + uid, newProg, x => { if (x.code) return false; x.code = code; });
      if (d.code !== code) await store.deleteIdentity('code:' + code);   // параллельный запрос успел выдать другой ID
      return d.code;
    }
    throw new HttpError(503, 'busy', 'Не получилось выдать ID. Повторите через минуту.');
  }

  // ---------- проверка входных данных ----------
  const int = (x, max) => { x = Math.floor(Number(x)); return Number.isFinite(x) && x > 0 ? Math.min(x, max) : 0; };
  const str = (x, max) => String(x == null ? '' : x).replace(/\s+/g, ' ').trim().slice(0, max);
  function cleanDays(raw, t) {
    const out = {}, from = P.isoAdd(t, -P.RULES.horizon), to = P.isoAdd(t, 1);
    if (!raw || typeof raw !== 'object') return out;
    let n = 0;
    for (const k of Object.keys(raw)) {
      const x = raw[k];
      if (!ISO_RE.test(k) || k < from || k > to || !Array.isArray(x)) continue;
      const c = int(x[0], 3000);
      if (!c) continue;
      out[k] = [c, Math.min(int(x[1], 3000), c), int(x[2], 3) & 3];
      if (++n >= 460) break;
    }
    return out;
  }
  function cleanSec(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const a of Object.keys(raw).slice(0, 6)) {
      const s = raw[a];
      if (!/^[a-z][a-z0-9-]{0,19}$/.test(a) || !s || !Array.isArray(s.list)) continue;
      out[a] = {
        t: int(s.t, 1e13),
        list: s.list.slice(0, 40).map(x => {
          x = x || {};
          const total = int(x.total, 5000);
          return { id: str(x.id, 40), n: str(x.n, 100), sub: str(x.sub, 40), total, learned: Math.min(int(x.learned, 5000), total), seen: Math.min(int(x.seen, 5000), total), locked: !!x.locked };
        }).filter(x => x.id && x.n),
      };
    }
    return out;
  }
  function cleanLast(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const url = str(raw.url, 400);
    if (url.indexOf(cfg.siteUrl + '/') !== 0) return null;   // только страницы своего сайта
    return { atlas: str(raw.atlas, 20), title: str(raw.title, 140), sub: str(raw.sub, 140), url, t: int(raw.t, 1e13) };
  }
  function cleanAch(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const k of Object.keys(raw).slice(0, 60)) if (/^[a-z0-9-]{1,30}$/.test(k) && ISO_RE.test(String(raw[k]))) out[k] = String(raw[k]);
    return out;
  }

  // ---------- представления ----------
  function myView(p, s) {
    const days = merged(p), t = todayOf(p), c = P.compute(days, t, s.bonus || 0);
    return {
      code: p.code, today: t, tz: p.tz, days, sec: p.sec || {}, last: p.last || null, ach: p.ach || {}, profile: p.profile || {},
      stats: { xp: c.xp, streak: c.streak, best: c.best, freezes: c.freezes, frozen: c.frozen, todayCards: c.todayCards, todayDone: c.todayDone,
        week: c.week, cards: c.cards, activeDays: c.activeDays, bonus: s.bonus || 0, dayXp: c.dayXp },
    };
  }
  async function card(uid) {
    const [u, p, s] = await Promise.all([store.getUser(uid), getProg(uid), getSoc(uid)]);
    if (!u) return null;
    const c = P.compute(merged(p), todayOf(p), s.bonus || 0);
    return { uid, code: p.code, name: u.name || 'Без имени', avatar: u.avatar || null, xp: c.xp, streak: c.streak, week: c.week, todayDone: c.todayDone, p, s };
  }
  const pub = x => ({ code: x.code, name: x.name, avatar: x.avatar, xp: x.xp, streak: x.streak, week: x.week, todayDone: x.todayDone });
  async function uidByCode(raw) {
    const m = /MA-?(\d{6})/.exec(String(raw || '').toUpperCase().replace(/\s+/g, ''));
    if (!m) throw bad('bad_code', 'ID — это MA и 6 цифр, например MA-123456.');
    const uid = await store.getIdentity('code:MA-' + m[1]);
    if (!uid) throw new HttpError(404, 'no_user', 'Коллега с ID MA-' + m[1] + ' не найден. Проверьте номер.');
    return uid;
  }
  const inboxPush = (s, item) => { s.inbox = [item].concat(s.inbox || []).slice(0, INBOX); };
  const prune = (s, t) => { s.duels = (s.duels || []).filter(x => !x.res || x.end >= P.isoAdd(t, -14)); };

  // ---------- прогресс ----------
  async function getProgress(req) {
    const u = await authUser(req);
    await ensureCode(u.id);
    const [p, s] = await Promise.all([getProg(u.id), getSoc(u.id)]);
    return json(200, myView(p, s));
  }

  async function postProgress(req) {
    const u = await authUser(req), b = body(req);
    await limit('prog:' + u.id, 400, 3600);
    const dev = String(b.device || '');
    if (!/^[A-Za-z0-9_-]{6,40}$/.test(dev)) throw bad('bad_device', 'Некорректный запрос.');
    await ensureCode(u.id);
    const tz = Number.isFinite(Number(b.tz)) && b.tz !== null && b.tz !== '' ? Math.max(-840, Math.min(720, Math.round(Number(b.tz)))) : null;
    const p = await mutate('p:' + u.id, newProg, d => {
      if (tz !== null) d.tz = tz;
      const t = P.todayFor(d.tz), from = P.isoAdd(t, -P.RULES.horizon);
      d.dev = d.dev || {};
      d.dev[dev] = { at: Date.now(), d: cleanDays(b.days, t) };
      Object.keys(d.dev).sort((x, y) => d.dev[y].at - d.dev[x].at).slice(MAX_DEVICES).forEach(k => { delete d.dev[k]; });
      for (const k of Object.keys(d.dev)) for (const day of Object.keys(d.dev[k].d)) if (day < from) delete d.dev[k].d[day];
      const sec = cleanSec(b.sec);
      d.sec = d.sec || {};
      for (const a of Object.keys(sec)) if (!d.sec[a] || sec[a].t >= (d.sec[a].t || 0)) d.sec[a] = sec[a];
      const last = cleanLast(b.last);
      if (last && (!d.last || last.t >= (d.last.t || 0))) d.last = last;
      const ach = cleanAch(b.ach);
      d.ach = d.ach || {};
      for (const k of Object.keys(ach)) if (!d.ach[k] || ach[k] < d.ach[k]) d.ach[k] = ach[k];
    });
    return json(200, myView(p, await getSoc(u.id)));
  }

  async function patchProfile(req) {
    const u = await authUser(req), b = body(req);
    const p = await mutate('p:' + u.id, newProg, d => { d.profile = { uni: str(b.uni, 80), course: str(b.course, 60), status: str(b.status, 80) }; });
    return json(200, { profile: p.profile });
  }

  // ---------- ординаторская ----------
  async function settle(uid, d) {
    const other = d.a === uid ? d.b : d.a;
    const [pa, pb] = await Promise.all([getProg(uid), getProg(other)]);
    const mine = P.xpBetween(merged(pa), d.start, d.end), theirs = P.xpBetween(merged(pb), d.start, d.end);
    const res = mine > theirs ? 'win' : mine < theirs ? 'loss' : 'draw';
    await mutate('s:' + uid, newSoc, s => {
      const x = (s.duels || []).find(z => z.id === d.id);
      if (!x || x.res) return false;
      Object.assign(x, { res, mine, theirs });
      if (res === 'win') s.bonus = (s.bonus || 0) + DUEL_XP;
    });
  }

  async function getSocial(req) {
    const u = await authUser(req);
    await ensureCode(u.id);
    let me = await card(u.id);
    const t = todayOf(me.p);
    // дуэль подводится на второй день после окончания: успеют дойти занятия со всех устройств
    const due = (me.s.duels || []).filter(d => !d.res && t > P.isoAdd(d.end, 1));
    for (const d of due) await settle(u.id, d);
    if (due.length) me = await card(u.id);
    const friends = (await Promise.all((me.s.friends || []).map(card))).filter(Boolean);
    const byUid = Object.fromEntries(friends.map(f => [f.uid, f]));
    const myDays = merged(me.p);
    const duels = (me.s.duels || []).map(d => {
      const f = byUid[d.a === u.id ? d.b : d.a];
      return {
        id: d.id, code: f ? f.code : d.code, name: f ? f.name : d.name, start: d.start, end: d.end, res: d.res || null, iStarted: d.a === u.id,
        mine: d.res ? d.mine : P.xpBetween(myDays, d.start, d.end),
        theirs: d.res ? d.theirs : (f ? P.xpBetween(merged(f.p), d.start, d.end) : 0),
      };
    });
    const activeWith = new Set(duels.filter(d => !d.res).map(d => d.code));
    const hands = me.s.hands || {};
    return json(200, {
      today: t, me: pub(me), duels, inbox: me.s.inbox || [],
      friends: friends.map(f => Object.assign(pub(f), { handToday: hands[f.uid] === t, duel: activeWith.has(f.code) })),
    });
  }

  async function find(req) {
    const u = await authUser(req);
    await limit('find:' + u.id, 120, 3600);
    const fid = await uidByCode(req.query && req.query.code);
    if (fid === u.id) throw bad('self', 'Это ваш ID. Отправьте его коллеге, чтобы он добавил вас.');
    const [f, s] = await Promise.all([card(fid), getSoc(u.id)]);
    if (!f) throw new HttpError(404, 'no_user', 'Коллега не найден.');
    return json(200, { user: Object.assign(pub(f), { friend: (s.friends || []).includes(fid) }) });
  }

  async function addFriend(req) {
    const u = await authUser(req), b = body(req);
    await limit('fadd:' + u.id, 60, 3600);
    const fid = await uidByCode(b.code);
    if (fid === u.id) throw bad('self', 'Это ваш ID. Отправьте его коллеге, чтобы он добавил вас.');
    const myCode = await ensureCode(u.id);
    const mine = await getSoc(u.id);
    if ((mine.friends || []).includes(fid)) throw new HttpError(409, 'already', 'Этот коллега уже в ординаторской.');
    if ((mine.friends || []).length >= MAX_FRIENDS) throw bad('too_many', 'В ординаторской уже ' + MAX_FRIENDS + ' коллег, это максимум.');
    await mutate('s:' + fid, newSoc, s => {
      s.friends = s.friends || [];
      if (s.friends.includes(u.id)) return false;
      if (s.friends.length >= MAX_FRIENDS) throw bad('their_full', 'У коллеги заполнена ординаторская.');
      s.friends.push(u.id);
      inboxPush(s, { t: 'friend', name: u.name || 'Коллега', code: myCode, at: Date.now() });
    });
    await mutate('s:' + u.id, newSoc, s => { s.friends = s.friends || []; if (s.friends.includes(fid)) return false; s.friends.push(fid); });
    return json(200, { friend: pub(await card(fid)) });
  }

  async function removeFriend(req, m) {
    const u = await authUser(req), fid = await uidByCode(decodeURIComponent(m[1]));
    const drop = who => s => {
      const i = (s.friends || []).indexOf(who);
      if (i < 0) return false;
      s.friends.splice(i, 1);
    };
    await mutate('s:' + u.id, newSoc, drop(fid));
    await mutate('s:' + fid, newSoc, drop(u.id));
    return json(200, { ok: true });
  }

  async function duel(req) {
    const u = await authUser(req), b = body(req);
    await limit('duel:' + u.id, 30, 3600);
    const fid = await uidByCode(b.code);
    const [me, f] = await Promise.all([card(u.id), card(fid)]);
    if (!f || !(me.s.friends || []).includes(fid)) throw bad('not_friend', 'Сначала добавьте коллегу в ординаторскую.');
    const t = todayOf(me.p), active = (me.s.duels || []).filter(d => !d.res);
    if (active.some(d => d.a === fid || d.b === fid)) throw new HttpError(409, 'already', 'С этим коллегой дуэль уже идёт.');
    if (active.length >= MAX_DUELS) throw bad('too_many', 'Одновременно можно вести не больше ' + MAX_DUELS + ' дуэлей.');
    const d = { id: randomId(8), a: u.id, b: fid, start: t, end: P.isoAdd(t, DUEL_DAYS - 1) };
    await mutate('s:' + u.id, newSoc, s => { prune(s, t); s.duels.unshift(Object.assign({ code: f.code, name: f.name }, d)); });
    await mutate('s:' + fid, newSoc, s => {
      prune(s, t);
      s.duels.unshift(Object.assign({ code: me.code, name: me.name }, d));
      inboxPush(s, { t: 'duel', name: me.name, code: me.code, at: Date.now(), end: d.end });
    });
    return json(200, { ok: true, end: d.end, days: DUEL_DAYS, prize: DUEL_XP });
  }

  async function hand(req) {
    const u = await authUser(req), b = body(req);
    const fid = await uidByCode(b.code);
    const myCode = await ensureCode(u.id);
    const t = todayOf(await getProg(u.id));
    await mutate('s:' + u.id, newSoc, s => {
      if (!(s.friends || []).includes(fid)) throw bad('not_friend', 'Сначала добавьте коллегу в ординаторскую.');
      s.hands = s.hands || {};
      if (s.hands[fid] === t) throw new HttpError(409, 'already', 'Сегодня вы уже пожали руку этому коллеге.');
      if (!s.handsDay || s.handsDay.d !== t) s.handsDay = { d: t, n: 0 };
      if (s.handsDay.n >= HANDS_PER_DAY) throw new HttpError(429, 'too_many', 'На сегодня рукопожатий достаточно.');
      for (const k of Object.keys(s.hands)) if (s.hands[k] !== t) delete s.hands[k];
      s.handsDay.n++; s.hands[fid] = t; s.bonus = (s.bonus || 0) + HAND_XP;
    });
    await mutate('s:' + fid, newSoc, s => {
      s.bonus = (s.bonus || 0) + HAND_XP;
      inboxPush(s, { t: 'hand', name: u.name || 'Коллега', code: myCode, at: Date.now() });
    });
    return json(200, { ok: true, xp: HAND_XP });
  }

  async function seen(req) {
    const u = await authUser(req);
    await mutate('s:' + u.id, newSoc, s => {
      if (!(s.inbox || []).some(x => !x.read)) return false;
      s.inbox.forEach(x => { x.read = true; });
    });
    return json(200, { ok: true });
  }

  /** При удалении аккаунта: убрать из ординаторских коллег, освободить ID, стереть документы. */
  async function onDelete(uid) {
    const [p, s] = await Promise.all([store.getDoc('p:' + uid), store.getDoc('s:' + uid)]);
    if (p && p.d.code) await store.deleteIdentity('code:' + p.d.code);
    for (const fid of (s && s.d.friends) || []) {
      await mutate('s:' + fid, newSoc, x => {
        const i = (x.friends || []).indexOf(uid);
        if (i < 0) return false;
        x.friends.splice(i, 1);
        x.duels = (x.duels || []).filter(d => d.a !== uid && d.b !== uid);
      }).catch(() => { /* коллегу удалим в следующий раз */ });
    }
    await store.deleteDoc('p:' + uid);
    await store.deleteDoc('s:' + uid);
  }

  const routes = [
    ['GET', /^\/progress$/, getProgress],
    ['POST', /^\/progress$/, postProgress],
    ['PATCH', /^\/progress\/profile$/, patchProfile],
    ['GET', /^\/social$/, getSocial],
    ['GET', /^\/social\/find$/, find],
    ['POST', /^\/social\/friends$/, addFriend],
    ['DELETE', /^\/social\/friends\/([^/]+)$/, removeFriend],
    ['POST', /^\/social\/duel$/, duel],
    ['POST', /^\/social\/hand$/, hand],
    ['POST', /^\/social\/seen$/, seen],
  ];
  return { routes, onDelete };
}

module.exports = { createSocial };
