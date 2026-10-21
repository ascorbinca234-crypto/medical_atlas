/* ===== Помощники для рисования схем (SVG) =====
   Цвета задаются классами (gv, saf, zn, mb, mg, nt, ln …) — они берут токены темы, поэтому схемы
   сами перекрашиваются в тёмной теме. Текст: {латынь} → курсив, \n → новая строка.
   Все подписи на схемах — на русском и латыни. */
const SV = (() => {
  const e = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fmt = ln => e(ln).replace(/\{([^}]+)\}/g, '<tspan font-style="italic">$1</tspan>');
  const n = v => Math.round(v * 10) / 10;
  const cls = c => c ? ' class="' + c + '"' : '';
  const sw = (o, d) => ' stroke-width="' + (o.sw != null ? o.sw : d) + '"';

  /* текст; o: {s: размер, a: start|middle|end, c: класс, w: жирность, lh: межстрочный, rot: поворот} */
  function tx(x, y, s, o = {}){
    const size = o.s || 15, lh = o.lh || 1.22;
    const lines = String(s).split('\n');
    const inner = lines.map((ln, i) => '<tspan x="' + n(x) + '" dy="' + (i ? n(size * lh) : 0) + '">' + fmt(ln) + '</tspan>').join('');
    return '<text x="' + n(x) + '" y="' + n(y) + '" font-size="' + size + '" text-anchor="' + (o.a || 'middle') + '"' +
      cls(o.c) + (o.w ? ' font-weight="' + o.w + '"' : '') +
      (o.rot ? ' transform="rotate(' + o.rot + ' ' + n(x) + ' ' + n(y) + ')"' : '') + '>' + inner + '</text>';
  }
  const rect = (x, y, w, h, o = {}) => '<rect x="' + n(x) + '" y="' + n(y) + '" width="' + n(w) + '" height="' + n(h) + '"' +
    (o.r ? ' rx="' + o.r + '"' : '') + cls(o.c || 'nt') + sw(o, 1.4) + (o.dash ? ' stroke-dasharray="' + o.dash + '"' : '') + (o.op ? ' opacity="' + o.op + '"' : '') + '/>';
  const circ = (x, y, r, o = {}) => '<circle cx="' + n(x) + '" cy="' + n(y) + '" r="' + n(r) + '"' + cls(o.c || 'nt') + sw(o, 1.4) +
    (o.dash ? ' stroke-dasharray="' + o.dash + '"' : '') + (o.op ? ' opacity="' + o.op + '"' : '') + '/>';
  const ell = (x, y, rx, ry, o = {}) => '<ellipse cx="' + n(x) + '" cy="' + n(y) + '" rx="' + n(rx) + '" ry="' + n(ry) + '"' + cls(o.c || 'nt') + sw(o, 1.4) +
    (o.rot ? ' transform="rotate(' + o.rot + ' ' + n(x) + ' ' + n(y) + ')"' : '') + (o.dash ? ' stroke-dasharray="' + o.dash + '"' : '') + (o.op ? ' opacity="' + o.op + '"' : '') + '/>';
  const line = (x1, y1, x2, y2, o = {}) => '<line x1="' + n(x1) + '" y1="' + n(y1) + '" x2="' + n(x2) + '" y2="' + n(y2) + '"' + cls(o.c || 'ln') + sw(o, 1.4) +
    (o.dash ? ' stroke-dasharray="' + o.dash + '"' : '') + (o.cap ? ' stroke-linecap="round"' : '') + '/>';
  const path = (d, o = {}) => '<path d="' + d + '"' + cls(o.c || 'ln') + sw(o, 1.4) + (o.dash ? ' stroke-dasharray="' + o.dash + '"' : '') +
    (o.cap !== false ? ' stroke-linecap="round" stroke-linejoin="round"' : '') + (o.op ? ' opacity="' + o.op + '"' : '') + '/>';
  const poly = (pts, o = {}) => '<polygon points="' + pts.map(p => n(p[0]) + ',' + n(p[1])).join(' ') + '"' + cls(o.c || 'nt') + sw(o, 1.4) + '/>';
  const g = (tr, body) => '<g transform="' + tr + '">' + body + '</g>';

  /* стрелка: линия + наконечник (без маркеров, чтобы не было конфликтов id) */
  function arrow(x1, y1, x2, y2, o = {}){
    const a = Math.atan2(y2 - y1, x2 - x1), L = o.head || 9, W = (o.headW || 4.5);
    const bx = x2 - L * Math.cos(a), by = y2 - L * Math.sin(a);
    const p1 = [bx + W * Math.sin(a), by - W * Math.cos(a)], p2 = [bx - W * Math.sin(a), by + W * Math.cos(a)];
    const lc = o.c || 'ln', hc = o.hc || 'arw';
    return line(x1, y1, bx, by, {c: lc, sw: o.sw || 1.6, dash: o.dash}) + poly([[x2, y2], p1, p2], {c: hc, sw: 0});
  }
  /* выноска: точка на объекте, линия к подписи */
  function lead(x1, y1, x2, y2, text, o = {}){
    const a = o.a || (x2 >= x1 ? 'start' : 'end');
    const dx = a === 'start' ? 5 : a === 'end' ? -5 : 0;
    return circ(x1, y1, 2.2, {c: 'nts', sw: 0}) + line(x1, y1, x2, y2, {c: 'ln', sw: 1}) +
      tx(x2 + dx, y2 + (o.dy != null ? o.dy : 4.5), text, {s: o.s || 14, a, c: o.c, w: o.w});
  }
  /* палочка: центр, длина, толщина, угол */
  const rod = (cx, cy, len, th, ang, o = {}) => '<rect x="' + n(cx - len / 2) + '" y="' + n(cy - th / 2) + '" width="' + n(len) + '" height="' + n(th) + '" rx="' + n(th / 2) + '"' +
    cls(o.c || 'gv') + sw(o, 1.4) + (ang ? ' transform="rotate(' + ang + ' ' + n(cx) + ' ' + n(cy) + ')"' : '') + '/>';
  const coccus = (cx, cy, r, o = {}) => circ(cx, cy, r, {c: o.c || 'gv', sw: o.sw != null ? o.sw : 1.4});
  /* синусоида: извитые формы; amp — амплитуда, k — число завитков */
  function wave(x, y, len, amp, k, o = {}){
    let d = 'M' + n(x) + ' ' + n(y);
    const steps = Math.max(40, k * 24);
    for (let i = 1; i <= steps; i++){
      const t = i / steps;
      d += ' L' + n(x + len * t) + ' ' + n(y + amp * Math.sin(t * k * 2 * Math.PI));
    }
    return path(d, {c: o.c || 'gvl', sw: o.sw || 3});
  }
  /* бислой мембраны: ряд головок с хвостами, по горизонтали */
  function bilayer(x, y, w, o = {}){
    const step = o.step || 9, r = o.r || 3.2, gap = o.gap || 14;
    let h = rect(x, y, w, gap, {c: o.core || 'bg', sw: 0});
    for (let cx = x + step / 2; cx < x + w; cx += step){
      h += line(cx, y + r, cx, y + gap / 2 - 1, {c: 'ln', sw: 0.8}) + line(cx, y + gap - r, cx, y + gap / 2 + 1, {c: 'ln', sw: 0.8});
      h += circ(cx, y, r, {c: o.c || 'mb', sw: 0.8}) + circ(cx, y + gap, r, {c: o.c || 'mb', sw: 0.8});
    }
    return h;
  }
  /* рамка-заголовок секции на схеме */
  const panel = (x, y, w, h, title, o = {}) => rect(x, y, w, h, {c: 'sh', r: 12, sw: 1}) + (title ? tx(x + 16, y + 26, title, {s: o.s || 16, a: 'start', w: 600}) : '');

  function svg(w, h, body, label){
    return '<svg class="sv" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + e(label || '') + '" xmlns="http://www.w3.org/2000/svg">' + body + '</svg>';
  }
  return {tx, rect, circ, ell, line, path, poly, g, arrow, lead, rod, coccus, wave, bilayer, panel, svg, e};
})();

