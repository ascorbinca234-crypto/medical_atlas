/* ===== Организм: модель физиологических эффектов препаратов =====
   Шкала: −3…+3 относительно нормы. Ключи параметров — см. VPAR ниже.
   Запись: строка эффектов или {g, v:[[вариант, эффекты]...], n:{параметр:'пояснение'}, anti:[препарат, вариант-антидот]} */

const VPAR = {
  hr:  {n:'ЧСС', o:'heart', p:'тахикардия', m:'брадикардия'},
  co:  {n:'Сократимость миокарда', o:'heart', p:'↑ сила сокращений (+ инотропный)', m:'↓ сила сокращений (− инотропный)'},
  av:  {n:'АВ-проведение', o:'heart', p:'ускорено (+ дромотропный)', m:'замедлено (− дромотропный), риск АВ-блокады'},
  qt:  {n:'Ритм', o:'heart', p:'аритмогенность: удлинение QT, экстрасистолы', m:'антиаритмический эффект'},
  vt:  {n:'Тонус артериол (ОПСС)', o:'vessels', p:'вазоконстрикция, ↑ ОПСС', m:'вазодилатация, ↓ ОПСС'},
  ven: {n:'Тонус вен (преднагрузка)', o:'vessels', p:'↑ венозного возврата', m:'венодилатация, ↓ преднагрузки'},
  bp:  {n:'Артериальное давление', o:'vessels', p:'↑ АД', m:'↓ АД'},
  pu:  {n:'Зрачок', o:'eye', p:'мидриаз', m:'миоз'},
  iop: {n:'Внутриглазное давление', o:'eye', p:'↑ ВГД (риск приступа глаукомы)', m:'↓ ВГД'},
  br:  {n:'Бронхи', o:'lungs', p:'бронходилатация', m:'бронхоспазм'},
  bs:  {n:'Бронхиальная секреция', o:'lungs', p:'↑ секреции (бронхорея)', m:'↓ секреции, сгущение мокроты'},
  rr:  {n:'Дыхание', o:'lungs', p:'стимуляция дыхания', m:'угнетение дыхания'},
  sal: {n:'Слюнные железы', o:'mouth', p:'слюнотечение', m:'сухость во рту'},
  sw:  {n:'Потовые железы', o:'skin', p:'↑ потоотделения', m:'↓ потоотделения, сухая кожа'},
  gi:  {n:'Моторика ЖКТ', o:'gut', p:'↑ перистальтики (спазм, диарея)', m:'↓ перистальтики (запор)'},
  gs:  {n:'Желудочная секреция', o:'stomach', p:'↑ секреции HCl', m:'↓ секреции HCl'},
  ulc: {n:'Слизистая желудка', o:'stomach', p:'риск эрозий, язв, кровотечения', m:'гастропротекция'},
  liv: {n:'Печень', o:'liver', p:'гепатотоксичность', m:'—'},
  glu: {n:'Глюкоза крови', o:'pancreas', p:'гипергликемия', m:'гипогликемия'},
  kid: {n:'Диурез, почки', o:'kidney', p:'↑ диуреза', m:'↓ диуреза, ↓ СКФ'},
  k:   {n:'Калий плазмы', o:'kidney', p:'гиперкалиемия', m:'гипокалиемия'},
  bl:  {n:'Мочевой пузырь', o:'bladder', p:'↑ тонуса детрузора — мочеиспускание', m:'задержка мочи'},
  cns: {n:'ЦНС', o:'brain', p:'возбуждение', m:'угнетение (седация → сон → наркоз)'},
  pain:{n:'Болевая чувствительность', o:'brain', p:'гипералгезия, боль', m:'анальгезия'},
  tmp: {n:'Температура тела', o:'brain', p:'↑ температуры', m:'↓ температуры'},
  skm: {n:'Скелетные мышцы', o:'muscle', p:'↑ тонуса: тремор, ригидность, фасцикуляции', m:'миорелаксация вплоть до паралича'},
  coag:{n:'Гемостаз', o:'blood', p:'↑ тромбообразования', m:'↓ агрегации и свёртывания — кровоточивость'}
};
const VORG = {brain:'Головной мозг', eye:'Глаз', mouth:'Слюнные железы', skin:'Кожа', heart:'Сердце', vessels:'Сосуды', lungs:'Лёгкие и бронхи', stomach:'Желудок', gut:'Кишечник', liver:'Печень', pancreas:'Поджелудочная железа', kidney:'Почки', bladder:'Мочевой пузырь', muscle:'Скелетные мышцы', blood:'Кровь'};
/* органы → системы досье (canon) */
const VSYS = {brain:['Нервная система','Кожа и терморегуляция'], eye:['Глаз'], mouth:['ЖКТ','Вегетативные эффекты'], skin:['Кожа и терморегуляция','Вегетативные эффекты'], heart:['Сердце и сосуды'], vessels:['Сердце и сосуды'], lungs:['Дыхание'], stomach:['ЖКТ'], gut:['ЖКТ'], liver:['Печень','Обмен и эндокринная'], pancreas:['Обмен и эндокринная'], kidney:['Почки и мочевыделение'], bladder:['Почки и мочевыделение','Вегетативные эффекты'], muscle:['Мышцы'], blood:['Кровь']};

