/* ===== Медицинский атлас: клиент входа =====
   Подключается на всех страницах: <script src="…/auth/config.js"></script><script src="…/auth/auth.js"></script>
   Хранит сессию в localStorage, обновляет токены, рисует кнопку «Войти» / меню аккаунта
   и загружает закрытые части атласов (после серверной проверки подписки). */
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
    var controller = new AbortController(), timer;
    var operation = fetch(API + path, { method: opts.method || (opts.body !== undefined ? 'POST' : 'GET'), headers: headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined, signal: controller.signal, cache: 'no-store' })
      .then(function (res) {
        return res.text().then(function (t) {
          if (opts.raw && res.ok) return { ok: true, status: res.status, headers: res.headers, text: function () { return Promise.resolve(t); } };
          var j = {}; try { j = t ? JSON.parse(t) : {}; } catch (e) { j = {}; }
          if (!res.ok) {
            var err = fail(j.error || 'http_' + res.status, j.message || 'Ошибка сервера (' + res.status + ').', res.status);
            err.data = j; throw err;
          }
          return j;
        });
      });
    return Promise.race([operation, new Promise(function (_, reject) {
      timer = setTimeout(function () { controller.abort(); reject(fail('timeout', 'Сервер не ответил. Попробуйте ещё раз.')); }, 8000);
    })]).finally(function () { clearTimeout(timer); });
  }

  /** Запрос без входа: регистрация, вход по паролю, подтверждение почты. */
  function call(path, body) { return request(path, { body: body }); }

  var refreshing = null;
  function refresh() {
    if (refreshing) return refreshing;
    var s = load();
    if (!s || !s.refresh) return Promise.reject(fail('signed-out', 'Нужно войти.'));
    refreshing = request('/auth/refresh', { body: { refreshToken: s.refresh } })
      .then(function (r) {
        var current = load();
        if (!current || current.refresh !== s.refresh) throw fail('session-changed', 'Аккаунт изменился.');
        setSession(r); return load();
      }, function (e) {
        if (e.status === 401 && load() && load().refresh === s.refresh) { signOutLocal(); throw fail('signed-out', 'Нужно войти заново.'); }
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

  // Never read old persistent content, even offline. Remove the previous cache.
  function cacheClear() { try { indexedDB.deleteDatabase('ma-content'); } catch (e) {} }
  cacheClear();
  var POLICY = 'subject-subscription-v1';
  function loadLocked(atlas) {
    var owner = user(), timer;
    if (!owner) return Promise.resolve({ status: 'signed-out', code: null });
    var operation = api('/content-v2/' + encodeURIComponent(atlas), { raw: true }).then(function (res) {
      if (res.headers.get('X-Access-Policy') !== POLICY) throw fail('policy', 'Сервер ещё не обновлён.');
      var expiresAt = Number(res.headers.get('X-Access-Expires'));
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw fail('subscription_required', 'Подписка истекла.');
      return res.text().then(function (code) {
        if (!user() || user().id !== owner.id) throw fail('signed-out', 'Аккаунт изменился.');
        return { status: 'ok', code: code, expiresAt: expiresAt, owner: owner.id };
      });
    });
    return Promise.race([operation, new Promise(function (_, reject) {
      timer = setTimeout(function () { reject(fail('timeout')); }, 10000);
    })]).catch(function (e) {
      return { status: e.status === 403 || e.code === 'subscription_required' ? 'subscription-required' :
        e.code === 'signed-out' ? 'signed-out' : 'error', code: null };
    }).finally(function () { clearTimeout(timer); });
  }
  // One loader for every atlas. Public content still starts if the API is unavailable.
  function bootAtlas(atlas, appId) {
    var owner = user(), started = false, full = false, expiresAt = 0;
    window.MA_STATE = { auth: 'none' };
    function run(code) { var el = document.createElement('script'); el.textContent = code; document.body.appendChild(el); }
    function reload() { location.reload(); }
    function stillOwner() { var current = user(); return !!(current && owner && current.id === owner.id); }
    function check() {
      if (!full) return;
      if (!stillOwner() || Date.now() >= expiresAt) { reload(); return; }
      api('/access').then(function (r) {
        var grant = r.grants && r.grants[atlas];
        if (r.policy !== POLICY || !grant || grant.expiresAt <= Date.now() || !stillOwner()) reload();
      }).catch(reload);
    }
    function start(r) {
      if (started) return; started = true;
      var allowed = r.status === 'ok' && stillOwner() && r.expiresAt > Date.now();
      window.MA_STATE.auth = allowed ? 'ok' : r.status;
      if (atlas === 'micro' && r.status === 'error') window.MICRO_LOAD_ERROR = true;
      if (allowed) { full = true; expiresAt = r.expiresAt; run(r.code); }
      if (appId) run(document.getElementById(appId).textContent);
      mount(document.querySelectorAll('[data-ma-acct]'));
      var status = document.querySelector('[data-access-status]');
      if (status) status.textContent = allowed ? 'Подписка активна' : r.status === 'error' ?
        'Полная версия временно недоступна. Два пробных конспекта открыты.' : 'Пробная версия · два конспекта';
      if (full) {
        setTimeout(reload, Math.min(expiresAt - Date.now(), 2147483647));
        setInterval(check, 60000);
      }
    }
    listeners.push(function (current) {
      if ((current && current.id) !== (owner && owner.id)) reload();
    });
    window.addEventListener('pageshow', function (e) { if (e.persisted && full) reload(); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
    mount(document.querySelectorAll('[data-ma-acct]'));
    loadLocked(atlas).then(start);
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
        '<div class="ma-menu" role="menu" hidden><a role="menuitem" href="' + esc(SITE_URL + 'cabinet/') + '">Личный кабинет</a><a role="menuitem" href="' + esc(AUTH_URL + '#account') + '">Аккаунт</a><button type="button" role="menuitem" data-ma-out>Выйти</button></div></div>';
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
    mount: mount, bootAtlas: bootAtlas, onChange: function (f) { listeners.push(f); }, loadLocked: loadLocked,
    call: call, api: api, setSession: setSession, logout: logout, refresh: refresh,
  };
})();
