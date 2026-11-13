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
P.filter(isK).forEach(p=>p.blocks.forEach(b=>{ const T=rxTab(b); if(!T) return;
  b.rows.forEach(r=>{ const nm=uClean(rxName(r[T.iN]).ru); if(uSkip(nm)) return; const e=uEnt(nm,true,p.id); const mark=r.some(c=>/<mark>/.test(c));
    const ix=r.map((_,i)=>i).filter(i=>i!==T.iN&&i!==T.iNo); const vals=ix.map(i=>String(r[i]).replace(/<\/?mark>/g,'')); const sig=uClean(r[T.iF])+'|'+(T.iD>=0?uClean(r[T.iD]):'');
    if(!e.rx.some(x=>x.sig===sig)) e.rx.push({p:p.id, head:ix.map(i=>uClean(b.head[i])), vals, mark, sig}); if(mark) uHl(e,'y'); e.ps.add(p.id); });
}));
/* досье, модель «Организм», дозы */
const uLinkD = e=>{ const ns=[e.n,...e.names]; for(const n of ns){ if(/ \+ /.test(n)){ const m=UCOMBO[key(n)]; if(m&&DRUGS[m]) return DRUGS[m]; if(DKEY[key(n)]) return DKEY[key(n)]; continue; } const d=kFindDrug(n); if(d) return d; } return null; };
UNI.forEach(e=>{ e.d=uLinkD(e); });
DLIST.forEach(d=>{ if(UNI.some(e=>e.d===d)) return; const e=UBY[uK(UMERGE[d.n]||d.n)]||uNew(d.n); e.d=d; e.ps.add(d.p); (d.al||[]).forEach(a=>e.names.add(a)); });
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
  if(!opt.norp){ const R=rpAll(e); if(R.length) o+=`<div class="u-rp"><p class="u-src">${R.length>1?'Рецепты · '+R.length:'Рецепт'}</p><div class="rp-list">${R.map(r=>rpHTML(r)).join('')}</div></div>`; }
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
  const grp = e.groups.length ? e.groups.map(g=>`<li><span class="roman">${BY[g.p].roman}</span>${g.g}</li>`).join('') : '';
  const other=[...e.names].filter(n=>n!==e.n);
  const feats=uCardsF(e,'f'), fm=uCardsF(e,'fm'), pp=uCardsF(e,'pp'), xs=e.cards.map(({c})=>c.x).filter(Boolean);
  const kli=e.cards.map(({c})=>c.kl).filter(Boolean);
  const m=e.d?(e.d.m||(pr&&pr.m)||[]):[], s=e.d?(e.d.s||(pr&&pr.s)||{}):{};
  const head=`<header class="dz-h"><p class="eyebrow">${kl.length?'Конспект '+kl.map(p=>`<span class="roman">${p.roman}</span>`).join(', '):(e.d?'Лист <span class="roman">'+BY[e.d.p].roman+'</span>':'Препарат')}</p><h2 id="dz-title">${e.n}</h2>${other.length?`<p class="dz-al">${e.cards.length||e.groups.length?'Также: ':'Другие названия: '}${other.join(', ')}</p>`:''}${e.hl?`<p class="u-hl">${uHlBadge(e.hl)}</p>`:''}
    ${grp?`<ul class="u-grp">${grp}</ul>`:(e.d?`<p class="dz-g">${e.d.g}</p>`:'')}${kli.length?`<p class="kc-kl"><span>кл</span>${kli.join('; ')}</p>`:''}${e.d?`<span class="dz-t">${e.d.t}</span>`:''}<p class="dz-cmpw"><button type="button" class="btn dz-cmp" data-cmpadd="${esc(e.n)}">⇄ Сравнить с другим препаратом</button></p></header>`;
  const sec=(cls,h,body)=>`<section class="dz-sec u-sec ${cls}"><h3>${h}</h3>${body}</section>`;
  let o=head;
  o+=sec('u-dose','Дозировка и форма выпуска',uDoseHTML(e,{all:true,norp:true}));
  { const R=rpAll(e); if(R.length) o+=sec('u-rps',`Рецепты · ${R.length}`,`<div class="rp-list">${R.map(r=>rpHTML(r)).join('')}</div>`); }
  { const FXH=fxHTML(e); if(FXH){ o+=FXH; o+=`<details class="u-more fx-old"><summary>Показания и побочные эффекты списком — как в конспекте</summary>${sec('u-ind','Зачем выписывают',uIndHTML(e))}${sec('u-ae','Побочные эффекты',uAeHTML(e))}</details>`; } else { o+=sec('u-ind','Зачем выписывают',uIndHTML(e)); o+=sec('u-ae','Побочные эффекты',uAeHTML(e)); } }
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
  return `${grp||kli.length?sec('','Группа',grp+(kli.length?`<p class="kc-kl"><span>кл</span>${kli.join('; ')}</p>`:'')):''}${sec('u-dose','Дозировка',uDoseHTML(e,{all:true,norp:true})+(rpAll(e).length?`<p class="u-note">Рецептов: ${rpAll(e).length} — тренируются в карточках «доза и рецепт».</p>`:''))}${sec('pok','Зачем выписывают',uIndHTML(e,true))}${sec('pe','Побочные эффекты',uAeHTML(e,true))}${fm.length?`<div class="lb-s fm"><h4>Возможные формулировки</h4><ul>${fm.map(x=>`<li>${x}</li>`).join('')}</ul></div>`:''}`;
}

/* ---------- навигация ---------- */
/* ---------- закрытые темы ---------- */
const LOCK_ICO='<svg class="lock-ico" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7.5" rx="1.6"/><path d="M5.3 7V5.2a2.7 2.7 0 0 1 5.4 0V7"/></svg>';
const LOCKED_N = P.filter(p=>p.locked).length;
const SUBJECT_ACCESS = !!window.MA?.hasAtlasAccess('farma');
function maState(){ return window.MA_STATE||{auth:'none'}; }
function lockActions(){
  const MA=window.MA, st=maState();
  if(st.auth==='error') return `<p class="par">Вы вошли, но закрытые темы не загрузились. Проверьте интернет и <button type="button" class="tlink" onclick="location.reload()">обновите страницу</button>.</p>`;
  if(MA&&MA.signedIn()) return '<p class="par">Для полной версии нужна подписка на фармакологию. Продажи пока не запущены.</p>';
  if(!MA||!MA.enabled()) return `<p class="par">Вход работает на сайте атласа: <a href="https://ascorbinca234-crypto.github.io/medical_atlas/farma-atlas/">ascorbinca234-crypto.github.io/medical_atlas</a>.</p>`;
  return `<div class="dz-act"><a class="btn pri" href="${esc(MA.loginUrl())}">Войти</a><a class="btn" href="${esc(MA.loginUrl('register'))}">Зарегистрироваться</a></div><p class="par lock-how">Регистрация бесплатная.</p>`;
}
function lockBanner(){
  if(SUBJECT_ACCESS) return '<div class="lockban"><div><b>Все конспекты по фармакологии доступны.</b><span>Выберите нужную тему в указателе.</span></div></div>';
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
  const link=(id,label,icon,extra='')=>`<a href="#${id}" data-id="${id}" class="navdb"><span class="n">${icon}</span><span>${label}${extra}</span></a>`;
  const homeIcon='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 9 10 3l7 6v8H5V9M8 17v-5h4v5"/></svg>';
  const basic=link('','Главная',homeIcon)+link('drugs','Все препараты',ICO.db)+link('learn','Учить препараты',ICO.learn,` <small class="due" title="к повторению сегодня"${due?'':' hidden'}>${due}</small>`);
  const tools=(HASV?link('body','Организм',ICO.body):'')+link('train','Тренажёры',ICO.train)+link('cmp','Сравнение',ICO.cmp)+link('sheet','Шпаргалки',ICO.sheet)+link('find','Поиск по показаниям',ICO.db);
  const groups=MODULES.map(m=>{const items=P.filter(p=>p.mod===m.id);return `<details class="nav-group" data-nav-module="${esc(m.id)}"><summary><span>${m.t}</span><small>${items.length}</small></summary><div class="nav-group-items">${items.map(p=>`<a href="#${p.id}" data-id="${p.id}"><span class="n">${p.roman}</span><span>${p.title}</span></a>`).join('')}</div></details>`;}).join('');
  $('#nav').innerHTML=`<div class="nav-section"><h6>Навигация</h6><div class="navtop">${basic}</div></div><div class="nav-section"><h6>Материалы</h6>${groups}</div><div class="nav-section"><h6>Дополнительно</h6><details class="nav-group nav-tools"><summary><span>Инструменты</span><small>5</small></summary><div class="navtop nav-group-items">${tools}</div></details></div>`;
}
function setCurrent(id){
  $$('#nav a').forEach(a=>{if(a.dataset.id===id){a.setAttribute('aria-current','page');const group=a.closest('details');if(group)group.open=true;}else a.removeAttribute('aria-current');});
}

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
  const sub=e=>{ const g=e.groups[0]; return g?`${BY[g.p].roman} · ${g.g}`:(e.d?e.d.g:''); };
  res.innerHTML = dh.length||gh.length ? dh.map(h=>`<button type="button" data-u="${esc(h.e.n)}"><b>${esc(h.e.n)}${h.m!==h.e.n?` <i>(${esc(h.m)})</i>`:''}</b><small>${esc(plain(sub(h.e)))}</small></button>`).join('') + gh.map(h=>`<button type="button" data-p="${h.p}" data-n="${esc(h.n)}" data-kind="${h.kind}"><b>${esc(h.n)}</b><small>Группа · ${plab(BY[h.p])}</small></button>`).join('') : '<div class="none">Ничего не найдено</div>';
  if(v.length>=3) res.insertAdjacentHTML('beforeend',`<a class="s-find" href="#find/${encodeURIComponent(q.value.trim())}">Искать «${esc(q.value.trim())}» в показаниях, побочных эффектах и механизмах →</a>`);
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

