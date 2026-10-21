/* ===== Атлас: интерфейс =====
   Одна страница на экране. Маршруты: #z1…#z7[/тема] — зачёт с обзорными главами; #g1…, #p1… — лист темы;
   #pathogens[/id], #questions[/тема|зачёт], #gallery, #learn.
   Данные берутся из ZS, ZTX, TH, PG, QS, FIG, PH (см. core.js). */

const BLOCKS = [
  {id:'gen', rom:'I',  title:'Общая микробиология',  short:'Строение, физиология, генетика и экология микроорганизмов; препараты и механизмы повреждения'},
  {id:'prv', rom:'II', title:'Частная микробиология', short:'Возбудители по группам заболеваний и принципы их лабораторной диагностики'}
];

const SUBJECT_ACCESS = !!window.MA?.hasAtlasAccess('micro');
// A topic and its demo may share figures/photos; retain one entry per source ID.
for (const list of [PG,PH,AN_LIST]) { const unique = [...new Map(list.map(x=>[x.id,x])).values()]; list.splice(0,list.length,...unique); }
const TMAP = {}, PMAP = {}, PHMAP = {};
TH.forEach(t => TMAP[t.id] = t);
PG.forEach(p => PMAP[p.id] = p);
PH.forEach(x => PHMAP[x.id] = x);

/* зачёты задают порядок тем и сквозную нумерацию; номер темы t.no — в подписях и номерах таблиц и схем */
const ZMAP = {}, TZ = {}, TORDER = [];
ZS.forEach((z, zi) => {
  z.n = zi + 1; ZMAP[z.id] = z;
  z.list = z.topics.map(id => TMAP[id]).filter(Boolean);
  z.list.forEach((t, i) => { TZ[t.id] = z; t.zi = i + 1; TORDER.push(t); t.no = TORDER.length; });
});
TH.filter(t => !TZ[t.id]).forEach(t => { TORDER.push(t); t.no = TORDER.length; });
const TOPICS = BLOCKS.map(b => TORDER.filter(t => t.blk === b.id));
/* обзорные главы: слова и время чтения (учебный темп ≈ 150 слов в минуту) */
function chWords(blocks){
  return (blocks || []).reduce((s, b) => s + [b.text, b.title,
    ...(b.items || []).map(x => Array.isArray(x) ? x.join(' ') : x),
    ...(b.rows || []).map(r => Array.isArray(r) ? r.join(' ') : (r.s || []).join(' ')),
    ...(b.cols || []).map(c => (c.items || []).join(' '))].filter(Boolean).join(' ').split(/\s+/).length, 0);
}
function readMin(id){ const c = ZTX[id]; return c ? Math.max(2, Math.round(chWords(c.blocks) / 150)) : 0; }
function zMin(z){ return z.list.reduce((a, t) => a + readMin(t.id), 0); }
function zqs(z){ return QS.filter(q => q.th.some(id => TZ[id] === z)); }
const QBYTOPIC = {}, QBYPG = {};
QS.forEach(q => q.th.forEach(id => (QBYTOPIC[id] = QBYTOPIC[id] || []).push(q)));
QS.forEach(q => q.pg.forEach(id => (QBYPG[id] = QBYPG[id] || []).push(q)));
const PHBYPG = {};
PH.forEach(x => (x.pg || []).forEach(id => (PHBYPG[id] = PHBYPG[id] || []).push(x)));
/* в каком листе стоит схема: id схемы → лист */
const FIGWHERE = {};
TH.forEach(t => t.blocks.forEach(b => { if (b.t === 'fig' && !FIGWHERE[b.id]) FIGWHERE[b.id] = t; }));
const qcount = (list, src) => list.filter(q => !src || q.src === src).length;

/* ---------- память браузера: только мелкие удобства, всё в try/catch ---------- */
const LS = {
  get(k){ try { return localStorage.getItem('micro.' + k); } catch (e) { return null; } },
  set(k, v){ try { localStorage.setItem('micro.' + k, v); } catch (e) {} },
  json(k, d){ try { return JSON.parse(localStorage.getItem('micro.' + k)) || d; } catch (e) { return d; } }
};

/* ---------- расположение клеток в мазке: маленькая схема в досье ---------- */
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
function chip(label, on, kind, val, n){
  return '<button class="chip' + (on ? ' on' : '') + '" data-f="' + kind + '" data-v="' + val + '">' + label +
    (n != null ? '<span class="c">' + n + '</span>' : '') + '</button>';
}
function searchSvg(){
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
}
function qsrcName(src){ return (QSETS[src] || {}).name || src; }
function qid(q){ return q.src + '-' + q.blk + q.no; }

/* ---------- снимки ---------- */
const PKIND = {bac:'Бактерии', fun:'Грибы', pro:'Простейшие', vir:'Вирусы', lab:'Методы и среды'};
function photoKind(x){
  if (x.kind) return x.kind;
  const p = PMAP[(x.pg || [])[0]];
  if (!p) return 'lab';
  if (p.gr === 'гриб') return 'fun';
  if (p.gr === 'прост') return 'pro';
  if (p.gr === 'вирус' || p.gr === 'прион') return 'vir';
  return 'bac';
}
function photoMeta(x){
  const macro = /^фото/i.test(x.m || '');
  return [x.m, x.st && x.st !== '—' ? 'окраска ' + x.st : '', x.x ? 'увеличение ' + x.x : (macro ? '' : 'увеличение в источнике не указано')]
    .filter(Boolean).join(' · ');
}
function photoBadge(x){
  const s = [x.stShort || x.st, x.x].filter(v => v && v !== '—').join(' · ');
  return s ? '<span class="ph-badge">' + esc(s) + '</span>' : '';
}
function photoCredit(x){
  const au = x.au ? esc(x.au) : 'автор не указан';
  return au + (x.lic ? ', ' + esc(x.lic) : '') + (x.src ? ' · <a href="' + esc(x.src) + '" target="_blank" rel="noopener">источник</a>' : '');
}
function photoCard(x, ctx){
  return '<figure class="ph"><button class="ph-img" data-lb="ph" data-ctx="' + ctx + '" data-id="' + x.id + '" aria-label="Увеличить снимок: ' + esc(x.t.replace(/[{}]/g, '')) + '">' +
    '<img src="' + esc(x.file) + '" alt="" loading="lazy" decoding="async">' + photoBadge(x) + '</button>' +
    '<figcaption><b>' + lat(x.t) + '</b>' + (x.what ? '<span class="ph-what">' + lat(x.what) + '</span>' : '') +
    '<span class="ph-meta">' + esc(photoMeta(x)) + '</span>' +
    '<span class="ph-cred">' + photoCredit(x) + '</span></figcaption></figure>';
}
function photosGrid(list, ctx){
  return '<div class="phgrid">' + list.map(x => photoCard(x, ctx)).join('') + '</div>';
}

/* ---------- схемы ---------- */
function figBody(f, big){
  if (f.svg) return '<div class="figsvg' + (f.wide ? ' wide' : '') + '">' + f.svg + '</div>';
  if (f.img) return '<div class="figimg"><img src="' + esc(f.img) + '" alt="' + esc((f.title || '').replace(/[{}]/g, '')) + '" loading="lazy" decoding="async"></div>';
  return '';
}
function figBlock(f, no){
  return '<figure class="fig figure">' + figHead(f.title, no) +
    '<button class="fig-zoom" data-lb="fig" data-id="' + f.id + '" aria-label="Открыть схему крупно">' + figBody(f) + '</button>' +
    ((f.cap || f.src) ? '<figcaption class="fig-cap">' + (f.cap ? lat(f.cap) : '') +
      (f.src ? '<span class="fig-src">' + lat(f.src) + '</span>' : '') + '</figcaption>' : '') +
    '</figure>';
}

