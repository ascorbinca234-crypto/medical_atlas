/* ===== Учить: колода из конспектов, интервальное повторение (SM-2), прогон, тест, рецепты ===== */
const L_KEY='atlas-learn-v1', L_PREF='atlas-learn-pref';
const L1_INT=[0,1,2,4,8,16]; // интервалы старой системы (коробки) — для переноса прогресса
/* запись: [интервал (дни), день показа, повторений, ошибок, время, лёгкость×100, последняя оценка] */
let LST={v:2, items:{}, days:{}, nw:{}, nx:{}};
let LCLOUD={ref:null, state:'local', writing:false, dirty:false, t:0, started:false};
let LDECK=null;
const lToday=()=>{ const d=new Date(); return Math.floor((d.getTime()-d.getTimezoneOffset()*60000)/864e5); };
function lMig(r){ if(!Array.isArray(r)) return null; if(r.length>=7) return r; const box=r[0]||0; return [L1_INT[box]||0, r[1]||0, r[2]||0, r[3]||0, r[4]||0, 250-15*Math.min(4,r[3]||0), 0]; }
function lNorm(x){ const o={v:2, items:{}, days:Object.assign({},(x&&x.days)||{}), nw:Object.assign({},(x&&x.nw)||{}), nx:Object.assign({},(x&&x.nx)||{})}; const it=(x&&x.items)||{}; for(const k in it){ const r=lMig(it[k]); if(r) o.items[k]=r; } return o; }
function lLoad(){ try{ const x=JSON.parse(localStorage.getItem(L_KEY)||'null'); if(x&&x.items) LST=lNorm(x); }catch(e){} }
function lSaveLocal(){ try{ localStorage.setItem(L_KEY, JSON.stringify(LST)); }catch(e){} }
function lSave(){ lSaveLocal(); if(!LCLOUD.ref) return; LCLOUD.dirty=true; clearTimeout(LCLOUD.t); LCLOUD.t=setTimeout(lFlush,1600); }
async function lFlush(){
  if(LCLOUD.writing||!LCLOUD.dirty||!LCLOUD.ref) return;
  LCLOUD.writing=true; LCLOUD.dirty=false;
  try{ await LCLOUD.ref.set(JSON.parse(JSON.stringify(LST))); }
  catch(e){ const c=e&&e.code;
    if(c==='unavailable'||c==='resource_exhausted'){ LCLOUD.dirty=true; setTimeout(lFlush,3000+Math.random()*3000); }
    else { LCLOUD.ref=null; LCLOUD.state='local'; lBadge(); } }
  LCLOUD.writing=false; if(LCLOUD.dirty){ clearTimeout(LCLOUD.t); LCLOUD.t=setTimeout(lFlush,1600); }
}
function lMerge(remote){
  const R=lNorm(remote); let localNewer=false; const out={};
  const ids=new Set([...Object.keys(R.items),...Object.keys(LST.items)]);
  ids.forEach(id=>{ const a=LST.items[id], b=R.items[id]; if(!a) out[id]=b; else if(!b){ out[id]=a; localNewer=true; } else { if((a[4]||0)>(b[4]||0)){ out[id]=a; localNewer=true; } else out[id]=b; } });
  const mx=(k)=>{ const m=Object.assign({},R[k]); Object.entries(LST[k]||{}).forEach(([d,n])=>{ if(!m[d]||m[d]<n){ m[d]=n; localNewer=true; } }); return m; };
  LST={v:2, items:out, days:mx('days'), nw:mx('nw'), nx:mx('nx')}; if(remote&&remote.v!==2) localNewer=true; return localNewer;
}
async function lCloudInit(){
  if(LCLOUD.started) return; LCLOUD.started=true;
  if(!(window.claude && typeof window.claude.use==='function')) return;
  LCLOUD.state='connecting'; lBadge();
  try{
    const [db,user]=await Promise.all([window.claude.use('db'), window.claude.use('user')]);
    if(!db||!user){ LCLOUD.state='local'; lBadge(); return; }
    const uid=await user.id(); if(!uid){ LCLOUD.state='local'; lBadge(); return; }
    const ref=db.doc('data/users/'+uid+'/learn');
    const snap=await ref.get();
    const newer=lMerge(snap.exists?snap.data():null);
    LCLOUD.ref=ref; LCLOUD.state='cloud'; lSaveLocal(); lBadge();
    if(newer||!snap.exists){ LCLOUD.dirty=true; lFlush(); }
    lRefreshAll();
  }catch(e){ LCLOUD.ref=null; LCLOUD.state='local'; lBadge(); }
}
function lBadge(){ document.querySelectorAll('.l-sync').forEach(b=>{ const m={cloud:['Прогресс сохраняется в аккаунте','ok'],connecting:['Подключаю сохранение…',''],local:['Прогресс хранится в этом браузере','']}[LCLOUD.state]||['','']; b.textContent=m[0]; b.className='l-sync '+m[1]; }); }
let LREFRESH=null;
function lRefreshAll(){ if(typeof LREFRESH==='function') LREFRESH(); const A=window.__A; if(!A) return; const dn=document.querySelector('#nav .due'); if(dn){ const n=lDueCount(A); dn.textContent=n; dn.hidden=!n; } if(typeof HOMEREFRESH==='function') HOMEREFRESH(); }
let HOMEREFRESH=null;
lLoad();

/* ---------- алгоритм ---------- */
const lRec=id=>LST.items[id]||null;
const lSeen=r=>!!(r&&r[2]);
/* следующий интервал (дни) после оценки g: 1 снова · 2 трудно · 3 хорошо · 4 легко */
function lNextIv(r,g,t){
  t=t==null?lToday():t; const iv=r?r[0]:0, reps=r?r[2]:0, ef=(r&&r[5])||250; const late=r?Math.max(0,t-r[1]):0;
  if(!reps) return g===1?0:g===2?1:g===3?1:3;
  if(g===1) return 0;
  if(iv===0) return g===4?3:1;
  const base=iv+(g>=3?late/2:0);
  if(g===2) return Math.max(iv+1, Math.round(base*1.2));
  if(g===3) return Math.max(iv+1, Math.round(base*ef/100));
  return Math.max(iv+2, Math.round(base*ef/100*1.3));
}
function lRate(id,g){
  const t=lToday(); const r0=lRec(id); const r=(r0||[0,0,0,0,0,250,0]).slice();
  let ef=r[5]||250; const fresh=!r[2];
  let iv=lNextIv(r0,g,t);
  if(!fresh){ if(g===1){ r[3]=(r[3]||0)+1; ef=Math.max(130,ef-20); } else if(g===2) ef=Math.max(130,ef-15); else if(g===4) ef=Math.min(320,ef+15); }
  else { if(g===4) ef+=10; const k=id.startsWith('rv:')||id.startsWith('rx:')?'nx':'nw'; LST[k][t]=(LST[k][t]||0)+1; }
  if(iv>=7) iv=Math.round(iv*(0.95+Math.random()*0.1));
  iv=Math.min(iv,365);
  r[0]=iv; r[1]=t+iv; r[2]=(r[2]||0)+1; r[4]=Date.now(); r[5]=ef; r[6]=g; LST.items[id]=r;
  LST.days[t]=(LST.days[t]||0)+1; lSave();
  try{if(window.MAP){window.MAP.card({atlas:'farma',ok:g>=3});lPublish();}}catch(e){}
}
/* прогон и тест: «знаю» вводит новую карточку или засчитывает просроченную; «не знаю» — в повторение сегодня */
function lTouch(id,ok){ const r=lRec(id), t=lToday(); if(ok){ if(!lSeen(r)||r[1]<=t) lRate(id,3); } else lRate(id,1); }
const lIvTxt=d=>d<=0?'<10 мин':d<30?d+' д':d<365?Math.round(d/30)+' мес':'1 год';
function lStreak(){ const t=lToday(); let n=0, d=LST.days[t]?t:t-1; while(LST.days[d]){ n++; d--; } return n; }