function tableBlock(b,k){ const tq=k&&b.rows.length>=2&&b.head.length>=2; return `<section class="tblw">${b.title||tq?`<div class="rx-head${tq?' tq-h':''}">${b.title?`<h3 class="blk">${b.title}</h3>`:'<span></span>'}${tq?`<button type="button" class="tq-b" data-tq="1" aria-pressed="false">Проверить себя</button>`:''}</div>`:''}<div class="tbl"><table><thead><tr>${b.head.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${b.rows.map(r=>`<tr${b.idx?` data-k="${first(r[0])}"`:''}>${r.map((c,ci)=>{ const dr=(b.idx&&ci===0)?(uFind(uClean(String(c).split('<br>')[0]))||(KMODE?null:findDrug(c))):null; return `<td>${dr?`<button type="button" class="tlink" data-dr="${esc(dr.n)}">${c}</button>`:c}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>${b.note?`<p class="tnote">${b.note}</p>`:''}</section>`; }

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
    ${c.rp?rpHTML(rpParse(c.rp,'')):''}
    ${c.kl?`<p class="kc-kl"><span>кл</span>${c.kl}</p>`:''}
    ${L.slice(1).map(([f,h])=>c[f]&&c[f].length?`<div class="kc-l kc-${f}"><h5>${h}</h5><ol>${c[f].map(x=>`<li>${x}</li>`).join('')}</ol></div>`:'').join('')}
    ${c.fm&&c.fm.length?`<div class="kc-fm"><h5>Возможные формулировки</h5><ol>${c.fm.map(x=>`<li>${x}</li>`).join('')}</ol></div>`:''}
    ${c.x?`<p class="kc-x">${c.x}</p>`:''}
    ${(()=>{ const e=uFind(c.n); const RX=e?rpAll(e).filter(r=>r.src!=='k'):[]; return e?`<div class="kc-dose"><h5>Доза</h5>${uDoseHTML(e,{norp:true})}</div>${RX.length?`<details class="kc-rpx"><summary>${c.rp?'Ещё рецепты':'Рецепты'} · ${RX.length}</summary><div class="rp-list">${RX.map(r=>rpHTML(r)).join('')}</div></details>`:''}<p class="kc-dr"><button type="button" class="btn kc-open" data-dr="${esc(e.n)}">Вся карточка: доза, зачем, побочки →</button></p>`:''; })()}
    </article>`; }).join('')}</div>`;
}
const kCardEl = nm=>$$('.kc').find(c=>(c.dataset.kall||'').split('|').some(x=>kSame(nm,x)));
function kFind(nm){
  return kCardEl(nm) || $(`[data-kd="${CSS.escape(nm)}"]`) || $(`[data-kn="${CSS.escape(nm)}"]`) || $$('[data-kd],[data-kn]').find(e=>kSame(nm,e.dataset.kd||e.dataset.kn||'')) || null;
}
function kGo(t){ const nm=t.dataset.kd; const e=uFind(nm); if(e) openDossier(e.n,t); }
document.addEventListener('click',e=>{ const t=e.target.closest('[data-kd]'); if(t){ e.preventDefault(); kGo(t); } });
document.addEventListener('keydown',e=>{ const t=e.target.closest&&e.target.closest('g[data-kd]'); if(t&&(e.key==='Enter'||e.key===' ')){ e.preventDefault(); kGo(t); } });

/* ---------- рецепты: бланк Rp ---------- */
const RP_K=/^(Rp\.?:?|D\.\s*t\.\s*d\.|D\.\s*S\.|S\.)\s*/;
function rpParse(txt,f){ const out=[]; String(txt).split('\n').forEach(raw=>{ const s=raw.trim(); if(!s) return; if(RP_K.test(s.replace(/<[^>]+>/g,''))||!out.length) out.push(s); else out[out.length-1]+=' '+s; }); return {f:f||'', l:out, src:'k'}; }
const rpKey=s=>plain(s).toLowerCase().replace(/^rp\.?:?/,'').replace(/[\s.,:;–—\-]+/g,'');
function rpAll(e){ if(!e) return []; if(e._rpa) return e._rpa; const out=[], ck=new Set();
  e.cards.forEach(({p,c})=>{ if(!c.rp) return; const r=rpParse(c.rp,'из конспекта '+BY[p].roman); ck.add(rpKey(r.l[0])); out.push(r); });
  (e.rp||[]).forEach(r=>{ if(!ck.has(rpKey(r.l[0]))) out.push(r); });
  e._rpa=out; return out; }
function rpHTML(r,o){ o=o||{};
  const rows=r.l.map(s=>{ const m=plain(s).match(RP_K); const k=m?m[1].replace(/\s+/g,''):''; let t=s; if(m){ const kk=s.match(/^(<[^>]+>)*\s*(Rp\.?:?|D\.\s*t\.\s*d\.|D\.\s*S\.|S\.)\s*/); t=kk?s.slice(kk[0].length):s; }
    const cls=/^Rp/.test(k)?'rp-rp':/^(S\.|D\.S\.)/.test(k)?'rp-s':'rp-d';
    return `<div class="rp-l ${cls}"><span class="rp-k">${k}</span><span class="rp-t">${t}</span></div>`; }).join('');
  return `<figure class="rp${r.src==='k'?' rp-kon':''}">${r.f?`<figcaption>${esc(r.f)}</figcaption>`:''}<div class="rp-b">${rows}</div>${r.n?`<p class="rp-n">${esc(r.n)}</p>`:''}${o.nocopy?'':`<button type="button" class="rp-c" data-rpcopy="${esc(r.l.map(plain).join('\n'))}">Копировать</button>`}</figure>`; }
if(typeof RPD!=='undefined') Object.keys(RPD).forEach(n=>{ const e=uFind(n); if(e) e.rp=(e.rp||[]).concat(RPD[n]); else console.warn('RPD: нет препарата в реестре —', n); });
document.addEventListener('click',e=>{ const b=e.target.closest('[data-rpcopy]'); if(!b) return; const txt=b.dataset.rpcopy;
  const ok=()=>{ b.textContent='Скопировано'; setTimeout(()=>{ b.textContent='Копировать'; },1600); };
  const sel=()=>{ const f=b.closest('.rp'); const box=f&&f.querySelector('.rp-b'); if(!box) return; const rg=document.createRange(); rg.selectNodeContents(box); const s=getSelection(); s.removeAllRanges(); s.addRange(rg); b.textContent='Выделено — скопируйте'; };
  try{ navigator.clipboard.writeText(txt).then(ok,sel); }catch(x){ sel(); } });

/* ---------- конспект: части лекций (для фокуса «показать только …») ---------- */
const KPARTS={
  'k-gen':[['Фармакодинамика',/^Фармакодинамика/],['Фармакокинетика',/^Фармакокинетика$/]],
  'k-aff':[['Местные анестетики',/^Средства, влияющие/],['Вяжущие, обволакивающие, адсорбирующие',/^Вяжущие, обволакивающие/],['Раздражающие',/^Раздражающие/],['Выписывание',/^Ориентировочный/]],
  'k-pns':[['Афферентная иннервация · 1–3',/^1\./],['ВНС и рецепторы · 4–6',/^4\./],['Классификация · 7',/^7\./],['Холинергические · 8–10',/^8\./],['Адренергические · 11–12',/^11\./],['Гистамин · 13',/^13\./]],
  'k-adr':[['Синапс и рецепторы',/^Адренергический синапс/],['Адреномиметики',/^Адреномиметики$/],['Адреноблокаторы',/^Адреноблокаторы$/]],
  'k-his':[['Гистамин и рецепторы',/^Гистамин$/],['Антигистаминные',/^Классификация/],['Противоаллергические',/^Противоаллерг/],['Выписывание',/^Ориентировочный/]],
  'k-ane':[['Общие анестетики',/^Средства, влияющие/],['Снотворные',/^Снотворные/],['Седативные',/^Седативные/],['Аналептики',/^Антинаркотические/],['Выписывание',/^Ориентировочный/]],
  'k-opi':[['Боль и опиоидные рецепторы',/^Болеутоляющие/],['Эффекты и применение',/^6\. Опиоидные/],['Препараты',/^Опиоидные анальгетики и их/],['Выписывание',/^Ориентировочный/]],
  'k-nsa':[['Механизм действия',/^НПВС/],['Классификация и селективность',/^Классификация НПВС/],['Препараты',/^Препараты$/],['Таблицы',/^Всякие таблицы/],['Выписывание',/^Ориентировочный/]],
  'k-psl':[['Психотропные средства',/^Психотропные средства$/],['Антипсихотики',/^Антипсихотики/],['Анксиолитики',/^Анксиолитики/],['Нормотимики',/^Нормотимики/],['Выписывание',/^Ориентировочный/]],
  'k-psa':[['Депрессия',/^Депрессия/],['Антидепрессанты',/^Антидепрессанты$/],['Выписывание',/^Ориентировочный/]],
  'k-park':[['Болезнь и патогенез',/^Болезнь Паркинсона/],['Дофаминомиметики',/^Заместительная/],['М-холинолитики и др.',/^Центральные М-холинолитики/]],
  'k-ibs':[['ИБС и работа сердца',/^Ишемическая/],['Антиангинальные средства',/^Антиангинальные/],['Профилактика ИБС',/^Средства первичной/],['Выписывание',/^Ориентировочный/]],
  'k-ag':[['АГ и регуляция АД',/^Артериальная гипертензия/],['Нейротропные',/^Нейротропные/],['РААС',/^Средства, влияющие на РААС/],['Вазодилататоры',/^Миотропные/],['Неотложная помощь',/^Неотложная/],['Антигипотензивные',/^Антигипотензивные/],['Выписывание',/^Ориентировочный/]]
};
function kParts(p){ const heads=p.blocks.filter(b=>b.t==='h').map(b=>plain(b.text)); const cfg=KPARTS[p.id]; if(!cfg) return [];
  const st=[]; cfg.forEach(([t,re])=>{ const i=heads.findIndex(h=>re.test(h)); if(i>=0&&!st.some(x=>x.s===i+1)) st.push({t,s:i+1}); }); st.sort((a,b)=>a.s-b.s);
  return st.map((x,i)=>({t:x.t, from:i===0?0:x.s, to:st[i+1]?st[i+1].s-1:heads.length})); }
const KKIND={tree:'Классификация', graph:'Схема', flow:'Цепочка', path:'Схема', fig:'Рисунок', chains:'Схема', ans:'Схема', cascade:'Схема', pk:'Модель', la:'Модель', dapath:'Схема', table:'Таблица', cards:'Карточки'};
function kKind(b){ if(b.t==='cols') return (b.cols||[]).some(c=>(c.d||[]).length)?'Классификация':'Схема'; if(b.t==='table'&&rxTab(b)) return 'Выписывание'; if(b.t==='list'&&/Экзаменацион/.test(b.title||'')) return 'Вопросы'; return KKIND[b.t]||''; }
function kTitle(b){ if(b.t==='cards'){ const n=b.items.map(c=>plain(c.n)); return b.title?plain(b.title):n.slice(0,3).join(', ')+(n.length>3?' и др.':''); } return plain(b.title||b.n||'')||(b.t==='table'?'Таблица':''); }
function kOutline(p){ let s=0; const secs=[{n:0,t:'Начало',blocks:[]}]; p.blocks.forEach((b,bi)=>{ if(b.t==='h'){ s++; secs.push({n:s,t:plain(b.text),id:`${p.id}-s${s}`,blocks:[]}); return; } const k=kKind(b); if(k) secs[s].blocks.push({bi,k,t:kTitle(b),id:`${p.id}-b${bi}`}); }); return secs; }

/* ---------- конспект: учебная таблица «для выписывания» ---------- */
function rxBlock(b,p,bi){
  const T=rxTab(b); const H=T.H; const cl=c=>String(c==null?'':c).replace(/<\/?mark>/g,'');
  const has=v=>{ const u=uClean(v||''); return u && u!=='—' && u!=='-'; };
  const rows=b.rows.map((r,ri)=>{ const nmo=rxName(r[T.iN]); const ru=uClean(nmo.ru); const e=uFind(ru); const mark=r.some(c=>/<mark>/.test(c));
    const tn=T.iT>=0?cl(r[T.iT]):''; const R=e?rpAll(e):[]; const rid=`${p.id}-b${bi}-r${ri}`;
    const cell=(k,lab,v)=>`<div class="rxr-c rxr-${k}"><span class="rxr-lab">${lab}</span><div class="rxr-v">${has(v)?v:'—'}</div></div>`;
    return `<article class="rxr${mark?' mk':''}" data-n="${esc(ru)}">
      <div class="rxr-n">${e?`<button type="button" class="tlink" data-dr="${esc(e.n)}">${esc(ru)}</button>`:`<b>${esc(ru)}</b>`}${nmo.la?`<i lang="la">${esc(nmo.la)}</i>`:''}${has(tn)?`<small>${tn}</small>`:''}</div>
      ${cell('f',esc(H[T.iF]||'Форма выпуска'),cl(r[T.iF]))}${T.iI>=0?cell('i',esc(H[T.iI]),cl(r[T.iI])):''}${T.iD>=0?cell('d',esc(H[T.iD]),cl(r[T.iD])):''}
      <div class="rxr-a">${R.length?`<button type="button" class="rxr-rb" data-rpo="${rid}" aria-expanded="false" aria-controls="${rid}">Rp · ${R.length}</button>`:''}</div>
      ${R.length?`<div class="rxr-rps rp-list" id="${rid}" hidden>${R.map(x=>rpHTML(x)).join('')}</div>`:''}</article>`; }).join('');
  const ny=b.rows.filter(r=>r.some(c=>/<mark>/.test(c))).length;
  return `<section class="rxt${T.iI>=0?' rxt-i':''}${T.iD<0?' rxt-nd':''}" data-rxt="${bi}">
  <div class="rxt-h"><div class="rxt-tt"><h3 class="blk">${b.title||'Препараты для выписывания'}</h3><p class="rxt-sub">${b.rows.length} ${plur(b.rows.length,'строка','строки','строк')}${ny?` · жёлтых ${ny} — дозу и рецепт знать наизусть`:''}</p></div><button type="button" class="btn pri" data-rxrun="${bi}">▶ Прогнать список</button></div>
  <div class="rxt-bar"><div class="seg" role="group" aria-label="Какие строки показать"><button type="button" data-rxf="all" aria-pressed="true">Все</button>${ny?`<button type="button" data-rxf="y" aria-pressed="false">Только жёлтые · ${ny}</button>`:''}</div>
   <div class="seg" role="group" aria-label="Скрыть для самопроверки"><button type="button" data-rxh="f" aria-pressed="false">Скрыть форму</button>${T.iD>=0?`<button type="button" data-rxh="d" aria-pressed="false">Скрыть дозу</button>`:''}</div>
   <button type="button" class="btn rxt-all" data-rpall="1" aria-pressed="false">Все рецепты</button></div>
  <div class="rxt-hd" aria-hidden="true"><span>Препарат</span><span>${esc(H[T.iF])}</span>${T.iI>=0?`<span>${esc(H[T.iI])}</span>`:''}${T.iD>=0?`<span>${esc(H[T.iD])}</span>`:''}<span></span></div>
  <div class="rxt-l">${rows}</div>${b.note?`<p class="tnote">${b.note}</p>`:''}</section>`;
}

/* ---------- конспект: разделы, полосы «прогнать», итог занятия ---------- */
let CURP=null, KSEC=0;
function kRunStrip(sets,s){ const sec=sets&&sets.secs.find(x=>x.n===s); if(!sec) return '';
  return `<aside class="krun" aria-label="Прогон раздела"><div class="krun-t"><b>Проверьте себя</b><span>«${esc(sec.t)}» · ${sec.items.length} ${plur(sec.items.length,'препарат','препарата','препаратов')}</span></div><div class="krun-a"><button type="button" class="btn pri" data-krun="s${s}" data-m="cards">▶ Прогнать раздел</button><button type="button" class="btn" data-krun="s${s}" data-m="test">Тест по разделу</button><button type="button" class="btn" data-krun="all" data-m="cards">Всё занятие · ${sets.items.length}</button></div></aside>`; }
function kFinale(p,sets){ if(!sets||!sets.items.length) return ''; const s=typeof lStat==='function'?lStat(sets.items):null;
  return `<section class="kfin" id="${p.id}-fin"><p class="eyebrow">Конец занятия · ${esc(p.roman)}</p><h2>Прогнать всё занятие</h2><p class="kfin-s">${sets.items.length} ${plur(sets.items.length,'препарат','препарата','препаратов')}${s?` · прочно ${s.mature}, в процессе ${s.young}, не начаты ${s.nw}`:''}. Ошибки сразу попадают в интервальное повторение.</p>
  <div class="kfin-a"><button type="button" class="btn pri" data-krun="all" data-m="cards">Карточки · ${sets.items.length}</button><button type="button" class="btn" data-krun="all" data-m="test">Тест</button>${sets.rx.length?`<button type="button" class="btn" data-krun="rx" data-m="rx">Рецепты · ${sets.rx.length}</button>`:''}${sets.yg.length?`<button type="button" class="btn" data-krun="yg" data-m="cards">Жёлтые и зелёные · ${sets.yg.length}</button>`:''}<a class="btn" href="#learn/${p.id}">Повторение по лекции →</a></div></section>`; }
function kBody(p,one){
  const S=lSecOf(p); const sets=typeof lSets==='function'?lSets(A,p.id):null; const out=[]; let cur=-1;
  p.blocks.forEach((b,bi)=>{ const s=S[bi]; if(s!==cur){ if(cur>=0) out.push(kRunStrip(sets,cur)+'</section>'); out.push(`<section class="ksec" data-s="${s}">`); cur=s; }
    out.push(`<div class="kblk" id="${p.id}-b${bi}" data-t="${b.t}">${one(b,bi)}</div>`); });
  if(cur>=0) out.push(kRunStrip(sets,cur)+'</section>');
  return out.join('')+kFinale(p,sets);
}
function kRunSet(key){ const p=CURP; if(!p) return null; const S=lSets(A,p.id); if(!S) return null; const parts=kParts(p);
  if(key==='all') return {items:S.items, t:'Всё занятие'}; if(key==='yg') return {items:S.yg, t:'Жёлтые и зелёные'}; if(key==='rx') return {items:S.rx, t:'Рецепты занятия'}; if(key==='hard') return {items:S.hard, t:'Трудные'};
  if(key[0]==='s'){ const s=S.secs.find(x=>x.n===+key.slice(1)); return s?{items:s.items, t:'Раздел «'+s.t+'»'}:null; }
  if(key[0]==='g'){ const g=S.groups[+key.slice(1)]; return g?{items:g.items, t:g.g}:null; }
  if(key[0]==='p'){ const pt=parts[+key.slice(1)]; if(!pt) return null; return {items:S.items.filter(it=>it.secs.some(n=>n>=pt.from&&n<=pt.to)), t:'Часть «'+pt.t+'»'}; }
  return null; }
document.addEventListener('click',e=>{ const b=e.target.closest('[data-krun]'); if(!b||!CURP) return; const set=kRunSet(b.dataset.krun); if(!set||!set.items.length) return; const pop=b.closest('.kpop'); if(pop){ pop.hidden=true; }
  RUN.open({items:set.items, mode:b.dataset.m||'cards', title:set.t, eyebrow:'Прогон · '+CURP.roman+' · '+CURP.title, opener:b}); });

/* ---------- учебная таблица: фильтр, скрытие, рецепты, прогон; самопроверка ---------- */
document.addEventListener('click',e=>{
  const t=e.target; const sec=t.closest('.rxt');
  if(sec){
    const f=t.closest('[data-rxf]'); if(f){ sec.dataset.f=f.dataset.rxf; sec.querySelectorAll('[data-rxf]').forEach(x=>x.setAttribute('aria-pressed',String(x===f))); return; }
    const h=t.closest('[data-rxh]'); if(h){ const on=h.getAttribute('aria-pressed')!=='true'; h.setAttribute('aria-pressed',String(on)); sec.classList.toggle('h-'+h.dataset.rxh,on); if(on) sec.querySelectorAll('.rxr-'+h.dataset.rxh+' .rxr-v').forEach(v=>v.classList.remove('rev')); return; }
    const o=t.closest('[data-rpo]'); if(o){ const box=document.getElementById(o.dataset.rpo); if(!box) return; const on=box.hidden; box.hidden=!on; o.setAttribute('aria-expanded',String(on)); return; }
    const a=t.closest('[data-rpall]'); if(a){ const on=a.getAttribute('aria-pressed')!=='true'; a.setAttribute('aria-pressed',String(on)); a.textContent=on?'Свернуть рецепты':'Все рецепты'; sec.querySelectorAll('[data-rpo]').forEach(x=>{ const box=document.getElementById(x.dataset.rpo); if(box){ box.hidden=!on; x.setAttribute('aria-expanded',String(on)); } }); return; }
    const r=t.closest('[data-rxrun]'); if(r&&CURP){ const D=lDeck(A).filter(it=>it.p===CURP.id); const names=[...sec.querySelectorAll('.rxr')].filter(x=>sec.dataset.f!=='y'||x.classList.contains('mk')).map(x=>x.dataset.n);
      const items=[]; names.forEach(n=>{ const it=D.find(x=>kSame(n,x.n)||kSame(x.n,n)); if(it&&!items.includes(it)) items.push(it); });
      RUN.open({items, mode:'rx', title:plain(sec.querySelector('h3').textContent), eyebrow:'Прогон списка · '+CURP.roman, opener:r}); return; }
  }
  const q=t.closest('[data-tq]'); if(q){ const w=q.closest('.tblw'); const on=q.getAttribute('aria-pressed')!=='true'; q.setAttribute('aria-pressed',String(on)); q.textContent=on?'Показать ответы':'Проверить себя'; w.classList.toggle('tq',on); if(on) w.querySelectorAll('td.rev').forEach(x=>x.classList.remove('rev')); return; }
});
const KMASK='.tdl > li, .tblw td:not(:first-child), .rxr-v, .kc .kc-l, .kc .kc-kl, .kc .kc-fm, .kc .rp, .kc .kc-dose, .kcol > ol:not(.tdl) > li, .kcol > ul > li';
document.addEventListener('click',e=>{ const t=e.target; if(!(t instanceof Element)) return; const pg=document.getElementById('page'); let m=null;
  if(pg&&pg.classList.contains('kv-t')){ m=t.closest(KMASK); if(m&&!pg.contains(m)) m=null; }
  if(!m){ const td=t.closest('.tblw.tq td'); if(td&&td.cellIndex>0) m=td; }
  if(!m){ const v=t.closest('.rxt.h-f .rxr-f .rxr-v, .rxt.h-d .rxr-d .rxr-v'); if(v) m=v; }
  if(m && !m.classList.contains('rev')){ m.classList.add('rev'); e.preventDefault(); e.stopPropagation(); kMaskCount(); } },true);
function kMaskCount(){ const pg=document.getElementById('page'); const el=document.getElementById('kmc'); if(!pg||!el||!pg.classList.contains('kv-t')) return; const all=[...pg.querySelectorAll(KMASK)].filter(x=>!x.closest('.dz,.run')); const op=all.filter(x=>x.classList.contains('rev')).length; el.textContent=`открыто ${op} из ${all.length}`; }

/* ---------- конспект: навигатор ---------- */
const KV_KEY='atlas-kview';
const kvGet=()=>{ try{ return localStorage.getItem(KV_KEY)||'all'; }catch(e){ return 'all'; } };
const kvSet=v=>{ try{ localStorage.setItem(KV_KEY,v); }catch(e){} };
let KFOCUS=-1;
function kBarHTML(p){
  const secs=kOutline(p); const parts=kParts(p); const sets=typeof lSets==='function'?lSets(A,p.id):null; const items=sets?sets.items:[];
  const cnt=n=>{ const s=sets&&sets.secs.find(x=>x.n===n); return s?s.items.length:0; };
  const secLi=s=>`<li><div class="kt-s"><button type="button" class="kt-sb" data-sec="${s.id||''}" data-sn="${s.n}"><span class="kt-n">${s.n}</span><span>${esc(s.t)}</span></button>${cnt(s.n)?`<span class="kt-c">${cnt(s.n)}</span>`:''}</div>${s.blocks.length?`<ul class="kt-b">${s.blocks.map(x=>`<li><button type="button" data-blk="${x.id}"><i>${x.k}</i>${esc(x.t)}</button></li>`).join('')}</ul>`:''}</li>`;
  const realSecs=secs.filter(s=>s.n>0||s.blocks.length);
  const toc = parts.length ? parts.map((pt,pi)=>`<div class="kt-part"><div class="kt-ph"><b>${esc(pt.t)}</b><button type="button" class="kt-f" data-focus="${pi}">Только эта часть</button></div><ol class="kt-l">${realSecs.filter(s=>s.n>=pt.from&&s.n<=pt.to).map(secLi).join('')}</ol></div>`).join('') : `<ol class="kt-l">${realSecs.map(secLi).join('')}</ol>`;
  const allBlocks=secs.flatMap(s=>s.blocks.map(x=>Object.assign({st:s.t},x)));
  const grp=[['Классификации — все препараты по группам',x=>x.k==='Классификация'],['Схемы и рисунки',x=>['Схема','Цепочка','Рисунок','Модель'].includes(x.k)],['Таблицы и списки для выписывания',x=>x.k==='Таблица'||x.k==='Выписывание'],['Карточки препаратов',x=>x.k==='Карточки']];
  const nSch=allBlocks.filter(x=>x.k!=='Вопросы').length;
  const sch=grp.map(([h,f])=>{ const l=allBlocks.filter(f); return l.length?`<div class="ks-g"><p class="kp-h">${h} · ${l.length}</p>${l.map(x=>`<button type="button" class="ks-i" data-blk="${x.id}"><i>${x.k}</i><b>${esc(x.t)}</b><small>${esc(x.st)}</small></button>`).join('')}</div>`:''; }).join('');
  const grouped=new Set(); const gs=sets?sets.groups:[]; gs.forEach(g=>g.items.forEach(it=>grouped.add(it)));
  const dItem=it=>`<button type="button" data-dr="${esc((it.e&&it.e.n)||it.n)}" data-f="${esc(key(it.n+' '+(it.e?[...it.e.names].join(' '):'')+' '+it.groups.join(' ')))}"><b${it.hl?` class="kd hl-${it.hl}"`:''}>${it.n}</b></button>`;
  const rest=items.filter(it=>!grouped.has(it));
  const drugs = items.length ? `${gs.map((g,gi)=>`<div class="kp-g"><div class="kp-gh"><b>${esc(g.g)}</b><button type="button" class="kp-run" data-krun="g${gi}" data-m="cards" aria-label="Прогнать группу ${esc(g.g)}">▶ ${g.items.length}</button></div><div class="kp-gl">${g.items.map(dItem).join('')}</div></div>`).join('')}${rest.length?`<div class="kp-g"><div class="kp-gh"><b>${gs.length?'Другие препараты лекции':'Препараты лекции'}</b></div><div class="kp-gl">${rest.map(dItem).join('')}</div></div>`:''}` : '';
  const v=kvGet();
  const view=`<p class="kp-h">Что показывать</p><div class="seg kv-seg" role="group" aria-label="Вид конспекта"><button type="button" data-kv="all" aria-pressed="${v==='all'}">Весь конспект</button><button type="button" data-kv="s" aria-pressed="${v==='s'}">Схемы и таблицы</button><button type="button" data-kv="t" aria-pressed="${v==='t'}">Самопроверка</button></div><p class="kp-note">«Схемы и таблицы» убирает текст и оставляет классификации, схемы, карточки и таблицы. «Самопроверка» закрывает названия препаратов в классификациях, ответы в таблицах и карточках: вспомните и нажмите, чтобы открыть.</p>${parts.length?`<p class="kp-h">Показать только часть</p><div class="kv-parts"><button type="button" data-focus="-1" aria-pressed="${KFOCUS<0}">Весь конспект</button>${parts.map((x,i)=>`<button type="button" data-focus="${i}" aria-pressed="${KFOCUS===i}">${esc(x.t)}</button>`).join('')}</div>`:''}`;
  const run = sets&&items.length ? `<div class="kr-row"><span><b>Всё занятие</b><small>${items.length} ${plur(items.length,'препарат','препарата','препаратов')}</small></span><span class="kr-a"><button type="button" class="btn pri" data-krun="all" data-m="cards">Карточки</button><button type="button" class="btn" data-krun="all" data-m="test">Тест</button>${sets.rx.length?`<button type="button" class="btn" data-krun="rx" data-m="rx">Рецепты · ${sets.rx.length}</button>`:''}</span></div><div class="kr-row" id="krcur" hidden></div><div class="kr-row" id="krpart" hidden></div>${sets.yg.length?`<div class="kr-row"><span><b>Жёлтые и зелёные</b><small>${sets.yg.length} — выписать рецепт</small></span><span class="kr-a"><button type="button" class="btn" data-krun="yg" data-m="cards">Карточки</button>${sets.yg.some(it=>it.hasRx)?`<button type="button" class="btn" data-krun="yg" data-m="rx">Рецепты</button>`:''}</span></div>`:''}<a class="kr-l" href="#learn/${p.id}">Интервальное повторение по этой лекции →</a><a class="kr-l" href="#sheet/${p.id}">Шпаргалка лекции для печати →</a>` : '';
  return `<div class="kbar" id="kbar">
  <button type="button" class="kb-b kb-sec" data-pop="toc" aria-expanded="false"><span class="kb-l">Оглавление</span><span class="kb-cur">${esc((realSecs.find(s=>s.n>0)||{t:''}).t)}</span><span class="kb-ar" aria-hidden="true">▾</span></button>
  ${nSch?`<button type="button" class="kb-b" data-pop="sch" aria-expanded="false"><span class="kb-t">Схемы</span><span class="kb-n">${nSch}</span></button>`:''}
  ${items.length?`<button type="button" class="kb-b" data-pop="drugs" aria-expanded="false"><span class="kb-t">Препараты</span><span class="kb-n">${items.length}</span></button>`:''}
  <button type="button" class="kb-b" data-pop="view" aria-expanded="false" aria-label="Вид конспекта"><span class="kb-t">Вид</span><span class="kb-ar" aria-hidden="true">▾</span></button>
  ${run?`<button type="button" class="kb-b kb-run" data-pop="run" aria-expanded="false"><span aria-hidden="true">▶</span><span class="kb-t">Прогон</span></button>`:''}
  <button type="button" class="kb-b kb-up" data-top="1" aria-label="Наверх">↑</button>
  <div class="kpop kpop-toc" data-for="toc" hidden>${toc}</div>
  ${nSch?`<div class="kpop kpop-s" data-for="sch" hidden>${sch}</div>`:''}
  ${items.length?`<div class="kpop kpop-d" data-for="drugs" hidden><label class="sr" for="kpq">Найти препарат в лекции</label><input id="kpq" type="search" placeholder="Найти препарат или группу" autocomplete="off"><div class="kp-l">${drugs}</div></div>`:''}
  <div class="kpop kpop-v" data-for="view" hidden>${view}</div>
  ${run?`<div class="kpop kpop-r" data-for="run" hidden>${run}</div>`:''}
  </div><div class="kfocus" id="kfocus" hidden></div>`;
}
function kScrollTo(el){ const bar=$('#kbar'); if(!el) return; const y=el.getBoundingClientRect().top+scrollY-(bar?bar.offsetHeight:0)-(matchMedia('(max-width: 920px)').matches?64:12); scrollTo({top:Math.max(0,y),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}); }
function kApply(p){
  const pg=$('#page'); const v=kvGet(); pg.classList.toggle('kv-s',v==='s'); pg.classList.toggle('kv-t',v==='t');
  const parts=kParts(p); const pt=KFOCUS>=0?parts[KFOCUS]:null;
  $$('.ksec',pg).forEach(s=>{ const n=+s.dataset.s; s.hidden=!!pt && !(n>=pt.from&&n<=pt.to); });
  const fb=$('#kfocus'); if(fb){ const bits=[];
    if(pt) bits.push(`<span>Показана часть <b>«${esc(pt.t)}»</b>${pt.to>pt.from?` · разделы ${Math.max(1,pt.from)}–${pt.to}`:''}</span><button type="button" class="btn" data-focus="-1">Показать весь конспект</button>`);
    if(v==='t') bits.push(`<span>Самопроверка: вспомните и нажмите на закрытое · <b id="kmc"></b></span><span class="kf-a"><button type="button" class="btn" data-kopen="1">Открыть всё</button><button type="button" class="btn" data-kclose="1">Закрыть снова</button><button type="button" class="btn" data-kv="all">Выйти</button></span>`);
    if(v==='s') bits.push(`<span>Только схемы и таблицы — текст скрыт</span><button type="button" class="btn" data-kv="all">Показать текст</button>`);
    fb.innerHTML=bits.map(x=>`<div class="kf-r">${x}</div>`).join(''); fb.hidden=!bits.length; }
  $$('[data-kv]').forEach(x=>{ if(x.closest('.kv-seg')) x.setAttribute('aria-pressed',String(x.dataset.kv===v)); });
  $$('.kv-parts [data-focus]').forEach(x=>x.setAttribute('aria-pressed',String(+x.dataset.focus===KFOCUS)));
  const kp=$('#krpart'); if(kp){ if(pt){ const set=kRunSet('p'+KFOCUS); kp.hidden=!set||!set.items.length; if(set) kp.innerHTML=`<span><b>Часть «${esc(pt.t)}»</b><small>${set.items.length} ${plur(set.items.length,'препарат','препарата','препаратов')}</small></span><span class="kr-a"><button type="button" class="btn" data-krun="p${KFOCUS}" data-m="cards">Карточки</button><button type="button" class="btn" data-krun="p${KFOCUS}" data-m="test">Тест</button></span>`; } else kp.hidden=true; }
  kMaskCount();
}
let kSpy=null;
function kBarBind(p){
  const bar=$('#kbar'); if(!bar) return; CURP=p; KSEC=0;
  const close=()=>{ $$('.kpop',bar).forEach(x=>x.hidden=true); $$('[data-pop]',bar).forEach(x=>x.setAttribute('aria-expanded','false')); };
  const curRun=()=>{ const box=$('#krcur'); if(!box) return; const set=KSEC?kRunSet('s'+KSEC):null; const h=KSEC?document.getElementById(`${p.id}-s${KSEC}`):null; box.hidden=!set||!set.items.length; if(set&&h) box.innerHTML=`<span><b>Текущий раздел</b><small>«${esc(plain(h.textContent))}» · ${set.items.length}</small></span><span class="kr-a"><button type="button" class="btn" data-krun="s${KSEC}" data-m="cards">Карточки</button><button type="button" class="btn" data-krun="s${KSEC}" data-m="test">Тест</button></span>`; };
  const goEl=el=>{ if(!el) return; const sec=el.closest('.ksec'); if(sec&&sec.hidden){ KFOCUS=-1; kApply(p); } kScrollTo(el); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); setTimeout(()=>el.classList.remove('flash'),1700); };
  bar.addEventListener('click',e=>{
    const b=e.target.closest('[data-pop]'); if(b){ const pop=$(`.kpop[data-for="${b.dataset.pop}"]`,bar); const open=pop.hidden; close(); if(open){ if(b.dataset.pop==='run') curRun(); pop.hidden=false; b.setAttribute('aria-expanded','true'); const inp=$('input',pop); if(inp&&matchMedia('(hover:hover)').matches) inp.focus(); } return; }
    const sc=e.target.closest('[data-sec]'); if(sc){ close(); const el=sc.dataset.sec?document.getElementById(sc.dataset.sec):$('.ksec',$('#page')); goEl(el); return; }
    const bk=e.target.closest('[data-blk]'); if(bk){ close(); goEl(document.getElementById(bk.dataset.blk)); return; }
    if(e.target.closest('[data-top]')){ close(); scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}); return; }
    if(e.target.closest('[data-dr]')) close();
  });
  const inp=$('.kpop-d input',bar); if(inp) inp.addEventListener('input',()=>{ const v=key(inp.value).replace(/ё/g,'е'); $$('.kp-g',bar).forEach(g=>{ let any=false; $$('.kp-gl button',g).forEach(x=>{ const ok=!v||x.dataset.f.replace(/ё/g,'е').includes(v)||key($('.kp-gh b',g).textContent).includes(v); x.hidden=!ok; if(ok) any=true; }); g.hidden=!any; }); });
  document.addEventListener('click',function out(e){ if(!document.body.contains(bar)){ document.removeEventListener('click',out); return; } if(!bar.contains(e.target)) close(); });
  document.addEventListener('keydown',function esc1(e){ if(!document.body.contains(bar)){ document.removeEventListener('keydown',esc1); return; } if(e.key==='Escape'&&dz.hidden) close(); });
  const cur=$('.kb-cur',bar); const hs=$$('h2.sec[id]');
  if(kSpy) removeEventListener('scroll',kSpy);
  let raf=0; kSpy=()=>{ if(raf) return; raf=requestAnimationFrame(()=>{ raf=0; if(!cur||!document.body.contains(cur)) return; let t=null; for(const h of hs){ if(h.offsetParent===null) continue; if(!t) t=h; if(h.getBoundingClientRect().top<160) t=h; else break; } if(t){ if(cur.textContent!==t.textContent) cur.textContent=t.textContent; const m=t.id.match(/-s(\d+)$/); KSEC=m?+m[1]:0; } bar.classList.toggle('stuck',bar.getBoundingClientRect().top<=(matchMedia('(max-width: 920px)').matches?70:2)); }); };
  addEventListener('scroll',kSpy,{passive:true});
  kApply(p);
}
document.addEventListener('click',e=>{ if(!CURP||!document.getElementById('kbar')) return;
  const f=e.target.closest('[data-focus]'); if(f){ KFOCUS=+f.dataset.focus; const pop=f.closest('.kpop'); if(pop) pop.hidden=true; kApply(CURP); const first=$$('.ksec').find(s=>!s.hidden); if(first&&KFOCUS>=0) kScrollTo(first); else if(KFOCUS<0) kScrollTo($('#kbar')); return; }
  const v=e.target.closest('[data-kv]'); if(v){ kvSet(v.dataset.kv); kApply(CURP); return; }
  if(e.target.closest('[data-kopen]')){ $$(KMASK,$('#page')).forEach(x=>x.classList.add('rev')); kMaskCount(); return; }
  if(e.target.closest('[data-kclose]')){ $$('.rev',$('#page')).forEach(x=>x.classList.remove('rev')); kMaskCount(); return; }
});

