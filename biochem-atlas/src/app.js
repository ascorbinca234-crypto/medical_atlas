(function () {
  'use strict';
  var ma = window.MA, state = window.MA_STATE || {}, params = new URLSearchParams(location.search);
  if (state.auth === 'ok') {
    document.body.removeAttribute('data-biochem-shell');
    var controls = document.querySelector('.controls');
    if (controls) {
      var home = document.createElement('a');
      home.className = 'btn'; home.href = './'; home.textContent = 'Все разделы';
      controls.prepend(home);
    }
    // Topic packages still own the full atlas and its protected material.
    if (/^sec-/.test(window.MA_TOPIC || '') && /^(rx|study)$/.test(params.get('view') || '') && typeof setView === 'function') setView(params.get('view'));
    return;
  }

  var topics = (window.MA_TOPICS || {}).topics || [];
  var open = !!(ma && ma.hasAtlasAccess('biochem'));
  var signedIn = !!(ma && ma.user());
  var views = ['atlas', 'rx', 'paths', 'anim', 'study'];
  var titles = {atlas: 'Разделы атласа', rx: 'Реакции по разделам', paths: 'Метаболические пути', anim: 'Анимации', study: 'Учёба по разделам'};
  var descriptions = {atlas: 'Вещества и их роль в обмене', rx: 'Выберите раздел с реакциями', paths: 'Схемы обмена веществ', anim: 'Процессы в движении', study: 'Повторение, формулы и шпаргалки'};
  var colors = ['#2F55D4', '#0A7F6B', '#B27608', '#C25A06', '#7838AE', '#CF243B', '#1B8655', '#3865DF', '#9A7300', '#7A5ADB'];
  var lock = '<svg class="lock-ico" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7.5" rx="1.6"/><path d="M5.3 7V5.2a2.7 2.7 0 0 1 5.4 0V7"/></svg>';
  var cards = Array.from(document.querySelectorAll('[data-biochem-topic]'));
  var search = document.getElementById('q'), notice = document.getElementById('topic-notice');
  var view = 'atlas';
  function normalize(value) { return value.toLowerCase().replace(/ё/g, 'е').trim(); }
  document.getElementById('access-note').textContent = open ?
    (state.admin ? 'Все материалы доступны администратору' : 'Все материалы доступны по вашей подписке') :
    'Два открытых конспекта · остальные материалы по подписке';
  cards.forEach(function (card, i) {
    card.style.setProperty('--sc', colors[i % colors.length]);
    card.querySelector('.topic-meta').innerHTML = (open ? '' : lock) + (open ? 'Открыть →' : 'По подписке →');
  });
  function render() {
    var hash = location.hash.slice(1);
    if (views.indexOf(hash) >= 0) view = hash;
    else view = views.indexOf(params.get('view')) >= 0 ? params.get('view') : 'atlas';
    var freeNote = hash === 'amino-acids' || hash === 'monosaccharides';
    document.querySelectorAll('[data-view]').forEach(function (tab) {
      if (tab.dataset.view === view) tab.setAttribute('aria-current', 'page'); else tab.removeAttribute('aria-current');
    });
    document.getElementById('catalog-title').textContent = titles[view];
    document.getElementById('catalog-description').textContent = descriptions[view];
    document.getElementById('free-section').hidden = view !== 'atlas' || freeNote;
    document.getElementById('catalog-section').hidden = freeNote;
    document.getElementById('free-notes').hidden = !freeNote;
    search.parentElement.hidden = freeNote;
    document.querySelectorAll('.free-note').forEach(function (note) { note.hidden = note.id !== hash; });
    var query = normalize(search.value), count = 0;
    cards.forEach(function (card) {
      var id = card.dataset.biochemTopic;
      var prefix = view === 'paths' ? 'path-' : view === 'anim' ? 'anim-' : 'sec-';
      card.hidden = !id.startsWith(prefix) || !normalize(card.textContent).includes(query);
      card.href = (view === 'rx' || view === 'study' ? '?view=' + view : './') + '#topic/' + id;
      if (!card.hidden) count++;
    });
    document.getElementById('catalog-empty').hidden = count > 0;
    // A denied or failed deep link keeps the subject navigation and free notes.
    var selected = topics.find(function (topic) { return topic.id === window.MA_TOPIC; });
    notice.replaceChildren();
    notice.hidden = !selected || views.indexOf(hash) >= 0 || freeNote;
    if (!notice.hidden) {
      var heading = document.createElement('h2'), text = document.createElement('p');
      heading.textContent = selected.title;
      text.textContent = state.auth === 'limited' ? 'Достигнут временный лимит загрузки. Попробуйте немного позже.' :
        state.auth === 'error' ? 'Не удалось загрузить тему. Проверьте соединение и повторите.' :
        !signedIn ? 'Войдите в аккаунт с доступом к биохимии, чтобы открыть эту тему.' :
        'Эта тема доступна по действующей подписке на биохимию.';
      notice.append(heading, text);
      if (state.auth === 'error' || state.auth === 'limited') {
        var retry = document.createElement('button'); retry.type = 'button'; retry.className = 'btn'; retry.textContent = 'Повторить загрузку';
        retry.onclick = function () { location.reload(); }; notice.append(retry);
      } else if (!signedIn && ma && ma.enabled()) {
        var login = document.createElement('a'); login.className = 'btn primary'; login.href = ma.loginUrl(); login.textContent = 'Войти'; notice.append(login);
      }
      var back = document.createElement('a'); back.className = 'btn'; back.href = '#atlas'; back.textContent = 'Все разделы'; notice.append(back);
    }
  }
  var modes = ['auto', 'light', 'dark'], labels = {auto: 'Тема: авто', light: 'Тема: светлая', dark: 'Тема: тёмная'};
  var theme = 'auto';
  try { var saved = localStorage.getItem('bx-theme'); if (modes.includes(saved)) theme = saved; } catch (_) {}
  function applyTheme() {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = theme;
    document.getElementById('themeBtn').textContent = labels[theme];
  }
  document.getElementById('themeBtn').onclick = function () {
    theme = modes[(modes.indexOf(theme) + 1) % modes.length];
    try { localStorage.setItem('bx-theme', theme); } catch (_) {}
    applyTheme();
  };
  search.addEventListener('input', render);
  window.addEventListener('hashchange', render);
  applyTheme(); render();
})();