/* ---------- содержимое листа ---------- */
function figHead(title, no){
  return '<div class="fig-head"><h4>' + lat(title) + '</h4>' + (no ? '<span class="blk-no">' + no + '</span>' : '') + '</div>';
}
function blocksHtml(t, o){
  o = o || {};
  let fig = 0;
  const num = () => t.no != null ? t.no + '.' + fig : '';
  const H = o.h || 'h2';
  return t.blocks.map(b => {
    switch (b.t){

      case 'h':
        return '<' + H + ' class="sec">' + lat(b.text) + '</' + H + '>';

      case 'dl':
        return '<div class="kdl">' + (b.title ? '<h3>' + lat(b.title) + '</h3>' : '') + '<dl>' +
          b.items.map(x => '<dt>' + lat(x[0]) + '</dt><dd>' + lat(x[1]) + '</dd>').join('') + '</dl></div>';

      case 'key':
        return '<div class="kkey"><b>' + esc(b.title || 'Главное') + '</b><ul>' + b.items.map(x => '<li>' + lat(x) + '</li>').join('') + '</ul></div>';

      case 'p':
        return '<p class="par">' + lat(b.text) + '</p>';

      case 'list':
        return '<div class="klist">' + (b.title ? '<h3>' + lat(b.title) + '</h3>' : '') +
          '<' + (b.ord ? 'ol' : 'ul') + '>' + b.items.map(x => '<li>' + lat(x) + '</li>').join('') +
          '</' + (b.ord ? 'ol' : 'ul') + '></div>';

      case 'table':
        fig++;
        return '<div class="fig">' + figHead(b.title, num()) +
          '<div class="tbl"><table><thead><tr>' + b.head.map(h => '<th>' + lat(h) + '</th>').join('') +
          '</tr></thead><tbody>' + b.rows.map(r => '<tr>' + r.map(c => '<td>' + lat(c) + '</td>').join('') + '</tr>').join('') +
          '</tbody></table></div>' + (b.cap ? '<p class="fig-cap">' + lat(b.cap) + '</p>' : '') + '</div>';

      case 'cols':
        fig++;
        return '<div class="fig">' + figHead(b.title, num()) + (b.n ? '<div class="kroot"><span>' + lat(b.n) + '</span></div>' : '') +
          '<div class="kcols"' + (b.cmin ? ' style="--cmin:' + b.cmin + 'px"' : '') + '>' +
          b.cols.map(c => '<div class="kcol' + (c.c ? ' c-' + c.c : '') + '"><h5>' + lat(c.h) + '</h5>' +
            (c.s ? '<small>' + lat(c.s) + '</small>' : '') +
            '<ul>' + (c.items || []).map(x => '<li>' + lat(x) + '</li>').join('') + '</ul></div>').join('') +
          '</div>' + (b.cap ? '<p class="fig-cap">' + lat(b.cap) + '</p>' : '') + '</div>';

      case 'flow':
        fig++;
        return '<div class="fig">' + figHead(b.title, num()) +
          '<div class="kfl">' + b.rows.map(r => {
            const st = r.s.map((x, i) => (i === r.s.length - 1 ? '<b>' + lat(x) + '</b>' : '<span>' + lat(x) + '</span>'));
            return '<div class="kfr">' + (r.h ? '<h5>' + lat(r.h) + '</h5>' : '') +
              '<div class="cf">' + st.join('<i>→</i>') + '</div></div>';
          }).join('') + '</div>' +
          (b.cap ? '<p class="fig-cap">' + lat(b.cap) + '</p>' : '') + '</div>';

      case 'fig': {
        const f = FIG[b.id];
        if (!f) return '';
        fig++;
        return AN_FIG[b.id] ? apFigHtml(b.id, num()) : figBlock(f, num());
      }

      case 'figs': {   /* две-три схемы в ряд */
        const fs = (b.ids || []).map(id => FIG[id]).filter(Boolean);
        if (!fs.length) return '';
        return '<div class="figrow">' + fs.map(f => { fig++; return AN_FIG[f.id] ? apFigHtml(f.id, num()) : figBlock(f, num()); }).join('') + '</div>';
      }

      case 'photos': {
        const list = (b.ids || []).map(id => PHMAP[id]).filter(Boolean);
        if (!list.length) return '';
        fig++;
        return '<div class="fig phblock">' + figHead(b.title || 'Микрофотографии', num()) +
          photosGrid(list, 'ids:' + list.map(x => x.id).join(',')) + (b.cap ? '<p class="fig-cap">' + lat(b.cap) + '</p>' : '') + '</div>';
      }

      case 'warn':
        return '<div class="kwarn' + (b.k ? ' ' + b.k : '') + '"><b>' + esc(b.title || 'Важно') + '</b><p>' + lat(b.text) + '</p></div>';

      case 'todo':
        return '<div class="todo"><b>' + esc(b.title || 'Что добавить') + '</b><ul>' +
          b.items.map(x => '<li>' + lat(x) + '</li>').join('') + '</ul></div>';

      case 'pg': {
        const rows = (b.ids || []).filter(id => PMAP[id]);
        if (!rows.length) return '';
        return '<h2 class="sec">' + esc(b.title || 'Возбудители темы') + '</h2>' +
          '<p class="cnt">' + rows.length + ' ' + plural(rows.length, 'карточка', 'карточки', 'карточек') + ' — нажмите, чтобы открыть досье</p>' +
          '<div class="pglist">' + rows.map(id => pgRow(PMAP[id])).join('') + '</div>';
      }

      default: return '';
    }
  }).join('');
}
/* какие наборы снимков стоят в листе: нужно лайтбоксу для листания */
function ctxList(ctx){
  if (!ctx) return [];
  const [kind, ...rest] = ctx.split(':'), a = rest.join(':');
  if (kind === 'ids') return a.split(',').map(id => PHMAP[id]).filter(Boolean);
  if (kind === 'p') return PHBYPG[a] || [];
  if (kind === 'g') return galleryList();
  return [];
}

function pgRow(p){
  const ph = (PHBYPG[p.id] || []).length;
  return '<button class="pgrow" data-pg="' + p.id + '">' +
    '<b>' + pname(p) + (p.ru && p.ru !== p.n ? '<em>' + esc(p.ru) + '</em>' : '') + '</b>' +
    '<span class="d">' + lat(p.sum || '') + '</span>' +
    '<span class="m">' + (ph ? '<span class="tag" title="микрофотографии">фото ' + ph + '</span>' : '') + gtag(p) + '</span></button>';
}

/* ---------- лист темы ---------- */
function topicPage(t){
  if(t.locked) return lockedPage(t.title);
  const blk = BLOCKS.find(b => b.id === t.blk);
  const i = TORDER.indexOf(t);
  const prev = TORDER[i - 1], next = TORDER[i + 1];
  const qs = QBYTOPIC[t.id] || [];
  const nFig = t.blocks.filter(b => b.t === 'fig').length + t.blocks.filter(b => b.t === 'figs').reduce((a, b) => a + (b.ids || []).length, 0);
  const nPh = t.blocks.filter(b => b.t === 'photos').reduce((a, b) => a + (b.ids || []).length, 0);

  const z = TZ[t.id];
  let h = '<p class="eyebrow">' + (z ? '<a class="zlink" href="#' + z.id + '">Зачёт ' + z.n + '</a> · ' : '') + 'тема ' + t.no + ' · ' + esc(blk.title) + '</p>' +
    '<h1 class="title">' + lat(t.title) + '</h1>' +
    (t.lead ? '<p class="lede">' + lat(t.lead) + '</p>' : '') +
    (t.short ? '<p class="ksrc">' + lat(t.short) + '</p>' : '');

  const done = LS.json('read', {});
  const acts = ['<button class="btn' + (done[t.id] ? ' on' : '') + '" data-read="' + t.id + '">' + (done[t.id] ? '✓ Прочитано' : 'Отметить прочитанным') + '</button>'];
  if (z && ZTX[t.id]) acts.push('<a class="btn pri" href="#' + z.id + '/' + t.id + '">Обзорная глава · ' + readMin(t.id) + ' мин</a>');
  if (qs.length) acts.push('<a class="btn" href="#questions/' + t.id + '">Вопросы по теме: ' +
    Object.keys(QSETS).map(s => qsrcName(s) + ' ' + qcount(qs, s)).join(' · ') + '</a>');
  if (nFig || nPh) acts.push('<span class="btn ghost">' + (nFig ? nFig + ' ' + plural(nFig, 'схема', 'схемы', 'схем') : '') +
    (nFig && nPh ? ' · ' : '') + (nPh ? nPh + ' ' + plural(nPh, 'снимок', 'снимка', 'снимков') : '') + '</span>');
  if (acts.length) h += '<div class="acts">' + acts.join('') + '</div>';

  h += blocksHtml(t);

  h += '<nav class="pager">' +
    (prev ? '<a href="#' + prev.id + '"><small>Предыдущая тема' + (TZ[prev.id] !== z ? ' · зачёт ' + TZ[prev.id].n : '') + '</small><b>' + prev.no + '. ' + lat(prev.title) + '</b></a>' : '<span></span>') +
    (next ? '<a class="nx" href="#' + next.id + '"><small>Следующая тема' + (TZ[next.id] !== z ? ' · зачёт ' + TZ[next.id].n : '') + '</small><b>' + next.no + '. ' + lat(next.title) + '</b></a>' : '') +
    '</nav>';
  return h;
}

