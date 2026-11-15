/* Public catalog search; access checks remain in each destination atlas. */
(() => {
  const normalize = value => String(value).toLowerCase().replace(/ё/g, 'е').normalize('NFKC').trim();
  const entries = (window.ATLAS_SEARCH_INDEX || []).map(row => ({ ...row, normalized: normalize(row.text) }));
  function find(query) {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return entries.filter(row => terms.every(term => row.normalized.includes(term)))
      .sort((a, b) => Number(normalize(b.title).includes(normalize(query))) - Number(normalize(a.title).includes(normalize(query))));
  }
  window.AtlasCatalogSearch = { find };
  const form = document.getElementById('atlas-global-search');
  const input = document.getElementById('atlas-query');
  const list = document.getElementById('atlas-search-results');
  const status = document.getElementById('atlas-search-status');
  function render() {
    list.replaceChildren();
    if (!input.value.trim()) { status.textContent = ''; return; }
    const matches = find(input.value);
    status.textContent = matches.length ? `Найдено: ${matches.length}${matches.length > 12 ? ' · показаны первые 12' : ''}` : 'Ничего не найдено. Попробуйте название темы или вещества.';
    for (const row of matches.slice(0, 12)) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = row.url;
      const title = document.createElement('span');
      title.textContent = row.title;
      const subject = document.createElement('small');
      subject.textContent = row.subject;
      link.append(title, subject);
      item.append(link);
      list.append(item);
    }
  }
  function focusSearch() {
    input.scrollIntoView({ block: 'center', behavior: 'auto' });
    input.focus({ preventScroll: true });
  }
  input.addEventListener('input', render);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const first = list.querySelector('a');
    if (first) first.click();
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') {
      const first = list.querySelector('a');
      if (first) { event.preventDefault(); first.focus(); }
    }
    if (event.key === 'Escape') { input.value = ''; render(); }
  });
  document.getElementById('atlas-search-shortcut').addEventListener('click', focusSearch);
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && (event.code === 'KeyK' || event.key.toLowerCase() === 'k')) {
      event.preventDefault();
      focusSearch();
    }
  });
})();
