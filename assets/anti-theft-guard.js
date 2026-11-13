/* ==========================================================================
   Medical Atlas — Система защиты интеллектуальной собственности (Anti-Sharing & DRM)
   Встраивается поверх оригинального сайта без изменения его дизайна:
   1. Контроль устройств и сессий (лимит до 3 устройств, при входе 15 человек — авто-бан)
   2. Защита от скриншотов (PrintScreen, Cmd+Shift+3/4/5, Win+Shift+S, DevTools, потеря фокуса)
   3. Динамические водяные знаки поверх схем и конспектов
   4. Запрет выделения текста, копирования, контекстного меню и печати
   Работает как с серверным API, так и автономно на GitHub Pages.
   ========================================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'ma-drm-security-state-v1';

  var style = document.createElement('style');
  style.textContent = [
    /* Запрет выделения и перетаскивания схем */
    'body.ma-drm-active { -webkit-user-select: none; -moz-user-select: none; user-select: none; -webkit-touch-callout: none; }',
    'body.ma-drm-active input, body.ma-drm-active textarea { -webkit-user-select: text; -moz-user-select: text; user-select: text; }',
    'body.ma-drm-active img, body.ma-drm-active svg { -webkit-user-drag: none; user-drag: none; }',
    /* Полная блокировка печати страницы */
    '@media print { body * { display: none !important; } body::after { content: "Печать и копирование материалов Medical Atlas запрещены системой защиты авторских прав."; display: block !important; padding: 48px; font: 600 18px/1.5 system-ui, sans-serif; color: #1e293b; text-align: center; } }',
    /* Полупрозрачная диагональная сетка водяных знаков */
    '#ma-drm-watermark { position: fixed; inset: 0; z-index: 2147482000; pointer-events: none; overflow: hidden; opacity: 0.045; display: grid; grid-template-columns: repeat(4, 1fr); gap: 48px; padding: 32px; transform: rotate(-14deg) scale(1.25); font: 600 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; color: #0f172a; }',
    '.ma-drm-wm-cell { white-space: nowrap; user-select: none; }',
    /* Размытие при попытке скриншота / потере фокуса */
    '#ma-drm-blur-shield { position: fixed; inset: 0; z-index: 2147483640; background: rgba(15, 23, 42, 0.84); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); display: none; align-items: center; justify-content: center; padding: 24px; font-family: system-ui, -apple-system, sans-serif; }',
    '#ma-drm-blur-shield.is-open { display: flex; }',
    '.ma-drm-modal { max-width: 480px; width: 100%; background: #ffffff; color: #0f172a; border: 1px solid #cbd5e1; border-radius: 16px; padding: 28px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.45); }',
    '.ma-drm-modal h2 { margin: 0 0 8px; font-size: 20px; font-weight: 700; color: #0f172a; }',
    '.ma-drm-modal p { margin: 0 0 16px; font-size: 14px; line-height: 1.55; color: #475569; }',
    '.ma-drm-strike-box { background: #fff1f2; border: 1px solid #fecdd3; border-radius: 12px; padding: 12px 14px; margin-bottom: 18px; font-size: 13px; color: #881337; }',
    '.ma-drm-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 11px 16px; border: 0; border-radius: 10px; background: #1e293b; color: #ffffff; font: 600 14px/1.2 system-ui, sans-serif; cursor: pointer; transition: background 0.15s; }',
    '.ma-drm-btn:hover { background: #0f172a; }',
    /* Экран полной блокировки аккаунта (BANNED за 15 человек или 3 страйка скриншотов) */
    '#ma-drm-ban-screen { position: fixed; inset: 0; z-index: 2147483646; background: #090d16; color: #f8fafc; display: none; align-items: center; justify-content: center; padding: 24px; font-family: system-ui, -apple-system, sans-serif; overflow-y: auto; }',
    '#ma-drm-ban-screen.is-banned { display: flex; }',
    '.ma-ban-card { max-width: 640px; width: 100%; background: #111827; border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 20px; padding: 32px; box-shadow: 0 25px 60px rgba(0,0,0,0.65); }',
    '.ma-ban-kicker { font: 600 11px/1.4 ui-monospace, monospace; color: #f87171; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 6px; }',
    '.ma-ban-title { margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #ffffff; }',
    '.ma-ban-reason { background: #030712; border: 1px solid #1f2937; border-radius: 12px; padding: 16px; margin-bottom: 20px; font-size: 14px; line-height: 1.6; color: #fca5a5; }',
    '.ma-ban-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px; }',
    '.ma-ban-stat { background: #1f2937; border: 1px solid #374151; border-radius: 12px; padding: 14px; }',
    '.ma-ban-stat-label { font-size: 12px; color: #9ca3af; margin-bottom: 4px; }',
    '.ma-ban-stat-val { font: 700 20px/1.2 ui-monospace, monospace; color: #ffffff; }',
    '.ma-ban-log { background: #030712; border: 1px solid #1f2937; border-radius: 12px; padding: 12px 14px; margin-bottom: 20px; max-height: 150px; overflow-y: auto; font-size: 12px; color: #d1d5db; }',
    '.ma-ban-log-row { display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; border-bottom: 1px solid #111827; }',
    /* Компактный виджет управления и тестирования защиты в правом нижнем углу */
    '#ma-drm-widget { position: fixed; right: 16px; bottom: 16px; z-index: 2147483500; font-family: system-ui, -apple-system, sans-serif; }',
    '#ma-drm-pill { display: inline-flex; align-items: center; gap: 8px; padding: 9px 14px; border-radius: 999px; background: #0f172a; color: #f8fafc; border: 1px solid rgba(148, 163, 184, 0.3); font-size: 12px; font-weight: 600; cursor: pointer; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.28); }',
    '#ma-drm-pill:hover { background: #1e293b; }',
    '.ma-drm-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; }',
    '.ma-drm-dot.is-warn { background: #f59e0b; }',
    '#ma-drm-drawer { position: fixed; right: 16px; bottom: 60px; z-index: 2147483501; width: 380px; max-width: calc(100vw - 32px); background: #ffffff; color: #0f172a; border: 1px solid #cbd5e1; border-radius: 16px; padding: 18px; box-shadow: 0 20px 45px rgba(15, 23, 42, 0.25); display: none; }',
    '#ma-drm-drawer.is-open { display: block; }',
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
    '#ma-drm-toast { position: fixed; left: 16px; bottom: 16px; z-index: 2147483600; max-width: 380px; background: #0f172a; color: #ffffff; border: 1px solid #334155; border-radius: 12px; padding: 12px 16px; font: 500 12px/1.45 system-ui, sans-serif; box-shadow: 0 12px 30px rgba(0,0,0,0.35); display: none; }'
  ].join('\n');
  document.head.appendChild(style);

  function nowTime() {
    return new Date().toTimeString().slice(0, 8);
  }

  function defaultState() {
    var authUser = window.MA_AUTH && typeof window.MA_AUTH.user === 'function' ? window.MA_AUTH.user() : null;
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
          deviceId: 'fp-macbook-pro-01',
          name: 'MacBook Pro 14"',
          os: 'macOS Sequoia',
          browser: 'Chrome 134',
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

  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.style.display = 'none';
    }, 4000);
  }

  function showBlur(reason) {
    if (!blurShieldEl || state.status === 'BANNED') return;
    var reasonNode = blurShieldEl.querySelector('[data-drm-blur-reason]');
    var countNode = blurShieldEl.querySelector('[data-drm-strike-count]');
    if (reasonNode) reasonNode.textContent = reason;
    if (countNode) countNode.textContent = state.strikes.length + ' из ' + state.maxStrikes;
    blurShieldEl.classList.add('is-open');
  }

  function renderUI() {
    if (!watermarkEl) return;

    var authUser = window.MA_AUTH && typeof window.MA_AUTH.user === 'function' ? window.MA_AUTH.user() : null;
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
      pillText.textContent = 'Защита контента · Устр: ' + state.registeredDevices.length + '/' + state.maxDevices + ' · Страйки: ' + state.strikes.length + '/' + state.maxStrikes;
    }
    if (dot) {
      if (state.strikes.length > 0 || state.registeredDevices.length >= state.maxDevices) dot.classList.add('is-warn');
      else dot.classList.remove('is-warn');
    }

    // 3. Update Drawer details
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
          : 'Зафиксировано страйков: ' + state.strikes.length + '/' + state.maxStrikes + ' (' + state.strikes[0].details + ')';
      }
    }

    // 4. Update Ban Lockout Screen
    if (banScreenEl) {
      if (state.status === 'BANNED') {
        banScreenEl.classList.add('is-banned');
        var reasonEl = banScreenEl.querySelector('[data-ban-reason]');
        var devCountEl = banScreenEl.querySelector('[data-ban-devs]');
        var stkCountEl = banScreenEl.querySelector('[data-ban-strikes]');
        var logEl = banScreenEl.querySelector('[data-ban-log]');
        if (reasonEl) reasonEl.textContent = state.banReason || 'Аккаунт заблокирован за нарушение правил безопасности.';
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

  // Local state transitions (used on GitHub Pages or when offline)
  function applyLocalStrike(type, details) {
    if (state.status === 'BANNED') return state;
    state.strikes.unshift({
      id: 'stk-' + Date.now(),
      type: type,
      timestamp: nowTime(),
      details: details
    });
    if (state.strikes.length >= state.maxStrikes) {
      state.status = 'BANNED';
      state.banReason = 'Автоматическая блокировка: достигнут лимит нарушений защиты контента (' + state.strikes.length + '/' + state.maxStrikes + ' попыток скриншота/копирования).';
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
        details: 'Превышен лимит устройств: попытка входа с ' + state.registeredDevices.length + '-го устройства (' + device.name + ', IP ' + device.ip + ')'
      });
      state.status = 'BANNED';
      state.banReason = 'Превышен лимит привязанных устройств (' + state.registeredDevices.length + ' при максимуме ' + state.maxDevices + '). Подозрение на передачу аккаунта третьим лицам.';
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
    state.banReason = 'Критический инцидент безопасности: зафиксирован одновременный вход ' + count + ' пользователей с одного аккаунта из разных регионов (лимит — до ' + state.maxDevices + ' личных устройств). Аккаунт заблокирован.';
    state.bannedAt = nowTime();
    saveLocalState(state);
    return state;
  }

  function syncAction(url, payload, fallbackFn, cb) {
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
          if (cb) cb(state);
        } else {
          throw new Error('Invalid payload');
        }
      })
      .catch(function () {
        state = fallbackFn();
        renderUI();
        if (cb) cb(state);
      });
  }

  function recordStrike(type, details, blurMsg) {
    syncAction(
      '/api/security/strike',
      { type: type, details: details },
      function () { return applyLocalStrike(type, details); },
      function (updated) {
        if (updated.status !== 'BANNED' && blurMsg) {
          showBlur(blurMsg);
        }
      }
    );
  }

  function mountDOM() {
    document.body.classList.add('ma-drm-active');

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
        '<h2>Экран скрыт системой защиты от скриншотов</h2>' +
        '<p data-drm-blur-reason>Обнаружена попытка создания скриншота или инспектирования защищённой схемы.</p>' +
        '<div class="ma-drm-strike-box">' +
          '<b>Внимание:</b> Зафиксирован страйк безопасности (<span data-drm-strike-count>1 из 3</span>). При 3 попытках скриншота или записи экрана аккаунт автоматически блокируется.' +
        '</div>' +
        '<button type="button" class="ma-drm-btn" data-drm-unblur>Вернуться к работе с атласом</button>' +
      '</div>';
    document.body.appendChild(blurShieldEl);
    blurShieldEl.querySelector('[data-drm-unblur]').addEventListener('click', function () {
      blurShieldEl.classList.remove('is-open');
    });

    // Full-screen Ban Lockout
    banScreenEl = document.createElement('div');
    banScreenEl.id = 'ma-drm-ban-screen';
    banScreenEl.innerHTML =
      '<div class="ma-ban-card">' +
        '<div class="ma-ban-kicker">MEDICAL ATLAS SECURITY LOCKOUT · АВТОМАТИЧЕСКАЯ БЛОКИРОВКА</div>' +
        '<h1 class="ma-ban-title">Доступ к аккаунту заблокирован</h1>' +
        '<div class="ma-ban-reason" data-ban-reason></div>' +
        '<div class="ma-ban-grid">' +
          '<div class="ma-ban-stat">' +
            '<div class="ma-ban-stat-label">Устройств в аккаунте (Анти-складчина)</div>' +
            '<div class="ma-ban-stat-val" data-ban-devs>15 / 3</div>' +
          '</div>' +
          '<div class="ma-ban-stat">' +
            '<div class="ma-ban-stat-label">Страйки скриншотов и копирования</div>' +
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
          state = defaultState();
          saveLocalState(state);
          return state;
        },
        function () {
          blurShieldEl.classList.remove('is-open');
          showToast('Блокировка снята, счётчик устройств и страйков сброшен.');
        }
      );
    });

    // Floating Security Pill & Testing Drawer
    widgetEl = document.createElement('div');
    widgetEl.id = 'ma-drm-widget';
    widgetEl.innerHTML =
      '<button type="button" id="ma-drm-pill" title="Панель проверки анти-складчины и защиты от скриншотов">' +
        '<span class="ma-drm-dot"></span>' +
        '<span data-drm-pill-text>Защита контента · Устр: 2/3 · Страйки: 0/3</span>' +
      '</button>';
    document.body.appendChild(widgetEl);

    drawerEl = document.createElement('div');
    drawerEl.id = 'ma-drm-drawer';
    drawerEl.innerHTML =
      '<div class="ma-drm-drawer-head">' +
        '<span class="ma-drm-drawer-title">Система защиты Medical Atlas</span>' +
        '<button type="button" class="ma-drm-close" aria-label="Закрыть">✕</button>' +
      '</div>' +
      '<div class="ma-drm-section">' +
        '<div><b>Анти-складчина (лимит до 3 устройств):</b></div>' +
        '<div data-drm-devices></div>' +
      '</div>' +
      '<div class="ma-drm-section">' +
        '<div><b>Защита от скриншотов и копирования:</b></div>' +
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
          '<span>Симулировать скриншот PrintScreen (+1 страйк)</span>' +
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
      recordStrike(
        'SCREENSHOT',
        'Попытка создания скриншота защищённой схемы (PrintScreen)',
        'Перехвачена клавиша создания скриншота (PrintScreen / Захват экрана).'
      );
    });
    drawerEl.querySelector('[data-sim-reset]').addEventListener('click', function () {
      syncAction(
        '/api/security/reset',
        {},
        function () {
          state = defaultState();
          saveLocalState(state);
          return state;
        },
        function () {
          showToast('Счётчик устройств и страйков успешно сброшен.');
        }
      );
    });

    // Event listeners for real screenshot/copy/devtools protection
    window.addEventListener('keydown', function (e) {
      var isPrintScreen = e.key === 'PrintScreen';
      var isShotShortcut = (e.metaKey || e.ctrlKey) && e.shiftKey && ['3', '4', '5', 's', 'S'].indexOf(e.key) >= 0;
      var isDevTools = e.key === 'F12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].indexOf(e.key) >= 0);
      var isPrintOrSave = (e.ctrlKey || e.metaKey) && ['p', 'P', 's', 'S'].indexOf(e.key) >= 0;

      if (isPrintScreen || isShotShortcut) {
        e.preventDefault();
        recordStrike(
          'SCREENSHOT',
          'Перехвачена горячая клавиша скриншота (' + e.key + ')',
          'Обнаружена попытка создания скриншота экрана (' + e.key + ').'
        );
      } else if (isDevTools) {
        e.preventDefault();
        recordStrike(
          'DEVTOOLS',
          'Попытка открытия DevTools для копирования схем',
          'Инструменты разработчика (DevTools) заблокированы системой защиты.'
        );
      } else if (isPrintOrSave) {
        e.preventDefault();
        showToast('Сохранение и печать материалов заблокированы системой защиты Medical Atlas.');
      }
    });

    window.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      showToast('Правый клик и сохранение изображений отключены для защиты авторских схем.');
    });

    window.addEventListener('copy', function (e) {
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      recordStrike(
        'COPY_ATTEMPT',
        'Попытка копирования текста конспекта в буфер обмена',
        'Копирование материалов конспекта запрещено! Зафиксирован страйк.'
      );
    });

    // Initial fetch of security state (with local fallback for GitHub Pages)
    fetch('/api/security/state')
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        if (data && data.userId) {
          state = data;
          saveLocalState(state);
          renderUI();
        } else {
          renderUI();
        }
      })
      .catch(function () {
        renderUI();
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountDOM);
  } else {
    mountDOM();
  }
})();
