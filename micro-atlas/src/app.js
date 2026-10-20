/* ===== Атлас: интерфейс =====
   Один лист на экране. Маршруты: #g1…#g10, #p1…#p12, #pathogens, #questions, #learn.
   Данные берутся из TH, PG, QS (см. core.js). */

const BLOCKS = [
  {id:'gen', rom:'I',  title:'Общая микробиология',  short:'Строение, физиология, генетика и экология микроорганизмов; препараты и механизмы повреждения'},
  {id:'prv', rom:'II', title:'Частная микробиология', short:'Возбудители по группам заболеваний и принципы их лабораторной диагностики'}
];

const SUBJECT_ACCESS = !!window.MA?.hasAtlasAccess('micro');
const TMAP = {}, PMAP = {};
TH.forEach(t => TMAP[t.id] = t);
PG.forEach(p => PMAP[p.id] = p);

const TOPICS   = BLOCKS.map(b => TH.filter(t => t.blk === b.id).sort((a,b2) => a.no - b2.no));
const TORDER   = TOPICS[0].concat(TOPICS[1]);
const QBLK     = {gen: QS.filter(q => q.blk === 'gen'), prv: QS.filter(q => q.blk === 'prv')};
const QBYTOPIC = {};
QS.forEach(q => q.th.forEach(id => (QBYTOPIC[id] = QBYTOPIC[id] || []).push(q)));
const QBYPG    = {};
QS.forEach(q => q.pg.forEach(id => (QBYPG[id] = QBYPG[id] || []).push(q)));

/* ---------- память браузера: только мелкие удобства, всё в try/catch ---------- */
const LS = {
  get(k){ try { return localStorage.getItem('micro.' + k); } catch (e) { return null; } },
  set(k, v){ try { localStorage.setItem('micro.' + k, v); } catch (e) {} },
  json(k, d){ try { return JSON.parse(localStorage.getItem('micro.' + k)) || d; } catch (e) { return d; } }
};

/* ---------- расположение клеток в мазке: схема ---------- */
const FV = {
  'clusters':    ['гроздья', '<circle cx="12" cy="13" r="4.2"/><circle cx="19.5" cy="7.4" r="4.2"/><circle cx="20" cy="18.6" r="4.2"/><circle cx="27" cy="13" r="4.2"/><circle cx="34.5" cy="7.8" r="4.2"/><circle cx="35" cy="18.4" r="4.2"/><circle cx="41.5" cy="13" r="4.2"/>'],
  'chains':      ['цепочки', '<circle cx="8" cy="13" r="4.3"/><circle cx="16.5" cy="13" r="4.3"/><circle cx="25" cy="13" r="4.3"/><circle cx="33.5" cy="13" r="4.3"/><circle cx="42" cy="13" r="4.3"/>'],
  'long-chains': ['длинные извитые цепочки', '<circle cx="6" cy="16" r="3.2"/><circle cx="12.4" cy="13" r="3.2"/><circle cx="18.8" cy="11" r="3.2"/><circle cx="25.2" cy="11.6" r="3.2"/><circle cx="31.6" cy="14" r="3.2"/><circle cx="38" cy="16" r="3.2"/><circle cx="44" cy="15" r="3.2"/>'],
  'pairs':       ['пары', '<circle cx="14" cy="13" r="4.6"/><circle cx="23.4" cy="13" r="4.6"/><circle cx="32.6" cy="13" r="4.6" opacity=".35"/>'],
  'lancet':      ['ланцетовидные диплококки в капсуле', '<ellipse cx="19" cy="13" rx="5.6" ry="4.3"/><ellipse cx="29" cy="13" rx="5.6" ry="4.3"/><rect x="11.5" y="5.4" width="25" height="15.2" rx="7.6" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2.5 2.5" opacity=".6"/>'],
  'cocci-small': ['мелкие кокки поодиночке', '<circle cx="11" cy="9" r="2.7"/><circle cx="21" cy="17" r="2.7"/><circle cx="30" cy="8.5" r="2.7"/><circle cx="38" cy="16" r="2.7"/><circle cx="25" cy="7" r="2.7" opacity=".45"/>'],
  'tetrads':     ['тетрады', '<circle cx="19" cy="8.6" r="4.1"/><circle cx="27.6" cy="8.6" r="4.1"/><circle cx="19" cy="17.4" r="4.1"/><circle cx="27.6" cy="17.4" r="4.1"/>'],
  'coryne':      ['V- и L-формы, «китайские иероглифы»', '<rect x="8" y="11.4" width="15" height="3.4" rx="1.7" transform="rotate(-34 15.5 13)"/><rect x="14" y="11.4" width="15" height="3.4" rx="1.7" transform="rotate(34 21.5 13)"/><rect x="30" y="11.4" width="14" height="3.4" rx="1.7"/><rect x="30" y="5" width="3.4" height="9" rx="1.7"/>'],
  'short-rods':  ['короткие палочки', '<rect x="7" y="11" width="11" height="4.4" rx="2.2"/><rect x="21" y="11" width="11" height="4.4" rx="2.2"/><rect x="35" y="11" width="11" height="4.4" rx="2.2"/>'],
  'thick-rods':  ['крупные палочки с обрубленными концами', '<rect x="6" y="9" width="12.5" height="8" rx="1"/><rect x="20" y="9" width="12.5" height="8" rx="1"/><rect x="34" y="9" width="12.5" height="8" rx="1"/>'],
  'chain-box':   ['стрептобациллы: цепочка палочек', '<rect x="5" y="10" width="9.5" height="6" rx="1.4"/><rect x="15.5" y="10" width="9.5" height="6" rx="1.4"/><rect x="26" y="10" width="9.5" height="6" rx="1.4"/><rect x="36.5" y="10" width="9.5" height="6" rx="1.4"/>'],
  'spore-sub':   ['спора субтерминально', '<rect x="9" y="9.6" width="30" height="7" rx="3.5"/><ellipse cx="32" cy="13.1" rx="4.6" ry="3.4" fill="var(--sheet)"/><ellipse cx="32" cy="13.1" rx="4.6" ry="3.4" fill="none" stroke="currentColor" stroke-width="1.1"/>'],
  'spore-term':  ['спора терминально, «барабанная палочка»', '<rect x="7" y="10.4" width="26" height="5.4" rx="2.7"/><circle cx="37" cy="13" r="6.2" fill="var(--sheet)"/><circle cx="37" cy="13" r="6.2" fill="none" stroke="currentColor" stroke-width="1.3"/>'],
  'branch':      ['ветвящиеся нити (псевдомицелий)', '<path d="M5 20 C14 20 16 9 25 9 C32 9 36 6 44 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M16 15 C20 15 23 20 30 21" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M28 9 C33 11 36 17 42 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'],
  'druse':       ['друзы с радиальными «колбами»', '<circle cx="24" cy="13" r="5.4"/><g stroke="currentColor" stroke-width="1.6"><path d="M24 7.6V3"/><path d="M24 18.4V23"/><path d="M18.6 13H14"/><path d="M29.4 13H34"/><path d="M20.2 9.2 17 6"/><path d="M27.8 16.8 31 20"/><path d="M27.8 9.2 31 6"/><path d="M20.2 16.8 17 20"/></g><g><circle cx="24" cy="2.4" r="1.9"/><circle cx="24" cy="23.6" r="1.9"/><circle cx="12.8" cy="13" r="1.9"/><circle cx="35.2" cy="13" r="1.9"/><circle cx="16" cy="5.2" r="1.9"/><circle cx="32" cy="20.8" r="1.9"/><circle cx="32" cy="5.2" r="1.9"/><circle cx="16" cy="20.8" r="1.9"/></g>'],
  'bifid':       ['раздвоенные концы, Y-формы', '<path d="M8 19 L18 13 M18 13 L26 8 M18 13 L26 17" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M30 20 L38 15 M38 15 L45 11 M38 15 L45 19" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>']
};
const ST = {ziehl:'по Цилю—Нильсену', neisser:'по Нейссеру', romanowsky:'по Романовскому—Гимзе', silver:'импрегнация серебром'};