/* ---------- колода ---------- */
const lClean=s=>String(s).replace(/<[^>]+>/g,'').replace(/[*«»"]/g,'').replace(/\s+/g,' ').trim();
const lRank={'':0,g:1,y:2};
/* таблица «для выписывания»: колонки МНН и формы выпуска */
function rxTab(b){
  if(!b||b.t!=='table'||!b.head) return null;
  const H=b.head.map(h=>String(h).replace(/<[^>]+>/g,'').trim());
  const iN=H.findIndex(h=>/МНН|Международное/i.test(h)), iF=H.findIndex(h=>/Форма/i.test(h)); if(iN<0||iF<0) return null;
  return {iN, iF, iD:H.findIndex((h,i)=>i!==iN&&i!==iF&&/Способ|Доз/i.test(h)), iT:H.findIndex(h=>/Торгов|Патент/i.test(h)), iI:H.findIndex(h=>/Показан/i.test(h)), iNo:H.findIndex(h=>h==='№'), H};
}
function rxName(cell){
  const s=String(cell).replace(/<\/?mark>/g,''); const parts=s.split('<br>');
  let ru=parts[0].replace(/<[^>]+>/g,'').trim(), la=(parts[1]||'').replace(/<[^>]+>/g,'').trim();
  const m=ru.match(/^(.*?)\s*\(([A-Za-z][^)]*)\)\s*\*?$/); if(m){ ru=m[1].trim(); if(!la) la=m[2].trim(); }
  return {ru:ru.replace(/\*+$/,'').trim(), la};
}
function lSecOf(p){ let s=0; return p.blocks.map(b=>{ if(b.t==='h') s++; return s; }); }
function lDeck(A){
  if(LDECK) return LDECK;
  const items=[]; const byPlate={};
  const findIn=(pid,nm)=>(byPlate[pid]||[]).find(it=>A.kSame(nm,it.n)||A.kSame(it.n,nm));
  const add=(p,name,info,sec)=>{ const nm=lClean(name); if(!nm||nm.length<3||/АБ$/.test(nm)) return null; let it=findIn(p.id,nm);
    if(!it){ it={id:p.id+':'+A.key(nm).replace(/\s+/g,'_'), n:nm, p:p.id, lec:p.roman, title:p.title, hl:'', groups:[], card:null, rx:[], secs:[], ord:items.length}; (byPlate[p.id]=byPlate[p.id]||[]).push(it); items.push(it); }
    if(info.hl && lRank[info.hl]>lRank[it.hl]) it.hl=info.hl;
    if(info.group && !it.groups.includes(info.group)) it.groups.push(info.group);
    if(info.card && !it.card) it.card=info.card;
    if(info.rx && !it.rx.some(x=>x.form===info.rx.form&&x.dose===info.rx.dose)) it.rx.push(info.rx);
    if(sec!=null && !it.secs.includes(sec)) it.secs.push(sec);
    return it; };
  KP.forEach(p=>{ const S=lSecOf(p);
    p.blocks.forEach((b,bi)=>{ const sec=S[bi];
      if(b.t==='tree'){ const walk=(nd,path)=>{ const here=lClean(nd.n||''); const pth=here?path.concat(here):path;
          (nd.d||[]).forEach(x=>{ const [nm,hl]=String(x).split('|'); add(p,nm,{hl:hl||'',group:pth.slice(-2).join(' → ')},sec); });
          (nd.k||[]).forEach(c=>walk(c,pth)); };
        walk({n:b.n||b.title,d:b.d,k:b.k},[]); }
      if(b.t==='cols') b.cols.forEach(c=>(c.d||[]).forEach(x=>{ const [nm,hl]=String(x).split('|'); add(p,nm,{hl:hl||'',group:lClean(c.h||b.title||'')},sec); }));
      if(b.t==='cards') b.items.forEach(c=>add(p,c.n,{card:c,hl:c.hl||''},sec));
      const T=rxTab(b); if(T) b.rows.forEach(r=>{ const nmo=rxName(r[T.iN]); const mark=r.some(c=>/<mark>/.test(c));
        add(p,nmo.ru,{hl:mark?'y':'', rx:{la:nmo.la, tn:T.iT>=0?lClean(r[T.iT]):'', form:lClean(r[T.iF]||''), dose:T.iD>=0?lClean(r[T.iD]):'', ind:T.iI>=0?lClean(r[T.iI]):'', mark}},sec); });
    });
    p.blocks.forEach((b,bi)=>{ if(b.t==='graph') b.nodes.forEach(nd=>{ if(nd[4]!=='d') return; const it=findIn(p.id,lClean(String(nd[3]).replace(/\n/g,' '))); if(it&&!it.secs.includes(S[bi])) it.secs.push(S[bi]); }); });
  });
  items.forEach(it=>{ it.d=A.kFindDrug(it.n); it.e=A.uFind(it.n); it.hasBody=typeof VIT!=='undefined' && !!(VIT[it.n] || (it.d && VIT[it.d.n]));
    it.rp=it.e?A.rpAll(it.e):[]; it.hasRx=!!(it.rp.length||it.rx.length); });
  LDECK=items; lPublish(); return items;
}
const lPlateIdx=it=>KP.findIndex(p=>p.id===it.p);
/* наборы для прогона: всё занятие, разделы, группы */
function lSets(A,pid){
  const items=lDeck(A).filter(it=>it.p===pid); const p=KP.find(x=>x.id===pid); if(!p) return null;
  const heads=p.blocks.filter(b=>b.t==='h').map(b=>lClean(b.text));
  const secs=heads.map((t,i)=>({n:i+1, t, items:items.filter(it=>it.secs.includes(i+1))})).filter(s=>s.items.length);
  const gm=new Map(); items.forEach(it=>it.groups.forEach(g=>{ if(!gm.has(g)) gm.set(g,[]); gm.get(g).push(it); }));
  const groups=[...gm.entries()].filter(([,l])=>l.length>=2).map(([g,l])=>({g,items:l}));
  return {p, items, y:items.filter(it=>it.hl==='y'), yg:items.filter(it=>it.hl), rx:items.filter(it=>it.hasRx), hard:items.filter(it=>((lRec(it.id)||[])[3]||0)>0), secs, groups, heads};
}
function lPrefs(){ const d={lec:[], set:'all', mode:'today', nnew:15, goal:30, rev:true, rxf:true}; try{ const x=Object.assign(d, JSON.parse(localStorage.getItem(L_PREF)||'{}')); if(!['today','run','test','rp','prog','plan'].includes(x.mode)) x.mode='today'; return x; }catch(e){ return d; } }
function lPrefSave(pr){ try{ localStorage.setItem(L_PREF, JSON.stringify(pr)); }catch(e){} }
function lPool(items,pr){ return items.filter(it=>(!pr.lec.length||pr.lec.includes(it.p)) && (pr.set==='all' || (pr.set==='y'?it.hl==='y':it.hl))); }
const lFid=(it,f)=>f==='r'?'rv:'+it.id:f==='x'?'rx:'+it.id:it.id;
/* очередь на сегодня: просроченные + новые, новые вставлены между повторениями */
function lQueueToday(items,pr,extra){
  const t=lToday(); const due=[], fresh=[], fr=[], fx=[];
  items.forEach(it=>{ const m=lRec(it.id), r=lRec('rv:'+it.id), x=lRec('rx:'+it.id);
    if(lSeen(m)){ if(m[1]<=t) due.push({it,f:'m',due:m[1]}); } else fresh.push({it,f:'m'});
    if(pr.rev){ if(lSeen(r)){ if(r[1]<=t) due.push({it,f:'r',due:r[1]}); } else if(lSeen(m)&&m[0]>=3&&lHasClue(it)) fr.push({it,f:'r'}); }
    if(it.hasRx){ if(lSeen(x)){ if(x[1]<=t) due.push({it,f:'x',due:x[1]}); } else if(pr.rxf && it.hl && lSeen(m)) fx.push({it,f:'x'}); }
  });
  due.sort((a,b)=>a.due-b.due || a.it.ord-b.it.ord);
  fresh.sort((a,b)=>lRank[b.it.hl]-lRank[a.it.hl] || lPlateIdx(a.it)-lPlateIdx(b.it) || a.it.ord-b.it.ord);
  const leftM=Math.max(0,(pr.nnew+(extra||0))-(LST.nw[t]||0)), leftX=Math.max(0,Math.ceil(pr.nnew*0.7)+(extra||0)-(LST.nx[t]||0));
  const side=fx.concat(fr).slice(0,leftX);
  const nw=[]; const fm=fresh.slice(0,leftM); let a=0,b=0; while(a<fm.length||b<side.length){ if(a<fm.length) nw.push(fm[a++]); if(a<fm.length) nw.push(fm[a++]); if(b<side.length) nw.push(side[b++]); }
  const out=[]; let i=0,j=0; while(i<due.length||j<nw.length){ for(let k=0;k<3&&i<due.length;k++) out.push(due[i++]); if(j<nw.length) out.push(nw[j++]); }
  return {list:out, due:due.length, nw:nw.length, freshLeft:fresh.length-fm.length};
}

let lPubT=0;
function lPublish(){clearTimeout(lPubT);lPubT=setTimeout(lPublishNow,400);}
function lPublishNow(){try{
 if(!window.MAP||!LDECK)return;
 const by={};LDECK.forEach(it=>{const s=by[it.p]||(by[it.p]={total:0,learned:0,seen:0});s.total++;const r=lRec(it.id);if(lSeen(r))s.seen++;if(lSeen(r)&&r[0]>=4)s.learned++;});
 window.MAP.sections('farma',KP.map(p=>Object.assign({id:p.id,n:p.title,sub:p.lec||p.roman||'',locked:!!p.locked},by[p.id]||{total:0,learned:0,seen:0})));
}catch(e){}}

function lDueCount(A){ const t=lToday(); let n=0; lDeck(A).forEach(it=>{ ['', 'rv:', 'rx:'].forEach(px=>{ const r=lRec(px+it.id); if(lSeen(r)&&r[1]<=t) n++; }); }); return n; }
function lStat(items){ const t=lToday(); let due=0, nw=0, young=0, mature=0;
  items.forEach(it=>{ const r=lRec(it.id); if(!lSeen(r)) nw++; else { if(r[1]<=t) due++; if(r[0]>=21) mature++; else young++; } }); return {due,nw,young,mature,n:items.length}; }

/* ---------- лицевая и оборотная стороны ---------- */
const lHl=it=>it.hl==='y'?'<span class="kd hl-y">наизусть + рецепт</span>':it.hl==='g'?'<span class="kd hl-g">рецепт</span>':'';
function lFront(A,it){ return `<p class="lc-lec">${it.lec} · ${A.esc(it.title)}</p><h2 class="lc-n">${it.n}</h2>${lHl(it)}<p class="lc-ask">Вспомните: группа · механизм · показания · побочные эффекты</p>`; }
function lClue(A,it){
  const c=it.card;
  if(c&&c.fm&&c.fm.length) return `<p class="lc-q">«${c.fm[(it.ord+lToday())%c.fm.length]}»</p><p class="lc-ask">Возможная формулировка. Что за препарат?</p>`;
  const bits=[]; if(it.groups.length) bits.push('<b>Группа:</b> '+it.groups[0]);
  const pk=(c&&c.pok)||(it.d&&(it.d.i||[]).map(x=>x[0]))||[]; if(pk.length) bits.push('<b>Показания:</b> '+pk.slice(0,3).join('; '));
  const pe=(c&&c.pe)||(it.d&&(it.d.a||[]).map(x=>x[0]))||[]; if(pe.length&&bits.length<2) bits.push('<b>Побочные:</b> '+pe.slice(0,2).join('; '));
  return `<p class="lc-q">${bits.join('<br>')||'—'}</p><p class="lc-ask">Что за препарат?</p>`;
}
const lHasClue=it=>!!((it.card&&((it.card.fm&&it.card.fm.length)||(it.card.pok&&it.card.pok.length)))||it.groups.length||(it.d&&it.d.i&&it.d.i.length));
function lFrontRev(A,it,typed){ return `<p class="lc-lec">${it.lec} · ${A.esc(it.title)}</p>${lClue(A,it)}${typed?`<form class="lc-type" data-type="1" autocomplete="off"><label class="sr" for="lc-ans">Ваш ответ</label><input id="lc-ans" type="text" placeholder="Впишите название — Enter" autocomplete="off" autocapitalize="off" spellcheck="false"><button type="submit" class="btn">Проверить</button></form>`:''}`; }
function lRxForm(it){ const r=it.rx.find(x=>x.mark)||it.rx[0]; if(r&&r.form) return r.form; const p=it.rp[0]; return p?p.f:''; }
function lFrontRx(A,it){ const f=lRxForm(it); return `<p class="lc-lec">${it.lec} · ${A.esc(it.title)}</p><h2 class="lc-n">${it.n}</h2>${lHl(it)}<p class="lc-ask">${f?`Форма: <b>${A.esc(f)}</b><br>`:''}${it.rp.length?'Выпишите рецепт (на листке) и назовите дозу':'Назовите форму выпуска, дозу и способ применения'}</p>`; }
function lLinks(A,it){ const e=it.e, d=it.d; return `<div class="lb-l">${e?`<button type="button" class="btn pri" data-dr="${A.esc(e.n)}">Вся карточка →</button>`:''}${A.BY[it.p]?`<a class="btn" href="#${it.p}" data-kgo="${A.esc(it.n)}">Конспект ${it.lec} →</a>`:''}${it.hasBody?`<a class="btn" href="#body/${encodeURIComponent(VIT[it.n]?it.n:d.n)}">Организм →</a>`:''}</div>`; }
function lBack(A,it,rev){ const e=it.e; return `${rev?`<h2 class="lc-n">${it.n}</h2>${lHl(it)}`:`<h3 class="lc-n2">${it.n}</h3>`}${e?A.uLearnHTML(e):''}${lLinks(A,it)}`; }
function lBackRx(A,it){ const e=it.e; return `<h3 class="lc-n2">${it.n}</h3>${it.rp.length?`<div class="lb-s lb-rp"><h4>Рецепт${it.rp.length>1?'ы · '+it.rp.length:''}</h4><div class="rp-list">${it.rp.map(r=>A.rpHTML(r)).join('')}</div></div>`:''}${e?`<div class="lb-s u-dose"><h4>Доза и форма выпуска</h4>${A.uDoseHTML(e,{all:true,norp:true})}</div>`:''}${lLinks(A,it)}`; }
function lFace(A,c,typed){ const it=c.it; return c.f==='x'?{f:lFrontRx(A,it), b:lBackRx(A,it)} : c.f==='r'?{f:lFrontRev(A,it,typed), b:lBack(A,it,true)} : {f:lFront(A,it), b:lBack(A,it,false)}; }
const lFacetLab={m:'препарат → описание', r:'описание → препарат', x:'доза и рецепт'};

/* ответ с клавиатуры: сравнение с названиями с допуском опечаток */
const lNk=s=>String(s).toLowerCase().replace(/ё/g,'е').replace(/<[^>]+>/g,'').replace(/[^a-zа-я0-9]+/g,'');
function lLev(a,b){ if(a===b) return 0; const m=a.length, n=b.length; if(!m||!n) return m||n; let p=Array.from({length:n+1},(_,i)=>i); for(let i=1;i<=m;i++){ const c=[i]; for(let j=1;j<=n;j++) c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1)); p=c; } return p[n]; }
function lNames(it){ const s=new Set([it.n]); if(it.card) (it.card.al||[]).forEach(x=>s.add(lClean(x))); if(it.e){ s.add(it.e.n); it.e.names.forEach(x=>s.add(x)); } if(it.d){ s.add(it.d.n); (it.d.al||[]).forEach(x=>s.add(x)); } return [...s]; }
function lMatch(it,ans){ const a=lNk(ans); if(a.length<3) return false;
  return lNames(it).some(n=>{ const b=lNk(n); if(!b) return false; const tol=b.length>=10?2:(b.length>=5?1:0); if(lLev(a,b)<=tol) return true;
    const w=lNk(String(n).split(/[\s(,+]/)[0]); return w.length>=5 && lLev(a,w)<=(w.length>=10?2:1); }); }

/* ---------- страница ---------- */
EXTRA.routes.learn=function(A,arg){
  const items=lDeck(A); const pr=lPrefs();
  if(arg){ const pid=decodeURIComponent(arg); if(A.BY[pid]){ pr.lec=[pid]; lPrefSave(pr); } }
  const page=A.$('#page');
  const plates=KP.filter(p=>items.some(it=>it.p===p.id));
  page.innerHTML=`<header><p class="eyebrow">Учить · ${items.length} ${A.plur(items.length,'препарат','препарата','препаратов')} из конспектов</p><h1 class="title">Учить препараты</h1>
  <p class="lead">Каждый день — короткая сессия: повторения, которые пора освежить, и немного новых карточек. Интервалы растут, когда вы помните, и сокращаются, когда забываете. Прогон — чтобы пройти всё занятие, раздел или группу целиком перед зачётом.</p></header>
  <div class="l-top"><div class="l-stats" id="lstats"></div><span class="l-sync" id="lsync"></span></div>
  <div class="l-filt">
    <div class="l-lec" role="group" aria-label="Лекции"><button type="button" data-lec="" aria-pressed="${!pr.lec.length}">Все</button>${plates.map(p=>`<button type="button" data-lec="${p.id}" aria-pressed="${pr.lec.includes(p.id)}" title="${A.esc(p.title)}">${p.roman}</button>`).join('')}</div>
    <div class="seg l-set" role="group" aria-label="Набор"><button type="button" data-set="all" aria-pressed="${pr.set==='all'}">Все препараты</button><button type="button" data-set="yg" aria-pressed="${pr.set==='yg'}">Жёлтые + зелёные</button><button type="button" data-set="y" aria-pressed="${pr.set==='y'}">Только жёлтые</button></div>
  </div>
  <div class="l-tabs" role="tablist">${[['today','Сегодня'],['run','Прогон'],['test','Тест'],['rp','Рецепты'],['prog','Прогресс'],['plan','План до экзамена']].map(([k,t])=>`<button type="button" role="tab" data-mode="${k}" aria-selected="${pr.mode===k}">${t}</button>`).join('')}</div>
  <div id="lmain" class="l-main"></div>`;
  lBadge(); lCloudInit();
  const st={pr, A, items, extra:0};
  LREFRESH=()=>{ if(!document.getElementById('lmain')) return; lStats(st); if(st.pr.mode==='prog'||st.pr.mode==='run') lMode(st); };
  page.querySelector('.l-lec').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; const id=b.dataset.lec;
    if(!id) pr.lec=[]; else pr.lec = pr.lec.includes(id) ? pr.lec.filter(x=>x!==id) : pr.lec.concat(id);
    page.querySelectorAll('.l-lec button').forEach(x=>x.setAttribute('aria-pressed', x.dataset.lec? String(pr.lec.includes(x.dataset.lec)) : String(!pr.lec.length)));
    lPrefSave(pr); lMode(st); });
  page.querySelector('.l-set').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; pr.set=b.dataset.set; page.querySelectorAll('.l-set button').forEach(x=>x.setAttribute('aria-pressed',String(x===b))); lPrefSave(pr); lMode(st); });
  page.querySelector('.l-tabs').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; pr.mode=b.dataset.mode; page.querySelectorAll('.l-tabs button').forEach(x=>x.setAttribute('aria-selected',String(x===b))); lPrefSave(pr); lMode(st); });
  lMode(st);
};
function lStats(st){
  const pool=lPool(st.items,st.pr); const s=lStat(pool); const t=lToday();
  let dueAll=0; pool.forEach(it=>['', 'rv:', 'rx:'].forEach(px=>{ const r=lRec(px+it.id); if(lSeen(r)&&r[1]<=t) dueAll++; }));
  const el=document.getElementById('lstats'); if(!el) return;
  const k=lStreak(), today=LST.days[t]||0, goal=st.pr.goal||30;
  el.innerHTML=`<div><b>${dueAll}</b><span>к повторению</span></div><div><b>${s.nw}</b><span>ещё не начаты</span></div><div><b>${s.mature}</b><span>прочно из ${s.n}</span></div><div class="l-fire${k?' on':''}"><b>${k}</b><span>${A_plur(k,'день подряд','дня подряд','дней подряд')}</span></div><div class="l-goal${today>=goal?' on':''}"><b>${today}<small>/${goal}</small></b><span>карточек сегодня</span></div>`;
}
const A_plur=(n,a,b,c)=>{ const m=n%10, h=n%100; return m===1&&h!==11?a:(m>=2&&m<=4&&(h<12||h>14)?b:c); };
function lMode(st){
  lStats(st); document.onkeydown=null;
  const m=st.pr.mode, box=document.getElementById('lmain'); if(!box) return;
  box.dataset.mode=m;
  if(m==='today') lSession(st,box); else if(m==='run') lRunTab(st,box); else if(m==='test') lTestBox(st.A,box,lPool(st.items,st.pr),st.items,10,()=>lStats(st)); else if(m==='rp') lRpTab(st,box); else if(m==='plan') lPlanTab(st,box); else lProg(st,box);
}

