/* ===== Медицинский атлас: журнал занятий =====
   Подключается после auth/auth.js на страницах атласов и в личном кабинете:
     <script src="../progress/progress.js"></script>
   Атласы сообщают, что ответили на карточку (MAP.card), сколько освоено по разделам (MAP.sections)
   и какую тему открыли (MAP.last). Журнал лежит в localStorage; после входа он отправляется на сервер
   и складывается с журналами других устройств.
   Расчёт опыта и стрика совпадает с server/src/progress.js — их сверяет тест server/test/progress.test.js. */
(function (root) {
  'use strict';

  // ---------- правила и расчёт (общие с сервером) ----------
  var RULES = { goal: 10, xpCard: 5, xpRight: 3, goalBase: 20, goalStep: 2, goalCap: 20, freezes: 2, rechargeEvery: 7, horizon: 400 };

  function isoAdd(iso, n) {
    var d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function weekday(iso) { return (new Date(iso + 'T00:00:00Z').getUTCDay() + 6) % 7; }
  function mondayOf(iso) { return isoAdd(iso, -weekday(iso)); }
  function todayFor(tz, nowMs) { return new Date((nowMs == null ? Date.now() : nowMs) - (Number(tz) || 0) * 60000).toISOString().slice(0, 10); }

  function mergeDays(list) {
    var out = {};
    list.forEach(function (days) {
      Object.keys(days || {}).forEach(function (k) {
        var x = days[k], o = out[k] || (out[k] = [0, 0, 0]);
        o[0] += x[0] || 0; o[1] += x[1] || 0; o[2] |= x[2] || 0;
      });
    });
    return out;
  }

  function compute(days, today, bonus) {
    var R = RULES;
    var out = { xp: bonus || 0, streak: 0, best: 0, freezes: R.freezes, frozen: [], todayCards: 0, todayDone: false,
      week: 0, cards: 0, activeDays: 0, dayXp: {}, night: false, morning: false };
    days = days || {};
    var keys = Object.keys(days).filter(function (k) { return k <= today && days[k] && days[k][0] > 0; }).sort();
    var mon = mondayOf(today), streak = 0;
    if (keys.length) {
      for (var d = keys[0]; d <= today; d = isoAdd(d, 1)) {
        var x = days[d], n = x ? x[0] : 0, ok = x ? Math.min(x[1], n) : 0;
        var xp = n * R.xpCard + ok * R.xpRight;
        if (n) {
          out.cards += n; out.activeDays++;
          if (x[2] & 1) out.night = true;
          if (x[2] & 2) out.morning = true;
        }
        if (n >= R.goal) {
          streak++;
          if (streak > out.best) out.best = streak;
          xp += R.goalBase + Math.min(streak, R.goalCap) * R.goalStep;
          if (streak % R.rechargeEvery === 0 && out.freezes < R.freezes) out.freezes++;
        } else if (d !== today && streak > 0) {
          if (out.freezes > 0) { out.freezes--; out.frozen.push(d); }
          else streak = 0;
        }
        if (xp) { out.dayXp[d] = xp; out.xp += xp; if (d >= mon) out.week += xp; }
      }
    }
    out.streak = streak;
    out.todayCards = days[today] ? days[today][0] : 0;
    out.todayDone = out.todayCards >= R.goal;
    return out;
  }

  function xpBetween(days, from, to) {
    var c = compute(days, to, 0), s = 0;
    Object.keys(c.dayXp).forEach(function (d) { if (d >= from && d <= to) s += c.dayXp[d]; });
    return s;
  }

  var core = { RULES: RULES, isoAdd: isoAdd, weekday: weekday, mondayOf: mondayOf, todayFor: todayFor, mergeDays: mergeDays, compute: compute, xpBetween: xpBetween };
  if (typeof module !== 'undefined' && module.exports) { module.exports = core; return; }

  // ---------- журнал в браузере ----------
  var KEY = 'ma-progress-v1';
  var listeners = [], syncT = 0, syncing = null, serverOff = false;

  function localIso(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function newDevice() {
    var a = new Uint8Array(12);
    try { crypto.getRandomValues(a); } catch (e) { for (var i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); }
    return 'd-' + Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function blank() { return { v: 1, device: newDevice(), days: {}, sec: {}, last: null, ach: {}, imported: {}, server: null }; }
  function load() {
    try {
      var x = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (x && x.v === 1 && x.device) { x.days = x.days || {}; x.sec = x.sec || {}; x.ach = x.ach || {}; x.imported = x.imported || {}; return x; }
    } catch (e) { /* повреждённые данные — начнём заново */ }
    return blank();
  }
  var L = load();
  function save() {
    // старше 400 дней не храним
    var from = isoAdd(localIso(), -RULES.horizon);
    Object.keys(L.days).forEach(function (k) { if (k < from) delete L.days[k]; });
    try { localStorage.setItem(KEY, JSON.stringify(L)); } catch (e) { /* приватный режим: журнал живёт до закрытия вкладки */ }
  }
  function emit() { listeners.forEach(function (f) { try { f(); } catch (e) { /* */ } }); }

  // История режима «Учить» фармакологии до появления журнала: переносим один раз
  function importFarma() {
    if (L.imported.farma) return;
    L.imported.farma = true;
    try {
      var f = JSON.parse(localStorage.getItem('atlas-learn-v1') || 'null');
      var days = (f && f.days) || {};
      Object.keys(days).forEach(function (n) {
        var cnt = Math.floor(Number(days[n]) || 0);
        if (cnt <= 0) return;
        var iso = new Date(Number(n) * 864e5).toISOString().slice(0, 10);
        var e = L.days[iso] || (L.days[iso] = [0, 0, 0]);
        e[0] += cnt;
      });
    } catch (e) { /* нет истории */ }
    save();
  }
  importFarma();

  function signedIn() { return !!(root.MA && root.MA.enabled() && root.MA.signedIn()); }

  function schedule(ms) {
    if (!signedIn() || serverOff) return;
    clearTimeout(syncT);
    syncT = setTimeout(function () { sync().catch(function () { /* повторим при следующем событии */ }); }, ms == null ? 6000 : ms);
  }

  /** Отправить журнал на сервер. Возвращает ответ сервера: журнал всех устройств и расчёт. */
  function sync() {
    if (!signedIn()) return Promise.resolve(null);
    if (syncing) return syncing;
    clearTimeout(syncT);
    var me = (root.MA.user() || {}).id || null;
    L = load();
    // в этом браузере вошёл другой человек: его журнал начинаем с нуля, чужая история к нему не уходит
    if (L.owner && me && L.owner !== me) { L = blank(); L.imported.farma = true; save(); }
    var payload = { device: L.device, tz: new Date().getTimezoneOffset(), days: L.days, sec: L.sec, last: L.last, ach: L.ach };
    syncing = root.MA.api('/progress', { body: payload }).then(function (view) {
      serverOff = false;
      L = load();   // журнал могли дописать в другой вкладке, пока шёл запрос
      L.owner = me;
      L.server = { at: Date.now(), user: me, view: view };
      Object.keys(view.ach || {}).forEach(function (k) { if (!L.ach[k] || view.ach[k] < L.ach[k]) L.ach[k] = view.ach[k]; });
      save(); emit();
      return view;
    }, function (e) {
      if (e && e.status === 404) serverOff = true;   // сервер ещё не обновлён: работаем с журналом браузера
      throw e;
    });
    var done = function () { syncing = null; };
    syncing.then(done, done);
    return syncing;
  }

  // ---------- события атласов ----------
  /** Ответ на карточку: {atlas, ok}. ok — вспомнил. */
  function card(o) {
    o = o || {};
    L = load();
    var now = new Date(), iso = localIso(now), h = now.getHours();
    var e = L.days[iso] || (L.days[iso] = [0, 0, 0]);
    e[0] += 1;
    if (o.ok) e[1] += 1;
    if (h < 5) e[2] |= 1; else if (h < 8) e[2] |= 2;
    save(); emit(); schedule();
  }
  /** Освоение разделов атласа: [{id, n, sub, total, learned, seen, locked}]. */
  function sections(atlas, list) {
    L = load();
    var prev = L.sec[atlas];
    // Topic packages publish only complete counts for their current section.
    // Never replace other sections with zeros from a deliberately partial dataset.
    if (window.MA_TOPICS && !(atlas === 'farma' && window.MA_FARMA_FULL)) {
      var topic = window.MA_TOPIC || '', id = atlas === 'biochem' ? (topic.indexOf('sec-') === 0 ? topic.slice(4) : '') : topic;
      if (atlas === 'farma' && topic === 'atlas') topic = '';
      list = list.filter(function (row) { return topic ? row.id === id : !row.locked; });
      if (!list.length) return;
      var incoming = list;
      list = (prev && prev.list || []).filter(function (row) { return !incoming.some(function (x) { return x.id === row.id; }); }).concat(incoming);
    }
    var next = { t: Date.now(), list: list };
    if (prev && JSON.stringify(prev.list) === JSON.stringify(list)) return;   // ничего не изменилось
    L.sec[atlas] = next;
    save(); emit(); schedule(15000);
  }
  /** Открытая тема: {atlas, title, sub, url}. */
  function last(o) {
    if (!o || !o.url || !o.title) return;
    L = load();
    L.last = { atlas: o.atlas, title: String(o.title).slice(0, 140), sub: String(o.sub || '').slice(0, 140), url: String(o.url).slice(0, 400), t: Date.now() };
    save(); schedule(20000);
  }
  /** Полученное достижение. */
  function achieve(id, iso) {
    L = load();
    if (L.ach[id]) return false;
    L.ach[id] = iso || localIso();
    save(); schedule(3000);
    return true;
  }

  /** Текущее состояние: сервер (если вошли и журнал синхронизирован) или журнал этого браузера. */
  function view() {
    L = load();
    var me = signedIn() && root.MA.user() ? root.MA.user().id : null;
    var s = L.server && L.server.view && me && L.server.user === me ? L.server.view : null;
    if (s) {
      return { source: 'server', today: s.today, code: s.code, days: s.days, sec: pickSec(s.sec, L.sec), last: pickLast(s.last, L.last), ach: L.ach, profile: s.profile || {}, stats: s.stats, at: L.server.at };
    }
    var t = localIso(), c = compute(L.days, t, 0);
    return { source: 'local', today: t, code: null, days: L.days, sec: L.sec, last: L.last, ach: L.ach, profile: {}, stats: c, at: null };
  }
  function pickSec(a, b) {
    var out = {};
    [a || {}, b || {}].forEach(function (x) { Object.keys(x).forEach(function (k) { if (!out[k] || (x[k].t || 0) >= (out[k].t || 0)) out[k] = x[k]; }); });
    return out;
  }
  function pickLast(a, b) { if (!a) return b; if (!b) return a; return (b.t || 0) > (a.t || 0) ? b : a; }

  window.addEventListener('storage', function (e) { if (e.key === KEY) emit(); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && syncT) sync().catch(function () { /* */ }); });
  if (root.MA && root.MA.onChange) root.MA.onChange(function (u) { if (u) schedule(500); });

  root.MAP = {
    core: core, RULES: RULES, localIso: localIso,
    card: card, sections: sections, last: last, achieve: achieve,
    sync: sync, view: view, signedIn: signedIn, serverOff: function () { return serverOff; },
    onChange: function (f) { listeners.push(f); }, device: function () { return L.device; },
  };
  // на страницах атласов отправляем накопленное, если вошли
  if (signedIn()) schedule(4000);
})(typeof window !== 'undefined' ? window : this);