/* ---------- мелкие помощники разметки ---------- */
function isLat(s){ return /^[A-Za-z]/.test(String(s || '')); }
function pname(p){ return isLat(p.n) ? '<i>' + esc(p.n) + '</i>' : esc(p.n); }
function gtag(p){
  const g = GRAM[p.gr];
  return g ? '<span class="tag ' + g[1] + '">' + g[0] + '</span>' : '';
}
function tagRow(p){
  let h = gtag(p);
  (p.tags || []).forEach(t => { if (PTAGS[t]) h += '<span class="tag">' + PTAGS[t] + '</span>'; });
  return h;
}
function fieldHtml(v){
  if (Array.isArray(v)) return '<ul>' + v.map(x => '<li>' + lat(x) + '</li>').join('') + '</ul>';
  return '<p>' + lat(v) + '</p>';
}

/* ---------- содержимое листа темы ---------- */
function figHead(title, no){
  return '<div class="fig-head"><h4>' + lat(title) + '</h4>' + (no ? '<span class="blk-no">' + no + '</span>' : '') + '</div>';
}
function blocksHtml(t){
  let fig = 0;
  return t.blocks.map(b => {
    switch (b.t){

      case 'h':
        return '<h2 class="sec">' + lat(b.text) + '</h2>';

      case 'list':
        return '<div class="klist">' + (b.title ? '<h3>' + lat(b.title) + '</h3>' : '') +
          '<' + (b.ord ? 'ol' : 'ul') + '>' + b.items.map(x => '<li>' + lat(x) + '</li>').join('') +
          '</' + (b.ord ? 'ol' : 'ul') + '></div>';

      case 'table':
        fig++;
        return '<div class="fig">' + figHead(b.title, t.no + '.' + fig) +
          '<div class="tbl"><table><thead><tr>' + b.head.map(h => '<th>' + lat(h) + '</th>').join('') +
          '</tr></thead><tbody>' + b.rows.map(r => '<tr>' + r.map(c => '<td>' + lat(c) + '</td>').join('') + '</tr>').join('') +
          '</tbody></table></div>' + (b.cap ? '<p class="fig-cap">' + lat(b.cap) + '</p>' : '') + '</div>';

      case 'cols':
        fig++;
        return '<div class="fig">' + figHead(b.title, t.no + '.' + fig) +
          '<div class="kcols"' + (b.cmin ? ' style="--cmin:' + b.cmin + 'px"' : '') + '>' +
          b.cols.map(c => '<div class="kcol' + (c.c ? ' c-' + c.c : '') + '"><h5>' + lat(c.h) + '</h5>' +
            (c.s ? '<small>' + lat(c.s) + '</small>' : '') +
            '<ul>' + (c.items || []).map(x => '<li>' + lat(x) + '</li>').join('') + '</ul></div>').join('') +
          '</div>' + (b.cap ? '<p class="fig-cap">' + lat(b.cap) + '</p>' : '') + '</div>';

      case 'flow':
        fig++;
        return '<div class="fig">' + figHead(b.title, t.no + '.' + fig) +
          '<div class="kfl">' + b.rows.map(r => {
            const st = r.s.map((x, i) => (i === r.s.length - 1 ? '<b>' + lat(x) + '</b>' : '<span>' + lat(x) + '</span>'));
            return '<div class="kfr">' + (r.h ? '<h5>' + lat(r.h) + '</h5>' : '') +
              '<div class="cf">' + st.join('<i>→</i>') + '</div></div>';
          }).join('') + '</div>' +
          (b.cap ? '<p class="fig-cap">' + lat(b.cap) + '</p>' : '') + '</div>';

      case 'warn':
        return '<div class="kwarn' + (b.k ? ' ' + b.k : '') + '"><b>' + esc(b.title || 'Важно') + '</b><p>' + lat(b.text) + '</p></div>';

      case 'todo':
        return '<div class="todo"><b>' + esc(b.title || 'Что добавить') + '</b><ul>' +
          b.items.map(x => '<li>' + lat(x) + '</li>').join('') + '</ul></div>';

      case 'pg': {
        const rows = (b.ids || []).filter(id => PMAP[id]);
        if (!rows.length) return '<div class="kwarn"><b>' + esc(b.title || 'Досье возбудителей') + '</b><p>Подробные досье относятся к полной версии микробиологии.</p></div>';
        return '<h2 class="sec">' + esc(b.title || 'Возбудители темы') + '</h2>' +
          '<p class="cnt">' + rows.length + ' ' + plural(rows.length, 'карточка', 'карточки', 'карточек') + ' — нажмите, чтобы открыть досье</p>' +
          '<div class="pglist">' + rows.map(id => pgRow(PMAP[id])).join('') + '</div>';
      }

      default: return '';
    }
  }).join('');
}