/* ---------- сессия «Сегодня» ---------- */
function lSession(st,box){
  const A=st.A; const pool=lPool(st.items,st.pr);
  const q=lQueueToday(pool,st.pr,st.extra); const list=q.list; let i=0, flipped=false, typedRes=null; const done={1:0,2:0,3:0,4:0}; let undo=null;
  const settings=()=>`<details class="l-set2"><summary>Настройки повторения</summary><div class="l-set2-b">
    <div><span>Новых в день</span><div class="seg" role="group" aria-label="Новых карточек в день">${[...new Set([5,10,15,25,40,st.pr.nnew])].sort((a,b)=>a-b).map(n=>`<button type="button" data-nn="${n}" aria-pressed="${st.pr.nnew===n}">${n}</button>`).join('')}</div></div>
    <div><span>Цель на день</span><div class="seg" role="group" aria-label="Цель на день">${[...new Set([20,30,50,80,st.pr.goal||30])].sort((a,b)=>a-b).map(n=>`<button type="button" data-goal="${n}" aria-pressed="${(st.pr.goal||30)===n}">${n}</button>`).join('')}</div></div>
    <label class="l-chk"><input type="checkbox" id="l-rev" data-opt="rev"${st.pr.rev?' checked':''}> Обратные карточки «описание → препарат» — после того как препарат запомнился</label>
    <label class="l-chk"><input type="checkbox" id="l-rxf" data-opt="rxf"${st.pr.rxf?' checked':''}> Дозы и рецепты для жёлтых и зелёных препаратов</label></div></details>`;
  const head=()=>`<div class="l-sess"><p>${list.length?`В сессии <b>${list.length}</b>: повторить ${q.due}, новых ${q.nw}.`:''}</p>${settings()}</div>`;
  const rateBar=c=>{ const r=lRec(lFid(c.it,c.f)); const lab=['Снова','Трудно','Хорошо','Легко']; return `<div class="l-rate l-rate4" hidden>${[1,2,3,4].map(g=>`<button type="button" class="r${g}" data-r="${g}"><span>${lab[g-1]}</span><small>${lIvTxt(lNextIv(r,g))}</small><kbd>${g}</kbd></button>`).join('')}</div>`; };
  const draw=()=>{
    if(!list.length){ box.innerHTML=`${head()}<div class="l-empty"><h2>${pool.length?'На сегодня всё':'В этом наборе нет препаратов'}</h2><p>${pool.length?(q.freshLeft?`Повторения выполнены, лимит новых карточек на сегодня исчерпан. Осталось ещё ${q.freshLeft} новых.`:'Повторения выполнены, новых карточек не осталось.'):'Выберите другие лекции или набор.'}</p><div class="l-more">${q.freshLeft?'<button type="button" class="btn pri" data-more="1">Ещё 10 новых</button>':''}<button type="button" class="btn" data-goto="run">Прогнать занятие</button><button type="button" class="btn" data-goto="test">Пройти тест</button></div></div>`; return; }
    if(i>=list.length){ const tot=done[1]+done[2]+done[3]+done[4]; box.innerHTML=`${head()}<div class="l-empty"><h2>Сессия завершена</h2><p>Карточек: ${tot}. Легко — ${done[4]}, хорошо — ${done[3]}, трудно — ${done[2]}, снова — ${done[1]}.</p><div class="l-more"><button type="button" class="btn pri" data-again="1">Продолжить</button><button type="button" class="btn" data-goto="run">Прогнать занятие</button><button type="button" class="btn" data-goto="test">Пройти тест</button></div></div>`; if(done[3]+done[4]>=Math.max(5,tot*0.8)) lConfetti(box); lStats(st); lRefreshAll(); return; }
    const c=list[i]; const r=lRec(lFid(c.it,c.f)); const F=lFace(A,c,c.f==='r'); typedRes=null;
    box.innerHTML=`${head()}<div class="l-prog"><span style="--p:${(i/list.length*100).toFixed(1)}%"></span></div><p class="l-count">${i+1} из ${list.length} · ${lSeen(r)?(r[0]===0?'переучивание':'повторение'):'новая'} · ${lFacetLab[c.f]}${undo?` <button type="button" class="l-undo" data-undo="1">↶ Отменить оценку</button>`:''}</p>
    <div class="lc" id="lc"><div class="lc-in"><div class="lc-f">${F.f}<button type="button" class="btn pri lc-show" data-flip="1">Показать ответ <kbd>пробел</kbd></button></div><div class="lc-b"><div class="lc-res" hidden></div>${F.b}</div></div></div>${rateBar(c)}`;
    flipped=false;
  };
  const flip=()=>{ const c=document.getElementById('lc'); if(!c||flipped) return; flipped=true; c.classList.add('flip'); box.querySelector('.l-rate').hidden=false; const rb=box.querySelector(`.l-rate [data-r="${typedRes===false?1:3}"]`); if(rb) rb.classList.add('sug'); };
  const rate=g=>{ if(!flipped) return; const c=list[i]; const id=lFid(c.it,c.f); const prev=LST.items[id]?LST.items[id].slice():null; const wasNew=!lSeen(prev);
    const snap={days:Object.assign({},LST.days), nw:Object.assign({},LST.nw), nx:Object.assign({},LST.nx)};
    lRate(id,g); done[g]++;
    let ins=-1; if(g===1){ ins=Math.min(i+4,list.length); list.splice(ins,0,Object.assign({},c,{re:true})); } else if(g===2 && wasNew && !c.re){ ins=Math.min(i+8,list.length); list.splice(ins,0,Object.assign({},c,{re:true})); }
    undo={id,prev,g,i,ins,snap}; i++; lStats(st); draw(); const dn=document.querySelector('#nav .due'); if(dn){ const n=lDueCount(A); dn.textContent=n; dn.hidden=!n; } };
  const doUndo=()=>{ if(!undo) return; if(undo.prev) LST.items[undo.id]=undo.prev; else delete LST.items[undo.id]; LST.days=undo.snap.days; LST.nw=undo.snap.nw; LST.nx=undo.snap.nx; lSave(); done[undo.g]--; if(undo.ins>=0) list.splice(undo.ins,1); i=undo.i; undo=null; lStats(st); draw(); };
  const check=()=>{ const inp=document.getElementById('lc-ans'); if(!inp||flipped) return; const v=inp.value.trim(); if(!v){ flip(); return; } const c=list[i]; typedRes=lMatch(c.it,v);
    inp.blur(); const res=box.querySelector('.lc-res'); if(res){ res.hidden=false; res.className='lc-res '+(typedRes?'ok':'no'); res.innerHTML=typedRes?`<b>Верно</b> · ваш ответ: ${st.A.esc(v)}`:`<b>Не совпало</b> · ваш ответ: ${st.A.esc(v)}`; } flip(); };
  box.onclick=e=>{ const t=e.target;
    if(t.closest('[data-flip]')||(t.closest('.lc-f')&&!t.closest('a,button,input,form,label'))){ if(box.querySelector('#lc-ans')&&box.querySelector('#lc-ans').value.trim()) check(); else flip(); return; }
    const r=t.closest('[data-r]'); if(r){ rate(+r.dataset.r); return; }
    if(t.closest('[data-undo]')){ doUndo(); return; }
    if(t.closest('[data-more]')){ st.extra+=10; lSession(st,box); return; }
    if(t.closest('[data-again]')){ lSession(st,box); return; }
    const nn=t.closest('[data-nn]'); if(nn){ st.pr.nnew=+nn.dataset.nn; lPrefSave(st.pr); lSession(st,box); return; }
    const gl=t.closest('[data-goal]'); if(gl){ st.pr.goal=+gl.dataset.goal; lPrefSave(st.pr); lStats(st); box.querySelectorAll('[data-goal]').forEach(x=>x.setAttribute('aria-pressed',String(x===gl))); return; }
    const g=t.closest('[data-goto]'); if(g){ const tb=document.querySelector(`.l-tabs [data-mode="${g.dataset.goto}"]`); if(tb) tb.click(); }
  };
  box.onchange=e=>{ const o=e.target.closest('[data-opt]'); if(o){ st.pr[o.dataset.opt]=o.checked; lPrefSave(st.pr); const open=true; lSession(st,box); const d=box.querySelector('.l-set2'); if(d&&open) d.open=true; } };
  box.onsubmit=e=>{ if(e.target.closest('[data-type]')){ e.preventDefault(); check(); } };
  document.onkeydown=e=>{ if(!document.getElementById('lc')) return; const typing=/input|textarea|select/i.test(e.target.tagName||'');
    if(typing){ if(e.key==='Escape'){ e.target.blur(); } return; }
    if(e.key===' '||e.key==='Enter'){ if(!flipped){ e.preventDefault(); flip(); } else if(e.key===' '){ e.preventDefault(); } }
    else if(['1','2','3','4'].includes(e.key)) rate(+e.key);
    else if(e.key==='Backspace'&&undo){ e.preventDefault(); doUndo(); } };
  draw();
}