/* ---------- главная: «Сегодня» ---------- */
function todayHTML(){
  if(typeof lDeck!=='function') return ''; const D=lDeck(A); const t=lToday(); const pr=lPrefs(); const due=lDueCount(A); const q=lQueueToday(D,pr,0);
  const today=LST.days[t]||0, goal=pr.goal||30, k=lStreak(); const C=2*Math.PI*22; const frac=Math.min(1,today/goal);
  const PL=typeof lPlanGet==='function'?lPlanGet():null; const PC=PL?lPlanCalc(D,PL,pr.set):null;
  const plates=KP.filter(p=>D.some(it=>it.p===p.id)); const hard=D.filter(it=>((lRec(it.id)||[])[3]||0)>0).length;
  const rows=plates.map(p=>{ const s=lStat(D.filter(it=>it.p===p.id)); const pct=Math.round((s.mature+s.young)/s.n*100);
    return `<div class="td-l"><a href="#${p.id}" class="td-lt"><span class="roman">${p.roman}</span><span>${esc(p.title)}</span></a><span class="td-lb" aria-hidden="true"><i class="k" style="width:${(s.mature/s.n*100).toFixed(1)}%"></i><i class="l" style="width:${(s.young/s.n*100).toFixed(1)}%"></i></span><span class="td-ln">${pct}%</span><button type="button" class="td-run" data-hrun="${p.id}">▶ Прогнать<span class="sr"> лекцию ${esc(p.title)}</span></button></div>`; }).join('');
  const started=Object.keys(LST.items).length>0; const head = due ? `Пора повторить ${due} ${plur(due,'карточку','карточки','карточек')}` : !started ? `Начните с ${q.nw} ${plur(q.nw,'новой карточки','новых карточек','новых карточек')} или прогоните лекцию` : q.nw ? `Повторения выполнены — ${q.nw} ${plur(q.nw,'новая карточка','новые карточки','новых карточек')} на сегодня` : 'На сегодня всё повторено';
  return `<section class="today" id="today" aria-labelledby="td-h"><div class="td-top"><div><p class="eyebrow">Сегодня · повторение и прогон</p><h2 id="td-h">${head}</h2>
    <div class="td-st"><span><b>${due}</b> к повторению</span><span><b>${q.nw}</b> ${plur(q.nw,'новая','новые','новых')}</span><span><b>${k}</b> ${plur(k,'день','дня','дней')} подряд</span>${PC&&PC.days>0?`<a class="td-ex" href="#learn" data-lmode="plan"><b>${PC.days}</b> ${plur(PC.days,'день','дня','дней')} до экзамена${PC.per?` · план ${PC.per}/день`:''}</a>`:''}</div></div>
    <div class="td-ring" title="Цель дня"><svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="22" class="tr-bg"/><circle cx="26" cy="26" r="22" class="tr-fg" style="stroke-dasharray:${C.toFixed(1)};stroke-dashoffset:${(C*(1-frac)).toFixed(1)}"/></svg><b>${today}</b><small>из ${goal}</small></div></div>
    ${typeof rdResumeHTML==='function'?rdResumeHTML():''}<div class="td-a"><a class="btn pri" href="#learn">${due||q.nw?'▶ Начать повторение':'Открыть тренажёр'}${due+q.nw?` · ${q.list.length}`:''}</a><button type="button" class="btn" data-hrun="test">Тест · 10 вопросов</button>${hard?`<button type="button" class="btn" data-hrun="hard">Трудные · ${hard}</button>`:''}<a class="btn" href="#learn" data-lmode="rp">Рецепты</a></div>
    <div class="td-lh"><p class="kp-h">Прогнать лекцию целиком</p><span class="td-leg"><i class="k"></i>прочно <i class="l"></i>в процессе</span></div><div class="td-ll">${rows}</div>
    <div class="td-x"><a href="#learn" data-lmode="plan">${PC&&PC.days>0?'План до экзамена':'Составить план до экзамена'}</a><a href="#train">Тренажёры</a><a href="#cmp">Сравнение препаратов</a><a href="#find">Поиск по показаниям и п.э.</a><a href="#sheet">Шпаргалки для печати</a></div></section>`;
}
document.addEventListener('click',e=>{ const b=e.target.closest('[data-hrun]'); if(!b) return; const D=lDeck(A); const k=b.dataset.hrun;
  if(k==='test'){ const seen=D.filter(it=>lSeen(lRec(it.id))); RUN.open({items:seen.length>=12?seen:D, mode:'test', title:seen.length>=12?'Тест по изученным препаратам':'Тест по всем лекциям', eyebrow:'Прогон', opener:b}); return; }
  if(k==='hard'){ RUN.open({items:D.filter(it=>((lRec(it.id)||[])[3]||0)>0), mode:'cards', title:'Трудные препараты', eyebrow:'Прогон', opener:b}); return; }
  const S=lSets(A,k); if(S) RUN.open({items:S.items, mode:'cards', title:'Всё занятие', eyebrow:'Прогон · '+S.p.roman+' · '+S.p.title, opener:b}); });
document.addEventListener('click',e=>{ const a=e.target.closest('a[data-lmode]'); if(!a) return; const pr=lPrefs(); pr.mode=a.dataset.lmode; lPrefSave(pr); });