function pgRow(p){
  return '<button class="pgrow" data-pg="' + p.id + '">' +
    '<b>' + pname(p) + (p.ru && p.ru !== p.n ? '<em>' + esc(p.ru) + '</em>' : '') + '</b>' +
    '<span class="d">' + lat(p.sum || '') + '</span>' +
    '<span class="m">' + gtag(p) + '</span></button>';
}

function lockedPage(title){
  return '<p class="eyebrow">Полная микробиология</p><h1 class="title">' + esc(title) + '</h1>' +
    '<div class="kwarn"><b>Этот материал входит в подписку «Микробиология»</b><p>Продажи подписок ещё не открыты. Пока доступны два базовых конспекта; регистрация не открывает остальные материалы.</p></div>' +
    '<div class="acts"><a class="btn pri" href="#g1">Морфология микроорганизмов</a><a class="btn" href="#g2">Физиология микроорганизмов</a><a class="btn" href="../#atlases">Все предметы</a></div>';
}
function syncProgress(r){
  if (!window.MAP) return;
  const done = LS.json('read', {});
  MAP.sections('micro', TH.map(t=>({id:t.id,n:t.title,sub:'Микробиология',total:1,learned:!t.locked&&done[t.id]?1:0,seen:!t.locked&&done[t.id]?1:0,locked:!!t.locked&&!SUBJECT_ACCESS})));
  if (r.v === 'topic' && !r.t.locked) MAP.last({atlas:'micro',title:r.t.title,sub:'Микробиология',url:new URL('#'+r.t.id, location.href).href});
}

/* ---------- лист темы ---------- */
function topicPage(t){
  if (t.locked) return lockedPage(t.title);
  const blk = BLOCKS.find(b => b.id === t.blk);
  const i = TORDER.indexOf(t);
  const prev = TORDER[i - 1], next = TORDER[i + 1];
  const qs = QBYTOPIC[t.id] || [];

  let h = '<p class="eyebrow">Блок <span class="roman">' + blk.rom + '</span> · ' + esc(blk.title) + ' · лист ' + t.no + '</p>' +
    '<h1 class="title">' + lat(t.title) + '</h1>' +
    (t.lead ? '<p class="lede">' + lat(t.lead) + '</p>' : '') +
    (t.short ? '<p class="ksrc">' + lat(t.short) + '</p>' : '');

  if (qs.length) h += '<div class="acts"><a class="btn" href="#questions/' + t.id + '">' +
    qs.length + ' ' + plural(qs.length, 'вопрос', 'вопроса', 'вопросов') + ' экзамена по листу</a></div>';

  h += blocksHtml(t);
  h += '<div class="acts"><button class="btn pri" data-read="' + t.id + '">' + (LS.json('read', {})[t.id] ? 'Изучено · снять отметку' : 'Отметить конспект изученным') + '</button></div>';

  h += '<nav class="pager">' +
    (prev ? '<a href="#' + prev.id + '"><small>Предыдущий лист</small><b>' + lat(prev.title) + '</b></a>' : '<span></span>') +
    (next ? '<a class="nx" href="#' + next.id + '"><small>Следующий лист</small><b>' + lat(next.title) + '</b></a>' : '') +
    '</nav>';
  return h;
}