/* ---------- вкладка «Прогон» ---------- */
function lRunTab(st,box){
  const A=st.A; const plates=KP.filter(p=>st.items.some(it=>it.p===p.id));
  const cur=(st.runP && plates.find(p=>p.id===st.runP)) || plates.find(p=>st.pr.lec.includes(p.id)) || plates[0]; st.runP=cur.id;
  const S=lSets(A,cur.id); const sm=lStat(S.items);
  const parts=(A.kParts?A.kParts(cur):[]).map(pt=>Object.assign({},pt,{items:S.items.filter(it=>it.secs.some(n=>n>=pt.from&&n<=pt.to))})).filter(pt=>pt.items.length&&pt.items.length<S.items.length);
  const btns=(key,n,rx)=>`<span class="lr-a"><button type="button" class="btn pri" data-run="${key}" data-m="cards">Карточки · ${n}</button><button type="button" class="btn" data-run="${key}" data-m="test">Тест</button>${rx?`<button type="button" class="btn" data-run="${key}" data-m="rx">Рецепты · ${rx}</button>`:''}</span>`;
  box.innerHTML=`<div class="lr-p" role="group" aria-label="Лекция">${plates.map(p=>`<button type="button" data-rp="${p.id}" aria-pressed="${p.id===cur.id}" title="${A.esc(p.title)}">${p.roman}</button>`).join('')}</div>
  <section class="lr-card"><p class="eyebrow">${A.esc(cur.lec||'')}</p><h2>${A.esc(cur.title)}</h2>
   <p class="lr-st">${sm.n} ${A_plur(sm.n,'препарат','препарата','препаратов')}: прочно ${sm.mature}, в процессе ${sm.young}, не начаты ${sm.nw}${sm.due?`, к повторению ${sm.due}`:''}.</p>
   <div class="lr-row lr-main"><span class="lr-t"><b>Всё занятие</b><small>каждый препарат лекции по порядку конспекта</small></span>${btns('all',S.items.length,S.rx.length)}</div>
   ${S.yg.length?`<div class="lr-row"><span class="lr-t"><b>Жёлтые и зелёные</b><small>то, что выписывают и учат наизусть</small></span>${btns('yg',S.yg.length,S.yg.filter(x=>x.hasRx).length)}</div>`:''}
   ${S.hard.length?`<div class="lr-row"><span class="lr-t"><b>Трудные</b><small>были ошибки</small></span>${btns('hard',S.hard.length,0)}</div>`:''}
  </section>
  ${parts.length?`<section class="lr-card"><h3>По частям лекции</h3>${parts.map((pt,pi)=>`<div class="lr-row"><span class="lr-t"><b>${A.esc(pt.t)}</b><small>${pt.items.length} ${A_plur(pt.items.length,'препарат','препарата','препаратов')}</small></span>${btns('p'+pi,pt.items.length,pt.items.filter(x=>x.hasRx).length)}</div>`).join('')}</section>`:''}
  ${S.secs.length?`<section class="lr-card"><h3>По разделам</h3>${S.secs.map(s=>`<div class="lr-row"><span class="lr-t"><b><i>${s.n}</i> ${A.esc(s.t)}</b><small>${s.items.length} ${A_plur(s.items.length,'препарат','препарата','препаратов')}</small></span>${btns('s'+s.n,s.items.length,0)}</div>`).join('')}</section>`:''}
  ${S.groups.length?`<details class="lr-card lr-g"><summary><h3>По группам · ${S.groups.length}</h3></summary>${S.groups.map((g,gi)=>`<div class="lr-row"><span class="lr-t"><b>${A.esc(g.g)}</b><small>${g.items.map(x=>x.n).slice(0,6).join(', ')}${g.items.length>6?'…':''}</small></span>${btns('g'+gi,g.items.length,0)}</div>`).join('')}</details>`:''}`;
  box.onclick=e=>{ const p=e.target.closest('[data-rp]'); if(p){ st.runP=p.dataset.rp; lRunTab(st,box); return; }
    const b=e.target.closest('[data-run]'); if(!b) return; const k=b.dataset.run; let set=null, title='';
    if(k==='all'){ set=S.items; title='Всё занятие'; } else if(k==='yg'){ set=S.yg; title='Жёлтые и зелёные'; } else if(k==='hard'){ set=S.hard; title='Трудные'; }
    else if(k[0]==='s'){ const s=S.secs.find(x=>x.n===+k.slice(1)); set=s.items; title='Раздел «'+s.t+'»'; } else if(k[0]==='g'){ const g=S.groups[+k.slice(1)]; set=g.items; title=g.g; } else if(k[0]==='p'){ const pt=parts[+k.slice(1)]; set=pt.items; title='Часть «'+pt.t+'»'; }
    RUN.open({items:set, mode:b.dataset.m, title, eyebrow:'Прогон · '+cur.roman+' · '+cur.title, opener:b, done:()=>{ lStats(st); if(document.getElementById('lmain')&&st.pr.mode==='run') lRunTab(st,box); }}); };
}

