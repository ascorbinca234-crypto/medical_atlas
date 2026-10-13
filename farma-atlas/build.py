"""Сборка атласа: src/*.js + src/style.css -> index.html (один самодостаточный файл).
Запуск:  python3 build.py
"""
from pathlib import Path
import glob

root = Path(__file__).parent
src = root / 'src'
css = (src / 'style.css').read_text(encoding='utf-8')
files = (['data.js', 'k0.js']
         + sorted(Path(p).name for p in glob.glob(str(src / 'k_*.js')))
         + sorted(Path(p).name for p in glob.glob(str(src / 'rx_*.js')))
         + ['drugs.js', 'body.js', 'learn.js', 'fx.js', 'app.js'])
js = '\n'.join((src / f).read_text(encoding='utf-8') for f in files)

html = f'''<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Атлас фармакологии</title>
<meta name="description" content="Интерактивный атлас по фармакологии: конспекты лекций схемами, карточки препаратов (доза, показания, побочные эффекты), анимированная схема организма и тренажёр для заучивания.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&family=Spectral:ital,wght@0,500;0,600;1,500&display=swap">
<style>
body{{margin:0}}
[hidden]{{display:none!important}}
{css}
</style>
</head>
<body>
<div class="mbar" lang="ru"><a href="#">Атлас фармакологии</a><button type="button" id="menuBtn" aria-expanded="false" aria-controls="rail"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>Листы</button></div>
<div class="scrim" id="scrim"></div>
<div class="app" lang="ru">
  <aside class="rail" id="rail">
    <a class="brand" href="#"><b>Атлас фармакологии</b><span>3 курс · лечебный факультет</span></a>
    <div class="search">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
      <input id="q" type="search" placeholder="Препарат или группа" autocomplete="off" aria-label="Поиск препарата или группы">
      <div class="results" id="results" aria-live="polite"></div>
    </div>
    <nav class="nav" id="nav" aria-label="Листы атласа"></nav>
  </aside>
  <main class="main"><div class="page" id="page"></div></main>
</div>
<div class="dz" id="dz" lang="ru" hidden><div class="dz-scrim" data-close></div><aside class="dz-panel" role="dialog" aria-modal="true" aria-labelledby="dz-title" tabindex="-1"><div class="dz-top"><button type="button" class="dz-back" hidden>← Назад</button><button type="button" class="dz-x" data-close aria-label="Закрыть досье">×</button></div><div class="dz-body" id="dzBody"></div></aside></div>
<script>
{js}
</script>
</body>
</html>
'''
(root / 'index.html').write_text(html, encoding='utf-8')
print('index.html', len(html.encode('utf-8')) // 1024, 'KB')