/* детерминированный «случайный» генератор, чтобы схема не менялась от сборки к сборке */
const SVR = seed => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };


/* ===== Анимации процессов: движок и проигрыватель =====
   Анимация — это данные: AN({id, title, short, group, topic, replaces, w, h, dur, stages, build, sum, legend}).
   build(A) один раз рисует сцену: A.add(svg) — неподвижные части, A.act(id, svg, {x, y, s, r, o}) — подвижные объекты,
   A.to(id, t0, длительность, {…}) — плавное изменение, A.set(id, t, {…}) — мгновенное, A.f(id, (t, p) => {…}) — движение
   по формуле (циклы, колебания). Кадр — чистая функция времени, поэтому пауза, перемотка, скорость, повтор, превью
   и шаговый режим при «уменьшении движения» работают одинаково для всех анимаций атласа и для карты антибиотиков.
   На странице одновременно воспроизводится только одна анимация. */

const AN_LIST = [], AN_MAP = {}, AN_FIG = {};
function AN(o){
  AN_LIST.push(o); AN_MAP[o.id] = o;
  [].concat(o.replaces || []).forEach(f => { AN_FIG[f] = o.id; });
  return o;
}

/* ---------- время и сглаживание ---------- */
const AE = {
  lin: u => u,
  io: u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2,
  out: u => 1 - Math.pow(1 - u, 3),
  in: u => u * u * u,
  sin: u => (1 - Math.cos(Math.PI * u)) / 2,
  back: u => { const c = 1.6; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); }
};
const a01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const aseg = (t, a, b) => b <= a ? (t >= a ? 1 : 0) : a01((t - a) / (b - a));
const alerp = (a, b, u) => a + (b - a) * u;
const ar1 = v => Math.round(v * 10) / 10;
const ar3 = v => Math.round(v * 1000) / 1000;
/* точка на ломаной pts при доле u (0..1) — для движения по пути */
function apath(pts, u){
  if (pts.length < 2) return {x: pts[0][0], y: pts[0][1]};
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const d = a01(u) * L[L.length - 1];
  let i = 1;
  while (i < L.length - 1 && L[i] < d) i++;
  const k = L[i] === L[i - 1] ? 0 : (d - L[i - 1]) / (L[i] - L[i - 1]);
  return {x: alerp(pts[i - 1][0], pts[i][0], k), y: alerp(pts[i - 1][1], pts[i][1], k)};
}
function aclock(s){ s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

/* ---------- сборка сцены ---------- */
function anBuild(def, prm){
  const items = [], acts = {}, order = [];
  const A = {
    W: def.w, H: def.h, prm: prm || {}, def,
    add(svg){ items.push(svg); return A; },
    /* подвижный объект; svg рисуется вокруг точки (0, 0), положение — в p0 */
    act(id, svg, p0){
      if (acts[id]) throw new Error('анимация ' + def.id + ': повтор объекта ' + id);
      const a = {id, svg, p0: Object.assign({x: 0, y: 0, s: 1, r: 0, o: 1}, p0 || {}), tw: {}, fn: []};
      acts[id] = a; order.push(a); items.push(a);
      return id;
    },
    /* текст, который меняется по ходу анимации: A.txt(id, x, y, 'начальный', опции SV.tx) */
    txt(id, x, y, s, o, p0){
      A.act(id, SV.tx(0, 0, s, o || {}), Object.assign({x, y}, p0 || {}));
      acts[id].tx = o || {};
      return id;
    },
    to(id, t0, dur, p, e){
      const a = acts[id];
      if (!a) throw new Error('анимация ' + def.id + ': нет объекта ' + id);
      const ef = typeof e === 'function' ? e : (AE[e || 'io'] || AE.io);
      for (const k in p) (a.tw[k] = a.tw[k] || []).push({t0, t1: t0 + Math.max(0, dur), v: p[k], e: ef});
      return A;
    },
    set(id, t, p){ return A.to(id, t, 0, p, 'lin'); },
    /* появление и исчезновение: show(id, t, dur), hide(id, t, dur) */
    show(id, t, d){ return A.to(id, t, d == null ? .4 : d, {o: 1}, 'out'); },
    hide(id, t, d){ return A.to(id, t, d == null ? .4 : d, {o: 0}, 'out'); },
    f(id, fn){ acts[id].fn.push(fn); return A; },
    /* путь, который «прорисовывается»: у всех линий внутри нужен pathLength="1" */
    dp(d, c, sw, extra){ return '<path d="' + d + '" pathLength="1" class="' + (c || 'ln') + '" stroke-width="' + (sw || 2) + '" fill="none" stroke-linecap="round" stroke-linejoin="round"' + (extra || '') + '/>'; }
  };
  def.build(A);
  order.forEach(a => { for (const k in a.tw) a.tw[k].sort((x, y) => x.t0 - y.t0 || x.t1 - y.t1); });
  return {def, items, acts, order};
}

/* свойства объекта в момент t */
function anProps(a, t){
  const p = Object.assign({}, a.p0);
  for (const k in a.tw){
    let v = a.p0[k];
    if (v === undefined) v = k === 's' || k === 'o' || k === 'sx' || k === 'sy' ? 1 : (k === 'txt' || k === 'c' ? '' : 0);
    for (const w of a.tw[k]){
      if (t < w.t0) break;
      if (t >= w.t1){ v = w.v; continue; }
      const u = w.e((t - w.t0) / (w.t1 - w.t0));
      v = typeof w.v === 'number' && typeof v === 'number' ? alerp(v, w.v, u) : v;
      break;
    }
    p[k] = v;
  }
  for (const fn of a.fn){ const q = fn(t, p); if (q) Object.assign(p, q); }
  return p;
}
function anTransform(p){
  let tr = 'translate(' + ar1(p.x) + ' ' + ar1(p.y) + ')';
  if (p.r) tr += ' rotate(' + ar1(p.r) + ')';
  if (p.sx != null || p.sy != null) tr += ' scale(' + ar3(p.sx != null ? p.sx : p.s) + ' ' + ar3(p.sy != null ? p.sy : p.s) + ')';
  else if (p.s !== 1) tr += ' scale(' + ar3(p.s) + ')';
  return tr;
}
/* разметка сцены в момент t — для превью, плакатов и печати */
function anMarkup(sc, t){
  return sc.items.map(it => {
    if (typeof it === 'string') return it;
    const p = anProps(it, t), o = ar3(a01(p.o));
    const body = p.txt != null && p.txt !== '' && it.tx ? SV.tx(0, 0, p.txt, it.tx) : it.svg;
    return '<g data-a="' + it.id + '" transform="' + anTransform(p) + '"' +
      (o < 1 ? ' opacity="' + o + '"' : '') + (o <= 0 ? ' visibility="hidden"' : '') +
      (p.d != null ? ' stroke-dasharray="1 1" stroke-dashoffset="' + ar3(1 - a01(p.d)) + '"' : '') +
      (p.c ? ' class="' + p.c + '"' : '') + '>' + body + '</g>';
  }).join('');
}
function anSvg(sc, t, label, cls){
  const d = sc.def;
  return '<svg class="sv ap-svg' + (cls ? ' ' + cls : '') + '" viewBox="0 0 ' + d.w + ' ' + d.h + '" role="img" aria-label="' + esc(label || (d.title || '').replace(/[{}]/g, '')) +
    '" xmlns="http://www.w3.org/2000/svg">' + anMarkup(sc, t) + '</svg>';
}
/* плакат анимации: сцена в момент poster (по умолчанию — финал) */
function anPoster(def, t, cls){
  const sc = anBuild(def);
  return anSvg(sc, t != null ? t : (def.poster != null ? def.poster : def.dur), null, cls);
}
function anMount(svgEl, sc){
  sc.order.forEach(a => { a.el = svgEl.querySelector('[data-a="' + a.id + '"]'); a.k = {}; });
}
function anRender(sc, t){
  for (const a of sc.order){
    const el = a.el;
    if (!el) continue;
    const p = anProps(a, t);
    const tr = anTransform(p);
    if (tr !== a.k.tr){ el.setAttribute('transform', tr); a.k.tr = tr; }
    const o = ar3(a01(p.o));
    if (o !== a.k.o){
      if (o >= 1) el.removeAttribute('opacity'); else el.setAttribute('opacity', o);
      if (o <= 0) el.setAttribute('visibility', 'hidden'); else el.removeAttribute('visibility');
      a.k.o = o;
    }
    if (p.d != null){
      const d = ar3(1 - a01(p.d));
      if (d !== a.k.d){ el.setAttribute('stroke-dasharray', '1 1'); el.setAttribute('stroke-dashoffset', d); a.k.d = d; }
    }
    if (p.txt != null && p.txt !== a.k.txt){
      if (a.tx){ el.innerHTML = SV.tx(0, 0, p.txt === '' ? ' ' : p.txt, a.tx); }
      a.k.txt = p.txt;
    }
    if (p.c != null && p.c !== a.k.c){ if (p.c) el.setAttribute('class', p.c); else el.removeAttribute('class'); a.k.c = p.c; }
  }
}

/* ---------- общий контроль: одна анимация за раз ---------- */
const ANC = {
  active: null, raf: 0, list: new Set(),
  rm: (() => { try { return matchMedia('(prefers-reduced-motion: reduce)'); } catch (e) { return {matches: false}; } })(),
  stopAll(except){ ANC.list.forEach(p => { if (p !== except) p.pause(); }); },
  prune(){ ANC.list.forEach(p => { if (!p.root || !p.root.isConnected) p.destroy(); }); }
};
function anTick(ts){
  const p = ANC.active;
  if (!p || !p.playing){ ANC.raf = 0; return; }
  if (p.last == null) p.last = ts;
  const dt = Math.min(0.1, Math.max(0, (ts - p.last) / 1000));
  p.last = ts;
  p.seek(p.t + dt * p.rate, true);
  if (p.t >= p.def.dur){ p.finish(); ANC.raf = 0; return; }
  ANC.raf = requestAnimationFrame(anTick);
}
const AN_RATES = [0.5, 1, 1.5, 2];

/* ---------- проигрыватель ----------
   opt: {mode:'fig'|'card'|'big'|'map', no:'4.2', prm, autoplay, onStage(i), onTime(t), onEnd(), cap:'подпись схемы', expand:false} */
class AnPlayer {
  constructor(host, def, opt){
    this.host = host; this.opt = opt || {};
    this.rate = 1; this.t = 0; this.playing = false; this.stageIx = -1; this.ended = false;
    this.motion = !ANC.rm.matches;
    this.root = null;
    ANC.list.add(this);
    this.load(def, this.opt.prm, true);
    if (this.opt.autoplay) this.play(true);
  }
  load(def, prm, first){
    this.pause();
    this.def = def; this.prm = prm;
    this.sc = anBuild(def, prm);
    this.ended = false; this.stageIx = -1; this.last = null;
    const poster = this.opt.startAt != null ? this.opt.startAt : (def.poster != null ? def.poster : def.dur);
    this.t = Math.min(def.dur, Math.max(0, poster));
    this.fresh = true;                       /* ещё не запускали: показан плакат */
    this.draw(first);
  }
  stageAt(t){
    const st = this.def.stages || [];
    let i = 0;
    for (let k = 0; k < st.length; k++) if (t >= st[k].t - 1e-6) i = k;
    return i;
  }
  stageEnd(i){
    const st = this.def.stages || [];
    return i + 1 < st.length ? st[i + 1].t : this.def.dur;
  }
  draw(){
    const d = this.def, m = this.opt.mode || 'fig';
    const st = d.stages || [];
    const head = m === 'map' ? '' :
      '<div class="ap-head"><h4>' + lat(d.title) + '</h4>' + (this.opt.no ? '<span class="blk-no">' + this.opt.no + '</span>' : '') +
      '<span class="ap-kind">анимация · ' + st.length + ' ' + plural(st.length, 'этап', 'этапа', 'этапов') + ' · ' + aclock(d.dur) + '</span></div>';
    const chips = st.map((s, i) => '<button type="button" class="ap-st" data-ap="st" data-i="' + i + '" aria-label="Этап ' + (i + 1) + ': ' + esc(s.title) + '" title="' + esc(s.title) + '"><span>' + (i + 1) + '</span></button>').join('');
    const legend = (d.legend || []).length ? '<ul class="ap-legend">' + d.legend.map(l => '<li><svg viewBox="0 0 22 14" class="sv" aria-hidden="true">' + apSwatch(l[0]) + '</svg>' + lat(l[1]) + '</li>').join('') + '</ul>' : '';
    const rates = AN_RATES.map(r => '<button type="button" class="ap-rt' + (r === this.rate ? ' on' : '') + '" data-ap="rate" data-r="' + r + '" aria-pressed="' + (r === this.rate) + '">' + String(r).replace('.', ',') + '×</button>').join('');
    const big = m === 'fig' || m === 'card' ? '<button type="button" class="ap-big" data-ap="big" aria-label="Открыть анимацию крупно" title="Крупно"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 8V3h5M17 8V3h-5M3 12v5h5M17 12v5h-5"/></svg></button>' : '';
    const rmNote = !this.motion ? '<p class="ap-rm">Системная настройка «уменьшить движение»: этапы сменяются без анимации. <button type="button" data-ap="motion">Показать движение</button></p>' : '';
    const html =
      '<figure class="ap ap-' + m + '" tabindex="-1"' + (d.apmin ? ' style="--apmin:' + d.apmin + 'px"' : '') + '>' + head +
      '<div class="ap-stage">' + anSvg(this.sc, this.t) + big + '</div>' +
      '<div class="ap-cap" aria-live="polite"><b class="ap-sn"></b><span class="ap-sc"></span></div>' +
      '<div class="ap-ctl">' +
        '<button type="button" class="ap-pp" data-ap="toggle" aria-label="Воспроизвести"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="i-play" d="M8 5.5v13l11-6.5z"/><path class="i-pause" d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z"/></svg><span class="ap-pp-t">Смотреть</span></button>' +
        '<button type="button" class="ap-rs" data-ap="restart" aria-label="Повторить сначала" title="Сначала"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12a7 7 0 1 0 2.1-5" /><path d="M5 4v4h4"/></svg></button>' +
        '<div class="ap-sts" role="group" aria-label="Этапы">' + chips + '</div>' +
        '<input class="ap-rng" type="range" min="0" max="' + Math.round(d.dur * 10) + '" step="1" value="' + Math.round(this.t * 10) + '" aria-label="Положение в анимации">' +
        '<span class="ap-tm">' + aclock(this.t) + ' / ' + aclock(d.dur) + '</span>' +
        '<div class="ap-rts" role="group" aria-label="Скорость">' + rates + '</div>' +
      '</div>' + rmNote + legend +
      (d.sum ? '<details class="ap-sum"><summary>' + (d.sumTitle || 'Главное') + '</summary><div>' + apSum(d.sum) + '</div></details>' : '') +
      (this.opt.capHtml ? '<figcaption class="fig-cap">' + this.opt.capHtml + '</figcaption>' : this.opt.cap ? '<figcaption class="fig-cap">' + lat(this.opt.cap) + '</figcaption>' : '') +
      '</figure>';
    const old = this.root;
    if (old && old.parentNode === this.host){ const tmp = document.createElement('div'); tmp.innerHTML = html; this.host.replaceChild(tmp.firstChild, old); }
    else { this.host.innerHTML = html; }
    this.root = this.host.querySelector('.ap');
    this.svg = this.root.querySelector('.ap-svg');
    anMount(this.svg, this.sc);
    this.bind();
    this.ui();
  }
  bind(){
    const r = this.root;
    r.addEventListener('click', e => {
      const b = e.target.closest('[data-ap]');
      if (!b || !r.contains(b)) return;
      const k = b.dataset.ap;
      if (k === 'play') this.play();
      else if (k === 'toggle') this.toggle();
      else if (k === 'restart') this.restart();
      else if (k === 'st') this.jump(Number(b.dataset.i));
      else if (k === 'rate') this.setRate(Number(b.dataset.r));
      else if (k === 'motion'){ this.motion = true; const n = r.querySelector('.ap-rm'); if (n) n.remove(); this.play(); }
      else if (k === 'big') anvOpen(this.def.id, {t: this.t});
    });
    const stg = r.querySelector('.ap-stage');
    if (this.opt.mode !== 'map') stg.addEventListener('click', e => { if (!e.target.closest('button,a,[data-term]')) this.toggle(); });
    const rng = r.querySelector('.ap-rng');
    rng.addEventListener('input', () => { this.pause(); this.fresh = false; this.seek(Number(rng.value) / 10); });
    r.addEventListener('keydown', e => {
      if (e.target.matches('input')) return;
      if ((e.key === ' ' || e.key === 'k') && !e.target.matches('button')){ e.preventDefault(); this.toggle(); }
      if (e.key === 'ArrowRight' && !e.target.matches('input')){ e.preventDefault(); this.jump(Math.min((this.def.stages || []).length - 1, this.stageAt(this.t) + 1)); }
      if (e.key === 'ArrowLeft' && !e.target.matches('input')){ e.preventDefault(); this.jump(Math.max(0, this.stageAt(this.t) - (this.t - (this.def.stages[this.stageAt(this.t)] || {t: 0}).t > 0.6 ? 0 : 1))); }
    });
    if ('IntersectionObserver' in window && this.opt.mode !== 'big'){
      this.io = new IntersectionObserver(es => es.forEach(en => { if (!en.isIntersecting && this.playing) this.pause(); }), {threshold: 0.15});
      this.io.observe(r);
    }
  }
  /* обновить подписи, кнопки, ползунок */
  ui(){
    const r = this.root, d = this.def, st = d.stages || [];
    if (!r) return;
    const i = this.stageAt(this.t);
    r.classList.toggle('is-playing', this.playing);
    r.classList.toggle('is-fresh', !!this.fresh);
    r.classList.toggle('is-ended', this.ended);
    const pp = r.querySelector('.ap-pp');
    pp.setAttribute('aria-label', this.playing ? 'Пауза' : (this.ended ? 'Повторить' : 'Воспроизвести'));
    const rng = r.querySelector('.ap-rng');
    const v = Math.round(this.t * 10);
    if (Number(rng.value) !== v) rng.value = v;
    rng.setAttribute('aria-valuetext', aclock(this.t) + ' из ' + aclock(d.dur) + (st[i] ? ', этап ' + (i + 1) + ': ' + st[i].title : ''));
    r.querySelector('.ap-tm').textContent = aclock(this.t) + ' / ' + aclock(d.dur);
    if (i !== this.stageIx || this.fresh !== this.freshShown){
      this.stageIx = i; this.freshShown = this.fresh;
      r.querySelectorAll('.ap-st').forEach((b, k) => { b.classList.toggle('on', k === i && !this.fresh); b.classList.toggle('done', k < i && !this.fresh); b.setAttribute('aria-current', k === i && !this.fresh ? 'step' : 'false'); });
      const sn = r.querySelector('.ap-sn'), sc = r.querySelector('.ap-sc');
      if (this.fresh){
        sn.textContent = st.length ? st.length + ' ' + plural(st.length, 'этап', 'этапа', 'этапов') + ' · ' + aclock(d.dur) : '';
        sc.innerHTML = lat(d.intro || d.short || '');
      } else if (st[i]){
        sn.textContent = 'Этап ' + (i + 1) + ' из ' + st.length + ' · ' + st[i].title.replace(/[{}]/g, '');
        sc.innerHTML = lat(st[i].cap || '');
      }
      if (this.opt.onStage) this.opt.onStage(i, this.fresh);
    }
  }
  seek(t, fromTick){
    this.t = Math.max(0, Math.min(this.def.dur, t));
    anRender(this.sc, this.t);
    if (this.opt.onTime) this.opt.onTime(this.t);
    if (!fromTick || Math.abs(this.t - (this.lastUi || 0)) > 0.12 || this.stageAt(this.t) !== this.stageIx){ this.lastUi = this.t; this.ui(); }
  }
  play(){
    if (this.playing) return;
    ANC.stopAll(this);
    if (this.ended || this.t >= this.def.dur - 0.01 || this.fresh) { this.t = 0; this.ended = false; }
    this.fresh = false;
    this.playing = true;
    ANC.active = this;
    this.last = null;
    if (!this.motion){ this.stepRun(); this.ui(); return; }
    this.seek(this.t);
    if (!ANC.raf) ANC.raf = requestAnimationFrame(anTick);
    this.ui();
  }
  /* шаговый режим: без движения, конечное состояние каждого этапа */
  stepRun(){
    clearTimeout(this.stepT);
    const i = this.stageAt(this.t + 0.01);
    const end = this.stageEnd(i);
    this.seek(Math.max(this.t, end - 0.02));
    if (end >= this.def.dur - 0.02){ this.finish(); return; }
    this.stepT = setTimeout(() => { if (!this.playing) return; this.t = end + 0.01; this.stepRun(); }, 4200 / this.rate);
  }
  pause(){
    if (!this.playing) return;
    this.playing = false;
    clearTimeout(this.stepT);
    if (ANC.active === this) ANC.active = null;
    this.ui();
  }
  toggle(){ if (this.playing) this.pause(); else this.play(); }
  restart(){ this.pause(); this.ended = false; this.fresh = false; this.seek(0); this.play(); }
  jump(i){
    const st = this.def.stages || [];
    if (!st[i]) return;
    this.fresh = false; this.ended = false;
    if (!this.motion){ this.pause(); this.seek(this.stageEnd(i) - 0.02); return; }
    this.seek(st[i].t);
    if (!this.playing) this.play();
  }
  setRate(r){
    this.rate = r;
    this.root.querySelectorAll('.ap-rt').forEach(b => { const on = Number(b.dataset.r) === r; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    if (!this.motion && this.playing){ this.stepRun(); }
  }
  finish(){
    this.playing = false;
    clearTimeout(this.stepT);
    if (ANC.active === this) ANC.active = null;
    this.t = this.def.dur; anRender(this.sc, this.t);
    this.ended = true;
    const sm = this.root && this.root.querySelector('.ap-sum');
    if (sm) sm.open = true;
    this.ui();
    if (this.opt.onEnd) this.opt.onEnd();
  }
  destroy(){
    this.pause();
    if (this.io) this.io.disconnect();
    ANC.list.delete(this);
  }
}
function apSum(s){
  if (Array.isArray(s)) return '<ul>' + s.map(x => '<li>' + lat(x) + '</li>').join('') + '</ul>';
  return '<p>' + lat(s) + '</p>';
}
/* образец цвета для обозначений: класс схемы → маленький значок */
function apSwatch(c){
  const [cls, shape] = String(c).split(':');
  if (shape === 'line') return '<line x1="2" y1="7" x2="20" y2="7" class="' + cls + '" stroke-width="3" stroke-linecap="round"/>';
  if (shape === 'dot') return '<circle cx="11" cy="7" r="5" class="' + cls + '" stroke-width="1.4"/>';
  if (shape === 'rod') return '<rect x="2" y="3" width="18" height="8" rx="4" class="' + cls + '" stroke-width="1.4"/>';
  return '<rect x="3" y="2" width="16" height="10" rx="2.5" class="' + cls + '" stroke-width="1.4"/>';
}

/* ---------- плееры на странице ---------- */
/* место для проигрывателя в разметке листа; проигрыватель создаёт anHydrate после вставки листа на страницу */
function apHostHtml(id, no, figId){
  const d = AN_MAP[id];
  if (!d) return '';
  return '<div class="ap-host" data-anim="' + id + '"' + (no ? ' data-no="' + no + '"' : '') + (figId ? ' data-fig="' + figId + '"' : '') + '>' +
    '<figure class="ap ap-fig is-fresh"><div class="ap-head"><h4>' + lat(d.title) + '</h4>' + (no ? '<span class="blk-no">' + no + '</span>' : '') + '</div>' +
    '<div class="ap-stage" style="aspect-ratio:' + d.w + '/' + d.h + '"></div></figure></div>';
}
function anHydrate(root){
  ANC.prune();
  (root || document).querySelectorAll('.ap-host[data-anim]').forEach(h => {
    if (h.apPlayer) return;
    const d = AN_MAP[h.dataset.anim], fid = h.dataset.fig;
    if (!d) return;
    try { h.apPlayer = new AnPlayer(h, d, {mode: 'fig', no: h.dataset.no || '', capHtml: fid ? apCapHtml(fid) : ''}); }
    catch (e) {
      console.warn('анимация ' + d.id + ':', e);
      if (fid && FIG[fid]) h.outerHTML = figBlock(FIG[fid], h.dataset.no || '');
    }
  });
}

/* ---------- просмотр крупно (с листанием по каталогу) ---------- */
let ANV = null;   /* {list:[id], i, player} */
function anvOpen(id, o){
  o = o || {};
  const list = o.list || anvList();
  let i = list.indexOf(id);
  if (i < 0){ list.unshift(id); i = 0; }
  ANC.stopAll();
  ANV = {list, i};
  anvRender(o.t);
}
function anvList(){ return AN_LIST.filter(a => !a.hidden).map(a => a.id); }
function anvRender(t){
  let host = document.getElementById('anv');
  if (!host){ host = document.createElement('div'); host.id = 'anv'; document.body.appendChild(host); }
  if (!ANV){ host.innerHTML = ''; document.documentElement.style.overflow = ''; return; }
  if (ANV.player) ANV.player.destroy();
  const id = ANV.list[ANV.i], d = AN_MAP[id], n = ANV.list.length;
  const tp = d.topic && typeof TMAP !== 'undefined' ? TMAP[d.topic] : null;
  host.innerHTML = '<div class="anv" role="dialog" aria-modal="true" aria-label="' + esc(d.title.replace(/[{}]/g, '')) + '">' +
    '<div class="anv-scrim" data-anv="x"></div><div class="anv-box" tabindex="-1">' +
    '<div class="anv-top"><span class="anv-n">' + (n > 1 ? (ANV.i + 1) + ' из ' + n : '') + '</span>' +
    (tp ? '<a class="anv-topic" href="#' + tp.id + '" data-anv="go">Тема ' + tp.no + '. ' + lat(tp.title) + '</a>' : (d.link ? '<a class="anv-topic" href="' + d.link[0] + '" data-anv="go">' + esc(d.link[1]) + '</a>' : '')) +
    (n > 1 ? '<button class="lb-btn" data-anv="prev" aria-label="Предыдущая анимация">←</button><button class="lb-btn" data-anv="next" aria-label="Следующая анимация">→</button>' : '') +
    '<button class="lb-btn" data-anv="x" aria-label="Закрыть">&times;</button></div>' +
    '<div class="anv-body"><div class="anv-player"></div></div></div></div>';
  document.documentElement.style.overflow = 'hidden';
  const ph = host.querySelector('.anv-player');
  ANV.player = new AnPlayer(ph, d, {mode: 'big', startAt: t != null ? t : null, prm: d.prmDefault});
  const box = host.querySelector('.anv-box');
  if (box) box.focus();
}
function anvClose(){
  if (!ANV) return;
  if (ANV.player) ANV.player.destroy();
  ANV = null;
  anvRender();
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-anv]');
  if (!b || !ANV) return;
  const k = b.dataset.anv;
  if (k === 'x'){ e.preventDefault(); anvClose(); }
  else if (k === 'go'){ anvClose(); }
  else if (k === 'prev' || k === 'next'){
    e.preventDefault();
    ANV.i = (ANV.i + (k === 'next' ? 1 : -1) + ANV.list.length) % ANV.list.length;
    anvRender();
  }
});
document.addEventListener('keydown', e => {
  if (!ANV) return;
  if (e.key === 'Escape'){ e.stopImmediatePropagation(); anvClose(); }
}, true);


/* ===== Помощники для сцен анимаций =====
   Рисование — теми же SV-примитивами, что и статичные схемы атласа, поэтому цвета и шрифты совпадают.
   Подписи с классом h получают «ореол» цвета листа и читаются поверх движущихся объектов. */
const AL = (() => {
  const {tx, rect, circ, line, path, poly} = SV;
  const n1 = v => Math.round(v * 10) / 10;

  /* подпись с ореолом */
  const lab = (x, y, s, o = {}) => tx(x, y, s, Object.assign({s: 14}, o, {c: 'h' + (o.c ? ' ' + o.c : '')}));
  /* капля реагента, центр — в (0, 0) */
  const drop = (cls, k) => { k = k || 1; return '<path d="M0 ' + n1(-13 * k) + ' C' + n1(5 * k) + ' ' + n1(-4 * k) + ' ' + n1(8 * k) + ' ' + n1(1 * k) + ' ' + n1(8 * k) + ' ' + n1(5 * k) +
    ' A' + n1(8 * k) + ' ' + n1(8 * k) + ' 0 0 1 ' + n1(-8 * k) + ' ' + n1(5 * k) + ' C' + n1(-8 * k) + ' ' + n1(1 * k) + ' ' + n1(-5 * k) + ' ' + n1(-4 * k) + ' 0 ' + n1(-13 * k) + 'Z" class="' + cls + '" stroke-width="1.2"/>'; };
  /* номер в кружке */
  const num = (n, cls, r) => { r = r || 11; return circ(0, 0, r, {c: cls || 'gvs', sw: 0}) + '<text x="0" y="' + n1(r * 0.4) + '" font-size="' + n1(r * 1.12) + '" text-anchor="middle" font-weight="600" class="numw">' + n + '</text>'; };
  /* крестик «блок» */
  const block = (r, cls) => { r = r || 9; return circ(0, 0, r, {c: cls || 'saf', sw: 1.8}) + line(-r * 0.55, -r * 0.55, r * 0.55, r * 0.55, {c: (cls || 'saf') + 'l', sw: 2.2}) + line(-r * 0.55, r * 0.55, r * 0.55, -r * 0.55, {c: (cls || 'saf') + 'l', sw: 2.2}); };
  /* галочка */
  const tick = (r, cls) => { r = r || 9; return circ(0, 0, r, {c: cls || 'mg', sw: 1.6}) + path('M' + n1(-r * 0.45) + ' 0 L' + n1(-r * 0.1) + ' ' + n1(r * 0.38) + ' L' + n1(r * 0.5) + ' ' + n1(-r * 0.4), {c: (cls || 'mg') + 'l', sw: 2.2}); };

  /* разбор пути из команд M, L, C, Q (абсолютные координаты) в ломаную */
  function pts(d, k){
    k = k || 18;
    const tok = d.match(/[MLCQ]|-?\d*\.?\d+/g) || [];
    const out = [];
    let i = 0, cmd = '', cx = 0, cy = 0;
    const num = () => Number(tok[i++]);
    while (i < tok.length){
      if (/[MLCQ]/.test(tok[i])) cmd = tok[i++];
      if (cmd === 'M' || cmd === 'L'){ cx = num(); cy = num(); out.push([cx, cy]); }
      else if (cmd === 'C'){
        const x1 = num(), y1 = num(), x2 = num(), y2 = num(), x = num(), y = num();
        for (let s = 1; s <= k; s++){ const t = s / k, u = 1 - t;
          out.push([u * u * u * cx + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x, u * u * u * cy + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y]); }
        cx = x; cy = y;
      } else if (cmd === 'Q'){
        const x1 = num(), y1 = num(), x = num(), y = num();
        for (let s = 1; s <= k; s++){ const t = s / k, u = 1 - t;
          out.push([u * u * cx + 2 * u * t * x1 + t * t * x, u * u * cy + 2 * u * t * y1 + t * t * y]); }
        cx = x; cy = y;
      } else i++;
    }
    return out;
  }
  const pd = p => 'M' + p.map(q => n1(q[0]) + ' ' + n1(q[1])).join(' L');
  /* у ломаной, монотонной по x: y и доля длины в точке x */
  function byX(p){
    const L = [0];
    for (let i = 1; i < p.length; i++) L.push(L[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
    const T = L[L.length - 1];
    return x => {
      let i = 1;
      while (i < p.length - 1 && p[i][0] < x) i++;
      const a = p[i - 1], b = p[i], k = b[0] === a[0] ? 0 : Math.max(0, Math.min(1, (x - a[0]) / (b[0] - a[0])));
      return {y: a[1] + (b[1] - a[1]) * k, u: (L[i - 1] + (L[i] - L[i - 1]) * k) / T};
    };
  }
  /* «облако» из точек вокруг центра: детерминированно */
  function scatter(n, w, h, seed){
    const r = SVR(seed || 3), o = [];
    for (let i = 0; i < n; i++) o.push([(r() - 0.5) * w, (r() - 0.5) * h]);
    return o;
  }
  /* рамка-панель с заголовком (как SV.panel, но заголовок с ореолом не нужен) */
  const panel = (x, y, w, h, title, o = {}) => rect(x, y, w, h, {c: 'sh', r: 12, sw: 1}) + (title ? tx(x + 16, y + 26, title, {s: o.s || 15, a: 'start', w: 600}) : '');
  /* стрелка по ломаной */
  function parrow(p, o = {}){
    const a = p[p.length - 2], b = p[p.length - 1];
    return path(pd(p.slice(0, -1).concat([[b[0] - (b[0] - a[0]) * 0.001, b[1] - (b[1] - a[1]) * 0.001]])), {c: o.c || 'ln', sw: o.sw || 1.6, dash: o.dash}) +
      SV.arrow(a[0], a[1], b[0], b[1], {c: o.c || 'ln', hc: o.hc || 'arw', sw: o.sw || 1.6});
  }
  return {lab, drop, num, block, tick, pts, pd, byX, scatter, panel, parrow, rect, circ, line, path, poly, tx};
})();


/* ===== Анимации вместо иллюстраций конспекта: почкование дрожжей, репарация ДНК, конъюгация ===== */

/* ДНК-«лестница»: основания задаются строкой (A, T, G, C), пары рисуются полуступенями разного цвета */
const ADNA = {
  cls: {A: 'mbl', T: 'safl', G: 'mgl', C: 'yel'},
  pair: {A: 'T', T: 'A', G: 'C', C: 'G'},
  /* полуступень основания: от нити к середине; up — верхняя нить */
  half(b, up, len){ len = len || 15; return SV.line(0, up ? 0 : 0, 0, up ? len : -len, {c: ADNA.cls[b], sw: 4}); }
};

/* ---------- Почкование дрожжей ---------- */
/* ===== Анимации частной вирусологии: грипп, ВИЧ, бешенство =====
   Основа — та же статичная схема атласа (FIG): строение вириона не перерисовывается, поверх неё
   идут подсветка, постепенное открытие подписей и движущиеся частицы. Финальный кадр совпадает со схемой. */

function anFigInner(id){
  const f = FIG[id];
  return f && f.svg ? f.svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '') : '';
}
/* шторка цвета листа: прячет часть схемы до нужного этапа */
function anMask(A, id, x, y, w, h, t, d){
  A.act(id, SV.rect(x, y, w, h, {c: 'sh', sw: 0}), {});
  A.hide(id, t, d == null ? 0.6 : d);
}

/* ---------- Грипп ---------- */
/* ===== Раздел «Все анимации» =====
   Каталог строится из того же реестра AN_LIST, что и анимации в листах тем: одна реализация, одни данные.
   Карточка: превью (финальный кадр), название, описание, тема; «Смотреть» разворачивает проигрыватель в каталоге,
   «Крупно» открывает просмотр с листанием. Одновременно играет только одна анимация (общий контроль ANC). */

const AN_GROUPS = {
  morph: {t: 'Строение и окраска', o: 1},
  phys:  {t: 'Физиология и рост', o: 2},
  fungi: {t: 'Грибы', o: 3},
  vir:   {t: 'Вирусы и бактериофаги', o: 4},
  gen:   {t: 'Генетика бактерий', o: 5},
  eco:   {t: 'Экология, биоплёнки, полость рта', o: 6},
  abx:   {t: 'Антимикробные препараты и устойчивость', o: 7},
  abxmap:{t: 'Механизмы действия антибиотиков (из карты)', o: 8},
  path:  {t: 'Патогенность и токсины', o: 9},
  imm:   {t: 'Иммунитет и иммунодиагностика', o: 10},
  prv:   {t: 'Частная вирусология', o: 11}
};
const ANCF = {q: '', g: ''};
let ancOpen = null;   /* {id, card, player} */

/* в каком листе стоит анимация: по схеме, которую она заменяет */
function anWhere(a){
  const ids = [].concat(a.replaces || []);
  for (const t of TORDER){
    for (const b of t.blocks){
      if ((b.t === 'fig' && ids.includes(b.id)) || (b.t === 'figs' && (b.ids || []).some(x => ids.includes(x)))) return t;
    }
  }
  return a.topic && TMAP[a.topic] ? TMAP[a.topic] : null;
}
function ancList(){ return AN_LIST.filter(a => !a.hidden); }
function ancNorm(v){ return String(v || '').toLowerCase().replace(/[{}]/g, '').replace(/ё/g, 'е'); }
function ancText(a){
  const t = anWhere(a);
  return ancNorm([a.title, a.short, a.kw, (a.stages || []).map(s => s.title).join(' '), t ? t.title : '', (AN_GROUPS[a.group] || {}).t].join(' '));
}

function animCatalogPage(){
  const list = ancList();
  const groups = Object.keys(AN_GROUPS).filter(g => list.some(a => a.group === g)).sort((a, b) => AN_GROUPS[a].o - AN_GROUPS[b].o);
  let h = '<p class="eyebrow">Раздел атласа</p><h1 class="title">Все анимации</h1>' +
    '<p class="lede">Пошаговые процессы атласа в движении: у каждой анимации — этапы с пояснениями, пауза, повтор, выбор скорости и короткий итог. ' +
    'Те же анимации стоят в листах тем на месте прежних пошаговых схем; статичная схема открывается по ссылке под анимацией.</p>' +
    '<div class="anc-tools"><div class="search">' + searchSvg() + '<input id="ancq" type="search" placeholder="Название, процесс, тема" autocomplete="off" value="' + esc(ANCF.q) + '" aria-label="Поиск анимаций"></div>' +
    '<span class="cnt" id="anc-n" aria-live="polite"></span></div>' +
    '<div class="chips" role="group" aria-label="Разделы">' +
    '<button class="chip' + (!ANCF.g ? ' on' : '') + '" data-anc="g" data-v="" aria-pressed="' + !ANCF.g + '">Все<span class="c">' + list.length + '</span></button>' +
    groups.map(g => { const n = list.filter(a => a.group === g).length;
      return '<button class="chip' + (ANCF.g === g ? ' on' : '') + '" data-anc="g" data-v="' + g + '" aria-pressed="' + (ANCF.g === g) + '">' + AN_GROUPS[g].t + '<span class="c">' + n + '</span></button>'; }).join('') + '</div>';
  groups.forEach(g => {
    const part = list.filter(a => a.group === g);
    h += '<section class="anc-sec" data-g="' + g + '"><h2 class="anc-group">' + AN_GROUPS[g].t + '<small>' + part.length + '</small></h2>' +
      (g === 'abxmap' ? '<p class="par">Механизмы отдельных препаратов из интерактивной карты антибиотиков — по одному на каждый тип мишени. Все препараты, режим устойчивости и сравнение — <a href="#abx">на карте</a>.</p>' : '') +
      '<div class="anc-grid">' + part.map(ancCard).join('') + '</div></section>';
  });
  h += '<p class="anc-none" id="anc-none" hidden>Ничего не найдено. Измените запрос или выберите «Все».</p>';
  return h;
}
function ancCard(a){
  const t = anWhere(a), st = (a.stages || []).length;
  let poster = '';
  try { poster = anPoster(a, null, 'anc-svg'); } catch (e) { console.warn('превью ' + a.id, e); }
  return '<article class="anc-card" data-id="' + a.id + '" data-g="' + a.group + '" data-s="' + esc(ancText(a)) + '">' +
    '<button type="button" class="anc-prv" data-anc="play" data-id="' + a.id + '" aria-label="Смотреть: ' + esc(a.title.replace(/[{}]/g, '')) + '">' + poster +
    '<span class="ap-cover"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>Смотреть</span></button>' +
    '<div class="anc-body"><b>' + lat(a.title) + '</b>' + (a.short ? '<p>' + lat(a.short) + '</p>' : '') +
    '<div class="anc-meta"><span>' + st + ' ' + plural(st, 'этап', 'этапа', 'этапов') + ' · ' + aclock(a.dur) + '</span>' +
    (t ? '<a href="#' + t.id + '">Тема ' + t.no + '</a>' : a.link ? '<a href="' + a.link[0] + '">' + esc(a.link[1]) + '</a>' : '') +
    '<span class="anc-acts"><button type="button" class="btn" data-anc="big" data-id="' + a.id + '">Крупно</button></span></div></div></article>';
}

function ancFilter(){
  const q = ancNorm(ANCF.q).trim();
  let n = 0;
  document.querySelectorAll('.anc-card').forEach(c => {
    const on = (!ANCF.g || c.dataset.g === ANCF.g) && (!q || c.dataset.s.includes(q));
    c.hidden = !on; if (on) n++;
  });
  document.querySelectorAll('.anc-sec').forEach(s => { s.hidden = !s.querySelector('.anc-card:not([hidden])'); });
  const nn = document.getElementById('anc-n'); if (nn) nn.textContent = n + ' ' + plural(n, 'анимация', 'анимации', 'анимаций');
  const none = document.getElementById('anc-none'); if (none) none.hidden = n > 0;
  document.querySelectorAll('[data-anc="g"]').forEach(b => { const on = b.dataset.v === ANCF.g; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
}
function ancVisibleIds(){
  return [...document.querySelectorAll('.anc-card:not([hidden])')].map(c => c.dataset.id);
}
function ancCollapse(){
  if (!ancOpen) return;
  const {card, html, player} = ancOpen;
  if (player) player.destroy();
  if (card.isConnected){ card.classList.remove('anc-live'); card.innerHTML = html; }
  ancOpen = null;
}
function ancPlay(id){
  const card = document.querySelector('.anc-card[data-id="' + id + '"]');
  const a = AN_MAP[id];
  if (!card || !a) return;
  ancCollapse();
  const html = card.innerHTML;
  card.classList.add('anc-live');
  card.innerHTML = '<div class="anc-host"></div><div class="anc-meta" style="padding:0 18px 12px"><button type="button" class="btn" data-anc="close">Свернуть</button></div>';
  const t = anWhere(a);
  const cap = (t ? 'Где в атласе: <a href="#' + t.id + '">тема ' + t.no + '. ' + lat(t.title) + '</a>.' : a.link ? '<a href="' + a.link[0] + '">' + esc(a.link[1]) + '</a>' : '');
  const player = new AnPlayer(card.querySelector('.anc-host'), a, {mode: 'card', capHtml: cap, prm: a.prmDefault});
  ancOpen = {id, card, html, player};
  player.play();
  card.scrollIntoView({block: 'nearest', behavior: ANC.rm.matches ? 'auto' : 'smooth'});
  const pp = card.querySelector('.ap-pp'); if (pp) pp.focus({preventScroll: true});
}
function ancMount(arg){
  ancOpen = null;
  const q = document.getElementById('ancq');
  if (q) q.addEventListener('input', () => { ANCF.q = q.value; ancFilter(); });
  ancFilter();
  if (arg && AN_MAP[arg]) requestAnimationFrame(() => {
    const c = document.querySelector('.anc-card[data-id="' + arg + '"]');
    if (c){ if (c.hidden){ ANCF.q = ''; ANCF.g = ''; if (q) q.value = ''; ancFilter(); } c.scrollIntoView({block: 'center'}); }
    anvOpen(arg, {list: ancVisibleIds()});
  });
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-anc]');
  if (!b) return;
  const k = b.dataset.anc;
  if (k === 'g'){ ANCF.g = b.dataset.v; ancFilter(); }
  else if (k === 'play') ancPlay(b.dataset.id);
  else if (k === 'big'){ ancCollapse(); anvOpen(b.dataset.id, {list: ancVisibleIds()}); }
  else if (k === 'close'){ const id = ancOpen && ancOpen.id; ancCollapse(); const c = id && document.querySelector('.anc-card[data-id="' + id + '"] .anc-prv'); if (c) c.focus(); }
});


/* ===== Связка новых разделов с интерфейсом атласа =====
   Разделы: «Материал» (всё прежнее содержание), «Все анимации» (#anim), «Интерактивная карта антибиотиков» (#abx).
   app.js вызывает: v7Tabs() в указателе, v7Before/v7After в render(), v7Search в поиске, v7HomeCards на главной. */

const V7TABS = [
  {id:'mat', h:'#', t:'Материал', m:'Материал',
   ic:'<path d="M4.5 5.5c2.6-.9 5.1-.6 7.5.9v12.2c-2.4-1.5-4.9-1.8-7.5-.9zM19.5 5.5c-2.6-.9-5.1-.6-7.5.9v12.2c2.4-1.5 4.9-1.8 7.5-.9z"/>'},
  {id:'anim', h:'#anim', t:'Все анимации', m:'Анимации',
   ic:'<circle cx="12" cy="12" r="8.2"/><path d="M10.2 8.6v6.8l5.4-3.4z"/>'},
  {id:'abx', h:'#abx', t:'Интерактивная карта антибиотиков', m:'Карта антибиотиков',
   ic:'<rect x="3.5" y="7" width="17" height="10" rx="5"/><circle cx="9" cy="12" r="1.6"/><path d="M13 10.5l3 3M16 10.5l-3 3"/>'}
];
function v7Tab(r){ return r && r.v === 'anim' ? 'anim' : r && r.v === 'abx' ? 'abx' : 'mat'; }
function v7Tabs(){
  return '<nav class="tabs7" aria-label="Разделы атласа">' + V7TABS.map(x =>
    '<a href="' + x.h + '" data-tab="' + x.id + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + x.ic + '</svg><span>' + x.t + '</span></a>').join('') + '</nav>';
}
function v7MobileTabs(){
  const n = document.getElementById('mtabs');
  if (n && !n.firstChild) n.innerHTML = V7TABS.map(x => '<a href="' + x.h + '" data-tab="' + x.id + '"' + (x.m !== x.t ? ' aria-label="' + x.t + '"' : '') + '>' + x.m + '</a>').join('');
}

/* перед перерисовкой листа: остановить и забыть проигрыватели, закрыть просмотр крупно */
function v7Before(r){
  ANC.stopAll();
  ANC.list.forEach(p => p.destroy());
  if (typeof abxUnmount === 'function' && !(r && r.v === 'abx')) abxUnmount();
}
function v7After(r){
  v7MobileTabs();
  const cur = v7Tab(r);
  document.querySelectorAll('[data-tab]').forEach(a => { if (a.dataset.tab === cur) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const main = document.getElementById('main');
  anHydrate(main);
  if (r.v === 'anim' && typeof ancMount === 'function') ancMount(r.arg);
  if (r.v === 'abx' && typeof abxMount === 'function') abxMount(r.arg);
}

/* анимация вместо пошаговой схемы: тот же номер, подпись и исходная схема по кнопке */
function apFigHtml(figId, no){
  return apHostHtml(AN_FIG[figId], no, figId);
}
function apCapHtml(figId){
  const f = FIG[figId];
  if (!f) return '';
  return (f.cap ? lat(f.cap) + ' ' : '') +
    '<button type="button" class="ap-orig" data-lb="fig" data-id="' + figId + '">' + (f.img ? 'Иллюстрация из конспекта' : 'Статичная схема целиком') + '</button>' +
    (f.src ? '<span class="fig-src">' + lat(f.src) + '</span>' : '');
}

/* общий поиск атласа: анимации и препараты карты */
function v7Search(q, out){
  const norm = v => String(v || '').toLowerCase().replace(/[{}]/g, '').replace(/ё/g, 'е');
  const qq = norm(q);
  AN_LIST.forEach(a => {
    if (a.hidden) return;
    if ([a.title, a.short, a.kw].some(v => v && norm(v).includes(qq)))
      out.unshift({h:'#anim/' + a.id, t:a.title, s:'Анимация · ' + ((AN_GROUPS[a.group] || {}).t || 'все анимации')});
  });
  if (typeof abxSearch === 'function') abxSearch(qq).slice(0, 6).reverse().forEach(d =>
    out.unshift({h:'#abx/' + d.id, t:d.ru, s:'Карта антибиотиков · ' + abxClassName(d)}));
}

/* главная: два новых входа */
function v7HomeCards(){
  const nA = MICRO_CATALOG.animations.length+15;
  const nD = MICRO_CATALOG.drugs;
  const nC = MICRO_CATALOG.classes;
  return '<div class="home7">' +
    '<a href="#anim"><svg viewBox="0 0 52 52" class="sv" aria-hidden="true"><rect x="2" y="2" width="48" height="48" rx="12" class="gv" stroke-width="1.4"/><path d="M21 16v20l16-10z" class="gvs"/></svg>' +
      '<b>Все анимации</b><small>' + nA + ' ' + plural(nA, 'анимация', 'анимации', 'анимаций') + ' процессов: окраска по Граму, циклы вирусов, перенос генов, токсины, реакции иммунитета — с этапами, паузой и повтором</small></a>' +
    '<a href="#abx"><svg viewBox="0 0 52 52" class="sv" aria-hidden="true"><rect x="2" y="10" width="48" height="32" rx="16" class="saf" stroke-width="1.4"/><rect x="8" y="16" width="36" height="20" rx="10" class="nt" stroke-width="1.2"/><circle cx="20" cy="26" r="4" class="mb" stroke-width="1.4"/><path d="M29 22l7 8M36 22l-7 8" class="orl" stroke-width="2.2" stroke-linecap="round"/></svg>' +
      '<b>Интерактивная карта антибиотиков</b><small>' + (nD ? nD + ' ' + plural(nD, 'препарат', 'препарата', 'препаратов') + ' из ' + nC + ' ' + plural(nC, 'класса', 'классов', 'классов') + ': ' : '') + 'путь через оболочку, мишень, механизм и устойчивость на срезе бактериальной клетки</small></a>' +
    '</div>';
}
function v7HomeList(){
  return '<li><b>Все анимации</b> — пошаговые схемы атласа, превращённые в анимации процессов: у каждой — этапы, пауза, повтор, скорость и пояснение. Те же анимации стоят в листах тем.</li>' +
    '<li><b>Интерактивная карта антибиотиков</b> — срез бактериальной клетки: выберите препарат, чтобы увидеть, как он проходит оболочку, с чем связывается и что нарушает, а в режиме устойчивости — какие механизмы описаны именно для него.</li>';
}