/* ---------- вкладка «Рецепты» ---------- */
function lRpTab(st,box){
  const A=st.A; const pool=lPool(st.items,st.pr).filter(it=>it.rp.length);
  const total=pool.reduce((s,it)=>s+it.rp.length,0);
  const byP=KP.map(p=>({p, its:pool.filter(it=>it.p===p.id)})).filter(x=>x.its.length);
  box.innerHTML=`<div class="lrp-top"><p>${pool.length} ${A_plur(pool.length,'препарат','препарата','препаратов')}, ${total} ${A_plur(total,'рецепт','рецепта','рецептов')}. Рецепты выписаны на каждую форму выпуска из списков «для выписывания».</p><div class="lrp-a"><label class="sr" for="lrpq">Найти препарат</label><input id="lrpq" type="search" placeholder="Найти препарат" autocomplete="off"><button type="button" class="btn pri" data-rxrun="1">Тренировать рецепты · ${pool.length}</button></div></div>
  ${byP.map(({p,its})=>`<section class="lrp-sec"><h3><span class="roman">${p.roman}</span> ${A.esc(p.title)}</h3>${its.map(it=>`<details class="lrp-it" data-f="${A.esc(lNk(lNames(it).join(' ')))}"><summary><b class="${it.hl?'kd hl-'+it.hl:''}">${it.n}</b><small>${it.rp.length} ${A_plur(it.rp.length,'рецепт','рецепта','рецептов')} · ${A.esc(it.rp.map(r=>r.f).join('; ')).slice(0,120)}</small></summary><div class="rp-list">${it.rp.map(r=>A.rpHTML(r)).join('')}</div></details>`).join('')}</section>`).join('')}`;
  const q=box.querySelector('#lrpq'); q.addEventListener('input',()=>{ const v=lNk(q.value); box.querySelectorAll('.lrp-it').forEach(d=>d.hidden=!!v&&!d.dataset.f.includes(v)); box.querySelectorAll('.lrp-sec').forEach(s=>s.hidden=![...s.querySelectorAll('.lrp-it')].some(d=>!d.hidden)); });
  box.onclick=e=>{ if(e.target.closest('[data-rxrun]')){ const v=lNk(q.value); const set=v?pool.filter(it=>lNk(lNames(it).join(' ')).includes(v)):pool; RUN.open({items:set, mode:'rx', title:'Рецепты', eyebrow:'Прогон рецептов', opener:e.target.closest('button'), shuffle:true, done:()=>lStats(st)}); } };
}

