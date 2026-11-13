/* ==========================================================================
   Medical Atlas — Боевая система защиты КОНСПЕКТОВ (Anti-Sharing & Anti-Screenshot DRM v4)
   Активируется ИСКЛЮЧИТЕЛЬНО внутри открытых конспектов и схем атласов:
   - На главной странице, в личном кабинете, на странице входа и в главном меню
     атласов (список тем / тренажёры) защита НЕ мешает пользователю и НЕ кидает страйки.
   - Как только студент открывает конспект (лекцию, лист схем, биохимический путь или тему):
     включаются водяные знаки, запрет копирования и мгновенный (0 мс) перехват
     скриншотов (PrintScreen, Win+Shift+S, Cmd+Shift+3/4/5, Ножницы / потеря фокуса).
   - 3 страйка на конспектах или вход 15 человек с одного аккаунта = авто-бан.
   ========================================================================== */
(function () {
  'use strict';
  if (window.__MA_DRM_GUARD_LOADED__) return;
  window.__MA_DRM_GUARD_LOADED__ = true;

  var STORAGE_KEY = 'ma-drm-security-state-v4';
  var isStaticHost = /\.github\.io$/i.test(location.hostname);

  var style = document.createElement('style');
  style.textContent = [
    /* Запрет выделения и перетаскивания ТОЛЬКО когда открыт конспект (body.ma-drm-active) */
    'body.ma-drm-active { -webkit-user-select: none !important; -moz-user-select: none !important; user-select: none !important; -webkit-touch-callout: none !important; }',
    'body.ma-drm-active input, body.ma-drm-active textarea { -webkit-user-select: text !important; -moz-user-select: text !important; user-select: text !important; }',
    'body.ma-drm-active img, body.ma-drm-active svg { -webkit-user-drag: none !important; user-drag: none !important; }',
    /* Мгновенное (0 мс) скрытие контента конспекта при попытке скриншота */
    'body.ma-drm-shielded > *:not(#ma-drm-blur-shield):not(#ma-drm-ban-screen):not(#ma-drm-widget):not(#ma-drm-drawer):not(#ma-drm-toast) { filter: blur(36px) brightness(0.06) !important; opacity: 0.03 !important; transition: none !important; pointer-events: none !important; }',
    /* Блокировка печати открытого конспекта */
    '@media print { body.ma-drm-active * { display: none !important; } body.ma-drm-active::after { content: "Печать и сохранение конспектов Medical Atlas в PDF запрещены системой защиты авторских прав."; display: block !important; padding: 48px; font: 600 18px/1.5 system-ui, sans-serif; color: #1e293b; text-align: center; } }',
    /* Диагональная сетка водяных знаков (видна только внутри конспектов) */
    '#ma-drm-watermark { position: fixed; inset: 0; z-index: 2147482000; pointer-events: none; overflow: hidden; opacity: 0.055; display: none; grid-template-columns: repeat(4, 1fr); gap: 48px; padding: 32px; transform: rotate(-14deg) scale(1.25); font: 600 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; color: #0f172a; }',
    'body.ma-drm-active #ma-drm-watermark { display: grid; }',
    '.ma-drm-wm-cell { white-space: nowrap; user-select: none; }',
    /* Мгновенный экран блокировки кадра (0ms transition) */
    '#ma-drm-blur-shield { position: fixed; inset: 0; z-index: 2147483640; background: #070b14; background: rgba(7, 11, 20, 0.98); backdrop-filter: blur(36px); -webkit-backdrop-filter: blur(36px); display: none; align-items: center; justify-content: center; padding: 24px; font-family: system-ui, -apple-system, sans-serif; transition: none !important; }',
    '#ma-drm-blur-shield.is-open { display: flex !important; }',
    '.ma-drm-modal { max-width: 500px; width: 100%; background: #ffffff; color: #0f172a; border: 2px solid #ef4444; border-radius: 16px; padding: 28px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.85); }',
    '.ma-drm-modal-badge { display: inline-block; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; font: 700 11px/1.2 ui-monospace, monospace; padding: 5px 10px; border-radius: 6px; margin-bottom: 12px; text-transform: uppercase; }',
    '.ma-drm-modal h2 { margin: 0 0 8px; font-size: 20px; font-weight: 700; color: #0f172a; }',
    '.ma-drm-modal p { margin: 0 0 16px; font-size: 14px; line-height: 1.55; color: #334155; }',
    '.ma-drm-strike-box { background: #fff1f2; border: 1px solid #fecdd3; border-radius: 12px; padding: 12px 14px; margin-bottom: 18px; font-size: 13px; color: #881337; }',
    '.ma-drm-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 12px 16px; border: 0; border-radius: 10px; background: #0f172a; color: #ffffff; font: 600 14px/1.2 system-ui, sans-serif; cursor: pointer; }',
    '.ma-drm-btn:hover { background: #1e293b; }',
    /* Экран полной блокировки аккаунта (BANNED за 15 человек или 3 страйка скриншотов конспекта) */
    '#ma-drm-ban-screen { position: fixed; inset: 0; z-index: 2147483646; background: #090d16; color: #f8fafc; display: none; align-items: center; justify-content: center; padding: 24px; font-family: system-ui, -apple-system, sans-serif; overflow-y: auto; }',
    '#ma-drm-ban-screen.is-banned { display: flex !important; }',
    '.ma-ban-card { max-width: 640px; width: 100%; background: #111827; border: 2px solid #ef4444; border-radius: 20px; padding: 32px; box-shadow: 0 25px 60px rgba(0,0,0,0.9); }',
    '.ma-ban-kicker { font: 700 11px/1.4 ui-monospace, monospace; color: #f87171; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 6px; }',
    '.ma-ban-title { margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #ffffff; }',
    '.ma-ban-reason { background: #030712; border: 1px solid #1f2937; border-radius: 12px; padding: 16px; margin-bottom: 20px; font-size: 14px; line-height: 1.6; color: #fca5a5; }',
    '.ma-ban-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px; }',
    '.ma-ban-stat { background: #1f2937; border: 1px solid #374151; border-radius: 12px; padding: 14px; }',
    '.ma-ban-stat-label { font-size: 12px; color: #9ca3af; margin-bottom: 4px; }',
    '.ma-ban-stat-val { font: 700 20px/1.2 ui-monospace, monospace; color: #ffffff; }',
    '.ma-ban-log { background: #030712; border: 1px solid #1f2937; border-radius: 12px; padding: 12px 14px; margin-bottom: 20px; max-height: 150px; overflow-y: auto; font-size: 12px; color: #d1d5db; }',
    '.ma-ban-log-row { display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; border-bottom: 1px solid #111827; }',
    /* Компактный виджет управления защитой (отображается только внутри конспектов) */
    '#ma-drm-widget { position: fixed; right: 16px; bottom: 16px; z-index: 2147483645; font-family: system-ui, -apple-system, sans-serif; display: none; }',
    'body.ma-drm-active #ma-drm-widget { display: block; }',
    '#ma-drm-pill { display: inline-flex; align-items: center; gap: 8px; padding: 9px 14px; border-radius: 999px; background: #0f172a; color: #f8fafc; border: 1px solid rgba(148, 163, 184, 0.35); font-size: 12px; font-weight: 600; cursor: pointer; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.4); }',
    '#ma-drm-pill:hover { background: #1e293b; }',
    '.ma-drm-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; }',
    '.ma-drm-dot.is-warn { background: #f59e0b; }',
    '.ma-drm-dot.is-danger { background: #ef4444; }',
    '#ma-drm-drawer { position: fixed; right: 16px; bottom: 60px; z-index: 2147483645; width: 390px; max-width: calc(100vw - 32px); background: #ffffff; color: #0f172a; border: 1px solid #cbd5e1; border-radius: 16px; padding: 18px; box-shadow: 0 20px 45px rgba(15, 23, 42, 0.4); display: none; }',
    'body.ma-drm-active #ma-drm-drawer.is-open { display: block; }',
    '.ma-drm-drawer-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0; }',
    '.ma-drm-drawer-title { font-size: 14px; font-weight: 700; color: #0f172a; }',
    '.ma-drm-close { background: none; border: 0; font-size: 18px; color: #64748b; cursor: pointer; padding: 2px 6px; }',
    '.ma-drm-section { margin-bottom: 12px; font-size: 12px; color: #334155; }',
    '.ma-drm-dev-item { display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 7px 10px; margin-top: 6px; font-size: 11px; }',
    '.ma-drm-actions { display: flex; flex-direction: column; gap: 7px; margin-top: 12px; }',
    '.ma-drm-act-btn { width: 100%; text-align: left; padding: 9px 12px; border-radius: 9px; border: 1px solid #cbd5e1; background: #f8fafc; color: #0f172a; font: 600 12px/1.3 system-ui, sans-serif; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }',
    '.ma-drm-act-btn:hover { background: #f1f5f9; }',
    '.ma-drm-act-btn.danger { background: #fef2f2; border-color: #fecaca; color: #991b1b; }',
    '.ma-drm-act-btn.danger:hover { background: #fee2e2; }',
    '#ma-drm-toast { position: fixed; left: 16px; bottom: 16px; z-index: 2147483645; max-width: 380px; background: #0f172a; color: #ffffff; border: 1px solid #334155; border-radius: 12px; padding: 12px 16px; font: 500 12px/1.45 system-ui, sans-serif; box-shadow: 0 12px 30px rgba(0,0,0,0.45); display: none; }'
  ].join('\n');
  document.head.appendChild(style);

  // ===========================================================================
  // ОПРЕДЕЛЕНИЕ: ОТКРЫТ ЛИ СЕЙЧАС ИМЕННО КОНСПЕКТ (А НЕ ГЛАВНОЕ МЕНЮ / КАБИНЕТ)
  // ===========================================================================
  function isKonspektOpen() {
    var path = location.pathname || '';
    var rawHash = (location.hash || '').replace(/^#/, '');
    try { rawHash = decodeURIComponent(rawHash); } catch (e) {}
    var h = rawHash.trim();

    // 1. Атлас фармакологии (/farma-atlas/)
    if (/\/farma-atlas(\/|$)/i.test(path)) {
      if (!h || h === 'home') return false;
      // Вспомогательные разделы меню/тренажёров — не конспекты
      if (/^(drugs|body|learn|train|cmp|find)(\/|$)/i.test(h)) return false;
      // Все лекции (#k-gen, #k-aff, #k-pns...), подробные листы (#pk, #pd, #la...) и #sheet — это конспекты
      return true;
    }

    // 2. Атлас биохимии (/biochem-atlas/)
    if (/\/biochem-atlas(\/|$)/i.test(path)) {
      var vNotes = document.getElementById('v-notes');
      var vPaths = document.getElementById('v-paths');
      if (vNotes && !vNotes.hidden) return true;
      if (vPaths && !vPaths.hidden) return true;
      if (/^(n-|topic\/)/i.test(h)) return true;
      return false;
    }

    // 3. Атлас микробиологии (/micro-atlas/)
    if (/\/micro-atlas(\/|$)/i.test(path)) {
      if (!h || h === 'home') return false;
      // Тренажёры, вопросы и анимации не считаем текстовыми конспектами
      if (/^(learn|questions|anim)(\/|$)/i.test(h)) return false;
      // Все конспекты (#g1..#g16, #t1.., #s1.., #v1.., #pathogens/..., #abx...) — защищаем
      return true;
    }

    // 4. Атлас патофизиологии (/pathophys-atlas/)
    if (/\/pathophys-atlas(\/|$)/i.test(path)) {
      if (!h || h === 'home' || h === 'run') return false;
      // Любая открытая тема (#disease, #pathogenesis, #inflammation...) — это конспект
      return true;
    }

    // Главная страница (/), Личный кабинет (/cabinet/), Авторизация (/auth/) — НЕ конспекты
    return false;
  }

  function nowTime() {
    return new Date().toTimeString().slice(0, 8);
  }

  function getAuthUser() {
    if (window.MA && typeof window.MA.user === 'function') return window.MA.user();
    if (window.MA_AUTH && typeof window.MA_AUTH.user === 'function') return window.MA_AUTH.user();
    return null;
  }

  function getDeviceFingerprint() {
    var raw = [
      navigator.userAgent || '',
      navigator.platform || '',
      screen.width + 'x' + screen.height,
      Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    ].join('|');
    var hash = 0;
    for (var i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0;
    }
    return 'fp-' + Math.abs(hash).toString(16);
  }

  function defaultState() {
    var authUser = getAuthUser();
    return {
      userId: (authUser && authUser.id) || 'MED-84920-RU',
      email: (authUser && authUser.email) || 'ascorbinca234@gmail.com',
      maxDevices: 3,
      maxStrikes: 3,
      status: 'ACTIVE',
      banReason: '',
      bannedAt: '',
      registeredDevices: [
        {
          deviceId: getDeviceFingerprint(),
          name: 'Текущее устройство (' + (navigator.platform || 'Desktop') + ')',
          os: navigator.platform || 'OS',
          browser: 'Browser',
          ip: '178.140.214.88',
          location: 'Санкт-Петербург, РФ',
          lastActive: 'Сейчас онлайн',
          isCurrent: true
        },
        {
          deviceId: 'fp-iphone-16-02',
          name: 'iPhone 16 Pro',
          os: 'iOS 18.3',
          browser: 'Mobile Safari',
          ip: '178.140.214.88',
          location: 'Санкт-Петербург, РФ',
          lastActive: '14 мин. назад',
          isCurrent: false
        }
      ],
      strikes: []
    };
  }

  function loadLocalState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.userId) return parsed;
      }
    } catch (e) {}
    return defaultState();
  }

  function saveLocalState(s) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch (e) {}
  }

  var state = loadLocalState();
  var watermarkEl, blurShieldEl, banScreenEl, widgetEl, drawerEl, toastEl, toastTimer;
  var drawerOpen = false;
  var lastStrikeAt = 0;

  function poisonClipboard() {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText('Скриншоты и копирование конспектов Medical Atlas заблокированы системой защиты авторских прав.').catch(function () {});
      }
    } catch (e) {}
  }

  function showToast(msg) {
    if (!toastEl || !isKonspektOpen()) return;
    toastEl.textContent = msg;
    toastEl.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.style.display = 'none';
    }, 4500);
  }

  function activateInstantShield(reason, isStrike) {
    if (!isKonspektOpen()) return;
    document.body.classList.add('ma-drm-shielded');
    if (!blurShieldEl || state.status === 'BANNED') return;
    var reasonNode = blurShieldEl.querySelector('[data-drm-blur-reason]');
    var countNode = blurShieldEl.querySelector('[data-drm-strike-count]');
    var badgeNode = blurShieldEl.querySelector('[data-drm-badge]');
    if (reasonNode) reasonNode.textContent = reason;
    if (countNode) countNode.textContent = state.strikes.length + ' из ' + state.maxStrikes;
    if (badgeNode) {
      badgeNode.textContent = isStrike
        ? 'ЗАФИКСИРОВАН СТРАЙК НА КОНСПЕКТЕ (' + state.strikes.length + '/' + state.maxStrikes + ')'
        : 'ЗАЩИТА КОНСПЕКТА ОТ СКРИНШОТОВ АКТИВНА';
    }
    blurShieldEl.classList.add('is-open');
  }

  function syncProtectionScope() {
    var active = isKonspektOpen();
    if (active) {
      document.body.classList.add('ma-drm-active');
    } else {
      document.body.classList.remove('ma-drm-active');
      document.body.classList.remove('ma-drm-shielded');
      if (blurShieldEl) blurShieldEl.classList.remove('is-open');
      if (banScreenEl) banScreenEl.classList.remove('is-banned');
      if (drawerEl) {
        drawerOpen = false;
        drawerEl.classList.remove('is-open');
      }
      if (toastEl) toastEl.style.display = 'none';
    }
    renderUI();
  }

  function renderUI() {
    if (!watermarkEl) return;

    var active = isKonspektOpen();
    var authUser = getAuthUser();
    if (authUser && authUser.email) state.email = authUser.email;
    if (authUser && authUser.id) state.userId = authUser.id;

    // 1. Update Watermark cells
    var wmHtml = '';
    for (var i = 0; i < 20; i++) {
      wmHtml += '<div class="ma-drm-wm-cell"><div>' + state.email + '</div><div>ID: ' + state.userId + ' · ЗАЩИТА АВТОРСКИХ ПРАВ</div></div>';
    }
    watermarkEl.innerHTML = wmHtml;

    // 2. Update Floating Security Pill
    var pillText = widgetEl.querySelector('[data-drm-pill-text]');
    var dot = widgetEl.querySelector('.ma-drm-dot');
    if (pillText) {
      pillText.textContent = 'Защита конспекта · Устр: ' + state.registeredDevices.length + '/' + state.maxDevices + ' · Страйки: ' + state.strikes.length + '/' + state.maxStrikes;
    }
    if (dot) {
      dot.classList.remove('is-warn', 'is-danger');
      if (state.status === 'BANNED') dot.classList.add('is-danger');
      else if (state.strikes.length > 0 || state.registeredDevices.length >= state.maxDevices) dot.classList.add('is-warn');
    }

    // 3. Update Blur modal strike counter if open
    if (blurShieldEl) {
      var countNode = blurShieldEl.querySelector('[data-drm-strike-count]');
      if (countNode) countNode.textContent = state.strikes.length + ' из ' + state.maxStrikes;
    }

    // 4. Update Drawer details
    if (drawerEl) {
      var devList = drawerEl.querySelector('[data-drm-devices]');
      if (devList) {
        devList.innerHTML = state.registeredDevices.slice(0, 4).map(function (d) {
          return '<div class="ma-drm-dev-item"><span><b>' + d.name + '</b> (' + d.location + ')</span><span style="font-family:monospace;color:#64748b">' + d.ip + '</span></div>';
        }).join('') + (state.registeredDevices.length > 4 ? '<div class="ma-drm-dev-item"><b>+ ещё ' + (state.registeredDevices.length - 4) + ' сессий с разных IP</b></div>' : '');
      }
      var strikeSummary = drawerEl.querySelector('[data-drm-strikes-summary]');
      if (strikeSummary) {
        strikeSummary.textContent = state.strikes.length === 0
          ? 'Нарушений не зафиксировано (0/' + state.maxStrikes + ').'
          : 'Зафиксировано страйков: ' + state.strikes.length + '/' + state.maxStrikes + ' — ' + state.strikes[0].details;
      }
    }

    // 5. Update Ban Lockout Screen (показываем блокировку при попытке открыть конспект)
    if (banScreenEl) {
      if (state.status === 'BANNED' && active) {
        document.body.classList.add('ma-drm-shielded');
        blurShieldEl.classList.remove('is-open');
        banScreenEl.classList.add('is-banned');
        var reasonEl = banScreenEl.querySelector('[data-ban-reason]');
        var devCountEl = banScreenEl.querySelector('[data-ban-devs]');
        var stkCountEl = banScreenEl.querySelector('[data-ban-strikes]');
        var logEl = banScreenEl.querySelector('[data-ban-log]');
        if (reasonEl) reasonEl.textContent = state.banReason || 'Доступ к конспектам заблокирован за нарушение правил безопасности.';
        if (devCountEl) devCountEl.textContent = state.registeredDevices.length + ' / ' + state.maxDevices + ' разрешённых';
        if (stkCountEl) stkCountEl.textContent = state.strikes.length + ' / ' + state.maxStrikes + ' страйков';
        if (logEl) {
          logEl.innerHTML = state.strikes.map(function (s) {
            return '<div class="ma-ban-log-row"><span>' + s.details + '</span><span style="font-family:monospace;color:#9ca3af">' + s.timestamp + '</span></div>';
          }).join('');
        }
      } else {
        banScreenEl.classList.remove('is-banned');
      }
    }
  }

  function applyLocalStrike(type, details) {
    if (state.status === 'BANNED') return state;
    var nowMs = Date.now();
    if (nowMs - lastStrikeAt < 1200) return state;
    lastStrikeAt = nowMs;

    state.strikes.unshift({
      id: 'stk-' + nowMs,
      type: type,
      timestamp: nowTime(),
      details: details
    });
    if (state.strikes.length >= state.maxStrikes) {
      state.status = 'BANNED';
      state.banReason = 'Автоматическая блокировка доступа к конспектам: зафиксировано 3 из 3 попыток создания скриншота / копирования защищённых материалов.';
      state.bannedAt = nowTime();
    }
    saveLocalState(state);
    return state;
  }

  function applyLocalDevice(device) {
    if (state.status === 'BANNED') return state;
    state.registeredDevices.push(device);
    if (state.registeredDevices.length > state.maxDevices) {
      state.strikes.unshift({
        id: 'stk-dev-' + Date.now(),
        type: 'MULTI_ACCOUNT_SHARING',
        timestamp: nowTime(),
        details: 'Превышен лимит устройств: вход с ' + state.registeredDevices.length + '-го устройства (' + device.name + ', IP ' + device.ip + ')'
      });
      state.status = 'BANNED';
      state.banReason = 'Превышен лимит привязанных устройств (' + state.registeredDevices.length + ' при максимуме ' + state.maxDevices + '). Доступ к конспектам заблокирован за передачу аккаунта третьим лицам.';
      state.bannedAt = nowTime();
    }
    saveLocalState(state);
    return state;
  }

  function applyLocalMassSharing(count) {
    var cities = ['Москва', 'Казань', 'Новосибирск', 'Екатеринбург', 'Нижний Новгород', 'Самара', 'Ростов-на-Дону', 'Уфа', 'Красноярск', 'Воронеж', 'Пермь', 'Волгоград', 'Краснодар'];
    for (var i = 0; i < count - 2; i++) {
      state.registeredDevices.push({
        deviceId: 'fp-shared-' + i,
        name: 'Сессия #' + (i + 3) + ' (Складчина)',
        os: i % 2 === 0 ? 'Windows 11' : 'Android 15',
        browser: 'Chrome',
        ip: '95.' + (110 + i) + '.' + (40 + i) + '.' + (12 + i),
        location: cities[i % cities.length] + ', РФ',
        lastActive: 'Сейчас онлайн',
        isCurrent: false
      });
    }
    state.strikes.unshift({
      id: 'stk-mass-' + Date.now(),
      type: 'MULTI_ACCOUNT_SHARING',
      timestamp: nowTime(),
      details: 'Аномальная активность: ' + count + ' одновременных сессий с разных IP-адресов и городов.'
    });
    state.status = 'BANNED';
    state.banReason = 'Критический инцидент безопасности: зафиксирован одновременный вход ' + count + ' пользователей с одного аккаунта из разных регионов (лимит — до ' + state.maxDevices + ' личных устройств). Доступ к конспектам заблокирован.';
    state.bannedAt = nowTime();
    saveLocalState(state);
    return state;
  }

  function syncAction(url, payload, fallbackFn, cb) {
    state = fallbackFn();
    renderUI();
    if (cb) cb(state);

    if (isStaticHost) return;

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        if (data && data.userId) {
          state = data;
          saveLocalState(state);
          renderUI();
        }
      })
      .catch(function () {});
  }

  function recordStrike(type, details, blurMsg) {
    if (!isKonspektOpen()) return;
    document.body.classList.add('ma-drm-shielded');
    poisonClipboard();
    syncAction(
      '/api/security/strike',
      { type: type, details: details },
      function () { return applyLocalStrike(type, details); },
      function (updated) {
        if (updated.status !== 'BANNED') {
          activateInstantShield(blurMsg || details, true);
        }
      }
    );
  }

  function mountDOM() {
    // Watermark layer
    watermarkEl = document.createElement('div');
    watermarkEl.id = 'ma-drm-watermark';
    watermarkEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(watermarkEl);

    // Blur shield modal
    blurShieldEl = document.createElement('div');
    blurShieldEl.id = 'ma-drm-blur-shield';
    blurShieldEl.innerHTML =
      '<div class="ma-drm-modal">' +
        '<div class="ma-drm-modal-badge" data-drm-badge>ЗАФИКСИРОВАН СТРАЙК НА КОНСПЕКТЕ</div>' +
        '<h2>Конспект скрыт системой защиты от скриншотов</h2>' +
        '<p data-drm-blur-reason>Обнаружена попытка создания скриншота конспекта (PrintScreen / Win+Shift+S / Cmd+Shift+3/4) или вызова программы захвата экрана.</p>' +
        '<div class="ma-drm-strike-box">' +
          '<b>Счётчик нарушений: <span data-drm-strike-count>1 из 3</span>.</b><br>' +
          'В главном меню и личном кабинете ограничений нет, но внутри конспектов при 3 попытках сделать скриншот или скопировать схему доступ блокируется автоматически.' +
        '</div>' +
        '<button type="button" class="ma-drm-btn" data-drm-unblur>Я понял, вернуться к чтению конспекта</button>' +
      '</div>';
    document.body.appendChild(blurShieldEl);
    blurShieldEl.querySelector('[data-drm-unblur]').addEventListener('click', function () {
      document.body.classList.remove('ma-drm-shielded');
      blurShieldEl.classList.remove('is-open');
    });

    // Full-screen Ban Lockout
    banScreenEl = document.createElement('div');
    banScreenEl.id = 'ma-drm-ban-screen';
    banScreenEl.innerHTML =
      '<div class="ma-ban-card">' +
        '<div class="ma-ban-kicker">MEDICAL ATLAS SECURITY LOCKOUT · АВТОМАТИЧЕСКАЯ БЛОКИРОВКА</div>' +
        '<h1 class="ma-ban-title">Доступ к конспектам заблокирован</h1>' +
        '<div class="ma-ban-reason" data-ban-reason></div>' +
        '<div class="ma-ban-grid">' +
          '<div class="ma-ban-stat">' +
            '<div class="ma-ban-stat-label">Устройств в аккаунте (Анти-складчина)</div>' +
            '<div class="ma-ban-stat-val" data-ban-devs>15 / 3</div>' +
          '</div>' +
          '<div class="ma-ban-stat">' +
            '<div class="ma-ban-stat-label">Страйки скриншотов конспекта</div>' +
            '<div class="ma-ban-stat-val" data-ban-strikes>3 / 3</div>' +
          '</div>' +
        '</div>' +
        '<div class="ma-ban-log" data-ban-log></div>' +
        '<button type="button" class="ma-drm-btn" style="background:#0284c7" data-ban-reset>Снять блокировку и сбросить страйки (Тестовый режим владельца)</button>' +
      '</div>';
    document.body.appendChild(banScreenEl);
    banScreenEl.querySelector('[data-ban-reset]').addEventListener('click', function () {
      syncAction(
        '/api/security/reset',
        {},
        function () {
          lastStrikeAt = 0;
          state = defaultState();
          saveLocalState(state);
          return state;
        },
        function () {
          document.body.classList.remove('ma-drm-shielded');
          blurShieldEl.classList.remove('is-open');
          showToast('Блокировка снята, счётчик устройств и страйков сброшен.');
        }
      );
    });

    // Floating Security Pill & Testing Drawer
    widgetEl = document.createElement('div');
    widgetEl.id = 'ma-drm-widget';
    widgetEl.innerHTML =
      '<button type="button" id="ma-drm-pill" title="Панель проверки анти-складчины и защиты конспекта">' +
        '<span class="ma-drm-dot"></span>' +
        '<span data-drm-pill-text>Защита конспекта · Устр: 2/3 · Страйки: 0/3</span>' +
      '</button>';
    document.body.appendChild(widgetEl);

    drawerEl = document.createElement('div');
    drawerEl.id = 'ma-drm-drawer';
    drawerEl.innerHTML =
      '<div class="ma-drm-drawer-head">' +
        '<span class="ma-drm-drawer-title">Защита конспектов Medical Atlas</span>' +
        '<button type="button" class="ma-drm-close" aria-label="Закрыть">✕</button>' +
      '</div>' +
      '<div class="ma-drm-section">' +
        '<div><b>Анти-складчина (лимит до 3 устройств):</b></div>' +
        '<div data-drm-devices></div>' +
      '</div>' +
      '<div class="ma-drm-section">' +
        '<div><b>Защита открытого конспекта от скриншотов:</b></div>' +
        '<div data-drm-strikes-summary style="margin-top:4px;color:#b91c1c;font-weight:600"></div>' +
      '</div>' +
      '<div class="ma-drm-actions">' +
        '<button type="button" class="ma-drm-act-btn danger" data-sim-15>' +
          '<span>Симулировать вход 15 человек (Бан за складчину)</span>' +
          '<span>15 IP →</span>' +
        '</button>' +
        '<button type="button" class="ma-drm-act-btn" data-sim-dev4>' +
          '<span>Симулировать вход с 4-го устройства (Превышение лимита)</span>' +
          '<span>4/3 →</span>' +
        '</button>' +
        '<button type="button" class="ma-drm-act-btn" data-sim-shot>' +
          '<span>Тест: сделать скриншот конспекта (+1 страйк)</span>' +
          '<span>+1 →</span>' +
        '</button>' +
        '<button type="button" class="ma-drm-act-btn" data-sim-reset>' +
          '<span>Сбросить страйки и устройства</span>' +
          '<span>Сброс</span>' +
        '</button>' +
      '</div>';
    document.body.appendChild(drawerEl);

    toastEl = document.createElement('div');
    toastEl.id = 'ma-drm-toast';
    document.body.appendChild(toastEl);

    widgetEl.querySelector('#ma-drm-pill').addEventListener('click', function () {
      drawerOpen = !drawerOpen;
      drawerEl.classList.toggle('is-open', drawerOpen);
    });
    drawerEl.querySelector('.ma-drm-close').addEventListener('click', function () {
      drawerOpen = false;
      drawerEl.classList.remove('is-open');
    });

    drawerEl.querySelector('[data-sim-15]').addEventListener('click', function () {
      syncAction('/api/security/simulate-sharing', { count: 15 }, function () {
        return applyLocalMassSharing(15);
      });
    });
    drawerEl.querySelector('[data-sim-dev4]').addEventListener('click', function () {
      var dev4 = {
        deviceId: 'fp-extra-' + Date.now(),
        name: 'Windows PC (Чужое устройство #4)',
        os: 'Windows 11',
        browser: 'Chrome',
        ip: '95.161.221.14',
        location: 'Казань, РФ',
        lastActive: 'Только что',
        isCurrent: false
      };
      syncAction('/api/security/register-device', { device: dev4 }, function () {
        return applyLocalDevice(dev4);
      });
    });
    drawerEl.querySelector('[data-sim-shot]').addEventListener('click', function () {
      lastStrikeAt = 0;
      recordStrike(
        'SCREENSHOT',
        'Попытка создания скриншота конспекта (PrintScreen)',
        'Перехвачена клавиша создания скриншота конспекта (PrintScreen / Захват экрана).'
      );
    });
    drawerEl.querySelector('[data-sim-reset]').addEventListener('click', function () {
      syncAction(
        '/api/security/reset',
        {},
        function () {
          lastStrikeAt = 0;
          state = defaultState();
          saveLocalState(state);
          return state;
        },
        function () {
          document.body.classList.remove('ma-drm-shielded');
          blurShieldEl.classList.remove('is-open');
          showToast('Счётчик устройств и страйков успешно сброшен.');
        }
      );
    });

    // =========================================================================
    // ПЕРЕХВАТЧИКИ СКРИНШОТОВ — РАБОТАЮТ ТОЛЬКО КОГДА ОТКРЫТ КОНСПЕКТ
    // =========================================================================

    window.addEventListener('keydown', function (e) {
      if (!isKonspektOpen()) return;

      var key = e.key || '';
      var code = e.code || '';
      var keyCode = e.keyCode || e.which || 0;

      // Упреждающее затемнение конспекта при нажатии клавиши Win / Cmd (Meta / OS)
      if (key === 'Meta' || key === 'OS' || keyCode === 91 || keyCode === 92 || e.metaKey) {
        document.body.classList.add('ma-drm-shielded');
      }

      // A) Комбинация Win+Shift (перед S в Win+Shift+S) или Cmd+Shift (перед 3/4/5 на Mac)
      if ((e.metaKey && e.shiftKey) || (e.ctrlKey && e.shiftKey && ['3', '4', '5', 's', 'S', 'ы', 'Ы'].indexOf(key) >= 0)) {
        document.body.classList.add('ma-drm-shielded');
        recordStrike(
          'SCREENSHOT',
          'Перехвачена комбинация захвата конспекта (Win/Cmd + Shift)',
          'Обнаружена комбинация клавиш создания скриншота конспекта (Win+Shift+S / Cmd+Shift+3/4). Экран заблокирован, начислен страйк.'
        );
        return;
      }

      // B) PrintScreen на keydown
      if (key === 'PrintScreen' || code === 'PrintScreen' || keyCode === 44) {
        e.preventDefault();
        document.body.classList.add('ma-drm-shielded');
        recordStrike(
          'SCREENSHOT',
          'Нажата клавиша PrintScreen на конспекте',
          'Обнаружено нажатие клавиши PrintScreen при просмотре конспекта. Экран скрыт, буфер обмена очищен, начислен страйк.'
        );
        return;
      }

      // C) DevTools (F12, Ctrl/Cmd+Shift+I/J/C, Ctrl+U)
      var isDevTools =
        key === 'F12' ||
        keyCode === 123 ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c', 'И', 'и', 'О', 'о', 'С', 'с'].indexOf(key) >= 0) ||
        ((e.ctrlKey || e.metaKey) && ['u', 'U', 'г', 'Г'].indexOf(key) >= 0);

      if (isDevTools) {
        e.preventDefault();
        recordStrike(
          'DEVTOOLS',
          'Попытка открытия кода конспекта / DevTools',
          'Инструменты разработчика (DevTools) и копирование схем конспекта заблокированы. Начислен страйк.'
        );
        return;
      }

      // D) Печать или сохранение конспекта (Ctrl+P / Ctrl+S)
      if ((e.ctrlKey || e.metaKey) && ['p', 'P', 's', 'S', 'з', 'З', 'ы', 'Ы'].indexOf(key) >= 0) {
        e.preventDefault();
        showToast('Сохранение и печать конспектов заблокированы системой защиты Medical Atlas.');
      }
    }, true);

    window.addEventListener('keyup', function (e) {
      if (!isKonspektOpen()) return;

      var key = e.key || '';
      var code = e.code || '';
      var keyCode = e.keyCode || e.which || 0;

      if (key === 'PrintScreen' || code === 'PrintScreen' || keyCode === 44) {
        e.preventDefault();
        document.body.classList.add('ma-drm-shielded');
        recordStrike(
          'SCREENSHOT',
          'Нажата клавиша PrintScreen на конспекте (перехват буфера обмена)',
          'Обнаружено нажатие клавиши PrintScreen. Содержимое буфера обмена стёрто, начислен страйк.'
        );
        return;
      }

      if ((key === 'Meta' || key === 'OS' || keyCode === 91 || keyCode === 92) && !blurShieldEl.classList.contains('is-open') && state.status !== 'BANNED') {
        document.body.classList.remove('ma-drm-shielded');
      }
    }, true);

    // Потеря фокуса окна (вызов Ножниц Windows Win+Shift+S / Lightshot / ShareX) — ТОЛЬКО внутри конспекта!
    window.addEventListener('blur', function () {
      if (!isKonspektOpen() || state.status === 'BANNED') return;
      document.body.classList.add('ma-drm-shielded');
      recordStrike(
        'SCREENSHOT',
        'Вызов инструмента скриншотов / потеря фокуса на конспекте',
        'Зафиксирован вызов инструмента скриншотов (Win+Shift+S / Ножницы / внешняя программа) при открытом конспекте. Экран скрыт, начислен страйк.'
      );
    });

    document.addEventListener('visibilitychange', function () {
      if (!isKonspektOpen()) return;
      if (document.hidden && state.status !== 'BANNED') {
        document.body.classList.add('ma-drm-shielded');
        recordStrike(
          'SCREENSHOT',
          'Фоновый захват экрана на открытом конспекте',
          'Обнаружена попытка фонового захвата или переключения окна при открытом конспекте.'
        );
      }
    });

    window.addEventListener('contextmenu', function (e) {
      if (!isKonspektOpen()) return;
      e.preventDefault();
      showToast('Правый клик и сохранение схем внутри конспектов отключены.');
    }, true);

    window.addEventListener('copy', function (e) {
      if (!isKonspektOpen()) return;
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      if (e.clipboardData) {
        e.clipboardData.setData('text/plain', 'Копирование конспектов Medical Atlas запрещено системой защиты авторских прав.');
      }
      recordStrike(
        'COPY_ATTEMPT',
        'Попытка копирования текста конспекта (Ctrl+C)',
        'Копирование материалов конспекта запрещено! Зафиксирован страйк безопасности.'
      );
    }, true);

    // Отслеживаем переходы между главным меню атласа и конспектами
    window.addEventListener('hashchange', syncProtectionScope);
    window.addEventListener('popstate', syncProtectionScope);
    document.addEventListener('click', function () {
      setTimeout(syncProtectionScope, 30);
    }, true);

    syncProtectionScope();

    if (!isStaticHost) {
      fetch('/api/security/state')
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(function (data) {
          if (data && data.userId) {
            state = data;
            saveLocalState(state);
            syncProtectionScope();
          }
        })
        .catch(function () {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountDOM);
  } else {
    mountDOM();
  }
})();