/* ---------- главная ---------- */
function homePage(){
  const filled = PG.filter(p => PCORE.every(k => p[k] && p[k].length)).length;
  const learned = (() => {
    const st = LS.json('srs', {});
    return Object.keys(st).filter(id => (st[id].b || 0) >= 3).length;
  })();

  let h = '<section class="hero"><h1>Атлас <em>микробиологии</em></h1>' +
    '<p>Конспекты по общей и частной микробиологии, досье возбудителей и вопросы для подготовки к экзамену.</p></section>';

  if (!SUBJECT_ACCESS) h += '<div class="kwarn"><b>Пробная версия · два базовых конспекта</b><p>Морфология и физиология микроорганизмов доступны без подписки. Остальные темы, досье и тренажёр входят в полную версию; продажи подписок ещё не открыты.</p></div>';
  if (window.MICRO_LOAD_ERROR) h += '<p class="kwarn" role="status">Не удалось проверить полный доступ. Пробные конспекты доступны. <button class="btn" data-reload>Повторить</button></p>';
  h += '<div class="stats">' +
    stat(TH.length, 'листа атласа') +
    stat(MICRO_CATALOG.pathogens, 'досье в полной версии', PG.length ? filled / PG.length : null, SUBJECT_ACCESS ? 'Доступны все досье' : 'Доступ по подписке') +
    stat(MICRO_CATALOG.questions, 'вопросов в полной версии', null, SUBJECT_ACCESS ? 'Доступны все вопросы' : 'Доступ по подписке') +
    stat(learned, 'выучено в тренажёре', PG.length ? learned / PG.length : null) +
    '</div>';

  BLOCKS.forEach((b, bi) => {
    h += '<h2 class="sec">Блок ' + b.rom + ' · ' + esc(b.title) + '</h2>' +
      '<p class="par">' + esc(b.short) + '</p><div class="cards2">' +
      TOPICS[bi].map(t => {
        const q = (QBYTOPIC[t.id] || []).length;
        return '<a class="hcard" href="#' + t.id + '"><b>' + t.no + '. ' + lat(t.title) + '</b>' +
          '<span>' + lat(t.short || '') + '</span>' +
          '<small>' + (t.locked ? (SUBJECT_ACCESS ? 'Открыть конспект' : 'По подписке') : window.MICRO_FULL ? q + ' ' + plural(q, 'вопрос', 'вопроса', 'вопросов') : 'Бесплатный конспект') + '</small></a>';
      }).join('') + '</div>';
  });

  h += '<h2 class="sec">Как устроен атлас</h2>' +
    '<div class="klist"><h3>Четыре входа в содержание</h3><ul>' +
    '<li><b>Листы</b> — теория по темам программы. Таблицы и схемы пронумерованы (например, <span class="blk-no">8.3</span>), поэтому на них удобно ссылаться, когда просите что-то дополнить или исправить.</li>' +
    '<li><b>Возбудители</b> — 103 досье по одной схеме: морфология, физиология, культивирование, экология, эпидемиология, факторы вирулентности, заболевания, диагностика, лечение, роль в полости рта, на что ловят.</li>' +
    '<li><b>Вопросы</b> — все билеты с привязкой к листам и возбудителям: видно, что именно читать под конкретный вопрос.</li>' +
    '<li><b>Учить</b> — карточки по возбудителям с интервальным повторением; прогресс хранится в этом браузере.</li></ul></div>' +
    '<div class="kwarn"><b>Чего в атласе пока нет</b><p>Это костяк. Рисунки из методичек не воспроизведены, часть полей досье пуста, в конце каждого листа перечислено, что стоит добавить. Места, где в конспекте-источнике есть ошибки, помечены как «Неточность в конспекте» — их стоит перепроверить перед экзаменом.</p></div>';
  return h;
}
function stat(n, label, frac, note){
  return '<div class="stat"><b>' + n + '</b><span>' + esc(label) + '</span>' +
    (frac != null ? '<div class="bar"><i style="width:' + Math.round(frac * 100) + '%"></i></div>' : '') +
    (note ? '<span style="margin-top:6px;display:block">' + esc(note) + '</span>' : '') + '</div>';
}