/* ---------- тест ---------- */
function lShuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
/* похожие формулировки: совпадение значимых основ слов (чтобы дистрактор не оказался тоже верным) */
const lStems=t=>[...new Set(String(t).toLowerCase().replace(/<[^>]+>/g,'').split(/[^a-zа-яё0-9]+/i).filter(w=>w.length>=5).map(w=>w.slice(0,6)))];
function lLike(t,list){ const st=lStems(t); if(!st.length) return (list||[]).some(y=>y.toLowerCase()===String(t).toLowerCase()); const need=Math.max(1,Math.ceil(st.length/2)); return (list||[]).some(y=>{ const ys=lStems(y); return st.filter(x=>ys.includes(x)).length>=need; }); }
const RP_STOP=new Set(['Tab','Sol','Caps','Ung','Gel','Supp','Emuls','Susp','Tinct','Dragee','Empl','Extr','Extracti','Sir','Fol','Cort','Rhiz','Aër','Aer']);
function lRpBlank(A,r){ const m=r.l.map(s=>s.replace(/^(Rp\.:)(.*)$/,(_,k,t)=>k+t.replace(/«[^»]+»/g,'«______»').replace(/\b[A-Z][a-zë]{3,}\b/g,w=>RP_STOP.has(w)?w:'______'))); return A.rpHTML({f:'',l:m},{nocopy:true}); }
function lQuestions(A,pool,all,N){
  const qs=[];
  const others=(it,pred)=>lShuffle(pool.filter(x=>x!==it&&x.p===it.p&&pred(x))).concat(lShuffle(all.filter(x=>x!==it&&x.p!==it.p&&pred(x))));
  const pickD=(it,pred)=>{ const o=[]; const seenN=new Set([it.n.toLowerCase()]); for(const x of others(it,pred)){ if(!seenN.has(x.n.toLowerCase())){ seenN.add(x.n.toLowerCase()); o.push(x.n); } if(o.length===3) break; } return o; };
  const gens=[
    it=>{ const fm=it.card&&it.card.fm; if(!fm||!fm.length) return null; const f=fm[Math.floor(Math.random()*fm.length)]; const ds=pickD(it,x=>!(x.card&&x.card.fm&&x.card.fm.includes(f))); return ds.length<3?null:{q:`Возможная формулировка: <b>«${f}»</b>. Какой это препарат?`, a:it.n, opts:ds}; },
    it=>{ if(!it.groups.length) return null; const g=it.groups[0]; const gs=lShuffle([...new Set(pool.concat(all).filter(x=>x.p===it.p).flatMap(x=>x.groups))].filter(x=>!it.groups.includes(x))).slice(0,3); return gs.length<3?null:{q:`К какой группе относится <b>${it.n}</b>?`, a:g, opts:gs}; },
    it=>{ if(!it.groups.length) return null; const g=it.groups[0]; const ds=pickD(it,x=>!x.groups.includes(g)); return ds.length<3?null:{q:`Какой препарат относится к группе <b>${g}</b>?`, a:it.n, opts:ds}; },
    it=>{ const pk=it.card&&it.card.pok; if(!pk||!pk.length) return null; const p=pk[Math.floor(Math.random()*pk.length)]; const ds=pickD(it,x=>!lLike(p,[].concat((x.card&&x.card.pok)||[],(x.d&&(x.d.i||[]).map(z=>z[0]))||[],x.card&&x.card.x?[x.card.x]:[]))); return ds.length<3?null:{q:`Показание из конспекта: <b>${p}</b>. Какой препарат?`, a:it.n, opts:ds}; },
    it=>{ const pe=it.card&&it.card.pe; if(!pe||!pe.length) return null; const p=pe[Math.floor(Math.random()*pe.length)]; const ds=pickD(it,x=>!lLike(p,[].concat((x.card&&x.card.pe)||[],(x.d&&(x.d.a||[]).map(z=>z[0]))||[]))); return ds.length<3?null:{q:`Побочный эффект из конспекта: <b>${p}</b>. У какого препарата?`, a:it.n, opts:ds}; },
    it=>{ const r=it.rx.find(x=>x.mark)||it.rx[0]; if(!r||!r.dose) return null; const ds=pickD(it,x=>x.rx.length>0); return ds.length<3?null:{q:`Способ применения и доза: <b>«${r.dose.length>180?r.dose.slice(0,180)+'…':r.dose}»</b>. Какой препарат?`, a:it.n, opts:ds}; },
    it=>{ if(!it.rp.length) return null; const r=it.rp[Math.floor(Math.random()*it.rp.length)]; const ds=pickD(it,x=>x.rp.length>0); return ds.length<3?null:{q:`Чей это рецепт? Название препарата скрыто.${lRpBlank(A,r)}`, a:it.n, opts:ds}; }
  ];
  const cand=lShuffle(pool.slice());
  const hard=cand.filter(it=>((lRec(it.id)||[])[3]||0)>0).sort((a,b)=>lRec(b.id)[3]-lRec(a.id)[3]).slice(0,Math.ceil(N/3));
  const rich=cand.filter(it=>it.card||it.rx.length||it.rp.length);
  const usedIt=new Set(); let guard=0;
  const tryIt=it=>{ if(!it||usedIt.has(it.id)) return false; const order=(it.card||it.rx.length||it.rp.length)?lShuffle([0,3,4,5,6]).concat(lShuffle([1,2])):lShuffle([1,2]);
    for(const gi of order){ const q=gens[gi](it); if(q){ usedIt.add(it.id); q.it=it; q.opts=lShuffle([q.a].concat(q.opts)); qs.push(q); return true; } } return false; };
  hard.forEach(it=>{ if(qs.length<N) tryIt(it); });
  while(qs.length<N && guard<N*30 && cand.length){ guard++;
    const src=(guard%3!==0 && rich.length)?rich:cand; tryIt(src[Math.floor(Math.random()*src.length)]); }
  return lShuffle(qs);
}
function lTestBox(A,box,pool,all,N,onDone,ctl){
  const qs=lQuestions(A,pool,all,N); let i=0, score=0, answered=false; const wrong=[];
  if(!qs.length){ box.innerHTML=`<div class="l-empty"><h2>Недостаточно данных для теста</h2><p>Выберите больше лекций или набор «Все препараты».</p></div>`; return; }
  const draw=()=>{
    if(i>=qs.length){ const pct=Math.round(score/qs.length*100);
      box.innerHTML=`<div class="l-res"><svg viewBox="0 0 120 120" class="l-ring"><circle cx="60" cy="60" r="52" class="rg-bg"/><circle cx="60" cy="60" r="52" class="rg-fg" style="--p:${pct}"/></svg><div class="l-res-t"><b>${score} из ${qs.length}</b><span>${pct>=90?'Отлично — уровень зачёта':pct>=70?'Хорошо, повторите ошибки':'Стоит прогнать карточки'}</span></div></div>${wrong.length?`<div class="bd-card"><h3>Ошибки</h3><ul class="l-wrong">${wrong.map(w=>`<li><span>${w.q}</span><b>${w.a}</b></li>`).join('')}</ul></div>`:''}<div class="l-more"><button type="button" class="btn pri" data-new="1">Новый тест</button>${wrong.length?`<button type="button" class="btn" data-wrong="1">Прогнать ошибки · ${wrong.length}</button>`:''}${ctl?'':`<button type="button" class="btn" data-goto="today">К карточкам</button>`}</div>`;
      if(pct>=80) lConfetti(box); if(onDone) onDone(); return; }
    const q=qs[i]; answered=false;
    box.innerHTML=`<div class="l-prog"><span style="--p:${(i/qs.length*100).toFixed(1)}%"></span></div><p class="l-count">Вопрос ${i+1} из ${qs.length} · ${q.it.lec}</p><div class="l-q"><div class="l-qq">${q.q}</div><div class="l-opts">${q.opts.map((o,k)=>`<button type="button" data-o="${k}"><kbd>${k+1}</kbd>${o}</button>`).join('')}</div><div class="l-fb" hidden></div></div>`;
  };
  const answer=k=>{ if(answered) return; answered=true; const q=qs[i]; const ok=q.opts[k]===q.a;
    box.querySelectorAll('.l-opts button').forEach((b,j)=>{ b.disabled=true; if(q.opts[j]===q.a) b.classList.add('ok'); else if(j===k) b.classList.add('no'); });
    if(ok) score++; else wrong.push({q:q.q.replace(/<figure[\s\S]*<\/figure>/,' [рецепт]').replace(/<[^>]+>/g,''),a:q.a,it:q.it});
    lTouch(q.it.id,ok);
    const fb=box.querySelector('.l-fb'); fb.hidden=false; const it=q.it;
    fb.innerHTML=`<p class="${ok?'ok':'no'}"><b>${ok?'Верно.':'Неверно.'}</b> ${it.n}${it.groups[0]?' — '+it.groups[0]:''}${it.card&&it.card.kl?'; кл: '+it.card.kl:''}</p><button type="button" class="btn pri" data-next="1">Дальше <kbd>Enter</kbd></button>`;
  };
  box.onclick=e=>{ const o=e.target.closest('[data-o]'); if(o){ answer(+o.dataset.o); return; } if(e.target.closest('[data-next]')){ i++; draw(); return; } if(e.target.closest('[data-new]')){ lTestBox(A,box,pool,all,N,onDone,ctl); return; }
    if(e.target.closest('[data-wrong]')){ const set=[...new Set(wrong.map(w=>w.it))]; if(ctl&&ctl.cards) ctl.cards(set); else RUN.open({items:set, mode:'cards', title:'Ошибки теста', eyebrow:'Прогон', opener:e.target.closest('button')}); return; }
    const g=e.target.closest('[data-goto]'); if(g){ const tb=document.querySelector(`.l-tabs [data-mode="${g.dataset.goto}"]`); if(tb) tb.click(); } };
  const key=e=>{ if(!box.querySelector('.l-q')||/input|textarea/i.test(e.target.tagName||'')) return false; if(['1','2','3','4'].includes(e.key)){ answer(+e.key-1); return true; } if(e.key==='Enter'&&answered){ e.preventDefault(); i++; draw(); return true; } return false; };
  if(ctl) ctl.key=key; else document.onkeydown=key;
  draw();
}