/* ---------- страница листа ---------- */
function renderPlate(p){
  if(p.locked){renderLockedPlate(p);return;}
  figs={}; CURP=isK(p)?p:null;
  const chipKeys=new Set(); p.blocks.forEach(b=>(b.chips||[]).forEach(c=>chipKeys.add(first(c.d))));
  let n=0, hn=0; const no=()=>`${isK(p)?p.roman:p.num}.${++n}`;
  KMODE = isK(p); KCUR = []; if(KMODE) p.blocks.forEach(b=>{ if(b.t==='cards') b.items.forEach(c=>KCUR.push(kNames(c))); });
  const one=(b,bi)=>{
    switch(b.t){
      case 'h': { hn++; return `<h2 class="sec" id="${p.id}-s${hn}">${b.text}</h2>`; }
      case 'p': return `<p class="par">${b.html}</p>`;
      case 'fig': return figBlock(b,p,no());
      case 'path': return pathBlock(b,p,no());
      case 'table': return (isK(p)&&rxTab(b))?rxBlock(b,p,bi):tableBlock(b,isK(p));
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
  };
  const body=isK(p)?kBody(p,one):p.blocks.map(one).join('');
  const i=P.indexOf(p), prev=P[i-1], next=P[i+1];
  const modT=MODULES.find(m=>m.id===p.mod).t;
  const relK = isK(p) ? (p.rel||[]).filter(r=>BY[r]).map(r=>`<a class="btn" href="#${r}">Подробный лист ${BY[r].roman}: ${BY[r].title} →</a>`).join('') : P.filter(x=>isK(x)&&(x.rel||[]).includes(p.id)).map(x=>`<a class="btn" href="#${x.id}">Схемы по конспекту ${x.roman} →</a>`).join('');
  const lrn = isK(p) && typeof lDeck==='function' ? `<a class="btn pri" href="#learn/${p.id}">Учить препараты лекции →</a>` : '';
  const kbar = isK(p) ? kBarHTML(p) : '';
  $('#page').innerHTML=`<header><p class="eyebrow">${isK(p)?`Конспект <span class="roman">${p.roman}</span> · ${p.lec||modT}`:`Лист <span class="roman">${p.roman}</span> · ${modT}`}</p><h1 class="title">${p.title}</h1><p class="lead">${p.lead}</p>${p.src?`<p class="ksrc">Источник: ${p.src}</p>`:''}${relK||lrn?`<div class="krel">${lrn}${relK}</div>`:''}${isK(p)?`<p class="khint"><b>Нажмите на любой препарат</b> — откроется его карточка: доза, зачем выписывают, побочные эффекты. <span class="kd hl-y">Жёлтый</span> — знать наизусть и выписать, <span class="kd hl-g">зелёный</span> — выписать рецепт.</p>`:''}</header>${kbar}${body}
  <nav class="pager" aria-label="Соседние листы">${prev?`<a href="#${prev.id}"><small>← ${plab(prev)}</small><b>${prev.title}</b></a>`:''}${next?`<a class="nx" href="#${next.id}"><small>${plab(next)} →</small><b>${next.title}</b></a>`:''}</nav>`;
  bindPlate(p); fitTrees(); if(kbar){ kBarBind(p); if(typeof kAfter==="function") try{ kAfter(p); }catch(e){ console.error(e); } }
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
  <h1>Атлас <em>фармакологии</em></h1>${lockBanner()}
  <p class="lead">Разбирайте механизмы, находите препараты и готовьтесь к зачётам — всё в одном атласе.</p>
  <div class="quick-start" aria-label="С чего начать">
    <a href="#drugs"><span class="quick-icon" aria-hidden="true">⌕</span><span><b>Найти препарат</b><small>Карточки, механизмы и побочные эффекты</small></span><span class="quick-arrow" aria-hidden="true">↗</span></a>
    <a href="#topics"><span class="quick-icon" aria-hidden="true">≡</span><span><b>Изучить тему</b><small>Конспекты, классификации и схемы</small></span><span class="quick-arrow" aria-hidden="true">↓</span></a>
    <a href="#learn"><span class="quick-icon" aria-hidden="true">✓</span><span><b>Подготовиться к экзамену</b><small>Повторение, тесты и план занятий</small></span><span class="quick-arrow" aria-hidden="true">↗</span></a>
  </div>
  ${todayHTML()}
  <div class="howto"><div><b>Нажмите на препарат</b>Под каждой схемой — список препаратов. Кольцо на рисунке покажет, где именно он действует.</div><div><b>Нажмите на элемент схемы</b>Рецептор, фермент или транспортёр расскажет, что он делает и какие препараты на него влияют.</div><div><b>Найдите препарат</b>Поиск в боковой панели ведёт к схеме или карточке группы на нужном листе.</div></div>
  ${HASV?`<div class="hero-ecg" aria-hidden="true">${vECG({}).svg.replace('xMinYMid slice','none')}</div>`:''}
  <a class="dbcta" href="#drugs"><span class="dbcta-n" data-count="${window.MA_FARMA_OVERVIEW.drugs}">${window.MA_FARMA_OVERVIEW.drugs}</span><span><b>Все препараты</b>На каждый препарат — одна карточка: дозировка и форма выпуска, зачем выписывают, побочные эффекты, противопоказания, формулировки из конспекта и механизм по шагам.</span><span class="go" aria-hidden="true">→</span></a>
  <div class="cta2">${HASV?`<a class="cta-b" href="#body"><span class="cta-ic cta-heart" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M24 40C11 31 6 24 6 17c0-6 4.6-10 10-10 3.8 0 6.6 2 8 5 1.4-3 4.2-5 8-5 5.4 0 10 4 10 10 0 7-5 14-18 23z"/><path class="cta-pulse" d="M8 24h8l3-6 4 12 4-9 2 3h11"/></svg></span><span><b>Организм</b>Выберите препарат — анимированная схема тела покажет, что происходит с сердцем и ЭКГ, сосудами и давлением, зрачком, бронхами, ЖКТ, железами и ЦНС. Дозовые режимы, отравления и антидоты.</span><span class="go" aria-hidden="true">→</span></a>`:''}</div>
  ${(()=>{ const dd=drugOfDay(); if(!dd) return ''; const g=dd.groups[0]; return `<div class="dday"><div><p class="eyebrow">Препарат дня${uKLecs(dd).length?' · конспект '+uKLecs(dd).map(p=>p.roman).join(', '):''}</p><h3>${dd.n}</h3><p>${g?g.g:(dd.d?dd.d.g:'')}</p>${dd.hl?`<p class="u-hl">${uHlBadge(dd.hl)}</p>`:''}</div><div class="dday-a"><button type="button" class="btn pri" data-dr="${esc(dd.n)}">Открыть карточку →</button><button type="button" class="btn" data-rand="1">Случайный препарат</button></div></div>`; })()}
  <div class="legend"><span class="chip stim">стимулирует, агонист</span><span class="chip block">блокирует, ингибирует</span><span class="chip mod">модулирует, смешанное действие</span><span><span class="rx-e">Фермент</span> — оранжевым моноширинным</span></div></section>
  <div id="topics" tabindex="-1"></div>${MODULES.map(m=>`<section class="module${m.id==='kon'?' module-k':''}"><h2>${m.t}</h2>${m.id==='kon'?'<p class="par">Схемы, классификации и формулировки из ваших лекций — так, как спрашивают на зачётах. Препараты кликабельны: ведут к карточке конспекта или к подробному досье.</p><p class="par"><span class="kd hl-y">Жёлтый фон</span> — знать наизусть дозировку, сигнатуру, классификацию, показания и побочные эффекты, выписать рецепт. <span class="kd hl-g">Зелёный фон</span> — выписать рецепт. Рамка «Возможные формулировки» — так препарат могут описать на микроконтрольной и в ЗКР.</p>':''}<div class="plist">${P.filter(p=>p.mod===m.id).map(p=>`<a class="pcard" href="#${p.id}"><span class="num">${p.roman}</span><b>${p.title}</b><span>${p.sum}</span></a>`).join('')}</div></section>`).join('')}
  <section class="tblw" style="margin-top:48px"><div class="rx-head"><h2 class="sec" style="margin:0">Антидоты семестра</h2></div><div class="tbl"><table><thead><tr><th scope="col">Отравление</th><th scope="col">Антидот</th><th scope="col">Механизм</th><th scope="col">Лист</th></tr></thead><tbody>${ANTIDOTES.map(r=>`<tr><td>${r[0]}</td><td style="color:var(--ink)">${r[1]}</td><td>${r[2]}</td><td><a href="#${P.find(p=>p.roman===r[3]).id}">${r[3]}</a></td></tr>`).join('')}</tbody></table></div></section>
  <p class="note">Материал для подготовки к занятиям. Дозы и показания сверяйте с инструкциями к препаратам и действующими клиническими рекомендациями.</p>`;
  HOMEREFRESH=()=>{ const el=$('#today'); if(el) el.outerHTML=todayHTML(); };
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
  $('#page').innerHTML=`<header><p class="eyebrow">Все препараты · ${UNI.length}</p><h1 class="title">Все препараты</h1><p class="lead">Каждый препарат из конспектов и подробных листов. Нажмите на название — откроется одна карточка: дозировка и форма выпуска, зачем выписывают, побочные эффекты, противопоказания, формулировки и действие на организм.</p></header>
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

const TR_STEMS=[],TR_ANTI=[],TR_CAUSE=[],TR_COMBO=[];
/* ===== Тренажёры: суффиксы МНН, антидоты, «что вызывает», опасные сочетания ===== */
const TR_KEY='atlas-train-v1';
const trLoad=()=>{ try{ return JSON.parse(localStorage.getItem(TR_KEY)||'{}')||{}; }catch(e){ return {}; } };
const trSave=o=>{ try{ localStorage.setItem(TR_KEY, JSON.stringify(o)); }catch(e){} };
const trShuf=a=>{ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
const trPick=a=>a[Math.floor(Math.random()*a.length)];
const trSplit=s=>String(s||'').split(/,\s*/).map(x=>x.trim()).filter(Boolean);
/* название → кнопка досье, если препарат есть в атласе */
const trDn=n=>{ const e=uFind(n); return e?`<button type="button" class="tr-dn" data-dr="${esc(e.n)}">${esc(n)}</button>`:`<span class="tr-nd">${esc(n)}</span>`; };
const trDnList=s=>trSplit(s).map(trDn).join(', ');
const TRS=[
  {id:'stem', t:'Суффиксы МНН', s:'По окончанию названия — группа препарата', n:()=>TR_STEMS.length, u:'основ'},
  {id:'anti', t:'Антидоты', s:'Отравления и передозировки: что ввести и почему', n:()=>TR_ANTI.length, u:'ситуаций'},
  {id:'cause', t:'Что вызывает…', s:'Гиперкалиемия, удлинение QT, агранулоцитоз, бронхоспазм…', n:()=>TR_CAUSE.length, u:'эффектов'},
  {id:'combo', t:'Опасные сочетания', s:'Серотониновый и «сырный» синдромы, варфарин, дигоксин…', n:()=>TR_COMBO.length, u:'сочетаний'}
];
/* ---------- вопросы ---------- */
function trOpts(ok, pool, n){ const seen=new Set([ok]); const out=[]; trShuf(pool).forEach(x=>{ if(out.length<(n||3) && !seen.has(x)){ seen.add(x); out.push(x); } }); return out; }
function trMk(q, ok, wrong, why){ if(wrong.length<2) return null; const opts=trShuf([ok].concat(wrong)); return {q, opts, ok:opts.indexOf(ok), why}; }
const TRQ={
  stem(){ const s=trPick(TR_STEMS); const groups=TR_STEMS.filter(x=>x[1]!==s[1]).map(x=>x[1]); const t=Math.random();
    const why=`<b>${esc(s[0])}</b> — ${esc(s[1])}: ${s[2].map(trDn).join(', ')}.${s[3]?' '+esc(s[3][0].toUpperCase()+s[3].slice(1))+'.':''}`;
    if(t<.45){ const d=trPick(s[2]); return trMk(`<b>${esc(d)}</b> — к какой группе относится?`, s[1], trOpts(s[1],groups), why); }
    if(t<.7) return trMk(`Окончание <b>${esc(s[0])}</b> — это…`, s[1], trOpts(s[1],groups), why);
    const d=trPick(s[2]); const other=TR_STEMS.filter(x=>x!==s).flatMap(x=>x[2]); return trMk(`Какой препарат относится к группе «${esc(s[1])}»?`, d, trOpts(d,other), why); },
  anti(){ const a=trPick(TR_ANTI); const why=`<b>${esc(a.x)}</b> → ${esc(a.a||a.k)}. ${esc(a.m)}`;
    if(Math.random()<.65){ const bad=new Set([a.k].concat(a.ok||[])); const pool=TR_ANTI.map(x=>x.k).filter(k=>!bad.has(k)); return trMk(`${a.xd&&a.xd.length&&Math.random()<.5?`Передозировка: <b>${esc(trPick(a.xd))}</b> (${esc(a.x.toLowerCase())})`:`Отравление: <b>${esc(a.x)}</b>`}. Что ввести?`, a.k, trOpts(a.k,pool), why); }
    const pool=TR_ANTI.filter(x=>x.k!==a.k && !(x.ok||[]).includes(a.k) && !(a.ok||[]).includes(x.k)).map(x=>x.x); return trMk(`<b>${esc(a.k)}</b> — антидот при…`, a.x, trOpts(a.x,pool), why); },
  cause(){ const c=trPick(TR_CAUSE);
    if(Math.random()<.65){ const g=trPick(c.d); const d=trPick(trSplit(g[1])); const why=`<b>${esc(c.e)}</b>: ${c.d.map(x=>esc(x[0])).join('; ')}. ${esc(d)} — ${esc(g[0].toLowerCase())}${g[2]?': '+esc(g[2]):''}.`;
      return trMk(`Что из этого может вызвать: <b>${esc(c.e.toLowerCase())}</b>?`, d, trOpts(d,c.no), why); }
    const g=trPick(c.d); const d=trPick(trSplit(g[1])); const not=TR_CAUSE.filter(x=>x!==c && x.no.includes(d)).map(x=>x.e);
    return trMk(`<b>${esc(d)}</b> может вызвать…`, c.e, trOpts(c.e,not), `${esc(d)} — ${esc(g[0].toLowerCase())}${g[2]?': '+esc(g[2]):''}.`) || TRQ.cause(); },
  combo(){ const c=trPick(TR_COMBO); const bad=new Set([c.r].concat(c.also||[])); const pool=[...new Set(TR_COMBO.map(x=>x.r))].filter(r=>!bad.has(r));
    return trMk(`Чем опасно сочетание: <b>${esc(c.a)}</b> + <b>${esc(c.b)}</b>?`, c.r, trOpts(c.r,pool), `${esc(c.m)} ${esc(c.w)}`); }
};
function trGen(id, n){ const out=[], keys=new Set(); let guard=0; const ids=id==='mix'?['stem','anti','cause','combo']:[id];
  while(out.length<n && guard++<n*30){ const q=TRQ[ids[out.length%ids.length]](); if(!q) continue; const k=q.q+'|'+q.opts[q.ok]; if(keys.has(k)) continue; keys.add(k); out.push(q); }
  return out; }
/* ---------- тест ---------- */
function trQuiz(box, id, qs){
  let i=0, ok=0, done=false; const miss=[];
  const draw=()=>{ const q=qs[i]; done=false;
    box.innerHTML=`<div class="tq" tabindex="-1"><div class="tq-top"><span>Вопрос ${i+1} из ${qs.length}</span><span class="tq-sc">Верно: ${ok}</span></div><div class="tq-bar"><i style="width:${(i/qs.length*100).toFixed(1)}%"></i></div>
      <h3 class="tq-q">${q.q}</h3><div class="tq-o">${q.opts.map((o,j)=>`<button type="button" class="tq-b" data-o="${j}"><kbd>${j+1}</kbd><span>${esc(o)}</span></button>`).join('')}</div><div class="tq-f" aria-live="polite"></div></div>`;
    const f=box.querySelector('.tq'); if(f) f.focus({preventScroll:true}); };
  const answer=j=>{ if(done) return; done=true; const q=qs[i]; const good=j===q.ok; if(good) ok++; else miss.push(q);
    box.querySelectorAll('.tq-b').forEach((b,k)=>{ b.disabled=true; if(k===q.ok) b.classList.add('ok'); else if(k===j) b.classList.add('no'); });
    box.querySelector('.tq-sc').textContent='Верно: '+ok;
    box.querySelector('.tq-f').innerHTML=`<p class="tq-v ${good?'ok':'no'}">${good?'Верно.':'Неверно. Правильно: '+esc(q.opts[q.ok])}</p><p class="tq-why">${q.why}</p><button type="button" class="btn pri tq-n" data-next="1">${i+1<qs.length?'Дальше →':'Результат'}</button>`;
    box.querySelector('[data-next]').focus({preventScroll:true}); };
  const fin=()=>{ const st=trLoad(); const r=st[id]||{}; r.last=[ok,qs.length]; r.best=Math.max(r.best||0, Math.round(ok/qs.length*100)); r.n=(r.n||0)+1; st[id]=r; trSave(st);
    const pct=Math.round(ok/qs.length*100);
    box.innerHTML=`<div class="tq tq-end"><p class="eyebrow">Результат</p><h3 class="tq-res">${ok} из ${qs.length} · ${pct}%</h3><p class="tq-note">${pct>=90?'Отлично — можно переходить к другому тренажёру.':pct>=70?'Хорошо. Повторите ошибки — они ниже.':'Откройте справочник и повторите ошибки.'}</p>
      ${miss.length?`<div class="tq-miss"><p class="kp-h">Ошибки · ${miss.length}</p>${miss.map(q=>`<div class="tq-m"><p>${q.q}</p><p><b>${esc(q.opts[q.ok])}</b></p><p class="tq-why">${q.why}</p></div>`).join('')}</div>`:''}
      <div class="tq-a">${miss.length?`<button type="button" class="btn pri" data-again="miss">Повторить ошибки · ${miss.length}</button>`:''}<button type="button" class="btn${miss.length?'':' pri'}" data-again="new">Новый тест · 10</button></div></div>`;
    box.querySelector('[data-again]').focus({preventScroll:true}); };
  box.onclick=e=>{ const b=e.target.closest('[data-o]'); if(b){ answer(+b.dataset.o); return; }
    if(e.target.closest('[data-next]')){ i++; if(i<qs.length) draw(); else fin(); return; }
    const a=e.target.closest('[data-again]'); if(a){ const nq=a.dataset.again==='miss'?trShuf(miss.map(q=>{ const opts=trShuf(q.opts); return {q:q.q, opts, ok:opts.indexOf(q.opts[q.ok]), why:q.why}; })):trGen(id,10); trQuiz(box,id,nq); } };
  document.onkeydown=e=>{ if(!document.body.contains(box)){ document.onkeydown=null; return; } if(e.target.closest&&e.target.closest('input,textarea,select')) return; if(!document.getElementById('dz').hidden) return;
    const n=parseInt(e.key,10); if(!done && n>=1 && n<=4 && qs[i] && n<=qs[i].opts.length){ e.preventDefault(); answer(n-1); return; }
    if(done && (e.key==='Enter'||e.key===' ') && !(e.target.closest&&e.target.closest('button'))){ e.preventDefault(); const nx=box.querySelector('[data-next]'); if(nx) nx.click(); } };
  draw();
}
/* ---------- справочники ---------- */
function trRef(id, q){ const v=key(q||'').replace(/ё/g,'е'); const hit=(...xs)=>!v||xs.some(x=>key(plain(String(x))).replace(/ё/g,'е').includes(v));
  if(id==='stem'){ const L=TR_STEMS.filter(s=>hit(s[0],s[1],s[2].join(' '),s[3]));
    return L.length?`<div class="tr-grid tr-stems">${L.map(s=>`<div class="tr-c"><p class="tr-st">${esc(s[0])}</p><p class="tr-g">${esc(s[1])}</p><p class="tr-ex">${s[2].map(trDn).join(', ')}</p>${s[3]?`<p class="tr-note">${esc(s[3])}</p>`:''}</div>`).join('')}</div>`:''; }
  if(id==='anti'){ const L=TR_ANTI.filter(a=>hit(a.x,a.k,a.a,a.m,(a.xd||[]).join(' ')));
    return L.length?`<div class="tr-list">${L.map(a=>`<div class="tr-row"><div class="tr-x"><b>${esc(a.x)}</b>${a.xd&&a.xd.length?`<span>${a.xd.map(trDn).join(', ')}</span>`:''}</div><div class="tr-k"><p class="tr-ar">→ <b>${esc(a.k)}</b></p>${a.a?`<p>${esc(a.a)}</p>`:''}<p class="tr-note">${esc(a.m)}</p></div></div>`).join('')}</div>`:''; }
  if(id==='cause'){ const L=TR_CAUSE.filter(c=>hit(c.e,c.d.map(x=>x.join(' ')).join(' ')));
    return L.length?`<div class="tr-grid tr-cause">${L.map(c=>`<div class="tr-c"><p class="tr-e">${esc(c.e)}</p><ul>${c.d.map(x=>`<li><b>${esc(x[0])}</b>: ${trDnList(x[1])}${x[2]?` <small>— ${esc(x[2])}</small>`:''}</li>`).join('')}</ul></div>`).join('')}</div>`:''; }
  if(id==='combo'){ const L=TR_COMBO.filter(c=>hit(c.a,c.b,c.r,c.m,c.w));
    return L.length?`<div class="tr-list">${L.map(c=>`<div class="tr-row tr-cb"><div class="tr-x"><b>${esc(c.a)}</b><span class="tr-plus">+</span><b>${esc(c.b)}</b></div><div class="tr-k"><p class="tr-ar">→ <b>${esc(c.r)}</b></p><p>${esc(c.m)}</p><p class="tr-note">${esc(c.w)}</p></div></div>`).join('')}</div>`:''; }
  return '';
}
const trScore=id=>{ const r=trLoad()[id]; return r&&r.last?`последний тест ${r.last[0]}/${r.last[1]} · лучший ${r.best}%`:'тест ещё не пройден'; };
EXTRA.routes.train=function(A0,arg){renderLockedPlate({mod:'kon',roman:'',title:'Тренажёры'});return;
  const page=$('#page'); const [id,mode0]=String(arg||'').split('/'); const T=TRS.find(x=>x.id===id);
  if(!T){
    page.innerHTML=`<header><p class="eyebrow">Тренажёры · ${TRS.reduce((s,t)=>s+t.n(),0)} карточек</p><h1 class="title">Тренажёры</h1><p class="lead">Короткие тесты по 10 вопросов на то, что чаще всего спрашивают устно: группа по названию, антидот, побочный эффект, опасное сочетание. В каждом — справочник для повторения.</p></header>
    <div class="tr-hub">${TRS.map(t=>`<a class="tr-tile" href="#train/${t.id}"><b>${t.t}</b><span>${t.s}</span><small>${t.n()} ${t.u} · ${trScore(t.id)}</small></a>`).join('')}</div>
    <div class="tr-mix"><div><b>Сборный тест</b><span>10 вопросов из всех четырёх тренажёров</span></div><a class="btn pri" href="#train/mix/test">▶ Начать</a></div>
    <p class="note">Справочники собраны по лекциям и учебникам фармакологии. Названия, которые есть в атласе, открывают карточку препарата.</p>`;
    return; }
  const mode=mode0==='test'?'test':'ref';
  if(id==='mix'){ page.innerHTML=`<header><p class="eyebrow"><a href="#train">Тренажёры</a> · сборный тест</p><h1 class="title">Сборный тест</h1></header><div id="trbox"></div>`; trQuiz($('#trbox'),'mix',trGen('mix',10)); return; }
  page.innerHTML=`<header><p class="eyebrow"><a href="#train">Тренажёры</a> · ${T.n()} ${T.u}</p><h1 class="title">${T.t}</h1><p class="lead">${T.s}. ${trScore(T.id)[0].toUpperCase()+trScore(T.id).slice(1)}.</p></header>
    <div class="l-tabs" role="tablist"><a role="tab" href="#train/${id}" aria-selected="${mode==='ref'}">Справочник</a><a role="tab" href="#train/${id}/test" aria-selected="${mode==='test'}">Тест · 10 вопросов</a></div>
    <div id="trbox"></div>`;
  const box=$('#trbox');
  if(mode==='test'){ trQuiz(box,id,trGen(id,10)); return; }
  box.innerHTML=`<div class="tr-f"><label class="tr-q"><span class="sr">Фильтр</span><input type="search" id="trq" placeholder="${id==='stem'?'Суффикс, группа или препарат':id==='anti'?'Яд, препарат или антидот':id==='cause'?'Эффект или препарат':'Препарат или последствие'}" autocomplete="off"></label><a class="btn pri" href="#train/${id}/test">▶ Тест</a></div><div id="trref"></div>`;
  const draw=()=>{ const h=trRef(id,$('#trq').value); $('#trref').innerHTML=h||'<p class="tr-none">Ничего не найдено.</p>'; };
  $('#trq').addEventListener('input',draw); draw();
};
window.__TR={TR_STEMS,TR_ANTI,TR_CAUSE,TR_COMBO,trGen};

/* ===== Польза и вред по органам: карта эффектов препарата ===== */
const FXO=[
  ['cns','Нервная система и психика',96,26],['eye','Глаза',121,44],['mouth','Рот, железы, пот',96,57],
  ['resp','Дыхание',80,108],['heart','Сердце',115,117],['vessels','Сосуды и АД',163,150],['blood','Кровь и свёртывание',37,150],
  ['liver','Печень',80,150],['gi','ЖКТ',113,160],['endo','Обмен и гормоны',87,186],['kidney','Почки и мочевыделение',124,198],
  ['repro','Половая система, беременность',100,224],['skin','Кожа и аллергия',30,214],['musc','Мышцы, кости, суставы',78,296],['other','Прочее',0,0]
];
const FXN=Object.fromEntries(FXO.map(o=>[o[0],o[1]]));
/* порядок важен: первое совпадение выигрывает */
const FXR=[
  ['liver',/портальн|вен пищевод/],
  ['skin',/мимо вены|некроз|гирсут|огрубен|месте (?:инъекц|введен)|анафилак|ангионевр|квинке|крапивниц|аллерг|сыпь|сыпи|зуд|фотосенс|фотодерм|дерматит|экзем|алопец|облысен|акне|угрев|псориаз|кожн|кожи|гиперчувствит/],
  ['eye',/(?:^|[^а-яa-z0-9])вгд(?![а-яa-z0-9])|глаз|глауком|мидриаз|миоз|зрачк|аккомодац|зрени|внутриглаз|конъюнктив|роговиц|ксантопс|катаракт|светобоязн|офтальм/],
  ['mouth',/сухость слизист|сухост\S* во рту|сухость рта|во рту|слюн|саливац|потлив|потоотдел|(?:^|[^а-яa-z0-9])пот(?![а-яa-z0-9])|привкус|вкус|стоматит|глоссит|десн/],
  ['resp',/назофар|фаринг|грипп|орви|простуд|бронх|астм|хобл|дыхан|кашл|кашел|легк|апноэ|ринит|насморк|мокрот|пневмон|носов|гортан|ларинг|отек легк|асфикс/],
  ['heart',/ав-провод|ав провод|(?:^|[^а-яa-z0-9])окс(?![а-яa-z0-9])|(?:^|[^а-яa-z0-9])сн(?![а-яa-z0-9])|(?:^|[^а-яa-z0-9])ссн(?![а-яa-z0-9])|серд|тахикард|брадикард|аритм|экстрасист|ав-блок|ав блок|атриовентр|синусов|стенокард|ишеми|инфаркт|(?:^|[^а-яa-z0-9])ибс(?![а-яa-z0-9])|(?:^|[^а-яa-z0-9])qt(?![а-яa-z0-9])|(?:^|[^а-яa-z0-9])хсн(?![а-яa-z0-9])|фибрилляц|трепетан|инотроп|(?:^|[^а-яa-z0-9])чсс(?![а-яa-z0-9])|миокард|коронар|асистол|пируэт|кардио/],
  ['blood',/гемолит|(?:^|[^а-яa-z0-9])двс(?![а-яa-z0-9])|агранулоц|лейкопен|тромбоцитопен|анеми|кровотеч|геморраг|тромбоз|тромбоэмбол|тромбофлеб|(?:^|[^а-яa-z0-9])тэла(?![а-яa-z0-9])|гемолиз|свертыв|свёртыв|(?:^|[^а-яa-z0-9])мно(?![а-яa-z0-9])|нейтропен|кроветвор|метгемоглоб|гематом|антикоаг|антиагрег|агрегац|эритроп|гранулоцит|панцитоп|лейкоц|тромбоц|фибрин/],
  ['liver',/билируб|печен|гепат|желтух|трансамин|холестаз|(?:^|[^а-яa-z0-9])алт(?![а-яa-z0-9])|(?:^|[^а-яa-z0-9])аст(?![а-яa-z0-9])|цирроз|желч/],
  ['gi',/токсикоинф|отравлен|живот|желуд|кишеч|тошнот|рвот|диаре|понос|запор|диспепс|язв|изжог|метеоризм|гастр|(?:^|[^а-яa-z0-9])жкт(?![а-яa-z0-9])|пищевод|эпигастр|панкреат|колит|энтер|дисбакт|аппетит|анорекс|икота|икоте|икоту/],
  ['kidney',/дизури|почеч|почк|нефр|мочеиспуск|задержк\S* моч|недержан|энурез|диурез|полиури|цистит|простат|мочев|(?:^|[^а-яa-z0-9])мвп(?![а-яa-z0-9])|кристаллур|гематур/],
  ['endo',/[↑↓] ?k⁺|[↑↓] ?na⁺|метаболическ|гипогликем|гипергликем|глюкоз|гликем|сахарн|диабет|инсулин|калием|кали[йя](?![а-яa-z0-9])|натри|кальци|магни|фосфат|липид|холестер|триглицер|лпнп|лпвп|масс\S* тела|веса|ожирен|пролакт|гинекомаст|галакторе|щитовид|тиреот|тирео|гормон|кортико|ацидоз|алкалоз|электролит|мочев\S* кислот|урикем|подагр|обмен|надпочеч|гипергидр/],
  ['repro',/эрект|либидо|потенц|матк|родов|роды|беремен|плод|тератоген|лактац|менстру|аменоре|бесплод|эякул|полов|контрацеп|яичник|эндометр|овуляц|климакт/],
  ['musc',/декураризац|нервно-мышечн|остеомаляц|рахит|мышц|миалг|миасте|мышечн|кост|остеопор|перелом|сустав|артрит|артралг|сухожил|тендин|ревмат|рабдомиол|миорелакс|остеоарт|спондил|радикул|люмбаго|ригидн|судорог\S* мышц/],
  ['vessels',/(?:^|[^а-яa-z0-9])опс(?![а-яa-z0-9])|(?:^|[^а-яa-z0-9])опсс(?![а-яa-z0-9])|(?:^|[^а-яa-z0-9])гк(?![а-яa-z0-9])|гипотони|гипотенз|гипертенз|артериальн|(?:^|[^а-яa-z0-9])ад(?![а-яa-z0-9])|давлен|ортостат|коллапс|(?:^|[^а-яa-z0-9])шок|вазо|сосуд|прилив|покраснен|гиперемия лица|рейно|конечност|отек|отёк|гипертонич|венозн|варикоз|геморро|кровообр|перфуз/],
  ['cns',/агресс|психотич|психиатр|кататон|(?:^|[^а-яa-z0-9])окр(?![а-яa-z0-9])|онемен|парестез|никотин|курен|приступ|тонико|клонич|серотонин|(?:^|[^а-яa-z0-9])дцп(?![а-яa-z0-9])|склероз|мышлен|речи|речь|подбора слов|цнс|сонлив|седац|седатив|головокруж|головн|мигрен|судорог|эпилеп|тревог|страх|паник|депресс|психоз|галлюцин|бессонн|(?:^|[^а-яa-z0-9])сон|сна(?![а-яa-z0-9])|снотвор|бред|возбужд|ажитац|спутан|делир|памят|когнит|деменц|паркинс|экстрапирам|тремор|дискинез|дистони|акатиз|(?:^|[^а-яa-z0-9])бол(?:ь|и|ей|ям|ями|ях|евой|евого|евые|евых|евым|евому)(?![а-я])|анальг|наркоз|анестез|абстинен|зависим|эйфори|шизофрен|маниак|биполяр|невроз|астени|утомляем|слабост|кошмар|нейропат|полинейр|паралич|парез|невралг|энцефал|(?:^|[^а-яa-z0-9])кома|ступор|лихорад|жар|температур|синдром отмены|рвотн\S* центр|укачив|вертиго|атакси|раздражит|нервоз|апати|абул|мозг|ликвор|паническ|расстройств|алкоголизм|трезв|детокс|акинет|навязч|обсесс|компульс|аутизм|сдвг|гиперактив|нарколеп|опиоидн|ломк|наркот/]
];
const fxLk=s=>key(s).replace(/ё/g,'е').replace(/[^а-яa-z0-9]/g,'');
const fxNorm=s=>plain(String(s||'')).toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ');
function fxOrg(name,why,fb){ const a=fxNorm(name), b=fxNorm(why); for(const [o,re] of FXR) if(re.test(a)) return o; for(const [o,re] of FXR) if(re.test(b)) return o; return fb||'other'; }
const FXSYS=s=>{ const t=fxNorm(s); if(/цнс|нервн|психик|вегетатив/.test(t)) return 'cns'; if(/глаз/.test(t)) return 'eye'; if(/желез|слюн|пот/.test(t)) return 'mouth'; if(/дыхан|легк|носа/.test(t)) return 'resp'; if(/^серд|ссс/.test(t)) return 'heart'; if(/сосуд|периферия/.test(t)) return 'vessels'; if(/кровь/.test(t)) return 'blood'; if(/печен/.test(t)) return 'liver'; if(/жкт|поджелуд|газов/.test(t)) return 'gi'; if(/почк|моч|водн/.test(t)) return 'kidney'; if(/обмен|эндокр|надпоч|щитов|паращит/.test(t)) return 'endo'; if(/матк|полов|плод/.test(t)) return 'repro'; if(/кож|слизист|иммун|воспал/.test(t)) return 'skin'; if(/мышц|кост/.test(t)) return 'musc'; return 'other'; };
const FXTOK=/(β₁|β₂|β₃|α₁|α₂|[MМ][₁₂₃]|[MМ]-холино|[HН][₁₂]|D₂|D₁|5-HT\S{0,3}|ЦОГ-?[12]|μ-|κ-|ГАМК|Na⁺|K⁺|Ca²⁺)/g;
const fxTokNorm=t=>t.replace(/^М/,'M').replace(/^Н(?=[₁₂])/,'H').replace(/-холино$/,'').replace(/-$/,'').replace(/^ЦОГ(\d)/,'ЦОГ-$1');
function fxData(e){
  if(e._fx!==undefined) return e._fx;
  const O={}; const get=o=>O[o]||(O[o]={g:[],b:[],a:[]});
  const push=(kind,name,why,k)=>{ const n=uClean(name); if(!n) return; const w=uClean(why||''); const o=fxOrg(n,w); const L=get(o)[kind];
    const ln=fxLk(n); const ex=L.find(x=>{ const lx=fxLk(x.n); if(lx===ln) return true; const [a,b]=lx.length<ln.length?[lx,ln]:[ln,lx]; return a.length>=8 && b.startsWith(a.slice(0,-2)); });
    if(ex){ if(n.length>ex.n.length) ex.n=n; if(!ex.w&&w) ex.w=w; if(k) ex.k=1; return; } L.push({n,w,k:k?1:0}); };
  const each=(arr,kind,k)=>(arr||[]).forEach(x=>{ if(Array.isArray(x)) push(kind,x[0],x[1],k); else { const s=String(x); const i=s.indexOf(' — '); if(i>0) push(kind,s.slice(0,i),s.slice(i+3),k); else push(kind,s,'',k); } });
  each(uCardsF(e,'pok'),'g',1); each(e.x&&e.x.i,'g'); each(e.d&&e.d.i,'g');
  e.rx.forEach(r=>r.head.forEach((h,i)=>{ if(/Показ/i.test(h)&&r.vals[i]) String(plain(r.vals[i])).split(/;\s*/).forEach(s=>push('g',s,'')); }));
  each(uCardsF(e,'pe'),'b',1); each(e.x&&e.x.a,'b'); each(e.d&&e.d.a,'b');
  if(e.d&&e.d.s) Object.keys(e.d.s).forEach(sys=>{ if(/взаимодейств|алкогол|длительн/i.test(sys)) return; const fb=FXSYS(sys); (e.d.s[sys]||[]).forEach(st=>{ const t=uClean(st); if(!t) return; const o=fxOrg(t,'',fb); const L=get(o==='other'?fb:o).a; if(!L.includes(t)) L.push(t); }); });
  const ids=FXO.map(o=>o[0]).filter(o=>O[o]&&(O[o].g.length||O[o].b.length||O[o].a.length));
  const ng=ids.reduce((s,o)=>s+O[o].g.length,0), nb=ids.reduce((s,o)=>s+O[o].b.length,0);
  /* одна мишень — разные органы */
  const T={}; const tk=(txt,o,kind,label)=>{ const m=String(txt||'').match(FXTOK); if(!m) return; [...new Set(m.map(fxTokNorm))].forEach(t=>{ const r=T[t]||(T[t]={g:[],b:[],a:[]}); if(!r[kind].some(x=>x.n===label)) r[kind].push({n:label,o}); }); };
  ids.forEach(o=>{ O[o].g.forEach(x=>tk(x.n+' '+x.w,o,'g',x.n)); O[o].b.forEach(x=>tk(x.n+' '+x.w,o,'b',x.n)); O[o].a.forEach(s=>tk(s,o,'a',s)); });
  const toks=Object.keys(T).map(t=>({t,...T[t],orgs:new Set([...T[t].g,...T[t].b,...T[t].a].map(x=>x.o))})).filter(x=>x.orgs.size>=2||(x.b.length&&(x.g.length||x.a.length))).sort((a,b)=>(b.b.length+b.g.length+b.a.length)-(a.b.length+a.g.length+a.a.length)).slice(0,5);
  e._fx = ids.length&&(ng||nb) ? {O,ids,ng,nb,toks} : null; return e._fx;
}
function fxBodySVG(F,cls){
  const C=2*Math.PI*11;
  const spots=F.ids.filter(o=>o!=='other').map(o=>{ const [,nm,x,y]=FXO.find(z=>z[0]===o); const r=F.O[o]; const g=r.g.length, b=r.b.length, n=g+b;
    const gl=n?C*g/n:0; const tone=n?'':' fx-n0';
    return `<g class="fx-hs${tone}" data-fxo="${o}" tabindex="0" role="button" aria-label="${nm}: польза ${g}, побочные ${b}"><title>${nm}: польза ${g} · побочные ${b}</title><circle cx="${x}" cy="${y}" r="15" class="fx-halo"/><circle cx="${x}" cy="${y}" r="11" class="fx-bg"/>${n?`<circle cx="${x}" cy="${y}" r="11" class="fx-rb" transform="rotate(-90 ${x} ${y})"/>${g?`<circle cx="${x}" cy="${y}" r="11" class="fx-rg" stroke-dasharray="${gl.toFixed(2)} ${C.toFixed(2)}" transform="rotate(-90 ${x} ${y})"/>`:''}`:''}<text x="${x}" y="${y+4}">${n||'•'}</text></g>`; }).join('');
  return `<svg class="fx-body${cls?' '+cls:''}" viewBox="0 0 200 360" aria-hidden="false" role="group" aria-label="Схема тела: где польза и где побочные эффекты">
    <g class="fx-sil" aria-hidden="true"><circle cx="100" cy="36" r="25"/><rect x="91" y="58" width="18" height="14" rx="5"/><path d="M60 74 Q100 64 140 74 Q150 78 148 96 L146 188 Q100 204 54 188 L52 96 Q50 78 60 74Z"/><path d="M54 186 Q100 206 146 186 L142 228 Q100 240 58 228Z"/>
    <path class="fx-limb" d="M57 86 L41 150 L33 220"/><path class="fx-limb" d="M143 86 L159 150 L167 220"/><path class="fx-limb fx-leg" d="M80 228 L77 290 L75 346"/><path class="fx-limb fx-leg" d="M120 228 L123 290 L125 346"/></g>${spots}</svg>`;
}
function fxRows(F,open){
  const li=(x,k)=>`<li class="${k}${x.k?' fx-k':''}"><span>${esc(x.n)}</span>${x.w?`<small>${esc(x.w)}</small>`:''}</li>`;
  return F.ids.map(o=>{ const r=F.O[o]; const g=r.g.length, b=r.b.length;
    return `<div class="fx-r" data-fxo="${o}"><div class="fx-rh"><span class="fx-on">${FXN[o]}</span><span class="fx-ct">${g?`<i class="g">+${g}</i>`:''}${b?`<i class="b">−${b}</i>`:''}</span></div>
      ${g||b?`<div class="fx-cols">${g?`<ul class="fx-g" aria-label="Польза">${r.g.map(x=>li(x,'g')).join('')}</ul>`:'<ul class="fx-g fx-e"><li>—</li></ul>'}${b?`<ul class="fx-b" aria-label="Побочные">${r.b.map(x=>li(x,'b')).join('')}</ul>`:'<ul class="fx-b fx-e"><li>—</li></ul>'}</div>`:''}
      ${r.a.length?`<details class="fx-a"${open&&!g&&!b?' open':''}><summary>Как действует здесь · ${r.a.length}</summary><ul>${r.a.map(s=>`<li>${esc(s)}</li>`).join('')}</ul></details>`:''}</div>`; }).join('');
}
function fxToks(F){
  if(!F.toks.length) return '';
  const it=(x,k)=>`<li class="fx-t${k}"><em>${esc(FXN[x.o])}</em>${esc(x.n.length>110?x.n.slice(0,104).replace(/\s+\S*$/,'')+'…':x.n)}</li>`;
  return `<div class="fx-tk"><p class="kp-h">Одна мишень — разные органы</p>${F.toks.map(t=>`<div class="fx-tr"><b class="fx-t">${esc(t.t)}</b><ul>${t.g.map(x=>it(x,'g')).join('')}${t.a.map(x=>it(x,'a')).join('')}${t.b.map(x=>it(x,'b')).join('')}</ul></div>`).join('')}<p class="fx-tn">Через одну и ту же мишень препарат лечит в одном органе и даёт побочный эффект в другом.</p></div>`;
}
function fxHTML(e){
  const F=fxData(e); if(!F) return '';
  const n=F.ng+F.nb; const pg=(F.ng/n*100).toFixed(1);
  return `<section class="dz-sec u-sec u-fx"><h3>Польза и вред по органам</h3>
    <div class="fx-bal" role="img" aria-label="Польза: ${F.ng}, побочные эффекты: ${F.nb}"><span class="fx-bl g"><b>${F.ng}</b> польза — зачем назначают</span><span class="fx-bar"><i class="g" style="width:${pg}%"></i><i class="b" style="width:${(100-pg).toFixed(1)}%"></i></span><span class="fx-bl b"><b>${F.nb}</b> побочные — чем платим</span></div>
    <div class="fx-grid">${fxBodySVG(F)}<div class="fx-list">${fxRows(F,true)}</div></div>${fxToks(F)}${F.O&&F.ids.some(o=>[...F.O[o].g,...F.O[o].b].some(x=>x.k))?'<p class="fx-tn">Жирным — формулировки конспекта. Нажмите на точку на схеме, чтобы перейти к органу.</p>':'<p class="fx-tn">Нажмите на точку на схеме, чтобы перейти к органу.</p>'}</section>`;
}
/* мини-матрица для страницы сравнения */
function fxMatrix(L){
  const FS=L.map(fxData); if(FS.filter(Boolean).length<1) return '';
  const ids=FXO.map(o=>o[0]).filter(o=>FS.some(F=>F&&F.O[o]&&(F.O[o].g.length||F.O[o].b.length)));
  if(!ids.length) return '';
  const mx=Math.max(1,...ids.flatMap(o=>FS.map(F=>F&&F.O[o]?Math.max(F.O[o].g.length,F.O[o].b.length):0)));
  const cell=(F,o)=>{ const r=F&&F.O[o]; const g=r?r.g.length:0, b=r?r.b.length:0; if(!g&&!b) return '<td class="fx-m0">·</td>';
    const tip=r?[...r.g.map(x=>'+ '+x.n),...r.b.map(x=>'− '+x.n)].join('\n'):'';
    return `<td title="${esc(tip)}"><span class="fx-mb"><i class="g" style="--w:${(g/mx*100).toFixed(0)}%">${g||''}</i><i class="b" style="--w:${(b/mx*100).toFixed(0)}%">${b||''}</i></span></td>`; };
  return `<div class="bd-card fx-mx"><h3>Где польза и где вред</h3><p class="fx-mxn"><span class="fx-lg g"></span>польза — показания <span class="fx-lg b"></span>побочные эффекты · наведите на ячейку, чтобы увидеть список</p><div class="cm-w"><table class="fx-mt"><thead><tr><th></th>${L.map(e=>`<th>${esc(e.n)}</th>`).join('')}</tr></thead><tbody>${ids.map(o=>`<tr><th scope="row">${FXN[o]}</th>${FS.map(F=>cell(F,o)).join('')}</tr>`).join('')}</tbody></table></div></div>`;
}
/* взаимодействие: точка на схеме ↔ строка списка */
document.addEventListener('click',e=>{ const h=e.target.closest('.fx-hs'); if(!h) return; const box=h.closest('.u-fx'); if(!box) return; const r=box.querySelector(`.fx-r[data-fxo="${h.dataset.fxo}"]`); if(!r) return;
  box.querySelectorAll('.fx-r.fl').forEach(x=>x.classList.remove('fl')); r.classList.add('fl'); r.scrollIntoView({block:'nearest',behavior:'smooth'}); const d=r.querySelector('details'); if(d&&!r.querySelector('.fx-cols')) d.open=true; setTimeout(()=>r.classList.remove('fl'),1600); });
document.addEventListener('keydown',e=>{ if((e.key==='Enter'||e.key===' ')&&e.target.closest&&e.target.closest('.fx-hs')){ e.preventDefault(); e.target.closest('.fx-hs').dispatchEvent(new MouseEvent('click',{bubbles:true})); } });
const FXHOV=window.matchMedia?window.matchMedia('(hover: hover)'):null;
const fxHover=(e,on)=>{ if(FXHOV&&!FXHOV.matches) return; const r=e.target.closest&&e.target.closest('.fx-r,.fx-hs'); if(!r) return; const box=r.closest('.u-fx'); if(!box) return; const o=r.dataset.fxo; box.querySelectorAll(`[data-fxo="${o}"]`).forEach(x=>x.classList.toggle('on',on)); };
document.addEventListener('mouseover',e=>fxHover(e,true)); document.addEventListener('mouseout',e=>fxHover(e,false));
window.__FX={fxData,fxOrg};

/* ===== Удобство: сравнение, поиск по показаниям и п.э., шпаргалка, план до экзамена ===== */
const T_CMP='atlas-cmp';
const cmpGet=()=>{ try{ const a=JSON.parse(localStorage.getItem(T_CMP)||'[]'); return Array.isArray(a)?a.filter(n=>uFind(n)):[]; }catch(e){ return []; } };
const cmpSet=a=>{ try{ localStorage.setItem(T_CMP, JSON.stringify(a)); }catch(e){} };
const cmpHash=a=>'#cmp/'+a.map(encodeURIComponent).join('|');
const tLines=(arr,n)=>{ const out=[]; (arr||[]).forEach(x=>{ const s=uClean(Array.isArray(x)?x[0]:x); if(s && !out.some(y=>key(y)===key(s))) out.push(s); }); return n?out.slice(0,n):out; };
const tInd=e=>tLines([].concat(uCardsF(e,'pok'), e.x&&e.x.i||[], e.d&&e.d.i||[], e.rx.flatMap(r=>r.head.map((h,i)=>/Показ/i.test(h)?r.vals[i]:null).filter(Boolean))));
const tAe=e=>tLines([].concat(uCardsF(e,'pe'), e.x&&e.x.a||[], e.d&&e.d.a||[]));
const tMech=e=>{ const m=e.d&&e.d.m; return m&&m.length?tLines(m,4):tLines(uCardsF(e,'f'),4); };
const tGroup=e=>e.groups.length?tLines(e.groups.map(g=>g.g),2):(e.d?[e.d.g]:[]);
const tForm=e=>{ const r=e.rx[0]; let out; if(r){ const iF=r.head.findIndex(h=>/Форма/i.test(h)); const iD=r.head.findIndex((h,i)=>i!==iF&&/Способ|доз/i.test(h)); out=[iF,iD].filter(i=>i>=0).map(i=>uClean(r.vals[i])); } else out=e.x?[e.x.f,e.x.d].map(uClean):[]; return out.filter((x,i,a)=>x&&a.findIndex(y=>key(y)===key(x))===i); };
const tShort=(x,n)=>{ const t=String(x); return t.length>n?t.slice(0,n-8).replace(/\s+\S*$/,'')+'…':t; };
const tRp=e=>{ const R=rpAll(e); return R.length?plain(R[0].l[0]).replace(/\s+/g,' ').trim():''; };
const tLat=e=>{ const r=e.rx.find(r=>/<i>/.test(r.vals.join(''))); if(r){ const m=r.vals.join(' ').match(/<i>([^<]+)<\/i>/); if(m) return m[1]; } return ''; };
/* ---------- сравнение ---------- */
const CMP_PRESETS=[['Пропранолол','Метопролол','Небиволол'],['Нифедипин','Верапамил','Амлодипин'],['Каптоприл','Эналаприл','Лозартан'],['Морфин','Фентанил','Трамадол'],['Ибупрофен','Диклофенак','Целекоксиб'],['Парацетамол','Метамизол натрия','Ацетилсалициловая кислота'],['Галоперидол','Хлорпромазин','Клозапин'],['Диазепам','Феназепам','Золпидем'],['Эпинефрин','Норэпинефрин','Добутамин'],['Атропин','Платифиллин','Ипратропия бромид'],['Лидокаин','Прокаин','Бупивакаин'],['Амитриптилин','Флуоксетин','Пирлиндол'],['Сальбутамол','Формотерол','Тиотропия бромид'],['Нитроглицерин','Изосорбида мононитрат','Ивабрадин']];
EXTRA.routes.cmp=function(A0,arg){
  let names=String(arg||'').split('|').map(s=>{ try{ return decodeURIComponent(s); }catch(e){ return s; } }).filter(Boolean);
  if(!names.length) names=cmpGet();
  const L=[]; names.forEach(n=>{ const e=uFind(n); if(e && !L.includes(e)) L.push(e); }); L.splice(4);
  cmpSet(L.map(e=>e.n));
  const presets=CMP_PRESETS.map(p=>p.map(uFind)).filter(p=>p.every(Boolean));
  const page=$('#page');
  const rows=[['Группа',e=>tGroup(e)],['Мишень',e=>e.d&&e.d.t?[e.d.t]:[]],['Механизм',tMech],['Зачем выписывают',e=>tInd(e).slice(0,7)],['Побочные эффекты',e=>tAe(e).slice(0,7)],['Противопоказания',e=>tLines(uCardsF(e,'pp').concat(e.d&&e.d.c?[e.d.c]:[]),4)],['Форма и доза',tForm],['Рецепт',e=>{ const r=tRp(e); return r?[r]:[]; }]];
  const cut=x=>{ const t=String(x); return t.length>260?t.slice(0,250).replace(/\s+\S*$/,'')+'… <span class="cm-more">(полностью — в карточке)</span>':t; };
  const cell=xs0=>{ const xs=xs0.map(cut); return xs.length?(xs.length===1?`<p>${xs[0]}</p>`:`<ul>${xs.map(x=>`<li>${x}</li>`).join('')}</ul>`):'<p class="cm-na">—</p>'; };
  const table = L.length>=1 ? `<div class="cm-w"><table class="cm" style="--n:${L.length}"><thead><tr><th scope="col"><span class="sr">Свойство</span></th>${L.map(e=>`<th scope="col"><div class="cm-h"><button type="button" class="cm-nm${e.hl?' kd hl-'+e.hl:''}" data-dr="${esc(e.n)}">${esc(e.n)}</button><button type="button" class="cm-x" data-cmprm="${esc(e.n)}" aria-label="Убрать ${esc(e.n)} из сравнения">×</button></div>${tLat(e)?`<small>${esc(tLat(e))}</small>`:''}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(([h,f])=>{ const vals=L.map(f); if(vals.every(v=>!v.length)) return ''; return `<tr class="cm-rh" aria-hidden="true"><td colspan="${L.length+1}">${h}</td></tr><tr><th scope="row">${h}</th>${vals.map(v=>`<td>${cell(v)}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div>` : '';
  page.innerHTML=`<header><p class="eyebrow">Сравнение · до 4 препаратов</p><h1 class="title">Сравнить препараты</h1><p class="lead">Группа, механизм, показания, побочные эффекты, форма и рецепт — рядом, чтобы увидеть, чем препараты отличаются. Добавить препарат можно здесь или кнопкой «Сравнить» в его карточке.</p></header>
  <div class="cm-add"><label class="tr-q"><span class="sr">Добавить препарат</span><input type="search" id="cmq" placeholder="${L.length>=4?'Уже 4 препарата — уберите один':'Добавить препарат: название'}" autocomplete="off"${L.length>=4?' disabled':''}></label><div class="cm-sug" id="cmsug"></div>${L.length?`<button type="button" class="btn" data-cmpclr="1">Очистить</button>`:''}</div>
  ${L.length===1?`<p class="cm-hint">Добавьте ещё один или два препарата.</p>`:''}
  ${L.length>=2?fxMatrix(L):''}${table}
  <div class="bd-card cm-pre"><h3>Готовые сравнения</h3><div class="bd-sugg">${presets.map(p=>`<a class="bd-chip" href="${cmpHash(p.map(e=>e.n))}">${p.map(e=>esc(e.n)).join(' · ')}</a>`).join('')}</div></div>`;
  const q=$('#cmq'), sug=$('#cmsug');
  q.addEventListener('input',()=>{ const v=key(q.value).replace(/ё/g,'е'); if(v.length<2){ sug.innerHTML=''; return; }
    const hits=UNI.filter(e=>!L.includes(e)).map(e=>{ const m=[e.n,...e.names].find(n=>key(n).replace(/ё/g,'е').includes(v)); return m?{e,st:key(m).replace(/ё/g,'е').startsWith(v)}:null; }).filter(Boolean).sort((a,b)=>(b.st-a.st)||a.e.n.localeCompare(b.e.n,'ru')).slice(0,8);
    sug.innerHTML=hits.length?hits.map(h=>`<button type="button" data-cmpadd2="${esc(h.e.n)}"><b>${esc(h.e.n)}</b><small>${esc(plain(tGroup(h.e)[0]||''))}</small></button>`).join(''):'<p class="tr-none">Не найдено</p>'; });
  q.addEventListener('keydown',e=>{ if(e.key==='Enter'){ const b=sug.querySelector('button'); if(b){ e.preventDefault(); b.click(); } } });
  page.onclick=e=>{ const a=e.target.closest('[data-cmpadd2]'); if(a){ location.hash=cmpHash(L.map(x=>x.n).concat(a.dataset.cmpadd2)); return; }
    const r=e.target.closest('[data-cmprm]'); if(r){ const nl=L.map(x=>x.n).filter(n=>n!==r.dataset.cmprm); cmpSet(nl); location.hash=nl.length?cmpHash(nl):'#cmp'; return; }
    if(e.target.closest('[data-cmpclr]')){ cmpSet([]); if(location.hash==='#cmp') route(); else location.hash='#cmp'; } };
  if(L.length<2 && L.length<4) setTimeout(()=>{ if(document.activeElement===document.body||!document.activeElement) q.focus({preventScroll:true}); },0);
};
document.addEventListener('click',e=>{ const b=e.target.closest('[data-cmpadd]'); if(!b) return; e.preventDefault(); e.stopPropagation(); const n=b.dataset.cmpadd; let a=cmpGet().filter(x=>x!==n); a.push(n); if(a.length>4) a=a.slice(-4); cmpSet(a); closeDz(true); location.hash=cmpHash(a); }, true);

/* ---------- поиск по показаниям, побочным эффектам, механизму ---------- */
const FIND_F=[['all','Везде'],['i','Показания'],['a','Побочные эффекты'],['m','Механизм и группа'],['c','Противопоказания, важно']];
let FIDX=null;
function findIdx(){ if(FIDX) return FIDX; const nz=s=>plain(String(s||'')).replace(/\s+/g,' ').trim();
  FIDX=UNI.map(e=>{ const f={i:[],a:[],m:[],c:[]}; const add=(k,arr)=>(arr||[]).forEach(x=>{ const s=nz(Array.isArray(x)?x.filter(Boolean).join(' — '):x); if(s && !f[k].includes(s)) f[k].push(s); });
    add('i',uCardsF(e,'pok')); add('i',e.x&&e.x.i); add('i',e.d&&e.d.i); add('i',e.rx.flatMap(r=>r.head.map((h,i)=>/Показ/i.test(h)?r.vals[i]:null).filter(Boolean)));
    add('a',uCardsF(e,'pe')); add('a',e.x&&e.x.a); add('a',e.d&&e.d.a);
    add('m',e.groups.map(g=>g.g)); add('m',e.d?[e.d.g,e.d.t]:[]); add('m',e.d&&e.d.m); add('m',uCardsF(e,'f')); if(e.d&&e.d.s) Object.keys(e.d.s).forEach(k=>add('m',e.d.s[k]));
    add('c',uCardsF(e,'pp')); add('c',e.d&&e.d.c?[e.d.c]:[]); add('c',e.d&&e.d.x?[e.d.x]:[]); add('c',e.cards.map(({c})=>c.x).filter(Boolean)); add('c',e.x&&e.x.n?[e.x.n]:[]);
    const low={}; Object.keys(f).forEach(k=>low[k]=f[k].map(s=>s.toLowerCase().replace(/ё/g,'е'))); return {e,f,low}; });
  return FIDX; }
const FEND=/(иями|ями|ами|ией|ием|иях|ия|ии|ию|ие|ей|ой|ый|ий|ая|яя|ое|ее|ые|ых|их|ым|им|ов|ев|ам|ям|ах|ях|ом|ем|ы|и|а|я|у|ю|е|о|ь)$/;
function findStems(q){ return String(q||'').toLowerCase().replace(/ё/g,'е').split(/[^a-zа-я0-9₂₁⁺]+/i).filter(w=>w.length>=2).map(w=>{ const s=w.replace(FEND,''); return s.length>=4?s:w; }); }
function findRun(q,field){ const st=findStems(q); if(!st.length) return [];
  const ks=field==='all'?['i','a','m','c']:[field]; const out=[];
  findIdx().forEach(x=>{ const hits=[]; let score=0;
    ks.forEach(k=>x.low[k].forEach((s,j)=>{ if(st.every(t=>s.includes(t))){ hits.push([k,x.f[k][j]]); score+= k==='m'?1:2; } }));
    if(hits.length){ if(st.every(t=>key(x.e.n).replace(/ё/g,'е').includes(t))) score+=3; out.push({e:x.e,hits,score:score+(x.e.hl?1:0)}); } });
  return out.sort((a,b)=>b.score-a.score||a.e.n.localeCompare(b.e.n,'ru')); }
const findMark=(s,st)=>{ let h=esc(s); st.forEach(t=>{ const re=new RegExp('('+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[а-яa-z]*)','gi'); h=h.replace(re,'<mark>$1</mark>'); }); return h; };
EXTRA.routes.find=function(A0,arg){
  let q0=''; try{ q0=decodeURIComponent(arg||''); }catch(e){ q0=arg||''; }
  const page=$('#page'); let field='all';
  page.innerHTML=`<header><p class="eyebrow">Поиск по содержанию</p><h1 class="title">Найти по показанию или побочному эффекту</h1><p class="lead">Ищет по показаниям, побочным эффектам, механизмам и противопоказаниям всех препаратов атласа. Например: «гиперкалиемия», «брадикардия», «бронхоспазм», «глаукома», «агранулоцитоз», «QT».</p></header>
  <div class="fd-f"><label class="tr-q"><span class="sr">Запрос</span><input type="search" id="fdq" value="${esc(q0)}" placeholder="Симптом, болезнь, эффект или мишень" autocomplete="off"></label></div>
  <div class="seg fd-s" role="group" aria-label="Где искать">${FIND_F.map(([k,t])=>`<button type="button" data-fd="${k}" aria-pressed="${k===field}">${t}<span class="fd-n"></span></button>`).join('')}</div>
  <p class="dbn" id="fdn" aria-live="polite"></p><div id="fdl"></div>
  <div class="bd-card fd-ex"><h3>Примеры запросов</h3><div class="bd-sugg">${['гиперкалиемия','удлинение QT','брадикардия','бронхоспазм','ортостатическая гипотензия','агранулоцитоз','глаукома','сухой кашель','гипогликемия','отёк лёгких','тремор','запор'].map(x=>`<button type="button" class="bd-chip" data-fdq="${esc(x)}">${esc(x)}</button>`).join('')}</div></div>`;
  const inp=$('#fdq'); const LAB={i:'Показания',a:'Побочные',m:'Механизм',c:'Важно'};
  const draw=()=>{ const q=inp.value.trim(); const st=findStems(q);
    if(st.length===0){ $('#fdn').textContent=''; $('#fdl').innerHTML=''; $$('.fd-n').forEach(x=>x.textContent=''); return; }
    FIND_F.forEach(([k],i)=>{ const n=findRun(q,k).length; $$('.fd-n')[i].textContent=n?' · '+n:''; });
    const R=findRun(q,field);
    $('#fdn').textContent=R.length?`Найдено препаратов: ${R.length}`:'Ничего не найдено — попробуйте другое слово или поле «Везде».';
    $('#fdl').innerHTML=R.slice(0,80).map(r=>{ const g=tGroup(r.e)[0]||''; const hs=r.hits.slice(0,3);
      return `<div class="fd-r"><button type="button" class="fd-nm${r.e.hl?' kd hl-'+r.e.hl:''}" data-dr="${esc(r.e.n)}">${esc(r.e.n)}</button><span class="fd-g">${esc(plain(g))}</span><ul>${hs.map(([k,s])=>`<li><i>${LAB[k]}</i>${findMark(s.length>220?s.slice(0,220)+'…':s,st)}</li>`).join('')}${r.hits.length>3?`<li class="fd-more">ещё совпадений: ${r.hits.length-3}</li>`:''}</ul><button type="button" class="fd-c" data-cmpadd="${esc(r.e.n)}" title="Добавить к сравнению">⇄</button></div>`; }).join('')+(R.length>80?`<p class="tr-none">Показаны первые 80. Уточните запрос.</p>`:'');
    try{ history.replaceState(null,'','#find/'+encodeURIComponent(q)); }catch(e){} };
  let tm=0; inp.addEventListener('input',()=>{ clearTimeout(tm); tm=setTimeout(draw,160); });
  page.addEventListener('click',e=>{ const b=e.target.closest('[data-fd]'); if(b){ field=b.dataset.fd; $$('.fd-s button').forEach(x=>x.setAttribute('aria-pressed',String(x===b))); draw(); return; }
    const x=e.target.closest('[data-fdq]'); if(x){ inp.value=x.dataset.fdq; draw(); inp.focus({preventScroll:true}); } });
  draw(); if(!q0) setTimeout(()=>inp.focus({preventScroll:true}),0);
};
res.addEventListener('click',e=>{ if(e.target.closest('a.s-find')){ q.value=''; res.innerHTML=''; menu(false); } });

/* ---------- шпаргалка лекции для печати ---------- */
EXTRA.routes.sheet=function(A0,arg){
  const page=$('#page'); const lecs=KP.filter(p=>lDeck(A0).some(it=>it.p===p.id));
  const p=BY[arg]&&isK(BY[arg])?BY[arg]:null;
  if(!p){ page.innerHTML=`<header><p class="eyebrow">Шпаргалки · ${lecs.length} ${plur(lecs.length,'лекция','лекции','лекций')}</p><h1 class="title">Шпаргалки для печати</h1><p class="lead">Все препараты лекции одной таблицей: группа, форма и доза, показания, побочные эффекты, рецепт. Печатайте на A4 или сохраняйте в PDF.</p></header>
    <div class="sh-lecs">${lecs.map(l=>`<a class="sh-lec" href="#sheet/${l.id}"><span class="roman">${l.roman}</span><span>${esc(l.title)}</span><small>${lDeck(A0).filter(it=>it.p===l.id).length}</small></a>`).join('')}</div>`; return; }
  let set=(()=>{ try{ return localStorage.getItem('atlas-sheet-set')||'yg'; }catch(e){ return 'yg'; } })();
  const all=lDeck(A0).filter(it=>it.p===p.id).sort((a,b)=>a.ord-b.ord);
  const draw=()=>{ const L=set==='all'?all:set==='y'?all.filter(it=>it.hl==='y'):all.filter(it=>it.hl);
    const row=it=>{ const e=it.e; const g=it.groups[0]||(e&&tGroup(e)[0])||''; const f=(e?tForm(e):(it.rx[0]?[it.rx[0].form,it.rx[0].dose].filter(Boolean):[])).map(x=>tShort(plain(x),170)); const ind=e?tInd(e).slice(0,3):[]; const ae=e?tAe(e).slice(0,3):[]; const rp=e?tRp(e):''; const lat=(it.rx[0]&&it.rx[0].la)||(e&&tLat(e))||'';
      return `<tr class="${it.hl?'hl-'+it.hl:''}"><td class="sh-n"><b>${esc(it.n)}</b>${lat?`<i>${esc(plain(lat))}</i>`:''}${it.hl?`<span class="sh-hl">${it.hl==='y'?'наизусть':'рецепт'}</span>`:''}</td><td>${esc(plain(g))}</td><td>${f.map(x=>esc(plain(x))).join('<br>')}</td><td>${ind.map(x=>esc(plain(x))).join('; ')}</td><td>${ae.map(x=>esc(plain(x))).join('; ')}</td><td class="sh-rp">${esc(rp)}</td></tr>`; };
    $('#shb').innerHTML=L.length?`<table class="sh"><thead><tr><th>Препарат</th><th>Группа</th><th>Форма, доза</th><th>Показания</th><th>Побочные эффекты</th><th>Rp.</th></tr></thead><tbody>${L.map(row).join('')}</tbody></table>`:'<p class="tr-none">В этом наборе нет препаратов.</p>';
    $('#shn').textContent=`${L.length} ${plur(L.length,'препарат','препарата','препаратов')}`; };
  page.innerHTML=`<header class="sh-hd"><p class="eyebrow"><a href="#sheet">Шпаргалки</a> · Конспект <span class="roman">${p.roman}</span> · <span id="shn"></span></p><h1 class="title">${esc(p.title)}</h1></header>
  <div class="sh-ctl"><div class="seg" role="group" aria-label="Набор"><button type="button" data-shs="yg" aria-pressed="${set==='yg'}">Жёлтые + зелёные</button><button type="button" data-shs="y" aria-pressed="${set==='y'}">Только жёлтые</button><button type="button" data-shs="all" aria-pressed="${set==='all'}">Все препараты</button></div><button type="button" class="btn pri" data-print="1">Печать / PDF</button><a class="btn" href="#${p.id}">К конспекту</a></div>
  <p class="sh-tip">Сохранить в PDF: «Печать» → принтер «Сохранить как PDF». Если окно печати не открылось — нажмите Ctrl+P (⌘P на Mac).</p>
  <div id="shb"></div>`;
  page.onclick=e=>{ const b=e.target.closest('[data-shs]'); if(b){ set=b.dataset.shs; try{ localStorage.setItem('atlas-sheet-set',set); }catch(x){} $$('[data-shs]').forEach(x=>x.setAttribute('aria-pressed',String(x===b))); draw(); return; }
    if(e.target.closest('[data-print]')){ try{ window.print(); }catch(x){} } };
  draw();
};

/* ---------- значки и пункты навигации ---------- */
ICO.train='<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.5"/><circle cx="10" cy="10" r="4"/><circle cx="10" cy="10" r=".9"/></svg>';
ICO.cmp='<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="3.5" width="6" height="13" rx="1.5"/><rect x="11.5" y="3.5" width="6" height="13" rx="1.5"/><path d="M4.5 7h2M4.5 10h2M13.5 7h2M13.5 10h2"/></svg>';
ICO.sheet='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2.5h7l3.5 3.5v11.5H5z"/><path d="M12 2.5V6h3.5M7.5 9.5h5M7.5 12h5M7.5 14.5h3"/></svg>';

/* ===== Анимации механизмов в конспектах: синапс, аксон, баланс O₂, каскады ===== */
const VZ_RM=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const VZ_SCENES={
 'k-pns':{k:'syn',t:'Холинергический синапс',m:'АХ',mn:'ацетилхолин',rc:'холинорецепторы',rm:'ache',pre:'Нервное окончание',post:'Клетка органа',modes:[
   ['Норма',{},'Импульс → выброс ацетилхолина → он активирует холинорецепторы и сразу разрушается ацетилхолинэстеразой (АХЭ).'],
   ['Пилокарпин',{ago:1},'М-холиномиметик сам активирует рецепторы — эффект как от избытка АХ: миоз, слюнотечение, брадикардия.'],
   ['Атропин',{ant:1},'М-холиноблокатор занимает рецепторы: АХ выделяется, но не действует — мидриаз, сухость во рту, тахикардия.'],
   ['Неостигмин',{eBlock:1},'Ингибитор холинэстеразы: АХ не разрушается, накапливается в щели и дольше активирует рецепторы.'],
   ['Ботулотоксин',{rel:.12},'Блокирует выброс АХ: рецепторы свободны, но активировать их нечем — паралич.']]},
 'k-adr':{k:'syn',t:'Адренергический синапс',m:'НА',mn:'норадреналин',rc:'адренорецепторы',rm:'mao',pre:'Симпатическое окончание',post:'Клетка органа',modes:[
   ['Норма',{},'Импульс → выброс норадреналина → активация α/β-рецепторов → обратный захват в окончание, часть разрушает МАО.'],
   ['Фенилэфрин',{ago:1},'Прямой α₁-адреномиметик сам активирует рецепторы.'],
   ['Пропранолол',{ant:1},'β-адреноблокатор занимает рецепторы: НА есть, но эффекта нет.'],
   ['Эфедрин',{leak:1},'Непрямой адреномиметик выталкивает НА из окончания даже без импульса.'],
   ['Кокаин, ТЦА',{tBlock:1},'Блок обратного захвата: НА задерживается в щели и дольше действует.'],
   ['Резерпин',{rel:.15},'Симпатолитик истощает запасы НА в пузырьках — выделять нечего.']]},
 'k-his':{k:'syn',t:'Гистамин и тучная клетка',m:'Г',mn:'гистамин',rc:'H₁-рецепторы',rm:'mao',pre:'Тучная клетка',post:'Клетка-мишень (сосуд, бронх)',fire:'Аллерген',modes:[
   ['Аллергия',{},'Аллерген → дегрануляция тучной клетки → гистамин активирует H₁-рецепторы: отёк, зуд, бронхоспазм.'],
   ['Кромоглициевая кислота',{rel:.15},'Стабилизатор мембран тучных клеток: гистамин почти не выделяется (только профилактика).'],
   ['H₁-блокатор',{ant:1},'Антигистаминный препарат занимает H₁-рецепторы: гистамин выделяется, но не действует.']]},
 'k-ane':{k:'syn',t:'ГАМК-ергический синапс',m:'ГАМК',mn:'ГАМК',rc:'ГАМК_A-рецепторы (Cl⁻-каналы)',rm:'reup',pre:'Тормозный нейрон',post:'Нейрон-мишень',out:'Торможение нейрона',modes:[
   ['Норма',{},'ГАМК открывает Cl⁻-каналы ГАМК_A-рецептора → гиперполяризация → торможение нейрона.'],
   ['Бензодиазепины',{bind:2},'Усиливают действие ГАМК: канал открывается чаще — торможение сильнее (седация, анксиолизис, противосудорожное).'],
   ['Барбитураты',{bind:3.4},'Удлиняют открытие канала; в больших дозах открывают его сами — риск угнетения дыхания.'],
   ['Флумазенил',{},'Антагонист бензодиазепинового участка: действие бензодиазепинов снято, остаётся обычная работа ГАМК.']]},
 'k-opi':{k:'syn',t:'Передача боли в задних рогах спинного мозга',m:'Глу',mn:'глутамат и субстанция P',rc:'рецепторы болевого нейрона',rm:'reup',pre:'Окончание болевого волокна',post:'Нейрон задних рогов',out:'Болевой сигнал в мозг',fire:'Боль',modes:[
   ['Боль',{},'Болевой импульс → выброс глутамата и субстанции P → нейрон задних рогов передаёт сигнал в мозг.'],
   ['Морфин',{rel:.3,post:.55},'μ-агонист: пресинаптически ↓ вход Ca²⁺ — медиатора меньше; постсинаптически ↑ выход K⁺ — нейрон гиперполяризован.'],
   ['Морфин + налоксон',{},'Налоксон вытесняет морфин с μ-рецепторов: проведение боли (и дыхание) восстанавливается.']]},
 'k-psl':{k:'syn',t:'Дофаминовый синапс: психоз и антипсихотики',m:'ДА',mn:'дофамин',rc:'D₂-рецепторы',rm:'mao',pre:'Дофаминовый нейрон (мезолимбический путь)',post:'Нейрон-мишень',modes:[
   ['Психоз',{rel:2.4},'Избыток дофамина в мезолимбическом пути — продуктивная симптоматика (бред, галлюцинации).'],
   ['Галоперидол',{rel:2.4,ant:1},'Типичный антипсихотик блокирует D₂: продуктивные симптомы уходят; в нигростриарном пути — ЭПР.'],
   ['Арипипразол',{rel:2.4,part:1},'Частичный агонист D₂: при избытке ДА снижает сигнал, при недостатке — частично заменяет его.']]},
 'k-psa':{k:'syn',t:'Серотониновый синапс и антидепрессанты',m:'5-HT',mn:'серотонин',rc:'5-HT-рецепторы',rm:'mao',pre:'Серотониновый нейрон',post:'Нейрон-мишень',modes:[
   ['Норма',{},'Серотонин выделяется, активирует рецепторы и возвращается обратным захватом; внутри окончания его разрушает МАО-А.'],
   ['СИОЗС',{tBlock:1},'Флуоксетин, сертралин блокируют переносчик SERT: серотонин дольше остаётся в щели.'],
   ['Пирлиндол (ИМАО-А)',{eBlock:1},'Ингибитор МАО-А: серотонин не разрушается, пузырьки наполняются — выброс растёт.'],
   ['СИОЗС + ИМАО',{tBlock:1,eBlock:1},'Двойное усиление — избыток серотонина: риск серотонинового синдрома.']]},
 'k-park':{k:'syn',t:'Дофамин в стриатуме: паркинсонизм',m:'ДА',mn:'дофамин',rc:'D-рецепторы стриатума',rm:'mao',pre:'Нейрон чёрной субстанции',post:'Нейрон стриатума',modes:[
   ['Норма',{},'Дофамин из чёрной субстанции поддерживает баланс с ацетилхолином в стриатуме — движения плавные.'],
   ['Паркинсонизм',{rel:.22},'Гибель дофаминовых нейронов: дофамина мало — брадикинезия, ригидность, тремор.'],
   ['Леводопа',{rel:.85},'Предшественник дофамина (с карбидопой) — оставшиеся нейроны синтезируют больше ДА.'],
   ['Агонист D (прамипексол)',{rel:.22,ago:2.6},'Агонист сам стимулирует дофаминовые рецепторы в обход погибших нейронов.'],
   ['Селегилин (ИМАО-B)',{rel:.22,eBlock:1},'Ингибитор МАО-B замедляет разрушение дофамина — его запас растёт.']]},
 'k-aff':{k:'axon',t:'Как местный анестетик останавливает боль',modes:[
   ['Норма',{b:0,w:0},'Болевой импульс бежит по волокну: Na⁺-каналы открываются один за другим, сигнал доходит до мозга.'],
   ['Лидокаин',{b:1,w:1},'Анестетик проникает в волокно и блокирует Na⁺-каналы изнутри: в зоне блока импульс гаснет.'],
   ['Лидокаин + эпинефрин',{b:1,w:1.5},'Эпинефрин сужает сосуды: анестетик дольше остаётся в тканях — блок шире и продолжительнее, меньше системная токсичность.'],
   ['Воспаление (кислая среда)',{b:.35,w:1},'В кислой среде анестетик ионизирован и плохо проникает через мембрану — блок неполный, часть сигналов проходит.']]},
 'k-ibs':{k:'bal',t:'Баланс кислорода в миокарде',modes:[
   ['Норма',{s:5,d:5},'Доставка O₂ по коронарам соответствует потребности миокарда.',[], 72],
   ['Стенокардия',{s:3.4,d:6},'Стеноз коронарной артерии + нагрузка: потребность выше доставки — ишемия, боль.',['атеросклероз — ↓ кровоток','нагрузка — ↑ ЧСС и сократимость'],108],
   ['Нитраты',{s:4.2,d:4.3},'Венодилатация → ↓ преднагрузка → ↓ потребность O₂; расширяют коронары и снимают спазм.',['↓ преднагрузка','↑ коронарный кровоток'],96],
   ['β-адреноблокаторы',{s:4.1,d:4.2},'↓ ЧСС и сократимость → ↓ потребность O₂; длиннее диастола → лучше перфузия миокарда.',['↓ ЧСС, ↓ сократимость','длиннее диастола'],60],
   ['БКК',{s:4.4,d:4.5},'Расширяют коронарные и периферические артерии: ↓ постнагрузка, устраняют спазм коронаров.',['↓ постнагрузка','↓ спазм коронаров'],88],
   ['Ивабрадин',{s:3.9,d:4.3},'Блок If-тока синусового узла: только ↓ ЧСС — без снижения сократимости и АД.',['↓ ЧСС'],62]]},
 'k-nsa':{k:'lane',mo:1,out:'Воспаление и боль',t:'Каскад арахидоновой кислоты и НПВС',src:'Арахидоновая кислота',lanes:[
   {id:'c1',st:'ЦОГ-1',out:'Pg и TxA₂: защита желудка, почки, тромбоциты',w:1},{id:'c2',st:'ЦОГ-2',out:'Pg воспаления: боль, отёк, лихорадка',w:1},{id:'lo',st:'ЛОГ',out:'Лейкотриены: бронхоспазм',w:.45}],
   modes:[['Норма',{},'Из арахидоновой кислоты ЦОГ-1 и ЦОГ-2 образуют простагландины, ЛОГ — лейкотриены.'],
   ['Диклофенак',{blk:['c1','c2'],sh:'lo'},'Неселективный НПВС блокирует обе ЦОГ: ↓ боль и воспаление, но страдает слизистая желудка; субстрат уходит в ЛОГ-путь («аспириновая астма»).'],
   ['Целекоксиб',{blk:['c2']},'Селективный ингибитор ЦОГ-2: противовоспалительный эффект без поражения желудка; ↑ риск тромбозов.'],
   ['Аспирин 75–150 мг',{blk:['c1'],low:1},'Низкие дозы необратимо блокируют ЦОГ-1 тромбоцитов: ↓ TxA₂ — антиагрегантный эффект.']]},
 'k-ag':{k:'lane',mo:0,out:'Действие ангиотензина II',t:'РААС и антигипертензивные средства',src:'Ангиотензиноген → ангиотензин I',lanes:[
   {id:'ace',st:'АПФ',st2:'AT₁',id2:'at1',out:'Ангиотензин II: вазоконстрикция, альдостерон, ↑ АД',w:1},{id:'bk',st:'АПФ',out:'Брадикинин разрушен',alt:'Брадикинин накапливается: кашель, ангионевротический отёк',w:.6}],
   modes:[['Норма',{},'Ренин → ангиотензин I → АПФ → ангиотензин II → AT₁-рецепторы: сосуды сужаются, АД растёт. АПФ же разрушает брадикинин.'],
   ['Эналаприл (иАПФ)',{blk:['ace','bk']},'Блок АПФ: ангиотензина II мало — АД снижается; брадикинин не разрушается — сухой кашель.'],
   ['Лозартан (БРА)',{blk:['at1']},'Блок AT₁-рецепторов: ангиотензин II образуется, но не действует; брадикинин не накапливается — кашля нет.'],
   ['β-адреноблокаторы',{rate:.45},'Блок β₁ юкстагломерулярного аппарата: ↓ выброс ренина — весь каскад работает слабее.']]}
};
/* ---------- синапс ---------- */
function vzSyn(sc){
  const R=[100,164,228,292,356,420].map(x=>({x,y:184,occ:null,t:0})), T={x:440,y:122}, E=sc.rm==='ache'?[{x:72,y:176},{x:452,y:176},{x:252,y:180}]:sc.rm==='mao'?[{x:462,y:84}]:[];
  const svg=`<svg viewBox="0 0 520 300" class="vz-svg" role="img" aria-label="${esc(sc.t)}"><defs><radialGradient id="vzg"><stop offset="0" stop-color="var(--hema)" stop-opacity=".5"/><stop offset="1" stop-color="var(--hema)" stop-opacity="0"/></radialGradient></defs>
    <path class="vz-pre" d="M36 0H484V68Q484 120 432 120H88Q36 120 36 68Z"/><text class="vz-lb" x="56" y="26">${esc(sc.pre)}</text>
    ${[[160,80],[210,92],[262,76],[312,94],[362,80]].map(([x,y])=>`<g class="vz-ves"><circle cx="${x}" cy="${y}" r="15"/><circle cx="${x-5}" cy="${y-3}" r="3"/><circle cx="${x+5}" cy="${y-2}" r="3"/><circle cx="${x}" cy="${y+5}" r="3"/></g>`).join('')}
    ${sc.rm==='ache'?'':`<g class="vz-tr"><rect x="${T.x-11}" y="${T.y-14}" width="22" height="18" rx="5"/><text class="vz-sm" x="${T.x}" y="${T.y-20}" text-anchor="middle">обратный захват</text><path class="vz-x" d="M${T.x-9} ${T.y-12}l18 14M${T.x+9} ${T.y-12}l-18 14"/></g>`}
    ${E.map(e=>`<g class="vz-en"><circle cx="${e.x}" cy="${e.y}" r="10"/><text class="vz-sm" x="${e.x}" y="${e.y+4}" text-anchor="middle">${sc.rm==='ache'?'АХЭ':'МАО'}</text><path class="vz-x" d="M${e.x-9} ${e.y-9}l18 18M${e.x+9} ${e.y-9}l-18 18"/></g>`).join('')}
    <path class="vz-post" d="M16 192H504V300H16Z"/><text class="vz-lb" x="40" y="286">${esc(sc.post)}</text>
    ${R.map((r,i)=>`<g class="vz-rc" data-i="${i}"><circle class="vz-glow" cx="${r.x}" cy="${r.y+18}" r="30" fill="url(#vzg)"/><path d="M${r.x-13} ${r.y-4}V${r.y+12}H${r.x+13}V${r.y-4}" /><rect class="vz-rcap" x="${r.x-9}" y="${r.y-8}" width="18" height="9" rx="3"/></g>`).join('')}
    <g class="vz-ps"></g><text class="vz-sm vz-cnt" x="500" y="150" text-anchor="end"></text></svg>`;
  return {svg, init(root,api){
    const ps=root.querySelector('.vz-ps'), NS='http://www.w3.org/2000/svg'; let P=[], o={}, tI=0, tL=0, pool=1, act=0, ema=0;
    const rcs=[...root.querySelectorAll('.vz-rc')];
    const mk=(k,x,y,vx,vy)=>{ if(P.length>110){ const q=P.shift(); if(q.el) q.el.remove(); }
      const el=api.draw?document.createElementNS(NS,k==='m'?'circle':'rect'):null; if(el){ if(k==='m'){ el.setAttribute('r','4.5'); el.setAttribute('class','vz-m'); } else { el.setAttribute('width','9'); el.setAttribute('height','9'); el.setAttribute('rx','2'); el.setAttribute('class','vz-d'); } ps.appendChild(el); }
      P.push({k,x,y,vx,vy,b:-1,t:0,life:k==='m'?9:7,el}); };
    const kill=(p,cls)=>{ p.dead=1; if(p.el){ if(cls&&api.draw){ const c=document.createElementNS(NS,'circle'); c.setAttribute('cx',p.x); c.setAttribute('cy',p.y); c.setAttribute('r','4'); c.setAttribute('class','vz-pop'); ps.appendChild(c); setTimeout(()=>c.remove(),500); } p.el.remove(); } };
    const fire=()=>{ const n=Math.round(12*(o.rel||1)*pool); for(let i=0;i<n;i++) mk('m',170+Math.random()*190,124,(Math.random()-.5)*70,60+Math.random()*60);
      if(o.ago) for(let i=0;i<Math.round(5*o.ago);i++) mk('d',40+Math.random()*440,140+Math.random()*30,(Math.random()-.5)*60,(Math.random()-.5)*60);
      if(api.draw){ root.querySelector('.vz-pre').classList.add('fire'); setTimeout(()=>{ const x=root.querySelector('.vz-pre'); if(x) x.classList.remove('fire'); },220); } };
    const set=m=>{ o=m; pool=1; P.forEach(p=>kill(p)); P=[]; R.forEach(r=>{ r.occ=(m.ant?'blk':m.part?'prt':null); r.t=0; }); ema=0;
      if(api.draw){ root.classList.toggle('t-off',!!m.tBlock); root.classList.toggle('e-off',!!m.eBlock); } };
    const step=dt=>{ tI+=dt; if(tI>1.7){ tI=0; fire(); } if(o.leak){ tL+=dt; if(tL>.1){ tL=0; mk('m',T.x-6,126,(Math.random()-.5)*50,40+Math.random()*40); } }
      if(o.eBlock&&sc.rm!=='ache') pool=Math.min(1.7,pool+dt*.22);
      const bm=o.bind||1; act=0;
      R.forEach(r=>{ if(r.occ==='m'||r.occ==='d'){ r.t-=dt; act+=1; if(r.t<=0){ const p=r.p; r.occ=null; if(p){ p.b=-1; p.vy=-40-Math.random()*30; p.y=r.y-10; } } } else if(r.occ==='prt') act+=(sc._base||.1)*.9; });
      const hz=p=>p.k==='d'?.12:sc.rm==='ache'?(o.eBlock?.08:1.1):o.tBlock?.08:(o.eBlock&&sc.rm==='mao')?.5:.85;
      for(const p of P){ if(p.dead||p.b>=0) continue; p.life-=dt; if(p.life<=0){ kill(p); continue; }
        if(Math.random()<hz(p)*dt){ if(api.draw&&p.el&&sc.rm!=='ache'){ p.x=T.x; p.y=T.y-4; } kill(p,1); continue; }
        p.vx+=(Math.random()-.5)*190*dt; p.vy+=(Math.random()-.5)*190*dt; const v=Math.hypot(p.vx,p.vy); if(v>120){ p.vx*=120/v; p.vy*=120/v; }
        p.x+=p.vx*dt; p.y+=p.vy*dt; if(p.x<22){ p.x=22; p.vx=Math.abs(p.vx); } if(p.x>498){ p.x=498; p.vx=-Math.abs(p.vx); }
        if(p.y<126){ p.y=126; p.vy=Math.abs(p.vy); }
        if(p.y>180){ const r=R.find(r=>Math.abs(r.x-p.x)<15); if(r&&!r.occ&&Math.random()<.5){ r.occ=p.k; r.t=.35*bm; r.p=p; p.b=1; p.x=r.x; p.y=r.y-6; } else { p.y=180; p.vy=-Math.abs(p.vy); } } }
      P=P.filter(p=>!p.dead);
      ema+=(act*(o.post||1)/R.length-ema)*Math.min(1,dt*.25); return ema; };
    const draw=()=>{ for(const p of P){ if(!p.el) continue; if(p.k==='m'){ p.el.setAttribute('cx',p.x.toFixed(1)); p.el.setAttribute('cy',p.y.toFixed(1)); } else { p.el.setAttribute('x',(p.x-4.5).toFixed(1)); p.el.setAttribute('y',(p.y-4.5).toFixed(1)); } }
      R.forEach((r,i)=>{ const g=rcs[i]; if(!g) return; g.classList.toggle('on',r.occ==='m'||r.occ==='d'); g.classList.toggle('blk',r.occ==='blk'); g.classList.toggle('prt',r.occ==='prt'); g.classList.toggle('dg',r.occ==='d'); });
      const c=root.querySelector('.vz-cnt'); if(c) c.textContent=`${sc.m} в щели: ${P.filter(p=>p.k==='m'&&p.b<0).length}`; };
    return {set,step,draw}; }};
}
/* ---------- аксон ---------- */
function vzAxon(){
  const svg=`<svg viewBox="0 0 520 170" class="vz-svg" role="img" aria-label="Болевое волокно и местный анестетик"><text class="vz-lb" x="20" y="24">Болевой рецептор</text><text class="vz-lb" x="500" y="24" text-anchor="end">→ в ЦНС</text>
    <rect class="vz-ax" x="20" y="66" width="470" height="34" rx="17"/><rect class="vz-zone" x="210" y="54" width="110" height="58" rx="12"/><text class="vz-sm vz-zl" x="265" y="136" text-anchor="middle">зона анестетика</text>
    ${Array.from({length:12},(_,i)=>`<g class="vz-na" data-x="${40+i*40}"><rect x="${36+i*40}" y="60" width="8" height="10" rx="2"/><rect x="${36+i*40}" y="96" width="8" height="10" rx="2"/></g>`).join('')}
    <circle class="vz-pl" cx="20" cy="83" r="14"/><circle class="vz-brain" cx="500" cy="83" r="10"/><text class="vz-sm vz-cnt" x="20" y="160"></text></svg>`;
  return {svg, init(root,api){ let o={b:0,w:0}, x=-30, amp=0, sent=0, got=0, ema=0, tt=0; const pl=root.querySelector('.vz-pl'), zn=root.querySelector('.vz-zone'), nas=[...root.querySelectorAll('.vz-na')];
    const z=()=>({a:265-55*(o.w||0), b:265+55*(o.w||0)});
    const set=m=>{ o=m; x=-30; amp=0; sent=0; got=0; ema=0; if(api.draw){ const Z=z(); zn.setAttribute('x',Z.a); zn.setAttribute('width',Math.max(0,Z.b-Z.a)); root.classList.toggle('blk',!!m.b); nas.forEach(n=>{ const nx=+n.dataset.x; n.classList.toggle('off',!!m.b && nx>=Z.a && nx<=Z.b); }); } };
    const step=dt=>{ tt+=dt; if(x<0 && tt>1.4){ tt=0; x=20; amp=1; sent++; } if(x>=0){ x+=230*dt; const Z=z(); if(o.b && x>Z.a && x<Z.b) amp=Math.max(0,amp-dt*230/Math.max(1,(Z.b-Z.a))*o.b*1.15); if(x>=490){ if(amp>.12+Math.random()*.8){ got++; ema+=(1-ema)*.5; if(api.draw){ const br=root.querySelector('.vz-brain'); br.classList.add('hit'); setTimeout(()=>br.classList.remove('hit'),300); } } else ema*=.5; x=-30; } } return ema; };
    const draw=()=>{ pl.setAttribute('cx',Math.max(20,x).toFixed(1)); pl.style.opacity=x<0?0:(.25+amp*.75).toFixed(2); pl.setAttribute('r',(6+amp*9).toFixed(1));
      nas.forEach(n=>n.classList.toggle('open',x>=0 && Math.abs(+n.dataset.x-x)<22 && amp>.1)); const c=root.querySelector('.vz-cnt'); if(c) c.textContent=`Сигналов дошло до ЦНС: ${got} из ${sent}`; };
    return {set,step,draw}; }};
}
/* ---------- баланс O₂ ---------- */
function vzBal(){
  const svg=`<svg viewBox="0 0 520 230" class="vz-svg" role="img" aria-label="Баланс доставки и потребности кислорода"><path class="vz-ful" d="M260 150L236 204H284Z"/>
    <g class="vz-beam"><rect x="80" y="144" width="360" height="8" rx="4"/><path class="vz-str" d="M110 148V96M410 148V96"/><rect class="vz-pan s" x="40" y="60" width="140" height="40" rx="10"/><rect class="vz-pan d" x="340" y="60" width="140" height="40" rx="10"/>
    <text class="vz-pt" x="110" y="85" text-anchor="middle">Доставка O₂</text><text class="vz-pt" x="410" y="85" text-anchor="middle">Потребность</text><text class="vz-pv s" x="110" y="50" text-anchor="middle"></text><text class="vz-pv d" x="410" y="50" text-anchor="middle"></text></g>
    <g class="vz-heart" transform="translate(260 46)"><path d="M0 14C-22 0-18-18-6-18C-2-18 0-14 0-12C0-14 2-18 6-18C18-18 22 0 0 14Z"/></g><text class="vz-sm vz-hr" x="260" y="88" text-anchor="middle"></text><text class="vz-sm vz-isc" x="260" y="222" text-anchor="middle"></text></svg>`;
  return {svg, init(root,api){ let o={s:5,d:5}, ang=0, extra=[], hr=72;
    const set=(m,mode)=>{ o=m; extra=mode[3]||[]; hr=mode[4]||72; if(api.draw){ root.querySelector('.vz-pv.s').textContent='●'.repeat(Math.round(o.s)); root.querySelector('.vz-pv.d').textContent='●'.repeat(Math.round(o.d)); root.querySelector('.vz-hr').textContent=`ЧСС ≈ ${hr}`; root.querySelector('.vz-heart').style.animationDuration=(60/hr).toFixed(2)+'s'; const isc=o.d-o.s>.9; root.classList.toggle('isc',isc); root.querySelector('.vz-isc').textContent=isc?'Ишемия: потребность > доставки':'Баланс сохранён'; } };
    const step=dt=>{ const tg=Math.max(-14,Math.min(14,(o.d-o.s)*6)); ang+=(tg-ang)*Math.min(1,dt*3); return Math.max(0,o.s/o.d); };
    const draw=()=>{ root.querySelector('.vz-beam').setAttribute('transform',`rotate(${ang.toFixed(2)} 260 148)`); };
    return {set,step,draw}; }};
}
/* ---------- каскад (дорожки) ---------- */
function vzLane(sc){
  const n=sc.lanes.length, W=520, ys=sc.lanes.map((_,i)=>70+i*(160/Math.max(1,n-1||1))); const H=n>2?280:220; const Y=i=>n===1?120:60+i*((H-110)/(n-1));
  const svg=`<svg viewBox="0 0 ${W} ${H}" class="vz-svg" role="img" aria-label="${esc(sc.t)}"><rect class="vz-src" x="10" y="${H/2-26}" width="120" height="52" rx="12"/><foreignObject x="14" y="${H/2-24}" width="112" height="48"><div xmlns="http://www.w3.org/1999/xhtml" class="vz-fo">${esc(sc.src)}</div></foreignObject>
    ${sc.lanes.map((l,i)=>{ const y=Y(i); return `<path class="vz-ln" d="M130 ${H/2} C170 ${H/2} 170 ${y} 210 ${y} H330"/><g class="vz-st" data-id="${l.id}"><rect x="200" y="${y-15}" width="58" height="30" rx="8"/><text x="229" y="${y+5}" text-anchor="middle">${esc(l.st)}</text><path class="vz-x" d="M206 ${y-11}l46 22M252 ${y-11}l-46 22"/></g>${l.st2?`<g class="vz-st" data-id="${l.id2}"><rect x="272" y="${y-15}" width="50" height="30" rx="8"/><text x="297" y="${y+5}" text-anchor="middle">${esc(l.st2)}</text><path class="vz-x" d="M276 ${y-11}l42 22M318 ${y-11}l-42 22"/></g>`:''}<g class="vz-out" data-o="${i}"><rect x="336" y="${y-24}" width="176" height="48" rx="10"/><foreignObject x="340" y="${y-22}" width="168" height="44"><div xmlns="http://www.w3.org/1999/xhtml" class="vz-fo vz-ot">${esc(l.out)}</div></foreignObject></g>`; }).join('')}
    <g class="vz-ps"></g></svg>`;
  return {svg, init(root,api){ const ps=root.querySelector('.vz-ps'), NS='http://www.w3.org/2000/svg'; let o={}, P=[], t=0; const flux=sc.lanes.map(()=>0);
    const outs=[...root.querySelectorAll('.vz-out')];
    const set=m=>{ o=m; P.forEach(p=>p.el&&p.el.remove()); P=[]; flux.fill(0); if(api.draw){ root.querySelectorAll('.vz-st').forEach(g=>g.classList.toggle('off',(m.blk||[]).includes(g.dataset.id))); sc.lanes.forEach((l,i)=>{ if(l.alt){ const ot=outs[i].querySelector('.vz-ot'); const on=(m.blk||[]).includes(l.id); ot.textContent=on?l.alt:l.out; outs[i].classList.toggle('alt',on); } }); } };
    const pos=(p)=>{ const y=Y(p.l), s=p.s; if(s<.25){ const u=s/.25; const yy=H/2+(y-H/2)*(3*u*u-2*u*u*u); return [130+u*80,yy]; } return [210+(s-.25)/.75*120,y]; };
    const step=dt=>{ t+=dt; const rate=(o.rate||1)*5;
      if(t>1/rate){ t=0; const wt=sc.lanes.map(l=>{ const b=(o.blk||[]).includes(l.id); let w=l.w; if(o.sh===l.id) w*=2.4; return {w,b}; }); const tot=wt.reduce((s,x)=>s+x.w,0); let r=Math.random()*tot, li=0; for(;li<wt.length;li++){ r-=wt[li].w; if(r<=0) break; } li=Math.min(li,wt.length-1);
        const el=api.draw?document.createElementNS(NS,'circle'):null; if(el){ el.setAttribute('r','4.5'); el.setAttribute('class','vz-m'); ps.appendChild(el); } P.push({l:li,s:0,el}); }
      for(const p of P){ const l=sc.lanes[p.l]; const blkA=(o.blk||[]).includes(l.id), blkB=l.id2&&(o.blk||[]).includes(l.id2); const stopAt=blkA?.36:blkB?.62:2;
        if(p.s<stopAt){ p.s=Math.min(stopAt,p.s+dt*.55); } else { p.fade=(p.fade||1)-dt*1.6; }
        if(p.s>=1){ p.done=1; flux[p.l]+=1; } if(p.fade<=0) p.done=1; }
      P=P.filter(p=>{ if(p.done){ if(p.el) p.el.remove(); return false; } return true; });
      for(let i=0;i<flux.length;i++) flux[i]*=Math.pow(.5,dt/2.2);
      return sc.mo!=null?flux[sc.mo]:flux.reduce((s,x)=>s+x,0); };
    const draw=()=>{ for(const p of P){ if(!p.el) continue; const [x,y]=pos(p); p.el.setAttribute('cx',x.toFixed(1)); p.el.setAttribute('cy',y.toFixed(1)); p.el.style.opacity=p.fade!=null?Math.max(0,p.fade):1; p.el.classList.toggle('stuck',p.fade!=null); }
      const mx=Math.max(3,...flux); outs.forEach((g,i)=>{ const l=sc.lanes[i]; const alt=l.alt&&(o.blk||[]).includes(l.id); g.style.setProperty('--f',alt?1:Math.min(1,flux[i]/6).toFixed(2)); }); };
    return {set,step,draw}; }};
}
const VZ_ENG={syn:vzSyn, axon:vzAxon, bal:vzBal, lane:vzLane};
/* ---------- монтаж и цикл ---------- */
const VZ_LIVE=new Set(); let VZ_RAF=0, VZ_T=0;
function vzLoop(ts){ VZ_RAF=0; const dt=VZ_T?Math.min(.05,(ts-VZ_T)/1000):.016; VZ_T=ts; let any=false;
  VZ_LIVE.forEach(z=>{ if(!document.body.contains(z.root)){ VZ_LIVE.delete(z); return; } if(!z.run||!z.vis) return; any=true; const v=z.c.step(dt); z.c.draw(); z.meter(v); });
  if(any) VZ_RAF=requestAnimationFrame(vzLoop); else VZ_T=0; }
const vzKick=()=>{ if(!VZ_RAF) VZ_RAF=requestAnimationFrame(vzLoop); };
function vzBase(sc){ if(sc._base!=null) return sc._base; const E=VZ_ENG[sc.k](sc); const c=E.init(document.createElement('div'),{draw:false}); if(!c){ sc._base=1; return 1; } c.set(sc.k==='bal'?sc.modes[0][1]:{},sc.modes[0]); let s=0,n=0; for(let i=0;i<5000;i++){ const v=c.step(.02); if(i>400){ s+=v; n++; } } sc._base=Math.max(.0001,s/n); return sc._base; }
function vzHTML(pid){ const sc=VZ_SCENES[pid]; if(!sc) return ''; const E=VZ_ENG[sc.k](sc);
  const lab=sc.k==='bal'?'Доставка / потребность':sc.k==='axon'?'Проведение боли':sc.out||(sc.k==='lane'?'Поток через каскад':'Сигнал клетке');
  return `<section class="fig vz" data-vz="${pid}"><div class="fig-head"><span class="blk-no">Анимация</span><h3 class="blk">${esc(sc.t)}</h3><button type="button" class="vz-pp" data-vzp aria-label="Пауза">❚❚</button></div>
    <div class="vz-stage">${E.svg}</div>
    <div class="seg vz-modes" role="group" aria-label="Что ввести">${sc.modes.map((m,i)=>`<button type="button" data-vzm="${i}" aria-pressed="${i===0}">${esc(m[0])}</button>`).join('')}</div>
    <div class="vz-foot"><p class="vz-cap" aria-live="polite">${esc(sc.modes[0][2])}</p><div class="vz-meter"><span>${esc(lab)}</span><span class="vz-bar"><i></i><b class="vz-norm" title="норма"></b></span><em class="vz-val"></em></div></div>
    ${sc.k==='syn'?`<p class="vz-leg"><i class="m"></i>${esc(sc.mn)} <i class="d"></i>препарат <i class="r"></i>${esc(sc.rc)}</p>`:''}</section>`; }
function vzMount(root){ const pid=root.dataset.vz; const sc=VZ_SCENES[pid]; if(!sc||root._vz) return; root._vz=1;
  const c=VZ_ENG[sc.k](sc).init(root,{draw:true}); const base=vzBase(sc); const z={root,c,run:!VZ_RM(),vis:false};
  const bar=root.querySelector('.vz-bar i'), val=root.querySelector('.vz-val'); let mi=0;
  root.querySelector('.vz-norm').style.left=(sc.k==='bal'?50:40)+'%';
  z.meter=v=>{ const r=v/base; const w=sc.k==='bal'?Math.min(100,r*50):Math.min(100,r*40); bar.style.width=w.toFixed(1)+'%'; bar.classList.toggle('hi',r>1.35); bar.classList.toggle('lo',r<.65);
    const x='×'+r.toFixed(1).replace('.',','); val.textContent=sc.k==='bal'?(r>=.95?'O₂ хватает':r>=.85?'почти хватает':'O₂ не хватает'):r<.15?'почти нет':r<.7?`ниже нормы · ${x}`:r<=1.4?`около нормы · ${x}`:`выше нормы · ${x}`; };
  const setM=i=>{ mi=i; const m=sc.modes[i]; c.set(m[1],m); for(let k=0;k<420;k++) z.meter(c.step(.02)); c.draw(); root.querySelector('.vz-cap').textContent=m[2]; root.querySelectorAll('[data-vzm]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.vzm===i))); };
  const pp=root.querySelector('[data-vzp]'); const upd=()=>{ pp.textContent=z.run?'❚❚':'▶'; pp.setAttribute('aria-label',z.run?'Пауза':'Запустить'); root.classList.toggle('paused',!z.run); };
  root.addEventListener('click',e=>{ const b=e.target.closest('[data-vzm]'); if(b){ setM(+b.dataset.vzm); if(!z.run){ z.run=true; upd(); } vzKick(); return; } if(e.target.closest('[data-vzp]')){ z.run=!z.run; upd(); vzKick(); } });
  setM(0); c.draw(); upd(); VZ_LIVE.add(z);
  if(typeof IntersectionObserver!=='undefined'){ const io=new IntersectionObserver(es=>es.forEach(en=>{ z.vis=en.isIntersecting; if(z.vis) vzKick(); }),{threshold:.15}); io.observe(root); } else { z.vis=true; vzKick(); }
  if(VZ_RM()){ for(let i=0;i<120;i++) c.step(.03); c.draw(); }
}
window.__VZ={VZ_SCENES,vzBase,ENG:VZ_ENG};

/* ===== Удобство чтения конспектов: значки разделов, сокращения, «продолжить», изучено, размер текста, фокус, озвучка ===== */
const RD_K='atlas-read', RD_D='atlas-done', RD_P='atlas-rd';
const rdJ=(k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)||'null')||d; }catch(e){ return d; } };
const rdS=(k,v)=>{ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} };
/* ---------- значки разделов ---------- */
const SIC={
  heart:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.7A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  lungs:'<path d="M12 4v9"/><path d="M12 11c-1.5 0-2.6 1.6-4.6 1.6S4 11.3 4 9s1.6-5 3.5-5S10 6.5 10 9"/><path d="M12 11c1.5 0 2.6 1.6 4.6 1.6S20 11.3 20 9s-1.6-5-3.5-5S14 6.5 14 9"/><path d="M5 13v4a3 3 0 0 0 6 0v-3M19 13v4a3 3 0 0 1-6 0v-3"/>',
  brain:'<path d="M9.5 4A3 3 0 0 0 6.5 7 3 3 0 0 0 4.5 12a3 3 0 0 0 2 5 3 3 0 0 0 3 3V4z"/><path d="M14.5 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3V4z"/>',
  eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  pill:'<path d="M8.6 15.4l6.8-6.8a3.5 3.5 0 0 0-5-5L3.6 10.4a3.5 3.5 0 0 0 5 5z"/><path d="M7 7l5 5"/><circle cx="17" cy="17" r="4"/><path d="M14.2 19.8l5.6-5.6"/>',
  bolt:'<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  drop:'<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>',
  gut:'<path d="M9 3v4c0 2-3.5 3-3.5 7a6.5 6.5 0 0 0 13 0c0-3-3.5-3.5-3.5-5.5V3"/>',
  flask:'<path d="M9 3h6M10 3v6L5 19a1 1 0 0 0 .9 1.5h12.2A1 1 0 0 0 19 19l-5-10V3"/><path d="M7.5 14h9"/>',
  list:'<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  alert:'<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
  temp:'<path d="M14 14.5V5a2 2 0 0 0-4 0v9.5a4 4 0 1 0 4 0z"/><path d="M12 9v8"/>',
  moon:'<path d="M20 14.5A8 8 0 1 1 9.5 4 6.3 6.3 0 0 0 20 14.5z"/>',
  target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8"/>',
  pen:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
  shield:'<path d="M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z"/>'
};
const SICR=[['alert',/побоч|осложн|токсич|отравлен|передозир|противопоказ|нежелательн/],['pen',/выписыв|рецепт|сигнатур|экзамен|вопрос/],['list',/классиф|группы|перечень/],['flask',/кинетик|всасыв|распредел|выведен|метабол|биодоступ/],['target',/механизм|рецептор|мишен|фармакодинам|взаимодейств/],
  ['heart',/серд|ибс|стенокард|аритм|ишеми|инфаркт|хсн|антиангин|кардио/],['drop',/гипертенз|сосуд|раас|давлен|кров|диурет|антигипертенз/],['lungs',/бронх|дыхан|кашл|астм|легк|лёгк/],['eye',/глаз|глауком|зрачк/],['moon',/снотвор|сон|седатив|анестет|наркоз|общие анест/],
  ['temp',/боль|анальг|воспал|нпвс|лихорад|антипирет|ненаркотич|наркотич|опиоид/],['brain',/психо|антидеп|нейролеп|антипсих|тревог|анксиол|депресс|паркинс|эпилеп|цнс|ноотроп|транквил|нормотим|стимулятор|спирт|алкогол/],
  ['bolt',/нерв|холин|адрен|ганглио|вегетат|синап|миорелакс|афферент|местн/],['gut',/желуд|жкт|рвот|язв|кишеч|слабит/],['shield',/аллерг|гистамин|иммун|антисепт|вяжущ|обволак/]];
function secIcon(t,pid){ const s=String(t||'').toLowerCase().replace(/ё/g,'е'); let k=null; for(const [n,re] of SICR) if(re.test(s)){ k=n; break; }
  if(!k){ const def={'k-gen':'flask','k-aff':'bolt','k-pns':'bolt','k-adr':'bolt','k-his':'shield','k-ane':'moon','k-opi':'temp','k-nsa':'temp','k-psl':'brain','k-psa':'brain','k-park':'brain','k-ibs':'heart','k-ag':'drop'}; k=def[pid]||'pill'; }
  return `<span class="sec-ic sic-${k}" aria-hidden="true"><svg viewBox="0 0 24 24">${SIC[k]}</svg></span>`; }
/* ---------- сокращения ---------- */
const GL={'АД':'артериальное давление','ЧСС':'частота сердечных сокращений','ЧДД':'частота дыхательных движений','ОПСС':'общее периферическое сосудистое сопротивление','ОПС':'общее периферическое сопротивление','ОЦК':'объём циркулирующей крови','СВ':'сердечный выброс','УО':'ударный объём','ХСН':'хроническая сердечная недостаточность','ОСН':'острая сердечная недостаточность','СН':'сердечная недостаточность','ИБС':'ишемическая болезнь сердца','ИМ':'инфаркт миокарда','ОКС':'острый коронарный синдром','АГ':'артериальная гипертензия','ФП':'фибрилляция предсердий','ТП':'трепетание предсердий','ЖТ':'желудочковая тахикардия','САУ':'синоатриальный узел','АВУ':'атриовентрикулярный узел','ПД':'потенциал действия','КУД':'критический уровень деполяризации','ЭРП':'эффективный рефрактерный период','ЭКГ':'электрокардиограмма','ЦНС':'центральная нервная система','ПНС':'периферическая нервная система','ВНС':'вегетативная нервная система','ГЭБ':'гематоэнцефалический барьер','ЖКТ':'желудочно-кишечный тракт','МВП':'мочевыводящие пути','ВДП':'верхние дыхательные пути','НДП':'нижние дыхательные пути','ДП':'дыхательные пути','БА':'бронхиальная астма','ХОБЛ':'хроническая обструктивная болезнь лёгких','БОС':'бронхообструктивный синдром','ГКС':'глюкокортикостероиды','ИГКС':'ингаляционные глюкокортикостероиды','КДБА':'короткодействующие β₂-агонисты','ДДБА':'длительно действующие β₂-агонисты','КДАХ':'короткодействующие антихолинергические средства','ДДАХ':'длительно действующие антихолинергические средства','НПВС':'нестероидные противовоспалительные средства','НПВП':'нестероидные противовоспалительные препараты','ЦОГ':'циклооксигеназа','ЛОГ':'липоксигеназа','АХ':'ацетилхолин','НА':'норадреналин','ДА':'дофамин','ГАМК':'гамма-аминомасляная кислота','МАО':'моноаминоксидаза','КОМТ':'катехол-О-метилтрансфераза','АХЭ':'ацетилхолинэстераза','ХЭ':'холинэстераза','ФОС':'фосфорорганические соединения','АПФ':'ангиотензинпревращающий фермент','иАПФ':'ингибиторы АПФ','ИАПФ':'ингибиторы АПФ','БРА':'блокаторы рецепторов ангиотензина II','БКК':'блокаторы кальциевых каналов','БМКК':'блокаторы медленных кальциевых каналов','РААС':'ренин-ангиотензин-альдостероновая система','САС':'симпатоадреналовая система','НУП':'натрийуретические пептиды','ТЦА':'трициклические антидепрессанты','СИОЗС':'селективные ингибиторы обратного захвата серотонина','СИОЗСН':'ингибиторы обратного захвата серотонина и норадреналина','ИМАО':'ингибиторы моноаминоксидазы','ЭПР':'экстрапирамидные расстройства','ЗНС':'злокачественный нейролептический синдром','МНН':'международное непатентованное наименование','ЛС':'лекарственное средство','ЛВ':'лекарственное вещество','ВГД':'внутриглазное давление','ВЧД':'внутричерепное давление','СКФ':'скорость клубочковой фильтрации','ХБП':'хроническая болезнь почек','ХПН':'хроническая почечная недостаточность','ОПН':'острая почечная недостаточность','СД':'сахарный диабет','ЛПНП':'липопротеины низкой плотности','ЛПВП':'липопротеины высокой плотности','ТЭЛА':'тромбоэмболия лёгочной артерии','МНО':'международное нормализованное отношение','АЧТВ':'активированное частичное тромбопластиновое время','НМГ':'низкомолекулярные гепарины','НФГ':'нефракционированный гепарин','ИВЛ':'искусственная вентиляция лёгких','МАК':'минимальная альвеолярная концентрация','СО':'слизистая оболочка','ЮГА':'юкстагломерулярный аппарат','ГМ':'головной мозг','СМ':'спинной мозг','ОДА':'опорно-двигательный аппарат','ЧМТ':'черепно-мозговая травма','ОНМК':'острое нарушение мозгового кровообращения','ТГВ':'тромбоз глубоких вен','АБ':'адреноблокатор(ы)','АМ':'адреномиметик(и)','БАВ':'биологически активные вещества','ПЖК':'подкожная жировая клетчатка','ОРВИ':'острая респираторная вирусная инфекция','ДПП-4':'дипептидилпептидаза-4','ГПП-1':'глюкагоноподобный пептид-1','ИПП':'ингибиторы протонной помпы','ТАП':'тканевой активатор плазминогена'};
const GLRE=new RegExp('(^|[^А-Яа-яЁёA-Za-z0-9])('+Object.keys(GL).sort((a,b)=>b.length-a.length).map(k=>k.replace(/[-]/g,'\\-')).join('|')+')(?![А-Яа-яЁёA-Za-z0-9])','g');
function glWrap(root){ const secs=root.querySelectorAll('.ksec'); (secs.length?secs:[root]).forEach(sec=>{ const seen=new Set();
  const w=document.createTreeWalker(sec,NodeFilter.SHOW_TEXT,{acceptNode:n=>{ const p=n.parentElement; if(!p||!n.nodeValue||!/[А-Я]{2}/.test(n.nodeValue)) return NodeFilter.FILTER_REJECT; if(p.closest('svg,button,abbr,input,textarea,script,style,[class*="rp-"],.kdone,.krun,.vz')) return NodeFilter.FILTER_REJECT; return NodeFilter.FILTER_ACCEPT; }});
  const L=[]; while(w.nextNode()) L.push(w.currentNode);
  L.forEach(n=>{ const s=n.nodeValue; GLRE.lastIndex=0; let m, last=0, frag=null;
    while((m=GLRE.exec(s))){ const k=m[2]; if(seen.has(k)) continue; seen.add(k); if(!frag) frag=document.createDocumentFragment(); const st=m.index+m[1].length; frag.appendChild(document.createTextNode(s.slice(last,st))); const a=document.createElement('abbr'); a.className='gl'; a.tabIndex=0; a.dataset.gl=GL[k]; a.textContent=k; frag.appendChild(a); last=st+k.length; }
    if(frag){ frag.appendChild(document.createTextNode(s.slice(last))); n.parentNode.replaceChild(frag,n); } }); }); }
let GLTIP=null;
function glShow(a){ if(!GLTIP){ GLTIP=document.createElement('div'); GLTIP.className='gltip'; GLTIP.setAttribute('role','tooltip'); document.body.appendChild(GLTIP); }
  GLTIP.innerHTML=`<b>${esc(a.textContent)}</b> — ${esc(a.dataset.gl)}`; GLTIP.hidden=false; const r=a.getBoundingClientRect(); const w=Math.min(300,innerWidth-24); GLTIP.style.maxWidth=w+'px';
  const tw=GLTIP.offsetWidth, th=GLTIP.offsetHeight; let x=Math.max(12,Math.min(innerWidth-tw-12,r.left+r.width/2-tw/2)); let y=r.top-th-8; if(y<8) y=r.bottom+8; GLTIP.style.left=x+'px'; GLTIP.style.top=y+'px'; }
const glHide=()=>{ if(GLTIP) GLTIP.hidden=true; };
document.addEventListener('mouseover',e=>{ const a=e.target.closest&&e.target.closest('abbr.gl'); if(a) glShow(a); });
document.addEventListener('mouseout',e=>{ if(e.target.closest&&e.target.closest('abbr.gl')) glHide(); });
document.addEventListener('focusin',e=>{ const a=e.target.closest&&e.target.closest('abbr.gl'); if(a) glShow(a); else glHide(); });
document.addEventListener('click',e=>{ const a=e.target.closest('abbr.gl'); if(a){ glShow(a); return; } glHide(); });
addEventListener('scroll',glHide,{passive:true});
/* ---------- изучено, «продолжить», размер и фокус ---------- */
const rdDone=pid=>new Set((rdJ(RD_D,{})[pid])||[]);
function rdToggle(pid,s){ const all=rdJ(RD_D,{}); const set=new Set(all[pid]||[]); if(set.has(s)) set.delete(s); else set.add(s); all[pid]=[...set]; rdS(RD_D,all); return set.has(s); }
function rdSecs(){ return $$('h2.sec[id]',$('#page')); }
function rdMark(p){ const done=rdDone(p.id); const hs=rdSecs();
  $$('.kdone [data-done]').forEach(b=>{ const on=done.has(+b.dataset.done); b.classList.toggle('on',on); b.setAttribute('aria-pressed',String(on)); b.innerHTML=on?'✓ Раздел изучен':'Отметить раздел изученным'; });
  hs.forEach(h=>{ const m=h.id.match(/-s(\d+)$/); h.classList.toggle('done',!!m&&done.has(+m[1])); });
  $$('#kbar .kt-sb').forEach(b=>b.classList.toggle('done',done.has(+b.dataset.sn)));
  const tb=$('#kbar .kb-sec'); if(tb){ let c=$('.kb-dn',tb); if(!c){ c=document.createElement('span'); c.className='kb-dn'; tb.insertBefore(c,$('.kb-ar',tb)); } const n=hs.length, d=[...done].filter(s=>s>=1&&s<=n).length; c.textContent=n?`${d}/${n}`:''; c.title='Изучено разделов'; c.classList.toggle('all',n>0&&d>=n); } }
function rdPrefs(){ return Object.assign({fs:'m',focus:false},rdJ(RD_P,{})); }
function rdApply(){ const pr=rdPrefs(); const r=document.documentElement; r.dataset.fs=pr.fs; r.classList.toggle('rd-focus',!!pr.focus&&!!CURP);
  $$('[data-rfs]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.rfs===pr.fs))); $$('[data-rfoc]').forEach(b=>b.setAttribute('aria-pressed',String(!!pr.focus))); }
rdApply();
function rdResumeHTML(){ const R=rdJ(RD_K,{}); const pid=R.last; const x=pid&&R.p&&R.p[pid]; const p=pid&&BY[pid]; if(!x||!p||!(x.s>0)) return ''; const n=x.n||0, d=[...rdDone(pid)].filter(s=>s>=1&&(!n||s<=n)).length;
  return `<a class="td-rs" href="#${pid}" data-rs="${pid}:${x.s}"><span class="td-rsi" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20"/></svg></span><span><small>Продолжить чтение · ${esc(p.roman)}${n?` · изучено ${d} из ${n}`:''}</small><b>${esc(x.t||p.title)}</b></span><span class="td-rsa">→</span></a>`; }
let RS_GO=null;
document.addEventListener('click',e=>{ const a=e.target.closest('a[data-rs]'); if(!a) return; const [pid,s]=a.dataset.rs.split(':'); RS_GO={pid,s:+s}; });
/* ---------- озвучка раздела ---------- */
const TTS=typeof window.speechSynthesis!=='undefined'&&typeof window.SpeechSynthesisUtterance!=='undefined';
let TTS_B=null;
function ttsStop(){ if(!TTS) return; try{ speechSynthesis.cancel(); }catch(e){} if(TTS_B){ TTS_B.classList.remove('on'); TTS_B.textContent='🔊 Слушать'; TTS_B=null; } }
function ttsSec(btn){ if(!TTS) return; if(TTS_B===btn){ ttsStop(); return; } ttsStop(); const sec=btn.closest('.ksec'); if(!sec) return;
  const c=sec.cloneNode(true); c.querySelectorAll('.kdone,.krun,svg,button,.vz,.kt-b,.rp-list,script,style').forEach(x=>x.remove());
  c.querySelectorAll('abbr.gl').forEach(a=>a.replaceWith(document.createTextNode(a.dataset.gl)));
  const txt=(c.innerText||c.textContent||'').replace(/→|=>|⇒/g,', приводит к, ').replace(/↑/g,' повышение ').replace(/↓/g,' снижение ').replace(/\s+/g,' ').trim(); if(!txt) return;
  const parts=[]; txt.replace(/([.!?;:])\s+/g,'$1\u0001').split('\u0001').forEach(s=>{ while(s.length>220){ const i=s.lastIndexOf(' ',220); parts.push(s.slice(0,i>40?i:220)); s=s.slice(i>40?i:220); } if(s.trim()) parts.push(s); });
  const vs=speechSynthesis.getVoices().filter(v=>/^ru/i.test(v.lang)); TTS_B=btn; btn.classList.add('on'); btn.textContent='■ Остановить';
  parts.forEach((s,i)=>{ const u=new SpeechSynthesisUtterance(s); u.lang='ru-RU'; u.rate=1.02; if(vs[0]) u.voice=vs[0]; if(i===parts.length-1) u.onend=()=>{ if(TTS_B===btn) ttsStop(); }; speechSynthesis.speak(u); }); }
/* ---------- после отрисовки конспекта ---------- */
let RD_SCR=null;
function kAfter(p){
  const page=$('#page');
  /* значки разделов */
  rdSecs().forEach(h=>{ if(!h.querySelector('.sec-ic')) h.insertAdjacentHTML('afterbegin',secIcon(h.textContent,p.id)); });
  /* анимация механизма */
  if(typeof vzHTML==='function' && VZ_SCENES[p.id]){ const h=document.getElementById(p.id+'-s1'); const host=h?h.closest('.kblk'):$('.kblk',page); if(host){ host.insertAdjacentHTML('afterend',vzHTML(p.id)); const el=host.nextElementSibling; if(el&&el.dataset.vz) vzMount(el); } }
  /* изучено + слушать */
  $$('.ksec',page).forEach(sec=>{ const s=+sec.dataset.s; if(!(s>=1)) return; const html=`<div class="kdone"><button type="button" class="btn" data-done="${s}" aria-pressed="false">Отметить раздел изученным</button>${TTS?'<button type="button" class="btn kd-tts" data-tts="1">🔊 Слушать</button>':''}</div>`; const kr=$('.krun',sec); if(kr) kr.insertAdjacentHTML('beforebegin',html); else sec.insertAdjacentHTML('beforeend',html); });
  /* сокращения */
  try{ glWrap(page); }catch(e){}
  /* размер текста и фокус — в меню «Вид» */
  const vp=$('#kbar .kpop[data-for="view"]'); if(vp && !$('.rd-set',vp)) vp.insertAdjacentHTML('beforeend',`<div class="rd-set"><p class="kp-h">Чтение</p><div class="seg" role="group" aria-label="Размер текста"><button type="button" data-rfs="m">Обычный текст</button><button type="button" data-rfs="l">Крупнее</button><button type="button" data-rfs="xl">Ещё крупнее</button></div><div class="seg"><button type="button" data-rfoc="1" aria-pressed="false">Режим фокуса — скрыть меню слева</button></div><p class="kp-note">Сокращения в тексте подчёркнуты пунктиром — наведите или нажмите, чтобы увидеть расшифровку.</p></div>`);
  rdApply(); rdMark(p);
  if(!$('.rd-pb',page)) page.insertAdjacentHTML('afterbegin','<div class="rd-pb" aria-hidden="true"><i></i></div>');
  /* запоминание места */
  const R=rdJ(RD_K,{}); const saved=R.p&&R.p[p.id]; const hs=rdSecs();
  if(RD_SCR) removeEventListener('scroll',RD_SCR); let tm=0, raf=0;
  RD_SCR=()=>{ if(raf) return; raf=requestAnimationFrame(()=>{ raf=0; const pb=$('.rd-pb i'); if(!pb||CURP!==p) return; const top=page.getBoundingClientRect().top+scrollY; const h=page.offsetHeight-innerHeight; pb.style.width=Math.max(0,Math.min(100,(scrollY-top)/Math.max(1,h)*100)).toFixed(1)+'%';
    clearTimeout(tm); tm=setTimeout(()=>{ if(CURP!==p) return; let t=null; for(const h of hs){ if(h.offsetParent===null) continue; if(h.getBoundingClientRect().top<200) t=h; else break; } const m=t&&t.id.match(/-s(\d+)$/); const X=rdJ(RD_K,{}); X.p=X.p||{}; X.p[p.id]={s:m?+m[1]:0, t:t?plain(t.textContent):'', n:hs.length, ts:Date.now()}; X.last=p.id; rdS(RD_K,X); },700); }); };
  addEventListener('scroll',RD_SCR,{passive:true});
  const go=s=>{ const h=document.getElementById(`${p.id}-s${s}`); if(h){ const sec=h.closest('.ksec'); if(sec&&sec.hidden){ KFOCUS=-1; kApply(p); } kScrollTo(h); } };
  if(RS_GO&&RS_GO.pid===p.id){ const s=RS_GO.s; RS_GO=null; setTimeout(()=>go(s),80); }
  else if(saved&&saved.s>1&&!pending){ const t=document.createElement('div'); t.className='rd-toast'; t.innerHTML=`<span>Вы остановились на разделе <b>«${esc(saved.t)}»</b></span><button type="button" class="btn pri" data-rdgo="1">Продолжить</button><button type="button" class="rd-x" aria-label="Закрыть">×</button>`; page.appendChild(t);
    t.addEventListener('click',e=>{ if(e.target.closest('[data-rdgo]')) go(saved.s); t.remove(); }); setTimeout(()=>{ if(t.isConnected){ t.classList.add('out'); setTimeout(()=>t.remove(),400); } },9000); }
}
document.addEventListener('click',e=>{ const d=e.target.closest('[data-done]'); if(d&&CURP){ rdToggle(CURP.id,+d.dataset.done); rdMark(CURP); if(d.classList.contains('on')){ const sec=d.closest('.ksec'); const nx=sec&&sec.nextElementSibling; if(nx&&nx.classList.contains('ksec')&&!nx.hidden){ const h=$('h2.sec',nx); if(h) kScrollTo(h); } } return; }
  const t=e.target.closest('[data-tts]'); if(t){ ttsSec(t); return; }
  const f=e.target.closest('[data-rfs]'); if(f){ const pr=rdPrefs(); pr.fs=f.dataset.rfs; rdS(RD_P,pr); rdApply(); return; }
  if(e.target.closest('[data-rfoc]')){ const pr=rdPrefs(); pr.focus=!pr.focus; rdS(RD_P,pr); rdApply(); return; } });

/* ---------- маршрутизация ---------- */
window.__A = null;
const A = {$, $$, esc, plain, key, first, findDrug, kFindDrug, kSame, findCard, openDossier, BY, P, DLIST, DRUGS, canon, flow, isK, plab, bodyName, plur, uFind, uCardHTML, uLearnHTML, uDoseHTML, UNI, rpHTML, rpAll, kParts};
window.__A = A;
function route(){
  let id=location.hash.slice(1); try{ id=decodeURIComponent(id); }catch(e){}
  if(id==='topics'){ if(!$('#topics')) renderHome(); setCurrent(''); requestAnimationFrame(()=>$('#topics')?.scrollIntoView({behavior:'smooth'})); return; }
  const parts=id.split('/'), base=parts[0], arg=parts.slice(1).join('/');
  const p=BY[id]; document.onkeydown=null;
  $('#page').classList.toggle('preview-topic', !!p && p===P.find(isK));
  if(typeof RUN!=='undefined') RUN.close(); $('#page').classList.remove('kv-s','kv-t'); CURP=null; KFOCUS=-1; HOMEREFRESH=null; document.documentElement.classList.remove("rd-focus"); if(typeof ttsStop==="function") ttsStop();
  let kind='home';
  if(typeof EXTRA!=='undefined' && EXTRA.routes[base]){ figs={}; EXTRA.routes[base](A,arg); setCurrent(base); kind=base; }
  else { if(id==='drugs'){ renderDB(); kind='drugs'; } else if(p){ renderPlate(p); kind='plate'; } else renderHome(); setCurrent(p?p.id:(id==='drugs'?'drugs':'')); }
  if(kind==='home'){ const c=$('[data-count]'); if(c&&typeof FX!=='undefined') FX.count(c,+c.dataset.count); }
  if(!pendingDossier) closeDz(true);
  if(pending) requestAnimationFrame(focusPending); else window.scrollTo(0,0);
  if(pendingDossier){ const n=pendingDossier; pendingDossier=null; openDossier(n); }
  if(kind==='plate'&&p&&!p.locked&&window.MAP)window.MAP.last({atlas:'farma',title:p.title,sub:p.lec||p.roman||'',url:location.href});
  if(typeof FX!=='undefined') FX.page(kind);
  const due=$('#nav .due'); if(due && typeof lDueCount==='function'){ const n=lDueCount(A); due.textContent=n; due.hidden=!n; }
}
window.addEventListener('hashchange',route);
const start=()=>{ buildNav(); if(typeof FX!=='undefined') FX.shell(); route(); };
if(document.fonts && document.fonts.status!=='loaded'){ let done=false; const go=()=>{ if(!done){ done=true; start(); } }; document.fonts.ready.then(()=>{ if(done){ _mcache.clear(); fitTrees(); if($('.kgraph') && dz.hidden){ const y=scrollY; route(); scrollTo(0,y); } } else go(); }); setTimeout(go,1800); } else start();
})();