const VIT = {
/* ---- холинергические ---- */
'Пилокарпин': {g:'М-холиномиметик', v:[['Местно (глазные капли)','pu-3 iop-2'],['Системное действие','hr-1 vt-1 bp-1 pu-3 iop-2 br-2 bs+2 sal+3 sw+3 gi+2 gs+1 bl+2']], n:{pu:'сокращение круговой мышцы радужки', iop:'↑ отток ВГЖ через шлеммов канал'}},
'Ацеклидин': 'hr-1 bp-1 pu-2 iop-2 br-1 bs+1 sal+2 sw+2 gi+2 bl+2',
'Неостигмин': {v:[['Терапевтическая доза','hr-2 av-1 bp-1 pu-1 br-2 bs+2 sal+2 sw+2 gi+3 gs+1 bl+2 skm+2'],['Декураризация (после недеполяризующих)','skm+2 rr+2 hr-1 sal+1']], n:{skm:'↑ АХ в нервно-мышечном синапсе — сила мышц', gi:'применяют при атонии кишечника'}},
'Пиридостигмин': 'hr-1 br-1 sal+1 sw+1 gi+2 bl+1 skm+2',
'Физостигмин': 'hr-2 pu-3 iop-2 br-2 bs+2 sal+2 sw+2 gi+3 bl+2 skm+1 cns+1',
'Галантамин': 'hr-1 sal+1 gi+1 cns+1',
'Донепезил': 'hr-1 gi+1 cns+1',
'Ривастигмин': 'hr-1 gi+2 cns+1',
'Ипидакрин': 'hr-1 sal+1 gi+2 bl+1 skm+2',
'ФОС': {g:'Фосфорорганические соединения (отравление)', v:[['Отравление','hr-2 bp-2 pu-3 br-3 bs+3 rr-3 sal+3 sw+3 gi+3 bl+2 skm+3 cns+3']], n:{skm:'фасцикуляции → паралич (никотиновые эффекты)', cns:'судороги, кома', br:'бронхоспазм + бронхорея — ведущая причина смерти'}, anti:['Атропин','Атропин + реактиватор ХЭ']},
'Атропин': {v:[['Терапевтическая доза','hr+2 av+1 pu+3 iop+1 br+1 bs-3 sal-3 sw-3 gi-2 gs-1 bl-2 cns+1 tmp+1'],['Отравление','hr+3 av+1 bp+1 pu+3 iop+2 bs-3 sal-3 sw-3 gi-3 bl-3 cns+3 tmp+3']], n:{pu:'паралич сфинктера зрачка + паралич аккомодации', sw:'кожа сухая, горячая, красная', cns:'при отравлении: возбуждение, бред, галлюцинации'}, anti:['Физостигмин','при отравлении']},
'Скополамин': 'hr+1 pu+3 iop+1 bs-2 sal-3 sw-2 gi-2 bl-2 cns-2',
'Платифиллин': 'hr+1 vt-1 bp-1 pu+2 sal-2 gi-2 bl-1 cns-1',
'Ипратропий': {g:'М-холиноблокатор (ингаляционный)', v:[['Ингаляционно','br+2 bs-1 sal-1']]},
'Тиотропий': {v:[['Ингаляционно','br+3 bs-1 sal-1']]},
'Тропикамид': {v:[['Местно (глазные капли)','pu+3 iop+1']]},
'Солифенацин': 'sal-2 gi-1 bl-3 pu+1',
'Пирензепин': 'gs-2 sal-1',
'Гексаметоний': 'hr+1 vt-3 ven-2 bp-3 pu+2 sal-2 sw-2 gi-2 bl-2',
'Азаметоний': {g:'Ганглиоблокатор', v:[['В/в для управляемой гипотонии','hr+1 vt-3 ven-2 bp-3 pu+2 sal-2 sw-2 gi-2 bl-2']], n:{bp:'блок симпатических ганглиев → ортостатический коллапс', bl:'блок парасимпатических ганглиев → задержка мочи'}},
'Цитизин': 'rr+2 hr+1 bp+1',
'Лобелин': 'rr+2 hr-1 bp+1',
'Никотин': 'hr+1 vt+1 bp+1 gi+1 sal+1 cns+1 skm+1',
'Рокуроний': {g:'Недеполяризующий миорелаксант', v:[['Миорелаксация при наркозе','skm-3 rr-3']], n:{rr:'паралич дыхательных мышц — нужна ИВЛ'}, anti:['Сугаммадекс','реверсия']},
'Векуроний': 'skm-3 rr-3',
'Пипекуроний': 'skm-3 rr-3',
'Тубокурарин': {v:[['Миорелаксация','skm-3 rr-3 bp-1 br-1']], n:{bp:'высвобождение гистамина + блок ганглиев', br:'высвобождение гистамина'}},
'Атракурий': 'skm-3 rr-3 bp-1',
'Цисатракурий': 'skm-3 rr-3',
'Суксаметоний': {g:'Деполяризующий миорелаксант', v:[['Миорелаксация','skm-3 rr-3 hr-1 iop+1 k+2']], n:{skm:'сначала фасцикуляции, затем паралич; послеоперационные мышечные боли', k:'выход K⁺ из мышц'}},
'Ботулотоксин': {v:[['Местно (в мышцу)','skm-2']]},
/* ---- адренергические ---- */
'Адреналин': {v:[['В/в (системно)','hr+3 co+3 av+2 qt+1 vt+2 bp+3 pu+1 iop-1 br+3 gi-1 bl-1 glu+3 k-1 skm+1 cns+1 coag+1'],['Местно (с анестетиком)','vt+2']], n:{vt:'α₁ сосудов кожи и органов; β₂ сосудов мышц — расширение', glu:'гликогенолиз (β₂), ↓ инсулина (α₂)', k:'β₂ → вход K⁺ в клетки'}},
'Норадреналин': {v:[['В/в инфузия','hr-1 co+1 vt+3 bp+3 glu+1']], n:{hr:'рефлекторная брадикардия (барорефлекс)'}},
'Дофамин': {v:[['Малые дозы (D₁)','vt-1 kid+2'],['Средние дозы (β₁)','hr+2 co+2 bp+1 kid+1 qt+1'],['Высокие дозы (α₁)','hr+2 co+2 vt+3 bp+3 kid-1 qt+2']], n:{kid:'D₁ сосудов почек → ↑ почечного кровотока и диуреза'}},
'Добутамин': 'hr+1 co+3 av+1 vt-1 bp+1 qt+1',
'Фенилэфрин': {v:[['В/в','hr-2 vt+3 bp+3'],['Местно (глаз, нос)','pu+2 vt+1']], n:{hr:'рефлекторная брадикардия', pu:'сокращение радиальной мышцы — мидриаз без паралича аккомодации'}},
'Мидодрин': 'vt+2 bp+2 bl-1',
'Клонидин': {v:[['Внутрь, под язык','hr-2 co-1 vt-1 bp-2 sal-2 cns-2 pain-1 iop-1'],['Резкая отмена','hr+2 vt+2 bp+3 cns+2 sw+2']], n:{cns:'седация (α₂ голубого пятна)', bp:'α₂ и I₁ ядра солитарного тракта → ↓ симпатического тонуса'}},
'Метилдопа': 'hr-1 bp-2 cns-1 sal-1',
'Моксонидин': 'hr-1 bp-2 sal-1 cns-1 glu-1',
'Ксилометазолин': {v:[['Местно (нос)','vt+1']], n:{vt:'сужение сосудов слизистой носа'}},
'Сальбутамол': {v:[['Ингаляционно','br+3 hr+1 skm+1'],['Системно (большие дозы)','br+3 hr+2 vt-1 skm+2 glu+1 k-1']], n:{skm:'тремор (β₂ скелетных мышц)'}},
'Фенотерол': 'br+3 hr+1 skm+1 k-1',
'Формотерол': 'br+3 hr+1 skm+1',
'Сальметерол': 'br+3 hr+1 skm+1',
'Индакатерол': 'br+3',
'Изопреналин': 'hr+3 co+3 av+2 qt+2 vt-2 bp-1 br+3 glu+1 skm+1',
'Эфедрин': 'hr+2 co+1 vt+2 bp+2 pu+1 br+2 bl-1 cns+2 glu+1',
'Тирамин': 'vt+2 bp+2 hr+1',
'Резерпин': 'hr-2 bp-2 vt-1 pu-1 gi+2 gs+2 ulc+1 cns-2',
'Гуанетидин': 'hr-1 vt-2 bp-2 gi+2',
'Празозин': {v:[['Внутрь','hr+1 vt-2 ven-1 bp-2 bl+1']], n:{bp:'«эффект первой дозы» — ортостатический коллапс'}},
'Доксазозин': {v:[['Внутрь','hr+1 vt-2 bp-2 bl+2']], n:{bl:'α₁ шейки мочевого пузыря и простаты — облегчение мочеиспускания при ДГПЖ'}},
'Теразозин': 'hr+1 vt-2 bp-2 bl+2',
'Тамсулозин': 'bp-1 bl+2',
'Урапидил': {g:'α₁-адреноблокатор + агонист 5-HT₁A', v:[['В/в при гипертоническом кризе','vt-2 bp-2']], n:{hr:'рефлекторной тахикардии нет — центральный 5-HT₁A-компонент'}},
'Фентоламин': 'hr+2 vt-3 bp-2 gi+1',
'Пропранолол': {v:[['Внутрь','hr-2 co-2 av-1 qt-1 vt+1 bp-2 iop-1 br-2 glu-1 cns-1 skm-1']], n:{br:'блок β₂ бронхов — противопоказан при БА', glu:'маскирует симптомы гипогликемии, ↓ гликогенолиза', vt:'похолодание конечностей'}},
'Тимолол': {v:[['Местно (глазные капли)','iop-2'],['Системное всасывание','hr-1 br-1']]},
'Метопролол': 'hr-2 co-1 av-1 qt-1 bp-2',
'Атенолол': 'hr-2 co-1 av-1 bp-2',
'Бисопролол': 'hr-2 co-1 av-1 bp-2',
'Небиволол': 'hr-1 vt-1 bp-2',
'Карведилол': 'hr-1 co-1 vt-1 bp-2 br-1',
'Соталол': 'hr-2 av-1 qt+2 bp-1',
'Дифенгидрамин': {v:[['Внутрь / в/м','hr+1 pu+1 sal-2 gi-1 bl-1 cns-2'],['Отравление','hr+3 pu+3 sal-3 sw-3 bl-2 cns+3 tmp+2']], n:{cns:'H₁ ЦНС → седация; при отравлении — холинолитический делирий'}},
'Тригексифенидил': 'hr+1 pu+2 sal-2 gi-1 bl-1 cns-1 skm-1',
'Атомоксетин': 'hr+1 bp+1 bl-1 cns+1',
'Кокаин': {v:[['Системно','hr+2 qt+2 vt+3 bp+3 pu+2 cns+3 tmp+2'],['Местно (слизистые)','vt+2 pain-3']], n:{cns:'блок обратного захвата НА, ДА, 5-HT — эйфория'}},
/* ---- прочее ---- */
'Лидокаин': {v:[['Местно','pain-3'],['В/в (антиаритмик IB)','qt-2 bp-1 cns-1'],['Токсическое действие','qt-2 bp-2 cns+3']], n:{pain:'блок Na⁺-каналов нервных волокон', cns:'судороги — торможение тормозных нейронов'}},
'Прокаин': {v:[['Местно','pain-2'],['Резорбтивно','bp-1 cns-1']]},
'Фамотидин': {g:'H₂-гистаминоблокатор', v:[['Внутрь','gs-3']]},
'Лоратадин': {g:'H₁-гистаминоблокатор II поколения', v:[['Внутрь','cns+0']], n:{cns:'седации практически нет'}},
'Хлоропирамин': {g:'H₁-гистаминоблокатор I поколения', v:[['Внутрь, в/м','sal-1 cns-2']]},
'Сугаммадекс': {v:[['Реверсия рокурония','skm+2 rr+2']]}
};
/* закрытые записи модели «Организм» подключаются после входа */
if (typeof VIT_LOCKED !== 'undefined') { const all = Object.assign({}, VIT, VIT_LOCKED); Object.keys(VIT).forEach(k => delete VIT[k]); VIT_ORDER.forEach(k => { if (all[k]) VIT[k] = all[k]; }); }

