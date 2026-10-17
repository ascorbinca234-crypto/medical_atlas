(function () {
  'use strict';
  var MA = window.MA, started = false, timer;
  var owner = MA && MA.user() ? MA.user().id : null;
  function run(code) {
    var script = document.createElement('script');
    script.textContent = code;
    document.body.appendChild(script);
  }
  function start(code) {
    if (started) return;
    started = true;
    clearTimeout(timer);
    if (code) run(code);
    run(document.getElementById('micro-app').textContent);
    if (MA) MA.mount(document.querySelectorAll('[data-ma-acct]'));
  }
  // No persistent cache: the server authorizes every full-content load.
  if (!MA || !MA.signedIn()) { start(); return; }
  timer = setTimeout(function () { window.MICRO_LOAD_ERROR = true; start(); }, 8000);
  MA.api('/content/micro', { raw: true }).then(function (res) { return res.text(); }).then(function (code) {
    var user = MA.user();
    if (!user || user.id !== owner) { start(); return; }
    start(code);
  }).catch(function (e) {
    if (![401, 403, 404].includes(e.status)) window.MICRO_LOAD_ERROR = true;
    start();
  });
  MA.onChange(function (user) {
    if (window.MICRO_FULL && (!user || user.id !== owner)) location.reload();
  });
  addEventListener('pageshow', function (e) { if (e.persisted && window.MICRO_FULL) location.reload(); });
})();
