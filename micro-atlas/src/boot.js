(function () {
  if (window.MA) { window.MA.bootAtlas('micro', 'micro-app'); return; }
  var script = document.createElement('script');
  script.textContent = document.getElementById('micro-app').textContent;
  document.body.appendChild(script);
})();
