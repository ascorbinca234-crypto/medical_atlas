"""Сборка атласа фармакологии.

Публичная часть: index.html — код атласа и бесплатные темы (лекции 1–3, листы I–VI).
Закрытая часть: ../server/content/farma.js — остальные темы. Её отдаёт сервер только
вошедшим пользователям, в публичный репозиторий она не попадает.

Запуск:  python3 build.py
Закрытые исходники берутся из ../../medical_atlas_private/farma-atlas/src
или из папки, указанной в переменной окружения ATLAS_PRIVATE (корень закрытого репозитория).
Без закрытой папки собирается только публичная часть.
"""
from pathlib import Path
import glob, hashlib, json, os, re, sys

root = Path(__file__).resolve().parent
repo = root.parent
src = root / 'src'
priv_root = Path(os.environ.get('ATLAS_PRIVATE') or repo.parent / 'medical_atlas_private')
psrc = priv_root / 'farma-atlas' / 'src'
content_out = repo / 'server' / 'content' / 'farma.js'


def read(p):
    return Path(p).read_text(encoding='utf-8')


# ---------- закрытая часть ----------
locked_js, locked_hash = '', ''
if psrc.is_dir():
    lfiles = (['data.locked.js']
              + sorted(Path(p).name for p in glob.glob(str(psrc / 'k_*.js')))
              + sorted(Path(p).name for p in glob.glob(str(psrc / 'rx_*.locked.js')))
              + ['drugs.locked.js', 'body.locked.js'])
    missing = [f for f in lfiles if not (psrc / f).exists()]
    if missing:
        sys.exit('В закрытой папке нет файлов: ' + ', '.join(missing))
    locked_js = '\n'.join(read(psrc / f) for f in lfiles)
    locked_hash = hashlib.sha256(locked_js.encode('utf-8')).hexdigest()[:16]
    content_out.parent.mkdir(parents=True, exist_ok=True)
    content_out.write_text(locked_js, encoding='utf-8')

    # заглушки закрытых тем: id, номер, название и краткое описание
    def field(chunk, name):
        m = re.search(r"\b" + name + r":'((?:[^'\\]|\\.)*)'", chunk)
        return m.group(1).replace("\\'", "'") if m else None

    stubs_k, stubs_p = [], []
    for f in sorted(glob.glob(str(psrc / 'k_*.js'))):
        t = read(f)
        i = t.find("{id:'")
        chunk = t[i:i + 3000]
        s = {k: field(chunk, k) for k in ('id', 'roman', 'lec', 'title', 'sum')}
        if not s['id'] or not s['title']:
            sys.exit(f'{Path(f).name}: не нашёл id или title лекции')
        stubs_k.append({**s, 'mod': 'kon', 'locked': True, 'blocks': [], 'rel': []})
    for chunk in read(psrc / 'data.locked.js').split('P.push(')[1:]:
        chunk = chunk[:3000]
        s = {k: field(chunk, k) for k in ('id', 'roman', 'mod', 'title', 'sum')}
        if not s['id'] or not s['title']:
            sys.exit('data.locked.js: не нашёл id или title листа')
        stubs_p.append({**s, 'locked': True, 'blocks': []})
    j = lambda o: json.dumps({k: v for k, v in o.items() if v is not None}, ensure_ascii=False)
    (src / 'locked_stubs.js').write_text(
        '/* ===== Заглушки закрытых тем: название и краткое описание. Содержимое приходит с сервера после входа.\n'
        '   Файл пересобирается build.py из закрытого репозитория. ===== */\n'
        + '\n'.join(f'KP.push({j(s)});' for s in stubs_k) + '\n'
        + '\n'.join(f'P.push({j(s)});' for s in stubs_p) + '\n', encoding='utf-8')
else:
    print(f'Закрытая папка не найдена ({psrc}) — собираю только публичную часть.')

# ---------- публичная часть ----------
css = read(src / 'style.css')
data_files = (['data.js', 'k0.js']
              + sorted(Path(p).name for p in glob.glob(str(src / 'k_*.js')))
              + ['locked_stubs.js']
              + sorted(Path(p).name for p in glob.glob(str(src / 'rx_*.js')))
              + ['drugs.js'])
code_files = ['fixup.js', 'body.js', 'learn.js', 'fx.js', 'app.js']
data_js = '\n'.join(read(src / f) for f in data_files)
code_js = '\n'.join(read(src / f) for f in code_files)
for name, text in (('data', data_js), ('code', code_js)):
    if '</script' in text.lower():
        sys.exit(f'В {name}-части встретилось «</script» — экранируйте его.')

boot = '''(function(){
  var LOCKED_HASH = '%s';
  var page = document.getElementById('page');
  function run(code){ var s = document.createElement('script'); s.textContent = code; document.body.appendChild(s); }
  function start(code){ if (code) run(code); run(document.getElementById('ma-app').textContent); }
  var MA = window.MA;
  window.MA_STATE = {auth: 'none'};
  if (MA) MA.mount(document.querySelectorAll('[data-ma-acct]'));
  if (!MA || !MA.signedIn() || !LOCKED_HASH) { start(null); return; }
  window.MA_STATE.auth = 'loading';
  page.innerHTML = '<div class="boot">Загружаю закрытые темы…</div>';
  MA.loadLocked('farma', LOCKED_HASH).then(function(r){
    window.MA_STATE.auth = r.status === 'ok' ? 'ok' : (r.status === 'signed-out' ? 'none' : 'error');
    page.innerHTML = ''; start(r.code);
  });
})();''' % locked_hash

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
<div class="mbar" lang="ru"><a href="#">Атлас фармакологии</a><div class="acct" data-ma-acct="compact"></div><button type="button" id="menuBtn" aria-expanded="false" aria-controls="rail"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>Листы</button></div>
<div class="scrim" id="scrim"></div>
<div class="app" lang="ru">
  <aside class="rail" id="rail">
    <a class="brand" href="#"><b>Атлас фармакологии</b><span>3 курс · лечебный факультет</span></a>
    <div class="acct" data-ma-acct></div>
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
<script src="../auth/config.js"></script>
<script src="../auth/auth.js"></script>
<script>
{data_js}
</script>
<script type="text/plain" id="ma-app">
{code_js}
</script>
<script>
{boot}
</script>
</body>
</html>
'''
(root / 'index.html').write_text(html, encoding='utf-8')
print('index.html', len(html.encode('utf-8')) // 1024, 'KB')
if locked_js:
    print('закрытая часть', len(locked_js.encode('utf-8')) // 1024, 'KB →', content_out.relative_to(repo), 'hash', locked_hash)
