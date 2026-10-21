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

  // Private material is never persisted or read from a former offline cache.
  function cacheClear() {
    try { indexedDB.deleteDatabase('ma-content'); } catch (e) {}
    if (window.caches) window.caches.keys().then(function (names) {
      names.filter(function (n) { return /^ma-content(?:-|$)/.test(n); }).forEach(function (n) { window.caches.delete(n); });
    }).catch(function () {});
  }
  cacheClear();
  // Remove only the three retired team portraits from this site's CacheStorage.
  // Learning images, authentication and progress are left intact.
  function purgeTeamPortraits() {
    if (!window.caches) return;
    var retired = ['ceo.jpg', 'dev.jpg', 'mkt.jpg'].map(function (name) {
      return new URL('assets/team/' + name, SITE_URL).href;
    });
    window.caches.keys().then(function (names) {
      return Promise.all(names.map(function (name) {
        if (/^ma-content(?:-|$)/.test(name)) return;
        return window.caches.open(name).then(function (cache) {
          return cache.keys().then(function (requests) {
            return Promise.all(requests.filter(function (request) {
              var url = new URL(request.url); url.search = ''; url.hash = '';
              return retired.indexOf(url.href) !== -1;
            }).map(function (request) { return cache.delete(request); }));
          });
        });
      }));
    }).catch(function () {});
  }
  purgeTeamPortraits();
  var POLICY = 'subject-subscription-v1', DELIVERY = 'topic-delivery-v1', sessionEpoch = 0;
  function loadLocked(atlas, topic) {
    var owner = user(), epoch = sessionEpoch;
    if (!owner) return Promise.resolve({ status: 'signed-out', code: null });
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(topic || '')) return Promise.resolve({ status: 'choose-topic', code: null });
    return api('/content-v3/' + encodeURIComponent(atlas) + '/' + encodeURIComponent(topic), { raw: true }).then(function (res) {
      if (res.headers.get('X-Access-Policy') !== POLICY || res.headers.get('X-Content-Policy') !== DELIVERY) throw fail('policy', 'Сервер ещё не обновлён.');
      var expiresAt = Number(res.headers.get('X-Access-Expires'));
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw fail('subscription_required', 'Подписка истекла.');
      return res.text().then(function (code) {
        if (!user() || user().id !== owner.id || sessionEpoch !== epoch) throw fail('signed-out', 'Аккаунт изменился.');
        return { status: 'ok', code: code, expiresAt: expiresAt, owner: owner.id };
      });
    }).catch(function (e) {
      return { status: e.status === 429 ? 'limited' : e.status === 403 || e.code === 'subscription_required' ? 'subscription-required' :
        e.code === 'signed-out' ? 'signed-out' : 'error', code: null, message: e.message, retryAfter: e.data && e.data.retryAfter };
    });
  }
  function bootAtlas(atlas, appId) {
    // A protected package may replace the body, including the public app element.
    var appCode = appId && document.getElementById(appId).textContent;
    var owner = user(), full = false, expiresAt = 0, catalog = window.MA_TOPICS || { topics: [], aliases: {} };
    var ids = catalog.topics.map(function (t) { return t.id; });
    function selected(previous) {
      var h = location.hash.slice(1); try { h = decodeURIComponent(h); } catch (e) {}
      if (h.indexOf('topic/') === 0) return ids.indexOf(h.slice(6)) >= 0 ? h.slice(6) : '';
      if (ids.indexOf(h) >= 0) return h;
      if (catalog.aliases && catalog.aliases[h]) return catalog.aliases[h];
      if (atlas === 'pathophys' && h === 'run') return previous || '';
      // Tools operate on the current topic; no all-subject package is requested.
      if (/^(body|drugs|learn|pathogens|questions|study)(\/|$)/.test(h)) return previous || '';
      return '';
    }
    var topic = selected('');
    window.MA_TOPIC = topic;
    window.MA_STATE = { auth: 'none', atlas: atlas, owner: owner && owner.id, accessExpiresAt: 0, admin: false };
    function run(code) { var el = document.createElement('script'); el.textContent = code; document.body.appendChild(el); el.remove(); }
    function reload() { document.documentElement.style.visibility = 'hidden'; location.reload(); }
    function stillOwner() { var current = user(); return !!(current && owner && current.id === owner.id); }
    function check() {
      if (!owner) return;
      document.documentElement.style.visibility = 'hidden';
      var hadAccess = hasAtlasAccess(atlas);
      if (!stillOwner() || full && Date.now() >= expiresAt) { reload(); return; }
      api('/access').then(function (r) {
        var grant = r.grants && r.grants[atlas];
        var open = r.policy === POLICY && grant && Number.isFinite(grant.expiresAt) && grant.expiresAt > Date.now();
        if (!stillOwner() || !!open !== hadAccess || full && !open) { reload(); return; }
        document.documentElement.style.visibility = '';
      }).catch(reload);
    }
    function href(t) {
      if (atlas === 'biochem') return '#topic/' + t.id;
      if (t.id.indexOf('pg-') === 0) return '#pathogens/' + t.id.slice(3);
      return '#' + t.id;
    }
    function controls(r) {
      var bar = document.createElement('aside'); bar.id = 'ma-topic-controls';
      var title = catalog.topics.find(function (t) { return t.id === topic; });
      var message = full ? 'Открыта тема: ' + (title ? title.title : topic) :
        r.status === 'public' ? (hasAtlasAccess(atlas) ? 'Все материалы предмета доступны. Выберите тему.' : 'Этот раздел доступен без подписки.') :
        r.status === 'limited' ? 'Временный лимит загрузки. Повторите через ' + (r.retryAfter || 60) + ' сек.' :
        r.status === 'error' ? 'Тему не удалось загрузить. Проверьте соединение и повторите.' :
        r.status === 'subscription-required' ? 'Для выбранной темы нужна подписка на этот предмет.' : 'Выберите тему. Два пробных конспекта доступны всем.';
      bar.innerHTML = '<div role="status">' + esc(message) + '</div><details><summary>Темы и материалы предмета</summary><nav aria-label="Выбор темы">' +
        catalog.topics.map(function (t) { return '<a href="' + esc(href(t)) + '">' + esc(t.title) + '</a>'; }).join('') + '</nav></details>' +
        (r.status === 'error' || r.status === 'limited' ? '<button type="button" data-topic-retry>Повторить загрузку</button>' : '');
      document.body.prepend(bar);
      var retry = bar.querySelector('[data-topic-retry]'); if (retry) retry.onclick = function () { location.reload(); };
      var style = document.createElement('style');
      style.textContent = '#ma-topic-controls{font:14px/1.5 system-ui;padding:12px 20px;background:#f1f4fb;color:#24334b;border-bottom:1px solid #cbd5e1}#ma-topic-controls nav{display:flex;gap:8px 18px;flex-wrap:wrap;max-height:45vh;overflow:auto;padding:12px 0}#ma-topic-controls a{color:#294ca5}#ma-copy-label{position:fixed;right:8px;bottom:8px;z-index:2147483000;pointer-events:none;background:#fffdf2e8;color:#514c39;padding:4px 8px;border:1px solid #cbc5b3;font:11px/1.4 system-ui;max-width:90vw}.ma-copy-print{display:none}@media print{#ma-topic-controls{display:none}#ma-copy-label{position:fixed;display:block!important}.ma-copy-print{display:block;font:10px system-ui;margin:10px 0}}';
      document.head.appendChild(style);
      if (full && window.MA_COPY) {
        var c = window.MA_COPY;
        var label = document.createElement('div'); label.id = 'ma-copy-label';
        label.textContent = 'Личная копия · ' + c.account + ' · ' + c.receipt + ' · ' + c.issuedAt;
        document.body.appendChild(label);
        // Repeated text survives ordinary copy/paste and print as well as screenshots.
        function marks() {
          var hosts = document.querySelectorAll('main article, .page, .dz-body, #sheet');
          [].forEach.call(hosts, function (host) {
            if (host.querySelector(':scope > .ma-copy-print')) return;
            var mark = document.createElement('p'); mark.className = 'ma-copy-print'; mark.textContent = label.textContent; host.appendChild(mark);
          });
        }
        marks();
        window.addEventListener('hashchange', function () { setTimeout(marks, 0); });
        document.addEventListener('click', function () { setTimeout(marks, 0); });
      }
    }
    // Registered before atlas handlers; a new topic gets a fresh document and fresh rights.
    window.addEventListener('hashchange', function (e) { if (selected(topic) !== topic) { e.stopImmediatePropagation(); reload(); } });
    listeners.push(function (current) { if ((current && current.id) !== (owner && owner.id)) reload(); });
    window.addEventListener('pagehide', function () { if (full) document.documentElement.style.visibility = 'hidden'; });
    window.addEventListener('pageshow', function (e) { if (e.persisted) reload(); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
    var publicRoute = (catalog.publicRoutes || []).indexOf(location.hash.slice(1).split('/')[0]) >= 0;
    var delivery = publicRoute || catalog.demo && catalog.demo.indexOf(topic) >= 0 ? Promise.resolve({ status: 'public', code: null }) : loadLocked(atlas, topic);
    // A title-only stub means "not loaded", not "no subscription".
    // Resolve subject rights even when the current page is a free lesson/tool.
    var rights = owner ? api('/access').then(function (r) { return r.policy === POLICY ? r : null; }).catch(function () { return null; }) : Promise.resolve(null);
    Promise.all([delivery, rights]).then(function (results) {
      var r = results[0], rights = results[1], grant = rights && rights.grants && rights.grants[atlas];
      var allowed = r.status === 'ok' && stillOwner() && r.expiresAt > Date.now();
      if (stillOwner()) {
        window.MA_STATE.accessExpiresAt = grant && Number.isFinite(grant.expiresAt) && grant.expiresAt > Date.now() ? grant.expiresAt : allowed ? r.expiresAt : 0;
        window.MA_STATE.admin = !!(rights && rights.admin);
      }
      window.MA_STATE.auth = allowed ? 'ok' : r.status;
      if (atlas === 'micro' && r.status === 'error') window.MICRO_LOAD_ERROR = true;
      if (allowed) { full = true; expiresAt = r.expiresAt; run(r.code); }
      if (appCode) run(appCode);
      // Legacy biochemistry packages create their navigation before returning.
      // Remove entitlement markers only; loading another package still goes through the API.
      if (atlas === 'biochem' && hasAtlasAccess(atlas)) {
        [].forEach.call(document.querySelectorAll('#pTabs .is-locked, #anList .is-locked'), function (button) {
          button.classList.remove('is-locked');
          [].forEach.call(button.querySelectorAll('.lock-ico'), function (icon) { icon.remove(); });
        });
      }
      controls(r);
      mount(document.querySelectorAll('[data-ma-acct]'));
      var expiry = full ? Math.min(expiresAt, window.MA_STATE.accessExpiresAt) : window.MA_STATE.accessExpiresAt;
      if (expiry > Date.now()) setTimeout(reload, Math.min(expiry - Date.now(), 2147483647));
      if (owner) setInterval(check, 60000);
    });
  }

  function hasAtlasAccess(atlas) {
    var state = window.MA_STATE, current = user();
    return !!(state && current && state.owner === current.id && state.atlas === atlas && state.accessExpiresAt > Date.now());
  }

  // ---------- вход и выход ----------
  function loginUrl(mode) {
    var u = new URL(AUTH_URL);
    if (location.href.indexOf(AUTH_URL) !== 0) u.searchParams.set('next', location.href);
    u.hash = mode || 'login';
    return u.href;
  }
  function signOutLocal() { sessionEpoch++; save(null); cacheClear(); emit(); }
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
  window.addEventListener('storage', function (e) { if (e.key === KEY) { sessionEpoch++; emit(); } });
  function mount(list) { [].slice.call(list || []).forEach(function (el) { if (widgets.indexOf(el) < 0) widgets.push(el); }); render(); }

  window.MA = {
    enabled: enabled, signedIn: signedIn, user: user, loginUrl: loginUrl, AUTH_URL: AUTH_URL, SITE_URL: SITE_URL, API: API,
    mount: mount, bootAtlas: bootAtlas, hasAtlasAccess: hasAtlasAccess, onChange: function (f) { listeners.push(f); }, loadLocked: loadLocked,
    call: call, api: api, setSession: setSession, logout: logout, refresh: refresh,
  };
})();