/* ---------- зачёт: обзорные главы ---------- */
function clusterPage(z){
  const i = ZS.indexOf(z), prev = ZS[i - 1], next = ZS[i + 1];
  const qs = zqs(z), min = zMin(z);
  let h = '<p class="eyebrow">Зачёт <span class="roman">' + z.n + '</span> из ' + ZS.length + ' · обзорные главы</p>' +
    '<h1 class="title">' + lat(z.title) + '</h1>' +
    (z.lead ? '<p class="lede">' + lat(z.lead) + '</p>' : '');
  h += '<div class="acts">' + (qs.length ? '<a class="btn" href="#questions/' + z.id + '">Вопросы к зачёту: ' + qs.length + '</a>' : '') +
    '<span class="btn ghost">' + z.list.length + ' ' + plural(z.list.length, 'тема', 'темы', 'тем') + (min ? ' · чтение ≈ ' + min + ' мин' : '') + '</span></div>';
  h += '<div class="zhow"><b>Как работать с зачётом</b><p>Сначала прочитайте главы подряд: они объясняют, как устроен материал и почему. ' +
    'Затем открывайте лист каждой темы — там те же факты сжаты в таблицы, схемы, микрофотографии и досье возбудителей для заучивания.</p></div>';
  h += '<ol class="ztoc">' + z.list.map(t => '<li><span class="n">' + t.no + '</span>' +
    '<button class="ztoc-t" data-scroll="ch-' + t.id + '">' + lat(t.title) + '</button>' +
    '<span class="m">' + (ZTX[t.id] ? readMin(t.id) + ' мин' : '') + '</span>' +
    '<a class="ztoc-l" href="#' + t.id + '">лист темы →</a></li>').join('') + '</ol>';
  z.list.forEach(t => {
    const c = ZTX[t.id], nq = (QBYTOPIC[t.id] || []).length;
    h += '<section class="chapter" id="ch-' + t.id + '">' +
      '<p class="eyebrow">Тема ' + t.no + (c ? ' · ' + readMin(t.id) + ' мин чтения' : '') + '</p>' +
      '<h2 class="ch-title">' + lat(t.title) + '</h2>' +
      '<div class="read">' + (c ? blocksHtml({id: t.id, no: null, blocks: c.blocks}, {h: 'h3'})
        : (t.lead ? '<p class="par">' + lat(t.lead) + '</p>' : '') + '<p class="cnt">Обзорная глава по теме ещё не написана — откройте лист темы.</p>') + '</div>' +
      '<div class="acts ch-acts"><a class="btn pri" href="#' + t.id + '">Лист темы ' + t.no + ': таблицы, схемы, досье →</a>' +
      (nq ? '<a class="btn" href="#questions/' + t.id + '">Вопросы по теме: ' + nq + '</a>' : '') +
      '<button class="btn" data-scroll="ztop">К оглавлению зачёта ↑</button></div></section>';
  });
  h += '<nav class="pager">' +
    (prev ? '<a href="#' + prev.id + '"><small>Предыдущий зачёт</small><b>' + prev.n + '. ' + lat(prev.title) + '</b></a>' : '<span></span>') +
    (next ? '<a class="nx" href="#' + next.id + '"><small>Следующий зачёт</small><b>' + next.n + '. ' + lat(next.title) + '</b></a>' : '') +
    '</nav>';
  return '<div id="ztop"></div>' + h;
}

