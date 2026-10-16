/* ===== Медицинский атлас: клиент входа =====
   Подключается на всех страницах: <script src="…/auth/config.js"></script><script src="…/auth/auth.js"></script>
   Хранит сессию в localStorage, обновляет токены, рисует кнопку «Войти» / меню аккаунта
   и загружает закрытые части атласов (с кэшем в IndexedDB). */
(function () {
  'use strict';
  var CFG = window.MA_CONFIG || {};
  var API = String(CFG.api || '').replace(/\/+$/, '');
  var me = document.currentScript;
  var AUTH_URL = new URL('./', me && me.src ? me.src : location.href).href;
  var SITE_URL = new URL('../', AUTH_URL).href;
  var KEY = 'ma-session';
  var listeners = [], widgets = [];

  function now() { return Math.floor(Date.now() / 1000); }
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function save(s) { try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch (e) { /* приватный режим */ } }
  function jwtExp(t) {
    try { return JSON.parse(atob(String(t).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp || 0; } catch (e) { return 0; }
  }
  function emit() { render(); listeners.forEach(function (f) { try { f(user()); } catch (e) { /* */ } }); }
  function fail(code, message, status) { var e = new Error(message || code); e.code = code; e.status = status || 0; return e; }

  function setSession(r) {
    var prev = load() || {};
    save({ access: r.accessToken, accessExp: jwtExp(r.accessToken), refresh: r.refreshToken, refreshExp: jwtExp(r.refreshToken), user: r.user || prev.user || null });
    emit();
  }
  function enabled() { return !!API; }
  function signedIn() { var s = load(); return !!(API && s && s.refresh && s.refreshExp > now() + 30); }
  function user() { var s = load(); return signedIn() && s.user ? s.user : null; }

  // ---------- запросы ----------
  function request(path, opts) {
    opts = opts || {};
    var headers = { 'Accept': 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.token) headers.Authorization = 'Bearer ' + opts.token;
    return fetch(API + path, { method: opts.method || (opts.body !== undefined ? 'POST' : 'GET'), headers: headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined })
      .catch(function () { throw fail('network', 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.'); })
      .then(function (res) {
        if (opts.raw && res.ok) return res;
        return res.text().then(function (t) {
          var j = {}; try { j = t ? JSON.parse(t) : {}; } catch (e) { j = {}; }
          if (!res.ok) {
            var err = fail(j.error || 'http_' + res.status, j.message || 'Ошибка сервера (' + res.status + '). Попробуйте ещё раз через минуту.', res.status);
            err.data = j;   // доп. поля ответа: wait, detail
            throw err;
          }
          return j;
        });
      });
  }
  /** Запрос без входа: регистрация, вход по паролю, подтверждение почты. */
  function call(path, body) { return request(path, { body: body }); }

  var refreshing = null;
  function refresh() {
    if (refreshing) return refreshing;
    var s = load();
    if (!s || !s.refresh) return Promise.reject(fail('signed-out', 'Нужно войти.'));
    refreshing = request('/auth/refresh', { body: { refreshToken: s.refresh } })
      .then(function (r) { setSession(r); return load(); }, function (e) {
        if (e.status === 401) { signOutLocal(); throw fail('signed-out', 'Нужно войти заново.'); }
        throw e;
      });
    var done = function () { refreshing = null; };
    refreshing.then(done, done);
    return refreshing;
  }
  function access() {
    var s = load();
    if (s && s.access && s.accessExp > now() + 20) return Promise.resolve(s.access);
    return refresh().then(function (x) { return x.access; });
  }
  /** Запрос от имени пользователя: при истёкшем токене обновляет его и повторяет. */
  function api(path, opts) {
    opts = opts || {};
    return access().then(function (tok) {
      return request(path, Object.assign({}, opts, { token: tok })).catch(function (e) {
        if (e.status !== 401) throw e;
        return refresh().then(function (x) { return request(path, Object.assign({}, opts, { token: x.access })); });
      });
    });
  }

  // ---------- кэш закрытых частей ----------
  function idb(fn) {
    return new Promise(function (ok) {
      try {
        var req = indexedDB.open('ma-content', 1);
        req.onupgradeneeded = function () { req.result.createObjectStore('b'); };
        req.onsuccess = function () { try { fn(req.result, ok); } catch (e) { ok(null); } };
        req.onerror = function () { ok(null); };
      } catch (e) { ok(null); }
    });
  }
  function cacheGet(k) { return idb(function (db, ok) { var r = db.transaction('b').objectStore('b').get(k); r.onsuccess = function () { ok(r.result || null); }; r.onerror = function () { ok(null); }; }); }
  function cachePut(atlas, k, v) {
    return idb(function (db, ok) {
      var tx = db.transaction('b', 'readwrite'), st = tx.objectStore('b');
      var cur = st.openCursor();
      cur.onsuccess = function () { var c = cur.result; if (c) { if (String(c.key).indexOf(atlas + ':') === 0) c.delete(); c.continue(); } else st.put(v, k); };
      tx.oncomplete = function () { ok(true); }; tx.onerror = function () { ok(false); };
    });
  }
  function cacheClear() { return idb(function (db, ok) { var tx = db.transaction('b', 'readwrite'); tx.objectStore('b').clear(); tx.oncomplete = function () { ok(true); }; tx.onerror = function () { ok(false); }; }); }

  /** Закрытая часть атласа: {status: 'ok'|'signed-out'|'error', code}. */
  function loadLocked(atlas, hash) {
    if (!signedIn()) return Promise.resolve({ status: 'signed-out', code: null });
    return cacheGet(atlas + ':' + hash).then(function (cached) {
      if (cached) {
        refresh().catch(function (e) { if (e.code === 'signed-out') cacheClear(); });   // проверим сессию в фоне
        return { status: 'ok', code: cached };
      }
      return access().then(function (tok) {
        return fetch(API + '/content/' + encodeURIComponent(atlas), { headers: { Authorization: 'Bearer ' + tok } }).then(function (res) {
          if (res.status === 401) return refresh().then(function (x) { return fetch(API + '/content/' + encodeURIComponent(atlas), { headers: { Authorization: 'Bearer ' + x.access } }); });
          return res;
        });
      }).then(function (res) {
        if (!res.ok) throw fail('http_' + res.status, 'Не удалось загрузить закрытую часть.', res.status);
        var h = res.headers.get('X-Content-Hash') || hash;
        return res.text().then(function (code) { cachePut(atlas, atlas + ':' + h, code); return { status: 'ok', code: code }; });
      });
    }).catch(function (e) { return { status: e.code === 'signed-out' ? 'signed-out' : 'error', code: null }; });
  }

  // ---------- вход и выход ----------
  function loginUrl(mode) {
    var u = new URL(AUTH_URL);
    if (location.href.indexOf(AUTH_URL) !== 0) u.searchParams.set('next', location.href);
    u.hash = mode || 'login';
    return u.href;
  }
  function signOutLocal() { save(null); cacheClear(); emit(); }
  function logout(everywhere) {
    var p = everywhere ? api('/auth/logout-all', { body: {} }).catch(function () { /* всё равно выходим */ }) : Promise.resolve();
    return p.then(function () { signOutLocal(); });
  }

  // ---------- кнопка «Войти» и меню аккаунта ----------
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function initials(u) { var n = (u.name || u.email || '?').trim(); return esc(n.charAt(0).toUpperCase()); }
  function render() {
    widgets.forEach(function (el) {
      if (!API) { el.innerHTML = ''; return; }
      var u = user();
      if (!u) { el.innerHTML = '<a class="ma-login" href="' + esc(loginUrl()) + '">Войти</a>'; return; }
      var ava = u.avatar ? '<img src="' + esc(u.avatar) + '" alt="" referrerpolicy="no-referrer">' : initials(u);
      el.innerHTML = '<div class="ma-user"><button type="button" class="ma-chip" aria-haspopup="menu" aria-expanded="false" title="' + esc(u.name || u.email || 'Аккаунт') + '">' +
        '<span class="ma-ava" aria-hidden="true">' + ava + '</span><span class="ma-name">' + esc(u.name || u.email || 'Аккаунт') + '</span></button>' +
        '<div class="ma-menu" role="menu" hidden><a role="menuitem" href="' + esc(AUTH_URL + '#account') + '">Аккаунт</a><button type="button" role="menuitem" data-ma-out>Выйти</button></div></div>';
      var btn = el.querySelector('.ma-chip'), menu = el.querySelector('.ma-menu');
      btn.addEventListener('click', function (ev) { ev.stopPropagation(); var open = menu.hidden; closeMenus(); menu.hidden = !open; btn.setAttribute('aria-expanded', String(open)); });
      el.querySelector('[data-ma-out]').addEventListener('click', function () { logout(false).then(function () { location.reload(); }); });
    });
  }
  function closeMenus() { widgets.forEach(function (el) { var m = el.querySelector('.ma-menu'), b = el.querySelector('.ma-chip'); if (m) m.hidden = true; if (b) b.setAttribute('aria-expanded', 'false'); }); }
  document.addEventListener('click', closeMenus);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenus(); });
  window.addEventListener('storage', function (e) { if (e.key === KEY) emit(); });
  function mount(list) { [].slice.call(list || []).forEach(function (el) { if (widgets.indexOf(el) < 0) widgets.push(el); }); render(); }

  window.MA = {
    enabled: enabled, signedIn: signedIn, user: user, loginUrl: loginUrl, AUTH_URL: AUTH_URL, SITE_URL: SITE_URL, API: API,
    mount: mount, onChange: function (f) { listeners.push(f); }, loadLocked: loadLocked,
    call: call, api: api, setSession: setSession, logout: logout, refresh: refresh,
  };
})();