const VCAT = [
  ['Вегетатика', ['Пилокарпин','Неостигмин','ФОС','Атропин','Скополамин','Азаметоний','Рокуроний','Суксаметоний','Адреналин','Норадреналин','Фенилэфрин','Изопреналин','Сальбутамол','Эфедрин','Клонидин','Резерпин','Доксазозин','Пропранолол','Метопролол','Карведилол']],
  ['Сердце и сосуды', ['Нитроглицерин','Нифедипин','Амлодипин','Верапамил','Ивабрадин','Каптоприл','Лозартан','Нитропруссид натрия','Урапидил','Моксонидин','Дигоксин','Дофамин','Добутамин','Фуросемид','Гидрохлоротиазид','Спиронолактон','Магния сульфат']],
  ['Наркоз и сон', ['Пропофол','Тиопентал натрия','Кетамин','Севофлуран','Галотан','Закись азота','Диазепам','Мидазолам','Фенобарбитал','Золпидем','Флумазенил','Этанол']],
  ['Анальгетики', ['Морфин','Фентанил','Тримеперидин','Трамадол','Налоксон','Ацетилсалициловая кислота','Ибупрофен','Кеторолак','Целекоксиб','Парацетамол','Метамизол натрия','Лидокаин']],
  ['Психотропные', ['Хлорпромазин','Галоперидол','Клозапин','Амитриптилин','Флуоксетин','Венлафаксин','Лития карбонат','Кофеин','Амфетамин','Кокаин','Леводопа','Тригексифенидил','Дифенгидрамин']]
];