/* ---------- каталог возбудителей ---------- */
const CAT = {q:'', grp:'', tag:''};
function catalogPage(){
  if (!window.MICRO_FULL) return lockedPage('Досье возбудителей');
  const q = CAT.q.trim().toLowerCase();
  const list = PG.filter(p => {
    if (CAT.grp && p.grp !== CAT.grp) return false;
    if (CAT.tag && !(p.tags || []).includes(CAT.tag)) return false;
    if (!q) return true;
    return [p.n, p.ru, p.syn, p.sum, p.sp, p.tax].some(v => v && String(v).toLowerCase().includes(q));
  });

  let h = '<p class="eyebrow">Справочник</p><h1 class="title">Возбудители</h1>' +
    '<p class="lede">Досье построены по схеме экзаменационного ответа. Пустые поля помечены — их можно заполнить позже.</p>' +
    '<div class="search" style="max-width:420px;margin:16px 0 4px">' + searchSvg() +
    '<input id="catq" type="search" placeholder="Название, синоним, болезнь" value="' + esc(CAT.q) + '"></div>';

  h += '<div class="chips">' + chip('Все группы', !CAT.grp, 'grp', '', PG.length) +
    PGROUPS.map(g => {
      const n = PG.filter(p => p.grp === g[0]).length;
      return n ? chip(g[1], CAT.grp === g[0], 'grp', g[0], n) : '';
    }).join('') + '</div>';

  h += '<div class="chips">' + chip('Без фильтра', !CAT.tag, 'tag', '', null) +
    Object.keys(PTAGS).map(k => {
      const n = PG.filter(p => (p.tags || []).includes(k)).length;
      return n ? chip(PTAGS[k], CAT.tag === k, 'tag', k, n) : '';
    }).join('') + '</div>';

  h += '<p class="cnt">' + (list.length ? list.length + ' ' + plural(list.length, 'досье', 'досье', 'досье') : 'Ничего не найдено — измените фильтр') + '</p>';

  PGROUPS.forEach(g => {
    const part = list.filter(p => p.grp === g[0]);
    if (!part.length) return;
    h += '<h3 class="az">' + esc(g[1]) + '</h3><div class="pglist">' + part.map(pgRow).join('') + '</div>';
  });
  return h;
}
function chip(label, on, kind, val, n){
  return '<button class="chip' + (on ? ' on' : '') + '" data-f="' + kind + '" data-v="' + val + '">' + esc(label) +
    (n != null ? '<span class="c">' + n + '</span>' : '') + '</button>';
}
function searchSvg(){
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
}

/* ---------- досье ---------- */
let dzOpen = null, dzReturn = null;
function dossierHtml(p){
  const isV = p.gr === 'вирус' || p.gr === 'прион';
  let h = '<div class="dz-body"><h2>' + pname(p) + '</h2>';
  if (p.ru && p.ru !== p.n) h += '<p class="dz-ru">' + esc(p.ru) + '</p>';
  if (p.sp) h += '<p class="dz-ru">Вид по ICTV: ' + lat(p.sp) + '</p>';
  if (p.syn) h += '<p class="dz-ru">Прежние и синонимичные названия: ' + lat(p.syn) + '</p>';
  if (p.tax) h += '<p class="dz-tax">' + lat(p.tax) + '</p>';

  h += '<div class="chips" style="margin:14px 0 0">' + tagRow(p) +
    (p.o2 && p.o2 !== '—' ? '<span class="tag">' + esc(p.o2) + '</span>' : '') +
    (p.st && ST[p.st] ? '<span class="tag">окраска ' + esc(ST[p.st]) + '</span>' : '') + '</div>';

  if (p.sum) h += '<p class="dz-sum">' + lat(p.sum) + '</p>';

  if (p.fv && FV[p.fv]){
    const g = GRAM[p.gr];
    h += '<figure class="fvg' + (g ? ' ' + g[1] : '') + '"><svg viewBox="0 0 52 26" aria-hidden="true">' + FV[p.fv][1] + '</svg>' +
      '<figcaption>В мазке: ' + esc(FV[p.fv][0]) + '</figcaption></figure>';
  }

  PFIELDS.forEach(f => {
    const key = f[0], v = p[key];
    const has = v && v.length;
    if (!has && PCORE.indexOf(key) < 0) return;
    const label = (isV && PFIELDS_V[key]) ? PFIELDS_V[key] : f[1];
    h += '<section class="dz-sec"><h3>' + esc(label) + '</h3>' +
      (has ? fieldHtml(v) : '<p class="empty">Поле не заполнено. Подсказка: ' + esc(f[2]) + '</p>') + '</section>';
  });

  const qs = QBYPG[p.id] || [];
  if (qs.length){
    h += '<section class="dz-sec"><h3>Вопросы экзамена</h3><ul>' +
      qs.map(q => '<li><b>' + (q.blk === 'gen' ? 'Общая' : 'Частная') + ' ' + q.no + '.</b> ' + lat(q.text) + '</li>').join('') +
      '</ul></section>';
  }
  const ts = TH.filter(t => (t.blocks || []).some(b => b.t === 'pg' && (b.ids || []).includes(p.id)));
  if (ts.length){
    h += '<section class="dz-sec"><h3>Листы атласа</h3><div class="chips">' +
      ts.map(t => '<a class="chip" href="#' + t.id + '" data-close="1">' + lat(t.title) + '</a>').join('') + '</div></section>';
  }
  return h + '</div>';
}
function openDossier(id, keepReturn){
  const p = PMAP[id];
  if (!p) return;
  const host = document.getElementById('dz');
  host.innerHTML = '<div class="dz"><div class="dz-scrim" data-x="1"></div>' +
    '<div class="dz-panel" role="dialog" aria-modal="true" aria-label="Досье: ' + esc(p.n) + '" tabindex="-1">' +
    '<div class="dz-top"><button class="dz-x" data-x="1" aria-label="Закрыть досье">&times;</button></div>' +
    dossierHtml(p) + '</div></div>';
  dzOpen = id;
  document.documentElement.style.overflow = 'hidden';
  const panel = host.querySelector('.dz-panel');
  if (panel) panel.focus();
  if (!keepReturn) dzReturn = location.hash || '#';
  try { history.replaceState(null, '', '#pathogens/' + id); } catch (e) {}
}
function closeDossier(){
  document.getElementById('dz').innerHTML = '';
  document.documentElement.style.overflow = '';
  dzOpen = null;
  const back = dzReturn; dzReturn = null;
  if (back && back !== location.hash) location.hash = back;
  else try { history.replaceState(null, '', '#pathogens'); } catch (e) {}
}

