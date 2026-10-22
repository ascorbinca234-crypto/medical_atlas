// Training carries image captions and exercise metadata; fetch visible image
// bytes separately through the same subscription and no-store delivery policy.
(function(P){
  const record = P.record;
  P.record = (item, result) => {
    const answer = record(item, result);
    if (window.MAP) window.MAP.card({atlas:'micro', ok:result.g >= 2});
    return answer;
  };
  const pending = new Map(), files = new Map();
  const key = '#micro-photo-';
  function replace(id, file){
    const photo = PH.find(p => p.id === id);
    if (photo) photo.file = file;
    document.querySelectorAll('img').forEach(img => {
      if (img.getAttribute('src')?.endsWith(key+id)) img.src = file;
    });
  }
  function load(img){
    const id = img.getAttribute('src')?.split(key)[1];
    if (!id) return;
    if (files.has(id)){ replace(id, files.get(id)); return; }
    if (pending.has(id)) return;
    const task = window.MA.loadLocked('micro', 'photo-'+id).then(r => {
      if (r.status !== 'ok' || !window.MA.hasAtlasAccess('micro')) throw new Error(r.message || 'Не удалось загрузить снимок.');
      const script = document.createElement('script'); script.textContent = r.code;
      document.body.appendChild(script); script.remove();
      const photo = window.MICRO_PHOTO; delete window.MICRO_PHOTO;
      if (!photo || photo.id !== id) throw new Error('Не удалось загрузить снимок.');
      files.set(id, photo.file); replace(id, photo.file);
    }).catch(e => {
      const retry = document.createElement('button'); retry.type = 'button';
      retry.className = 'btn'; retry.textContent = 'Повторить загрузку снимка';
      retry.title = e.message;
      retry.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); retry.remove(); load(img); });
      // Keep retry controls outside the image's existing button.
      (img.closest('button') || img).insertAdjacentElement('afterend', retry);
    }).finally(() => pending.delete(id));
    pending.set(id, task);
  }
  const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting){ observer.unobserve(e.target); load(e.target); }
  }), {rootMargin:'150px'}) : {observe:load,unobserve(){}};
  const scan = () => document.querySelectorAll('img[src*="#micro-photo-"]').forEach(img => observer.observe(img));
  const after = P.after;
  P.after = r => { after(r); scan(); };
  document.addEventListener('click', () => setTimeout(scan, 0));
})(PREP);