/* ---------- разбор и модель ---------- */
function vParse(s){ const o={}; String(s).replace(/([a-z]+)([+-])(\d)/g,(_,k,sg,n)=>{ o[k]=(sg==='-'?-1:1)*(+n); return ''; }); return o; }
function vEntry(name){ const e=VIT[name]; if(!e) return null; if(typeof e==='string') return {v:[['Действие',e]], n:{}}; return {g:e.g, v:e.v, n:e.n||{}, anti:e.anti}; }
function vState(p){
  const s=Object.assign({},p);
  if(s.bp===undefined && (s.vt||s.co||s.ven||s.hr)){ const est=Math.round(0.55*(s.vt||0)+0.35*(s.co||0)+0.25*(s.ven||0)+0.15*(s.hr||0)); if(est) s.bp=Math.max(-3,Math.min(3,est)); }
  return s;
}
const VNUM = {
  hr:  v=>Math.round(72+(v>0?17:11)*v),
  sys: v=>Math.round(120+(v>0?18:14)*v), dia: v=>Math.round(80+(v>0?9:8)*v),
  rr:  v=>v<=-3?4:Math.round(16+(v>0?4:3.5)*v),
  pu:  v=>[1.2,2,2.8,3.5,5,6.5,8][v+3],
  tmp: v=>(36.6+0.7*v),
  glu: v=>(5.0+(v>0?1.6:0.9)*v),
  k:   v=>(4.4+0.6*v)
};

/* ---------- SVG тела ---------- */
function vBodySVG(){
  return `<svg class="bd-svg" viewBox="0 0 360 700" role="img" aria-label="Схема организма">
  <defs>
    <radialGradient id="bd-glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="var(--bd-cns)" stop-opacity=".9"/><stop offset="1" stop-color="var(--bd-cns)" stop-opacity="0"/></radialGradient>
    <clipPath id="bd-bladder-clip"><ellipse cx="180" cy="452" rx="26" ry="20"/></clipPath>
  </defs>
  <g class="bd-sil">
    <path d="M150,440 L142,560 L138,676" class="bd-limb" stroke-width="44"/>
    <path d="M210,440 L218,560 L222,676" class="bd-limb" stroke-width="44"/>
    <path d="M100,186 L76,300 L62,410" class="bd-limb" stroke-width="32"/>
    <path d="M260,186 L284,300 L298,410" class="bd-limb" stroke-width="32"/>
    <path d="M112,166 Q180,148 248,166 L270,192 Q282,300 262,432 Q180,470 98,432 Q78,300 90,192 Z" class="bd-trunk"/>
    <rect x="164" y="126" width="32" height="40" rx="10" class="bd-trunk"/>
    <ellipse cx="180" cy="78" rx="50" ry="58" class="bd-trunk"/>
  </g>
  <!-- сосуды -->
  <g class="org" data-org="vessels" tabindex="0" role="button" aria-label="Сосуды">
    <path class="bd-art" d="M196,258 C198,226 176,222 172,246 L172,420 L150,446 L142,560 L138,660 M172,420 L208,446 L218,560 L222,660 M174,236 L120,196 L78,300 L64,400 M180,230 L240,196 L282,300 L296,400"/>
    <path class="bd-art bd-flow" d="M196,258 C198,226 176,222 172,246 L172,420 L150,446 L142,560 L138,660 M172,420 L208,446 L218,560 L222,660 M174,236 L120,196 L78,300 L64,400 M180,230 L240,196 L282,300 L296,400"/>
  </g>
  <!-- мозг -->
  <g class="org" data-org="brain" tabindex="0" role="button" aria-label="Головной мозг">
    <ellipse cx="180" cy="62" rx="54" ry="44" fill="url(#bd-glow)" class="bd-glowc"/>
    <path class="bd-brain" d="M140,70 C130,40 158,22 180,26 C204,22 232,40 222,70 C218,84 200,86 180,84 C160,86 144,84 140,70 Z"/>
    <path class="bd-gyri" d="M152,46 q8,8 16,0 q8,-8 16,0 q8,8 16,0 M150,62 q10,8 20,0 q10,-8 20,0 q10,8 20,0 M180,28 L180,84"/>
    <g class="bd-z"><text x="236" y="36">z</text><text x="248" y="22">z</text><text x="258" y="8">Z</text></g>
    <g class="bd-spark"><path d="M128,40 l-12,-6 M126,58 l-14,0 M232,40 l12,-6 M234,58 l14,0 M180,18 l0,-12"/></g>
  </g>
  <!-- глаза -->
  <g class="org" data-org="eye" tabindex="0" role="button" aria-label="Глаз">
    <ellipse cx="163" cy="98" rx="9" ry="6" class="bd-eyew"/><ellipse cx="197" cy="98" rx="9" ry="6" class="bd-eyew"/>
    <circle cx="163" cy="98" r="4.4" class="bd-iris"/><circle cx="197" cy="98" r="4.4" class="bd-iris"/>
    <circle cx="163" cy="98" r="1.6" class="bd-pupil"/><circle cx="197" cy="98" r="1.6" class="bd-pupil"/>
  </g>
  <!-- рот, слюна -->
  <g class="org" data-org="mouth" tabindex="0" role="button" aria-label="Слюнные железы">
    <ellipse cx="146" cy="118" rx="8" ry="6" class="bd-gland"/><ellipse cx="214" cy="118" rx="8" ry="6" class="bd-gland"/>
    <path d="M168,118 Q180,126 192,118" class="bd-mouth"/>
    <g class="bd-saliva"><path d="M178,124 q-3,6 0,9 q3,-3 0,-9 Z"/><path d="M186,124 q-3,6 0,9 q3,-3 0,-9 Z"/></g>
    <path class="bd-dry" d="M170,121 l3,2 l-2,2 M188,121 l3,2 l-2,2"/>
  </g>
  <!-- кожа: пот -->
  <g class="org" data-org="skin" tabindex="0" role="button" aria-label="Кожа">
    <g class="bd-sweat"><path d="M150,36 q-4,8 0,12 q4,-4 0,-12 Z"/><path d="M212,32 q-4,8 0,12 q4,-4 0,-12 Z"/><path d="M110,230 q-4,8 0,12 q4,-4 0,-12 Z"/><path d="M252,250 q-4,8 0,12 q4,-4 0,-12 Z"/></g>
    <g class="bd-heat"><path d="M120,14 q6,-8 0,-16 M144,6 q6,-8 0,-16 M216,6 q6,-8 0,-16 M240,14 q6,-8 0,-16"/></g>
  </g>
  <!-- лёгкие -->
  <g class="org" data-org="lungs" tabindex="0" role="button" aria-label="Лёгкие">
    <g class="bd-lungs">
      <path class="bd-lung" d="M168,206 C140,200 112,226 110,268 C108,302 118,318 140,316 C160,314 168,296 168,270 Z"/>
      <path class="bd-lung" d="M192,206 C220,200 248,226 250,268 C252,302 242,318 220,316 C200,314 192,296 192,270 Z"/>
    </g>
    <path class="bd-bronch" d="M180,136 L180,206 M180,206 L156,232 L140,262 M156,232 L134,240 M180,206 L204,232 L220,262 M204,232 L226,240 M140,262 L132,288 M220,262 L228,288"/>
    <g class="bd-mucus"><circle cx="150" cy="248" r="3"/><circle cx="214" cy="252" r="3"/><circle cx="138" cy="276" r="2.6"/><circle cx="224" cy="278" r="2.6"/></g>
  </g>
  <!-- сердце -->
  <g class="org" data-org="heart" tabindex="0" role="button" aria-label="Сердце">
    <path class="bd-heart" d="M196,288 C170,270 166,246 182,240 C192,236 198,244 200,250 C204,242 212,236 222,242 C236,252 224,274 196,288 Z"/>
  </g>
  <!-- печень, поджелудочная -->
  <g class="org" data-org="liver" tabindex="0" role="button" aria-label="Печень">
    <path class="bd-liver" d="M112,324 C122,306 168,304 196,314 C192,330 176,350 150,354 C128,356 110,344 112,324 Z"/>
  </g>
  <g class="org" data-org="pancreas" tabindex="0" role="button" aria-label="Поджелудочная железа">
    <path class="bd-panc" d="M168,362 C182,354 210,352 230,358 C224,366 196,370 172,370 Z"/>
  </g>
  <!-- желудок -->
  <g class="org" data-org="stomach" tabindex="0" role="button" aria-label="Желудок">
    <path class="bd-stom" d="M206,314 C226,306 250,318 246,340 C242,360 214,362 202,350 C196,344 204,336 212,338"/>
    <g class="bd-ulc"><circle cx="228" cy="336" r="3"/><circle cx="236" cy="326" r="2.4"/><circle cx="220" cy="346" r="2.2"/></g>
  </g>
  <!-- почки -->
  <g class="org" data-org="kidney" tabindex="0" role="button" aria-label="Почки">
    <path class="bd-kid" d="M128,368 C116,368 114,392 128,396 C136,398 138,388 134,382 C138,376 136,368 128,368 Z"/>
    <path class="bd-kid" d="M232,368 C244,368 246,392 232,396 C224,398 222,388 226,382 C222,376 224,368 232,368 Z"/>
    <path class="bd-ureter" d="M132,394 C146,420 164,430 172,442 M228,394 C214,420 196,430 188,442"/>
    <g class="bd-urine"><circle cx="0" cy="0" r="2.4"/><circle cx="0" cy="0" r="2.4"/></g>
  </g>
  <!-- кишечник -->
  <g class="org" data-org="gut" tabindex="0" role="button" aria-label="Кишечник">
    <path class="bd-gut" d="M150,380 C170,374 200,374 214,384 C226,392 214,402 196,398 C174,394 150,398 148,408 C146,420 176,424 200,420 C218,418 224,410 216,404"/>
    <path class="bd-gut bd-gutw" d="M150,380 C170,374 200,374 214,384 C226,392 214,402 196,398 C174,394 150,398 148,408 C146,420 176,424 200,420 C218,418 224,410 216,404"/>
  </g>
  <!-- мочевой пузырь -->
  <g class="org" data-org="bladder" tabindex="0" role="button" aria-label="Мочевой пузырь">
    <ellipse cx="180" cy="452" rx="26" ry="20" class="bd-blad"/>
    <rect class="bd-urfill" x="150" y="432" width="60" height="44" clip-path="url(#bd-bladder-clip)"/>
  </g>
  <!-- мышцы -->
  <g class="org" data-org="muscle" tabindex="0" role="button" aria-label="Скелетные мышцы">
    <g class="bd-musc"><ellipse cx="86" cy="250" rx="13" ry="34" transform="rotate(12 86 250)"/><ellipse cx="274" cy="250" rx="13" ry="34" transform="rotate(-12 274 250)"/><ellipse cx="146" cy="520" rx="15" ry="40"/><ellipse cx="214" cy="520" rx="15" ry="40"/></g>
  </g>
  <!-- кровь -->
  <g class="org" data-org="blood" tabindex="0" role="button" aria-label="Кровь">
    <path class="bd-drop" d="M300,452 C292,466 290,474 300,480 C310,474 308,466 300,452 Z"/>
    <g class="bd-bleed"><circle cx="300" cy="490" r="3"/><circle cx="292" cy="496" r="2"/><circle cx="308" cy="497" r="2.2"/></g>
  </g>
  <g class="bd-marks"></g>
  </svg>`;
}

