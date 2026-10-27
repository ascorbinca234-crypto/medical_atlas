import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, Waves, HeartCrack, CirclePause, Droplet, CircleDot, Flame, Thermometer, Wind, FlaskConical, Droplets,
  Search, BookOpen, GraduationCap, Lock, Check, CircleCheck, Eye, Shuffle, Menu, X, ChevronRight,
  RotateCw, TriangleAlert, Zap, Target, ShieldCheck, Stethoscope, Table2, Layers, ListChecks, Microscope,
  LayoutGrid, RefreshCw, ArrowRight, ThumbsUp, ThumbsDown, Play, ChevronDown, Pause, Film, ChevronLeft, Sparkles, Quote, ClipboardCheck,
  ScrollText, Workflow, Shield, Hexagon, Dna, ShieldAlert, Sprout, Siren, UtensilsCrossed,
  TestTube, HeartPulse, AirVent, Bean, Filter, Soup, SlidersHorizontal, Brain,
} from 'lucide-react';
import catalog from "./catalog.json";
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&family=Literata:opsz,wght@7..72,500;7..72,600;7..72,700&display=swap');
/* Раскладка: тёмно-индиговая навигация слева, светлое поле чтения справа.
   Цвет кодирует роль в патогенезе: синий — этиология, красный — альтерация и главное звено,
   зелёный — саногенез и компенсация, фиолетовый — проявления и исходы. */