/* ---------- прогресс ---------- */
function lProg(st,box){
  const A=st.A; const items=st.items; const plates=KP.filter(p=>items.some(it=>it.p===p.id)); const t=lToday();
  const rows=plates.map(p=>{ const s=lStat(items.filter(it=>it.p===p.id)); return {p,s}; });
  const hard=items.filter(it=>((lRec(it.id)||[])[3]||0)>=2).sort((a,b)=>lRec(b.id)[3]-lRec(a.id)[3]).slice(0,16);
  const days=[]; for(let d=t-34; d<=t; d++) days.push([d,LST.days[d]||0]); const mx=Math.max(1,...days.map(x=>x[1]));
  const fc=[]; for(let d=0; d<7; d++){ let n=0; Object.values(LST.items).forEach(r=>{ if(r[2] && (d===0?r[1]<=t:r[1]===t+d)) n++; }); fc.push(n); } const fmx=Math.max(1,...fc);
  const wd=['вс','пн','вт','ср','чт','пт','сб']; const today=new Date();
  box.innerHTML=`<div class="bd-card"><h3>По лекциям</h3><div class="l-bars">${rows.map(({p,s})=>`<a class="l-bar" href="#learn/${p.id}"><span class="l-bl">${p.roman}</span><span class="l-bt">${A.esc(p.title)}</span><span class="l-bb"><i class="k" style="width:${(s.mature/s.n*100).toFixed(1)}%"></i><i class="l" style="width:${(s.young/s.n*100).toFixed(1)}%"></i></span><span class="l-bn">${s.mature+s.young}/${s.n}</span></a>`).join('')}</div><p class="l-leg"><i class="k"></i>прочно (интервал от 3 недель) <i class="l"></i>в процессе <i class="n"></i>не начаты</p></div>
  <div class="bd-card"><h3>Прогноз повторений на неделю</h3><div class="l-fc">${fc.map((n,d)=>`<div><b>${n}</b><span style="--h:${(n/fmx*100).toFixed(0)}%"></span><small>${d===0?'сегодня':wd[(today.getDay()+d)%7]}</small></div>`).join('')}</div></div>
  <div class="bd-card"><h3>Активность за 5 недель</h3><div class="l-heat">${days.map(([d,n])=>`<i title="${n} карточек" style="--a:${n?0.25+0.75*n/mx:0}"></i>`).join('')}</div></div>
  ${hard.length?`<div class="bd-card"><h3>Трудные препараты</h3><div class="bd-sugg">${hard.map(it=>`<a class="bd-chip" href="#${it.p}" data-kgo="${A.esc(it.n)}">${it.n} <small>×${lRec(it.id)[3]}</small></a>`).join('')}</div><div class="l-more" style="justify-content:flex-start"><button type="button" class="btn pri" data-hardrun="1">Прогнать трудные · ${hard.length}</button></div></div>`:''}
  <div class="l-more"><button type="button" class="btn" data-reset="1">Сбросить прогресс</button></div>`;
  box.onclick=e=>{ if(e.target.closest('[data-hardrun]')){ RUN.open({items:hard, mode:'cards', title:'Трудные препараты', eyebrow:'Прогон', opener:e.target.closest('button'), done:()=>{ lStats(st); lProg(st,box); }}); return; }
    if(e.target.closest('[data-reset]')){ if(box.querySelector('.l-confirm')) return; const c=document.createElement('div'); c.className='l-confirm'; c.innerHTML='<p>Удалить весь прогресс обучения? Это нельзя отменить.</p><button type="button" class="btn pri" data-reset-ok="1">Удалить</button> <button type="button" class="btn" data-reset-no="1">Отмена</button>'; box.appendChild(c); return; }
    if(e.target.closest('[data-reset-ok]')){ LST={v:2,items:{},days:{},nw:{},nx:{}}; lSave(); lProg(st,box); lStats(st); lRefreshAll(); return; }
    if(e.target.closest('[data-reset-no]')){ const c=box.querySelector('.l-confirm'); if(c) c.remove(); } };
}

/* ---------- план до экзамена ---------- */
const L_PLAN='atlas-plan';
function lPlanGet(){ try{ const x=JSON.parse(localStorage.getItem(L_PLAN)||'null'); return x&&x.date?Object.assign({lec:[],res:2},x):null; }catch(e){ return null; } }
function lPlanSet(x){ try{ if(x&&x.date) localStorage.setItem(L_PLAN,JSON.stringify(x)); else localStorage.removeItem(L_PLAN); }catch(e){} }
const lDayOf=s=>{ const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||''); return m?Math.floor(Date.UTC(+m[1],m[2]-1,+m[3])/864e5):null; };
const lDayStr=d=>new Date(d*864e5).toISOString().slice(0,10);
const lDayFmt=d=>{ const x=new Date(d*864e5); return ['вс','пн','вт','ср','чт','пт','сб'][x.getUTCDay()]+' '+String(x.getUTCDate()).padStart(2,'0')+'.'+String(x.getUTCMonth()+1).padStart(2,'0'); };
function lPlanCalc(items,plan,set){
  const t=lToday(), ex=lDayOf(plan.date); if(ex==null) return null; const days=ex-t;
  const pool=lPool(items,{lec:plan.lec||[], set:set||'all'});
  const fresh=pool.filter(it=>!lSeen(lRec(it.id))).sort((a,b)=>lRank[b.hl]-lRank[a.hl] || lPlateIdx(a)-lPlateIdx(b) || a.ord-b.ord);
  const doneToday=LST.nw[t]||0;
  const reserve=days>=6?Math.min(plan.res==null?2:plan.res, days-3):0; const work=Math.max(1,days-reserve);
  const per=!fresh.length?0:days>0?Math.ceil((fresh.length+doneToday)/work):fresh.length;
  const sched=[]; let k=0;
  for(let d=0; d<days; d++){ if(d<work){ const take=d===0?Math.max(0,per-doneToday):per; const ch=fresh.slice(k,k+take); k+=ch.length; const by={}; ch.forEach(it=>{ by[it.p]=(by[it.p]||0)+1; }); sched.push({day:t+d, n:ch.length, by, run:false}); } else sched.push({day:t+d, n:0, by:{}, run:true}); }
  return {t,ex,days,pool,fresh,reserve,work,per,sched,doneToday};
}
function lPlanTab(st,box){
  const A=st.A; const plan=lPlanGet()||{date:'',lec:[],res:2}; const plates=KP.filter(p=>st.items.some(it=>it.p===p.id)); const t=lToday();
  const C=plan.date?lPlanCalc(st.items,plan,st.pr.set):null; const lab=id=>A.BY[id]?A.BY[id].roman:id;
  const setT={all:'все препараты',yg:'жёлтые и зелёные',y:'только жёлтые'}[st.pr.set]||'все препараты';
  let body='';
  if(!C) body=`<p class="lp-empty">Укажите дату экзамена — план разложит новые карточки по дням и оставит последние дни на общий прогон. План пересчитывается каждый день по фактическому прогрессу.</p>`;
  else if(C.days<=0) body=`<p class="lp-empty">${C.days===0?'Экзамен сегодня: прогоните трудные карточки и жёлтые препараты.':'Дата экзамена прошла — укажите новую.'}</p>`;
  else body=`<div class="lp-sum"><div><b>${C.days}</b><span>${A.plur(C.days,'день','дня','дней')} до экзамена</span></div><div><b>${C.fresh.length}</b><span>не начато из ${C.pool.length} (${setT})</span></div><div><b>${C.per}</b><span>новых в день${C.reserve?` · ${C.reserve} ${A.plur(C.reserve,'день','дня','дней')} на прогон`:''}</span></div><div><b>${st.pr.nnew}</b><span>сейчас в настройке «новых в день»</span></div></div>
    ${C.fresh.length?(C.per!==st.pr.nnew?`<div class="lp-ap"><p>Чтобы успеть, нужно ${C.per} ${A.plur(C.per,'новая карточка','новые карточки','новых карточек')} в день, плюс повторения — обычно в 2–3 раза больше.</p><button type="button" class="btn pri" data-lpapply="${C.per}">Применить: ${C.per} в день</button></div>`:`<p class="lp-ok">Настройка «новых в день» совпадает с планом.</p>`):`<p class="lp-ok">Все карточки выбранных лекций уже начаты — остаётся повторять и прогонять.</p>`}
    <div class="lp-tw"><table class="lp-t"><thead><tr><th>День</th><th>Новые</th><th>Что учить</th></tr></thead><tbody>${C.sched.slice(0,90).map(s=>`<tr class="${s.day===t?'cur':''}${s.run?' lp-run':''}"><td>${s.day===t?'Сегодня':lDayFmt(s.day)}</td><td>${s.run?'—':s.n}</td><td>${s.run?'Прогон всех лекций, трудные и жёлтые':Object.keys(s.by).map(id=>`<span class="lp-l">${lab(id)} · ${s.by[id]}</span>`).join(' ')||'Только повторения'}</td></tr>`).join('')}<tr class="ex"><td>${lDayFmt(C.ex)}</td><td></td><td><b>Экзамен</b></td></tr></tbody></table></div>`;
  box.innerHTML=`<div class="bd-card lp"><h3>План до экзамена</h3><div class="lp-f"><label>Дата экзамена<input type="date" id="lpd" value="${plan.date||''}" min="${lDayStr(t)}"></label><label>На общий прогон в конце<select id="lpr">${[0,1,2,3].map(n=>`<option value="${n}"${(plan.res==null?2:plan.res)===n?' selected':''}>${n} ${A.plur(n,'день','дня','дней')}</option>`).join('')}</select></label>${plan.date?`<button type="button" class="btn" data-lpclr="1">Сбросить план</button>`:''}</div>
  <p class="kp-h">Лекции к экзамену</p><div class="l-lec lp-lec" role="group" aria-label="Лекции к экзамену"><button type="button" data-lpl="" aria-pressed="${!plan.lec.length}">Все</button>${plates.map(p=>`<button type="button" data-lpl="${p.id}" aria-pressed="${plan.lec.includes(p.id)}" title="${A.esc(p.title)}">${p.roman}</button>`).join('')}</div>${body}</div>`;
  const save=()=>{ lPlanSet(plan); lPlanTab(st,box); };
  box.querySelector('#lpd').onchange=e=>{ plan.date=e.target.value; save(); };
  box.querySelector('#lpr').onchange=e=>{ plan.res=+e.target.value; save(); };
  box.onclick=e=>{ const l=e.target.closest('[data-lpl]'); if(l){ const id=l.dataset.lpl; plan.lec=!id?[]:plan.lec.includes(id)?plan.lec.filter(x=>x!==id):plan.lec.concat(id); save(); return; }
    const ap=e.target.closest('[data-lpapply]'); if(ap){ st.pr.nnew=Math.max(1,Math.min(200,+ap.dataset.lpapply)); st.pr.lec=plan.lec.slice(); if((st.pr.goal||30)<st.pr.nnew*2) st.pr.goal=Math.ceil(st.pr.nnew*2.5/10)*10; lPrefSave(st.pr);
      document.querySelectorAll('.l-filt .l-lec button').forEach(b=>{ const id=b.dataset.lec; b.setAttribute('aria-pressed',String(id?st.pr.lec.includes(id):!st.pr.lec.length)); }); lStats(st); lPlanTab(st,box); return; }
    if(e.target.closest('[data-lpclr]')){ lPlanSet(null); lPlanTab(st,box); } };
}