/* ---------- вопросы ---------- */
const QF = {q:'', blk:'', topic:''};
function questionsPage(){
  if (!window.MICRO_FULL) return lockedPage('Вопросы экзамена');
  const q = QF.q.trim().toLowerCase();
  const list = QS.filter(x => {
    if (QF.blk && x.blk !== QF.blk) return false;
    if (QF.topic && !x.th.includes(QF.topic)) return false;
    return !q || x.text.toLowerCase().includes(q);
  });
  const t = QF.topic ? TMAP[QF.topic] : null;

  let h = '<p class="eyebrow">Справочник</p><h1 class="title">Вопросы экзамена</h1>' +
    '<p class="lede">205 вопросов из файла с ответами. У каждого — лист атласа, с которого стоит начать, и возбудители, которых обычно просят разобрать в ответе.</p>' +
    '<div class="search" style="max-width:420px;margin:16px 0 4px">' + searchSvg() +
    '<input id="qq" type="search" placeholder="Поиск по формулировке" value="' + esc(QF.q) + '"></div>' +
    '<div class="chips">' + chip('Все', !QF.blk, 'qblk', '', QS.length) +
    chip('Общая', QF.blk === 'gen', 'qblk', 'gen', QBLK.gen.length) +
    chip('Частная', QF.blk === 'prv', 'qblk', 'prv', QBLK.prv.length) +
    (t ? '<button class="chip on" data-f="qtopic" data-v="">Лист: ' + lat(t.title) + ' ×</button>' : '') +
    '</div><p class="cnt">' + list.length + ' ' + plural(list.length, 'вопрос', 'вопроса', 'вопросов') + '</p>';

  let cur = '';
  h += '<div class="pglist">';
  list.forEach(x => {
    if (x.blk !== cur){
      cur = x.blk;
      h += '<div class="qhead">' + (cur === 'gen' ? 'Общая микробиология' : 'Частная микробиология') + '</div>';
    }
    const ths = x.th.map(id => TMAP[id]).filter(Boolean);
    h += '<button class="qrow" data-q="' + x.blk + x.no + '" aria-expanded="false">' +
      '<span class="n">' + x.no + '</span><span class="t">' + lat(x.text) + '</span>' +
      '<span class="w">' + (ths.length ? 'лист ' + ths.map(o => o.no).join(', ') : '—') + '</span></button>' +
      '<div class="qdet" id="d' + x.blk + x.no + '" hidden><div class="chips">' +
      ths.map(o => '<a class="chip" href="#' + o.id + '">' + o.no + '. ' + lat(o.title) + '</a>').join('') +
      x.pg.filter(id => PMAP[id]).map(id => '<button class="chip" data-pg="' + id + '">' + pname(PMAP[id]) + '</button>').join('') +
      '</div></div>';
  });
  return h + '</div>';
}

/* ---------- учить ---------- */
const BOX = [0, 1, 3, 7, 21, 60];
const today = () => Math.floor(Date.now() / 86400000);
let learnCard = null, learnShown = false;
function srs(){ return LS.json('srs', {}); }
function dueList(){
  const st = srs(), d = today();
  return PG.filter(p => { const s = st[p.id]; return !s || (s.d || 0) <= d; });
}
function learnPage(){
  if (!window.MICRO_FULL) return lockedPage('Учить возбудителей');
  const st = srs(), due = dueList();
  const known = PG.filter(p => (st[p.id] || {}).b >= 3).length;

  let h = '<p class="eyebrow">Тренажёр</p><h1 class="title">Учить возбудителей</h1>' +
    '<p class="lede">Название на карточке — что должно всплывать в памяти. Ответ: ключевая роль, заболевания и факторы вирулентности. Интервалы повторения растут: 1 → 3 → 7 → 21 → 60 дней.</p>' +
    '<div class="stats"><div class="stat"><b>' + due.length + '</b><span>к повторению сегодня</span></div>' +
    '<div class="stat"><b>' + known + '</b><span>в долгих интервалах</span><div class="bar"><i style="width:' +
    Math.round(known / PG.length * 100) + '%"></i></div></div></div>';

  if (!due.length){
    h += '<div class="card"><div class="q">На сегодня всё</div><div class="a">Карточки вернутся по расписанию. Можно пройти колоду ещё раз, не меняя интервалы.</div></div>' +
      '<div class="acts"><button class="btn" data-l="again">Пройти заново</button><button class="btn" data-l="reset">Сбросить прогресс</button></div>';
    return h;
  }
  if (!learnCard || !due.some(p => p.id === learnCard)) learnCard = due[Math.floor(Math.random() * due.length)].id;
  const p = PMAP[learnCard];
  const box = (st[p.id] || {}).b || 0;

  h += '<div class="card"><div class="meta">' + (GRAM[p.gr] ? GRAM[p.gr][0] : '') + ' · ' +
    (box ? 'интервал ' + BOX[Math.min(box, 5)] + ' дн.' : 'новая карточка') + '</div>' +
    '<div class="q">' + pname(p) + '</div>';
  if (learnShown){
    const extra = p.nb ? '<br><br>На чём ловят: ' + lat(p.nb)
      : (p.dis && p.dis.length ? '<br><br>' + lat(Array.isArray(p.dis) ? p.dis[0] : p.dis) : '');
    h += '<div class="a">' + (p.ru && p.ru !== p.n ? '<b>' + esc(p.ru) + '</b><br>' : '') +
      lat(p.sum || '') + extra + '</div>' +
      '<div class="acts"><button class="btn" data-l="0">Не помню</button><button class="btn" data-l="1">Почти</button>' +
      '<button class="btn pri" data-l="2">Знаю</button></div>' +
      '<button class="btn" data-pg="' + p.id + '" style="margin-top:4px">Открыть досье</button>';
  } else {
    h += '<div class="acts"><button class="btn pri" data-l="show">Показать ответ</button>' +
      '<button class="btn" data-l="skip">Другая карточка</button></div>';
  }
  return h + '</div>';
}
function grade(g){
  if (!window.MICRO_FULL || !PMAP[learnCard]) return;
  const st = srs(), cur = st[learnCard] || {b:0};
  if (window.MAP) MAP.card({atlas:'micro', ok:g === 2});
  let b = cur.b || 0, d = today();
  if (g === 0) b = 0;                                 /* не помню — вернётся сегодня же */
  else if (g === 1) d += Math.max(1, BOX[b]);         /* почти — тот же интервал */
  else { b = Math.min(5, b + 1); d += BOX[b]; }       /* знаю — интервал растёт */
  st[learnCard] = {b, d};
  LS.set('srs', JSON.stringify(st));
  learnCard = null; learnShown = false;
  render();
}

