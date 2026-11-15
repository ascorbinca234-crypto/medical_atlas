/* Shared presentation layer. Existing atlas scripts and animation engines are unchanged. */
(() => {
  const root = document.documentElement;
  const key = 'medical-atlas-theme';
  function readTheme() {
    try { return localStorage.getItem(key) === 'dark' ? 'dark' : 'light'; }
    catch (_) { return 'light'; }
  }
  let selectedTheme = readTheme();
  function applyTheme(theme) {
    selectedTheme = theme;
    root.dataset.theme = theme;
    try { localStorage.setItem(key, theme); } catch (_) {}
    const button = document.getElementById('atlas-theme');
    if (button) {
      button.setAttribute('aria-checked', String(theme === 'dark'));
      button.innerHTML = `<i aria-hidden="true">${theme === 'dark' ? '☾' : '☀'}</i>${theme === 'dark' ? 'Тёмная' : 'Светлая'}`;
    }
  }
  applyTheme(selectedTheme);
  document.getElementById('atlas-theme').addEventListener('click', () => {
    applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
  });
  // Some legacy views initialize their own saved theme after rendering.
  // Restore the common choice, including after asynchronous view mounting.
  new MutationObserver(() => {
    const desired = selectedTheme;
    if (root.dataset.theme !== desired) applyTheme(desired);
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  window.addEventListener('storage', event => {
    if (event.key === key) applyTheme(readTheme());
  });
  // Settings in existing atlases also write the shared preference.
  document.addEventListener('click', event => {
    const control = event.target.closest('[data-th], [data-theme-set]');
    if (!control) return;
    const value = control.dataset.th || control.dataset.themeSet;
    const theme = value === 'dark' || ((value === 'auto' || value === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    applyTheme(theme);
  }, true);
  const search = document.getElementById('atlas-search');
  if (search) search.addEventListener('input', () => {
    let matches = 0;
    document.querySelectorAll('.atlas-cover-card').forEach(card => {
      card.hidden = !card.dataset.search.includes(search.value.trim().toLowerCase());
      if (!card.hidden) matches++;
    });
    document.getElementById('atlas-search-empty').hidden = matches > 0;
  });
  const dialog = document.getElementById('atlas-image-dialog');
  if (dialog) {
    document.querySelectorAll('[data-atlas-photo]').forEach(button => {
      button.addEventListener('click', () => {
        dialog.querySelector('img').src = button.dataset.atlasPhoto;
        dialog.querySelector('img').alt = button.querySelector('img').alt;
        dialog.querySelector('[data-credit]').innerHTML = button.dataset.credit;
        dialog.showModal();
      });
    });
    dialog.querySelector('button').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  }
})();