/* ---------- главная ---------- */
function homePage(){
  const filled = PG.filter(p => PCORE.every(k => p[k] && p[k].length)).length;
  const learned = (() => {
    const st = LS.json('srs', {});
    return Object.keys(st).filter(id => (st[id].b || 0) >= 3).length;
  })();
  const nFig = MICRO_CATALOG.figures;

  let h = '<section class="hero"><h1>Атлас <em>микробиологии</em></h1>' +
    '<p>Подготовка к экзамену по зачётам кафедры: ' + ZS.length + ' ' + plural(ZS.length, 'зачёт', 'зачёта', 'зачётов') + ', ' + TORDER.length + ' ' + plural(TORDER.length, 'тема', 'темы', 'тем') +
    '. У каждого зачёта — обзорные главы, которые связно объясняют материал; у каждой темы — лист для заучивания: таблицы, ' +
    nFig + ' ' + plural(nFig, 'схема', 'схемы', 'схем') + ' с подписями на русском и латыни, ' + MICRO_CATALOG.photos + ' ' + plural(MICRO_CATALOG.photos, 'микрофотография', 'микрофотографии', 'микрофотографий') +
    ' с методом, окраской и увеличением, досье возбудителей по кафедральному плану ответа и экзаменационные вопросы.</p></section>';

  h += '<div class="stats">' +
    stat(MICRO_CATALOG.pathogens, 'досье возбудителей', MICRO_CATALOG.completePathogens/MICRO_CATALOG.pathogens, MICRO_CATALOG.completePathogens+' заполнено по всем основным полям') +
    stat(MICRO_CATALOG.questions, 'вопросов экзамена', null, Object.keys(QSETS).map(s => qsrcName(s) + ': ' + MICRO_CATALOG.questionCounts[s]).join(' · ')) +
    stat(nFig + MICRO_CATALOG.photos, 'схем и снимков', null, nFig + ' схем · ' + MICRO_CATALOG.photos + ' микрофотографий') +
    stat(learned, 'выучено в тренажёре', learned / MICRO_CATALOG.pathogens) +
    '</div>';

  if (PH.length){
    const pick = PH.filter(x => photoKind(x) !== 'lab').slice(0, 4);
    h += '<a class="hstrip" href="#gallery">' + pick.map(x => '<img src="' + esc(x.file) + '" alt="" loading="lazy">').join('') +
      '<span><b>Микропрепараты</b><small>все снимки с методом, окраской и увеличением · тренажёр «узнай возбудителя»</small></span></a>';
  }

  if(!SUBJECT_ACCESS) h += '<div class="kwarn"><b>Два базовых конспекта бесплатно</b><p>Остальные материалы доступны по подписке на микробиологию. Регистрация не открывает закрытые темы.</p></div>';
  h += v7HomeCards();
  h += '<h2 class="sec">Зачёты</h2><p class="par">Порядок — как в программе кафедры. Начинайте с обзора зачёта: главы читаются за один-два вечера и дают общую картину; затем переходите к листам тем.</p>';
  ZS.forEach(z => {
    const min = zMin(z), q = zqs(z).length;
    h += '<section class="zcard"><a class="zcard-h" href="#' + z.id + '"><span class="zn">' + z.n + '</span>' +
      '<span><b>' + lat(z.title) + '</b><small>' + z.list.length + ' ' + plural(z.list.length, 'тема', 'темы', 'тем') +
      (min ? ' · обзор ≈ ' + min + ' мин чтения' : '') + (q ? ' · ' + q + ' ' + plural(q, 'вопрос', 'вопроса', 'вопросов') : '') + '</small></span>' +
      '<span class="go">Читать обзор →</span></a>' +
      (z.lead ? '<p>' + lat(z.lead) + '</p>' : '') +
      '<div class="zcard-t">' + z.list.map(t => '<a href="#' + t.id + '"><span class="n">' + t.no + '</span><span>' + lat(t.title) + '</span></a>').join('') + '</div></section>';
  });

  h += '<h2 class="sec">Как устроен атлас</h2>' +
    '<div class="klist"><h3>Восемь входов в содержание</h3><ul>' +
    '<li><b>Зачёты</b> — семь кластеров тем по программе кафедры. На странице зачёта — обзорные главы в стиле учебника: прочитайте их до заучивания, чтобы понимать логику материала.</li>' +
    '<li><b>Темы</b> — листы для заучивания: таблицы, схемы и блоки снимков пронумерованы по номеру темы (например, <span class="blk-no">12.3</span>) — по номеру удобно просить что-то дополнить или исправить. Схему и снимок можно открыть крупно.</li>' +
    '<li><b>Возбудители</b> — досье по кафедральному плану ответа: классификация, морфология, физиология, культивирование, экология, эпидемиология, факторы вирулентности, защитные реакции, чувствительность к антибиотикам, диагностика, иммунопрофилактика.</li>' +
    '<li><b>Микропрепараты</b> — все микрофотографии: метод микроскопии, окраска, увеличение и источник у каждого снимка.</li>' +
    '<li><b>Вопросы</b> — вопросы стоматологического факультета и экзаменационные вопросы ПСПбГМУ 2018 с привязкой к темам, зачётам и досье.</li>' +
    '<li><b>Учить</b> — карточки по возбудителям и тренажёр по микропрепаратам с интервальным повторением; прогресс хранится в этом браузере.</li>' + v7HomeList() + '</ul></div>' +
    '<div class="kwarn"><b>Как читать пометки</b><p>«Неточность в конспекте» — место, где конспект расходится с современными данными или нормативами; перед экзаменом сверьте формулировку с кафедрой. «Новое» — что изменилось в систематике, нормативах и лечении. «Спросят» — частый уточняющий вопрос.</p></div>';
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
  if(!SUBJECT_ACCESS && !window.MICRO_FULL) return lockedPage('Досье возбудителей');
  const q = CAT.q.trim().toLowerCase();
  const list = MICRO_CATALOG.pathogenIndex.map(p=>PMAP[p.id]||p).filter(p => {
    if (CAT.grp && p.grp !== CAT.grp) return false;
    if (CAT.tag && !(p.tags || []).includes(CAT.tag)) return false;
    if (!q) return true;
    return [p.n, p.ru, p.syn, p.sum, p.sp, p.tax].some(v => v && String(v).toLowerCase().includes(q));
  });

  let h = '<p class="eyebrow">Справочник</p><h1 class="title">Возбудители</h1>' +
    '<p class="lede">Досье построены по кафедральному плану ответа. Пустые поля помечены — их можно заполнить позже.</p>' +
    '<div class="search" style="max-width:420px;margin:16px 0 4px">' + searchSvg() +
    '<input id="catq" type="search" placeholder="Название, синоним, болезнь" value="' + esc(CAT.q) + '"></div>';

  h += '<div class="chips">' + chip('Все группы', !CAT.grp, 'grp', '', MICRO_CATALOG.pathogens) +
    PGROUPS.map(g => {
      const n = MICRO_CATALOG.pathogenIndex.map(p=>PMAP[p.id]||p).filter(p => p.grp === g[0]).length;
      return n ? chip(esc(g[1]), CAT.grp === g[0], 'grp', g[0], n) : '';
    }).join('') + '</div>';

  h += '<div class="chips">' + chip('Без фильтра', !CAT.tag, 'tag', '', null) +
    Object.keys(PTAGS).map(k => {
      const n = MICRO_CATALOG.pathogenIndex.map(p=>PMAP[p.id]||p).filter(p => (p.tags || []).includes(k)).length;
      return n ? chip(esc(PTAGS[k]), CAT.tag === k, 'tag', k, n) : '';
    }).join('') + '</div>';

  h += '<p class="cnt">' + (list.length ? list.length + ' досье' : 'Ничего не найдено — измените фильтр') + '</p>';

  PGROUPS.forEach(g => {
    const part = list.filter(p => p.grp === g[0]);
    if (!part.length) return;
    h += '<h3 class="az">' + esc(g[1]) + '</h3><div class="pglist">' + part.map(pgRow).join('') + '</div>';
  });
  return h;
}