:root{
  --bg:#F4F5F9; --surface:#FFFFFF; --surface-2:#EDEFF5; --ink:#1A1F33; --ink-2:#4B5268; --ink-3:#737A92; --line:#DCE0EA;
  --nav:#1C2140; --nav-2:#262C56; --nav-3:#323A70; --nav-ink:#E8EAF6; --nav-ink-2:#A3A9CA;
  --accent:#3E49C2; --accent-ink:#FFFFFF; --accent-soft:#E9EBFB; --on-tone:#FFFFFF; --mark:#FFE68A;
  --etio:#2563EB; --etio-bg:#EAF1FE; --etio-ink:#1D4CBD; --etio-line:#BFD3FB;
  --alt:#D9322B; --alt-bg:#FDEEEC; --alt-ink:#AF241C; --alt-line:#F3BFB9;
  --san:#16834A; --san-bg:#E7F5EC; --san-ink:#11663A; --san-line:#B3DDC2;
  --clin:#7A3FE0; --clin-bg:#F2ECFD; --clin-ink:#612EC0; --clin-line:#D6C6F7;
  --f-display:'Literata', Georgia, 'Times New Roman', serif;
  --f-body:'Golos Text', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
  --f-mono:'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --bg:#0F1220; --surface:#161A2B; --surface-2:#1E2337; --ink:#E6E8F2; --ink-2:#AEB3C7; --ink-3:#848AA2; --line:#2B3148;
    --nav:#0A0D18; --nav-2:#181D33; --nav-3:#252B4A; --nav-ink:#E6E8F5; --nav-ink-2:#9298B8;
    --accent:#8E97F7; --accent-ink:#0F1220; --accent-soft:#1F2550; --on-tone:#0F1220; --mark:#5C4B10;
    --etio:#6AA8FF; --etio-bg:#13243F; --etio-ink:#9CC5FF; --etio-line:#25446F;
    --alt:#FF7A70; --alt-bg:#361717; --alt-ink:#FFA9A2; --alt-line:#6A2723;
    --san:#4FD58B; --san-bg:#0F2D1E; --san-ink:#8DE8B3; --san-line:#1E5638;
    --clin:#B394FF; --clin-bg:#241A42; --clin-ink:#CDB8FF; --clin-line:#463377;
    color-scheme:dark;
  }
}
:root[data-theme="dark"]{
  --bg:#0F1220; --surface:#161A2B; --surface-2:#1E2337; --ink:#E6E8F2; --ink-2:#AEB3C7; --ink-3:#848AA2; --line:#2B3148;
  --nav:#0A0D18; --nav-2:#181D33; --nav-3:#252B4A; --nav-ink:#E6E8F5; --nav-ink-2:#9298B8;
  --accent:#8E97F7; --accent-ink:#0F1220; --accent-soft:#1F2550; --on-tone:#0F1220; --mark:#5C4B10;
  --etio:#6AA8FF; --etio-bg:#13243F; --etio-ink:#9CC5FF; --etio-line:#25446F;
  --alt:#FF7A70; --alt-bg:#361717; --alt-ink:#FFA9A2; --alt-line:#6A2723;
  --san:#4FD58B; --san-bg:#0F2D1E; --san-ink:#8DE8B3; --san-line:#1E5638;
  --clin:#B394FF; --clin-bg:#241A42; --clin-ink:#CDB8FF; --clin-line:#463377;
  color-scheme:dark;
}
body{ background:var(--bg); color:var(--ink); }
body::before{ content:""; position:fixed; inset:0 0 auto; height:env(safe-area-inset-top,0px); z-index:60; background:var(--bg); }
.pa-root{ font-family:var(--f-body); background:var(--bg); color:var(--ink); font-size:15px; line-height:1.55; -webkit-font-smoothing:antialiased; }
.font-display{ font-family:var(--f-display); }
.font-mono-pa{ font-family:var(--f-mono); }
.tabnum{ font-variant-numeric:tabular-nums; }
.text-balance{ text-wrap:balance; }
.pa-gutter{ padding-left:max(16px, env(safe-area-inset-left,0px)); padding-right:max(16px, env(safe-area-inset-right,0px)); }
@media (min-width:1024px){ .pa-gutter{ padding-left:max(40px, env(safe-area-inset-left,0px)); padding-right:max(40px, env(safe-area-inset-right,0px)); } }
.pa-sticky{ top:env(safe-area-inset-top,0px); }
.pa-sticky-tabs{ top:calc(env(safe-area-inset-top,0px) + 57px); }
.pa-eyebrow{ font-size:11px; letter-spacing:.09em; text-transform:uppercase; font-weight:600; line-height:1.3; }
.pa-muted{ color:var(--ink-2); } .pa-faint{ color:var(--ink-3); } .ink-accent{ color:var(--accent); }
.pa-card{ background:var(--surface); border:1px solid var(--line); }
.pa-card-link{ transition:border-color .15s, transform .15s; }
.pa-card-link:hover{ border-color:var(--accent); }
.pa-def{ background:var(--accent-soft); border:1px solid var(--line); }
.pa-answer{ background:var(--surface-2); border:1px solid var(--line); }
.pa-chip{ background:var(--surface-2); color:var(--ink-2); border-color:var(--line); }
.pa-icon{ background:var(--surface-2); color:var(--ink-2); }
.pa-dot-accent{ background:var(--accent); }
.pa-rail{ background:var(--line); }
.pa-mark{ background:var(--mark); color:inherit; border-radius:3px; padding:0 1px; }
.pa-up{ color:var(--alt-ink); font-weight:700; } .pa-down{ color:var(--etio-ink); font-weight:700; }
.tone-etio{ background:var(--etio-bg); color:var(--etio-ink); border-color:var(--etio-line); }
.tone-alt, .tone-main{ background:var(--alt-bg); color:var(--alt-ink); border-color:var(--alt-line); }
.tone-san{ background:var(--san-bg); color:var(--san-ink); border-color:var(--san-line); }
.tone-clin{ background:var(--clin-bg); color:var(--clin-ink); border-color:var(--clin-line); }
.ink-etio{ color:var(--etio-ink); } .ink-alt, .ink-main{ color:var(--alt-ink); } .ink-san{ color:var(--san-ink); } .ink-clin{ color:var(--clin-ink); }
.dot-etio{ background:var(--etio); color:var(--on-tone); } .dot-alt{ background:var(--alt); color:var(--on-tone); }
.dot-main{ background:var(--alt); color:var(--on-tone); box-shadow:0 0 0 4px var(--alt-bg); }
.dot-san{ background:var(--san); color:var(--on-tone); } .dot-clin{ background:var(--clin); color:var(--on-tone); }
.pa-step{ background:var(--surface); border-color:var(--line); }
.pa-mainstep{ background:var(--alt-bg); border:2px solid var(--alt); }
.pa-step-hidden{ background:var(--surface-2); border-style:dashed; }
.pa-btn{ display:inline-flex; align-items:center; gap:.5rem; border:1px solid var(--line); background:var(--surface); color:var(--ink); border-radius:10px; padding:.5rem .85rem; font-size:14px; font-weight:500; line-height:1.2; transition:background .15s, border-color .15s; cursor:pointer; }
.pa-btn:not([class*="tone-"]):hover{ background:var(--surface-2); }
.pa-btn[class*="tone-"]:hover{ filter:brightness(.97); }
.pa-btn.tone-etio{ background:var(--etio-bg); color:var(--etio-ink); border-color:var(--etio-line); }
.pa-btn.tone-alt{ background:var(--alt-bg); color:var(--alt-ink); border-color:var(--alt-line); }
.pa-btn.tone-san{ background:var(--san-bg); color:var(--san-ink); border-color:var(--san-line); }
.pa-btn.tone-clin{ background:var(--clin-bg); color:var(--clin-ink); border-color:var(--clin-line); }
.pa-btn-primary{ background:var(--accent); color:var(--accent-ink); border-color:var(--accent); }
.pa-btn-primary:not([class*="tone-"]):hover{ background:var(--accent); filter:brightness(1.07); }
.pa-seg{ display:inline-flex; background:var(--surface-2); border:1px solid var(--line); border-radius:11px; padding:3px; gap:2px; }
.pa-seg button{ display:inline-flex; align-items:center; gap:6px; padding:6px 11px; border-radius:8px; font-size:13px; font-weight:500; color:var(--ink-2); white-space:nowrap; }
.pa-seg button:hover{ color:var(--ink); }
.pa-seg button.is-on{ background:var(--surface); color:var(--ink); box-shadow:0 1px 2px rgba(15,18,32,.14); }
.pa-topbar{ background:var(--bg); border-color:var(--line); }
@supports (backdrop-filter: blur(8px)){ .pa-topbar{ background:color-mix(in srgb, var(--bg) 86%, transparent); backdrop-filter:blur(10px); } }
.pa-tabs{ background:var(--bg); border-bottom:1px solid var(--line); }
.pa-tab{ display:inline-flex; align-items:center; gap:7px; padding:12px 2px 11px; border-bottom:2px solid transparent; color:var(--ink-2); font-size:14px; font-weight:500; white-space:nowrap; }
.pa-tab:hover{ color:var(--ink); }
.pa-tab.is-active{ color:var(--ink); border-bottom-color:var(--accent); }
.pa-tab .pa-count{ font-size:11px; padding:1px 6px; border-radius:99px; background:var(--surface-2); color:var(--ink-3); font-variant-numeric:tabular-nums; }
.pa-nav{ background:var(--nav); color:var(--nav-ink); }
.pa-nav-muted{ color:var(--nav-ink-2); }
.pa-navitem{ color:var(--nav-ink); border-radius:10px; transition:background .12s; }
.pa-navitem:hover{ background:var(--nav-2); }
.pa-navitem.is-active{ background:var(--nav-3); box-shadow:inset 0 0 0 1px rgba(255,255,255,.07); }
.pa-navlocked{ color:var(--nav-ink-2); }
.pa-search{ background:var(--nav-2); color:var(--nav-ink); border:1px solid var(--nav-3); }
.pa-search::placeholder{ color:var(--nav-ink-2); }
.pa-search:focus{ outline:none; border-color:var(--accent); }
.pa-navbadge{ background:var(--nav-3); color:var(--nav-ink-2); }
.pa-nav .pa-mark{ background:rgba(255,230,138,.28); color:var(--nav-ink); }
.pa-table{ border-collapse:collapse; }
.pa-table th, .pa-table td{ padding:10px 12px; border-bottom:1px solid var(--line); vertical-align:top; font-size:13.5px; line-height:1.45; text-align:left; }
.pa-table thead th{ background:var(--surface-2); font-size:12.5px; color:var(--ink-2); font-weight:600; }
.pa-table tbody th{ font-weight:600; color:var(--ink); }
.pa-table tbody tr:last-child th, .pa-table tbody tr:last-child td{ border-bottom:none; }
.pa-blur{ filter:blur(5px); cursor:pointer; user-select:none; transition:filter .2s; }
.pa-blur:hover{ filter:blur(3.5px); }
.pa-progress{ background:var(--surface-2); } .pa-progress > span{ background:var(--accent); display:block; height:100%; border-radius:inherit; }
.pa-ring-node{ background:var(--surface); border:1px solid var(--line); }
.pa-scroll{ scrollbar-width:thin; }
.pa-root button{ cursor:pointer; }
.pa-say{ background:var(--surface-2); border-left:3px solid var(--accent); }
.pa-expert-lead{ background:var(--accent-soft); border:1px solid var(--line); }
.pa-chip-neutral{ background:var(--surface-2); color:var(--ink-2); border-color:var(--line); }
.pa-root :focus-visible{ outline:2px solid var(--accent); outline-offset:2px; border-radius:6px; }
@media (prefers-reduced-motion: reduce){ .pa-root *{ transition:none !important; animation:none !important; } }
`;

const T_DISEASE = {
  id: 'disease', section: 'nozo', icon: 'ScrollText',
  title: 'Болезнь и этиология',
  short: 'Норма, болезнь, причины и условия, терминальные состояния',
  tags: ['здоровье', 'норма', 'патологическая реакция', 'патологический процесс', 'патологическое состояние', 'монокаузализм', 'кондиционализм', 'факторы риска', 'клиническая смерть', 'агония'],
  definition: 'Болезнь — нарушение нормальной жизнедеятельности организма при действии повреждающих факторов, в котором повреждение сочетается с защитно-приспособительными реакциями и которое проявляется снижением адаптационных возможностей и трудоспособности.',
  defNote: 'Этиология — учение о причинах и условиях возникновения болезней. Причина — фактор, без которого болезнь не возникает и который определяет её специфику. Условия — факторы, которые сами болезнь не вызывают, но способствуют или препятствуют действию причины.',
  classification: [
    { axis: 'Основные понятия нозологии', items: [
      'Патологическая реакция — кратковременная необычная (неадекватная) реакция на воздействие: ортостатическое падение АД, крапивница после клубники.',
      'Патологический процесс — сочетание местных и общих реакций на повреждение, развивающееся во времени: воспаление, лихорадка, гипоксия.',
      'Типовой патологический процесс — сложившийся в эволюции, стереотипный независимо от причины, вида животного и локализации.',
      'Патологическое состояние — медленно развивающийся процесс или стойкое последствие болезни: рубец, культя, анкилоз, приобретённый порок сердца.',
      'Болезнь — сочетание реакций, процессов и состояний со снижением адаптации.',
    ]},
    { axis: 'Периоды болезни', items: [
      'Латентный (для инфекций — инкубационный): от действия причины до первых симптомов.',
      'Продромальный: первые неспецифические проявления (слабость, недомогание, субфебрилитет).',
      'Разгара (выраженных проявлений): развёрнутая специфическая картина.',
      'Исхода: полное или неполное выздоровление, рецидив, переход в хроническую форму, осложнение, смерть.',
    ]},
    { axis: 'Направления учения об этиологии', items: [
      'Монокаузализм (Р. Кох, Л. Пастер) — болезнь определяется одной причиной; не объясняет носительство и разную восприимчивость.',
      'Кондиционализм (М. Ферворн) — болезнь — результат совокупности равнозначных условий; отрицает главенство причины.',
      'Конституционализм — решающая роль наследственности и конституции.',
      'Современный взгляд: причина необходима и определяет специфику; условия определяют вероятность, тяжесть и течение болезни.',
    ]},
  ],
  etiology: [
    'Физические: механические, термические, электрические, радиационные, барометрические факторы.',
    'Химические: экзогенные яды, лекарства (ятрогении), эндогенные токсины.',
    'Биологические: вирусы, бактерии, грибы, простейшие, гельминты.',
    'Психогенные и социальные: психотравма, условия труда и быта.',
    'Генетические: мутации и наследственная предрасположенность.',
    'Факторы риска — условия, статистически повышающие вероятность болезни (курение, гиподинамия, ожирение), но не являющиеся её причиной.',
  ],
  signs: [
    { s: 'Здоровье по уставу ВОЗ', m: 'Состояние полного физического, душевного и социального благополучия, а не только отсутствие болезней и физических дефектов.' },
    { s: 'Норма', m: 'Среднестатистическая (в пределах M ± 2σ), идеальная, индивидуальная, функциональная (адаптивная) — оптимум для данного организма и условий.' },
    { s: 'Предболезнь', m: 'Состояние сниженной адаптации без явной болезни; действие причины уже началось, но защитные механизмы справляются.' },
    { s: 'Ремиссия и рецидив', m: 'Ремиссия — временное ослабление или исчезновение проявлений; рецидив — возврат болезни после кажущегося выздоровления.' },
  ],
  flows: [
    { title: 'Терминальные состояния (умирание)', steps: [
      { k: 'trigger', t: 'Тяжёлое повреждение', d: 'Массивная кровопотеря, шок, асфиксия, тяжёлая травма, остановка сердца.' },
      { k: 'primary', l: 'Преагония', t: 'Угнетение ЦНС и прогрессирующая гипотензия', d: 'Спутанность или потеря сознания, падение АД, тахикардия сменяется брадикардией, учащённое поверхностное дыхание. Длительность — от минут до часов.' },
      { k: 'secondary', l: 'Терминальная пауза', t: 'Временная остановка дыхания', d: 'От нескольких секунд до 3–4 минут; брадикардия, исчезновение роговичного рефлекса. Бывает не всегда.' },
      { k: 'secondary', l: 'Агония', t: 'Последняя вспышка жизнедеятельности', d: 'Растормаживание продолговатого мозга при выключении коры: агональное дыхание (гаспинг), кратковременный подъём АД, иногда проблеск сознания.' },
      { k: 'main', l: 'Клиническая смерть', t: 'Остановка дыхания и кровообращения — обратимый этап', d: 'При нормотермии длится около 5–6 минут — столько выдерживают нейроны коры. Это окно для реанимации.' },
      { k: 'outcome', l: 'Биологическая смерть', t: 'Необратимые изменения', d: 'Гибель прежде всего коры, затем подкорковых структур и других органов. Достоверные признаки: трупные пятна, трупное окоченение, «кошачий глаз».' },
    ]},
    { title: 'Как развивается болезнь: причина и условия', steps: [
      { k: 'trigger', t: 'Действие причины', d: 'Например, Mycobacterium tuberculosis — без неё туберкулёза нет, и она определяет специфику болезни.' },
      { k: 'primary', l: 'Условия', t: 'Способствующие и препятствующие факторы', d: 'Иммунодефицит (ВИЧ), голодание, сахарный диабет, плохие жилищные условия повышают вероятность болезни; хорошее питание и иммунитет — снижают.' },
      { k: 'main', t: 'Взаимодействие причины с реактивностью организма', d: 'Исход контакта определяет не только причина, но и состояние организма: большинство инфицированных остаются здоровыми носителями.' },
      { k: 'secondary', l: 'Повреждение и защита', t: 'Борьба патологического и защитного', d: 'Одновременно развиваются повреждение и саногенетические реакции.' },
      { k: 'outcome', t: 'Исход', d: 'Предболезнь без перехода в болезнь, болезнь с выздоровлением, хронизация или смерть.' },
    ]},
  ],
  sanogenesis: [
    'Реанимация эффективна в период клинической смерти; гипотермия удлиняет его за счёт снижения обмена нейронов.',
    'При медленном умирании (длительная агония) клиническая смерть короче: запасы энергии в нейронах истощены заранее.',
    'Выздоровление обеспечивают защитные, компенсаторные и восстановительные реакции (см. тему «Общий патогенез»).',
  ],
  circles: [
    { kind: 'vicious', title: 'Умирание: гипоксия мозга и жизненно важные центры', nodes: ['Гипоксия мозга', 'Угнетение дыхательного и сосудодвигательного центров', 'Гиповентиляция и падение АД', 'Углубление гипоксии мозга'], brk: 'ИВЛ, восстановление кровообращения (компрессии грудной клетки, дефибрилляция, вазопрессоры), оксигенация.' },
    { kind: 'vicious', title: 'Хронизация болезни', nodes: ['Неполное выздоровление', 'Остаточный дефект и сниженная резистентность', 'Повторное действие причины или условий', 'Обострение и новый дефект'], brk: 'Устранение причины и неблагоприятных условий, реабилитация, вторичная профилактика.' },
  ],
  traps: [
    { q: 'Чем патологическая реакция отличается от патологического процесса и состояния?', a: 'Реакция кратковременна (секунды–часы) и неадекватна раздражителю. Процесс развивается во времени и включает местные и общие изменения (воспаление). Состояние стабильно или медленно меняется — это последствие или исход (рубец, анкилоз). Одно может переходить в другое: процесс (воспаление) → состояние (рубец).' },
    { q: 'Чем причина отличается от условия и фактора риска?', a: 'Причина обязательна и определяет специфику. Условие без причины болезнь не вызывает, но меняет вероятность и течение. Фактор риска — статистическая связь, установленная эпидемиологически; это не обязательно условие в строгом смысле.' },
    { q: 'Какова критика монокаузализма и кондиционализма?', a: 'Монокаузализм не объясняет, почему при контакте с одной и той же причиной заболевают не все. Кондиционализм уравнивает причину с условиями и делает этиотропное лечение бессмысленным, хотя антибиотик, устраняющий причину, излечивает инфекцию.' },
    { q: 'Сколько длится клиническая смерть и что её удлиняет?', a: 'Около 5–6 минут при нормотермии. Удлиняют гипотермия (утопление в холодной воде) и внезапность умирания; укорачивают длительная агония, исходная гипоксия, гипертермия, старость.' },
    { q: 'Какие органы погибают первыми при умирании и почему?', a: 'Кора больших полушарий: высокая потребность в O₂ при минимальных запасах гликогена и креатинфосфата. Затем подкорка, ствол; печень, почки и мышцы живут дольше — поэтому возможна трансплантация органов после смерти мозга.' },
    { q: 'Что такое ятрогения?', a: 'Болезнь или осложнение, вызванные действиями медицинского работника: побочное действие лекарств, осложнения процедур, а также психогенные ятрогении, когда неосторожное слово врача формирует у пациента патологические переживания.' },
  ],
  quiz: [
    { q: 'Отнесите к категориям: крапивница после клубники; воспаление лёгких; рубец после ожога; повышение АД при волнении у гипертоника.', a: 'Крапивница — патологическая реакция; воспаление — патологический процесс; рубец — патологическое состояние; повышение АД при волнении у гипертоника — патологическая реакция на фоне болезни (гипертонической).' },
    { q: 'Почему из сотни людей, вдохнувших микобактерии туберкулёза, заболевают единицы?', a: 'Причина необходима, но недостаточна: значимы условия (иммунитет, питание, сопутствующие болезни, генетика, доза возбудителя) и реактивность организма.' },
    { q: 'Ребёнок извлечён из ледяной воды через 20 минут, сердечная деятельность восстановлена без грубого неврологического дефицита. Как это возможно?', a: 'Гипотермия снизила потребность нейронов в O₂ и замедлила накопление повреждения, удлинив период клинической смерти.' },
    { q: 'У пациента при длительной агонии реанимация оказалась неэффективной уже через 2–3 минуты остановки сердца. Почему?', a: 'При медленном умирании запасы энергии и устойчивость нейронов исчерпываются ещё до остановки кровообращения, поэтому период клинической смерти короче.' },
  ],
  tables: [
    { title: 'Нозологические понятия', head: ['Понятие', 'Длительность', 'Суть', 'Примеры'], rows: [
      ['Патологическая реакция', 'секунды–часы', 'необычный ответ на раздражитель', 'обморок при виде крови, крапивница'],
      ['Патологический процесс', 'часы–недели', 'комплекс местных и общих изменений', 'воспаление, лихорадка, тромбоз'],
      ['Патологическое состояние', 'месяцы–годы', 'стойкое отклонение, последствие', 'рубец, анкилоз, культя, косолапость'],
      ['Болезнь', 'различная', 'сочетание реакций, процессов, состояний со снижением адаптации', 'пневмония, гипертоническая болезнь'],
    ]},
    { title: 'Терминальные состояния', head: ['Стадия', 'Сознание', 'Дыхание', 'Кровообращение'], rows: [
      ['Преагония', 'спутанность, сопор', 'учащённое, поверхностное', 'АД ↓, тахикардия → брадикардия'],
      ['Терминальная пауза', 'отсутствует', 'остановка на секунды–минуты', 'брадикардия, эпизоды асистолии'],
      ['Агония', 'отсутствует (возможен проблеск)', 'агональное (гаспинг)', 'кратковременный подъём АД'],
      ['Клиническая смерть', 'отсутствует', 'отсутствует', 'нет; обратимо ~5–6 мин'],
      ['Биологическая смерть', '—', '—', 'необратимые изменения'],
    ]},
  ],
};

const T_PATHOGEN = {
  id: 'pathogenesis', section: 'nozo', icon: 'Workflow',
  title: 'Общий патогенез',
  short: 'Звенья, главное звено, порочные круги, саногенез',
  tags: ['главное звено', 'пусковое звено', 'причинно-следственные связи', 'порочный круг', 'саногенез', 'Павленко', 'Крыжановский', 'ГПУВ', 'местное и общее', 'патогенетическая терапия'],
  definition: 'Патогенез — учение о механизмах возникновения, развития и исхода болезней, патологических процессов и состояний. Патогенез конкретной болезни — совокупность взаимосвязанных механизмов (звеньев), разворачивающихся после действия причины.',
  defNote: 'Главное (ведущее) звено — изменение, которое необходимо для развития всех последующих и устранение которого ликвидирует болезнь или её основные проявления. Порочный круг — замкнутая цепь, в которой следствие усиливает причину (положительная обратная связь).',
  classification: [
    { axis: 'Звенья патогенеза', items: [
      'Пусковое (инициальное) — первичное повреждение, вызванное причиной.',
      'Главное (ведущее) — определяет все последующие изменения и специфику болезни.',
      'Второстепенные — вытекают из главного; их устранение облегчает состояние, но не прерывает болезнь.',
    ]},
    { axis: 'Уровни повреждения', items: [
      'Молекулярный, клеточный, тканевой, органный, системный, организменный.',
    ]},
    { axis: 'Пути распространения повреждения', items: [
      'Контактный (по продолжению), гематогенный, лимфогенный, по нервным стволам (столбнячный токсин, вирус бешенства), по ликвору, интраканаликулярный.',
    ]},
    { axis: 'Саногенетические механизмы (по С.М. Павленко)', items: [
      'Первичные — существуют и в здоровом организме: барьеры, фагоцитоз, детоксикация.',
      'Вторичные — возникают при болезни: защитные (воспаление, кашель, рвота), компенсаторные (гипертрофия второй почки), восстановительные (регенерация), адаптационные (перестройка обмена).',
      'Срочные и долговременные.',
    ]},
  ],
  etiology: [
    'Патогенез запускает причина, но дальше процесс может идти самостоятельно, уже без неё (автономизация): ожоговая болезнь продолжается после прекращения действия тепла.',
    'Специфические механизмы определяются причиной, неспецифические — стереотипны (стресс, воспаление, лихорадка).',
    'Местное и общее: Р. Вирхов считал болезнь суммой поражений клеток (целлюлярная патология); отечественная школа нервизма (И.П. Павлов, А.Д. Сперанский) подчёркивала роль целостной регуляции. Современный взгляд — единство местного и общего.',
  ],
  signs: [
    { s: 'Этиотропная терапия', m: 'Направлена на причину: антибиотик при пневмонии, удаление инородного тела.' },
    { s: 'Патогенетическая терапия', m: 'Направлена на главное звено: инсулин при СД 1 типа, восполнение ОЦК при кровопотере.' },
    { s: 'Саногенетическая терапия', m: 'Поддерживает механизмы выздоровления: иммуностимуляция, стимуляция регенерации.' },
    { s: 'Симптоматическая терапия', m: 'Устраняет отдельные проявления: анальгетик, жаропонижающее.' },
  ],
  flows: [
    { title: 'Причинно-следственная цепь на примере острой кровопотери', steps: [
      { k: 'trigger', t: 'Повреждение крупного сосуда', d: 'Причина — механическая травма; пусковое звено — нарушение целостности сосуда.' },
      { k: 'primary', l: 'Пусковое звено', t: 'Потеря крови', d: 'Уменьшается объём циркулирующей крови.' },
      { k: 'main', t: 'Гиповолемия', d: 'Из неё выводятся все дальнейшие изменения. Восполнение ОЦК разрывает цепь даже при том, что сосуд уже повреждён.' },
      { k: 'secondary', l: 'Гемодинамика', t: '↓ венозного возврата и сердечного выброса, ↓ АД', d: 'Гипоперфузия органов.' },
      { k: 'secondary', l: 'Обмен', t: 'Циркуляторная гипоксия, лактат-ацидоз', d: 'Повреждение клеток, нарушение функций органов.' },
      { k: 'comp', l: 'Саногенез', t: 'Барорефлекс, централизация, аутогемодилюция, РААС, АДГ, эритропоэз', d: 'Срочные механизмы поддерживают перфузию мозга и сердца, долговременные восстанавливают объём и состав крови.' },
      { k: 'outcome', t: 'Исход', d: 'Компенсация или геморрагический шок с полиорганной недостаточностью.' },
    ]},
    { title: 'Генератор патологически усиленного возбуждения (Г.Н. Крыжановский)', steps: [
      { k: 'trigger', t: 'Повреждение или длительная стимуляция нейронов', d: 'Травма, ишемия, токсины, деафферентация.' },
      { k: 'primary', l: 'Первичное звено', t: 'Недостаточность торможения', d: '↓ ГАМК- и глицинергического торможения, ↑ возбуждающих влияний (глутамат).' },
      { k: 'main', t: 'Образование генератора', d: 'Агрегат гиперактивных взаимосвязанных нейронов, способный к самоподдерживающейся активности без внешней стимуляции.' },
      { k: 'secondary', l: 'Вовлечение', t: 'Формирование патологической системы', d: 'Генератор становится патологической детерминантой и подчиняет другие структуры ЦНС.' },
      { k: 'outcome', t: 'Клинические формы', d: 'Эпилептические приступы, невралгия тройничного нерва, фантомные боли, нейропатическая боль; по сходному принципу рассматривают навязчивые состояния.' },
    ]},
  ],
  sanogenesis: [
    'Первичные барьеры: кожа, слизистые, лизоцим, кислое содержимое желудка, нормальная микрофлора.',
    'Защитные реакции: воспаление, кашель, чихание, рвота, диарея, лихорадка.',
    'Компенсаторные: гипертрофия органа, викарная функция парного органа, перераспределение кровотока.',
    'Восстановительные: регенерация (полная — реституция, неполная — субституция рубцом).',
    'Адаптационные: перестройка обмена и функций под новые условия (высотная акклиматизация).',
  ],
  circles: [
    { kind: 'vicious', title: 'Кровопотеря и сердце', nodes: ['↓ АД', '↓ коронарного кровотока', '↓ сократимости миокарда', '↓ сердечного выброса'], brk: 'Устранить главное звено — гиповолемию: восполнение ОЦК, остановка кровотечения.' },
    { kind: 'vicious', title: 'Генератор возбуждения', nodes: ['Ослабление торможения', 'Гиперактивные нейроны', 'Самоподдерживающийся генератор', 'Вовлечение новых нейронов'], brk: 'Противосудорожные препараты (усиление ГАМК-торможения, блок Na⁺-каналов), устранение источника, хирургия очага.' },
    { kind: 'sanogenic', title: 'Барорефлекс', nodes: ['↓ АД', '↓ импульсации барорецепторов', '↑ симпатической активности', '↑ ЧСС, ОПСС, АД'], brk: 'Пример отрицательной обратной связи. Порочный круг — та же петля, но с положительной обратной связью.' },
  ],
  traps: [
    { q: 'Чем пусковое звено отличается от главного?', a: 'Пусковое — самое первое повреждение. Главное — то, от которого зависят все остальные и устранение которого прерывает болезнь. При кровопотере пусковое — повреждение сосуда, главное — гиповолемия. При СД 1 типа главное — дефицит инсулина.' },
    { q: 'Положительная обратная связь — всегда патология?', a: 'Нет. Физиологические примеры: роды (окситоцин), овуляторный пик ЛГ, свёртывание крови, потенциал действия (Na⁺-каналы). Патологичной её делает выход из-под контроля и вред для организма.' },
    { q: 'Приведите примеры этиотропной, патогенетической и симптоматической терапии при одной болезни.', a: 'Пневмония: антибиотик — этиотропная; кислород и коррекция гипоксемии, инфузии — патогенетическая; жаропонижающее и противокашлевое — симптоматическая.' },
    { q: 'Как соотносятся специфическое и неспецифическое в патогенезе?', a: 'Специфические механизмы определяются свойствами причины (действие токсина на конкретную мишень). Неспецифические одинаковы при разных причинах: стресс, воспаление, лихорадка, гипоксия — это и есть типовые патологические процессы.' },
    { q: 'Что такое первичные и вторичные саногенетические механизмы?', a: 'Первичные работают и в норме (барьеры, фагоцитоз, детоксикация), вторичные включаются при болезни (воспаление, компенсаторная гипертрофия, регенерация).' },
    { q: 'Чем генератор патологически усиленного возбуждения отличается от обычного очага возбуждения?', a: 'Генератор поддерживает свою активность сам, без внешней стимуляции, и навязывает её другим структурам, формируя патологическую систему.' },
  ],
  quiz: [
    { q: 'Назовите главное звено патогенеза: СД 1 типа; тиреотоксикоз при болезни Грейвса; гемолитическая болезнь новорождённого.', a: 'Дефицит инсулина; избыток тиреоидных гормонов, вызванный стимулирующими антителами к рецептору ТТГ; антитела матери против резус-антигена эритроцитов плода (иммунный гемолиз).' },
    { q: 'Пациенту с острой кровопотерей перелили эритроцитную массу и плазму, хотя кровотечение уже остановлено хирургически. Какая это терапия?', a: 'Патогенетическая — она устраняет главное звено (гиповолемию и анемию), а остановка кровотечения устранила пусковое звено.' },
    { q: 'После ампутации ноги у пациента мучительные боли в «отсутствующей» стопе. Механизм с позиций общей патологии?', a: 'Формирование генератора патологически усиленного возбуждения в деафферентированных структурах (задние рога, таламус) и корковая реорганизация; генератор становится патологической детерминантой болевой системы.' },
    { q: 'Почему ожоговая болезнь прогрессирует, хотя действие высокой температуры давно прекратилось?', a: 'Патогенез автономизировался: плазморрагия, интоксикация продуктами распада, инфекция, нарушения микроциркуляции поддерживают друг друга независимо от исходной причины.' },
  ],
  tables: [
    { title: 'Виды терапии', head: ['Вид', 'На что направлена', 'Пример'], rows: [
      ['Этиотропная', 'на причину', 'антибиотик, антидот, удаление инородного тела'],
      ['Патогенетическая', 'на главное и ключевые звенья', 'инсулин при СД 1, восполнение ОЦК, тромболизис'],
      ['Саногенетическая', 'на механизмы выздоровления', 'стимуляция регенерации, иммунокоррекция'],
      ['Симптоматическая', 'на отдельные проявления', 'анальгетики, жаропонижающие, противокашлевые'],
      ['Заместительная', 'на восполнение недостающего', 'гормоны при гипофункции желёз, ферменты'],
    ]},
  ],
};

const VIZ_CSS = `
:root{ --blood:#D3352C; --blood-v:#6B2C63; --plasma:#F7EBD8; --tissue:#F4E4DE; --tissue-pale:#ECE9E6; --wall:#CC958C; --bm:#B59C6E; --fat:#E9C25E; --bile:#7FA23A; }
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){ --blood:#FF5B4F; --blood-v:#C06AB0; --plasma:#3A3026; --tissue:#2F2124; --tissue-pale:#26252B; --wall:#8E5A55; --bm:#A08A5C; --fat:#B9932F; --bile:#8DB24A; } }
:root[data-theme="dark"]{ --blood:#FF5B4F; --blood-v:#C06AB0; --plasma:#3A3026; --tissue:#2F2124; --tissue-pale:#26252B; --wall:#8E5A55; --bm:#A08A5C; --fat:#B9932F; --bile:#8DB24A; }
.pa-viz{ background:var(--surface-2); border:1px solid var(--line); }
.pa-viz svg{ display:block; width:100%; height:auto; }
.pa-fig-viz > svg{ min-width:560px; }
.vt{ fill:var(--ink-2); font-family:var(--f-body); font-size:12px; }
.vt-b{ fill:var(--ink); font-family:var(--f-body); font-size:12.5px; font-weight:600; }
.vt-s{ fill:var(--ink-3); font-family:var(--f-body); font-size:10.5px; }
.vt-m{ font-family:var(--f-mono); }
.vt-on{ fill:var(--on-tone); }
.vf-ink{ fill:var(--ink); } .vf-ink2{ fill:var(--ink-2); } .vf-ink3{ fill:var(--ink-3); } .vf-surface{ fill:var(--surface); } .vf-s2{ fill:var(--surface-2); } .vf-line{ fill:var(--line); }
.vf-alt{ fill:var(--alt); } .vf-altbg{ fill:var(--alt-bg); } .vf-etio{ fill:var(--etio); } .vf-etiobg{ fill:var(--etio-bg); } .vf-san{ fill:var(--san); } .vf-sanbg{ fill:var(--san-bg); } .vf-clin{ fill:var(--clin); } .vf-clinbg{ fill:var(--clin-bg); } .vf-accent{ fill:var(--accent); } .vf-accentsoft{ fill:var(--accent-soft); } .vf-none{ fill:none; }
.vf-blood{ fill:var(--blood); } .vf-bloodv{ fill:var(--blood-v); } .vf-plasma{ fill:var(--plasma); } .vf-tissue{ fill:var(--tissue); } .vf-wall{ fill:var(--wall); } .vf-fat{ fill:var(--fat); } .vf-bm{ fill:var(--bm); }
.vs-ink{ stroke:var(--ink); } .vs-ink2{ stroke:var(--ink-2); } .vs-ink3{ stroke:var(--ink-3); } .vs-line{ stroke:var(--line); } .vs-surface{ stroke:var(--surface); } .vs-s2{ stroke:var(--surface-2); }
.vs-alt{ stroke:var(--alt); } .vs-etio{ stroke:var(--etio); } .vs-san{ stroke:var(--san); } .vs-clin{ stroke:var(--clin); } .vs-accent{ stroke:var(--accent); }
.vs-blood{ stroke:var(--blood); } .vs-bloodv{ stroke:var(--blood-v); } .vs-plasma{ stroke:var(--plasma); } .vs-wall{ stroke:var(--wall); } .vs-bm{ stroke:var(--bm); } .vs-fat{ stroke:var(--fat); } .vs-bile{ stroke:var(--bile); }
.v-hit{ cursor:pointer; outline:none; }
.v-hit:focus-visible .v-shape{ stroke:var(--accent); stroke-width:3; }
.pa-range{ width:100%; accent-color:var(--accent); }
.pa-check{ display:inline-flex; align-items:center; gap:8px; font-size:13.5px; line-height:1.25; padding:7px 11px; border:1px solid var(--line); border-radius:10px; background:var(--surface); color:var(--ink-2); cursor:pointer; text-align:left; }
.pa-check.is-on{ border-color:var(--accent); background:var(--accent-soft); color:var(--ink); }
.pa-kv{ background:var(--surface); border:1px solid var(--line); }
.pa-swatch{ border:1px solid var(--line); }
`;

const frac = (x) => x - Math.floor(x);

const ptsD = (pts) => 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');

const prefersReduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

function useClock(autoplay = true) {
  const [running, setRunning] = useState(() => autoplay && !prefersReduced());
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!running) return undefined;
    let raf = 0; let last = 0;
    const loop = (now) => { if (last) { const dt = Math.min(0.05, (now - last) / 1000); setT((x) => x + dt); } last = now; raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);
  return { t, running, toggle: () => setRunning((r) => !r), setT };
}

function PlayBtn({ clock }) {
  return (
    <button type="button" className="pa-btn" onClick={clock.toggle} aria-pressed={clock.running}>
      {clock.running ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}{clock.running ? 'Пауза' : 'Анимация'}
    </button>
  );
}

function Seg({ value, onChange, options, label }) {
  return (
    <div className="pa-scroll -mx-1 max-w-full overflow-x-auto px-1 pb-1">
      <div className="pa-seg" role="group" aria-label={label}>
        {options.map((o) => <button key={o.id} type="button" className={cx(value === o.id && 'is-on')} aria-pressed={value === o.id} onClick={() => onChange(o.id)}>{o.label}</button>)}
      </div>
    </div>
  );
}

function Fig({ title, clock, controls, caption, children, below, label, interactive }) {
  return (
    <section className="pa-card min-w-0 rounded-2xl p-5 sm:p-6">
      <header className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="tone-clin grid h-8 w-8 shrink-0 place-items-center rounded-lg"><Film size={17} aria-hidden="true" /></span>
        <h3 className="font-display min-w-0 flex-1 text-[18px] font-semibold leading-snug text-balance">{title}</h3>
        {clock && <PlayBtn clock={clock} />}
      </header>
      {controls && <div className="mb-4 grid gap-3" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>{controls}</div>}
      <figure className="m-0">
        <div className="pa-viz pa-fig-viz pa-scroll overflow-x-auto rounded-xl" role={interactive ? 'group' : 'img'} aria-label={label || title}>{children}</div>
        {below && <div className="mt-4">{below}</div>}
        {caption && <figcaption className="pa-muted mt-3 max-w-[78ch] text-[14px] leading-relaxed"><Rich text={caption} /></figcaption>}
      </figure>
    </section>
  );
}

function KV({ items, cols = 4 }) {
  return (
    <div className={cx('grid gap-2', cols === 4 ? 'grid-cols-2 sm:grid-cols-4' : cols === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2')}>
      {items.map((it) => (
        <div key={it.k} className="pa-kv min-w-0 rounded-lg px-3 py-2">
          <div className="pa-faint text-[11.5px] leading-tight">{it.k}</div>
          <div className={cx('mt-0.5 text-[14px] font-semibold leading-snug', it.tone && `ink-${it.tone}`)}><Rich text={String(it.v)} /></div>
        </div>
      ))}
    </div>
  );
}

function MultiText({ x, y, lines, cls = 'vt', anchor = 'middle', lh = 14 }) {
  const arr = Array.isArray(lines) ? lines : String(lines).split('\n');
  const top = y - ((arr.length - 1) * lh) / 2;
  return <text x={x} y={top} textAnchor={anchor} className={cls}>{arr.map((l, i) => <tspan key={i} x={x} dy={i === 0 ? 4 : lh}>{l}</tspan>)}</text>;
}

const BODY_PARTS = {
  brain: { label: 'Головной мозг', topic: 'nervous' },
  pituitary: { label: 'Гипофиз', topic: 'endocrine' },
  thyroid: { label: 'Щитовидная железа', topic: 'endocrine' },
  lungs: { label: 'Лёгкие', topic: 'respiratory' },
  heart: { label: 'Сердце', topic: 'cardio' },
  liver: { label: 'Печень', topic: 'liver' },
  stomach: { label: 'Желудок', topic: 'digestion' },
  gut: { label: 'Кишечник', topic: 'digestion' },
  adrenals: { label: 'Надпочечники', topic: 'endocrine' },
  kidneys: { label: 'Почки', topic: 'kidney' },
  vessels: { label: 'Кровь и сосуды', topic: 'blood' },
};

function Body({ colors = {}, t = 0, hr = 70, rr = 15, onPick, hover, setHover, sx = 1, sy = 1, showVessels = true, interactive = false }) {
  const beat = frac((t * hr) / 60);
  const pulse = 1 + 0.08 * Math.exp(-Math.pow((beat - 0.12) / 0.07, 2));
  const breath = 1 + 0.07 * Math.sin((2 * Math.PI * t * rr) / 60);
  const C = (k, d) => colors[k] || d;
  const skin = C('skin', 'var(--surface)');
  const limb = C('limb', skin);
  const organ = (key, shape) => {
    const hov = hover === key;
    if (!interactive) return <g key={key}>{shape(hov)}</g>;
    return (
      <g key={key} className="v-hit" role="button" tabIndex={0} aria-label={`${BODY_PARTS[key].label}: открыть тему`}
        onClick={() => onPick && onPick(key)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick && onPick(key); } }}
        onMouseEnter={() => setHover && setHover(key)} onMouseLeave={() => setHover && setHover(null)} onFocus={() => setHover && setHover(key)} onBlur={() => setHover && setHover(null)}>
        {shape(hov)}
      </g>
    );
  };
  const st = (hov) => ({ stroke: hov ? 'var(--accent)' : 'var(--ink-3)', strokeWidth: hov ? 2.4 : 1 });
  return (
    <g transform={`translate(120 0) scale(${sx} ${sy}) translate(-120 0)`}>
      <g>
        <polyline points="66,114 44,200 34,292" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="25" style={{ stroke: limb }} />
        <polyline points="174,114 196,200 206,292" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="25" style={{ stroke: limb }} />
        <polyline points="100,296 96,368 92,448" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="33" style={{ stroke: limb }} />
        <polyline points="140,296 144,368 148,448" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="33" style={{ stroke: limb }} />
        <path d="M70 104 Q120 92 170 104 L178 122 Q184 200 162 252 L168 300 Q120 316 72 300 L78 252 Q56 200 62 122 Z" style={{ fill: skin }} className="vs-ink3" strokeWidth="1" />
        <rect x="108" y="78" width="24" height="26" rx="8" style={{ fill: skin }} />
        <circle cx="120" cy="48" r="34" style={{ fill: skin }} className="vs-ink3" strokeWidth="1" />
      </g>
      {showVessels && organ('vessels', (hov) => (
        <g style={{ stroke: 'var(--blood)' }} fill="none" strokeLinecap="round" opacity={hov ? 1 : 0.75}>
          <path d="M120 176 L120 296 M120 296 L101 444 M120 296 L139 444" strokeWidth={hov ? 4.5 : 3} />
          <path d="M114 160 L112 90 M126 160 L128 90 M108 132 L62 130 L42 210 L34 286 M132 132 L178 130 L198 210 L206 286" strokeWidth={hov ? 3 : 2} />
        </g>
      ))}
      {organ('brain', (hov) => <ellipse className="v-shape" cx="120" cy="45" rx="25" ry="19" style={{ fill: C('brain', 'color-mix(in srgb, var(--clin) 30%, var(--surface))'), ...st(hov) }} />)}
      {organ('pituitary', (hov) => <circle className="v-shape" cx="120" cy="67" r={hov ? 5 : 4} style={{ fill: C('pituitary', 'var(--fat)'), ...st(hov) }} />)}
      {organ('thyroid', (hov) => <g><ellipse className="v-shape" cx="113" cy="97" rx="6.5" ry="5" style={{ fill: C('thyroid', 'var(--fat)'), ...st(hov) }} /><ellipse className="v-shape" cx="127" cy="97" rx="6.5" ry="5" style={{ fill: C('thyroid', 'var(--fat)'), ...st(hov) }} /></g>)}
      {organ('lungs', (hov) => (
        <g transform={`translate(120 150) scale(${breath}) translate(-120 -150)`}>
          <ellipse className="v-shape" cx="96" cy="150" rx="21" ry="35" style={{ fill: C('lungs', 'color-mix(in srgb, var(--etio) 22%, var(--surface))'), ...st(hov) }} />
          <ellipse className="v-shape" cx="144" cy="150" rx="21" ry="35" style={{ fill: C('lungs', 'color-mix(in srgb, var(--etio) 22%, var(--surface))'), ...st(hov) }} />
        </g>
      ))}
      {organ('heart', (hov) => (
        <g transform={`translate(127 166) scale(${pulse}) rotate(-12)`}>
          <path className="v-shape" d="M0 13 C-17 1 -15 -12 -7 -13 C-3 -14 0 -10 0 -7 C0 -10 3 -14 7 -13 C15 -12 17 1 0 13 Z" style={{ fill: C('heart', 'var(--blood)'), ...st(hov) }} />
        </g>
      ))}
      {organ('liver', (hov) => <path className="v-shape" d="M78 194 Q102 182 134 190 Q130 214 104 224 Q84 222 78 194 Z" style={{ fill: C('liver', 'color-mix(in srgb, var(--blood-v) 55%, var(--surface))'), ...st(hov) }} />)}
      {organ('stomach', (hov) => <path className="v-shape" d="M138 192 Q160 188 162 206 Q160 224 142 222 Q132 218 138 210 Q146 206 140 198 Z" style={{ fill: C('stomach', 'color-mix(in srgb, var(--alt) 30%, var(--surface))'), ...st(hov) }} />)}
      {organ('adrenals', (hov) => <g><path className="v-shape" d="M94 230 L101 220 L108 230 Z" style={{ fill: C('adrenals', 'var(--fat)'), ...st(hov) }} /><path className="v-shape" d="M132 230 L139 220 L146 230 Z" style={{ fill: C('adrenals', 'var(--fat)'), ...st(hov) }} /></g>)}
      {organ('kidneys', (hov) => <g><ellipse className="v-shape" cx="101" cy="243" rx="9" ry="13" style={{ fill: C('kidneys', 'color-mix(in srgb, var(--blood) 45%, var(--surface))'), ...st(hov) }} /><ellipse className="v-shape" cx="139" cy="243" rx="9" ry="13" style={{ fill: C('kidneys', 'color-mix(in srgb, var(--blood) 45%, var(--surface))'), ...st(hov) }} /></g>)}
      {organ('gut', (hov) => (
        <g>
          <rect className="v-shape" x="90" y="260" width="60" height="38" rx="14" style={{ fill: C('gut', 'color-mix(in srgb, var(--fat) 45%, var(--surface))'), ...st(hov) }} />
          <path d="M98 272 Q106 266 114 272 T130 272 T146 272 M98 286 Q106 280 114 286 T130 286 T146 286" fill="none" className="vs-ink3" strokeWidth="1" />
        </g>
      ))}
    </g>
  );
}

function BodyMap({ onOpen }) {
  const clock = useClock(true);
  const [hover, setHover] = useState(null);
  const pick = (k) => onOpen(BODY_PARTS[k].topic);
  const items = [
    ['brain', 'Нервная система'], ['lungs', 'Внешнее дыхание'], ['heart', 'Сердце и сосуды'], ['vessels', 'Система крови'],
    ['liver', 'Печень'], ['stomach', 'Пищеварение'], ['kidneys', 'Почки'], ['thyroid', 'Эндокринная система'],
  ];
  return (
    <section className="pa-card mt-8 rounded-2xl p-5 sm:p-6" aria-label="Карта организма">
      <div className="grid items-center gap-6 md:grid-cols-[minmax(220px,300px)_1fr]">
        <div className="pa-viz mx-auto w-full max-w-[300px] rounded-xl">
          <svg viewBox="0 -6 240 470" role="img" aria-label="Схема организма: нажмите на орган, чтобы открыть тему частной патофизиологии">
            <Body t={clock.t} interactive hover={hover} setHover={setHover} onPick={pick} />
            {hover && <text x="120" y="456" textAnchor="middle" className="vt-b">{BODY_PARTS[hover].label}</text>}
          </svg>
        </div>
        <div className="min-w-0">
          <div className="pa-eyebrow ink-accent">Карта организма</div>
          <h2 className="font-display mt-2 text-[24px] font-semibold leading-tight">Частная патофизиология по органам</h2>
          <p className="pa-muted mt-2 max-w-[56ch] text-[14.5px] leading-relaxed">Нажмите на орган на схеме или в списке, чтобы перейти к теме. Сердце бьётся, лёгкие дышат — анимацию можно остановить.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {items.map(([k, l]) => (
              <button key={k} type="button" onClick={() => pick(k)} onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(k)} onBlur={() => setHover(null)} className={cx('pa-check justify-between', hover === k && 'is-on')}>
                <span>{l}</span><ArrowRight size={14} aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className="mt-4"><PlayBtn clock={clock} /></div>
        </div>
      </div>
    </section>
  );
}

const TERM = {
  norm: { label: 'Норма', hr: 72, rr: 15, ramp: 1, irr: 0, wide: 1, ecgAmp: 1, vitals: ['72', '15', '120/80', 'ясное'], text: 'Синусовый ритм, ровное дыхание.' },
  pre: { label: 'Преагония', hr: 125, rr: 30, ramp: 0.45, irr: 0, wide: 1, ecgAmp: 0.8, vitals: ['120–130 → ↓', '28–35, поверхностное', '< 60–70 систолическое', 'спутанное, сопор'], text: 'Тахикардия сменяется брадикардией, дыхание частое и поверхностное, АД падает, сознание угнетено.' },
  pause: { label: 'Терминальная пауза', hr: 36, rr: 0, ramp: 0, irr: 0.1, wide: 1.4, ecgAmp: 0.7, vitals: ['30–40', 'нет (секунды–минуты)', 'резко ↓', 'отсутствует'], text: 'Дыхание временно останавливается, брадикардия, могут быть эпизоды асистолии.' },
  agony: { label: 'Агония', hr: 34, rr: 8, ramp: 1.4, irr: 0.35, wide: 2.6, ecgAmp: 0.6, gasp: true, vitals: ['редкий, нерегулярный', 'гаспинг', 'кратковременный подъём', 'отсутствует'], text: 'Последняя вспышка: редкие судорожные вдохи (гаспинг), широкие комплексы, кратковременный подъём АД.' },
  death: { label: 'Клиническая смерть', hr: 0, rr: 0, ramp: 0, irr: 0, wide: 1, ecgAmp: 0, vitals: ['0 (асистолия или ФЖ)', '0', 'не определяется', 'отсутствует'], text: 'Остановка кровообращения и дыхания. Обратимый этап: около 5–6 минут при нормотермии — окно для реанимации.' },
};

const gau = (x, m, w) => Math.exp(-Math.pow((x - m) / w, 2));

function ecgAt(tau, s) {
  if (s.hr === 0) return 0.015 * Math.sin(tau * 31) + 0.01 * Math.sin(tau * 13);
  const ph = frac((tau * s.hr) / 60 + s.irr * Math.sin(tau * 0.9));
  const w = s.wide;
  return s.ecgAmp * (0.12 * gau(ph, 0.14, 0.03) - 0.12 * gau(ph, 0.255, 0.008 * w) + 1.0 * gau(ph, 0.28, 0.011 * w) - 0.28 * gau(ph, 0.31, 0.011 * w) + 0.3 * gau(ph, 0.55, 0.05 * w));
}

function respAt(tau, s) {
  if (s.rr === 0) return 0;
  if (s.gasp) { const ph = frac(tau / 7.5); return s.ramp * (ph < 0.12 ? Math.sin((Math.PI * ph) / 0.12) : 0); }
  return s.ramp * Math.sin((2 * Math.PI * tau * s.rr) / 60);
}

function Terminal() {
  const clock = useClock(true);
  const [k, setK] = useState('pre');
  const s = TERM[k];
  const W = 10; const now = clock.t;
  const trace = (fn, y0, amp) => ptsD(Array.from({ length: 301 }, (_, i) => { const tau = now - W + (i / 300) * W; return [20 + (i / 300) * 680, y0 - fn(tau, s) * amp]; }));
  return (
    <Fig title="Умирание: мониторинг ЭКГ и дыхания" clock={clock}
      controls={<Seg value={k} onChange={setK} label="Стадия" options={Object.keys(TERM).map((q) => ({ id: q, label: TERM[q].label }))} />}
      caption={s.text + ' Кривые условные (окно 10 секунд).'}
      below={<KV items={[{ k: 'ЧСС, уд/мин', v: s.vitals[0] }, { k: 'Дыхание', v: s.vitals[1] }, { k: 'АД', v: s.vitals[2] }, { k: 'Сознание', v: s.vitals[3] }]} />}>
      <svg viewBox="0 0 720 260">
        <rect x="0" y="0" width="720" height="260" className="vf-surface" />
        {Array.from({ length: 21 }, (_, i) => <line key={i} x1={20 + i * 34} x2={20 + i * 34} y1="10" y2="250" className="vs-line" strokeWidth="1" />)}
        <text x="24" y="24" className="vt-b">ЭКГ</text>
        <path d={trace(ecgAt, 95, 60)} fill="none" className="vs-san" strokeWidth="2.2" strokeLinejoin="round" />
        <text x="24" y="160" className="vt-b">Дыхание</text>
        <path d={trace(respAt, 205, 32)} fill="none" className="vs-etio" strokeWidth="2.2" strokeLinejoin="round" />
        {k === 'death' && <text x="360" y="140" textAnchor="middle" className="vt-b">клиническая смерть: ~5–6 мин до необратимой гибели нейронов коры</text>}
      </svg>
    </Fig>
  );
}

const PG_NODES = [
  { id: 0, x: 90, y: 40, t: 'Травма сосуда', k: 'trigger' },
  { id: 1, x: 90, y: 115, t: 'Кровопотеря', k: 'primary' },
  { id: 2, x: 90, y: 195, t: 'Гиповолемия', k: 'main' },
  { id: 3, x: 265, y: 195, t: '↓ венозного\nвозврата', k: 'secondary' },
  { id: 4, x: 440, y: 195, t: '↓ сердечного\nвыброса', k: 'secondary' },
  { id: 5, x: 615, y: 195, t: '↓ АД', k: 'secondary' },
  { id: 6, x: 615, y: 290, t: 'Гипоперфузия\nорганов', k: 'secondary' },
  { id: 7, x: 440, y: 290, t: 'Гипоксия,\nлактат-ацидоз', k: 'secondary' },
  { id: 8, x: 265, y: 290, t: '↓ сократимости\nмиокарда', k: 'secondary' },
  { id: 9, x: 615, y: 95, t: 'Барорефлекс:\nтахикардия, спазм', k: 'comp' },
  { id: 10, x: 440, y: 370, t: 'Полиорганная\nнедостаточность', k: 'outcome' },
];

const PG_EDGES = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 4], [5, 9], [7, 10]];

function CausalGraph() {
  const [blocked, setBlocked] = useState(() => new Set());
  const active = useMemo(() => { const on = new Set(); if (blocked.has(0)) return on; const q = [0]; on.add(0); while (q.length) { const n = q.shift(); PG_EDGES.forEach(([a, b]) => { if (a === n && !blocked.has(b) && !on.has(b)) { on.add(b); q.push(b); } }); } return on; }, [blocked]);
  const toggle = (id) => setBlocked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const N = (id) => PG_NODES[id];
  const tone = { trigger: 'etio', primary: 'alt', main: 'alt', secondary: 'alt', comp: 'san', outcome: 'clin' };
  return (
    <Fig title="Найдите главное звено: заблокируйте любое звено" interactive
      controls={<div className="flex flex-wrap items-center gap-3"><span className="pa-muted text-[13.5px]">Активно звеньев: <b className="tabnum">{active.size}</b> из {PG_NODES.length}</span><button type="button" className="pa-btn" onClick={() => setBlocked(new Set())}><RefreshCw size={15} aria-hidden="true" />Сбросить</button></div>}
      caption="Нажмите на звено, чтобы «устранить» его: всё, что от него зависит, погаснет. Блокада вторичного звена (например, ↓ сократимости) лишь ослабляет цепь, блокада гиповолемии (переливание) гасит почти всё — это и есть главное звено. Красный цикл ↓ СВ → ↓ АД → гипоксия → ↓ сократимости → ↓ СВ — порочный круг.">
      <svg viewBox="0 0 720 410">
        <defs>
          <marker id="pg-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" className="vf-ink2" /></marker>
        </defs>
        {PG_EDGES.map(([a, b], i) => {
          const A = N(a), B = N(b); const on = active.has(a) && active.has(b);
          const dx = B.x - A.x, dy = B.y - A.y; const len = Math.hypot(dx, dy); const ux = dx / len, uy = dy / len;
          const pad = (n2) => (Math.abs(ux) > Math.abs(uy) ? 72 : 24) / (Math.abs(ux) > Math.abs(uy) ? 1 : 1);
          const x1 = A.x + ux * pad(A), y1 = A.y + uy * pad(A), x2 = B.x - ux * pad(B), y2 = B.y - uy * pad(B);
          const cyc = [[4, 5], [5, 6], [6, 7], [7, 8], [8, 4]].some(([p, q]) => p === a && q === b);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className={cyc && on ? 'vs-alt' : 'vs-ink2'} strokeWidth={on ? 2 : 1.2} strokeDasharray={on ? '' : '4 4'} opacity={on ? 1 : 0.4} markerEnd="url(#pg-arr)" />;
        })}
        {PG_NODES.map((n2) => {
          const on = active.has(n2.id); const bl = blocked.has(n2.id); const tn = tone[n2.k];
          return (
            <g key={n2.id} className="v-hit" role="button" tabIndex={0} aria-pressed={bl} aria-label={`${n2.t.replace('\n', ' ')}: ${bl ? 'снять блокаду' : 'заблокировать'}`} onClick={() => toggle(n2.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(n2.id); } }} opacity={on || bl ? 1 : 0.35}>
              <rect className="v-shape" x={n2.x - 72} y={n2.y - 24} width="144" height="48" rx="10" style={{ fill: bl ? 'var(--surface-2)' : `var(--${tn}-bg)`, stroke: bl ? 'var(--ink-3)' : `var(--${tn})`, strokeWidth: n2.k === 'main' ? 3 : 1.4, strokeDasharray: bl ? '5 4' : '' }} />
              <MultiText x={n2.x} y={n2.y} lines={n2.t} cls="vt-b" />
              {bl && <path d={`M${n2.x - 60} ${n2.y - 18} L${n2.x + 60} ${n2.y + 18}`} className="vs-ink2" strokeWidth="2" />}
              {n2.k === 'main' && !bl && <text x={n2.x} y={n2.y + 40} textAnchor="middle" className="vt-b" style={{ fill: 'var(--alt-ink)' }}>главное звено</text>}
            </g>
          );
        })}
      </svg>
    </Fig>
  );
}


const TOPICS = catalog.map(t => ({...t, locked:true, tags:[], definition:'', classification:[], etiology:[], signs:[], flows:[], sanogenesis:[], circles:[], traps:[], quiz:[], tables:[]}));
for(const topic of [T_DISEASE,T_PATHOGEN,window.MA_PATHO_TOPIC?.topic].filter(Boolean)){const i=TOPICS.findIndex(t=>t.id===topic.id);if(i>=0)TOPICS[i]=topic;}
const TOPIC_MAP=Object.fromEntries(TOPICS.map(t=>[t.id,t]));
const EXPERT={"disease":{"lead":"Показать, что вы понимаете болезнь как процесс со своей диалектикой и знаете, где проходит граница жизни и смерти по современным критериям.","items":[{"k":"hist","h":"И.П. Павлов: «поломка» и «физиологическая мера против неё»","b":"Павлов писал, что в каждой болезни есть собственно патологическое и одновременно физиологическая мера против него. Отсюда базовый тезис отечественной патофизиологии: болезнь — единство повреждения и защиты, и одна и та же реакция (лихорадка, воспаление) бывает защитной или повреждающей в зависимости от меры.","say":"Любой симптом я оцениваю с двух сторон: это проявление поломки или физиологическая мера против неё — как говорил Павлов."},{"k":"hist","h":"И.В. Давыдовский: болезнь как форма приспособления","b":"В книге «Проблема причинности в медицине» (1962) Давыдовский критиковал и монокаузализм, и кондиционализм и рассматривал болезнь как проявление приспособительной деятельности организма в необычных условиях. Позиция дискуссионная, но её полезно знать как полюс спектра взглядов."},{"k":"debate","h":"Критерии причинности Брэдфорда Хилла и молекулярные постулаты Коха","b":"Постулаты Коха не выполняются для носительства, неразводимых возбудителей и мультифакторных болезней. Эпидемиология использует критерии Хилла (1965): сила и постоянство связи, временная последовательность, градиент «доза–эффект», биологическая правдоподобность, эксперимент, аналогия. Фальков (1988) сформулировал «молекулярные постулаты Коха»: причинен ген вирулентности, если его инактивация снижает патогенность, а восстановление возвращает её.","say":"Для мультифакторных болезней постулаты Коха не работают, поэтому причинность доказывают по критериям Брэдфорда Хилла."},{"k":"hist","h":"Постреанимационная болезнь В.А. Неговского","b":"Неговский, основатель отечественной реаниматологии, показал, что после восстановления кровообращения развивается самостоятельный патологический процесс — постреанимационная болезнь: реперфузионное повреждение мозга и миокарда, системное воспаление, полиорганная дисфункция. Современный международный аналог — post-cardiac arrest syndrome (ILCOR, 2008).","say":"Оживление не заканчивает патологию: по Неговскому, начинается постреанимационная болезнь — её зарубежный аналог описан только в 2008 году."},{"k":"clin","h":"Смерть мозга — юридическая смерть человека","b":"Смерть мозга — необратимое прекращение функций всего головного мозга при работающем сердце и ИВЛ; в России порядок установления определён приказом Минздрава № 908н (2014): глубокая кома, отсутствие стволовых рефлексов, положительный апноэ-тест, исключение гипотермии, интоксикаций и метаболических причин. Отличать от вегетативного состояния (ствол работает, кора нет) и синдрома «запертого человека» (сознание сохранено)."},{"k":"debate","h":"Почему гипотермия удлиняет клиническую смерть","b":"Снижение температуры на каждые 10 °С уменьшает скорость обмена примерно в 2–3 раза (коэффициент Q₁₀), медленнее истощается АТФ, меньше выброс глутамата и нагрузка Ca²⁺. Поэтому при утоплении в ледяной воде описаны успешные реанимации после десятков минут остановки кровообращения."}]},"pathogenesis":{"lead":"Показать системное мышление: главное звено меняется во времени, а регуляцию можно описать языком функциональных систем и патологических детерминант.","items":[{"k":"debate","h":"Главное звено меняется по ходу болезни","b":"Пример — ожоговая болезнь: в периоде ожогового шока главное звено — гиповолемия от плазморрагии; в периоде токсемии — интоксикация продуктами распада тканей; в септикотоксемии — инфекция; затем — реконвалесценция. Поэтому терапия меняет мишень по стадиям.","say":"Главное звено не статично: при ожоговой болезни оно последовательно смещается от гиповолемии к токсемии и инфекции, и терапия идёт за ним."},{"k":"hist","h":"Г.Н. Крыжановский: дизрегуляционная патология","b":"Крыжановский ввёл понятия генератора патологически усиленного возбуждения, патологической детерминанты (структура, навязывающая свою активность) и патологической системы, а также антисистем, которые ей противодействуют. Обобщение — монография «Дизрегуляционная патология» (2002): многие болезни — результат нарушения регуляторных связей, а не первичного повреждения клеток."},{"k":"hist","h":"П.К. Анохин: функциональные системы","b":"Теория функциональных систем: результат действия через обратную афферентацию сравнивается с «акцептором результата действия». Патологическая функциональная система поддерживает уже не полезный, а вредный результат — например, стойко повышенное АД при гипертонической болезни с перенастройкой барорецепторов."},{"k":"debate","h":"Эквифинальность и мультифинальность","b":"Разные причины ведут к одному синдрому (эквифинальность: гипоксия, ацидоз, шок при разной этиологии), а одна причина — к разным исходам (мультифинальность: стрептококк вызывает ангину, ревматизм или гломерулонефрит в зависимости от реактивности). Это аргумент в пользу типовых патологических процессов как самостоятельного предмета."},{"k":"clin","h":"Автономизация патогенеза: «точка невозврата»","b":"После определённого момента патогенез поддерживается порочными кругами независимо от причины: необратимый шок, ДВС, полиорганная недостаточность. Отсюда практический вывод — патогенетическая терапия должна начинаться до замыкания кругов, а устранение причины на поздней стадии уже недостаточно."},{"k":"new","h":"Сетевой подход: болезнь как поломка сети","b":"Сетевая медицина (Барабаши) рассматривает болезнь как нарушение модуля взаимодействующих генов и белков. Это объясняет коморбидность (общие модули у депрессии, атеросклероза и СД 2 через воспаление) и поиск лекарств «по сети», а не по одной мишени."}]}};
if(window.MA_PATHO_TOPIC?.expert)EXPERT[window.MA_PATHO_TOPIC.topic.id]=window.MA_PATHO_TOPIC.expert;
const SUBJECT_ACCESS=!!window.MA?.hasAtlasAccess('pathophys');
const VISUALS={disease:[Terminal],pathogenesis:[CausalGraph]};
if(window.MA_PATHO_TOPIC)VISUALS[window.MA_PATHO_TOPIC.topic.id]=window.MA_PATHO_TOPIC.makeVisuals({React,useEffect,useMemo,useRef,useState,Activity,Waves,HeartCrack,CirclePause,Droplet,CircleDot,Flame,Thermometer,Wind,FlaskConical,Droplets,Search,BookOpen,GraduationCap,Lock,Check,CircleCheck,Eye,Shuffle,Menu,X,ChevronRight,RotateCw,TriangleAlert,Zap,Target,ShieldCheck,Stethoscope,Table2,Layers,ListChecks,Microscope,LayoutGrid,RefreshCw,ArrowRight,ThumbsUp,ThumbsDown,Play,ChevronDown,Pause,Film,ChevronLeft,Sparkles,Quote,ClipboardCheck,ScrollText,Workflow,Shield,Hexagon,Dna,ShieldAlert,Sprout,Siren,UtensilsCrossed,TestTube,HeartPulse,AirVent,Bean,Filter,Soup,SlidersHorizontal,Brain});


function VisualTab({ topic }) {
  const list = VISUALS[topic.id] || [];
  return (
    <div className="grid gap-6">
      <p className="pa-muted text-[14.5px]">Анимированные и интерактивные схемы. Переключайте состояния и следите, как меняется механизм.</p>
      {list.map((C, i) => <C key={topic.id + i} />)}
    </div>
  );
}

const EXPERT_KINDS = {
  mol: { label: 'Молекулярный механизм', tone: 'alt' },
  hist: { label: 'История и приоритет', tone: 'clin' },
  clin: { label: 'Клиническая проекция', tone: 'etio' },
  new: { label: 'Современные данные', tone: 'san' },
  debate: { label: 'Тонкость и дискуссия', tone: null },
};

const THEORY_TYPES = {
  def: { label: 'Определения и классификации', on: true },
  etio: { label: 'Этиология и проявления', on: true },
  path: { label: 'Патогенез и саногенез', on: true },
  circ: { label: 'Порочные круги', on: true },
  tab: { label: 'Сравнительные таблицы', on: true },
  trap: { label: 'Ловушки', on: true },
  exp: { label: 'На 5+', on: false },
};

const AXIS_FIX = {
  'Боль': 'виды боли', 'Сахарный диабет': 'типы сахарного диабета', 'Сердечная недостаточность': 'виды сердечной недостаточности',
  'Артериальная гипертензия': 'виды артериальной гипертензии', 'Конституция': 'типы конституции', 'Резистентность': 'виды резистентности',
  'Желтухи': 'виды желтух', 'Иммунодефициты': 'виды иммунодефицитов', 'Гипогидратации': 'виды гипогидратаций', 'Гипергидратации': 'виды гипергидратаций',
  'Отёк мозга': 'виды отёка мозга', 'Печёночная недостаточность': 'виды печёночной недостаточности',
  'Белково-энергетическая недостаточность': 'формы белково-энергетической недостаточности', 'Кишечная непроходимость': 'виды кишечной непроходимости',
  'Экзогенные': 'экзогенные гипоксии', 'Эндогенные': 'эндогенные гипоксии', 'Гипертермии (не лихорадка)': 'виды гипертермий (не лихорадка)',
};

function axisPhrase(axis) {
  if (AXIS_FIX[axis]) return AXIS_FIX[axis];
  const low = axis.length > 1 && axis[1] === axis[1].toLowerCase() ? axis[0].toLowerCase() + axis.slice(1) : axis;
  return low.startsWith('по ') ? 'виды ' + low : low;
}

const THEORY_CACHE = {};

function buildTheory(topic) {
  if(topic.locked)return [];
  if (THEORY_CACHE[topic.id]) return THEORY_CACHE[topic.id];
  const T = topic.title; const out = [];
  const add = (type, q, a) => out.push({ id: topic.id + '-' + out.length, tid: topic.id, type, q, a });

  add('def', `${T}: сформулируйте определение.`, topic.defNote ? { text: topic.definition, tail: topic.defNote } : topic.definition);
  topic.classification.forEach((c) => add('def', `${T} — ${axisPhrase(c.axis)}: перечислите и раскройте.`, { list: c.items }));

  add('etio', `${T}: назовите причины и условия возникновения.`, { list: topic.etiology });
  topic.signs.forEach((s) => add('etio', `${T}: объясните «${s.s}».`, s.m));
  if (topic.micro) add('etio', `${T}: микроскопическая картина и местные изменения.`, { list: topic.micro });

  topic.flows.forEach((f) => {
    const main = f.steps.find((s) => s.k === 'main');
    if (main) add('path', `${f.title}: какое звено главное и почему?`, `${main.t}. ${main.d}`);
    add('path', `${f.title}: назовите звенья по порядку.`, { list: f.steps.map((s) => (s.l ? s.l + ' — ' : '') + s.t + (s.k === 'main' ? ' (главное звено)' : '')), ordered: true });
  });
  add('path', `${T}: механизмы саногенеза и компенсации.`, { list: topic.sanogenesis });

  topic.circles.forEach((c) => {
    const sano = c.kind === 'sanogenic';
    add('circ', sano ? `Саногенетическая петля «${c.title}»: опишите и объясните её смысл.` : `Порочный круг «${c.title}»: восстановите цепь и назовите способ разрыва.`,
      { list: [...c.nodes, `замыкается на «${c.nodes[0]}»`], ordered: true, tail: (sano ? 'Смысл: ' : 'Разрыв: ') + c.brk });
  });

  (topic.tables || []).forEach((tb) => tb.rows.forEach((r) => {
    add('tab', `${tb.title}: ${r[0]}.`, { list: r.slice(1).map((v, i) => `${tb.head[i + 1]} — ${v}`) });
  }));

  topic.traps.forEach((x) => add('trap', x.q, x.a));
  ((EXPERT[topic.id] || {}).items || []).forEach((x) => add('exp', `${x.h}: что вы об этом знаете?`, x.say ? { text: x.b, tail: 'Фраза для ответа: ' + x.say } : x.b));

  THEORY_CACHE[topic.id] = out;
  return out;
}

const theoryDefault = (topic) => buildTheory(topic).filter((q) => THEORY_TYPES[q.type].on);

function AnswerBody({ a }) {
  if (typeof a === 'string') return <Rich text={a} />;
  const L = a.ordered ? 'ol' : 'ul';
  return (
    <div className="grid gap-2">
      {a.text && <p><Rich text={a.text} /></p>}
      {a.list && (
        <L className={cx('grid gap-1.5 pl-5', a.ordered ? 'list-decimal' : 'list-disc')}>
          {a.list.map((it, i) => <li key={i} className="pl-1"><Lead text={it} /></li>)}
        </L>
      )}
      {a.tail && <p className="pa-muted"><Rich text={a.tail} /></p>}
    </div>
  );
}

function TheoryCard({ q, idx, total, okCount, open, setOpen, answer, topicChip }) {
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      if (!open && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); setOpen(true); }
      else if (open && (e.key === '1' || e.key === 'ArrowRight')) { e.preventDefault(); answer(true); }
      else if (open && (e.key === '2' || e.key === 'ArrowLeft')) { e.preventDefault(); answer(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen, answer]);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="pa-eyebrow ink-accent tabnum">Вопрос {idx + 1} из {total}</span>
        <span className="pa-faint tabnum ml-auto text-[13px]">знаю: {okCount}</span>
      </div>
      <div className="pa-progress mt-3 h-1.5 overflow-hidden rounded-full"><span style={{ width: `${(idx / total) * 100}%` }} /></div>
      <article className="pa-card mt-5 rounded-2xl p-6 sm:p-8">
        <div className="flex flex-wrap gap-2">
          {topicChip}
          <Chip>{THEORY_TYPES[q.type].label}</Chip>
        </div>
        <p className="font-display mt-4 text-[19px] leading-[1.5] text-balance sm:text-[21px]">{q.q}</p>
        {open ? (
          <>
            <div className="pa-answer mt-5 rounded-xl p-4 text-[15px] leading-relaxed"><AnswerBody a={q.a} /></div>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button type="button" className="pa-btn tone-san" onClick={() => answer(true)}><ThumbsUp size={15} aria-hidden="true" />Знаю</button>
              <button type="button" className="pa-btn tone-alt" onClick={() => answer(false)}><ThumbsDown size={15} aria-hidden="true" />Повторить</button>
              <span className="pa-faint ml-1 hidden text-[12.5px] sm:inline">клавиши 1 и 2</span>
            </div>
          </>
        ) : (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button type="button" className="pa-btn pa-btn-primary" onClick={() => setOpen(true)}><Eye size={16} aria-hidden="true" />Показать ответ</button>
            <span className="pa-faint ml-1 hidden text-[12.5px] sm:inline">или пробел</span>
          </div>
        )}
      </article>
    </div>
  );
}

function TheoryList({ qs }) {
  const [shown, setShown] = useState({});
  const [all, setAll] = useState(false);
  return (
    <div className="grid gap-3">
      <div><button type="button" className={cx('pa-check', all && 'is-on')} aria-pressed={all} onClick={() => setAll(!all)}><Eye size={14} aria-hidden="true" />{all ? 'Скрыть все ответы' : 'Показать все ответы'}</button></div>
      {qs.map((q, i) => {
        const open = all || shown[q.id];
        return (
          <article key={q.id} className="pa-card rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <span className="pa-faint tabnum mt-0.5 w-7 shrink-0 text-[12.5px] font-semibold">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="pa-faint text-[12px]">{THEORY_TYPES[q.type].label}</div>
                <h4 className="mt-0.5 text-[15.5px] font-semibold leading-snug">{q.q}</h4>
                {open ? <div className="pa-answer mt-3 rounded-xl p-4 text-[14.5px] leading-relaxed"><AnswerBody a={q.a} /></div>
                  : <button type="button" className="pa-btn mt-3" onClick={() => setShown((s) => ({ ...s, [q.id]: true }))}><Eye size={15} aria-hidden="true" />Ответ</button>}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function TheorySummary({ res, onRetry, onRestart, onConfig }) {
  const ok = res.filter((r) => r.good).length; const n = res.length;
  const wrong = res.filter((r) => !r.good).map((r) => r.q);
  const byType = {};
  res.forEach((r) => { const b = byType[r.q.type] || (byType[r.q.type] = { ok: 0, n: 0 }); b.n++; if (r.good) b.ok++; });
  return (
    <div className="grid gap-5">
      <section className="pa-card rounded-2xl p-6">
        <div className="pa-eyebrow ink-accent">Итог прогона по теории</div>
        <div className="font-display tabnum mt-2 text-[34px] font-semibold leading-tight">{ok} из {n} · {n ? Math.round((ok / n) * 100) : 0}%</div>
        <ul className="mt-4 grid">
          {Object.entries(byType).map(([k, b], j) => (
            <li key={k} className={cx('flex flex-wrap items-center gap-3 py-2.5', j > 0 && 'border-t')} style={{ borderColor: 'var(--line)' }}>
              <span className="min-w-0 flex-1 text-[14px]">{THEORY_TYPES[k].label}</span>
              <span className="tabnum text-[14px]">{b.ok}/{b.n}</span>
              <span className="pa-progress h-1.5 w-24 overflow-hidden rounded-full"><span style={{ width: `${(b.ok / b.n) * 100}%`, background: b.ok === b.n ? 'var(--san)' : b.ok / b.n >= 0.5 ? 'var(--accent)' : 'var(--alt)' }} /></span>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap gap-2.5">
          {wrong.length > 0 && <button type="button" className="pa-btn pa-btn-primary" onClick={() => onRetry(wrong)}><RefreshCw size={16} aria-hidden="true" />Повторить незнакомые ({wrong.length})</button>}
          <button type="button" className="pa-btn" onClick={onRestart}><Shuffle size={16} aria-hidden="true" />Пройти заново</button>
          <button type="button" className="pa-btn" onClick={onConfig}>Настроить</button>
        </div>
      </section>
      {wrong.length > 0 && (
        <section>
          <h3 className="font-display mb-3 text-[18px] font-semibold">Что повторить</h3>
          <TheoryList qs={wrong} />
        </section>
      )}
    </div>
  );
}

function TheoryTab({ topic, saved, onScore }) {
  const all = useMemo(() => buildTheory(topic), [topic]);
  const [types, setTypes] = useState(() => new Set(Object.keys(THEORY_TYPES).filter((k) => THEORY_TYPES[k].on)));
  const [order, setOrder] = useState('seq');
  const [view, setView] = useState('cards');
  const [deck, setDeck] = useState(null);
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState([]);
  const topRef = useRef(null);
  const toTop = () => { try { const el = topRef.current; if (el) window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 130) }); } catch (e) { /* ignore */ } };
  useEffect(() => { if (deck) toTop(); }, [deck]); // eslint-disable-line react-hooks/exhaustive-deps
  const pool = all.filter((q) => types.has(q.type));
  const listQs = useMemo(() => (order === 'rnd' ? shuffle(pool) : pool), [all, types, order]); // eslint-disable-line react-hooks/exhaustive-deps
  const present = Object.keys(THEORY_TYPES).filter((k) => all.some((q) => q.type === k));
  const start = (src) => { const base = src || pool; setDeck(order === 'rnd' ? shuffle(base) : base); setI(0); setOpen(false); setRes([]); };
  const answer = (good) => { window.MAP?.card({atlas:'pathophys',ok:good});
    const r2 = [...res, { q: deck[i], good }]; setRes(r2); setOpen(false); setI(i + 1); if (i + 1 >= deck.length) setTimeout(toTop, 0);
    if (i + 1 >= deck.length && deck.length === pool.length) onScore({ ok: r2.filter((x) => x.good).length, total: r2.length });
  };
  const toggleType = (k) => setTypes((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  if (deck && i < deck.length) {
    return (
      <div ref={topRef} className="grid gap-4">
        <TheoryCard q={deck[i]} idx={i} total={deck.length} okCount={res.filter((r) => r.good).length} open={open} setOpen={setOpen} answer={answer} />
        <div><button type="button" className="pa-btn" onClick={() => setDeck(null)}>Прервать</button></div>
      </div>
    );
  }
  if (deck && i >= deck.length) return <div ref={topRef}><TheorySummary res={res} onRetry={(w) => start(w)} onRestart={() => start()} onConfig={() => setDeck(null)} /></div>;

  return (
    <div className="grid gap-5">
      <section className="pa-expert-lead rounded-2xl p-5 sm:p-6">
        <div className="pa-eyebrow ink-accent mb-2 flex items-center gap-1.5"><ClipboardCheck size={13} aria-hidden="true" />Прогон по теории</div>
        <p className="max-w-[72ch] text-[15.5px] leading-relaxed">Вопросы на знание материала темы: определения, классификации, механизмы симптомов, звенья патогенеза, порочные круги, сравнительные таблицы и ловушки. Отвечайте вслух, открывайте эталон и честно отмечайте результат.</p>
        {saved && <p className="pa-muted mt-2 text-[13.5px]">Последний полный прогон: <b className="tabnum">{saved.ok}/{saved.total}</b> ({Math.round((saved.ok / saved.total) * 100)} %)</p>}
      </section>
      <Panel title="Что спрашивать" Icon={Layers}>
        <div className="flex flex-wrap gap-2">
          {present.map((k) => {
            const n = all.filter((q) => q.type === k).length; const on = types.has(k);
            return <button key={k} type="button" aria-pressed={on} onClick={() => toggleType(k)} className={cx('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13.5px] font-medium', on ? 'tone-etio' : 'pa-chip')}>{on && <Check size={14} aria-hidden="true" />}{THEORY_TYPES[k].label}<span className="tabnum opacity-70">{n}</span></button>;
          })}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5"><span className="text-[13.5px] font-medium">Порядок</span><Seg value={order} onChange={setOrder} label="Порядок" options={[{ id: 'seq', label: 'Как в теме' }, { id: 'rnd', label: 'Случайно' }]} /></div>
          <div className="grid gap-1.5"><span className="text-[13.5px] font-medium">Формат</span><Seg value={view} onChange={setView} label="Формат" options={[{ id: 'cards', label: 'Карточки' }, { id: 'list', label: 'Списком' }]} /></div>
        </div>
      </Panel>
      {view === 'cards' ? (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="pa-btn pa-btn-primary" disabled={!pool.length} onClick={() => start()} style={!pool.length ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}><Play size={16} aria-hidden="true" />Начать прогон</button>
          <span className="pa-faint tabnum text-[13.5px]">{pool.length} {plural(pool.length, 'вопрос', 'вопроса', 'вопросов')}</span>
        </div>
      ) : (
        <TheoryList key={[...types].join() + order} qs={listQs} />
      )}
    </div>
  );
}

const CLUSTERS = {
  local: 'Местное кровообращение и микроциркуляция',
  kos: 'КОС и водно-электролитный обмен',
};

const SECTIONS = [
  { id: 'nozo', title: 'Общая нозология', locked: [] },
  { id: 'tpp', title: 'Типовые патологические процессы', locked: [] },
  { id: 'chast', title: 'Частная патофизиология', locked: [] },
];

const ICONS = {
  Activity, Waves, HeartCrack, CirclePause, Droplet, CircleDot, Flame, Thermometer, Wind, FlaskConical, Droplets,
  ScrollText, Workflow, Shield, Hexagon, Dna, ShieldAlert, Sprout, Siren, UtensilsCrossed,
  TestTube, HeartPulse, AirVent, Bean, Filter, Soup, SlidersHorizontal, Brain,
};

const SECTION_TITLE = (id) => (SECTIONS.find((x) => x.id === id) || {}).title || '';

function sectionGroups(secId) {
  const groups = [];
  TOPICS.filter((t) => t.section === secId).forEach((t) => {
    const key = t.cluster || '_';
    const last = groups[groups.length - 1];
    if (last && last.cluster === key) last.items.push(t);
    else groups.push({ key: secId + groups.length, cluster: key, title: t.cluster ? CLUSTERS[t.cluster] : null, items: [t] });
  });
  return groups;
}

const KIND = {
  trigger: { label: 'Пусковой фактор', tone: 'etio', Icon: Zap },
  primary: { label: 'Первичная альтерация', tone: 'alt', Icon: Activity },
  main: { label: 'Главное звено', tone: 'main', Icon: Target },
  secondary: { label: 'Вторичное звено', tone: 'alt', Icon: ChevronRight },
  comp: { label: 'Компенсация', tone: 'san', Icon: ShieldCheck },
  outcome: { label: 'Исход', tone: 'clin', Icon: Stethoscope },
};

const TABS = [
  { id: 'passport', label: 'Паспорт', Icon: BookOpen, count: () => null },
  { id: 'visual', label: 'Визуализация', Icon: Film, count: (t) => (VISUALS[t.id] || []).length },
  { id: 'flow', label: 'Патогенез', Icon: Activity, count: (t) => t.flows.length > 1 ? t.flows.length : null },
  { id: 'circles', label: 'Порочные круги', Icon: RotateCw, count: (t) => t.circles.length },
  { id: 'traps', label: 'Ловушки', Icon: TriangleAlert, count: (t) => t.traps.length },
  { id: 'blitz', label: 'Блиц', Icon: ListChecks, count: (t) => t.quiz.length },
  { id: 'tables', label: 'Таблицы', Icon: Table2, count: (t) => (t.tables || []).length },
  { id: 'expert', label: 'На 5+', Icon: Sparkles, count: (t) => ((EXPERT[t.id] || {}).items || []).length },
  { id: 'theory', label: 'Прогон по теории', Icon: ClipboardCheck, count: (t) => theoryDefault(t).length },
];

const LEGEND = [
  { tone: 'etio', label: 'Этиология, пусковой фактор' },
  { tone: 'alt', label: 'Альтерация, звенья патогенеза' },
  { tone: 'main', label: 'Главное звено' },
  { tone: 'san', label: 'Саногенез, компенсация' },
  { tone: 'clin', label: 'Проявления, исход' },
];

const cx = (...a) => a.filter(Boolean).join(' ');

const norm = (s) => String(s).toLowerCase().replace(/ё/g, 'е');

const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const plural = (n, one, few, many) => { const m10 = n % 10, m100 = n % 100; if (m10 === 1 && m100 !== 11) return one; if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few; return many; };

const STORE_KEY = 'patho-atlas:v1';

function loadStore() {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw) { const s = JSON.parse(raw); return { done: s.done || {}, scores: s.scores || {}, theory: s.theory || {}, mode: s.mode === 'exam' ? 'exam' : 'learn' }; }
  } catch (e) { /* хранилище недоступно — работаем без него */ }
  return { done: {}, scores: {}, theory: {}, mode: 'learn' };
}

function saveStore(s) { try { window.localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } }

function buildIndex(topics) {
  const out = [];
  const push = (t, tab, label, text, rank = 3) => { if (text) out.push({ tid: t.id, tab, label, text: String(text), n: norm(text), rank }); };
  topics.forEach((t) => {
    push(t, 'passport', 'Тема', t.title + '. ' + t.short, 0);
    push(t, 'passport', 'Ключевые слова', t.tags.join(', '), 1);
    push(t, 'passport', 'Определение', t.definition, 2);
    if (t.defNote) push(t, 'passport', 'Определение', t.defNote, 2);
    t.classification.forEach((c) => c.items.forEach((i) => push(t, 'passport', 'Классификация', i)));
    t.etiology.forEach((i) => push(t, 'passport', 'Этиология', i));
    t.signs.forEach((s) => push(t, 'passport', 'Проявления', s.s + ' — ' + s.m));
    (t.micro || []).forEach((i) => push(t, 'passport', 'Микроскопия', i));
    t.flows.forEach((f) => f.steps.forEach((s) => push(t, 'flow', 'Патогенез', s.t + ' — ' + s.d)));
    t.sanogenesis.forEach((i) => push(t, 'flow', 'Саногенез', i));
    t.circles.forEach((c) => push(t, 'circles', 'Порочный круг', c.title + ': ' + c.nodes.join(' → ')));
    t.traps.forEach((x) => push(t, 'traps', 'Ловушка', x.q + ' ' + x.a));
    t.quiz.forEach((x) => push(t, 'blitz', 'Блиц', x.q + ' ' + x.a));
    ((EXPERT[t.id] || {}).items || []).forEach((x) => push(t, 'expert', 'На 5+', x.h + '. ' + x.b + (x.say ? ' ' + x.say : '')));
    (t.tables || []).forEach((tb) => tb.rows.forEach((r) => push(t, 'tables', 'Таблица', r.join(' · '))));
  });
  return out;
}

const INDEX = buildIndex(TOPICS);

function runSearch(q) {
  const terms = norm(q.trim()).split(/\s+/).filter((x) => x.length > 0);
  if (!terms.length || terms.join('').length < 2) return [];
  const res = [];
  for (const e of INDEX) if (terms.every((term) => e.n.includes(term))) res.push(e);
  res.sort((a, b) => a.rank - b.rank);
  const seen = new Set();
  return res.filter((r) => { const k = r.tid + r.text; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 40);
}

function snippet(text, term) {
  const n = norm(text); const i = n.indexOf(term);
  if (i < 0 || text.length <= 140) return text;
  const start = Math.max(0, i - 50); const end = Math.min(text.length, i + 90);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

const ARROW_RE = /(↑↑|↓↓|↑|↓)/g;

function Rich({ text }) {
  const parts = String(text).split(ARROW_RE);
  return parts.map((p, i) => {
    if (p === '↑' || p === '↑↑') return <span key={i} className="pa-up">{p}</span>;
    if (p === '↓' || p === '↓↓') return <span key={i} className="pa-down">{p}</span>;
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
}

function Lead({ text }) {
  const s = String(text);
  let i = s.indexOf(' — ');
  let sep = ' — ';
  if (i < 0 || i > 70) { const c = s.indexOf(': '); if (c > 0 && c < 60) { i = c; sep = ': '; } else i = -1; }
  if (i < 0) return <Rich text={s} />;
  return <><strong className="font-semibold" style={{ color: 'var(--ink)' }}><Rich text={s.slice(0, i)} /></strong>{sep}<Rich text={s.slice(i + sep.length)} /></>;
}

function Highlight({ text, term }) {
  if (!term) return text;
  const n = norm(text); const i = n.indexOf(term);
  if (i < 0) return text;
  return <>{text.slice(0, i)}<mark className="pa-mark">{text.slice(i, i + term.length)}</mark>{text.slice(i + term.length)}</>;
}

function Chip({ tone, children, className }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] font-medium leading-5', tone ? `tone-${tone}` : 'pa-chip', className)}>{children}</span>;
}

function TopicIcon({ name, size = 18 }) {
  const I = ICONS[name] || Activity;
  return <I size={size} strokeWidth={1.9} aria-hidden="true" />;
}

function Panel({ title, Icon, tone, aside, children, className }) {
  return (
    <section className={cx('pa-card min-w-0 rounded-2xl p-5 sm:p-6', className)}>
      <header className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        {Icon && <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-lg', tone ? `tone-${tone}` : 'pa-icon')}><Icon size={17} strokeWidth={2} aria-hidden="true" /></span>}
        <h3 className="font-display min-w-0 flex-1 text-[18px] font-semibold leading-snug text-balance">{title}</h3>
        {aside}
      </header>
      {children}
    </section>
  );
}

function BulletList({ items, tone }) {
  return (
    <ul className="grid gap-2.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 text-[14.5px] leading-relaxed">
          <span className={cx('mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full', tone ? `dot-${tone}` : 'pa-dot-accent')} />
          <span className="min-w-0 pa-muted"><Lead text={it} /></span>
        </li>
      ))}
    </ul>
  );
}

function ModeToggle({ mode, setMode }) {
  return (
    <div className="pa-seg" role="group" aria-label="Режим работы">
      <button type="button" className={cx(mode === 'learn' && 'is-on')} onClick={() => setMode('learn')} aria-pressed={mode === 'learn'}><BookOpen size={15} aria-hidden="true" />Учить</button>
      <button type="button" className={cx(mode === 'exam' && 'is-on')} onClick={() => setMode('exam')} aria-pressed={mode === 'exam'}><GraduationCap size={15} aria-hidden="true" />Экзамен</button>
    </div>
  );
}

function Sidebar({ view, topicId, store, query, setQuery, onOpen, onHome, onRun, onClose }) {
  const results = useMemo(() => runSearch(query), [query]);
  const [openLocked, setOpenLocked] = useState({});
  const [collapsed, setCollapsed] = useState({});
  const term = norm(query.trim()).split(/\s+/)[0] || '';

  const NavTopic = ({ t, indent }) => {
    const active = view === 'topic' && topicId === t.id;
    const sc = store.scores[t.id];
    return (
      <button type="button" onClick={() => onOpen(t.id)} className={cx('pa-navitem flex w-full items-center gap-2.5 px-3 py-2 text-left text-[14px]', indent && 'pl-5', active && 'is-active')} aria-current={active ? 'page' : undefined}>
        <span className="pa-nav-muted shrink-0">{t.locked&&!SUBJECT_ACCESS?<Lock size={16} aria-label="По подписке"/>:<TopicIcon name={t.icon} size={16} />}</span>
        <span className="min-w-0 flex-1 leading-snug">{t.title}</span>
        {store.done[t.id] && <CircleCheck size={15} className="shrink-0" style={{ color: 'var(--san)' }} aria-label="Изучено" />}
        {sc && <span className="pa-navbadge tabnum shrink-0 rounded-md px-1.5 text-[11px] leading-5">{sc.ok}/{sc.total}</span>}
      </button>
    );
  };

  return (
    <div className="pa-nav flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-5">
        <button type="button" onClick={onHome} className="min-w-0 text-left">
          <div className="pa-eyebrow pa-nav-muted">Подготовка к экзамену</div>
          <div className="font-display mt-1 text-[21px] font-semibold leading-tight">Атлас патофизиологии</div>
        </button>
        {onClose && <button type="button" onClick={onClose} className="pa-navitem -mr-2 grid h-9 w-9 shrink-0 place-items-center lg:hidden" aria-label="Закрыть меню"><X size={19} /></button>}
      </div>

      <div className="px-4 pb-3">
        <label htmlFor={onClose ? 'pa-search-m' : 'pa-search'} className="sr-only">Поиск по атласу</label>
        <div className="relative">
          <Search size={16} className="pa-nav-muted pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input id={onClose ? 'pa-search-m' : 'pa-search'} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Синдром, механизм, автор…" className="pa-search w-full rounded-xl py-2.5 pl-9 pr-3 text-[14px]" autoComplete="off" />
        </div>
      </div>

      <div className="pa-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-6">
        {query.trim().length >= 2 ? (
          <div>
            <div className="pa-eyebrow pa-nav-muted px-2 pb-2 pt-1">{results.length ? `Найдено: ${results.length}${results.length === 40 ? '+' : ''}` : 'Ничего не найдено'}</div>
            {!results.length && <p className="pa-nav-muted px-2 text-[13px] leading-relaxed">Попробуйте другое слово: «стаз», «IL-1», «Конгейм», «АВР».</p>}
            <ul className="grid gap-1">
              {results.map((r, i) => {
                const t = TOPIC_MAP[r.tid];
                return (
                  <li key={i}>
                    <button type="button" onClick={() => { onOpen(r.tid, r.tab); }} className="pa-navitem w-full px-3 py-2.5 text-left">
                      <div className="flex items-center gap-2 text-[13px] font-semibold"><span className="pa-nav-muted"><TopicIcon name={t.icon} size={14} /></span>{t.title}<span className="pa-nav-muted ml-auto text-[11px] font-medium">{r.label}</span></div>
                      <div className="pa-nav-muted mt-1 text-[12.5px] leading-snug"><Highlight text={snippet(r.text, term)} term={term} /></div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <nav aria-label="Разделы атласа" className="grid gap-5">
            <div className="grid gap-0.5">
              <button type="button" onClick={onHome} className={cx('pa-navitem flex items-center gap-2.5 px-3 py-2 text-left text-[14px]', view === 'home' && 'is-active')}><LayoutGrid size={16} className="pa-nav-muted" aria-hidden="true" />Обзор и прогресс</button>
              <button type="button" onClick={onRun} className={cx('pa-navitem flex items-center gap-2.5 px-3 py-2 text-left text-[14px]', view === 'run' && 'is-active')}><Shuffle size={16} className="pa-nav-muted" aria-hidden="true" />Экзаменационный прогон</button>
            </div>
            {SECTIONS.map((sec) => {
              const open = !collapsed[sec.id];
              const count = TOPICS.filter((t) => t.section === sec.id).length;
              return (
              <div key={sec.id}>
                <button type="button" onClick={() => setCollapsed((c) => ({ ...c, [sec.id]: !c[sec.id] }))} aria-expanded={open} className="pa-eyebrow pa-nav-muted flex w-full items-center gap-1.5 px-3 pb-1.5 text-left">
                  <ChevronDown size={13} aria-hidden="true" style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }} />
                  <span className="min-w-0 flex-1">{sec.title}</span>
                  <span className="tabnum">{count}</span>
                </button>
                {open && (
                  <div className="grid gap-0.5">
                    {sectionGroups(sec.id).map((g) => g.title ? (
                      <div key={g.key} className="mt-1">
                        <div className="pa-nav-muted px-3 pb-1 pt-1 text-[12px] font-medium">{g.title}</div>
                        <div className="grid gap-0.5">{g.items.map((t) => <NavTopic key={t.id} t={t} indent />)}</div>
                      </div>
                    ) : g.items.map((t) => <NavTopic key={t.id} t={t} />))}
                  </div>
                )}
                {sec.locked.length > 0 && <button type="button" onClick={() => setOpenLocked((o) => ({ ...o, [sec.id]: !o[sec.id] }))} aria-expanded={!!openLocked[sec.id]} className="pa-navitem pa-navlocked mt-0.5 flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px]">
                  <Lock size={14} className="shrink-0 opacity-80" aria-hidden="true" />
                  <span className="min-w-0 flex-1">{sec.id === 'tpp' ? 'Ещё ' : ''}{sec.locked.length} {plural(sec.locked.length, 'тема', 'темы', 'тем')} в разработке</span>
                  <ChevronRight size={14} aria-hidden="true" style={{ transform: openLocked[sec.id] ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
                </button>}
                {openLocked[sec.id] && (
                  <ul className="grid gap-0.5 pb-1">
                    {sec.locked.map((x) => (
                      <li key={x} className="pa-navlocked flex items-center gap-2.5 py-1 pl-9 pr-3 text-[13px] leading-snug">{x}</li>
                    ))}
                  </ul>
                )}
              </div>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}

function HomeView({ store, onOpen, onRun }) {
  const ready = TOPICS.length;
  const done = TOPICS.filter((t) => store.done[t.id]).length;
  const scored = Object.values(store.scores);
  const ok = scored.reduce((s, x) => s + x.ok, 0); const total = scored.reduce((s, x) => s + x.total, 0);
  const nTraps = TOPICS.reduce((s, t) => s + t.traps.length, 0);
  const nQuiz = TOPICS.reduce((s, t) => s + t.quiz.length, 0);
  const nCircles = TOPICS.reduce((s, t) => s + t.circles.length, 0);
  const nExpert = TOPICS.reduce((s, t) => s + ((EXPERT[t.id] || {}).items || []).length, 0);
  const stats = [
    { v: `${done}/${ready}`, l: 'тем изучено' },
    { v: total ? `${Math.round((ok / total) * 100)}%` : '—', l: total ? `верных в блице (${ok} из ${total})` : 'точность блица' },
    { v: nCircles, l: 'порочных кругов' },
    { v: nTraps, l: 'экзаменационных ловушек' },
    { v: nExpert, l: 'фактов в разделе «На 5+»' },
    { v: TOPICS.reduce((s, t) => s + theoryDefault(t).length, 0), l: 'вопросов в прогонах по теории' },
  ];
  return (
    <div className="pa-gutter mx-auto max-w-[1180px] pb-16 pt-8 sm:pt-10">
      <section className="grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:items-end">
        <div className="min-w-0">
          <div className="pa-eyebrow ink-accent">Общая нозология · типовые процессы · частная патофизиология</div>
          <h1 className="font-display mt-3 text-[34px] font-semibold leading-[1.1] text-balance sm:text-[44px]">Атлас патофизиологии</h1>
          <p className="pa-muted mt-4 max-w-[60ch] text-[16px] leading-relaxed">
            {ready} тем полного курса. В каждой: паспорт процесса, анимированные схемы, пошаговый патогенез с главным звеном, порочные круги, ловушки экзамена, блиц-задачи, раздел «На 5+» с материалом сверх программы и прогон по теории в конце. Режим «Экзамен» прячет ответы, раскрывает звенья по одному и ведёт счёт.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <button type="button" className="pa-btn pa-btn-primary" onClick={() => onOpen('inflammation')}><Play size={16} aria-hidden="true" />Начать с воспаления</button>
            <button type="button" className="pa-btn" onClick={onRun}><Shuffle size={16} aria-hidden="true" />Экзаменационный прогон · {nQuiz} задач</button>
          </div>
        </div>
        <div className="pa-card grid grid-cols-2 gap-px overflow-hidden rounded-2xl" style={{ background: 'var(--line)' }}>
          {stats.map((s) => (
            <div key={s.l} className="p-4 sm:p-5" style={{ background: 'var(--surface)' }}>
              <div className="font-display tabnum text-[28px] font-semibold leading-none">{s.v}</div>
              <div className="pa-muted mt-2 text-[13px] leading-snug">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      <BodyMap onOpen={onOpen} />

      <section className="pa-card mt-8 rounded-2xl p-5" aria-label="Цветовая легенда">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
          <span className="pa-eyebrow pa-faint">Цвет = роль в патогенезе</span>
          {LEGEND.map((l) => (
            <span key={l.tone} className="inline-flex items-center gap-2 text-[13.5px]">
              <span className={cx('h-3 w-3 rounded-full', `dot-${l.tone}`)} />{l.label}
            </span>
          ))}
        </div>
      </section>

      {SECTIONS.map((sec) => {
        const groups = sectionGroups(sec.id);
        const hasClusters = groups.some((g) => g.title);
        const count = TOPICS.filter((t) => t.section === sec.id).length;
        return (
          <section key={sec.id} className="mt-12">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b pb-3" style={{ borderColor: 'var(--line)' }}>
              <h2 className="font-display text-[25px] font-semibold leading-tight">{sec.title}</h2>
              <span className="pa-faint tabnum text-[14px]">{count} {plural(count, 'тема', 'темы', 'тем')}</span>
            </div>
            {groups.map((g) => (
              <div key={g.key} className="mt-5">
                {(g.title || hasClusters) && <h3 className="pa-eyebrow pa-faint mb-3">{g.title || 'Другие типовые патологические процессы'}</h3>}
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {g.items.map((t) => {
                    const sc = store.scores[t.id];
                    return (
                      <button key={t.id} type="button" onClick={() => onOpen(t.id)} className="pa-card pa-card-link flex flex-col rounded-2xl p-5 text-left">
                        <div className="flex items-center gap-3">
                          <span className="tone-etio grid h-10 w-10 shrink-0 place-items-center rounded-xl"><TopicIcon name={t.icon} size={19} /></span>
                          <div className="min-w-0 flex-1">
                            <div className="font-display text-[17.5px] font-semibold leading-snug">{t.title}</div>
                          </div>
                          {store.done[t.id] && <CircleCheck size={18} style={{ color: 'var(--san)' }} aria-label="Изучено" />}
                        </div>
                        <p className="pa-muted mt-3 text-[14px] leading-snug">{t.short}</p>
                        <div className="pa-faint mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-4 text-[12.5px] tabnum">
                          <span>{t.flows.reduce((s2, f) => s2 + f.steps.length, 0)} звеньев</span>
                          <span>{t.circles.length} {plural(t.circles.length, 'круг', 'круга', 'кругов')}</span>
                          <span>{t.traps.length} {plural(t.traps.length, 'ловушка', 'ловушки', 'ловушек')}</span>
                          <span>{sc ? `блиц ${sc.ok}/${sc.total}` : `${t.quiz.length} задач`}</span>
                          <span>{(store.theory || {})[t.id] ? `теория ${store.theory[t.id].ok}/${store.theory[t.id].total}` : `${theoryDefault(t).length} вопросов`}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        );
      })}

      <p className="pa-faint mt-12 max-w-[72ch] text-[13px] leading-relaxed">
        Материал составлен по учебникам А.Ш. Зайчика и Л.П. Чурилова, П.Ф. Литвицкого, В.В. Новицкого и Е.Д. Гольдберга, Robbins & Cotran. Формулировки определений и классификаций сверяйте с методическими указаниями своей кафедры. Прогресс хранится только в этом браузере.
      </p>
    </div>
  );
}

function Definition({ text, note, exam }) {
  const [open, setOpen] = useState(!exam);
  return (
    <section className="pa-def rounded-2xl p-6 sm:p-7">
      <div className="pa-eyebrow ink-accent mb-3">Определение</div>
      {open ? (
        <>
          <p className="font-display max-w-[64ch] text-[18.5px] leading-[1.55] sm:text-[20px]">{text}</p>
          {note && <p className="pa-muted mt-4 max-w-[70ch] text-[14.5px] leading-relaxed"><Rich text={note} /></p>}
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="pa-muted text-[15px]">Сформулируйте определение вслух, затем сверьтесь.</p>
          <button type="button" className="pa-btn" onClick={() => setOpen(true)}><Eye size={16} aria-hidden="true" />Показать определение</button>
        </div>
      )}
    </section>
  );
}

function PassportTab({ topic, exam }) {
  return (
    <div className="grid gap-6">
      <Definition text={topic.definition} note={topic.defNote} exam={exam} />
      <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <Panel title="Классификация" Icon={Layers}>
          <div className="grid gap-5">
            {topic.classification.map((c) => (
              <div key={c.axis}>
                <div className="pa-eyebrow pa-faint mb-2">{c.axis}</div>
                <BulletList items={c.items} />
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Этиология" Icon={Zap} tone="etio">
          <BulletList items={topic.etiology} tone="etio" />
        </Panel>
      </div>
      <Panel title="Проявления и их механизм" Icon={Stethoscope} tone="clin">
        <dl className="grid">
          {topic.signs.map((s, i) => (
            <div key={i} className={cx('grid gap-1 py-3 sm:grid-cols-[minmax(200px,0.85fr)_1.6fr] sm:gap-6', i > 0 && 'border-t')} style={{ borderColor: 'var(--line)' }}>
              <dt className="ink-clin text-[14.5px] font-semibold leading-snug">{s.s}</dt>
              <dd className="pa-muted text-[14.5px] leading-relaxed"><Rich text={s.m} /></dd>
            </div>
          ))}
        </dl>
      </Panel>
      {topic.micro && (
        <Panel title="Микроскопическая картина и местные сдвиги" Icon={Microscope}>
          <BulletList items={topic.micro} />
        </Panel>
      )}
    </div>
  );
}

function Steps({ steps, exam }) {
  const [shown, setShown] = useState(exam ? 1 : steps.length);
  return (
    <div>
      <ol className="grid">
        {steps.map((s, i) => {
          const K = KIND[s.k] || KIND.secondary;
          const hidden = i >= shown;
          const isMain = s.k === 'main';
          const last = i === steps.length - 1;
          return (
            <li key={i} className="grid grid-cols-[38px_minmax(0,1fr)] gap-x-3 sm:grid-cols-[44px_minmax(0,1fr)] sm:gap-x-4">
              <div className="flex flex-col items-center">
                <span className={cx('tabnum grid h-9 w-9 shrink-0 place-items-center rounded-full text-[14px] font-semibold sm:h-10 sm:w-10', `dot-${K.tone}`)}>{i + 1}</span>
                {!last && <span className="pa-rail my-1 w-px flex-1" />}
              </div>
              <div className={cx('rounded-xl border p-4', !last && 'mb-3', isMain ? 'pa-mainstep' : 'pa-step', hidden && 'pa-step-hidden')}>
                <div className={cx('pa-eyebrow flex items-center gap-1.5', `ink-${K.tone}`)}>
                  <K.Icon size={13} aria-hidden="true" />{s.l || K.label}
                  {isMain && s.l && <span>· главное звено</span>}
                </div>
                {hidden ? (
                  <button type="button" className="pa-btn mt-3" onClick={() => setShown(i + 1)}><Eye size={15} aria-hidden="true" />{isMain ? 'Назовите главное звено, затем откройте' : 'Назовите звено, затем откройте'}</button>
                ) : (
                  <>
                    <div className={cx('mt-1.5 font-semibold leading-snug', isMain ? 'text-[16.5px]' : 'text-[15.5px]')}><Rich text={s.t} /></div>
                    <p className="pa-muted mt-1.5 text-[14px] leading-relaxed"><Rich text={s.d} /></p>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {exam && shown < steps.length && (
        <div className="mt-4 flex flex-wrap gap-2 pl-[50px] sm:pl-[60px]">
          <button type="button" className="pa-btn pa-btn-primary" onClick={() => setShown(shown + 1)}>Следующее звено<ArrowRight size={15} aria-hidden="true" /></button>
          <button type="button" className="pa-btn" onClick={() => setShown(steps.length)}>Показать всю схему</button>
        </div>
      )}
    </div>
  );
}

function FlowTab({ topic, exam }) {
  const [fi, setFi] = useState(0);
  const flow = topic.flows[fi];
  return (
    <div className="grid gap-6">
      {topic.flows.length > 1 && (
        <div className="pa-scroll -mx-1 overflow-x-auto px-1 pb-1">
          <div className="pa-seg" role="tablist" aria-label="Схемы патогенеза">
            {topic.flows.map((f, i) => (
              <button key={i} type="button" role="tab" aria-selected={fi === i} className={cx(fi === i && 'is-on')} onClick={() => setFi(i)}>{f.title}</button>
            ))}
          </div>
        </div>
      )}
      <Panel title={flow.title} Icon={Activity} tone="alt">
        <Steps key={fi + (exam ? '-e' : '-l')} steps={flow.steps} exam={exam} />
      </Panel>
      <Panel title="Саногенез и компенсация" Icon={ShieldCheck} tone="san">
        <BulletList items={topic.sanogenesis} tone="san" />
      </Panel>
    </div>
  );
}

function Ring({ nodes, tone, shown, onReveal }) {
  const n = nodes.length; const R = 33;
  const pos = nodes.map((_, i) => { const a = ((-90 + (i * 360) / n) * Math.PI) / 180; return { x: 50 + R * Math.cos(a), y: 50 + R * Math.sin(a) }; });
  const arrows = nodes.map((_, i) => { const deg = -90 + ((i + 0.5) * 360) / n; const a = (deg * Math.PI) / 180; return { x: 50 + R * Math.cos(a), y: 50 + R * Math.sin(a), rot: deg + 90 }; });
  const color = tone === 'san' ? 'var(--san)' : 'var(--alt)';
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[540px]">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <circle cx="50" cy="50" r={R} fill="none" stroke={color} strokeWidth="0.6" strokeDasharray="1.4 1.2" opacity="0.75" />
        {arrows.map((ar, i) => (
          <g key={i} transform={`translate(${ar.x} ${ar.y}) rotate(${ar.rot})`}>
            <path d="M -2 -1.9 L 2.2 0 L -2 1.9 Z" fill={color} />
          </g>
        ))}
      </svg>
      <div className="absolute left-1/2 top-1/2 w-[26%] -translate-x-1/2 -translate-y-1/2 text-center">
        <RotateCw size={22} className={cx('mx-auto', tone === 'san' ? 'ink-san' : 'ink-alt')} aria-hidden="true" />
        <div className={cx('font-display mt-1 text-[13px] font-semibold italic leading-tight', tone === 'san' ? 'ink-san' : 'ink-alt')}>{tone === 'san' ? 'отрицательная обратная связь' : 'circulus vitiosus'}</div>
      </div>
      {nodes.map((t, i) => {
        const hidden = i >= shown;
        return (
          <div key={i} className="absolute w-[31%] -translate-x-1/2 -translate-y-1/2" style={{ left: `${pos[i].x}%`, top: `${pos[i].y}%` }}>
            <div className={cx('pa-ring-node rounded-xl px-2.5 py-2 text-center text-[12.5px] font-medium leading-snug shadow-sm', hidden && 'pa-step-hidden')}>
              <span className={cx('tabnum mb-1 inline-grid h-5 w-5 place-items-center rounded-full text-[11px] font-semibold', `dot-${tone}`)}>{i + 1}</span>
              <div>{hidden ? <button type="button" onClick={() => onReveal(i + 1)} className="pa-faint underline decoration-dotted underline-offset-2">открыть</button> : <Rich text={t} />}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CircleCard({ c, exam }) {
  const n = c.nodes.length;
  const [shown, setShown] = useState(exam ? 1 : n);
  const tone = c.kind === 'sanogenic' ? 'san' : 'alt';
  return (
    <Panel title={c.title} Icon={RotateCw} tone={tone} aside={<Chip tone={tone}>{c.kind === 'sanogenic' ? 'Саногенетическая петля' : 'Порочный круг'}</Chip>}>
      <div className="hidden sm:block"><Ring nodes={c.nodes} tone={tone} shown={shown} onReveal={setShown} /></div>
      <ol className="grid gap-0 sm:hidden">
        {c.nodes.map((t, i) => {
          const hidden = i >= shown;
          return (
            <li key={i} className="grid grid-cols-[30px_minmax(0,1fr)] gap-x-3">
              <div className="flex flex-col items-center">
                <span className={cx('tabnum grid h-7 w-7 place-items-center rounded-full text-[12px] font-semibold', `dot-${tone}`)}>{i + 1}</span>
                <span className="pa-rail my-1 w-px flex-1" />
              </div>
              <div className={cx('mb-2 rounded-xl border px-3 py-2.5 text-[14px] leading-snug', hidden ? 'pa-step pa-step-hidden' : 'pa-step')}>
                {hidden ? <button type="button" onClick={() => setShown(i + 1)} className="pa-faint underline decoration-dotted underline-offset-2">открыть звено</button> : <Rich text={t} />}
              </div>
            </li>
          );
        })}
        <li className={cx('flex items-center gap-2 pl-1 text-[13px] font-semibold', `ink-${tone}`)}><RotateCw size={15} aria-hidden="true" />Замыкается на звено 1</li>
      </ol>
      {exam && shown < n && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="pa-btn pa-btn-primary" onClick={() => setShown(shown + 1)}>Следующее звено<ArrowRight size={15} aria-hidden="true" /></button>
          <button type="button" className="pa-btn" onClick={() => setShown(n)}>Показать весь круг</button>
        </div>
      )}
      {c.brk && shown >= n && (
        <div className="tone-san mt-5 rounded-xl border p-4 text-[14.5px] leading-relaxed">
          <div className="pa-eyebrow mb-1.5 flex items-center gap-1.5"><ShieldCheck size={13} aria-hidden="true" />{c.kind === 'sanogenic' ? 'Смысл петли' : 'Как разорвать круг'}</div>
          <Rich text={c.brk} />
        </div>
      )}
    </Panel>
  );
}

function CirclesTab({ topic, exam }) {
  return <div className="grid gap-6">{topic.circles.map((c, i) => <CircleCard key={i + (exam ? 'e' : 'l')} c={c} exam={exam} />)}</div>;
}

function TrapItem({ t, i, exam }) {
  const [open, setOpen] = useState(!exam);
  return (
    <article className="pa-card rounded-2xl p-5">
      <div className="flex gap-3.5">
        <span className="tone-alt grid h-8 w-8 shrink-0 place-items-center rounded-lg"><TriangleAlert size={16} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <div className="pa-eyebrow pa-faint mb-1">Ловушка {i + 1}</div>
          <h4 className="text-[15.5px] font-semibold leading-snug">{t.q}</h4>
          {open ? (
            <div className="pa-answer mt-3 rounded-xl p-4 text-[14.5px] leading-relaxed"><Rich text={t.a} /></div>
          ) : (
            <button type="button" className="pa-btn mt-3" onClick={() => setOpen(true)}><Eye size={15} aria-hidden="true" />Показать разбор</button>
          )}
        </div>
      </div>
    </article>
  );
}

function TrapsTab({ topic, exam }) {
  return (
    <div className="grid gap-3.5">
      <p className="pa-muted text-[14.5px]">Тонкие отличия и частые ошибки, на которых срезают оценку.</p>
      {topic.traps.map((t, i) => <TrapItem key={i + (exam ? 'e' : 'l')} t={t} i={i} exam={exam} />)}
    </div>
  );
}

function BlitzTab({ topic, exam, saved, onScore }) {
  const [open, setOpen] = useState({});
  const [grade, setGrade] = useState({});
  const total = topic.quiz.length;
  const graded = Object.keys(grade).length;
  const ok = Object.values(grade).filter(Boolean).length;
  useEffect(() => { if (exam && total > 0 && graded === total) onScore({ ok, total }); }, [graded]); // eslint-disable-line react-hooks/exhaustive-deps
  const reset = () => { setOpen({}); setGrade({}); };
  return (
    <div className="grid gap-4">
      <div className="pa-card flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl px-5 py-4">
        {exam ? (
          <>
            <div className="min-w-[180px] flex-1">
              <div className="text-[14px] font-semibold">Отвечено {graded} из {total} · верно {ok}</div>
              <div className="pa-progress mt-2 h-1.5 overflow-hidden rounded-full"><span style={{ width: `${(graded / total) * 100}%` }} /></div>
            </div>
            {saved && <span className="pa-muted text-[13px]">Последний результат: <b className="tabnum">{saved.ok}/{saved.total}</b></span>}
            <button type="button" className="pa-btn" onClick={reset}><RefreshCw size={15} aria-hidden="true" />Заново</button>
          </>
        ) : (
          <p className="pa-muted text-[14px]">Решите задачу сами, затем откройте ответ. Чтобы вести счёт, включите режим «Экзамен».</p>
        )}
      </div>
      {topic.quiz.map((x, i) => (
        <article key={i} className="pa-card rounded-2xl p-5">
          <div className="pa-eyebrow pa-faint">Задача {i + 1}</div>
          <p className="mt-1.5 text-[15.5px] font-medium leading-relaxed">{x.q}</p>
          {open[i] ? (
            <div className="pa-answer mt-3 rounded-xl p-4 text-[14.5px] leading-relaxed"><Rich text={x.a} /></div>
          ) : (
            <button type="button" className="pa-btn mt-3" onClick={() => setOpen((o) => ({ ...o, [i]: true }))}><Eye size={15} aria-hidden="true" />Показать ответ</button>
          )}
          {exam && open[i] && grade[i] === undefined && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="pa-btn tone-san" onClick={() => {window.MAP?.card({atlas:'pathophys',ok:true});setGrade((g) => ({ ...g, [i]: true }));}}><ThumbsUp size={15} aria-hidden="true" />Ответил верно</button>
              <button type="button" className="pa-btn tone-alt" onClick={() => {window.MAP?.card({atlas:'pathophys',ok:false});setGrade((g) => ({ ...g, [i]: false }));}}><ThumbsDown size={15} aria-hidden="true" />Ошибся</button>
            </div>
          )}
          {grade[i] !== undefined && <div className="mt-3"><Chip tone={grade[i] ? 'san' : 'alt'}>{grade[i] ? 'Верно' : 'Повторить'}</Chip></div>}
        </article>
      ))}
    </div>
  );
}

function DataTable({ tb, exam }) {
  const [rev, setRev] = useState({});
  const reveal = (k) => setRev((v) => ({ ...v, [k]: true }));
  return (
    <Panel title={tb.title} Icon={Table2}>
      {exam && <p className="pa-muted mb-3 text-[13.5px]">Значения скрыты. Вспомните ячейку и нажмите на неё, чтобы проверить.</p>}
      <div className="pa-scroll -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
        <table className="pa-table w-full" style={{ minWidth: Math.max(520, tb.head.length * 150) }}>
          <thead><tr>{tb.head.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr></thead>
          <tbody>
            {tb.rows.map((r, ri) => (
              <tr key={ri}>
                {r.map((c, ci) => {
                  if (ci === 0) return <th key={ci} scope="row"><Rich text={c} /></th>;
                  const k = ri + '-' + ci; const hide = exam && !rev[k];
                  return (
                    <td key={ci} className={cx(hide && 'pa-blur')} onClick={hide ? () => reveal(k) : undefined} onKeyDown={hide ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reveal(k); } } : undefined} tabIndex={hide ? 0 : undefined} role={hide ? 'button' : undefined} aria-label={hide ? 'Показать значение' : undefined}>
                      <Rich text={c} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tb.note && <p className="pa-muted mt-4 text-[13.5px] leading-relaxed"><Rich text={tb.note} /></p>}
    </Panel>
  );
}

function TablesTab({ topic, exam }) {
  return <div className="grid gap-6">{(topic.tables || []).map((tb, i) => <DataTable key={i + (exam ? 'e' : 'l')} tb={tb} exam={exam} />)}</div>;
}

function ExpertItem({ it, i, exam }) {
  const [open, setOpen] = useState(!exam);
  const K = EXPERT_KINDS[it.k] || EXPERT_KINDS.debate;
  return (
    <article className="pa-card rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="pa-faint tabnum text-[12px] font-semibold">{String(i + 1).padStart(2, '0')}</span>
        <Chip tone={K.tone} className={K.tone ? '' : 'pa-chip-neutral'}>{K.label}</Chip>
      </div>
      <h4 className="font-display mt-2.5 text-[18px] font-semibold leading-snug text-balance">{it.h}</h4>
      {open ? (
        <>
          <p className="pa-muted mt-2 max-w-[78ch] text-[14.5px] leading-relaxed"><Rich text={it.b} /></p>
          {it.say && (
            <div className="pa-say mt-4 flex gap-3 rounded-r-xl px-4 py-3">
              <Quote size={16} className="ink-accent mt-0.5 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <div className="pa-eyebrow ink-accent mb-1">Фраза для ответа</div>
                <p className="text-[14.5px] font-medium leading-relaxed"><Rich text={it.say} /></p>
              </div>
            </div>
          )}
        </>
      ) : (
        <button type="button" className="pa-btn mt-3" onClick={() => setOpen(true)}><Eye size={15} aria-hidden="true" />Вспомнить и открыть</button>
      )}
    </article>
  );
}

function ExpertTab({ topic, exam }) {
  const data = EXPERT[topic.id];
  const [kind, setKind] = useState('all');
  const [phrases, setPhrases] = useState(false);
  if (!data) return <p className="pa-muted">Раздел для этой темы готовится.</p>;
  const kinds = ['all', ...Object.keys(EXPERT_KINDS).filter((k) => data.items.some((x) => x.k === k))];
  const items = data.items.map((it, i) => ({ it, i })).filter(({ it }) => kind === 'all' || it.k === kind);
  const says = data.items.filter((x) => x.say);
  return (
    <div className="grid gap-5">
      <section className="pa-expert-lead rounded-2xl p-5 sm:p-6">
        <div className="pa-eyebrow ink-accent mb-2 flex items-center gap-1.5"><Sparkles size={13} aria-hidden="true" />Ответ на 5+</div>
        <p className="max-w-[72ch] text-[15.5px] leading-relaxed">{data.lead}</p>
        <p className="pa-muted mt-2 max-w-[72ch] text-[13.5px] leading-relaxed">Материал сверх базовой программы: молекулярные механизмы, история открытий, клинические связи и современные данные. Вставляйте один-два факта к месту, после основного ответа, а не вместо него.</p>
      </section>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
        <Seg value={kind} onChange={setKind} label="Тип материала" options={kinds.map((k) => ({ id: k, label: k === 'all' ? 'Все' : EXPERT_KINDS[k].label }))} />
        {says.length > 0 && <div><button type="button" className={cx('pa-check', phrases && 'is-on')} aria-pressed={phrases} onClick={() => setPhrases(!phrases)}><Quote size={14} aria-hidden="true" />Только фразы для ответа ({says.length})</button></div>}
      </div>
      {phrases ? (
        <section className="pa-card rounded-2xl p-5 sm:p-6">
          <h3 className="font-display text-[18px] font-semibold">Фразы для ответа</h3>
          <ol className="mt-3 grid gap-3">
            {says.map((x, j) => (
              <li key={j} className="pa-say rounded-r-xl px-4 py-3">
                <div className="pa-faint text-[12px]">{x.h}</div>
                <p className="mt-1 text-[14.5px] font-medium leading-relaxed"><Rich text={x.say} /></p>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <div className="grid gap-4">{items.map(({ it, i }) => <ExpertItem key={i + (exam ? 'e' : 'l')} it={it} i={i} exam={exam} />)}</div>
      )}
    </div>
  );
}

function TopicView({ topic, tab, setTab, mode, store, setStore, onOpen }) {
  const exam = mode === 'exam';
  const done = !!store.done[topic.id];
  const toggleDone = () => setStore((s) => ({ ...s, done: { ...s.done, [topic.id]: !done } }));
  const onScore = (sc) => setStore((s) => ({ ...s, scores: { ...s.scores, [topic.id]: sc } }));
  const tabs = TABS.filter((t) => t.id !== 'tables' || (topic.tables && topic.tables.length));
  const idx = TOPICS.findIndex((t) => t.id === topic.id);
  const next = TOPICS[idx + 1];
  const key = topic.id + '-' + mode;
  return (
    <div>
      <header className="pa-gutter mx-auto max-w-[1180px] pt-7 sm:pt-9">
        <div className="pa-eyebrow pa-faint flex flex-wrap items-center gap-1.5">
          <span>{SECTION_TITLE(topic.section)}</span>
          {topic.cluster && <><ChevronRight size={12} aria-hidden="true" /><span>{CLUSTERS[topic.cluster]}</span></>}
        </div>
        <div className="mt-3 flex flex-wrap items-start gap-4">
          <span className="tone-etio grid h-12 w-12 shrink-0 place-items-center rounded-xl"><TopicIcon name={topic.icon} size={23} /></span>
          <div className="min-w-0 flex-1 basis-[260px]">
            <h1 className="font-display text-[29px] font-semibold leading-[1.15] text-balance sm:text-[36px]">{topic.title}</h1>
            <p className="pa-muted mt-1.5 text-[15.5px]">{topic.short}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {EXPERT[topic.id] && tab !== 'expert' && <button type="button" onClick={() => setTab('expert')} className="pa-btn"><Sparkles size={16} className="ink-accent" aria-hidden="true" />На 5+</button>}
            <button type="button" onClick={toggleDone} className={cx('pa-btn', done && 'tone-san')} aria-pressed={done}>
              {done ? <CircleCheck size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}{done ? 'Изучено' : 'Отметить изученной'}
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">{topic.tags.map((t) => <Chip key={t}>{t}</Chip>)}</div>
      </header>

      <div className="pa-tabs pa-sticky-tabs sticky z-20 mt-6">
        <div className="pa-gutter mx-auto max-w-[1180px]">
          <div className="pa-scroll flex gap-6 overflow-x-auto" role="tablist" aria-label="Разделы темы">
            {tabs.map((t) => {
              const c = t.count(topic);
              return (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={cx('pa-tab', tab === t.id && 'is-active')} onClick={() => setTab(t.id)}>
                  <t.Icon size={15} aria-hidden="true" />{t.label}{c ? <span className="pa-count">{c}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="pa-gutter mx-auto max-w-[1180px] pb-16 pt-6 sm:pt-8" role="tabpanel">
        {exam && (
          <div className="tone-clin mb-6 flex items-start gap-3 rounded-xl border px-4 py-3 text-[14px] leading-relaxed">
            <GraduationCap size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>Режим «Экзамен»: определение, звенья патогенеза и кругов, разборы ловушек и ячейки таблиц скрыты — вспоминайте и открывайте по одному.</span>
          </div>
        )}
        {tab === 'passport' && <PassportTab key={key} topic={topic} exam={exam} />}
        {tab === 'visual' && <VisualTab key={key} topic={topic} />}
        {tab === 'flow' && <FlowTab key={key} topic={topic} exam={exam} />}
        {tab === 'circles' && <CirclesTab key={key} topic={topic} exam={exam} />}
        {tab === 'traps' && <TrapsTab key={key} topic={topic} exam={exam} />}
        {tab === 'blitz' && <BlitzTab key={key} topic={topic} exam={exam} saved={store.scores[topic.id]} onScore={onScore} />}
        {tab === 'tables' && <TablesTab key={key} topic={topic} exam={exam} />}
        {tab === 'expert' && <ExpertTab key={key} topic={topic} exam={exam} />}
        {tab === 'theory' && <TheoryTab key={topic.id} topic={topic} saved={(store.theory || {})[topic.id]} onScore={(sc) => setStore((s) => ({ ...s, theory: { ...(s.theory || {}), [topic.id]: sc } }))} />}

        <div className="mt-10 flex flex-wrap items-center justify-end gap-2.5 border-t pt-6" style={{ borderColor: 'var(--line)' }}>
          {tab !== 'theory' && <button type="button" className="pa-btn pa-btn-primary" onClick={() => { setTab('theory'); try { window.scrollTo({ top: 0 }); } catch (e) { /* ignore */ } }}><ClipboardCheck size={15} aria-hidden="true" />Закрепить: прогон по теории · {theoryDefault(topic).length}</button>}
          {next && <button type="button" className="pa-btn" onClick={() => onOpen(next.id)}>Следующая тема: {next.title}<ArrowRight size={15} aria-hidden="true" /></button>}
        </div>
      </div>
    </div>
  );
}

const ALL_Q = TOPICS.flatMap((t) => t.quiz.map((x, k) => ({ ...x, tid: t.id, key: t.id + '-' + k, type: 'case' })));

let ALL_THEORY = null;

const allTheory = () => (ALL_THEORY || (ALL_THEORY = TOPICS.flatMap((t) => theoryDefault(t))));

function RunView({ onOpen }) {
  const [sel, setSel] = useState(() => new Set(TOPICS.filter(t=>!t.locked).map((t) => t.id)));
  const [count, setCount] = useState(15);
  const [deck, setDeck] = useState(null);
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState([]);
  const [kind, setKind] = useState('cases');
  const src = kind === 'cases' ? ALL_Q : kind === 'theory' ? allTheory() : [...ALL_Q, ...allTheory()];
  const pool = src.filter((q) => sel.has(q.tid));

  const start = (src) => { const base = src || pool; const d = shuffle(base).slice(0, count === 0 ? base.length : count); setDeck(d); setI(0); setOpen(false); setRes([]); };
  const toggle = (id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const answer = (good) => { window.MAP?.card({atlas:'pathophys',ok:good}); setRes((r) => [...r, { q: deck[i], good }]); setOpen(false); setI(i + 1); };

  if (!deck) {
    return (
      <div className="pa-gutter mx-auto max-w-[920px] pb-16 pt-8 sm:pt-10">
        <div className="pa-eyebrow ink-accent">Самопроверка по всем темам</div>
        <h1 className="font-display mt-3 text-[30px] font-semibold leading-tight sm:text-[38px]">Экзаменационный прогон</h1>
        <p className="pa-muted mt-3 max-w-[60ch] text-[15.5px] leading-relaxed">Случайные ситуационные задачи или теоретические вопросы из выбранных тем. Отвечайте вслух, открывайте эталон и честно отмечайте результат. В конце — разбор по темам.</p>
        <div className="mt-6 grid gap-1.5"><span className="text-[13.5px] font-medium">Что спрашивать</span><Seg value={kind} onChange={setKind} label="Тип вопросов" options={[{ id: 'cases', label: 'Ситуационные задачи' }, { id: 'theory', label: 'Теория' }, { id: 'mix', label: 'Всё вместе' }]} /></div>
        <Panel title="Темы" Icon={Layers} className="mt-7" aside={<button type="button" className="pa-btn" onClick={() => setSel(sel.size === TOPICS.filter(t=>!t.locked).length ? new Set() : new Set(TOPICS.filter(t=>!t.locked).map((t) => t.id)))}>{sel.size === TOPICS.filter(t=>!t.locked).length ? 'Снять все' : 'Выбрать все'}</button>}>
          <div className="grid gap-5">
            {SECTIONS.map((sec) => {
              const ids = TOPICS.filter((t) => t.section === sec.id && !t.locked).map((t) => t.id);
              const allOn = ids.every((id) => sel.has(id));
              return (
                <div key={sec.id}>
                  <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="pa-eyebrow pa-faint">{sec.title}</span>
                    <button type="button" className="ink-accent text-[13px] font-medium underline-offset-2 hover:underline" onClick={() => setSel((cur) => { const n = new Set(cur); ids.forEach((id) => (allOn ? n.delete(id) : n.add(id))); return n; })}>{allOn ? 'снять раздел' : 'весь раздел'}</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {TOPICS.filter((t) => t.section === sec.id && !t.locked).map((t) => {
                      const on = sel.has(t.id);
                      return (
                        <button key={t.id} type="button" onClick={() => toggle(t.id)} disabled={t.locked} title={t.locked?"Откройте тему, чтобы загрузить задания":undefined} aria-pressed={on} className={cx('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13.5px] font-medium', on ? 'tone-etio' : 'pa-chip')}>
                          {on ? <Check size={14} aria-hidden="true" /> : <TopicIcon name={t.icon} size={14} />}{t.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <span className="text-[14px] font-medium">Сколько вопросов</span>
            <div className="pa-seg" role="group" aria-label="Количество задач">
              {[10, 15, 25, 0].map((c) => <button key={c} type="button" className={cx(count === c && 'is-on')} onClick={() => setCount(c)}>{c === 0 ? 'все' : c}</button>)}
            </div>
            <span className="pa-faint tabnum text-[13px]">доступно: {pool.length}</span>
          </div>
        </Panel>
        <button type="button" className="pa-btn pa-btn-primary mt-6" disabled={!pool.length} onClick={() => start()} style={!pool.length ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}><Play size={16} aria-hidden="true" />Начать прогон</button>
      </div>
    );
  }

  if (i >= deck.length) {
    const ok = res.filter((r) => r.good).length;
    const by = {};
    res.forEach((r) => { const b = by[r.q.tid] || (by[r.q.tid] = { ok: 0, n: 0 }); b.n++; if (r.good) b.ok++; });
    const wrong = res.filter((r) => !r.good).map((r) => r.q);
    return (
      <div className="pa-gutter mx-auto max-w-[920px] pb-16 pt-8 sm:pt-10">
        <div className="pa-eyebrow ink-accent">Итог прогона</div>
        <h1 className="font-display tabnum mt-3 text-[34px] font-semibold leading-tight sm:text-[42px]">{ok} из {deck.length} · {Math.round((ok / deck.length) * 100)}%</h1>
        <Panel title="По темам" Icon={Table2} className="mt-7">
          <ul className="grid">
            {Object.entries(by).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n).map(([tid, b], k) => (
              <li key={tid} className={cx('flex flex-wrap items-center gap-3 py-3', k > 0 && 'border-t')} style={{ borderColor: 'var(--line)' }}>
                <span className="pa-faint"><TopicIcon name={TOPIC_MAP[tid].icon} size={16} /></span>
                <span className="min-w-0 flex-1 text-[14.5px] font-medium">{TOPIC_MAP[tid].title}</span>
                <span className="tabnum text-[14px]">{b.ok}/{b.n}</span>
                <span className="pa-progress h-1.5 w-24 overflow-hidden rounded-full"><span style={{ width: `${(b.ok / b.n) * 100}%`, background: b.ok === b.n ? 'var(--san)' : b.ok / b.n >= 0.5 ? 'var(--accent)' : 'var(--alt)' }} /></span>
                <button type="button" className="pa-btn" onClick={() => onOpen(tid, kind === 'cases' ? 'traps' : 'theory')}>{kind === 'cases' ? 'К ловушкам' : 'К прогону темы'}</button>
              </li>
            ))}
          </ul>
        </Panel>
        <div className="mt-6 flex flex-wrap gap-2.5">
          {wrong.length > 0 && <button type="button" className="pa-btn pa-btn-primary" onClick={() => start(wrong)}><RefreshCw size={16} aria-hidden="true" />Повторить ошибки ({wrong.length})</button>}
          <button type="button" className="pa-btn" onClick={() => start()}><Shuffle size={16} aria-hidden="true" />Новый прогон</button>
          <button type="button" className="pa-btn" onClick={() => setDeck(null)}>Изменить темы</button>
        </div>
      </div>
    );
  }

  const q = deck[i]; const t = TOPIC_MAP[q.tid];
  return (
    <div className="pa-gutter mx-auto max-w-[860px] pb-16 pt-8 sm:pt-10">
      <div className="flex flex-wrap items-center gap-3">
        <span className="pa-eyebrow ink-accent tabnum">{q.type === 'case' ? 'Задача' : 'Вопрос'} {i + 1} из {deck.length}</span>
        <span className="pa-faint tabnum ml-auto text-[13px]">верно: {res.filter((r) => r.good).length}</span>
      </div>
      <div className="pa-progress mt-3 h-1.5 overflow-hidden rounded-full"><span style={{ width: `${(i / deck.length) * 100}%` }} /></div>
      <article className="pa-card mt-6 rounded-2xl p-6 sm:p-8">
        <div className="flex flex-wrap gap-2"><Chip tone="etio"><TopicIcon name={t.icon} size={13} />{t.title}</Chip>{q.type !== 'case' && <Chip>{THEORY_TYPES[q.type].label}</Chip>}</div>
        <p className="font-display mt-4 text-[19px] leading-[1.5] sm:text-[21px]">{q.q}</p>
        {open ? (
          <>
            <div className="pa-answer mt-5 rounded-xl p-4 text-[15px] leading-relaxed"><AnswerBody a={q.a} /></div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" className="pa-btn tone-san" onClick={() => answer(true)}><ThumbsUp size={15} aria-hidden="true" />Ответил верно</button>
              <button type="button" className="pa-btn tone-alt" onClick={() => answer(false)}><ThumbsDown size={15} aria-hidden="true" />Ошибся</button>
            </div>
          </>
        ) : (
          <button type="button" className="pa-btn pa-btn-primary mt-6" onClick={() => setOpen(true)}><Eye size={16} aria-hidden="true" />Показать эталон</button>
        )}
      </article>
      <button type="button" className="pa-btn mt-5" onClick={() => setDeck(null)}>Прервать прогон</button>
    </div>
  );
}

function LockedTopic({topic}) {
  const state = window.MA_STATE?.auth;
  const retry = state === 'error' || state === 'limited';
  return <section className="pa-gutter mx-auto max-w-[920px] py-12">
    <div className="pa-card rounded-2xl p-6">
      <Lock size={28}/><h1 className="font-display mt-4 text-[30px] font-semibold">{topic.title}</h1>
      <p className="pa-muted mt-4">{retry ? 'Не удалось загрузить тему. Повторите попытку.' : 'Эта тема доступна по подписке на патофизиологию. Две пробные темы открыты всем.'}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        {retry ? <button className="pa-btn" onClick={()=>location.reload()}>Повторить загрузку</button> : <a className="pa-btn pa-btn-primary" href={window.MA?.signedIn() ? '../auth/#account' : window.MA?.loginUrl()}> {window.MA?.signedIn() ? 'Мой аккаунт' : 'Войти в аккаунт'}</a>}
        <a className="pa-btn" href="#disease">Открыть пробную тему</a>
      </div>
    </div>
  </section>;
}

function PathoAtlas() {
  const [store, setStore] = useState(loadStore);
  const [view, setView] = useState(location.hash === '#run' ? 'run' : window.MA_TOPIC ? 'topic' : 'home');
  const [topicId, setTopicId] = useState(window.MA_TOPIC || TOPICS[0].id);
  const [tab, setTabRaw] = useState('passport');
  const [query, setQuery] = useState('');
  const [navOpen, setNavOpen] = useState(false);
  const mode = store.mode;
  const setMode = (m) => setStore((s) => ({ ...s, mode: m }));
  const first = useRef(true);

  useEffect(() => { saveStore(store); }, [store]);
  useEffect(() => { window.MA?.mount(document.querySelectorAll('[data-ma-acct]')); }, []);
  useEffect(() => {
    window.MAP?.sections('pathophys', TOPICS.map(t => ({id:t.id,n:t.title,total:1,learned:store.done[t.id]?1:0,seen:store.done[t.id]?1:0,locked:!!t.locked&&!SUBJECT_ACCESS})));
  }, [store.done]);
  useEffect(() => {
    const t=TOPIC_MAP[topicId];
    if(view==='topic' && !t.locked)window.MAP?.last({atlas:'pathophys',title:t.title,sub:SECTION_TITLE(t.section),url:location.href});
  }, [view,topicId]);

  useEffect(() => {
    const fromHash = () => {
      try {
        const h = (window.location.hash || '').slice(1).replace(/^topic\//,'');
        if (TOPIC_MAP[h]) { setTopicId(h); setView('topic'); } else setView(h === 'run' ? 'run' : 'home');
      } catch (e) { /* ignore */ }
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, []);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    try { window.scrollTo({ top: 0 }); } catch (e) { /* ignore */ }
  }, [view, topicId]);

  const openTopic = (id, t) => { if(!TOPIC_MAP[id])return; location.hash=id; setTopicId(id); setTabRaw(t || 'passport'); setView('topic'); setNavOpen(false); };
  const setTab = (t) => setTabRaw(t);
  const goHome = () => { location.hash=''; setView('home'); setNavOpen(false); };
  const goRun = () => { location.hash='run'; setView('run'); setNavOpen(false); };

  useEffect(() => {
    if (!navOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setNavOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  const topic = TOPIC_MAP[topicId];
  const crumb = view === 'topic' ? topic.title : view === 'run' ? 'Экзаменационный прогон' : 'Обзор';
  const sidebarProps = { view, topicId, store, query, setQuery, onOpen: openTopic, onHome: goHome, onRun: goRun };

  return (
    <div className="pa-root min-h-screen lg:flex">
      <style>{CSS}</style>
      <style>{VIZ_CSS}</style>

      <aside className="hidden lg:sticky lg:top-0 lg:block lg:h-screen lg:w-[300px] lg:shrink-0" aria-label="Навигация">
        <Sidebar {...sidebarProps} />
      </aside>

      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Навигация">
          <button type="button" className="absolute inset-0 h-full w-full" style={{ background: 'rgba(8,10,20,.55)' }} onClick={() => setNavOpen(false)} aria-label="Закрыть меню" />
          <div className="absolute inset-y-0 left-0 w-[86%] max-w-[340px] shadow-2xl" style={{ paddingTop: 'env(safe-area-inset-top,0px)', paddingLeft: 'env(safe-area-inset-left,0px)', background: 'var(--nav)' }}>
            <Sidebar {...sidebarProps} onClose={() => setNavOpen(false)} />
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="pa-topbar pa-sticky sticky z-30 border-b">
          <div className="pa-gutter flex h-14 items-center gap-3">
            <div className="-ml-1 lg:hidden"><button type="button" className="pa-btn" style={{ padding: '.45rem .6rem' }} onClick={() => setNavOpen(true)} aria-label="Открыть меню"><Menu size={19} aria-hidden="true" /></button></div>
            <div className="hidden min-w-0 flex-1 truncate text-[14px] font-medium sm:block">
              <span className="pa-faint hidden sm:inline">Атлас патофизиологии / </span>{crumb}
            </div>
            <div className="ml-auto"><ModeToggle mode={mode} setMode={setMode} /></div>
            <a href="../" className="pa-btn pa-all-atlases">Все атласы</a>
            <a href="../cabinet/" className="pa-btn" aria-label="Личный кабинет"><GraduationCap size={18}/></a>
            <span data-ma-acct className="hidden sm:inline" />
          </div>
        </div>

        <main>
          {view === 'home' && <HomeView store={store} onOpen={openTopic} onRun={goRun} />}
          {view === 'topic' && (topic.locked ? <LockedTopic topic={topic}/> : <TopicView topic={topic} tab={tab} setTab={setTab} mode={mode} store={store} setStore={setStore} onOpen={openTopic} />)}
          {view === 'run' && <RunView onOpen={openTopic} />}
        </main>
      </div>
    </div>
  );
}

export default PathoAtlas;