/* ---------- ЭКГ ---------- */
function vECG(s){
  const hr=VNUM.hr(s.hr||0), RR=6000/hr; // 100 px = 1 с
  const av=s.av||0, qt=s.qt||0;
  const PR=Math.max(10,16-(av>0?2.5:6)*av), QRS=qt<=-2?11:8, QT=Math.max(30,38+7*Math.max(0,qt)-2*Math.max(0,-qt));
  const n=Math.max(3,Math.ceil(600/RR)); const Win=n*RR; const y0=62;
  let d=`M0,${y0}`; let x=0;
  const beat=(i,x0)=>{ let o=''; const drop = av<=-3 && i%3===2; const ectop = qt>=2 && i%4===3;
    const pS=x0+4;
    o+=` L${pS},${y0} q4,-8 8,0`; // P
    if(drop){ return o; }
    const q=pS+8+(PR-8);
    if(ectop){ o+=` L${q},${y0} l3,6 l6,-40 l6,46 l6,-12 q10,-14 20,0`; return o; }
    o+=` L${q},${y0} l2,4 l${QRS/2-1},-34 l${QRS/2},40 l2,-10`;
    const t0=q+QRS+3, tEnd=q+QT;
    o+=` L${t0+(tEnd-t0)*0.35},${y0} q${(tEnd-t0)*0.3},-14 ${(tEnd-t0)*0.65},0`;
    return o; };
  for(let i=0;i<2*n;i++){ d+=beat(i,i*RR); }
  d+=` L${2*Win+10},${y0}`;
  const dur=(Win/100).toFixed(2);
  return {svg:`<svg class="ecg" viewBox="0 0 600 100" preserveAspectRatio="xMinYMid slice" aria-hidden="true"><defs><pattern id="ecg-g" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20,0 L0,0 0,20" class="ecg-grid"/></pattern></defs><rect width="600" height="100" fill="url(#ecg-g)"/><g class="ecg-run" style="--w:-${Win.toFixed(1)}px;--d:${dur}s"><path d="${d}" class="ecg-line"/></g></svg>`, hr};
}

