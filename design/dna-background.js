/* Viewport-fixed background. Pauses in hidden tabs and with reduced motion. */
(() => {
  const video = document.getElementById('atlas-dna-video');
  const button = document.getElementById('atlas-dna-toggle');
  if (!video || !button) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let userPaused = false;
  function sync() {
    const paused = userPaused || reduced.matches;
    button.hidden = reduced.matches;
    button.textContent = paused ? '▶ Анимация ДНК' : 'Ⅱ Пауза анимации';
    button.setAttribute('aria-pressed', String(userPaused));
    if (paused || document.hidden) {
      video.pause();
    } else {
      if (!video.src) video.src = video.dataset.src;
      const play = video.play();
      if (play) play.catch(() => {
        userPaused = true;
        button.textContent = '▶ Анимация ДНК';
        button.setAttribute('aria-pressed', 'true');
      });
    }
  }
  button.addEventListener('click', () => { userPaused = !userPaused; sync(); });
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
  sync();
})();
