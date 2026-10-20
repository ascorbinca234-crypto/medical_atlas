/* ===== Рендер атласа ===== */
(function(){
'use strict';

if(typeof KP!=='undefined' && KP.length){ P.unshift(...KP); if(!MODULES.find(m=>m.id==='kon')) MODULES.unshift({id:'kon', t:'Конспект лекций'}); }
{ let i=0; P.forEach(p=>{ if(p.mod!=='kon') p.num=++i; }); }
const isK = p=>p.mod==='kon';
const plab = p=>isK(p)?'Конспект '+p.roman:'Лист '+p.roman;
const BY = Object.fromEntries(P.map(p=>[p.id,p]));
const ACT = {stim:'стимулирует', block:'блокирует', mod:'модулирует'};
const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
const esc = s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const plain = s=>String(s).replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const key = s=>plain(s).toLowerCase().trim();
const first = s=>key(s).split(/[\s(,]/)[0];
const fmt = (x,d=2)=>Number(x).toFixed(d).replace('.',',');

/* ---------- поисковый индекс ---------- */
const IDX = []; const seen = new Set();
function addIdx(n,p,kind){ const k=p+'|'+key(n); if(seen.has(k)) return; seen.add(k); IDX.push({n:plain(n),k:key(n),p,kind}); }
P.forEach(p=>p.blocks.forEach(b=>{
  if(b.chips) b.chips.forEach(c=>addIdx(c.d,p.id,'d'));
  if(b.t==='groups') b.items.forEach(g=>{ addIdx(g.name,p.id,'g'); g.drugs.forEach(d=>addIdx(d,p.id,'d')); });
  if(b.t==='table' && b.idx) b.rows.forEach(r=>addIdx(String(r[0]).split('<br>')[0],p.id,isK(p)?'k':'d'));
  if(b.t==='tree') walkTree(b,nd=>{ (nd.d||[]).forEach(x=>addIdx(dname(x),p.id,'k')); if(nd.n&&nd.k) addIdx(nd.n,p.id,'kg'); });
  if(b.t==='cards') b.items.forEach(c=>addIdx(c.n,p.id,'k'));
  if(b.t==='graph') b.nodes.forEach(nd=>{ if(nd[4]==='d') addIdx(nd[3].replace(/\n/g,' '),p.id,'k'); });
}));
function walkTree(nd,fn){ fn(nd); (nd.k||[]).forEach(c=>walkTree(c,fn)); }
function dname(x){ return String(x).split('|')[0]; }

/* ---------- база препаратов: индекс ---------- */
const DLIST = Object.values(DRUGS).filter(d=>!d.hidden);
const DKEY = {};
if(typeof KALIAS!=='undefined') Object.entries(KALIAS).forEach(([a,n])=>{ if(DRUGS[n]){ DRUGS[n].al=(DRUGS[n].al||[]); if(!DRUGS[n].al.includes(a)) DRUGS[n].al.push(a); } });
DLIST.forEach(d=>{ [d.n].concat(d.al||[]).forEach(nm=>{ const k1=first(nm), k2=key(nm); if(!DKEY[k1]) DKEY[k1]=d; DKEY[k2]=d; }); });
const findDrug = nm=>DKEY[key(nm)]||DKEY[first(nm)]||null;
/* конспект: строгое сопоставление названий (по первому слову — только если одно из названий однословное) */
const kSplit = nm=>String(nm).split(' + ')[0].trim();
const kWords = s=>key(s).split(/[\s(),«»"]+/).filter(Boolean);
function kSame(q,n){ const a=key(kSplit(q)).replace(/\*/g,'').trim(), b=key(n).replace(/\*/g,'').trim(); if(!a||!b) return false; if(a===b) return true; const A=kWords(a), B=kWords(b); if(!A.length||!B.length) return false; return (A.length===1&&B[0]===A[0]) || (B.length===1&&A[0]===B[0]); }
const kNames = c=>[c.n].concat(c.al||[]);
const kFindDrug = nm=>{ const q=kSplit(nm); return DKEY[key(q)] || DLIST.find(d=>kNames(d).some(x=>kSame(q,x))) || null; };
const KCARDS = [];
P.filter(isK).forEach(p=>p.blocks.forEach(b=>{ if(b.t==='cards') b.items.forEach(c=>KCARDS.push({p:p.id,n:c.n,names:kNames(c)})); }));
const findCard = nm=>KCARDS.find(c=>c.names.some(x=>kSame(nm,x)))||null;
/* препарат в модели «Организм» */
const HASV = typeof VIT!=='undefined';
const bodyName = nm=>{ if(!HASV||!nm) return null; if(VIT[nm]) return nm; const d=kFindDrug(nm); if(d&&VIT[d.n]) return d.n; return Object.keys(VIT).find(k=>kSame(nm,k))||null; };
DLIST.forEach(d=>{ addIdx(d.n,d.p,'d'); (d.al||[]).forEach(a=>addIdx(a+' ('+d.n+')',d.p,'d')); });

/* ---------- единый реестр препаратов: конспект + досье + дозы ---------- */
const UMERGE = {'Алпрозолам':'Алпразолам','Алфузозин':'Альфузозин','Йохимбин':'Йохимбина гидрохлорид','Шалфея лекарственного листья':'Шалфея листья','Уголь активированный':'Активированный уголь','Ипратропий':'Ипратропия бромид','Перца стручкового плоды':'Плоды перца стручкового','Сульфокамфокаин':'Прокаин + Сульфокамфорная кислота','Селегилин':'Селегелин','Молсидомин':'Молсидамин','Крахмальная слизь':'Слизь крахмала','Льна посевного семена':'Льна семена','Нифедипин в таблетках пролонгированного действия':'Нифедипин'};
const UCOMBO = {'прокаин + сульфокамфорная кислота':'Сульфокамфокаин'};
const UNI=[], UBY={};
const uK = n=>key(n).replace(/ё/g,'е').replace(/[*«»"]/g,'').split(/[\s,]+/).filter(Boolean).sort().join(' ');
const UHL={'':0,g:1,y:2};
const uClean = s=>plain(String(s)).replace(/[*«»]/g,'').replace(/\s+/g,' ').trim();
const uSkip = n=>n.length<3 || /АБ$/.test(n);
function uNew(canon){ const e={n:canon, names:new Set(), hl:'', groups:[], cards:[], rx:[], ps:new Set(), d:null, v:null, x:null}; UBY[uK(canon)]=e; UNI.push(e); return e; }
function uEnt(name, fuzzy, pid){
  const canon=UMERGE[name]||name; let e=UBY[uK(canon)];
  if(!e && fuzzy){ const all=[name].concat(fuzzy===true?[]:fuzzy); const hit=x=>all.some(a=>kSame(a,x.n)||[...x.names].some(y=>kSame(a,y)));
    e = UNI.find(x=>x.ps.has(pid)&&hit(x)) || UNI.find(hit); }
  if(!e) e=uNew(canon);
  if(name!==e.n) e.names.add(name); return e; }
function uHl(e,h){ if(h && UHL[h]>UHL[e.hl]) e.hl=h; }
function uGroup(e,p,g){ e.ps.add(p.id); if(g && !e.groups.some(x=>x.p===p.id&&x.g===g)) e.groups.push({p:p.id,g}); }
/* проход 1: классификации */
P.filter(isK).forEach(p=>p.blocks.forEach(b=>{
  if(b.t==='tree'){ const walk=(nd,path)=>{ const here=uClean(nd.n||''); const pth=here?path.concat(here):path;
      (nd.d||[]).forEach(x=>{ const [nm0,h]=String(x).split('|'); const nm=uClean(nm0); if(uSkip(nm)) return; const e=uEnt(nm); uHl(e,h); uGroup(e,p,pth.slice(-2).join(' → ')); });
      (nd.k||[]).forEach(c=>walk(c,pth)); };
    walk({n:b.n||b.title,d:b.d,k:b.k},[]); }
}));
P.filter(isK).forEach(p=>p.blocks.forEach(b=>{
  if(b.t==='cols') b.cols.forEach(c=>(c.d||[]).forEach(x=>{ const [nm0,h]=String(x).split('|'); const nm=uClean(nm0); if(uSkip(nm)) return; const e=uEnt(nm,true,p.id); uHl(e,h); uGroup(e,p,uClean(c.h)); }));
}));
/* проход 2: карточки и списки для выписывания */
P.filter(isK).forEach(p=>p.blocks.forEach(b=>{
  if(b.t==='cards') b.items.forEach(c=>{ const nm=uClean(c.n); const e=uEnt(nm,(c.al||[]).map(uClean),p.id); e.cards.push({p:p.id,c}); uHl(e,c.hl); (c.al||[]).forEach(a=>{ if(uClean(a)!==e.n) e.names.add(uClean(a)); }); e.ps.add(p.id); });
}));
P.filter(isK).forEach(p=>p.blocks.forEach(b=>{
  if(b.t==='table' && b.idx && /выписыв/i.test(b.title||'')) b.rows.forEach(r=>{ const nm=uClean(String(r[0]).split('<br>')[0]); if(uSkip(nm)) return; const e=uEnt(nm,true,p.id); const mark=r.some(c=>/<mark>/.test(c));
    const vals=r.slice(1).map(c=>String(c).replace(/<\/?mark>/g,'')); const sig=vals.map(uClean).join('|'); if(!e.rx.some(x=>x.sig===sig)) e.rx.push({p:p.id, head:b.head.slice(1).map(uClean), vals, mark, sig}); if(mark) uHl(e,'y'); e.ps.add(p.id); });
}));
/* досье, модель «Организм», дозы */
const uLinkD = e=>{ const ns=[e.n,...e.names]; for(const n of ns){ if(/ \+ /.test(n)){ const m=UCOMBO[key(n)]; if(m&&DRUGS[m]) return DRUGS[m]; if(DKEY[key(n)]) return DKEY[key(n)]; continue; } const d=kFindDrug(n); if(d) return d; } return null; };
UNI.forEach(e=>{ e.d=uLinkD(e); });
DLIST.forEach(d=>{ if(UNI.some(e=>e.d===d)) return; const e=UBY[uK(UMERGE[d.n]||d.n)]||uNew(d.n); e.d=d; e.ps.add(d.p); (d.al||[]).forEach(a=>e.names.add(a)); });
// The free animation catalog contains names and physiological effects, not closed lecture dossiers.
if(HASV) Object.keys(VIT).forEach(n=>{ const e=UBY[uK(n)]||uNew(n); const v=vEntry(n); if(!e.groups.length && v.g)e.groups.push({g:v.g}); });
if(typeof RXAL!=='undefined') RXAL.forEach(([n,t])=>{ if(RXD[t]&&!RXD[n]) RXD[n]=RXD[t]; });
UNI.forEach(e=>{ if(e.d) e.ps.add(e.d.p);
  const own=[e.n,...e.names]; const RX0=typeof RXD!=='undefined'?RXD:{};
  e.x = own.map(n=>RX0[n]).find(Boolean) || (e.d && own.some(n=>key(n)===key(e.d.n)||kSame(n,e.d.n)) ? RX0[e.d.n] : null) || null;
  e.v = HASV ? (VIT[e.n] ? e.n : own.map(n=>VIT[n]?n:null).find(Boolean) || (e.d && VIT[e.d.n] ? e.d.n : null)) : null;
});
UNI.sort((a,b)=>a.n.localeCompare(b.n,'ru'));
function uFind(nm){
  if(!nm) return null; const n=uClean(nm);
  const k=uK(UMERGE[n]||n); if(UBY[k]) return UBY[k];
  const d=DRUGS[n]; if(d){ const e=UNI.find(e=>e.d===d&&(e.n===d.n||e.names.has(d.n)))||UNI.find(e=>e.d===d); if(e) return e; }
  const e=UNI.find(e=>kSame(n,e.n)||[...e.names].some(x=>kSame(n,x))); if(e) return e;
  const dd=kFindDrug(n); return dd?UNI.find(e=>e.d===dd)||null:null;
}
const uLecs = e=>[...e.ps].filter(id=>BY[id]).sort((a,b)=>P.indexOf(BY[a])-P.indexOf(BY[b])).map(id=>BY[id]);
const uKLecs = e=>uLecs(e).filter(isK);
const uCardsF = (e,f)=>{ const out=[]; e.cards.forEach(({c})=>[].concat(c[f]||[]).forEach(x=>{ if(!out.some(y=>key(y)===key(x))) out.push(x); })); return out; };
const uProto = e=>e.d&&e.d.like&&DRUGS[e.d.like]?DRUGS[e.d.like]:null;

/* ---------- карточка ---------- */
const uHlBadge = hl=>hl==='y'?'<span class="kd hl-y">жёлтый — наизусть: доза, сигнатура, кл, пок, п.э. + рецепт</span>':hl==='g'?'<span class="kd hl-g">зелёный — выписать рецепт</span>':'';
function uWhyList(arr,lab){ return `<ul class="dl2 u-why ${lab==='почему'?'ae':'ind'}">${arr.map(x=>{ let a,b; if(Array.isArray(x)){ [a,b]=x; } else { const i=String(x).indexOf(' — '); a=i>0?x.slice(0,i):x; b=i>0?x.slice(i+3):''; } return `<li><b>${a}</b>${b?`<span class="why"><em>${lab}</em>${b}</span>`:''}</li>`; }).join('')}</ul>`; }
const uPlain = arr=>`<ul class="u-l">${arr.map(x=>`<li>${x}</li>`).join('')}</ul>`;
function uDoseHTML(e,opt){
  opt=opt||{}; let o='';
  e.rx.forEach(r=>{ o+=`<div class="u-rx${r.mark?' mk':''}"><p class="u-src">По конспекту ${BY[r.p].roman}${r.mark?' · <span class="kd hl-y">наизусть</span>':''}</p><dl>${r.head.map((h,i)=>r.vals[i]&&uClean(r.vals[i])?`<div><dt>${h}</dt><dd>${r.vals[i]}</dd></div>`:'').join('')}</dl></div>`; });
  const fv=uCardsF(e,'fv'); if(fv.length) o+=`<div class="u-rx"><p class="u-src">Форма выпуска по конспекту</p>${uPlain(fv)}</div>`;
  if(e.x && (e.x.f||e.x.d) && (!e.rx.length || opt.all)) o+=`<dl class="u-dl">${e.x.f?`<div><dt>Форма выпуска</dt><dd>${e.x.f}</dd></div>`:''}${e.x.d?`<div><dt>Как применяют и доза</dt><dd>${e.x.d}</dd></div>`:''}</dl><p class="u-note">${e.rx.length?'Дополнительно: ':''}ориентир для взрослых по инструкциям — не из конспекта.</p>`;
  if(e.x && e.x.n) o+=`<p class="kwarn u-x"><b>Важно</b> ${e.x.n}</p>`;
  if(!opt.norp) e.cards.forEach(({c})=>{ if(c.rp) o+=`<div class="u-rp"><p class="u-src">Рецепт из конспекта</p><pre class="kc-rp">${c.rp}</pre></div>`; });
  return o||'<p class="dz-p">Доза в материалах не указана.</p>';
}
function uIndHTML(e,short){
  const k=uCardsF(e,'pok'); const d=e.d&&e.d.i&&e.d.i.length?e.d.i:null; const x=e.x&&e.x.i;
  const other = e.d && key(e.d.n)!==key(e.n) && ![...e.names].some(n=>key(n)===key(e.d.n)) ? e.d.n : '';
  let o='';
  if(k.length) o+=`<p class="u-src">По конспекту</p>${uPlain(short?k.slice(0,6):k)}`;
  if(x && !k.length) o+=uWhyList(x,'зачем');
  if(d && !short) o+= (k.length||x) ? `<details class="u-more"><summary>Зачем — с объяснением${other?' (досье: '+other+')':''}</summary>${uWhyList(d,'зачем')}</details>` : `${other?`<p class="u-src">По досье: ${other}</p>`:''}${uWhyList(d,'зачем')}`;
  else if(d && short && !k.length && !x) o+=uWhyList(d.slice(0,5),'зачем');
  return o||'<p class="dz-p">Нет данных.</p>';
}
function uAeHTML(e,short){
  const k=uCardsF(e,'pe'); const d=e.d&&e.d.a&&e.d.a.length?e.d.a:null; const x=e.x&&e.x.a;
  const other = e.d && key(e.d.n)!==key(e.n) && ![...e.names].some(n=>key(n)===key(e.d.n)) ? e.d.n : '';
  let o='';
  if(k.length) o+=`<p class="u-src">По конспекту</p>${uPlain(short?k.slice(0,6):k)}`;
  if(x && !k.length) o+=uWhyList(x,'почему');
  if(d && !short) o+= (k.length||x) ? `<details class="u-more"><summary>Почему возникают — механизм${other?' (досье: '+other+')':''}</summary>${uWhyList(d,'почему')}</details>` : `${other?`<p class="u-src">По досье: ${other}</p>`:''}${uWhyList(d,'почему')}`;
  else if(d && short && !k.length && !x) o+=uWhyList(d.slice(0,5),'почему');
  return o||'<p class="dz-p">Нет данных.</p>';
}
function uBodyHTML(e){
  if(!e.v) return ''; const en=vEntry(e.v); if(!en) return '';
  const s=vState(vParse(en.v[0][1])); const ks=Object.keys(VPAR).filter(k=>s[k]).sort((a,b)=>Math.abs(s[b])-Math.abs(s[a])).slice(0,8);
  const dots=v=>`<span class="dots ${v>0?'up':'dn'}">${'●'.repeat(Math.abs(v))}${'○'.repeat(3-Math.abs(v))}</span>`;
  const g=[]; if(s.hr) g.push(['ЧСС',VNUM.hr(s.hr),s.hr]); if(s.bp) g.push(['АД',VNUM.sys(s.bp)+'/'+VNUM.dia(s.bp),s.bp]); if(s.rr) g.push(['ЧДД',VNUM.rr(s.rr),s.rr]); if(s.pu) g.push(['Зрачок',VNUM.pu(s.pu).toFixed(1).replace('.',',')+' мм',s.pu]);
  return `<section class="dz-sec u-sec"><h3>Как действует на организм${en.v.length>1?' · '+en.v[0][0].toLowerCase():''}</h3>${g.length?`<div class="u-g">${g.map(([l,v,d])=>`<span class="${d>0?'up':'dn'}">${l} <b>${v}</b> ${d>0?'↑':'↓'}</span>`).join('')}</div>`:''}<ul class="bd-eff u-eff">${ks.map(k=>`<li><span class="bd-o">${VORG[VPAR[k].o]}</span><b>${s[k]>0?VPAR[k].p:VPAR[k].m}</b>${dots(s[k])}</li>`).join('')}</ul><p class="u-act"><a class="btn" href="#body/${encodeURIComponent(e.v)}">▶ Показать на схеме тела</a></p></section>`;
}
function uCardHTML(e){
  const kl=uKLecs(e); const pr=uProto(e);
  const grp = e.groups.length ? e.groups.map(g=>`<li><span class="roman">${BY[g.p]?BY[g.p].roman:''}</span>${g.g}</li>`).join('') : '';
  const other=[...e.names].filter(n=>n!==e.n);
  const feats=uCardsF(e,'f'), fm=uCardsF(e,'fm'), pp=uCardsF(e,'pp'), xs=e.cards.map(({c})=>c.x).filter(Boolean);
  const kli=e.cards.map(({c})=>c.kl).filter(Boolean);
  const m=e.d?(e.d.m||(pr&&pr.m)||[]):[], s=e.d?(e.d.s||(pr&&pr.s)||{}):{};
  const head=`<header class="dz-h"><p class="eyebrow">${kl.length?'Конспект '+kl.map(p=>`<span class="roman">${p.roman}</span>`).join(', '):(e.d?'Лист <span class="roman">'+BY[e.d.p].roman+'</span>':'Препарат')}</p><h2 id="dz-title">${e.n}</h2>${other.length?`<p class="dz-al">${e.cards.length||e.groups.length?'Также: ':'Другие названия: '}${other.join(', ')}</p>`:''}${e.hl?`<p class="u-hl">${uHlBadge(e.hl)}</p>`:''}
    ${grp?`<ul class="u-grp">${grp}</ul>`:(e.d?`<p class="dz-g">${e.d.g}</p>`:'')}${kli.length?`<p class="kc-kl"><span>кл</span>${kli.join('; ')}</p>`:''}${e.d?`<span class="dz-t">${e.d.t}</span>`:''}</header>`;
  if(e.v && !e.d && !e.cards.length && !e.rx.length && !e.x) return head + uBodyHTML(e) + '<p class="dz-p">Анимация доступна бесплатно. Подробные досье и остальные конспекты открываются по подписке.</p>';
  const sec=(cls,h,body)=>`<section class="dz-sec u-sec ${cls}"><h3>${h}</h3>${body}</section>`;
  let o=head;
  o+=sec('u-dose','Дозировка и форма выпуска',uDoseHTML(e,{all:true}));
  o+=sec('u-ind','Зачем выписывают',uIndHTML(e));
  o+=sec('u-ae','Побочные эффекты',uAeHTML(e));
  if(pp.length||(e.d&&e.d.c)) o+=sec('u-pp','Противопоказания',`${pp.length?`<p class="u-src">По конспекту</p>${uPlain(pp)}`:''}${e.d&&e.d.c?`<p class="dz-p">${e.d.c}</p>`:''}`);
  if(fm.length) o+=`<section class="dz-sec u-sec u-fm"><h3>Возможные формулировки</h3><div class="kc-fm"><ol>${fm.map(x=>`<li>${x}</li>`).join('')}</ol></div></section>`;
  if(feats.length||xs.length) o+=sec('u-f','Особенности — по конспекту',`${feats.length?uPlain(feats):''}${xs.map(x=>`<p class="kc-x">${x}</p>`).join('')}`);
  o+=uBodyHTML(e);
  if(e.d && e.d.x) o+=sec('u-imp','Важно',`<p class="dz-p">${e.d.x}</p>`);
  if(m.length||Object.keys(s).length) o+=`<details class="u-more u-mech"><summary>Механизм по шагам и влияние на системы${pr&&!e.d.m?' — как у '+pr.n:''}${e.d&&key(e.d.n)!==key(e.n)?' (досье: '+e.d.n+')':''}</summary>${m.length?`<ol class="mstep">${m.map(x=>`<li>${x}</li>`).join('')}</ol>`:''}${Object.keys(s).map(k=>`<div class="sys"><h4>${k}</h4><div>${s[k].map(flow).join('')}</div></div>`).join('')}</details>`;
  const where = uLecs(e);
  if(where.length) o+=`<section class="dz-sec u-sec u-where"><h3>Где встречается</h3><div class="u-wh">${where.map(p=>`<button type="button" class="btn" data-goplate="${p.id}" data-n="${esc([e.n,...e.names].join('|'))}"${isK(p)?' data-k="1"':''}>${plab(p)}: ${p.title} →</button>`).join('')}</div></section>`;
  return o;
}
/* компактно — для карточек «Учить» */
function uLearnHTML(e){
  if(!e) return '';
  const sec=(cls,h,body)=>`<div class="lb-s ${cls}"><h4>${h}</h4>${body}</div>`;
  const grp=e.groups.length?`<ul class="u-l">${e.groups.slice(0,3).map(g=>`<li>${g.g}</li>`).join('')}</ul>`:(e.d?`<p>${e.d.g}</p>`:'');
  const kli=e.cards.map(({c})=>c.kl).filter(Boolean);
  const fm=uCardsF(e,'fm');
  return `${grp||kli.length?sec('','Группа',grp+(kli.length?`<p class="kc-kl"><span>кл</span>${kli.join('; ')}</p>`:'')):''}${sec('u-dose','Дозировка',uDoseHTML(e,{all:true,norp:false}))}${sec('pok','Зачем выписывают',uIndHTML(e,true))}${sec('pe','Побочные эффекты',uAeHTML(e,true))}${fm.length?`<div class="lb-s fm"><h4>Возможные формулировки</h4><ul>${fm.map(x=>`<li>${x}</li>`).join('')}</ul></div>`:''}`;
}

/* ---------- навигация ---------- */
/* ---------- закрытые темы ---------- */
const LOCK_ICO='<svg class="lock-ico" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7.5" rx="1.6"/><path d="M5.3 7V5.2a2.7 2.7 0 0 1 5.4 0V7"/></svg>';
const LOCKED_N = P.filter(p=>p.locked).length;
const CONTENT_ADMIN = !!(window.MA && window.MA.user && window.MA.user() && window.MA.user().isAdmin);
function maState(){ return window.MA_STATE||{auth:'none'}; }
function lockActions(){
  const MA=window.MA, st=maState();
  if(st.auth==='error') return `<p class="par">Вы вошли, но закрытые темы не загрузились. Проверьте интернет и <button type="button" class="tlink" onclick="location.reload()">обновите страницу</button>.</p>`;
  if(MA&&MA.signedIn()) return '<p class="par">Для полной версии нужна подписка на фармакологию. Продажи пока не запущены.</p>';
  if(!MA||!MA.enabled()) return `<p class="par">Вход работает на сайте атласа: <a href="https://ascorbinca234-crypto.github.io/medical_atlas/farma-atlas/">ascorbinca234-crypto.github.io/medical_atlas</a>.</p>`;
  return `<div class="dz-act"><a class="btn pri" href="${esc(MA.loginUrl())}">Войти</a><a class="btn" href="${esc(MA.loginUrl('register'))}">Зарегистрироваться</a></div><p class="par lock-how">Регистрация бесплатная.</p>`;
}
function lockBanner(){
  if(CONTENT_ADMIN) return '<div class="lockban"><div><b>Администратор: все конспекты доступны без подписки.</b><span>Выберите нужную тему в указателе.</span></div></div>';
  if(!LOCKED_N) return '';
  const open=KP.filter(p=>!p.locked).length, sh=P.filter(p=>p.mod!=='kon'&&!p.locked).length;
  const shAll=P.filter(p=>p.mod!=='kon').length, pl=(n,a,b,c)=>{ const m=n%10, h=n%100; return m===1&&h!==11?a:(m>=2&&m<=4&&(h<12||h>14)?b:c); };
  return `<div class="lockban">${LOCK_ICO}<div><b>В пробной версии открыты ${open} ${pl(open,'лекция','лекции','лекций')} из ${KP.length} и ${sh} ${pl(sh,'лист','листа','листов')} из ${shAll}.</b><span>Модель «Организм» и анимации действия препаратов открыты бесплатно. Остальные конспекты и подробные досье доступны по подписке.</span></div>${window.MA&&window.MA.enabled()?`<a class="btn pri" href="${esc(window.MA.loginUrl())}">Войти</a>`:''}</div>`;
}
function renderLockedPlate(p){
  $('#page').innerHTML=`<section class="hero locked-hero"><p class="eyebrow">${isK(p)?(p.lec||'Лекция')+' · '+p.roman:'Лист '+p.roman}</p><h1>${p.title}</h1>${p.sum?`<p class="lead">${p.sum}</p>`:''}
  <div class="lockcard">${LOCK_ICO.replace('lock-ico','lock-ico big')}<div><h2>Тема откроется по подписке</h2><p class="par">Два базовых конспекта доступны всем. Для остальных материалов нужна действующая подписка на фармакологию. Регистрация не открывает полный доступ.</p>${lockActions()}</div></div></section>`;
}
const ICO = {
  db:'<svg viewBox="0 0 20 20" aria-hidden="true"><ellipse cx="10" cy="4.5" rx="6.5" ry="2.5"/><path d="M3.5 4.5v11c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5v-11M3.5 10c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5"/></svg>',
  body:'<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="3.6" r="2.3"/><path d="M5 8.2h10M10 7v5.2M7.2 18.4l2.8-6.2 2.8 6.2"/><path class="ico-hb" d="M10 10.6c-1.3-1-2.1-1.7-2.1-2.5 0-.6.5-1 1-1 .5 0 .9.3 1.1.7.2-.4.6-.7 1.1-.7.5 0 1 .4 1 1 0 .8-.8 1.5-2.1 2.5z"/></svg>',
  learn:'<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="5.5" y="2.5" width="11" height="14" rx="2" transform="rotate(8 11 9.5)"/><rect x="3.5" y="3.5" width="11" height="14" rx="2"/><path d="M6.5 8h5M6.5 11h3.5"/></svg>'
};
function buildNav(){
  const due = typeof lDueCount==='function' ? lDueCount(A) : 0;
  $('#nav').innerHTML = `<div class="navtop"><a href="#drugs" data-id="drugs" class="navdb"><span class="n">${ICO.db}</span><span>${LOCKED_N?'Препараты из конспектов':'Все препараты'} <small>${UNI.length}</small></span></a>${HASV?`<a href="#body" data-id="body" class="navdb"><span class="n">${ICO.body}</span><span>Организм <small>${Object.keys(VIT).length}</small></span></a>`:''}${typeof lDeck==='function'?`<a href="#learn" data-id="learn" class="navdb"><span class="n">${ICO.learn}</span><span>Учить препараты <small class="due" title="к повторению сегодня"${due?'':' hidden'}>${due}</small></span></a>`:''}</div>` + MODULES.map(m=>`<div><h6>${m.t}</h6>${P.filter(p=>p.mod===m.id).map(p=>`<a href="#${p.id}" data-id="${p.id}"${p.locked&&!CONTENT_ADMIN?' class="is-locked" title="Откроется по подписке"':''}><span class="n">${p.roman}</span><span>${p.title}</span>${p.locked&&!CONTENT_ADMIN?LOCK_ICO:''}</a>`).join('')}</div>`).join('');
}
function setCurrent(id){ $$('#nav a').forEach(a=>{ if(a.dataset.id===id) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); }); }

const rail=$('#rail'), scrim=$('#scrim'), menuBtn=$('#menuBtn');
function menu(open){ rail.classList.toggle('open',open); scrim.classList.toggle('open',open); menuBtn.setAttribute('aria-expanded',open?'true':'false'); }
menuBtn.addEventListener('click',()=>menu(!rail.classList.contains('open')));
scrim.addEventListener('click',()=>menu(false));
$('#nav').addEventListener('click',e=>{ if(e.target.closest('a')) menu(false); });
$('.brand').addEventListener('click',()=>menu(false));

/* ---------- поиск ---------- */
const q=$('#q'), res=$('#results');
q.addEventListener('input',()=>{
  const v=q.value.toLowerCase().trim();
  if(v.length<2){ res.innerHTML=''; return; }
  const nv=v.replace(/ё/g,'е');
  const dh=UNI.map(e=>{ const ns=[e.n,...e.names]; const m=ns.find(n=>key(n).replace(/ё/g,'е').includes(nv)); return m?{e,m,st:key(m).replace(/ё/g,'е').startsWith(nv)}:null; }).filter(Boolean).sort((a,b)=>(b.st-a.st)||a.e.n.localeCompare(b.e.n,'ru')).slice(0,10);
  const gh=IDX.filter(x=>(x.kind==='g'||x.kind==='kg')&&x.k.includes(v)).slice(0,5);
  const sub=e=>{ const g=e.groups[0]; return g?`${BY[g.p]?BY[g.p].roman:''} · ${g.g}`:(e.d?e.d.g:''); };
  res.innerHTML = dh.length||gh.length ? dh.map(h=>`<button type="button" data-u="${esc(h.e.n)}"><b>${esc(h.e.n)}${h.m!==h.e.n?` <i>(${esc(h.m)})</i>`:''}</b><small>${esc(plain(sub(h.e)))}</small></button>`).join('') + gh.map(h=>`<button type="button" data-p="${h.p}" data-n="${esc(h.n)}" data-kind="${h.kind}"><b>${esc(h.n)}</b><small>Группа · ${plab(BY[h.p])}</small></button>`).join('') : '<div class="none">Ничего не найдено</div>';
});
res.addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b) return;
  if(b.dataset.u){ q.value=''; res.innerHTML=''; menu(false); openDossier(b.dataset.u,q); return; }
  const kd=b.dataset.kind;
  const dd = kd==='d' ? findDrug(b.dataset.n) : null;
  if(kd==='k'||kd==='kg') pending={n:b.dataset.n, kind:'k'}; else if(dd) pendingDossier=dd.n; else pending={n:b.dataset.n, kind:kd};
  q.value=''; res.innerHTML='';
  menu(false);
  if(location.hash.slice(1)===b.dataset.p) { route(); } else location.hash=b.dataset.p;
});
q.addEventListener('keydown',e=>{ if(e.key==='Enter'){ const b=res.querySelector('button'); if(b){ e.preventDefault(); b.click(); } } else if(e.key==='Escape'){ q.value=''; res.innerHTML=''; q.blur(); } });
let pending=null, pendingDossier=null;

/* ---------- SVG: общие ---------- */
function defs(id){ return `<defs><marker id="ahu-${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--ink-3)"/></marker><marker id="ahh-${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="14" markerHeight="14" markerUnits="userSpaceOnUse" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--hema)"/></marker><marker id="ah-${id}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="s-arr-h"/></marker><pattern id="hatch-${id}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" class="s-hatch"/></pattern></defs>`; }
function pillW(t){ return Math.max(46, plain(t).length*7.4+24); }
function pill(x,y,t,cls='s-enz'){ const w=pillW(t); return `<rect class="${cls}" x="${x-w/2}" y="${y-14}" width="${w}" height="28" rx="14"/><text class="t-pill" x="${x}" y="${y+4.5}" text-anchor="middle">${t}</text>`; }
function box(x,y,t,cls='s-node'){ const w=Math.max(70, plain(t).length*7.6+24); return `<rect class="${cls}" x="${x-w/2}" y="${y-15}" width="${w}" height="30" rx="8"/><text class="t-lab-b" x="${x}" y="${y+4.5}" text-anchor="middle">${t}</text>`; }
function site(k,cx,cy,r,inner,label,rect){ const extra = rect?` data-w="${rect[0]}" data-h="${rect[1]}"`:''; return `<g class="site" data-site="${k}" data-cx="${cx}" data-cy="${cy}" data-r="${r}"${extra} tabindex="0" role="button" aria-label="${esc(plain(label||k))}">${inner}</g>`; }
const T = (x,y,t,cls='t-lab',anchor='middle')=>`<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}">${t}</text>`;
const Z = (x,y,t,anchor='start')=>`<text class="t-zone" x="${x}" y="${y}" text-anchor="${anchor}">${plain(t).toUpperCase()}</text>`;

/* ---------- SVG: синапс ---------- */
function svgSynapse(b,id){
  const S=b.sites||{}, M=`url(#ah-${id})`; let o='';
  o+=`<rect class="s-post" x="40" y="320" width="680" height="130"/><path class="s-memb" d="M40,320 H720"/>`;
  o+=`<path class="s-pre" d="M345,0 V36 C345,58 210,52 205,110 V168 C205,212 236,226 280,226 H480 C524,226 555,212 555,168 V110 C550,52 415,58 415,36 V0 Z"/>`;
  o+=Z(16,24,b.pre)+Z(16,302,'Синаптическая щель')+Z(56,436,b.post);
  // митохондрия
  const mito=`<ellipse class="s-mito" cx="472" cy="100" rx="46" ry="21"/>`+(S.mito?T(472,104.5,S.mito.l,'t-pill'):`<path class="s-cris" d="M436,100 q6,-12 12,0 t12,0 t12,0 t12,0 t12,0 t12,0"/>`);
  o+= S.mito? site('mito',472,100,54,mito,S.mito.l) : mito;
  // синтез
  if(S.synth){ o+=site('synth',290,92,Math.max(40,pillW(S.synth.l)/2+10),pill(290,92,S.synth.l),S.synth.l); if(S.synth.r) o+=T(290,121,S.synth.r,'t-small'); }
  // везикулы
  [[330,170],[382,158],[434,172]].forEach(([x,y])=>{ o+=`<circle class="s-ves" cx="${x}" cy="${y}" r="17"/>`+[[-6,-5],[5,-6],[-5,6],[6,5]].map(([dx,dy])=>`<circle class="s-nt" cx="${x+dx}" cy="${y+dy}" r="2.6"/>`).join(''); });
  if(S.ves){ o+=site('ves',382,141,22,`<rect class="s-prot" x="372" y="134" width="20" height="12" rx="3"/>`,S.ves.l)+T(406,135,S.ves.l,'t-lab','start'); }
  // экзоцитоз
  const fuse=`<path class="s-gap" d="M367,226 H393"/><path class="s-ves" d="M367,226 A13,13 0 1,1 393,226"/>`+[[373,236],[386,240],[380,248],[392,233]].map(([x,y])=>`<circle class="s-nt" cx="${x}" cy="${y}" r="2.6"/>`).join('');
  o+= S.rel? site('rel',380,226,24,fuse,S.rel.l)+T(380,264,S.rel.l) : fuse;
  // медиатор в щели
  o+=[[332,280],[348,296],[366,276],[402,284],[420,300],[440,278],[458,294],[392,300],[312,298]].map(([x,y])=>`<circle class="s-nt" cx="${x}" cy="${y}" r="2.6" opacity=".7"/>`).join('');
  if(S.ca){ o+=site('ca',290,226,24,`<rect class="s-prot" x="278" y="211" width="9" height="30" rx="3"/><rect class="s-prot" x="293" y="211" width="9" height="30" rx="3"/><path class="s-arr" d="M290,250 V204" marker-end="${M}"/>`,S.ca.l)+T(290,264,S.ca.l); }
  if(S.auto){ o+=site('auto',470,228,24,`<rect class="s-prot" x="459" y="212" width="22" height="30" rx="6"/><circle class="s-pocket" cx="470" cy="242" r="5"/>`,S.auto.l)+T(470,264,S.auto.l); }
  if(S.prec){ o+=site('prec',205,150,26,`<rect class="s-prot" x="193" y="133" width="10" height="34" rx="4"/><rect class="s-prot" x="207" y="133" width="10" height="34" rx="4"/><path class="s-arr" d="M180,150 H228" marker-end="${M}"/>`,S.prec.l)+T(176,155,S.prec.l,'t-lab','end'); }
  if(S.reup){ o+=site('reup',555,150,26,`<rect class="s-prot" x="543" y="133" width="10" height="34" rx="4"/><rect class="s-prot" x="557" y="133" width="10" height="34" rx="4"/><path class="s-arr" d="M580,150 H532" marker-end="${M}"/>`,S.reup.l)+T(586,155,S.reup.l,'t-lab','start'); }
  if(S.cleft){ o+=site('cleft',640,272,Math.max(34,pillW(S.cleft.l)/2+8),pill(640,272,S.cleft.l),S.cleft.l); }
  [['r1',250],['r2',380],['r3',510]].forEach(([k,x])=>{ const s=S[k]; if(!s) return;
    o+=site(k,x,322,28,`<rect class="s-prot" x="${x-14}" y="304" width="28" height="34" rx="7"/><circle class="s-pocket" cx="${x}" cy="304" r="6"/>`+(s.ion?`<path class="s-pore" d="M${x},311 V336"/>`:''),s.l)+T(x,362,s.l); });
  if(S.post){ o+=site('post',640,392,Math.max(34,pillW(S.post.l)/2+8),pill(640,392,S.post.l),S.post.l); }
  return `<svg viewBox="0 0 760 450" role="img" aria-label="${esc(plain(b.title))}" style="min-width:600px">${defs(id)}${o}<g class="hl"></g></svg>`;
}

/* ---------- SVG: мембрана с мишенями ---------- */
function svgMembrane(b,id){
  const st=140, n=b.targets.length, per=n>5?Math.ceil(n/2):n, rows=Math.ceil(n/per), W=180+st*per, RH=272, M=`url(#ah-${id})`; let o='';
  for(let r=0;r<rows;r++){ const oy=r*RH;
    o+=`<rect class="s-bil" x="0" y="${112+oy}" width="${W}" height="36"/><path class="s-bil-l" d="M0,${112+oy} H${W} M0,${148+oy} H${W}"/>`;
    o+=Z(W-14,98+oy,'Внеклеточно','end')+Z(W-14,170+oy,'Цитоплазма','end'); }
  b.targets.forEach((t,i)=>{
    const oy=Math.floor(i/per)*RH, x=100+st*(i%per); let g=''; let cy=130+oy, r=44;
    const Y=v=>v+oy;
    const pair=`<rect class="s-prot" x="${x-25}" y="${Y(102)}" width="20" height="56" rx="6"/><rect class="s-prot" x="${x+5}" y="${Y(102)}" width="20" height="56" rx="6"/>`;
    const arrow = t.dir==='in'?`<path class="s-arr" d="M${x},${Y(74)} V${Y(194)}" marker-end="${M}"/>`: t.dir==='out'?`<path class="s-arr" d="M${x},${Y(194)} V${Y(74)}" marker-end="${M}"/>`:'';
    if(t.kind==='chan') g=pair+arrow;
    else if(t.kind==='lgic') g=pair+`<circle class="s-pocket" cx="${x-15}" cy="${Y(102)}" r="5"/><circle class="s-pocket" cx="${x+15}" cy="${Y(102)}" r="5"/>`+arrow;
    else if(t.kind==='a2d') g=pair+`<path class="s-arr" d="M${x+20},${Y(102)} L${x+28},${Y(92)}"/><ellipse class="s-prot2" cx="${x+36}" cy="${Y(84)}" rx="17" ry="12"/>`+T(x+36,Y(88),'α₂δ','t-small')+arrow;
    else if(t.kind==='trans') g=`<rect class="s-prot" x="${x-22}" y="${Y(104)}" width="17" height="52" rx="8"/><rect class="s-prot" x="${x+5}" y="${Y(104)}" width="17" height="52" rx="8"/>`+arrow;
    else if(t.kind==='gpcr'){ let d=`M${x-33},${Y(150)}`, up=true; for(let k=0;k<7;k++){ d+= up?` V${Y(108)}`:` V${Y(152)}`; if(k<6) d+=' h11'; up=!up; } g=`<path class="s-serp" d="${d}"/><ellipse class="s-prot2" cx="${x}" cy="${Y(176)}" rx="18" ry="11"/>`+T(x,Y(180),'G','t-small'); }
    else if(t.kind==='ves'){ cy=Y(226); r=36; g=`<circle class="s-ves" cx="${x}" cy="${Y(226)}" r="24"/>`+[[-8,-4],[7,-7],[-6,8],[8,6],[0,0]].map(([dx,dy])=>`<circle class="s-nt" cx="${x+dx}" cy="${Y(226)+dy}" r="2.6"/>`).join('')+`<rect class="s-prot2" x="${x-8}" y="${Y(196)}" width="16" height="11" rx="3"/>`; }
    else if(t.kind==='enz'){ cy=Y(226); r=Math.max(34,pillW(t.ion)/2+6); g=pill(x,Y(226),t.ion); }
    o+=site(t.k,x,cy,r,g,t.l)+T(x,Y(34),t.l,'t-lab-b')+(t.kind==='enz'?'':T(x,Y(54),t.ion,'t-small'));
  });
  const H=rows*RH+18;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(plain(b.title))}" style="min-width:${Math.min(W,620)}px">${defs(id)}${o}<g class="hl"></g></svg>`;
}

/* ---------- SVG: ГАМК-A ---------- */
function svgGaba(b,id){
  const S=b.sites, cx=230, cy=190, R=92; let o='';
  const P5=[['γ₂',-90,'g'],['α₁',-18,'a'],['β₂',54,''],['α₁',126,'a'],['β₂',198,'']];
  const pt=(a,rr)=>[cx+rr*Math.cos(a*Math.PI/180), cy+rr*Math.sin(a*Math.PI/180)];
  P5.forEach(([l,a,c])=>{ const [x,y]=pt(a,R); o+=`<circle class="s-sub ${c}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="50"/>`; const [lx,ly]=pt(a,R+24); o+=T(lx.toFixed(1),(ly+5).toFixed(1),l,'t-big'); });
  // ТМД β и нейростероиды
  [54,198].forEach(a=>{ const [x,y]=pt(a,R-16); o+=site('tm',+x.toFixed(1),+y.toFixed(1),22,`<circle class="s-tm" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="15"/>`+T(x.toFixed(1),(y+4).toFixed(1),'ТМ','t-small'),S.tm.l); });
  { const [x,y]=pt(-18,R-16); o+=site('ns',+x.toFixed(1),+y.toFixed(1),22,`<circle class="s-tm" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="15"/>`+T(x.toFixed(1),(y+4).toFixed(1),'НС','t-small'),S.ns.l); }
  // пора
  o+=site('pore',cx,cy,26,`<circle class="s-pocket" cx="${cx}" cy="${cy}" r="19"/>`+T(cx,cy+4.5,'Cl⁻','t-ion'),S.pore.l);
  // участки на границах
  const dia=(k,a,lab,anchor)=>{ const [x,y]=pt(a,R+18); const [lx,ly]=pt(a,R+66); return site(k,+x.toFixed(1),+y.toFixed(1),20,`<rect class="s-dia" x="${(x-8).toFixed(1)}" y="${(y-8).toFixed(1)}" width="16" height="16" transform="rotate(45 ${x.toFixed(1)} ${y.toFixed(1)})"/>`,lab)+T(lx.toFixed(1),(ly+4).toFixed(1),lab,'t-lab-b',anchor); };
  o+=dia('bzd',-54,S.bzd.l,'start')+dia('gaba',18,S.gaba.l,'start')+dia('gaba',162,S.gaba.l,'end');
  o+=T(cx,366,'вид со стороны синаптической щели','t-small');
  // записи одиночного канала
  o+=Z(480,60,'Ток одиночного канала');
  const rows=[[130,'Только ГАМК',[[492,502],[566,574],[640,650],[700,708]],null],[220,'+ бензодиазепин',[[486,495],[512,521],[540,549],[574,583],[606,615],[638,647],[668,677],[700,709],[724,733]],'trbzd'],[310,'+ барбитурат',[[494,540],[596,656],[700,734]],'trbarb']];
  rows.forEach(([y,l,op,k])=>{ let d=`M480,${y}`; op.forEach(([a,c])=>{ d+=` H${a} V${y-26} H${c} V${y}`; }); d+=` H744`; const g=T(480,y-38,l,'t-lab','start')+`<path class="s-trace" d="${d}"/>`; o+= k? site(k,612,y-20,40,g,S[k].l,[284,64]) : g; });
  o+=T(744,352,'вверх — канал открыт','t-small','end');
  return `<svg viewBox="0 0 760 380" role="img" aria-label="${esc(plain(b.title))}" style="min-width:600px">${defs(id)}${o}<g class="hl"></g></svg>`;
}

/* ---------- SVG: леводопа и ГЭБ ---------- */
function svgBBB(b,id){
  const S=b.sites, M=`url(#ah-${id})`; let o='';
  o+=`<rect class="s-zone" x="0" y="0" width="300" height="440"/><rect class="s-zone2" x="336" y="0" width="424" height="440"/><rect x="300" y="0" width="36" height="440" fill="url(#hatch-${id})"/>`;
  o+=Z(16,24,'Кровь · периферия')+Z(352,24,'Мозг · стриатум')+`<text class="t-zone" transform="translate(323 240) rotate(-90)" text-anchor="middle">ГЭБ</text>`;
  const node=(k,x,y,cls)=>site(k,x,y,Math.max(30,(Math.max(70,plain(S[k].l).length*7.6+24))/2+6),box(x,y,S[k].l,'s-node'+(cls?' '+cls:'')),S[k].l);
  const arr=(d,end='arrow')=>`<path class="s-arr" d="${d}"${end==='arrow'?` marker-end="${M}"`:''}/>`;
  const enz=(k,x,y)=>site(k,x,y,Math.max(28,pillW(S[k].l)/2+6),pill(x,y,S[k].l),S[k].l);
  // стрелки
  o+=arr('M140,86 L92,183')+arr('M160,86 L214,183')+arr('M200,70 L388,70')+arr('M440,86 V173')+arr('M486,190 H604')+arr('M428,206 L400,302')+arr('M452,206 L518,302')+arr('M400,336 L446,388')+arr('M520,336 L474,388');
  o+=`<path class="s-arr" d="M650,206 V281"/><path class="s-tbar" d="M637,284 H663"/>`+T(660,250,'D₂ тормозит','t-small','start');
  // узлы
  o+=T(150,42,'приём внутрь','t-small')+node('ldP',150,70)+node('daP',80,200)+node('omd',228,200);
  o+=T(80,233,'не проходит ГЭБ:','t-small')+T(80,248,'тошнота, ↓ АД','t-small')+T(228,233,'конкурирует','t-small')+T(228,248,'за LAT1','t-small');
  o+=node('ldB',440,70)+node('daB',440,190)+node('rec',650,190)+node('dopac',390,320)+node('mt',530,320)+node('hva',460,404)+node('ach',650,300)+node('glu',650,404);
  // ферменты на стрелках
  o+=enz('aDdcP',112,136)+enz('aComtP',190,136)+enz('aLat',318,70)+enz('aDdcB',440,132)+enz('aMaob',412,256)+enz('aComtB',488,256);
  return `<svg viewBox="0 0 760 440" role="img" aria-label="${esc(plain(b.title))}" style="min-width:600px">${defs(id)}${o}<g class="hl"></g></svg>`;
}

/* ---------- подсветка ---------- */
function highlight(fig, sites, act, badge=true){
  const svg=$('svg',fig), layer=$('.hl',svg); layer.innerHTML='';
  $$('.site.on',svg).forEach(e=>e.classList.remove('on'));
  const sym={stim:'+',block:'⊣',mod:'~'}[act];
  sites.forEach(s=>$$(`.site[data-site="${s}"]`,svg).forEach(el=>{
    el.classList.add('on'); const d=el.dataset, x=+d.cx, y=+d.cy; let bx,by;
    if(d.w){ const w=+d.w,h=+d.h; layer.insertAdjacentHTML('beforeend',`<rect class="ring ${act}" x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="10"/>`); bx=x+w/2-14; by=y-h/2; }
    else { const r=+d.r; layer.insertAdjacentHTML('beforeend',`<circle class="ring ${act}" cx="${x}" cy="${y}" r="${r}"/>`); bx=x+r*.72; by=y-r*.72; }
    if(badge) layer.insertAdjacentHTML('beforeend',`<circle class="badge-c ${act}" cx="${bx}" cy="${by}" r="10"/><text class="badge-t" x="${bx}" y="${by+4.2}" text-anchor="middle">${sym}</text>`);
  }));
}
function siteLabel(b,k){ const s=(b.sites||{})[k] || (b.targets||[]).find(t=>t.k===k); return s?plain(s.l):k; }
function siteInfo(b,k){ const s=(b.sites||{})[k] || (b.targets||[]).find(t=>t.k===k); return s; }
function activateChip(fig,b,i){
  const c=b.chips[i]; const sites=[].concat(c.s);
  $$('.chip',fig).forEach(x=>x.setAttribute('aria-pressed', x.dataset.i==String(i)?'true':'false'));
  highlight(fig,sites,c.a);
  const where=[...new Set(sites.map(s=>siteLabel(b,s)))].join(', ');
  $('.info',fig).innerHTML=`<h4>${c.d} <span class="act ${c.a}">${ACT[c.a]}</span></h4><p>${c.x}</p><p style="margin-top:6px;font-size:13px;color:var(--ink-3)">Точка действия на схеме: ${where}</p>`+(findDrug(c.d)?`<div class="also"><button type="button" class="btn" data-dr="${esc(findDrug(c.d).n)}">Досье: системы, показания, побочные эффекты →</button></div>`:'');
}
function activateSite(fig,b,k){
  const s=siteInfo(b,k); if(!s) return;
  $$('.chip',fig).forEach(x=>x.setAttribute('aria-pressed','false'));
  highlight(fig,[k],'stim',false);
  const users=b.chips.map((c,i)=>[c,i]).filter(([c])=>[].concat(c.s).includes(k));
  $('.info',fig).innerHTML=`<h4>${s.l}</h4><p>${s.f||''}</p>`+(users.length?`<div class="also">${users.map(([c,i])=>`<button type="button" class="chip ${c.a}" data-go="${i}">${c.d}</button>`).join('')}</div>`:'');
}

/* ---------- блоки ---------- */
let figs = {};
function head(no,label,title){ return `<div class="fig-head"><span class="blk-no">${label} ${no}</span><h3 class="blk">${title}</h3></div>`; }

function figBlock(b,p,no){
  const id=`${p.id}-${no.replace('.','-')}`;
  const svg = b.kind==='synapse'?svgSynapse(b,id): b.kind==='membrane'?svgMembrane(b,id): b.kind==='gaba'?svgGaba(b,id): svgBBB(b,id);
  figs[id]={type:'chips',b};
  return `<figure class="fig" id="${id}">${head(no,'Рис.',b.title)}<div class="fig-scroll">${svg}</div>${b.cap?`<p class="fig-cap">${b.cap}</p>`:''}
    <div class="chips"><span class="lab">Препараты</span>${b.chips.map((c,i)=>`<button class="chip ${c.a}" type="button" data-i="${i}" data-k="${first(c.d)}" aria-pressed="false">${c.d}</button>`).join('')}</div>
    <div class="info" aria-live="polite"><p class="hint">Нажмите на препарат — на схеме появится точка его действия, а ниже — ссылка на полное досье. Нажмите на элемент схемы — увидите, что это и какие препараты на него действуют.</p></div></figure>`;
}

function renderSteps(steps){
  return steps.map(s=>{
    if(s.split) return `<div class="rx-split" style="--cols:${s.split.length}">${s.split.map((br,i)=>`<div class="rx-branch">${s.labels?`<div class="rx-blab">${s.labels[i]}</div>`:''}<div class="rx-chain">${renderSteps(br)}</div></div>`).join('')}</div>`;
    if(s.n!==undefined) return `<div class="rx-node ${s.tag?'is-'+s.tag:''}"><span class="rx-n">${s.n}</span>${s.s?`<span class="rx-s">${s.s}</span>`:''}${s.prod?`<dl class="rx-prod">${s.prod.map(([a,d])=>`<dt>${a}</dt><dd>${d}</dd>`).join('')}</dl>`:''}</div>`;
    const mods=(s.inh||[]).map(d=>`<span class="tag inh">⊣ ${d}</span>`).join('')+(s.act||[]).map(d=>`<span class="tag ac">+ ${d}</span>`).join('');
    return `<div class="rx-arr"><div class="rx-line"></div><div class="rx-txt">${s.e?`<span class="rx-e">${s.e}</span>`:''}${s.c?` <span class="rx-c">${s.c}</span>`:''}${s.note?`<div class="rx-note">${s.note}</div>`:''}${mods?`<div>${mods}</div>`:''}</div></div>`;
  }).join('');
}
function pathBlock(b,p,no){ return `<section class="rx"><div class="rx-head"><span class="blk-no">Схема ${no}</span><h3 class="blk">${b.title}</h3></div><div class="rx-chain">${renderSteps(b.steps)}</div>${b.foot?`<p class="rx-foot">${b.foot}</p>`:''}</section>`; }

function tableBlock(b){ return `<section class="tblw">${b.title?`<div class="rx-head"><h3 class="blk">${b.title}</h3></div>`:''}<div class="tbl"><table><thead><tr>${b.head.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${b.rows.map(r=>`<tr${b.idx?` data-k="${first(r[0])}"`:''}>${r.map((c,ci)=>{ const dr=(b.idx&&ci===0)?(uFind(uClean(String(c).split('<br>')[0]))||(KMODE?null:findDrug(c))):null; return `<td>${dr?`<button type="button" class="tlink" data-dr="${esc(dr.n)}">${c}</button>`:c}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>${b.note?`<p class="tnote">${b.note}</p>`:''}</section>`; }

function groupsBlock(b,p,chipKeys){
  const L={m:'Механизм',e:'Эффекты',u:'Применение',ae:'Нежелательные эффекты',x:'Важно'};
  return `<div class="groups">${b.items.map(g=>`<article class="g" data-g="${esc(key(g.name))}"><h4>${g.name}</h4><div class="drugs">${g.drugs.map(d=>{ const k=first(d), dr=findDrug(d); return dr?`<button type="button" class="dtag" data-k="${k}" data-dr="${esc(dr.n)}" title="Открыть досье">${d}</button>`:`<span class="dtag" data-k="${k}">${d}</span>`; }).join('')}</div><dl>${['m','e','u','ae','x'].filter(f=>g[f]).map(f=>`<div><dt>${L[f]}</dt><dd${f==='x'?' class="x"':''}>${g[f]}</dd></div>`).join('')}</dl></article>`).join('')}</div>`;
}
const fxBlock=b=>`<div class="fx">${b.items.map(x=>`<div><code>${x.f}</code><p>${x.d}</p></div>`).join('')}</div>`;
function dixBlock(list){ if(!list.length) return ''; return `<section class="dix"><h2 class="sec">Досье препаратов листа</h2><p class="par">${list.length} препаратов. Нажмите на название — откроется механизм по шагам, влияние на системы, показания и побочные эффекты.</p><div class="drugs">${list.map(d=>`<button type="button" class="dtag" data-dr="${esc(d.n)}">${d.n}</button>`).join('')}</div></section>`; }
const keysBlock=b=>`<section class="keys"><h3 class="blk">Запомнить</h3><ul>${b.items.map(x=>`<li>${x}</li>`).join('')}</ul></section>`;
const quizBlock=b=>`<section class="quiz"><h2 class="sec" style="margin-top:0">Самопроверка</h2>${b.items.map(x=>`<details><summary><span>${x.q}</span></summary><p class="a">${x.a}</p></details>`).join('')}</section>`;

function chainsBlock(b,p,no){ return `<section class="fig">${head(no,'Рис.',b.title)}<div class="chains">${b.rows.map(r=>`<div class="chain"><b>${r.n}</b><div class="links">${r.segs.map((s,i)=>i%2?`<span class="med">${s}</span>`:`<span class="lk">${s}</span>`).join('')}</div></div>`).join('')}</div></section>`; }

/* ---------- виджет: вегетативная карта ---------- */
function ansBlock(b,p,no){
  const id=`${p.id}-${no.replace('.','-')}`; figs[id]={type:'ans',b};
  const rl=k=>b.rlab[k]||k;
  return `<section class="fig" id="${id}">${head(no,'Рис.',b.title)}
  <div class="rbtns" role="group" aria-label="Препарат">${b.drugs.map((d,i)=>`<button type="button" class="rbtn" data-i="${i}" aria-pressed="false" style="font-family:var(--f-body)">${d.d}</button>`).join('')}</div>
  <p class="fig-cap" style="padding-top:8px">${b.cap}</p>
  <div class="info" aria-live="polite"></div>
  <div class="tbl ans"><table><thead><tr><th scope="col">Орган, структура</th><th scope="col">Рецептор → физиологический эффект</th><th scope="col" class="dh">Эффект препарата</th></tr></thead><tbody>
  ${b.rows.map((r,i)=>`<tr data-i="${i}"><td>${r.o}</td><td>${r.r.map(([k,e])=>`<span class="ue"><span class="rk">${rl(k)}</span>${e}</span>`).join('')}</td><td class="eff"></td></tr>`).join('')}
  </tbody></table></div></section>`;
}
function ansSelect(fig,b,i){
  const d=b.drugs[i], rl=k=>b.rlab[k]||k;
  $$('.rbtn',fig).forEach(x=>x.setAttribute('aria-pressed',x.dataset.i==String(i)?'true':'false'));
  $('.dh',fig).textContent='Эффект: '+d.d;
  $('.info',fig).innerHTML=`<h4>${d.d}</h4><p>${d.gang?'Ганглиоблокатор':[(d.ag||[]).length?'Агонист: '+(d.ag||[]).map(rl).join(', '):'',(d.ant||[]).length?'Антагонист: '+(d.ant||[]).map(rl).join(', '):''].filter(Boolean).join(' · ')}. ${d.note}</p>`;
  $$('tbody tr',fig).forEach(tr=>{
    const r=b.rows[+tr.dataset.i]; let out=[];
    if(d.gang){ if(r.tone){ const x=r.r.find(z=>z[0]===r.tone); if(x) out.push({k:x[0],t:x[2],bl:true}); } }
    else r.r.forEach(([k,e,a])=>{ if((d.ag||[]).includes(k)) out.push({k,t:e}); if((d.ant||[]).includes(k)) out.push({k,t:a,bl:true}); });
    const td=$('.eff',tr);
    if(!out.length){ td.textContent='—'; td.className='eff none'; tr.classList.add('off'); return; }
    tr.classList.remove('off'); td.className='eff';
    td.innerHTML=out.map(o=>`<span class="ue${o.bl?' bl':''}"><span class="rk">${o.bl?'⊣ ':''}${rl(o.k)}</span>${o.t==='—'?'в покое заметного эффекта нет':o.t}</span>`).join('');
  });
}

/* ---------- виджет: каскады ---------- */
function cascadeBlock(b,p,no){
  const id=`${p.id}-${no.replace('.','-')}`; figs[id]={type:'casc',b};
  const C=b.cols;
  return `<section class="fig" id="${id}">${head(no,'Рис.',b.title)}
  <div class="rbtns" role="group" aria-label="Рецептор">${b.recs.map((r,i)=>`<button type="button" class="rbtn" data-i="${i}" aria-pressed="false">${r.r}</button>`).join('')}</div>
  <div class="casc sel">${['s','i','q','ion'].map(k=>`<div class="col" data-g="${k}"><h5>${C[k].h}</h5><ol>${C[k].steps.map(s=>`<li>${s}</li>`).join('')}</ol>${C[k].foot?`<p class="foot">${C[k].foot}</p>`:''}</div>`).join('')}</div>
  <div class="info" aria-live="polite"></div></section>`;
}
function cascSelect(fig,b,i){
  const r=b.recs[i];
  $$('.rbtn',fig).forEach(x=>x.setAttribute('aria-pressed',x.dataset.i==String(i)?'true':'false'));
  $$('.col',fig).forEach(c=>c.classList.toggle('on',c.dataset.g===r.g));
  $('.info',fig).innerHTML=`<h4>${r.r} <span class="act stim">${b.cols[r.g].h}</span></h4><p><b style="color:var(--ink)">Где:</b> ${r.w}.<br><b style="color:var(--ink)">Эффект:</b> ${r.e}.</p>`;
}

/* ---------- виджет: фармакокинетика ---------- */
function pkBlock(b,p,no){
  const id=`${p.id}-${no.replace('.','-')}`; figs[id]={type:'pk',b};
  return `<section class="fig" id="${id}">${head(no,'Рис.',b.title)}
  <div class="fig-scroll"><svg viewBox="0 0 760 330" role="img" aria-label="Кривая концентрации при повторном введении" style="min-width:560px"><g class="plot"></g></svg></div>
  <div class="ctrl">
    <label for="${id}-th">Период полувыведения T½ <b class="o-th"></b><input id="${id}-th" type="range" min="1" max="24" step="1" value="6" data-v="th"></label>
    <label for="${id}-tau">Интервал введения τ <b class="o-tau"></b><input id="${id}-tau" type="range" min="2" max="24" step="1" value="8" data-v="tau"></label>
    <label for="${id}-f">Биодоступность F (внутрь) <b class="o-f"></b><input id="${id}-f" type="range" min="0.2" max="1" step="0.05" value="0.8" data-v="F"></label>
    <div style="display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--ink-2)">Путь и схема<div class="seg"><button type="button" data-route="iv" aria-pressed="true">в/в болюс</button><button type="button" data-route="po" aria-pressed="false">внутрь</button><button type="button" data-load="1" aria-pressed="false">нагрузочная доза</button></div></div>
  </div>
  <div class="ro"></div>
  <p class="fig-cap" style="padding-top:12px">Однокамерная модель, кинетика первого порядка. Концентрация выражена в долях C₀ = D / Vd после одной в/в дозы. Константа всасывания при приёме внутрь принята 1,2 ч⁻¹.</p></section>`;
}
function pkDraw(fig){
  const st=fig._pk; const {th,tau,F,route,load}=st;
  const k=Math.LN2/th, ka=1.2, R=1/(1-Math.exp(-k*tau));
  const Tmax=Math.min(144,Math.max(48,Math.ceil(Math.max(6*th,5*tau)/tau)*tau));
  const f = route==='iv' ? (dt=>dt<0?0:Math.exp(-k*dt)) : (dt=>dt<0?0:F*ka/(ka-k)*(Math.exp(-k*dt)-Math.exp(-ka*dt)));
  const doses=[]; for(let t=0;t<=Tmax+1e-9;t+=tau) doses.push(t);
  const C=t=>doses.reduce((s,tn,j)=>s+(j===0&&load?R:1)*f(t-tn),0);
  // равновесие
  let cmax, cmin; if(route==='iv'){ cmax=R; cmin=R*Math.exp(-k*tau); } else { cmax=0; cmin=1e9; for(let j=0;j<=200;j++){ const t=tau*j/200; const v=F*ka/(ka-k)*(Math.exp(-k*t)/(1-Math.exp(-k*tau))-Math.exp(-ka*t)/(1-Math.exp(-ka*tau))); cmax=Math.max(cmax,v); cmin=Math.min(cmin,v); } }
  const cavg=(route==='iv'?1:F)/(k*tau);
  const N=420, pts=[]; let ymaxData=0; for(let j=0;j<=N;j++){ const t=Tmax*j/N; const v=C(t); pts.push([t,v]); ymaxData=Math.max(ymaxData,v); }
  const yTop=Math.max(ymaxData,cmax)*1.12;
  const yStep=[0.25,0.5,1,2,5,10].find(s=>yTop/s<=6)||10; const yMax=Math.ceil(yTop/yStep)*yStep;
  const x0=58,x1=740,y0=286,y1=18; const X=t=>x0+(x1-x0)*t/Tmax, Y=v=>y0-(y0-y1)*v/yMax;
  const xStep=[6,12,24].find(s=>Tmax/s<=10)||24;
  let g='';
  for(let v=0;v<=yMax+1e-9;v+=yStep){ g+=`<path d="M${x0},${Y(v).toFixed(1)} H${x1}" style="stroke:var(--rule-2);stroke-width:1"/><text class="t-small" x="${x0-8}" y="${(Y(v)+4).toFixed(1)}" text-anchor="end">${fmt(v,yStep<1?2:0)}</text>`; }
  for(let t=0;t<=Tmax+1e-9;t+=xStep){ g+=`<text class="t-small" x="${X(t).toFixed(1)}" y="${y0+18}" text-anchor="middle">${t}</text>`; }
  g+=`<text class="t-small" x="${x1}" y="${y0+18+14}" text-anchor="end">время, ч</text><text class="t-small" x="${x0}" y="${y1-4}" text-anchor="start">C / C₀</text>`;
  g+=`<rect x="${x0}" y="${Y(cmax).toFixed(1)}" width="${x1-x0}" height="${(Y(cmin)-Y(cmax)).toFixed(1)}" style="fill:var(--hema-soft);opacity:.75"/>`;
  g+=`<path d="M${x0},${Y(cavg).toFixed(1)} H${x1}" style="stroke:var(--hema);stroke-width:1.2;stroke-dasharray:5 4"/><text class="t-small" x="${x0+8}" y="${(Y(cmax)-6).toFixed(1)}" text-anchor="start">коридор C<tspan baseline-shift="sub" font-size="8">ss</tspan></text>`;
  const t5=5*th; if(t5<=Tmax){ g+=`<path d="M${X(t5).toFixed(1)},${y1+10} V${y0}" style="stroke:var(--eosin);stroke-width:1.2;stroke-dasharray:3 3"/><text class="t-small" x="${(X(t5)+6).toFixed(1)}" y="${y1+22}" style="fill:var(--eosin)">5·T½ ≈ 97% C<tspan baseline-shift="sub" font-size="8">ss</tspan></text>`; }
  doses.forEach((t,j)=>{ if(t<=Tmax) g+=`<path d="M${X(t).toFixed(1)},${y0+2} l-4,7 h8 z" style="fill:${j===0&&load?'var(--eosin)':'var(--ink-3)'}"/>`; });
  g+=`<path d="M${x0},${y0} H${x1} M${x0},${y0} V${y1}" style="stroke:var(--ink-3);stroke-width:1.2;fill:none"/>`;
  g+=`<path d="${pts.map(([t,v],j)=>(j?'L':'M')+X(t).toFixed(1)+','+Y(v).toFixed(1)).join(' ')}" style="fill:none;stroke:var(--ink);stroke-width:2.2;stroke-linejoin:round"/>`;
  $('.plot',fig).innerHTML=g;
  $('.o-th',fig).textContent=th+' ч'; $('.o-tau',fig).textContent=tau+' ч'; $('.o-f',fig).textContent=fmt(F,2);
  $('.ro',fig).innerHTML=[
    ['k<sub>el</sub> = 0,693 / T½',fmt(k,3)+' ч⁻¹'],
    ['Коэффициент накопления R',fmt(R,2)],
    ['C<sub>ss</sub> средняя',fmt(cavg,2)+' C₀'],
    ['C<sub>ss</sub> max / min',fmt(cmax,2)+' / '+fmt(cmin,2)],
    ['Время до C<sub>ss</sub> (4–5 T½)',(4*th)+'–'+(5*th)+' ч'],
    ['Нагрузочная доза','R × D = '+fmt(R,2)+' D']
  ].map(([a,v])=>`<div><small>${a}</small><b>${v}</b></div>`).join('');
}

/* ---------- виджет: местные анестетики ---------- */
function laBlock(b,p,no){
  const id=`${p.id}-${no.replace('.','-')}`; figs[id]={type:'la',b}; const M=`url(#ah-${id})`;
  const svg=`<svg viewBox="0 0 760 320" role="img" aria-label="Механизм местного анестетика" style="min-width:600px">${defs(id)}
    <rect class="s-bil" x="30" y="140" width="700" height="40"/><path class="s-bil-l" d="M30,140 H730 M30,180 H730"/>
    <text class="t-zone la-ph" x="40" y="26">ВНЕКЛЕТОЧНО · pH 7,4</text><text class="t-zone" x="40" y="308">АКСОПЛАЗМА · pH 7,1</text>
    <rect class="s-prot" x="488" y="118" width="26" height="84" rx="7"/><rect class="s-prot" x="526" y="118" width="26" height="84" rx="7"/>
    <path class="s-arr" d="M520,52 V112" marker-end="${M}"/><path class="s-tbar" d="M506,124 H534"/>${T(540,62,'Na⁺','t-ion','start')}
    ${T(520,40,'вход Na⁺ заблокирован','t-small')}
    ${pill(520,186,'BH⁺','s-enz')}
    <text class="t-big" x="60" y="80">BH⁺ ⇌ B + H⁺</text>
    ${T(60,102,'долю форм задают pKa и pH','t-small','start')}
    <path class="s-arr" d="M76,110 V132"/><path class="s-tbar" d="M62,136 H90"/>${T(98,128,'BH⁺ не проходит','t-small','start')}
    ${T(236,104,'B','t-lab-b')}<path class="s-arr" d="M236,110 V214" marker-end="${M}" style="stroke-dasharray:5 4"/>
    ${T(248,164,'B проходит через липидный слой','t-small','start')}
    <text class="t-big" x="60" y="250">B + H⁺ ⇌ BH⁺</text>
    <path class="s-arr" d="M196,244 C300,244 420,214 484,196" marker-end="${M}"/>
    ${T(300,282,'BH⁺ связывается с участком в поре изнутри,','t-small','start')}${T(300,297,'сильнее — с открытым и инактивированным каналом','t-small','start')}
    <g class="hl"></g></svg>`;
  return `<section class="fig" id="${id}">${head(no,'Рис.',b.title)}<div class="fig-scroll">${svg}</div>
  <div class="ctrl"><div style="display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--ink-2);flex:2 1 320px">Анестетик<div class="seg">${b.drugs.map((d,i)=>`<button type="button" data-i="${i}" aria-pressed="${i===4?'true':'false'}">${d.d} · ${fmt(d.pka,1)}</button>`).join('')}</div></div>
  <label for="${id}-ph">pH тканей <b class="o-ph"></b><input id="${id}-ph" type="range" min="5.8" max="7.8" step="0.1" value="7.4"></label></div>
  <div class="bars"></div><p class="verdict"></p>${b.cap?`<p class="fig-cap">${b.cap}</p>`:''}</section>`;
}
function laDraw(fig){
  const st=fig._la, d=fig._b.drugs[st.i], ph=st.ph;
  const fb=1/(1+Math.pow(10,d.pka-ph)), fin=1/(1+Math.pow(10,7.1-d.pka));
  $('.o-ph',fig).textContent=fmt(ph,1); $('.la-ph',fig).textContent='ВНЕКЛЕТОЧНО · pH '+fmt(ph,1);
  const bar=(lab,un,io)=>`<div class="bar-row"><span>${lab}</span><div class="bar"><span class="b-un" style="flex-basis:${(un*100).toFixed(1)}%">${un>=.08?'B '+Math.round(un*100)+'%':''}</span><span class="b-io" style="flex-basis:${(io*100).toFixed(1)}%">${io>=.08?'BH⁺ '+Math.round(io*100)+'%':''}</span></div></div>`;
  $('.bars',fig).innerHTML=bar('Снаружи, pH '+fmt(ph,1),fb,1-fb)+bar('В аксоплазме, pH 7,1',1-fin,fin);
  const pct=fb*100; let v;
  if(pct>=20) v='Большая доля основания B быстро проходит мембрану — анестезия наступает быстро.';
  else if(pct>=5) v='Через мембрану проходит умеренная доля молекул — начало действия замедлено.';
  else v='Почти весь анестетик ионизирован снаружи и не проникает в волокно: медленное начало и слабый эффект, как в воспалённых тканях.';
  $('.verdict',fig).innerHTML=`<b style="color:var(--ink)">${d.d}, pKa ${fmt(d.pka,1)}: неионизированной формы снаружи ${pct<1?fmt(pct,1):Math.round(pct)}%.</b> ${v}`;
}

/* ---------- виджет: дофаминовые пути ---------- */
function daBlock(b,p,no){
  const id=`${p.id}-${no.replace('.','-')}`; figs[id]={type:'da',b}; const M=`url(#ahu-${id})`;
  const svg=`<svg viewBox="0 0 760 420" role="img" aria-label="Дофаминергические пути мозга" style="min-width:600px">${defs(id)}
    <ellipse class="s-brain" cx="620" cy="330" rx="64" ry="36"/>
    <path class="s-brain" d="M150,300 C95,250 100,140 180,90 C260,40 400,30 500,50 C600,70 680,130 690,210 C696,262 668,292 625,300 C600,305 585,312 570,318 L560,345 C556,360 548,380 540,410 L500,410 C505,380 508,350 505,330 C470,318 440,318 410,320 C360,322 330,330 300,335 C240,345 190,335 150,300 Z"/>
    <ellipse class="s-reg" cx="350" cy="356" rx="16" ry="11"/>${T(328,360,'Гипофиз','t-small','end')}
    <ellipse class="s-reg" cx="210" cy="152" rx="56" ry="34"/>${T(210,150,'Префронтальная','t-small')}${T(210,164,'кора','t-small')}
    <ellipse class="s-reg" cx="372" cy="152" rx="54" ry="30"/>${T(372,156,'Стриатум','t-small')}
    <ellipse class="s-reg" cx="300" cy="234" rx="44" ry="22"/>${T(300,231,'Прилежащее','t-small')}${T(300,244,'ядро','t-small')}
    <ellipse class="s-reg" cx="362" cy="296" rx="26" ry="14"/>${T(330,300,'Гипоталамус','t-small','end')}
    <ellipse class="s-reg" cx="508" cy="228" rx="30" ry="14"/>${T(542,232,'Чёрная субстанция','t-small','start')}
    <ellipse class="s-reg" cx="484" cy="272" rx="26" ry="13"/>${T(514,276,'ВОП','t-small','start')}
    <g class="dps">
      <path class="dp-path" data-p="nigro" d="M500,218 C470,184 438,168 412,162" marker-end="${M}"/>
      <path class="dp-path" data-p="meso" d="M462,274 C426,282 372,266 340,244" marker-end="${M}"/>
      <path class="dp-path" data-p="cort" d="M478,260 C470,110 300,40 252,124" marker-end="${M}"/>
      <path class="dp-path" data-p="tubero" d="M362,310 C361,322 356,330 352,342" marker-end="${M}"/>
    </g></svg>`;
  return `<section class="fig" id="${id}">${head(no,'Рис.',b.title)}<div class="fig-scroll">${svg}</div>
  <div class="rbtns" role="group" aria-label="Путь">${b.paths.map((x,i)=>`<button type="button" class="rbtn" data-i="${i}" aria-pressed="false" style="font-family:var(--f-body)">${x.n}</button>`).join('')}</div>
  ${b.cap?`<p class="fig-cap" style="padding-top:8px">${b.cap}</p>`:''}<div class="info" aria-live="polite"></div></section>`;
}
function daSelect(fig,b,i){
  const x=b.paths[i];
  $$('.rbtn',fig).forEach(e=>e.setAttribute('aria-pressed',e.dataset.i==String(i)?'true':'false'));
  $('.dps',fig).classList.add('dp-dim');
  $$('.dp-path',fig).forEach(e=>{ const on=e.dataset.p===x.k; e.classList.toggle('on',on); e.setAttribute('marker-end',`url(#${on?'ahh':'ahu'}-${fig.id})`); });
  $('.info',fig).innerHTML=`<h4>${x.n} путь</h4><p><b style="color:var(--ink)">Откуда → куда:</b> ${x.fr} → ${x.to}.<br><b style="color:var(--ink)">Функция:</b> ${x.fn}.<br><b style="color:var(--ink)">При шизофрении:</b> ${x.sz}.<br><b style="color:var(--eosin)">Блокада D₂:</b> ${x.bl}.</p>`;
}

/* ---------- конспект: дерево классификации ---------- */
let KCUR = [], KMODE = false;
const kCurCard = nm=>KCUR.find(names=>names.some(x=>kSame(nm,x)));
function kdrug(x, tag){
  const [nm,hl]=String(x).split('|');
  const live = uFind(nm)||kCurCard(nm)||kFindDrug(nm);
  const cls='kd'+(hl?' hl-'+hl:'');
  return live?`<button type="button" class="${cls}" data-kd="${esc(nm)}">${nm}</button>`:`<span class="${cls} kd-0" data-kn="${esc(nm)}">${nm}</span>`;
}
function treeNode(nd){
  const ll = nd.l&&nd.l.length ? `<ul class="tdl tl">${nd.l.map(x=>`<li>${x}</li>`).join('')}</ul>` : '';
  const dl = nd.d&&nd.d.length ? `<${nd.u?'ul':'ol'} class="tdl">${nd.d.map(x=>`<li>${kdrug(x)}</li>`).join('')}</${nd.u?'ul':'ol'}>` : '';
  const kids = nd.k&&nd.k.length ? `<ul class="tu">${nd.k.map(c=>`<li class="ti">${treeNode(c)}</li>`).join('')}</ul>` : '';
  return `<div class="tn${nd.c?' tc-'+nd.c:''}${nd.n?'':' tn-0'}">${nd.n?`<b>${nd.n}</b>`:''}${nd.s?`<small>${nd.s}</small>`:''}${ll}${dl}</div>${kids}`;
}
function fitTrees(){ $$('.tree').forEach(t=>{ t.classList.remove('tv'); const sc=t.parentElement; if(sc && t.scrollWidth > sc.clientWidth - 24) t.classList.add('tv'); }); }
let fitT=0; window.addEventListener('resize',()=>{ clearTimeout(fitT); fitT=setTimeout(fitTrees,150); });
function treeBlock(b,p,no){
  const marks=new Set(); walkTree(b,nd=>(nd.d||[]).forEach(x=>{ const h=String(x).split('|')[1]; if(h) marks.add(h); }));
  const LG = b.leg || (typeof KLEG!=='undefined'?KLEG:null);
  const leg = marks.size?`<p class="fig-cap tleg">${[...marks].map(m=>`<span class="kd hl-${m}">${({y:'жёлтым',g:'зелёным',b:'голубым',p:'розовым'})[m]||m}</span>${LG&&LG[m]?' — '+LG[m]:''}`).join(LG?'; ':' ')}${LG?'':' — выделено в конспекте'}</p>`:'';
  return `<section class="fig ktree" id="${p.id}-${no.replace('.','-')}">${head(no,'Схема',b.title)}<div class="tree-scroll"><ul class="tree"><li class="ti">${treeNode({n:b.n||b.title,s:b.s,d:b.d,k:b.k,c:b.c||'root',u:b.u})}</li></ul></div>${leg}${b.cap?`<p class="fig-cap">${b.cap}</p>`:''}</section>`;
}

/* ---------- конспект: блок-схема ---------- */
const GF = {b:'gt', d:'gt-d', h:'gt-h', s:'gt-s', z:'t-zone', l:'gl'};
let _ms=null, _mt=null; const _mcache=new Map();
function tw(t,cls){ const k=cls+'|'+t; if(_mcache.has(k)) return _mcache.get(k);
  if(!_ms){ _ms=document.createElementNS('http://www.w3.org/2000/svg','svg'); _ms.setAttribute('aria-hidden','true'); _ms.style.cssText='position:absolute;left:-9999px;top:0;width:10px;height:10px;visibility:hidden'; _mt=document.createElementNS('http://www.w3.org/2000/svg','text'); _ms.appendChild(_mt); document.body.appendChild(_ms); }
  _mt.setAttribute('class',cls); _mt.textContent=t; const v=_mt.getComputedTextLength()||t.length*7.4; _mcache.set(k,v); return v; }
function wrapW(t,maxw,f){ const out=[]; String(t).split('\n').forEach(par=>{ let line=''; par.split(' ').forEach(w=>{ if(!line) line=w; else if(tw(line+' '+w,f)<=maxw) line+=' '+w; else { out.push(line); line=w; } }); out.push(line); }); return out; }
function gnode(nd){
  const [id,x,y,t,k='',w0]=nd; const txt=plain(t);
  const small = k==='t'||k==='z';
  const f = k==='d'?GF.d:(k==='h'?GF.h:(k==='t'?GF.s:(k==='z'?GF.z:GF.b)));
  const pad = small||k==='h' ? 6 : 18;
  const longest = Math.max(...txt.split('\n').map(l=>tw(k==='z'?l.toUpperCase():l,f)));
  const maxW = k==='h'?560:(small?300:230);
  const w = w0 || Math.min(maxW, Math.max(52, longest+pad));
  const lines = wrapW(k==='z'?txt.toUpperCase():txt, w-pad, f);
  const lh = small?14.5:(k==='h'?19:16.5);
  const h = lines.length*lh + (small||k==='h'?4:12);
  return {id,x,y,w,h,k,lines,lh,t:txt};
}
function clipR(g,tx,ty){ const dx=tx-g.x, dy=ty-g.y; if(!dx&&!dy) return [g.x,g.y]; const hw=g.w/2+3, hh=g.h/2+3; const s=Math.min(dx?hw/Math.abs(dx):1e9, dy?hh/Math.abs(dy):1e9); return [g.x+dx*s, g.y+dy*s]; }
function svgGraph(b,id){
  const N={}; b.nodes.forEach(nd=>{ const g=gnode(nd); N[g.id]=g; });
  const W=b.w||760; let H=0; Object.values(N).forEach(g=>{ H=Math.max(H,g.y+g.h/2); }); (b.zones||[]).forEach(z=>{ H=Math.max(H,z[1]+z[3]); }); H=b.h||H+14;
  const M=`url(#ah-${id})`; let o='';
  (b.zones||[]).forEach(([x,y,w,h,lab,k,lp])=>{ o+=`<rect class="gz${k?' gz-'+k:''}" x="${x}" y="${y}" width="${w}" height="${h}" rx="14"/>`+(lab?`<text class="t-zone" x="${lp==='br'?x+w-12:x+12}" y="${lp&&lp[0]==='b'?y+h-10:y+18}"${lp==='br'?' text-anchor="end"':''}>${esc(plain(lab).toUpperCase())}</text>`:''); });
  const pt = r => Array.isArray(r) ? {x:r[0],y:r[1],w:0,h:0} : N[r];
  (b.edges||[]).forEach(e=>{
    const [a,c,ty='>',lab,via]=e; const A=pt(a), B=pt(c); if(!A||!B){ console.warn('edge',a,c); return; }
    const v=via||[]; const n0=v[0]||[B.x,B.y], n1=v.length?v[v.length-1]:[A.x,A.y];
    const p0= A.w?clipR(A,n0[0],n0[1]):[A.x,A.y], pn= B.w?clipR(B,n1[0],n1[1]):[B.x,B.y];
    const all=[p0,...v,pn]; const d='M'+all.map(q=>q[0].toFixed(1)+','+q[1].toFixed(1)).join(' L');
    let eo=''; const cls = ty==='|'?'ge-i':(ty==='~'||ty==='~|'?'ge-d':'ge');
    const mk = (ty==='>'||ty==='~'||ty==='<>')?` marker-end="${M}"`:'';
    const ms = ty==='<>'?` marker-start="${M}"`:'';
    eo+=`<path class="${cls}" d="${d}"${mk}${ms}/>`;
    if(ty==='|'||ty==='~|'){ const [qx,qy]=all[all.length-2], [ex,ey]=pn; const L=Math.hypot(ex-qx,ey-qy)||1; const ux=(ex-qx)/L, uy=(ey-qy)/L; eo+=`<path class="ge-t" d="M${(ex-uy*8).toFixed(1)},${(ey+ux*8).toFixed(1)} L${(ex+uy*8).toFixed(1)},${(ey-ux*8).toFixed(1)}"/>`; }
    if(lab){ const i=Math.floor((all.length-1)/2); const [x1,y1]=all[i],[x2,y2]=all[i+1]; const mx=(x1+x2)/2, my=(y1+y2)/2; const tw2=tw(plain(lab),GF.l)+10; const lc=/^[+↑]/.test(lab)?' gl-p':(/^[−\-↓⊣]/.test(lab)?' gl-n':'');
      eo+=`<rect class="gl-bg" x="${(mx-tw2/2).toFixed(1)}" y="${(my-9).toFixed(1)}" width="${tw2.toFixed(1)}" height="17" rx="4"/><text class="gl${lc}" x="${mx.toFixed(1)}" y="${(my+4).toFixed(1)}" text-anchor="middle">${esc(lab)}</text>`; }
    o+=`<g class="ge-w" data-a="${Array.isArray(a)?'':esc(String(a))}" data-b="${Array.isArray(c)?'':esc(String(c))}">${eo}</g>`;
  });
  Object.values(N).forEach(g=>{
    const x0=g.x-g.w/2, y0=g.y-g.h/2; const boxless = g.k==='h'||g.k==='t'||g.k==='z';
    const tcls = g.k==='h'?'gt-h':(g.k==='t'?'gt-s':(g.k==='z'?'t-zone':(g.k==='d'?'gt-d':'gt')));
    let box = boxless?'':`<rect class="gn gn-${g.k||'b'}" x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${g.w.toFixed(1)}" height="${g.h.toFixed(1)}" rx="${g.k==='e'?(g.h/2).toFixed(1):8}"/>`;
    const ty0 = g.y - (g.lines.length*g.lh)/2 + g.lh*0.74;
    const txt = g.lines.map((l,i)=>`<text class="${tcls}" x="${g.x.toFixed(1)}" y="${(ty0+i*g.lh).toFixed(1)}" text-anchor="middle">${esc(g.k==='z'?l.toUpperCase():l)}</text>`).join('');
    let no='';
    if(g.k==='d'){ const nm=g.t.replace(/\n/g,' '); const live=uFind(nm)||kCurCard(nm)||kFindDrug(nm); no= live?`<g class="gdrug" data-kd="${esc(nm)}" tabindex="0" role="button" aria-label="${esc(nm)}">${box}${txt}</g>`:box+txt; }
    else no=box+txt;
    o+=`<g class="gn-w gk-${g.k||'b'}" data-n="${esc(String(g.id))}">${no}</g>`;
  });
  return `<svg viewBox="0 0 ${W} ${Math.ceil(H)}" role="img" aria-label="${esc(plain(b.title))}" style="min-width:${Math.min(W,b.mw||620)}px">${defs(id)}${o}</svg>`;
}
function graphBlock(b,p,no){
  const id=`${p.id}-${no.replace('.','-')}`;
  return `<figure class="fig kgraph" id="${id}">${head(no,'Схема',b.title)}<div class="fig-scroll">${svgGraph(b,id)}</div>${b.cap?`<p class="fig-cap">${b.cap}</p>`:''}</figure>`;
}

/* ---------- конспект: карточки препаратов ---------- */
function cardsBlock(b,p){
  const L=[['f',''],['pok','Показания'],['pe','Побочные эффекты'],['pp','Противопоказания'],['fv','Форма выпуска']];
  return `${b.title?`<h2 class="sec">${b.title}</h2>`:''}<div class="kcards">${b.items.map(c=>{ const ks=kNames(c);
    return `<article class="kc${c.hl?' hl-'+c.hl:''}" data-kn="${esc(key(c.n))}" data-kall="${esc(ks.map(key).join('|'))}">
    <header><h4>${c.n}</h4>${c.al?`<p class="kc-al">${c.al.join(', ')}</p>`:''}${c.g?`<p class="kc-g">${c.g}</p>`:''}</header>
    ${c.f&&c.f.length?`<div class="kc-l kc-f"><ul>${c.f.map(x=>`<li>${x}</li>`).join('')}</ul></div>`:''}
    ${c.rp?`<pre class="kc-rp">${c.rp}</pre>`:''}
    ${c.kl?`<p class="kc-kl"><span>кл</span>${c.kl}</p>`:''}
    ${L.slice(1).map(([f,h])=>c[f]&&c[f].length?`<div class="kc-l kc-${f}"><h5>${h}</h5><ol>${c[f].map(x=>`<li>${x}</li>`).join('')}</ol></div>`:'').join('')}
    ${c.fm&&c.fm.length?`<div class="kc-fm"><h5>Возможные формулировки</h5><ol>${c.fm.map(x=>`<li>${x}</li>`).join('')}</ol></div>`:''}
    ${c.x?`<p class="kc-x">${c.x}</p>`:''}
    ${(()=>{ const e=uFind(c.n); return e?`<div class="kc-dose"><h5>Доза</h5>${uDoseHTML(e,{norp:true})}</div><p class="kc-dr"><button type="button" class="btn kc-open" data-dr="${esc(e.n)}">Вся карточка: доза, зачем, побочки →</button></p>`:''; })()}
    </article>`; }).join('')}</div>`;
}
const kCardEl = nm=>$$('.kc').find(c=>(c.dataset.kall||'').split('|').some(x=>kSame(nm,x)));
function kFind(nm){
  return kCardEl(nm) || $(`[data-kd="${CSS.escape(nm)}"]`) || $(`[data-kn="${CSS.escape(nm)}"]`) || $$('[data-kd],[data-kn]').find(e=>kSame(nm,e.dataset.kd||e.dataset.kn||'')) || null;
}
function kGo(t){ const nm=t.dataset.kd; const e=uFind(nm); if(e) openDossier(e.n,t); }
document.addEventListener('click',e=>{ const t=e.target.closest('[data-kd]'); if(t){ e.preventDefault(); kGo(t); } });
document.addEventListener('keydown',e=>{ const t=e.target.closest&&e.target.closest('g[data-kd]'); if(t&&(e.key==='Enter'||e.key===' ')){ e.preventDefault(); kGo(t); } });

/* ---------- страница листа ---------- */
function renderPlate(p){
  figs={};
  if(p.locked){ renderLockedPlate(p); return; }
  const chipKeys=new Set(); p.blocks.forEach(b=>(b.chips||[]).forEach(c=>chipKeys.add(first(c.d))));
  let n=0, hn=0; const no=()=>`${isK(p)?p.roman:p.num}.${++n}`;
  KMODE = isK(p); KCUR = []; if(KMODE) p.blocks.forEach(b=>{ if(b.t==='cards') b.items.forEach(c=>KCUR.push(kNames(c))); });
  const body=p.blocks.map(b=>{
    switch(b.t){
      case 'h': { hn++; return `<h2 class="sec" id="${p.id}-s${hn}">${b.text}</h2>`; }
      case 'p': return `<p class="par">${b.html}</p>`;
      case 'fig': return figBlock(b,p,no());
      case 'path': return pathBlock(b,p,no());
      case 'table': return tableBlock(b);
      case 'groups': return groupsBlock(b,p,chipKeys);
      case 'fx': return fxBlock(b);
      case 'keys': return (isK(p)?'':dixBlock(DLIST.filter(d=>d.p===p.id)))+keysBlock(b);
      case 'quiz': return quizBlock(b);
      case 'chains': return chainsBlock(b,p,no());
      case 'ans': return ansBlock(b,p,no());
      case 'cascade': return cascadeBlock(b,p,no());
      case 'pk': return pkBlock(b,p,no());
      case 'la': return laBlock(b,p,no());
      case 'dapath': return daBlock(b,p,no());
      case 'tree': return treeBlock(b,p,no());
      case 'graph': return graphBlock(b,p,no());
      case 'cards': return cardsBlock(b,p);
      case 'cols': { const nn=no(); return `<section class="fig kcolsw" id="${p.id}-${nn.replace('.','-')}">${head(nn,'Схема',b.title)}${b.n?`<div class="kroot"><span>${b.n}${b.s?`<small>${b.s}</small>`:''}</span></div>`:''}<div class="kcols"${b.min?` style="--cmin:${b.min}px"`:''}>${b.cols.map(c=>`<div class="kcol${c.c?' kc-'+c.c:''}"><h5>${c.h}</h5>${c.s?`<small>${c.s}</small>`:''}${c.d&&c.d.length?`<ol class="tdl">${c.d.map(x=>`<li>${kdrug(x)}</li>`).join('')}</ol>`:''}${c.items&&c.items.length?`<${c.u?'ul':'ol'}>${c.items.map(x=>`<li>${x}</li>`).join('')}</${c.u?'ul':'ol'}>`:''}</div>`).join('')}</div>${b.foot?`<div class="kfoot"><ul>${b.foot.map(x=>`<li>${x}</li>`).join('')}</ul></div>`:''}${b.cap?`<p class="fig-cap">${b.cap}</p>`:''}</section>`; }
      case 'warn': return `<aside class="kwarn"><b>${b.title||'Неточность в конспекте'}</b><p>${b.text}</p></aside>`;
      case 'list': return `<section class="klist">${b.title?`<h3 class="blk">${b.title}</h3>`:''}<${b.ord?'ol':'ul'}>${b.items.map(x=>`<li>${x}</li>`).join('')}</${b.ord?'ol':'ul'}></section>`;
      case 'src': return `<p class="ksrc">${b.text}</p>`;
      case 'flow': { const nn=no(); return `<section class="fig kflow" id="${p.id}-${nn.replace('.','-')}">${head(nn,'Схема',b.title)}<div class="kfl">${b.rows.map(r=>`<div class="kfr">${r.h?`<h5>${r.h}</h5>`:''}<div class="cf">${r.s.map((x,i)=>i===r.s.length-1?`<b>${x}</b>`:`<span>${x}</span><i aria-hidden="true">→</i>`).join('')}</div>${r.n?`<p class="kfn">${r.n}</p>`:''}</div>`).join('')}</div>${b.cap?`<p class="fig-cap">${b.cap}</p>`:''}</section>`; }
    } return '';
  }).join('');
  const i=P.indexOf(p), prev=P[i-1], next=P[i+1];
  const modT=MODULES.find(m=>m.id===p.mod).t;
  const relK = isK(p) ? (p.rel||[]).filter(r=>BY[r]).map(r=>`<a class="btn" href="#${r}">Подробный лист ${BY[r].roman}: ${BY[r].title} →</a>`).join('') : P.filter(x=>isK(x)&&(x.rel||[]).includes(p.id)).map(x=>`<a class="btn" href="#${x.id}">Схемы по конспекту ${x.roman} →</a>`).join('');
  const lrn = isK(p) && typeof lDeck==='function' ? `<a class="btn pri" href="#learn/${p.id}">Учить препараты лекции →</a>` : '';
  const kbar = isK(p) ? kBarHTML(p) : '';
  $('#page').innerHTML=`<header><p class="eyebrow">${isK(p)?`Конспект <span class="roman">${p.roman}</span> · ${p.lec||modT}`:`Лист <span class="roman">${p.roman}</span> · ${modT}`}</p><h1 class="title">${p.title}</h1><p class="lead">${p.lead}</p>${p.src?`<p class="ksrc">Источник: ${p.src}</p>`:''}${relK||lrn?`<div class="krel">${lrn}${relK}</div>`:''}${isK(p)?`<p class="khint"><b>Нажмите на любой препарат</b> — откроется его карточка: доза, зачем выписывают, побочные эффекты. <span class="kd hl-y">Жёлтый</span> — знать наизусть и выписать, <span class="kd hl-g">зелёный</span> — выписать рецепт.</p>`:''}</header>${kbar}${body}
  <nav class="pager" aria-label="Соседние листы">${prev?`<a href="#${prev.id}"><small>← ${plab(prev)}</small><b>${prev.title}</b></a>`:''}${next?`<a class="nx" href="#${next.id}"><small>${plab(next)} →</small><b>${next.title}</b></a>`:''}</nav>`;
  bindPlate(p); fitTrees(); if(kbar) kBarBind(p);
}
/* ---------- конспект: панель «Разделы / Препараты лекции» ---------- */
function kLecDrugs(p){ return UNI.filter(e=>e.groups.some(g=>g.p===p.id)||e.cards.some(c=>c.p===p.id)||e.rx.some(r=>r.p===p.id)); }
function kBarHTML(p){
  const secs=p.blocks.filter(b=>b.t==='h').map((b,i)=>({id:`${p.id}-s${i+1}`,t:plain(b.text)}));
  const ds=kLecDrugs(p);
  return `<div class="kbar" id="kbar">${secs.length?`<button type="button" class="kb-b kb-sec" data-pop="sec" aria-expanded="false"><span class="kb-l">Раздел</span><span class="kb-cur">${esc(secs[0].t)}</span><span class="kb-ar" aria-hidden="true">▾</span></button>`:''}${ds.length?`<button type="button" class="kb-b" data-pop="drugs" aria-expanded="false"><span class="kb-l">Препараты</span><span class="kb-n">${ds.length}</span><span class="kb-ar" aria-hidden="true">▾</span></button>`:''}<button type="button" class="kb-b kb-up" data-top="1" aria-label="Наверх">↑</button>
  ${secs.length?`<div class="kpop" data-for="sec" hidden><ol>${secs.map(x=>`<li><button type="button" data-sec="${x.id}">${esc(x.t)}</button></li>`).join('')}</ol></div>`:''}
  ${ds.length?'':'<!--'}<div class="kpop kpop-d" data-for="drugs" hidden><input type="search" placeholder="Найти препарат в лекции" aria-label="Найти препарат в лекции"><div class="kp-l">${ds.map(e=>{ const g=e.groups.find(g=>g.p===p.id); return `<button type="button" data-dr="${esc(e.n)}" data-f="${esc(key([e.n,...e.names].join(' ')+' '+(g?g.g:'')))}"><b${e.hl?` class="kd hl-${e.hl}"`:''}>${e.n}</b><small>${g?esc(plain(g.g)):''}</small></button>`; }).join('')}</div></div>${ds.length?'':'-->'}</div>`;
}
let kSpy=null;
function kBarBind(p){
  const bar=$('#kbar'); if(!bar) return;
  const close=()=>{ $$('.kpop',bar).forEach(x=>x.hidden=true); $$('[data-pop]',bar).forEach(x=>x.setAttribute('aria-expanded','false')); };
  bar.addEventListener('click',e=>{
    const b=e.target.closest('[data-pop]'); if(b){ const pop=$(`.kpop[data-for="${b.dataset.pop}"]`,bar); const open=pop.hidden; close(); if(open){ pop.hidden=false; b.setAttribute('aria-expanded','true'); const inp=$('input',pop); if(inp&&matchMedia('(hover:hover)').matches) inp.focus(); } return; }
    const sc=e.target.closest('[data-sec]'); if(sc){ close(); const h=document.getElementById(sc.dataset.sec); if(h){ const y=h.getBoundingClientRect().top+scrollY-bar.offsetHeight-(matchMedia('(max-width: 920px)').matches?64:12); scrollTo({top:y,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}); } return; }
    if(e.target.closest('[data-top]')){ close(); scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}); return; }
    if(e.target.closest('[data-dr]')) close();
  });
  const inp=$('.kpop-d input',bar); if(inp) inp.addEventListener('input',()=>{ const v=key(inp.value).replace(/ё/g,'е'); $$('.kp-l button',bar).forEach(x=>x.hidden=!!v && !x.dataset.f.replace(/ё/g,'е').includes(v)); });
  document.addEventListener('click',function out(e){ if(!document.body.contains(bar)){ document.removeEventListener('click',out); return; } if(!bar.contains(e.target)) close(); });
  document.addEventListener('keydown',function esc1(e){ if(!document.body.contains(bar)){ document.removeEventListener('keydown',esc1); return; } if(e.key==='Escape'&&dz.hidden) close(); });
  const cur=$('.kb-cur',bar); const hs=$$('h2.sec[id]');
  if(kSpy) removeEventListener('scroll',kSpy);
  let raf=0; kSpy=()=>{ if(raf) return; raf=requestAnimationFrame(()=>{ raf=0; if(!cur||!document.body.contains(cur)) return; let t=hs[0]; for(const h of hs){ if(h.getBoundingClientRect().top<160) t=h; else break; } if(t&&cur.textContent!==t.textContent) cur.textContent=t.textContent; bar.classList.toggle('stuck',bar.getBoundingClientRect().top<=(matchMedia('(max-width: 920px)').matches?70:2)); }); };
  addEventListener('scroll',kSpy,{passive:true});
}

function bindPlate(p){
  Object.entries(figs).forEach(([id,{type,b}])=>{
    const fig=document.getElementById(id); fig._b=b;
    if(type==='chips'){
      fig.addEventListener('click',e=>{
        const c=e.target.closest('.chip[data-i]'); if(c){ activateChip(fig,b,+c.dataset.i); return; }
        const go=e.target.closest('[data-go]'); if(go){ activateChip(fig,b,+go.dataset.go); return; }
        const s=e.target.closest('.site'); if(s) activateSite(fig,b,s.dataset.site);
      });
      fig.addEventListener('keydown',e=>{ const s=e.target.closest('.site'); if(s && (e.key==='Enter'||e.key===' ')){ e.preventDefault(); activateSite(fig,b,s.dataset.site); } });
    } else if(type==='ans'){
      fig.addEventListener('click',e=>{ const x=e.target.closest('.rbtn'); if(x) ansSelect(fig,b,+x.dataset.i); });
      ansSelect(fig,b,Math.max(0,b.drugs.findIndex(d=>d.d==='Атропин')));
    } else if(type==='casc'){
      fig.addEventListener('click',e=>{ const x=e.target.closest('.rbtn'); if(x) cascSelect(fig,b,+x.dataset.i); });
      cascSelect(fig,b,Math.max(0,b.recs.findIndex(r=>r.r==='β₁')));
    } else if(type==='da'){
      fig.addEventListener('click',e=>{ const x=e.target.closest('.rbtn'); if(x) daSelect(fig,b,+x.dataset.i); const pth=e.target.closest('.dp-path'); if(pth) daSelect(fig,b,b.paths.findIndex(q=>q.k===pth.dataset.p)); });
      daSelect(fig,b,0);
    } else if(type==='pk'){
      fig._pk={th:6,tau:8,F:0.8,route:'iv',load:false};
      $$('input[type=range]',fig).forEach(r=>r.addEventListener('input',()=>{ fig._pk[r.dataset.v]=+r.value; pkDraw(fig); }));
      fig.addEventListener('click',e=>{ const x=e.target.closest('.seg button'); if(!x) return;
        if(x.dataset.route){ fig._pk.route=x.dataset.route; $$('[data-route]',fig).forEach(y=>y.setAttribute('aria-pressed',y===x?'true':'false')); }
        if(x.dataset.load){ fig._pk.load=!fig._pk.load; x.setAttribute('aria-pressed',fig._pk.load?'true':'false'); }
        pkDraw(fig); });
      pkDraw(fig);
    } else if(type==='la'){
      fig._la={i:4,ph:7.4};
      $('input[type=range]',fig).addEventListener('input',e=>{ fig._la.ph=+e.target.value; laDraw(fig); });
      fig.addEventListener('click',e=>{ const x=e.target.closest('.seg button'); if(!x) return; fig._la.i=+x.dataset.i; $$('.seg button',fig).forEach(y=>y.setAttribute('aria-pressed',y===x?'true':'false')); laDraw(fig); });
      laDraw(fig);
    }
  });
  // теги препаратов в карточках → схема
}
function showChip(k){
  const c=$(`.chip[data-k="${CSS.escape(k)}"]`); if(!c) return false;
  const fig=c.closest('.fig'); c.click();
  fig.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
  return true;
}
function focusPending(){
  if(!pending) return; const {n,kind}=pending; pending=null;
  const flash=el=>{ el.scrollIntoView({block:'center'}); el.classList.add('flash'); setTimeout(()=>el.classList.remove('flash'),1800); };
  if(kind==='g'){ const g=$(`.g[data-g="${CSS.escape(key(n))}"]`); if(g) flash(g); return; }
  if(kind==='k'){ for(const x of String(n).split('|')){ const el=kFind(x); if(el){ flash(el); return; } } return; }
  const k=first(String(n).split('|')[0]);
  if(showChip(k)) return;
  const t=$(`.dtag[data-k="${CSS.escape(k)}"]`); if(t){ flash(t.closest('.g')); return; }
  const r=$(`tr[data-k="${CSS.escape(k)}"]`); if(r){ r.scrollIntoView({block:'center'}); r.style.outline='2px solid var(--hema)'; setTimeout(()=>r.style.outline='',1800); }
}

/* ---------- обзор ---------- */
const plur=(n,a,b,c)=>{ const m=n%10, h=n%100; return m===1&&h!==11?a:(m>=2&&m<=4&&(h<12||h>14)?b:c); };
const UPOOL=()=>UNI.filter(e=>e.hl||e.cards.length||e.rx.length);
function drugOfDay(){ const L=UPOOL(); if(!L.length) return null; const day=Math.floor((Date.now()-new Date().getTimezoneOffset()*60000)/864e5); return L[(Math.imul(day,2654435761)>>>0)%L.length]; }
document.addEventListener('click',e=>{ const t=e.target.closest('[data-rand]'); if(!t) return; const L=UPOOL(); const d=L[Math.floor(Math.random()*L.length)]; openDossier(d.n,t); });
function renderHome(){
  figs={};
  $('#page').innerHTML=`<section class="hero"><p class="eyebrow">Фармакология · 3 курс · лечебный факультет</p>
  <h1>Атлас <em>фармакологии</em></h1>
  <p class="lead">Два слоя. <b>Конспект лекций</b> — схемы, классификации, списки для выписывания и формулировки из ваших материалов, ровно в том виде, в каком их спрашивают на зачётах. <b>Подробные листы</b> — углублённые схемы механизмов с точками приложения препаратов, реакции синтеза и распада и вопросы для самопроверки.</p>
  ${lockBanner()}<div class="howto"><div><b>Нажмите на препарат</b>Под каждой схемой — список препаратов. Кольцо на рисунке покажет, где именно он действует.</div><div><b>Нажмите на элемент схемы</b>Рецептор, фермент или транспортёр расскажет, что он делает и какие препараты на него влияют.</div><div><b>Найдите препарат</b>Поиск в боковой панели ведёт к схеме или карточке группы на нужном листе.</div></div>
  ${HASV?`<div class="hero-ecg" aria-hidden="true">${vECG({}).svg.replace('xMinYMid slice','none')}</div>`:''}
  <a class="dbcta" href="#drugs"><span class="dbcta-n" data-count="${UNI.length}">${UNI.length}</span><span><b>${LOCKED_N?'Препараты из конспектов':'Все препараты'}</b>На каждый препарат — одна карточка: дозировка и форма выпуска, зачем выписывают, побочные эффекты, противопоказания, формулировки из конспекта и механизм по шагам.</span><span class="go" aria-hidden="true">→</span></a>
  <div class="cta2">${HASV?`<a class="cta-b" href="#body"><span class="cta-ic cta-heart" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M24 40C11 31 6 24 6 17c0-6 4.6-10 10-10 3.8 0 6.6 2 8 5 1.4-3 4.2-5 8-5 5.4 0 10 4 10 10 0 7-5 14-18 23z"/><path class="cta-pulse" d="M8 24h8l3-6 4 12 4-9 2 3h11"/></svg></span><span><b>Организм</b>Выберите препарат — анимированная схема тела покажет, что происходит с сердцем и ЭКГ, сосудами и давлением, зрачком, бронхами, ЖКТ, железами и ЦНС. Дозовые режимы, отравления и антидоты.</span><span class="go" aria-hidden="true">→</span></a>`:''}${typeof lDeck==='function'?(()=>{ const dn=lDueCount(A), tot=lDeck(A).length; return `<a class="cta-b" href="#learn"><span class="cta-ic cta-cards" aria-hidden="true"><i></i><i></i><i></i></span><span><b>Учить препараты</b>${tot} ${plur(tot,'препарат','препарата','препаратов')} из конспектов: карточки с интервальным повторением, тест в формулировках зачёта, тренажёр доз и рецептов.${dn?` <em class="due">Сегодня к повторению: ${dn}</em>`:''}</span><span class="go" aria-hidden="true">→</span></a>`; })():''}</div>
  ${(()=>{ const dd=drugOfDay(); if(!dd) return ''; const g=dd.groups[0]; return `<div class="dday"><div><p class="eyebrow">Препарат дня${uKLecs(dd).length?' · конспект '+uKLecs(dd).map(p=>p.roman).join(', '):''}</p><h3>${dd.n}</h3><p>${g?g.g:(dd.d?dd.d.g:'')}</p>${dd.hl?`<p class="u-hl">${uHlBadge(dd.hl)}</p>`:''}</div><div class="dday-a"><button type="button" class="btn pri" data-dr="${esc(dd.n)}">Открыть карточку →</button><button type="button" class="btn" data-rand="1">Случайный препарат</button></div></div>`; })()}
  <div class="legend"><span class="chip stim">стимулирует, агонист</span><span class="chip block">блокирует, ингибирует</span><span class="chip mod">модулирует, смешанное действие</span><span><span class="rx-e">Фермент</span> — оранжевым моноширинным</span></div></section>
  ${MODULES.map(m=>`<section class="module${m.id==='kon'?' module-k':''}"><h2>${m.t}</h2>${m.id==='kon'?'<p class="par">Схемы, классификации и формулировки из ваших лекций — так, как спрашивают на зачётах. Препараты кликабельны: ведут к карточке конспекта или к подробному досье.</p><p class="par"><span class="kd hl-y">Жёлтый фон</span> — знать наизусть дозировку, сигнатуру, классификацию, показания и побочные эффекты, выписать рецепт. <span class="kd hl-g">Зелёный фон</span> — выписать рецепт. Рамка «Возможные формулировки» — так препарат могут описать на микроконтрольной и в ЗКР.</p>':''}<div class="plist">${P.filter(p=>p.mod===m.id).map(p=>`<a class="pcard${p.locked?' is-locked':''}" href="#${p.id}"><span class="num">${p.roman}</span><b>${p.title}</b><span>${p.sum}</span>${p.locked?`<em class="lock-tag">${LOCK_ICO}По подписке</em>`:''}</a>`).join('')}</div></section>`).join('')}
  ${ANTIDOTES.length?`<section class="tblw" style="margin-top:48px"><div class="rx-head"><h2 class="sec" style="margin:0">Антидоты семестра</h2></div><div class="tbl"><table><thead><tr><th scope="col">Отравление</th><th scope="col">Антидот</th><th scope="col">Механизм</th><th scope="col">Лист</th></tr></thead><tbody>${ANTIDOTES.map(r=>`<tr><td>${r[0]}</td><td style="color:var(--ink)">${r[1]}</td><td>${r[2]}</td><td><a href="#${P.find(p=>p.roman===r[3]).id}">${r[3]}</a></td></tr>`).join('')}</tbody></table></div></section>`:''}
  <p class="note">Материал для подготовки к занятиям. Дозы и показания сверяйте с инструкциями к препаратам и действующими клиническими рекомендациями.</p>`;
}

/* ---------- досье ---------- */
const dz=$('#dz'), dzBody=$('#dzBody'), dzBack=$('.dz-back'); let dzStack=[], dzOpener=null;
function flow(str){ const parts=String(str).split(' → '); if(parts.length<2) return `<p class="cf1">${str}</p>`; return `<div class="cf">${parts.map((x,i)=>i===parts.length-1?`<b>${x}</b>`:`<span>${x}</span><i aria-hidden="true">→</i>`).join('')}</div>`; }
function plateHasChip(pid,n){ const k=first(n); return BY[pid].blocks.some(b=>(b.chips||[]).some(c=>first(c.d)===k)); }
function dossierHTML(d){
  const P0=BY[d.p], pr=d.like?DRUGS[d.like]:null;
  const m=d.m||(pr&&pr.m)||[], s=d.s||(pr&&pr.s)||{}, sk=Object.keys(s);
  const viaM=pr&&!d.m, viaS=pr&&!d.s, chip=plateHasChip(d.p,d.n);
  const kc = findCard(d.n) || (d.al||[]).map(findCard).find(Boolean);
  const head = `<header class="dz-h"><p class="eyebrow">Лист <span class="roman">${P0.roman}</span> · ${P0.title}</p><h2 id="dz-title">${d.n}</h2><p class="dz-g">${d.g}</p><span class="dz-t">${d.t}</span>${d.al&&d.al.length?`<p class="dz-al">Другие названия: ${d.al.join(', ')}</p>`:''}
  <div class="dz-act"><button type="button" class="btn pri" data-goplate="${d.p}" data-n="${esc(d.n)}">${chip?'Показать на схеме':(location.hash.slice(1)===d.p?'Найти на листе':'Открыть лист '+P0.roman)}</button>${kc?`<button type="button" class="btn" data-goplate="${kc.p}" data-n="${esc(kc.n)}" data-k="1">Формулировки конспекта ${BY[kc.p].roman} →</button>`:''}${bodyName(d.n)?`<a class="btn" href="#body/${encodeURIComponent(bodyName(d.n))}">Как действует на организм →</a>`:''}</div></header>`;
  const likeBox = pr?`<div class="like"><p><b>Аналог препарата <button type="button" class="tlink" data-dr="${esc(pr.n)}">${pr.n}</button>.</b> Механизм и влияние на системы — как у прототипа${d.d?', отличия:':'.'}</p>${d.d?`<p>${d.d}</p>`:''}</div>`:'';
  const mech = `<section class="dz-sec"><h3>Молекулярный механизм${viaM?' · как у '+pr.n:''}</h3><ol class="mstep">${m.map(x=>`<li>${x}</li>`).join('')}</ol></section>`;
  const sys = sk.length?`<section class="dz-sec"><h3>Влияние на системы: причина → следствие${viaS?' · как у '+pr.n:''}</h3>${sk.map(k=>`<div class="sys"><h4>${k}</h4><div>${s[k].map(flow).join('')}</div></div>`).join('')}</section>`:'';
  const own = `<section class="dz-sec"><h3>Показания — когда и зачем</h3><ul class="dl2 ind">${(d.i||[]).map(([w,y])=>`<li><b>${w}</b>${y?`<span class="why"><em>зачем</em>${y}</span>`:''}</li>`).join('')}</ul></section>
  <section class="dz-sec"><h3>Побочные эффекты — что и почему</h3><ul class="dl2 ae">${(d.a||[]).map(([w,y])=>`<li><b>${w}</b>${y?`<span class="why"><em>почему</em>${y}</span>`:''}</li>`).join('')}</ul></section>
  ${d.c?`<section class="dz-sec"><h3>Противопоказания</h3><p class="dz-p">${d.c}</p></section>`:''}
  ${d.x?`<section class="dz-sec"><h3>Важно</h3><p class="dz-p">${d.x}</p></section>`:''}`;
  return head + (pr && viaS ? likeBox + own + `<details class="inh" open><summary>Механизм и влияние на системы — как у прототипа: ${pr.n}</summary>${mech}${sys}</details>` : likeBox + mech + sys + own);
}
function openDossier(name, opener, push){
  const e=uFind(name); if(!e) return;
  if(dz.hidden){ dzStack=[]; dzOpener=opener||document.activeElement; }
  if(push!==false && dzStack[dzStack.length-1]!==e.n) dzStack.push(e.n);
  dzBody.innerHTML=uCardHTML(e);
  dzBack.hidden=dzStack.length<2;
  dz.hidden=false; document.documentElement.classList.add('dz-open');
  const panel=$('.dz-panel'); panel.scrollTop=0; panel.focus({preventScroll:true});
  if(typeof FX!=='undefined') FX.dossier();
}
function closeDz(silent){
  if(dz.hidden) return; dz.hidden=true; document.documentElement.classList.remove('dz-open'); dzStack=[];
  if(!silent && dzOpener && document.contains(dzOpener)) dzOpener.focus({preventScroll:true});
}
dz.addEventListener('click',e=>{
  if(e.target.closest('[data-close]')){ closeDz(); return; }
  if(e.target.closest('.dz-back')){ dzStack.pop(); openDossier(dzStack[dzStack.length-1],null,false); return; }
  const go=e.target.closest('[data-goplate]'); if(go){ const pid=go.dataset.goplate; pending={n:go.dataset.n,kind:go.dataset.k?'k':'d'}; closeDz(true); if(location.hash.slice(1)===pid) requestAnimationFrame(focusPending); else location.hash=pid; }
});
document.addEventListener('keydown',e=>{ if(e.key==='Escape' && !dz.hidden) closeDz(); });
document.addEventListener('click',e=>{ const t=e.target.closest('[data-dr]'); if(t){ e.preventDefault(); openDossier(t.dataset.dr,t); } });
/* ссылка «к карточке конспекта» из Организма и Учить */
document.addEventListener('click',e=>{ const t=e.target.closest('a[data-kgo]'); if(!t) return; const pid=(t.getAttribute('href')||'').slice(1); if(!BY[pid]) return; pending={n:t.dataset.kgo,kind:'k'}; if(!dz.hidden) closeDz(true); if(location.hash.slice(1)===pid){ e.preventDefault(); requestAnimationFrame(focusPending); } });

/* ---------- страница базы ---------- */
const SYSC=[['Нервная система',/ЦНС|Нервная|Противорвот/],['Сердце и сосуды',/Сердце|ССС|Сосуд/],['Дыхание',/Дыхан|Лёгк|нос/],['ЖКТ',/ЖКТ|Слюн|Поджелуд/],['Почки и мочевыделение',/Почк|Мочевыд|Водный|Моча/],['Глаз',/Глаз/],['Мышцы',/[Мм]ышц/],['Обмен и эндокринная',/Обмен|Эндокрин|Щитовид|Паращитовид|Надпочеч|Кост/],['Кровь',/Кровь/],['Печень',/Печень/],['Кожа и терморегуляция',/Кожа|Терморег/],['Репродукция и плод',/Плод|Половая|Матка/],['Вегетативные эффекты',/Периферия|Вегетатив|Железы/]];
const canon=nm=>{ const f=SYSC.find(([,r])=>r.test(nm)); return f?f[0]:'Другое'; };
const drugSys=d=>{ const s=d.s||(d.like&&DRUGS[d.like]&&DRUGS[d.like].s)||{}; return new Set(Object.keys(s).map(canon)); };
const dbState={q:'',p:'',sys:''};
const SUB='₀₁₂₃₄₅₆₇₈₉';
const norm=x=>key(x).replace(/[₀-₉]/g,c=>String(SUB.indexOf(c))).replace(/альфа[- ]?/g,'α').replace(/бета[- ]?/g,'β').replace(/гамма[- ]?/g,'γ').replace(/\bb(?=\d|\b)/g,'β').replace(/\ba(?=\d)/g,'α').replace(/[⁺⁻]/g,'');
function renderDB(){
  figs={};
  const lecs=P.filter(isK);
  $('#page').innerHTML=`<header><p class="eyebrow">${LOCKED_N?'Препараты из конспектов':'Все препараты'} · ${UNI.length}</p><h1 class="title">${LOCKED_N?'Препараты из конспектов':'Все препараты'}</h1><p class="lead">Каждый препарат из конспектов и подробных листов. Нажмите на название — откроется одна карточка: дозировка и форма выпуска, зачем выписывают, побочные эффекты, противопоказания, формулировки и действие на организм.</p></header>
  <div class="dbf"><label for="dbq">Поиск<input id="dbq" type="search" placeholder="Название или группа: атропин, β₂, статины" value="${esc(dbState.q)}" autocomplete="off"></label><label for="dbp">Лекция<select id="dbp"><option value="">Все лекции</option>${lecs.map(p=>`<option value="${p.id}"${dbState.p===p.id?' selected':''}>${p.roman} · ${p.title}</option>`).join('')}<option value="_ext"${dbState.p==='_ext'?' selected':''}>Только в подробных листах</option></select></label></div>
  <div class="seg dbset" role="group" aria-label="Набор"><button type="button" data-set="" aria-pressed="${!dbState.sys}">Все</button><button type="button" data-set="yg" aria-pressed="${dbState.sys==='yg'}">Жёлтые и зелёные</button><button type="button" data-set="y" aria-pressed="${dbState.sys==='y'}">Только жёлтые</button></div>
  <p class="dbn" aria-live="polite"></p><div class="dbl"></div>`;
  const draw=()=>{
    const v=norm(dbState.q);
    const list=UNI.filter(e=>{ if(dbState.p==='_ext'){ if(uKLecs(e).length) return false; } else if(dbState.p && !e.ps.has(dbState.p)) return false;
      if(dbState.sys==='y' && e.hl!=='y') return false; if(dbState.sys==='yg' && !e.hl) return false;
      if(!v) return true; return [e.n,...e.names,...e.groups.map(g=>g.g),e.d?e.d.g:'',e.d?e.d.t:''].some(x=>norm(x).includes(v)); });
    $('.dbn').textContent=list.length?`Найдено: ${list.length} из ${UNI.length}`:'Ничего не найдено — измените запрос или фильтры.';
    const groups={}; list.forEach(e=>{ const L=e.n[0].toUpperCase(); (groups[L]=groups[L]||[]).push(e); });
    $('.dbl').innerHTML=Object.keys(groups).map(L=>`<section><h3 class="letter">${L}</h3>${groups[L].map(e=>{ const g=e.groups[0]; const kl=uKLecs(e).map(p=>p.roman).join(', ');
      return `<button type="button" class="dbrow${e.hl?' hl-'+e.hl:''}" data-dr="${esc(e.n)}"><b>${e.n}</b><span>${g?g.g:(e.d?e.d.g:'')}</span><small>${kl?'Конспект '+kl:(e.d?'Лист '+BY[e.d.p].roman:'')}${e.rx.length||e.x?' · доза':''}</small></button>`; }).join('')}</section>`).join('');
  };
  $('#dbq').addEventListener('input',e=>{ dbState.q=e.target.value; draw(); });
  $('#dbp').addEventListener('change',e=>{ dbState.p=e.target.value; draw(); });
  $('.dbset').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; dbState.sys=b.dataset.set; $$('.dbset button').forEach(x=>x.setAttribute('aria-pressed',String(x===b))); draw(); });
  draw();
}

/* ---------- маршрутизация ---------- */
const A = {$, $$, esc, plain, key, first, findDrug, kFindDrug, kSame, findCard, openDossier, BY, P, DLIST, DRUGS, canon, flow, isK, plab, bodyName, plur, uFind, uCardHTML, uLearnHTML, uDoseHTML, UNI};
window.__A = A;
function route(){
  let id=location.hash.slice(1); try{ id=decodeURIComponent(id); }catch(e){}
  const parts=id.split('/'), base=parts[0], arg=parts.slice(1).join('/');
  const p=BY[id]; document.onkeydown=null;
  let kind='home';
  if(typeof EXTRA!=='undefined' && EXTRA.routes[base]){ figs={}; EXTRA.routes[base](A,arg); setCurrent(base); kind=base; }
  else { if(id==='drugs'){ renderDB(); kind='drugs'; } else if(p){ renderPlate(p); kind='plate'; } else renderHome(); setCurrent(p?p.id:(id==='drugs'?'drugs':'')); }
  if(kind==='home'){ const c=$('[data-count]'); if(c&&typeof FX!=='undefined') FX.count(c,+c.dataset.count); }
  if(!pendingDossier) closeDz(true);
  if(pending) requestAnimationFrame(focusPending); else window.scrollTo(0,0);
  if(pendingDossier){ const n=pendingDossier; pendingDossier=null; openDossier(n); }
  if(typeof FX!=='undefined') FX.page(kind);
  if(kind==='plate' && p && !p.locked && window.MAP){ try{ window.MAP.last({atlas:'farma', title:p.title, sub:'Фармакология, '+(p.lec||('лист '+(p.roman||''))), url:location.href}); }catch(e){} }
  const due=$('#nav .due'); if(due && typeof lDueCount==='function'){ const n=lDueCount(A); due.textContent=n; due.hidden=!n; }
}
window.addEventListener('hashchange',route);
const start=()=>{ buildNav(); if(typeof FX!=='undefined') FX.shell(); route(); };
if(document.fonts && document.fonts.status!=='loaded'){ let done=false; const go=()=>{ if(!done){ done=true; start(); } }; document.fonts.ready.then(()=>{ if(done){ _mcache.clear(); fitTrees(); if($('.kgraph') && dz.hidden){ const y=scrollY; route(); scrollTo(0,y); } } else go(); }); setTimeout(go,1800); } else start();
})();