/* ---------- врезки: глаз, сосуды ---------- */
const PUPS=[0.32,0.5,0.75,1,1.4,1.85,2.3];
function vEye(){ return `<svg viewBox="0 0 160 110" class="ins-eye" aria-hidden="true"><path d="M8,55 Q80,-6 152,55 Q80,116 8,55 Z" class="eye-w"/><circle cx="80" cy="55" r="34" class="eye-iris"/><g class="eye-rays">${Array.from({length:18},(_,i)=>{ const a=i*20*Math.PI/180; return `<path d="M${80+14*Math.cos(a)},${55+14*Math.sin(a)} L${80+32*Math.cos(a)},${55+32*Math.sin(a)}"/>`; }).join('')}</g><circle cx="80" cy="55" r="11" class="eye-pupil"/><circle cx="90" cy="46" r="4" class="eye-glint"/></svg>`; }
function vVessel(){ return `<svg viewBox="0 0 220 110" class="ins-ves" aria-hidden="true"><g transform="translate(58 55)"><circle r="44" class="ves-wall"/><circle r="27" class="ves-lumen art-l"/><g class="rbc"><circle cx="-8" cy="-6" r="4"/><circle cx="7" cy="5" r="4"/><circle cx="2" cy="-12" r="3.6"/></g></g><text x="58" y="108" class="ins-t" text-anchor="middle">артериола</text><g transform="translate(162 55)"><circle r="40" class="ves-wall vein"/><circle r="31" class="ves-lumen ven-l"/></g><text x="162" y="108" class="ins-t" text-anchor="middle">вена</text></svg>`; }
const ARTS=[0.42,0.58,0.78,1,1.14,1.26,1.36], VENS=[0.8,0.87,0.94,1,1.1,1.2,1.28];

/* ---------- страница ---------- */
EXTRA.routes.body = function(A, arg){
  const name = arg ? decodeURIComponent(arg) : '';
  const nm = name && (VIT[name] ? name : Object.keys(VIT).find(k=>A.kSame(name,k)) || ((A.kFindDrug(name)||{}).n in VIT ? A.kFindDrug(name).n : ''));
  const page=A.$('#page');
  const chips=VCAT.map(([t,l])=>`<div class="bd-cat"><h6>${t}</h6><div>${l.map(x=>`<a class="bd-chip${x===nm?' on':''}" href="#body/${encodeURIComponent(x)}">${x}</a>`).join('')}</div></div>`).join('');
  page.innerHTML=`<header><p class="eyebrow">Организм · ${Object.keys(VIT).length} препаратов</p><h1 class="title">Как организм реагирует на препарат</h1><p class="lead">Выберите препарат — тело покажет, что происходит с сердцем, сосудами, зрачком, бронхами, ЖКТ, железами и ЦНС. Нажмите на орган, чтобы увидеть цепочку «причина → следствие» из досье.</p></header>
  <div class="bd-pick"><div class="bd-q"><input id="bdq" type="search" placeholder="Найти препарат: атропин, морфин, нитроглицерин…" autocomplete="off" aria-label="Найти препарат"><div class="bd-res" id="bdres"></div></div><button type="button" class="btn" id="bdrand">Случайный</button></div>
  <div class="bd-wrap">
    <div class="bd-body"><div class="bd-stage" id="bdstage">${vBodySVG()}</div><p class="bd-hint">Анимация: пульс, дыхание, перистальтика и диаметр сосудов меняются вслед за препаратом.</p></div>
    <div class="bd-panel" id="bdpanel"></div>
  </div>
  <details class="bd-all"${nm?'':' open'}><summary>Все препараты модели</summary>${chips}</details>
  <p class="note">Модель упрощённая: показывает направление и выраженность типичных эффектов у взрослого без сопутствующей патологии (шкала −3…+3), а не точные значения.</p>`;
  vSetup(A, nm);
};