/* ---------- поиск по всему атласу ---------- */
function searchAll(raw){
  const q = raw.trim().toLowerCase();
  if (q.length < 2) return [];
  const out = [];
  TH.forEach(t => {
    if ((t.title + ' ' + (t.short || '')).toLowerCase().includes(q))
      out.push({h:'#' + t.id, t:t.title, s:'Лист ' + t.no + ' · ' + (t.blk === 'gen' ? 'общая' : 'частная')});
  });
  PG.forEach(p => {
    if ([p.n, p.ru, p.syn, p.sum].some(v => v && String(v).toLowerCase().includes(q)))
      out.push({pg:p.id, t:p.n, s:'Возбудитель' + (p.ru ? ' · ' + p.ru : '')});
  });
  QS.forEach(x => {
    if (x.text.toLowerCase().includes(q))
      out.push({h:'#' + (x.th[0] || 'questions'), t:x.text, s:(x.blk === 'gen' ? 'Общая' : 'Частная') + ', вопрос ' + x.no});
  });
  return out.slice(0, 30);
}
function renderResults(raw){
  const box = document.getElementById('results');
  const r = searchAll(raw);
  if (!raw.trim()){ box.innerHTML = ''; return; }
  if (!r.length){ box.innerHTML = '<p class="none">Ничего не найдено</p>'; return; }
  box.innerHTML = r.map(x =>
    '<button ' + (x.pg ? 'data-pg="' + x.pg + '"' : 'data-go="' + x.h + '"') + '><b>' + lat(x.t) + '</b><small>' + esc(x.s) + '</small></button>'
  ).join('');
}

/* ---------- навигация ---------- */
function rail(){
  let h = '<div class="site-links"><a href="../">← Все предметы</a><a href="../cabinet/">Личный кабинет</a><span data-ma-acct></span></div>' +
    '<a class="brand" href="#"><b>Атлас микробиологии</b><span>' + (SUBJECT_ACCESS ? 'Полный доступ' : 'Два базовых конспекта бесплатно') + '</span></a>' +
    '<div class="search">' + searchSvg() + '<input id="sq" type="search" placeholder="Поиск по атласу" autocomplete="off"></div>' +
    '<div class="results" id="results"></div><nav class="nav">';
  BLOCKS.forEach((b, i) => {
    h += '<section><h6>' + esc(b.title) + '</h6>' + TOPICS[i].map(t => {
      const q = (QBYTOPIC[t.id] || []).length;
      return '<a href="#' + t.id + '" data-id="' + t.id + '"><span class="n">' + t.no + '</span><span>' + lat(t.title) + '</span>' +
        (t.locked && !SUBJECT_ACCESS ? '<span class="fill" aria-label="По подписке">🔒</span>' : q ? '<span class="fill">' + q + '</span>' : '') + '</a>';
    }).join('') + '</section>';
  });
  h += '<section><h6>Справочники</h6>' +
    '<a href="#pathogens" data-id="pathogens"><span class="n">А—Я</span><span>Возбудители</span><span class="fill">' + (SUBJECT_ACCESS ? MICRO_CATALOG.pathogens : '🔒') + '</span></a>' +
    '<a href="#questions" data-id="questions"><span class="n">№</span><span>Вопросы экзамена</span><span class="fill">' + (SUBJECT_ACCESS ? MICRO_CATALOG.questions : '🔒') + '</span></a>' +
    '<a href="#learn" data-id="learn"><span class="n">↻</span><span>Учить</span></a>' +
    '</section></nav>' +
    '<div class="acts" style="margin-top:auto"><button class="btn" id="theme">Сменить тему</button></div>';
  return h;
}