/* ---------- прогон: окно поверх любой страницы ---------- */
const RUN=(function(){
  let el=null, S=null;
  function ensure(){ if(el) return el; el=document.createElement('div'); el.id='run'; el.className='run'; el.hidden=true; el.setAttribute('lang','ru');
    el.innerHTML=`<div class="run-scrim" data-rclose></div><section class="run-panel" role="dialog" aria-modal="true" aria-labelledby="run-t" tabindex="-1"><header class="run-top"><div class="run-tt"><p class="eyebrow" id="run-e"></p><h2 id="run-t"></h2></div><div class="seg run-m" role="group" aria-label="Режим прогона"></div><button type="button" class="dz-x" data-rclose aria-label="Закрыть прогон">×</button></header><div class="run-body l-main" id="runBody"></div></section>`;
    document.body.appendChild(el);
    el.addEventListener('click',onClick);
    window.addEventListener('keydown',onKey,true);
    return el; }
  const A=()=>window.__A;
  function open(o){
    ensure(); const items=(o.items||[]).filter(Boolean); if(!items.length) return;
    S={o, items, mode:o.mode||'cards', opener:o.opener||document.activeElement, key:null};
    el.querySelector('#run-e').textContent=o.eyebrow||'Прогон';
    el.querySelector('#run-t').textContent=o.title||'';
    el.hidden=false; document.documentElement.classList.add('run-open');
    start(S.mode);
    el.querySelector('.run-panel').focus({preventScroll:true});
  }
  function modes(){ const rx=S.items.filter(it=>it.hasRx).length; el.querySelector('.run-m').innerHTML=[['cards','Карточки'],['test','Тест']].concat(rx?[['rx','Рецепты']]:[]).map(([k,t])=>`<button type="button" data-rm="${k}" aria-pressed="${S.mode===k}">${t}</button>`).join(''); }
  function start(mode){ S.mode=mode; S.key=null; modes(); const box=el.querySelector('#runBody'); box.scrollTop=0;
    if(mode==='test'){ const ctl={cards:set=>{ S.items=set; start('cards'); }}; lTestBox(A(),box,S.items,lDeck(A()),Math.min(15,Math.max(5,S.items.length)),()=>{ lRefreshAll(); if(S&&S.o.done) S.o.done(); },ctl); S.key=e=>ctl.key&&ctl.key(e); return; }
    cards(box, mode==='rx'); }
  function cards(box,rx){
    const A0=A(); let list=S.items.filter(it=>!rx||it.hasRx); if(!list.length){ box.innerHTML='<div class="l-empty"><h2>Нет рецептов в этом наборе</h2></div>'; return; }
    if(S.o.shuffle) list=lShuffle(list.slice()); else list=list.slice();
    const total=list.length; const first=new Map(); const miss=new Set(); let flipped=false; let q=list.slice();
    const draw=()=>{
      const known=[...first.values()].filter(v=>v==='k').length + [...first.keys()].filter(k=>first.get(k)==='m' && !q.includes(k)).length;
      if(!q.length){ const clean=total-miss.size;
        box.innerHTML=`<div class="l-res"><svg viewBox="0 0 120 120" class="l-ring"><circle cx="60" cy="60" r="52" class="rg-bg"/><circle cx="60" cy="60" r="52" class="rg-fg" style="--p:${Math.round(clean/total*100)}"/></svg><div class="l-res-t"><b>${clean} из ${total}</b><span>с первого раза. ${miss.size?'Ошибки уже стоят в повторении на сегодня.':'Чисто — без ошибок.'}</span></div></div>
        ${miss.size?`<div class="bd-card"><h3>Не вспомнились сразу</h3><div class="bd-sugg">${[...miss].map(it=>`<button type="button" class="bd-chip" data-dr="${A0.esc((it.e&&it.e.n)||it.n)}">${it.n}</button>`).join('')}</div></div>`:''}
        <div class="l-more">${miss.size?`<button type="button" class="btn pri" data-again="miss">Прогнать ошибки · ${miss.size}</button>`:''}<button type="button" class="btn${miss.size?'':' pri'}" data-again="all">Ещё раз всё</button><button type="button" class="btn" data-rm="test">Тест по набору</button><button type="button" class="btn" data-rclose>Закрыть</button></div>`;
        if(!miss.size&&total>=5) lConfetti(box); lRefreshAll(); if(S.o.done) S.o.done(); S.key=null; S.again=w=>{ S.items=w==='miss'?[...miss]:S.items; start(rx?'rx':'cards'); }; return; }
      const it=q[0]; const F=rx?{f:lFrontRx(A0,it),b:lBackRx(A0,it)}:{f:lFront(A0,it),b:lBack(A0,it,false)};
      box.innerHTML=`<div class="l-prog"><span style="--p:${(known/total*100).toFixed(1)}%"></span></div><p class="l-count">Вспомнили ${known} из ${total} · в очереди ${q.length}${first.has(it)?' · повтор':''}</p>
      <div class="lc" id="rlc"><div class="lc-in"><div class="lc-f">${F.f}<button type="button" class="btn pri lc-show" data-rflip="1">Показать ответ <kbd>пробел</kbd></button></div><div class="lc-b">${F.b}</div></div></div>
      <div class="l-rate l-rate2" hidden><button type="button" class="r1" data-rk="0">Не вспомнил <kbd>1</kbd></button><button type="button" class="r3" data-rk="1">Вспомнил <kbd>2</kbd></button></div>`;
      flipped=false; box.scrollTop=0; };
    const flip=()=>{ const c=box.querySelector('#rlc'); if(!c||flipped) return; flipped=true; c.classList.add('flip'); box.querySelector('.l-rate').hidden=false; };
    const mark=ok=>{ if(!flipped) return; const it=q.shift(); const id=rx?'rx:'+it.id:it.id;
      if(!first.has(it)){ first.set(it,ok?'k':'m'); lTouch(id,ok); if(!ok) miss.add(it); }
      if(!ok){ q.splice(Math.min(q.length,3),0,it); }
      draw(); };
    S.flip=flip; S.mark=mark; S.again=null;
    S.key=e=>{ if(/input|textarea|select/i.test(e.target.tagName||'')) return false; if(!box.querySelector('#rlc')) return false; if(e.key===' '||e.key==='Enter'){ e.preventDefault(); if(!flipped) flip(); return true; } if(e.key==='1'){ mark(false); return true; } if(e.key==='2'){ mark(true); return true; } return false; };
    box.onclick=e=>{ const t=e.target; if(t.closest('[data-rflip]')||(t.closest('.lc-f')&&!t.closest('a,button'))){ flip(); return; } const k=t.closest('[data-rk]'); if(k){ mark(k.dataset.rk==='1'); return; } const a=t.closest('[data-again]'); if(a&&S.again){ S.again(a.dataset.again); } };
    draw();
  }
  function close(){ if(!el||el.hidden) return; el.hidden=true; document.documentElement.classList.remove('run-open'); const op=S&&S.opener; S=null; el.querySelector('#runBody').innerHTML=''; lRefreshAll(); if(op && document.contains(op)) op.focus({preventScroll:true}); }
  function onClick(e){ if(e.target.closest('[data-rclose]')){ close(); return; } const m=e.target.closest('[data-rm]'); if(m&&S){ start(m.dataset.rm); return; }
    if(e.target.closest('a[href^="#"]') && !e.target.closest('[data-dr]')) close(); }
  function onKey(e){ if(!el||el.hidden) return; const dz=document.getElementById('dz'); if(dz&&!dz.hidden) return;
    if(e.key==='Escape'){ e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
    if(e.key==='Tab'){ return; }
    if(S&&S.key&&S.key(e)){ e.stopImmediatePropagation(); return; }
    if(!/input|textarea|select/i.test(e.target.tagName||'')) e.stopImmediatePropagation(); }
  return {open, close, isOpen:()=>!!(el&&!el.hidden)};
})();

/* ---------- конфетти ---------- */
function lConfetti(host){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const w=document.createElement('div'); w.className='confetti'; const cols=['var(--hema)','var(--eosin)','var(--iodine)','var(--hl-g)','var(--hl-y)'];
  for(let i=0;i<46;i++){ const s=document.createElement('i'); s.style.left=(Math.random()*100)+'%'; s.style.background=cols[i%cols.length]; s.style.setProperty('--dx',(Math.random()*160-80)+'px'); s.style.setProperty('--r',(Math.random()*720-360)+'deg'); s.style.animationDelay=(Math.random()*0.35)+'s'; w.appendChild(s); }
  host.appendChild(w); setTimeout(()=>w.remove(),2600);
}
