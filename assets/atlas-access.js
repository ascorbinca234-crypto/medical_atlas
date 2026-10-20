/* Home cards reflect the same server grants as the atlases themselves. */
(function () {
  'use strict';
  var MA = window.MA;
  var cards = Array.from(document.querySelectorAll('[data-ma-atlas]')).map(function (card) {
    var note = card.querySelector('[data-ma-access-note]');
    return { atlas: card.dataset.maAtlas, status: card.querySelector('[data-ma-access-status]'), note: note, demo: note.textContent };
  });
  if (!MA || !cards.length) return;
  var generation = 0, expiryTimer;
  function paint(status, note) {
    cards.forEach(function (card) { card.status.textContent = status; card.note.textContent = note || card.demo; });
  }
  function update() {
    var requestId = ++generation, owner = MA.user();
    clearTimeout(expiryTimer);
    if (!owner) { paint('Пробная версия'); return; }
    paint('Проверяем доступ…');
    MA.api('/access').then(function (result) {
      if (requestId !== generation || !MA.user() || MA.user().id !== owner.id) return;
      if (result.policy !== 'subject-subscription-v1') throw new Error('Access policy mismatch');
      var nextExpiry = Infinity;
      cards.forEach(function (card) {
        var grant = result.grants && result.grants[card.atlas];
        var open = grant && Number.isFinite(grant.expiresAt) && grant.expiresAt > Date.now();
        card.status.textContent = open ? 'Открыт' : 'Пробная версия';
        card.note.textContent = open ? (result.admin ? 'Все материалы доступны администратору без подписки' : 'Все материалы доступны по подписке') : card.demo;
        if (open) nextExpiry = Math.min(nextExpiry, grant.expiresAt);
      });
      if (nextExpiry < Infinity) expiryTimer = setTimeout(update, Math.min(2147483647, Math.max(1, nextExpiry - Date.now())));
    }).catch(function () {
      if (requestId === generation) paint('Не удалось проверить доступ', 'Обновите страницу, чтобы проверить доступ к материалам.');
    });
  }
  MA.onChange(update);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) update(); });
  update();
}());