function route(){
  const raw = (location.hash || '').replace(/^#/, '');
  const [head, arg] = raw.split('/');
  if (TMAP[head]) return {v:'topic', t:TMAP[head]};
  if (head === 'pathogens') return {v:'cat', arg};
  if (head === 'questions') return {v:'q', arg};
  if (head === 'learn') return {v:'learn'};
  return {v:'home'};
}

function render(){
  const r = route();
  const main = document.getElementById('main');
  let h = '';
  if (r.v === 'topic') h = topicPage(r.t);
  else if (r.v === 'cat') h = catalogPage();
  else if (r.v === 'q'){ if (r.arg && TMAP[r.arg]) QF.topic = r.arg; h = questionsPage(); }
  else if (r.v === 'learn') h = learnPage();
  else h = homePage();
  main.innerHTML = '<article class="page">' + h + '</article>';
  syncProgress(r);

  const id = r.v === 'topic' ? r.t.id : (r.v === 'cat' ? 'pathogens' : r.v === 'q' ? 'questions' : r.v === 'learn' ? 'learn' : '');
  document.querySelectorAll('.nav a').forEach(a => {
    if (a.dataset.id === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.title = (r.v === 'topic' ? r.t.title + ' — ' : '') + 'Атлас микробиологии';
  if (r.v === 'cat' && r.arg && PMAP[r.arg] && dzOpen !== r.arg) openDossier(r.arg, true);
}

/* ---------- старт ---------- */
(function init(){
  const saved = LS.get('theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);

  document.getElementById('railbox').innerHTML = rail();

  const si = document.getElementById('sq');
  si.addEventListener('input', () => renderResults(si.value));

  document.getElementById('theme').addEventListener('click', () => {
    const dark = matchMedia('(prefers-color-scheme: dark)').matches;
    const cur = document.documentElement.getAttribute('data-theme') || (dark ? 'dark' : 'light');
    const nxt = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nxt);
    LS.set('theme', nxt);
  });

  /* мобильная шторка */
  const railEl = document.querySelector('.rail'), scrim = document.getElementById('scrim');
  function drawer(on){ railEl.classList.toggle('open', on); scrim.classList.toggle('on', on); document.getElementById('burger').setAttribute('aria-expanded', String(on)); }
  document.getElementById('burger').addEventListener('click', () => drawer(!railEl.classList.contains('open')));
  scrim.addEventListener('click', () => drawer(false));

  /* один обработчик на всё */
  document.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('[data-reload]')) { location.reload(); return; }
    const read = t.closest('[data-read]');
    if (read && TMAP[read.dataset.read] && !TMAP[read.dataset.read].locked) {
      const done = LS.json('read', {});
      done[read.dataset.read] = !done[read.dataset.read];
      LS.set('read', JSON.stringify(done)); render(); return;
    }
    const pg = t.closest('[data-pg]');
    if (pg){ e.preventDefault(); openDossier(pg.dataset.pg, !!dzOpen); si.value = ''; renderResults(''); drawer(false); return; }
    if (t.closest('[data-x]')){ closeDossier(); return; }
    const go = t.closest('[data-go]');
    if (go){ location.hash = go.dataset.go; si.value = ''; renderResults(''); drawer(false); return; }
    const f = t.closest('[data-f]');
    if (f){
      const v = f.dataset.v;
      if (f.dataset.f === 'grp') CAT.grp = v;
      if (f.dataset.f === 'tag') CAT.tag = v;
      if (f.dataset.f === 'qblk') QF.blk = v;
      if (f.dataset.f === 'qtopic') QF.topic = v;
      render(); return;
    }
    const q = t.closest('[data-q]');
    if (q){
      const d = document.getElementById('d' + q.dataset.q);
      if (d){ const open = !d.hidden; d.hidden = open; q.setAttribute('aria-expanded', String(!open)); }
      return;
    }
    const l = t.closest('[data-l]');
    if (l){
      const v = l.dataset.l;
      if (v === 'show'){ learnShown = true; render(); }
      else if (v === 'skip'){ learnCard = null; learnShown = false; render(); }
      else if (v === 'again'){ LS.set('srs', JSON.stringify({})); learnCard = null; learnShown = false; render(); }
      else if (v === 'reset'){ LS.set('srs', JSON.stringify({})); learnCard = null; learnShown = false; render(); }
      else grade(Number(v));
      return;
    }
    const a = t.closest('a[href^="#"]');
    if (a){ if (dzOpen && a.dataset.close) { dzReturn = null; closeDossier(); } drawer(false); }
  });

  /* поля ввода на страницах */
  document.addEventListener('input', e => {
    if (e.target.id === 'catq'){ CAT.q = e.target.value; const v = e.target.value, pos = e.target.selectionStart; render();
      const el = document.getElementById('catq'); if (el){ el.focus(); el.value = v; try { el.setSelectionRange(pos, pos); } catch (_) {} } }
    if (e.target.id === 'qq'){ QF.q = e.target.value; const v = e.target.value, pos = e.target.selectionStart; render();
      const el = document.getElementById('qq'); if (el){ el.focus(); el.value = v; try { el.setSelectionRange(pos, pos); } catch (_) {} } }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape'){ if (dzOpen) closeDossier(); else drawer(false); }
    if (e.key === '/' && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)){ e.preventDefault(); si.focus(); }
  });

  addEventListener('hashchange', () => {
    const r = route();
    if (dzOpen && !(r.v === 'cat' && r.arg === dzOpen)){ document.getElementById('dz').innerHTML = ''; document.documentElement.style.overflow = ''; dzOpen = null; }
    render();
    if (!(r.v === 'cat' && r.arg)) scrollTo({top:0});
  });

  render();
})();