function vSetup(A, nm){
  const $=A.$, $$=A.$$;
  const stage=$('#bdstage'), svg=$('.bd-svg',stage), panel=$('#bdpanel');
  let cur={name:nm, vi:0, s:{}}; let antiOn=false;
  const q=$('#bdq'), res=$('#bdres');
  const all=Object.keys(VIT);
  q.addEventListener('input',()=>{ const v=q.value.toLowerCase().trim(); if(v.length<2){ res.innerHTML=''; return; }
    const hits=all.filter(n=>n.toLowerCase().includes(v) || ((A.DRUGS[n]||{}).al||[]).some(a=>a.toLowerCase().includes(v))).slice(0,10);
    res.innerHTML=hits.length?hits.map(n=>`<a href="#body/${encodeURIComponent(n)}">${n}<small>${A.esc(vGroup(A,n))}</small></a>`).join(''):'<div class="none">Нет в модели. Попробуйте досье в базе препаратов.</div>'; });
  q.addEventListener('keydown',e=>{ if(e.key==='Enter'){ const a=$('a',res); if(a){ location.hash=a.getAttribute('href'); } } });
  $('#bdrand').addEventListener('click',()=>{ const k=all[Math.floor(Math.random()*all.length)]; location.hash='#body/'+encodeURIComponent(k); });
  svg.addEventListener('click',e=>{ const g=e.target.closest('.org'); if(g) vOrgan(A,cur,g.dataset.org); });
  svg.addEventListener('keydown',e=>{ const g=e.target.closest('.org'); if(g&&(e.key==='Enter'||e.key===' ')){ e.preventDefault(); vOrgan(A,cur,g.dataset.org); } });
  panel.addEventListener('click',e=>{
    const b=e.target.closest('[data-vi]'); if(b){ cur.vi=+b.dataset.vi; antiOn=false; render(); return; }
    const an=e.target.closest('[data-anti]'); if(an){ antiOn=!antiOn; render(); return; }
    const pl=e.target.closest('[data-play]'); if(pl){ apply({}); setTimeout(()=>apply(cur.s),420); return; }
    const o=e.target.closest('[data-org]'); if(o){ vOrgan(A,cur,o.dataset.org); }
  });
  function render(){
    if(!cur.name){ panel.innerHTML=vEmpty(); apply({}); vPanelLive(A,panel,{}); return; }
    const e=vEntry(cur.name); const v=e.v[Math.min(cur.vi,e.v.length-1)];
    cur.s = antiOn ? {} : vState(vParse(v[1])); cur.e=e;
    panel.innerHTML=vPanel(A,cur,e,antiOn);
    vPanelLive(A,panel,cur.s);
    apply(cur.s);
  }
  function apply(s){ vApply(svg, s); vPanelLive(A,panel,s); }
  // сначала норма, затем препарат — чтобы переход анимировался
  if(cur.name){ apply({}); requestAnimationFrame(()=>setTimeout(render,260)); } else render();
}
function vGroup(A,n){ const e=VIT[n]; return (e&&e.g) || ((A.DRUGS[n]||{}).g) || ''; }
function vEmpty(){ return `<div class="bd-empty"><h2>Норма</h2><p>ЧСС 72, АД 120/80, ЧДД 16, зрачок 3,5 мм, t 36,6 °C. Выберите препарат слева или из списка ниже.</p><div class="bd-sugg">${['Адреналин','Атропин','ФОС','Морфин','Нитроглицерин','Пропранолол','Кетамин','Хлорпромазин'].filter(x=>VIT[x]).map(x=>`<a class="bd-chip" href="#body/${encodeURIComponent(x)}">${x}</a>`).join('')}</div>${vGauges()}<div class="bd-card"><h3>ЭКГ</h3><div class="ecgw"></div></div><div class="bd-ins"><div class="bd-card"><h3>Зрачок</h3>${vEye()}</div><div class="bd-card"><h3>Сосуды</h3>${vVessel()}</div></div></div>`; }
function vGauges(){ return `<div class="bd-g">${[['hr','ЧСС','уд/мин'],['bp','АД','мм рт. ст.'],['rr','ЧДД','в мин'],['pu','Зрачок','мм'],['tmp','t тела','°C'],['glu','Глюкоза','ммоль/л']].map(([k,l,u])=>`<div class="g-${k}"><small>${l}</small><b data-g="${k}">—</b><span>${u}</span><i class="g-ar"></i></div>`).join('')}</div>`; }
function vPanel(A,cur,e,antiOn){
  const d=A.DRUGS[cur.name]; const card=A.findCard(cur.name);
  const s=cur.s;
  const eff=Object.keys(VPAR).filter(k=>s[k]).sort((a,b)=>Math.abs(s[b])-Math.abs(s[a]));
  const notes=Object.keys(e.n||{}).filter(k=>!s[k]);
  const dots=v=>`<span class="dots ${v>0?'up':'dn'}">${'●'.repeat(Math.abs(v))}${'○'.repeat(3-Math.abs(v))}</span>`;
  return `<div class="bd-h"><p class="eyebrow">${A.esc(vGroup(A,cur.name))}</p><h2>${cur.name}</h2>
  ${e.v.length>1||e.v[0][0]!=='Действие'?`<div class="seg bd-seg" role="group" aria-label="Режим">${e.v.map((x,i)=>`<button type="button" data-vi="${i}" aria-pressed="${i===cur.vi&&!antiOn}">${x[0]}</button>`).join('')}</div>`:''}
  <div class="bd-act"><button type="button" class="btn pri" data-play="1">▶ Ввести заново</button>${e.anti?`<button type="button" class="btn${antiOn?' on':''}" data-anti="1" aria-pressed="${antiOn}">${antiOn?'↺ Убрать антидот':'Ввести: '+e.anti[0]}</button>`:''}${(()=>{ const u=A.uFind(cur.name); return u?`<button type="button" class="btn" data-dr="${A.esc(u.n)}">Карточка: доза, побочки →</button>`:''; })()}${card?`<a class="btn" href="#${card.p}" data-kgo="${A.esc(card.n)}">Конспект ${A.BY[card.p].roman} →</a>`:''}</div></div>
  ${antiOn?`<p class="bd-anti">Антидот (${e.anti[0]}, ${e.anti[1]}) — показатели возвращаются к норме.</p>`:''}
  ${vGauges()}
  <div class="bd-card"><h3>ЭКГ <small>II отведение, схема</small></h3><div class="ecgw"></div></div>
  <div class="bd-ins"><div class="bd-card"><h3>Зрачок</h3>${vEye()}</div><div class="bd-card"><h3>Сосуды</h3>${vVessel()}</div></div>
  <div class="bd-card"><h3>Эффекты по системам</h3>${eff.length?`<ul class="bd-eff">${eff.map(k=>`<li><button type="button" data-org="${VPAR[k].o}"><span class="bd-o">${VORG[VPAR[k].o]}</span><b>${s[k]>0?VPAR[k].p:VPAR[k].m}</b>${dots(s[k])}${e.n&&e.n[k]?`<em>${e.n[k]}</em>`:''}</button></li>`).join('')}${notes.map(k=>`<li><button type="button" data-org="${VPAR[k].o}"><span class="bd-o">${VORG[VPAR[k].o]}</span><b>${VPAR[k].n}</b><em>${e.n[k]}</em></button></li>`).join('')}</ul>`:'<p class="dz-p">Выраженных системных эффектов нет'+(notes.length?': '+notes.map(k=>e.n[k]).join('; '):'')+'.</p>'}</div>
  <div class="bd-card bd-org" id="bdorg" hidden></div>`;
}
function vPanelLive(A,panel,s){
  const set=(k,txt,dir)=>{ const b=panel.querySelector(`[data-g="${k}"]`); if(!b) return; vCount(b,txt); const box=b.parentElement; box.classList.toggle('up',dir>0); box.classList.toggle('dn',dir<0); };
  set('hr',VNUM.hr(s.hr||0),s.hr||0);
  set('bp',VNUM.sys(s.bp||0)+'/'+VNUM.dia(s.bp||0),s.bp||0);
  set('rr',VNUM.rr(s.rr||0),s.rr||0);
  set('pu',VNUM.pu(s.pu||0).toFixed(1).replace('.',','),s.pu||0);
  set('tmp',VNUM.tmp(s.tmp||0).toFixed(1).replace('.',','),s.tmp||0);
  set('glu',VNUM.glu(s.glu||0).toFixed(1).replace('.',','),s.glu||0);
  const ecg=panel.querySelector('.ecgw'); if(ecg) ecg.innerHTML=vECG(s).svg;
  const p=panel.querySelector('.eye-pupil'); if(p) p.style.transform=`scale(${PUPS[(s.pu||0)+3]})`;
  const al=panel.querySelector('.art-l'); if(al) al.style.transform=`scale(${ARTS[-(s.vt||0)+3]})`;
  const vl=panel.querySelector('.ven-l'); if(vl) vl.style.transform=`scale(${VENS[-(s.ven||0)+3]})`;
}
function vCount(el,txt){
  const to=String(txt); const m=to.match(/^(\d+)(?:\/(\d+))?$/); const from=el._v;
  el._v=to; if(!m || !from || matchMedia('(prefers-reduced-motion: reduce)').matches){ el.textContent=to.replace('.',','); return; }
  const fm=String(from).match(/^(\d+)(?:\/(\d+))?$/); if(!fm){ el.textContent=to; return; }
  const a1=+fm[1], b1=+m[1], a2=+(fm[2]||0), b2=+(m[2]||0); const t0=performance.now(), T=700;
  cancelAnimationFrame(el._raf);
  const step=t=>{ const k=Math.min(1,(t-t0)/T), e=1-Math.pow(1-k,3); const x=Math.round(a1+(b1-a1)*e); el.textContent = m[2]? x+'/'+Math.round(a2+(b2-a2)*e) : x; if(k<1) el._raf=requestAnimationFrame(step); };
  el._raf=requestAnimationFrame(step);
}
function vApply(svg, s){
  const v=k=>s[k]||0; const st=svg.style;
  const hr=VNUM.hr(v('hr')); st.setProperty('--bd-rr', (60/hr).toFixed(3)+'s');
  st.setProperty('--bd-beat', (1.07+0.025*v('co')).toFixed(3));
  const rr=VNUM.rr(v('rr')); st.setProperty('--bd-br', (60/rr).toFixed(2)+'s'); st.setProperty('--bd-bamp', v('rr')<=-3?'1.005':(1.045+0.012*v('rr')).toFixed(3));
  st.setProperty('--bd-brw', Math.max(1.6, 6+1.6*v('br')).toFixed(1));
  st.setProperty('--bd-gid', v('gi')<=-3?'40s':(2.6-0.65*v('gi')).toFixed(2)+'s');
  st.setProperty('--bd-art', Math.max(2.2, 5-1*v('vt')).toFixed(1));
  st.setProperty('--bd-flow', (2.2-0.25*v('vt')+0.15*v('bp')).toFixed(2)+'s');
  st.setProperty('--bd-kid', v('kid')<=-3?'30s':(2.4-0.55*v('kid')).toFixed(2)+'s');
  st.setProperty('--bd-sal', (1.6-0.3*v('sal')).toFixed(2)+'s');
  st.setProperty('--bd-sw', (1.8-0.3*v('sw')).toFixed(2)+'s');
  st.setProperty('--bd-blf', String(v('bl')<0?0.96:0.5));
  const c=v('cns');
  const cnsCol = c<0? `color-mix(in srgb, var(--hema) ${30+20*-c}%, transparent)` : c>0 ? `color-mix(in srgb, var(--eosin) ${30+20*c}%, transparent)` : 'transparent';
  st.setProperty('--bd-cns', cnsCol);
  const cls=(k,on)=>svg.classList.toggle(k,!!on);
  cls('cns-dn',c<0); cls('cns-up',c>0); cls('cns-sz',c>=3);
  cls('sal-up',v('sal')>0); cls('sal-dn',v('sal')<0);
  cls('sw-up',v('sw')>0); cls('sw-dn',v('sw')<0 && v('tmp')>0 || v('sw')<=-2);
  cls('bs-up',v('bs')>0); cls('br-dn',v('br')<0);
  cls('ulc-up',v('ulc')>0); cls('liv-up',v('liv')>0); cls('glu-up',v('glu')>0); cls('glu-dn',v('glu')<0);
  cls('bl-dn',v('bl')<0); cls('bl-up',v('bl')>0); cls('kid-dn',v('kid')<0);
  cls('skm-up',v('skm')>0); cls('skm-dn',v('skm')<0); cls('skm-par',v('skm')<=-3);
  cls('coag-dn',v('coag')<0); cls('coag-up',v('coag')>0);
  cls('rr-dn',v('rr')<=-2); cls('qt-up',v('qt')>=2); cls('apnea',v('rr')<=-3);
  cls('vt-up',v('vt')>0); cls('vt-dn',v('vt')<0);
  // зрачки на лице
  svg.querySelectorAll('.bd-pupil').forEach(p=>p.style.transform=`scale(${PUPS[v('pu')+3]})`);
  // подсветка органов
  const orgs=new Set(Object.keys(s).filter(k=>s[k]&&VPAR[k]).map(k=>VPAR[k].o));
  svg.querySelectorAll('.org').forEach(g=>g.classList.toggle('hit',orgs.has(g.dataset.org)));
}
function vOrgan(A,cur,org){
  const box=document.getElementById('bdorg'); if(!box) return;
  const svg=document.querySelector('.bd-svg'); svg.querySelectorAll('.org').forEach(g=>g.classList.toggle('sel',g.dataset.org===org));
  const s=cur.s||{}; const e=cur.e||{n:{}};
  const ps=Object.keys(VPAR).filter(k=>VPAR[k].o===org && (s[k] || (e.n&&e.n[k])));
  const d=cur.name && A.DRUGS[cur.name]; let chains='';
  if(d){ const src=d.s || (d.like&&A.DRUGS[d.like]&&A.DRUGS[d.like].s) || {}; const want=VSYS[org]||[];
    const ks=Object.keys(src).filter(k=>want.includes(A.canon(k)));
    if(ks.length) chains=ks.map(k=>`<div class="sys"><h4>${k}</h4><div>${src[k].map(A.flow).join('')}</div></div>`).join(''); }
  box.hidden=false;
  box.innerHTML=`<h3>${VORG[org]}</h3>${ps.length?`<ul class="bd-eff">${ps.map(k=>`<li><span class="bd-o">${VPAR[k].n}</span><b>${s[k]?(s[k]>0?VPAR[k].p:VPAR[k].m):''}</b>${e.n&&e.n[k]?`<em>${e.n[k]}</em>`:''}</li>`).join('')}</ul>`:`<p class="dz-p">${cur.name?'Заметного действия на этот орган модель не показывает.':'Выберите препарат.'}</p>`}${chains?`<p class="bd-sub">Из досье: причина → следствие</p>${chains}`:''}`;
  box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
  if(typeof FX!=='undefined') FX.chains(box);
  if(matchMedia('(max-width: 920px)').matches) box.scrollIntoView({block:'nearest',behavior:'smooth'});
}