/* ---------- досье ---------- */
let dzOpen = null, dzReturn = null;
function dossierHtml(p){
  const isV = p.gr === 'вирус' || p.gr === 'прион';
  const plan = isV ? PLAN_V : PLAN_B;
  let h = '<div class="dz-body"><p class="dz-plan">' + (isV ? 'План ответа: вирусы' : 'План ответа: бактерии, грибы, простейшие') + '</p>' +
    '<h2><span class="pn">1</span>' + pname(p) + '</h2>';
  if (p.ru && p.ru !== p.n) h += '<p class="dz-ru">' + esc(p.ru) + '</p>';
  if (p.sp) h += '<p class="dz-ru">Вид по ICTV: ' + lat(p.sp) + '</p>';
  if (p.syn) h += '<p class="dz-ru">Прежние и синонимичные названия: ' + lat(p.syn) + '</p>';
  if (p.tax) h += '<p class="dz-tax">' + lat(p.tax) + '</p>';

  h += '<div class="chips" style="margin:14px 0 0">' + tagRow(p) +
    (p.o2 && p.o2 !== '—' ? '<span class="tag">' + esc(p.o2) + '</span>' : '') +
    (p.st && ST[p.st] ? '<span class="tag">окраска ' + esc(ST[p.st]) + '</span>' : '') + '</div>';

  if (p.sum) h += '<p class="dz-sum">' + lat(p.sum) + '</p>';

  plan.forEach(row => {
    const [no, key, label, hint] = row;
    const v = p[key], has = v && v.length;
    const core = PCORE.indexOf(key) >= 0 || (no && ['cls','imm','prev'].indexOf(key) < 0);
    const photos = key === 'morph' ? (PHBYPG[p.id] || []) : [];
    if (!has && !core && !photos.length) return;
    h += '<section class="dz-sec"><h3>' + (no ? '<span class="pn">' + no + '</span>' : '') + esc(label) + '</h3>';
    if (key === 'morph' && p.fv && FV[p.fv]){
      const g = GRAM[p.gr];
      h += '<figure class="fvg' + (g ? ' ' + g[1] : '') + '"><svg viewBox="0 0 52 26" aria-hidden="true">' + FV[p.fv][1] + '</svg>' +
        '<figcaption>В мазке: ' + esc(FV[p.fv][0]) + '</figcaption></figure>';
    }
    h += has ? fieldHtml(v) : (photos.length ? '' : '<p class="empty">Не заполнено. Что сюда писать: ' + esc(hint) + '</p>');
    if (photos.length) h += photosGrid(photos, 'p:' + p.id);
    h += '</section>';
  });

  const qs = QBYPG[p.id] || [];
  if (qs.length){
    h += '<section class="dz-sec"><h3>Вопросы экзамена</h3><ul>' +
      qs.map(q => '<li><span class="tag">' + esc(qsrcName(q.src)) + '</span> <b>' + (q.blk === 'gen' ? 'Общая' : 'Частная') + ' ' + q.no + '.</b> ' + lat(q.text) + '</li>').join('') +
      '</ul></section>';
  }
  const ts = TH.filter(t => (t.blocks || []).some(b => b.t === 'pg' && (b.ids || []).includes(p.id))).sort((a, b) => a.no - b.no);
  if (ts.length){
    h += '<section class="dz-sec"><h3>Темы атласа</h3><div class="chips">' +
      ts.map(t => '<a class="chip" href="#' + t.id + '" data-close="1">' + t.no + '. ' + lat(t.title) + '</a>').join('') + '</div></section>';
  }
  return h + '</div>';
}
function openDossier(id, keepReturn){
  if(!PMAP[id] || window.MA_TOPIC!=='pg-'+id) {location.hash='pathogens/'+id;return;}

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

/* ---------- увеличенный просмотр схем и снимков ---------- */
let LB = null;   /* {items:[{html, cap}], i} */
function lbOpen(items, i){
  LB = {items, i};
  lbRender();
}
function lbRender(){
  const host = document.getElementById('lb');
  if (!LB){ host.innerHTML = ''; return; }
  const it = LB.items[LB.i], n = LB.items.length;
  host.innerHTML = '<div class="lb" role="dialog" aria-modal="true" aria-label="Просмотр">' +
    '<div class="lb-scrim" data-lbx="1"></div><div class="lb-box">' +
    '<div class="lb-top"><span class="lb-n">' + (n > 1 ? (LB.i + 1) + ' из ' + n : '') + '</span>' +
    (n > 1 ? '<button class="lb-btn" data-lbm="-1" aria-label="Предыдущий">←</button><button class="lb-btn" data-lbm="1" aria-label="Следующий">→</button>' : '') +
    '<button class="lb-btn" data-lbx="1" aria-label="Закрыть">&times;</button></div>' +
    '<div class="lb-stage">' + it.html + '</div><div class="lb-cap">' + it.cap + '</div></div></div>';
  const b = host.querySelector('.lb-box'); if (b) b.focus && b.focus();
}
function lbClose(){ LB = null; lbRender(); }
function lbItemPhoto(x){
  return {html:'<img src="' + esc(x.full || x.file) + '" alt="">',
    cap:'<b>' + lat(x.t) + '</b>' + (x.what ? ' — ' + lat(x.what) : '') + '<span class="ph-meta">' + esc(photoMeta(x)) + '</span><span class="ph-cred">' + photoCredit(x) + '</span>'};
}
function lbItemFig(f){
  return {html: f.svg ? '<div class="lb-svg">' + f.svg + '</div>' : '<img src="' + esc(f.img) + '" alt="">',
    cap:'<b>' + lat(f.title) + '</b>' + (f.cap ? '<span class="ph-meta">' + lat(f.cap) + '</span>' : '') + (f.src ? '<span class="ph-cred">' + lat(f.src) + '</span>' : '')};
}

/* ---------- микропрепараты ---------- */
const GF = {kind:'', m:'', q:''};
function galleryList(){
  const q = GF.q.trim().toLowerCase();
  return PH.filter(x => {
    if (GF.kind && photoKind(x) !== GF.kind) return false;
    if (GF.m && !(x.m || '').toLowerCase().includes(GF.m)) return false;
    if (!q) return true;
    return [x.t, x.what, x.st, x.m].some(v => v && v.toLowerCase().replace(/[{}]/g, '').includes(q)) ||
      (x.pg || []).some(id => PMAP[id] && [PMAP[id].ru, PMAP[id].n].some(v => v && v.toLowerCase().includes(q)));
  });
}
const GMETHODS = [['световая', 'световая микроскопия'], ['иммерс', 'иммерсия'], ['рисунок', 'рисунки микропрепаратов'], ['гистолог', 'гистологические срезы'], ['тёмн', 'тёмное поле'], ['фаз', 'фазовый контраст'], ['люминесц', 'люминесцентная'], ['электрон', 'электронная'], ['фото', 'фото посевов']];
function galleryPage(){
  if(!window.MICRO_FULL) return lockedPage('Микропрепараты');
  const list = galleryList();
  let h = '<p class="eyebrow">Справочник</p><h1 class="title">Микропрепараты</h1>' +
    '<p class="lede">Все снимки атласа. У каждого — метод микроскопии, окраска и увеличение. Нажмите на снимок, чтобы открыть его крупно и листать.</p>' +
    '<div class="acts"><a class="btn pri" href="#learn/ph">Тренажёр: узнай возбудителя по снимку</a></div>' +
    '<div class="search" style="max-width:420px;margin:16px 0 4px">' + searchSvg() +
    '<input id="gq" type="search" placeholder="Возбудитель, окраска, метод" value="' + esc(GF.q) + '"></div>' +
    '<div class="chips">' + chip('Все', !GF.kind, 'gkind', '', PH.length) +
    Object.keys(PKIND).map(k => { const n = PH.filter(x => photoKind(x) === k).length; return n ? chip(PKIND[k], GF.kind === k, 'gkind', k, n) : ''; }).join('') + '</div>' +
    '<div class="chips">' + chip('Любой метод', !GF.m, 'gm', '', null) +
    GMETHODS.map(m => { const n = PH.filter(x => (x.m || '').toLowerCase().includes(m[0])).length; return n ? chip(m[1], GF.m === m[0], 'gm', m[0], n) : ''; }).join('') + '</div>' +
    '<p class="cnt">' + list.length + ' ' + plural(list.length, 'снимок', 'снимка', 'снимков') + '</p>';
  Object.keys(PKIND).forEach(k => {
    const part = list.filter(x => photoKind(x) === k);
    if (!part.length) return;
    h += '<h3 class="az">' + PKIND[k] + '</h3>' + photosGrid(part, 'g');
  });

  const figs = Object.keys(FIG).map(id => FIG[id]);
  if (figs.length && !GF.kind && !GF.m && !GF.q){
    h += '<h2 class="sec">Схемы атласа</h2><p class="cnt">' + figs.length + ' ' + plural(figs.length, 'схема', 'схемы', 'схем') + ' — откройте тему, где схема разобрана</p><div class="pglist">' +
      figs.map(f => { const t = FIGWHERE[f.id];
        return '<a class="pgrow" href="#' + (t ? t.id : '') + '"><b>' + lat(f.title) + '</b><span class="d">' + (t ? 'Тема ' + t.no + '. ' + lat(t.title) : 'пока не вставлена в лист') + '</span>' +
          '<span class="m"><span class="tag">' + (AN_FIG[f.id] ? 'анимация' : f.svg ? 'схема' : 'из конспекта') + '</span></span></a>'; }).join('') + '</div>';
  }
  return h;
}

/* ---------- вопросы ---------- */
const QF = {q:'', blk:'', topic:'', src:'', z:''};
function questionsPage(){
  if(!window.MICRO_FULL) return lockedPage('Вопросы экзамена');
  const q = QF.q.trim().toLowerCase();
  const list = QS.filter(x => {
    if (QF.src && x.src !== QF.src) return false;
    if (QF.blk && x.blk !== QF.blk) return false;
    if (QF.topic && !x.th.includes(QF.topic)) return false;
    if (QF.z && !x.th.some(id => TZ[id] && TZ[id].id === QF.z)) return false;
    return !q || x.text.toLowerCase().includes(q);
  });
  const t = QF.topic ? TMAP[QF.topic] : null;

  let h = '<p class="eyebrow">Справочник</p><h1 class="title">Вопросы экзамена</h1>' +
    '<p class="lede">Два набора: вопросы стоматологического факультета из файла с ответами и экзаменационные вопросы ПСПбГМУ им. И. П. Павлова (лечебный факультет, 2018). У каждого — темы атласа, с которых стоит начать, и досье возбудителей.</p>' +
    '<div class="search" style="max-width:420px;margin:16px 0 4px">' + searchSvg() +
    '<input id="qq" type="search" placeholder="Поиск по формулировке" value="' + esc(QF.q) + '"></div>' +
    '<div class="chips">' + chip('Оба набора', !QF.src, 'qsrc', '', QS.length) +
    Object.keys(QSETS).map(s => chip(esc(QSETS[s].name), QF.src === s, 'qsrc', s, qcount(QS, s))).join('') + '</div>' +
    '<div class="chips">' + chip('Все зачёты', !QF.z, 'qz', '', null) +
    ZS.map(z => chip('Зачёт ' + z.n, QF.z === z.id, 'qz', z.id, zqs(z).length)).join('') + '</div>' +
    '<div class="chips">' + chip('Общая и частная', !QF.blk, 'qblk', '', null) +
    chip('Общая', QF.blk === 'gen', 'qblk', 'gen', null) + chip('Частная', QF.blk === 'prv', 'qblk', 'prv', null) +
    (t ? '<button class="chip on" data-f="qtopic" data-v="">Тема ' + t.no + ': ' + lat(t.title) + ' ×</button>' : '') +
    '</div><p class="cnt">' + list.length + ' ' + plural(list.length, 'вопрос', 'вопроса', 'вопросов') + '</p>';

  let cur = '';
  h += '<div class="pglist">';
  list.forEach(x => {
    const head = x.src + x.blk;
    if (head !== cur){
      cur = head;
      h += '<div class="qhead">' + esc(qsrcName(x.src)) + ' · ' + (x.blk === 'gen' ? 'общая микробиология' : 'частная микробиология') + '</div>';
    }
    const ths = x.th.map(id => TMAP[id]).filter(Boolean);
    h += '<button class="qrow" data-q="' + qid(x) + '" aria-expanded="false">' +
      '<span class="n">' + x.no + '</span><span class="t">' + lat(x.text) + '</span>' +
      '<span class="w">' + (ths.length ? (ths.length > 1 ? 'темы ' : 'тема ') + ths.map(o => o.no).join(', ') : '—') + '</span></button>' +
      '<div class="qdet" id="d' + qid(x) + '" hidden><div class="chips">' +
      ths.map(o => '<a class="chip" href="#' + o.id + '">' + o.no + '. ' + lat(o.title) + '</a>').join('') +
      x.pg.filter(id => PMAP[id]).map(id => '<button class="chip" data-pg="' + id + '">' + pname(PMAP[id]) + '</button>').join('') +
      '</div></div>';
  });
  return h + '</div>';
}

/* ---------- учить: возбудители и микропрепараты ---------- */
const BOX = [0, 1, 3, 7, 21, 60];
const today = () => Math.floor(Date.now() / 86400000);
let learnMode = 'pg', learnCard = null, learnShown = false;
function srsKey(){ return learnMode === 'ph' ? 'srsph' : 'srs'; }
function srs(){ return LS.json(srsKey(), {}); }
function deck(){ return learnMode === 'ph' ? PH.filter(x => (x.pg || []).length) : PG; }
function dueList(){
  const st = srs(), d = today();
  return deck().filter(p => { const s = st[p.id]; return !s || (s.d || 0) <= d; });
}
function learnPage(){
  if(!window.MICRO_FULL) return lockedPage('Тренажёр');
  const st = srs(), due = dueList(), all = deck();
  const known = all.filter(p => (st[p.id] || {}).b >= 3).length;

  let h = '<p class="eyebrow">Тренажёр</p><h1 class="title">' + (learnMode === 'ph' ? 'Узнай возбудителя по снимку' : 'Учить возбудителей') + '</h1>' +
    '<div class="chips">' + chip('Возбудители', learnMode === 'pg', 'lmode', 'pg', PG.length) +
    chip('Микропрепараты', learnMode === 'ph', 'lmode', 'ph', PH.filter(x => (x.pg || []).length).length) + '</div>' +
    '<p class="lede">' + (learnMode === 'ph'
      ? 'Как на практической части экзамена: посмотрите на снимок, назовите возбудителя, окраску и что видно в препарате, затем откройте ответ.'
      : 'Название на карточке — что должно всплывать в памяти. Ответ: ключевая роль, заболевания и то, на чём ловят.') +
    ' Интервалы повторения растут: 1 → 3 → 7 → 21 → 60 дней.</p>' +
    '<div class="stats"><div class="stat"><b>' + due.length + '</b><span>к повторению сегодня</span></div>' +
    '<div class="stat"><b>' + known + '</b><span>в долгих интервалах</span><div class="bar"><i style="width:' +
    Math.round(known / Math.max(1, all.length) * 100) + '%"></i></div></div></div>';

  if (!due.length){
    h += '<div class="card"><div class="q">На сегодня всё</div><div class="a">Карточки вернутся по расписанию.</div></div>' +
      '<div class="acts"><button class="btn" data-l="reset">Начать колоду заново</button></div>';
    return h;
  }
  if (!learnCard || !due.some(p => p.id === learnCard)) learnCard = due[Math.floor(Math.random() * due.length)].id;
  const box = (st[learnCard] || {}).b || 0;
  const meta = '<div class="meta">' + (box ? 'интервал ' + BOX[Math.min(box, 5)] + ' дн.' : 'новая карточка') + '</div>';

  if (learnMode === 'ph'){
    const x = PHMAP[learnCard], p = PMAP[x.pg[0]];
    h += '<div class="card phcard">' + meta + '<button class="ph-img" data-lb="one" data-id="' + x.id + '" aria-label="Увеличить снимок"><img src="' + esc(x.file) + '" alt=""></button>';
    if (learnShown){
      h += '<div class="q">' + lat(x.t) + '</div><div class="a">' + (x.what ? lat(x.what) + '<br>' : '') +
        '<span class="ph-meta">' + esc(photoMeta(x)) + '</span>' + (p && p.ru && p.ru !== p.n ? '<br><b>' + esc(p.ru) + '</b>' : '') + '</div>' + gradeBtns() +
        (p ? '<button class="btn" data-pg="' + p.id + '" style="margin-top:4px">Открыть досье</button>' : '');
    } else {
      h += '<div class="a">Метод: ' + esc(x.m || '—') + '. Что за возбудитель, какая окраска, что видно?</div>' + showBtns();
    }
    return h + '</div>';
  }

  const p = PMAP[learnCard];
  h += '<div class="card">' + meta.replace('<div class="meta">', '<div class="meta">' + (GRAM[p.gr] ? GRAM[p.gr][0] + ' · ' : '')) +
    '<div class="q">' + pname(p) + '</div>';
  if (learnShown){
    const extra = p.nb ? '<br><br>На чём ловят: ' + lat(p.nb)
      : (p.dis && p.dis.length ? '<br><br>' + lat(Array.isArray(p.dis) ? p.dis[0] : p.dis) : '');
    h += '<div class="a">' + (p.ru && p.ru !== p.n ? '<b>' + esc(p.ru) + '</b><br>' : '') +
      lat(p.sum || '') + extra + '</div>' + gradeBtns() +
      '<button class="btn" data-pg="' + p.id + '" style="margin-top:4px">Открыть досье</button>';
  } else h += showBtns();
  return h + '</div>';
}
function showBtns(){ return '<div class="acts"><button class="btn pri" data-l="show">Показать ответ</button><button class="btn" data-l="skip">Другая карточка</button></div>'; }
function gradeBtns(){ return '<div class="acts"><button class="btn" data-l="0">Не помню</button><button class="btn" data-l="1">Почти</button><button class="btn pri" data-l="2">Знаю</button></div>'; }
function grade(g){
  if(window.MAP && learnCard) MAP.card({atlas:'micro',ok:g===2});
  const st = srs(), cur = st[learnCard] || {b:0};
  let b = cur.b || 0, d = today();
  if (g === 0) b = 0;                                 /* не помню — вернётся сегодня же */
  else if (g === 1) d += Math.max(1, BOX[b]);         /* почти — тот же интервал */
  else { b = Math.min(5, b + 1); d += BOX[b]; }       /* знаю — интервал растёт */
  st[learnCard] = {b, d};
  LS.set(srsKey(), JSON.stringify(st));
  learnCard = null; learnShown = false;
  render();
}

/* ---------- поиск по всему атласу ---------- */
function searchAll(raw){
  const q = raw.trim().toLowerCase();
  if (q.length < 2) return [];
  const out = [];
  const norm = v => String(v || '').toLowerCase().replace(/[{}]/g, '');
  ZS.forEach(z => { if (norm(z.title + ' ' + (z.short || '')).includes(q)) out.push({h:'#' + z.id, t:z.title, s:'Зачёт ' + z.n + ' · обзорные главы'}); });
  TORDER.forEach(t => {
    if (norm(t.title + ' ' + (t.short || '')).includes(q))
      out.push({h:'#' + t.id, t:t.title, s:'Тема ' + t.no + (TZ[t.id] ? ' · зачёт ' + TZ[t.id].n : '')});
  });
  TORDER.forEach(t => {
    const c = ZTX[t.id], z = TZ[t.id];
    if (!c || !z) return;
    const hit = c.blocks.some(b => [b.text, b.title, ...(b.items || []).map(x => Array.isArray(x) ? x.join(' ') : x)].some(v => v && norm(v).includes(q)));
    if (hit) out.push({h:'#' + z.id + '/' + t.id, t:t.title, s:'Обзорная глава · тема ' + t.no + ' · зачёт ' + z.n});
  });
  (SUBJECT_ACCESS ? MICRO_CATALOG.pathogenIndex : PG).forEach(p => {
    if ([p.n, p.ru, p.syn, p.sum].some(v => v && String(v).toLowerCase().includes(q)))
      out.push({pg:p.id, t:p.n, s:'Возбудитель' + (p.ru && p.ru !== p.n ? ' · ' + p.ru : '')});
  });
  Object.keys(FIG).forEach(id => {
    const f = FIG[id], t = FIGWHERE[id];
    if (t && (f.title || '').toLowerCase().replace(/[{}]/g, '').includes(q)) out.push({h:'#' + t.id, t:f.title, s:'Схема · тема ' + t.no});
  });
  QS.forEach(x => {
    if (x.text.toLowerCase().includes(q))
      out.push({h:'#' + (x.th[0] || 'questions'), t:x.text, s:qsrcName(x.src) + ' · ' + (x.blk === 'gen' ? 'общая' : 'частная') + ', вопрос ' + x.no});
  });
  MICRO_CATALOG.animations.filter(a=>!AN_MAP[a.id]).forEach(a=>{if(norm(a.title+' '+a.short).includes(q))out.push({h:'#anim/'+a.id,t:a.title,s:'Анимация'});});
  MICRO_CATALOG.drugIndex.forEach(d=>{if(norm(d.ru+' '+d.id).includes(q))out.push({h:'#abx/'+d.id,t:d.ru,s:'Карта антибиотиков'});});
  v7Search(q, out);
  return out.slice(0, 40);
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
  let h = '<a class="brand" href="#"><b>Атлас микробиологии</b><span>' + ZS.length + ' зачётов · ' + TORDER.length + ' тем · ' + MICRO_CATALOG.pathogens + ' досье · ' + (MICRO_CATALOG.figures + MICRO_CATALOG.photos) + ' иллюстраций</span></a>' +
    v7Tabs('tabs7') + '<div class="search">' + searchSvg() + '<input id="sq" type="search" placeholder="Поиск по атласу" autocomplete="off"></div>' +
    '<div class="results" id="results"></div><nav class="nav">';
  ZS.forEach(z => {
    const min = zMin(z);
    h += '<section><h6>Зачёт ' + z.n + '</h6>' +
      '<a class="zov" href="#' + z.id + '" data-id="' + z.id + '"><span class="n">§</span><span>' + lat(z.short || z.title) + '</span>' +
      (min ? '<span class="fill">' + min + '′</span>' : '') + '</a>' + z.list.map(t => {
      const q = (QBYTOPIC[t.id] || []).length;
      return '<a href="#' + t.id + '" data-id="' + t.id + '"><span class="n">' + t.no + '</span><span>' + lat(t.title) + '</span>' +
        (t.locked&&!SUBJECT_ACCESS ? '<span class="fill" aria-label="По подписке">🔒</span>' : q ? '<span class="fill">'+q+'</span>' : '') + '</a>';
    }).join('') + '</section>';
  });
  h += '<section><h6>Справочники</h6>' +
    '<a href="#pathogens" data-id="pathogens"><span class="n">А—Я</span><span>Возбудители</span><span class="fill">' + MICRO_CATALOG.pathogens + '</span></a>' +
    '<a href="#gallery" data-id="gallery"><span class="n">◎</span><span>Микропрепараты</span><span class="fill">' + MICRO_CATALOG.photos + '</span></a>' +
    '<a href="#questions" data-id="questions"><span class="n">№</span><span>Вопросы экзамена</span><span class="fill">' + MICRO_CATALOG.questions + '</span></a>' +
    '<a href="#learn" data-id="learn"><span class="n">↻</span><span>Учить</span></a>' +
    '</section></nav>' +
    '<div class="acts" style="margin-top:auto"><a class="btn" href="../">Все атласы</a><span data-ma-acct></span><button class="btn" id="theme">Сменить тему</button></div>';
  return h;
}

function route(){
  const raw = (location.hash || '').replace(/^#/, '');
  const [head, arg] = raw.split('/');
  if (TMAP[head]) return {v:'topic', t:TMAP[head]};
  if (ZMAP[head]) return {v:'z', z:ZMAP[head], arg};
  if (head === 'pathogens') return {v:'cat', arg};
  if (head === 'questions') return {v:'q', arg};
  if (head === 'gallery') return {v:'gal'};
  if (head === 'learn') return {v:'learn', arg};
  if (head === 'anim') return {v:'anim', arg};
  if (head === 'abx') return {v:'abx', arg};
  return {v:'home'};
}

function render(){
  const r = route();
  syncProgress(r);
  v7Before(r);
  const main = document.getElementById('main');
  let h = '';
  if (r.v === 'topic') h = topicPage(r.t);
  else if (r.v === 'z') h = clusterPage(r.z);
  else if (r.v === 'cat') h = catalogPage();
  else if (r.v === 'q'){
    if (r.arg && TMAP[r.arg]){ QF.topic = r.arg; QF.z = ''; }
    else if (r.arg && ZMAP[r.arg]){ QF.z = r.arg; QF.topic = ''; }
    h = questionsPage();
  }
  else if (r.v === 'gal') h = galleryPage();
  else if (r.v === 'anim') h = animationPage(r.arg);
  else if (r.v === 'abx') h = typeof abxPage==='function' ? abxPage(r.arg) : lockedPage('Карта антибиотиков');
  else if (r.v === 'learn'){ if (r.arg === 'ph' || r.arg === 'pg'){ if (learnMode !== r.arg){ learnMode = r.arg; learnCard = null; learnShown = false; } } h = learnPage(); }
  else h = homePage();
  main.innerHTML = '<article class="page' + (r.v === 'abx' || r.v === 'anim' ? ' page-x' : '') + '">' + h + '</article>';

  const id = {topic: r.t && r.t.id, z: r.z && r.z.id, cat:'pathogens', q:'questions', gal:'gallery', learn:'learn', anim:'anim', abx:'abx'}[r.v] || '';
  document.querySelectorAll('.nav a').forEach(a => {
    if (a.dataset.id === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.title = (r.v === 'topic' ? r.t.title.replace(/[{}]/g, '') + ' — ' : r.v === 'z' ? 'Зачёт ' + r.z.n + '. ' + r.z.title + ' — ' : r.v === 'gal' ? 'Микропрепараты — ' : r.v === 'anim' ? 'Все анимации — ' : r.v === 'abx' ? 'Карта антибиотиков — ' : '') + 'Атлас микробиологии';
  v7After(r);
  if(r.v==='gal' || (r.v==='learn' && r.arg==='ph')) main.querySelector('article').insertAdjacentHTML('beforeend', photoPager(r.v==='learn'));
  if (r.v === 'z' && r.arg){ const el = document.getElementById('ch-' + r.arg); if (el) requestAnimationFrame(() => el.scrollIntoView({block:'start'})); }
  if (r.v === 'cat' && r.arg && PMAP[r.arg] && dzOpen !== r.arg) openDossier(r.arg, true);
}


function lockedPage(title){
 return '<p class="eyebrow">Полная микробиология</p><h1 class="title">'+esc(title)+'</h1><div class="kwarn"><b>Этот материал входит в подписку «Микробиология»</b><p>Два базовых конспекта доступны бесплатно. Для остальных материалов нужна действующая подписка на предмет.</p></div><div class="acts"><a class="btn pri" href="#g1">Морфология</a><a class="btn" href="#g2">Физиология</a><a class="btn" href="../#atlases">Все атласы</a></div>';
}
function syncProgress(r){
 if(!window.MAP)return;
 const done=LS.json('read',{});
 MAP.sections('micro',TH.map(t=>({id:t.id,n:t.title,sub:'Микробиология',total:1,learned:done[t.id]?1:0,seen:done[t.id]?1:0,locked:!!t.locked&&!SUBJECT_ACCESS})));
 if(r.v==='topic'&&!r.t.locked)MAP.last({atlas:'micro',title:r.t.title,sub:'Микробиология',url:new URL('#'+r.t.id,location.href).href});
}
function animationPage(id){
 if(id) return AN_MAP[id] ? animCatalogPage(id) : lockedPage('Анимация');
 return '<p class="eyebrow">Интерактивный атлас</p><h1 class="title">Все анимации</h1><p class="lede">38 анимаций процессов и механизмов действия антибиотиков.</p><div class="pglist">'+MICRO_CATALOG.animations.map(a=>'<a class="qrow" href="#anim/'+a.id+'"><span class="t">'+lat(a.title)+'</span><span>Смотреть →</span></a>').join('')+'<a class="qrow" href="#abx"><span class="t">15 анимаций механизмов действия антибиотиков</span><span>Карта антибиотиков →</span></a></div>';
}
function photoPager(learn){
 const pieces=location.hash.slice(1).split('/');
 const current=Number(pieces[learn?2:1])||1;
 const base=learn?'learn/ph/':'gallery/';
 return '<nav class="pager" aria-label="Страницы микропрепаратов">'+(current>1?'<a href="#'+base+(current-1)+'">← Предыдущие снимки</a>':'<span></span>')+'<span>'+current+' / '+MICRO_CATALOG.photoPages+'</span>'+(current<MICRO_CATALOG.photoPages?'<a href="#'+base+(current+1)+'">Следующие снимки →</a>':'')+'</nav>';
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
  function drawer(on){ railEl.classList.toggle('open',on);scrim.classList.toggle('on',on);document.getElementById('burger').setAttribute('aria-expanded',String(on)); }
  document.getElementById('burger').addEventListener('click', () => drawer(!railEl.classList.contains('open')));
  scrim.addEventListener('click', () => drawer(false));

  /* один обработчик на всё */
  document.addEventListener('click', e => {
    const t = e.target;
    const read=t.closest('[data-read]');
    if(read && TMAP[read.dataset.read] && !TMAP[read.dataset.read].locked){const done=LS.json('read',{});done[read.dataset.read]=!done[read.dataset.read];LS.set('read',JSON.stringify(done));render();return;}
    /* просмотр крупно */
    if (t.closest('[data-lbx]')){ lbClose(); return; }
    const mv = t.closest('[data-lbm]');
    if (mv && LB){ LB.i = (LB.i + Number(mv.dataset.lbm) + LB.items.length) % LB.items.length; lbRender(); return; }
    const lb = t.closest('[data-lb]');
    if (lb){
      e.preventDefault();
      if (lb.dataset.lb === 'fig'){ const f = FIG[lb.dataset.id]; if (f) lbOpen([lbItemFig(f)], 0); }
      else if (lb.dataset.lb === 'one'){ const x = PHMAP[lb.dataset.id]; if (x) lbOpen([lbItemPhoto(x)], 0); }
      else {
        const list = ctxList(lb.dataset.ctx);
        const i = Math.max(0, list.findIndex(x => x.id === lb.dataset.id));
        lbOpen(list.map(lbItemPhoto), i);
      }
      return;
    }
    const pg = t.closest('[data-pg]');
    if (pg){ e.preventDefault(); openDossier(pg.dataset.pg, !!dzOpen); si.value = ''; renderResults(''); return; }
    if (t.closest('[data-x]')){ closeDossier(); return; }
    const go = t.closest('[data-go]');
    if (go){ location.hash = go.dataset.go; si.value = ''; renderResults(''); return; }
    const f = t.closest('[data-f]');
    if (f){
      const v = f.dataset.v;
      if (f.dataset.f === 'grp') CAT.grp = v;
      if (f.dataset.f === 'tag') CAT.tag = v;
      if (f.dataset.f === 'qblk') QF.blk = v;
      if (f.dataset.f === 'qsrc') QF.src = v;
      if (f.dataset.f === 'qtopic') QF.topic = v;
      if (f.dataset.f === 'qz'){ QF.z = v; QF.topic = ''; }
      if (f.dataset.f === 'gkind') GF.kind = v;
      if (f.dataset.f === 'gm') GF.m = v;
      if (f.dataset.f === 'lmode'){ location.hash = '#learn/' + v; return; }
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
      else if (v === 'reset'){ LS.set(srsKey(), JSON.stringify({})); learnCard = null; learnShown = false; render(); }
      else grade(Number(v));
      return;
    }
    const sc = t.closest('[data-scroll]');
    if (sc){
      const el = document.getElementById(sc.dataset.scroll);
      if (el){
        el.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start'});
        const r = route();
        if (r.v === 'z') try { history.replaceState(null, '', '#' + r.z.id + (sc.dataset.scroll.startsWith('ch-') ? '/' + sc.dataset.scroll.slice(3) : '')); } catch (err) {}
      }
      return;
    }
    const a = t.closest('a[href^="#"]');
    if (a){ if (dzOpen && a.dataset.close) { dzReturn = null; closeDossier(); } drawer(false); }
  });

  /* поля ввода на страницах */
  const keep = (id, set) => document.addEventListener('input', e => {
    if (e.target.id !== id) return;
    set(e.target.value); const v = e.target.value, pos = e.target.selectionStart; render();
    const el = document.getElementById(id); if (el){ el.focus(); el.value = v; el.setSelectionRange(pos, pos); }
  });
  keep('catq', v => CAT.q = v);
  keep('qq', v => QF.q = v);
  keep('gq', v => GF.q = v);

  document.addEventListener('keydown', e => {
    if (ANV) return;
    if (LB){
      if (e.key === 'Escape') lbClose();
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft'){ LB.i = (LB.i + (e.key === 'ArrowRight' ? 1 : -1) + LB.items.length) % LB.items.length; lbRender(); }
      return;
    }
    if (e.key === 'Escape'){ if (dzOpen) closeDossier(); else drawer(false); }
    if (e.key === '/' && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)){ e.preventDefault(); si.focus(); }
  });

  addEventListener('hashchange', () => {
    const r = route();
    if (LB) lbClose();
    if (ANV) anvClose();
    if (dzOpen && !(r.v === 'cat' && r.arg === dzOpen)){ document.getElementById('dz').innerHTML = ''; document.documentElement.style.overflow = ''; dzOpen = null; }
    render();
    if (!(r.v === 'cat' && r.arg) && !(r.v === 'z' && r.arg)) scrollTo({top:0});
  });

  render();
})();
