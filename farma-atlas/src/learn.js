/* ===== Учить: колода из конспектов, интервальное повторение, тест, дозы ===== */
const L_KEY='atlas-learn-v1', L_PREF='atlas-learn-pref';
const L_INT=[0,1,2,4,8,16]; // дни до следующего показа по коробке
let LST={v:1, items:{}, days:{}};
let LCLOUD={ref:null, state:'local', writing:false, dirty:false, t:0, started:false};
let LDECK=null;
const lToday=()=>{ const d=new Date(); return Math.floor((d.getTime()-d.getTimezoneOffset()*60000)/864e5); };
function lLoad(){ try{ const x=JSON.parse(localStorage.getItem(L_KEY)||'null'); if(x&&x.items) LST=x; }catch(e){} if(!LST.days) LST.days={}; }
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
  let localNewer=false;
  const r=(remote&&remote.items)||{}; const out={};
  const ids=new Set([...Object.keys(r),...Object.keys(LST.items)]);
  ids.forEach(id=>{ const a=LST.items[id], b=r[id]; if(!a) out[id]=b; else if(!b){ out[id]=a; localNewer=true; } else { if((a[4]||0)>(b[4]||0)){ out[id]=a; localNewer=true; } else out[id]=b; } });
  const days=Object.assign({}, (remote&&remote.days)||{}); Object.entries(LST.days||{}).forEach(([d,n])=>{ if(!days[d]||days[d]<n){ days[d]=n; localNewer=true; } });
  LST={v:1, items:out, days}; return localNewer;
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
    if(typeof LREFRESH==='function') LREFRESH();
  }catch(e){ LCLOUD.ref=null; LCLOUD.state='local'; lBadge(); }
}
function lBadge(){ const b=document.getElementById('lsync'); if(!b) return; const m={cloud:['Прогресс сохраняется в аккаунте','ok'],connecting:['Подключаю сохранение…',''],local:['Прогресс хранится в этом браузере','']}[LCLOUD.state]||['','']; b.textContent=m[0]; b.className='l-sync '+m[1]; }
let LREFRESH=null;
lLoad();

/* ---------- колода ---------- */
const lClean=s=>String(s).replace(/<[^>]+>/g,'').replace(/[*«»"]/g,'').replace(/\s+/g,' ').trim();
const lRank={'':0,g:1,y:2};
function lDeck(A){
  if(LDECK) return LDECK;
  const items=[]; const byPlate={};
  const findIn=(pid,nm)=>(byPlate[pid]||[]).find(it=>A.kSame(nm,it.n)||A.kSame(it.n,nm));
  const add=(p,name,info)=>{ const nm=lClean(name); if(!nm||nm.length<3) return; let it=findIn(p.id,nm);
    if(!it){ it={id:p.id+':'+A.key(nm).replace(/\s+/g,'_'), n:nm, p:p.id, lec:p.roman, title:p.title, hl:'', groups:[], card:null, rx:[]}; (byPlate[p.id]=byPlate[p.id]||[]).push(it); items.push(it); }
    if(info.hl && lRank[info.hl]>lRank[it.hl]) it.hl=info.hl;
    if(info.group && !it.groups.includes(info.group)) it.groups.push(info.group);
    if(info.card && !it.card) it.card=info.card;
    if(info.rx) it.rx.push(info.rx);
  };
  KP.forEach(p=>p.blocks.forEach(b=>{
    if(b.t==='tree'){ const walk=(nd,path)=>{ const here=lClean(nd.n||''); const pth=here?path.concat(here):path;
        (nd.d||[]).forEach(x=>{ const [nm,hl]=String(x).split('|'); const g=pth.slice(-2).join(' → '); add(p,nm,{hl:hl||'',group:g}); });
        (nd.k||[]).forEach(c=>walk(c,pth)); };
      walk({n:b.n||b.title,d:b.d,k:b.k},[]); }
    if(b.t==='cards') b.items.forEach(c=>add(p,c.n,{card:c,hl:c.hl||''}));
    if(b.t==='table' && b.idx && /выписыв/i.test(b.title||'')){ b.rows.forEach(r=>{ const nm=String(r[0]).split('<br>')[0]; const mark=r.some(c=>/<mark>/.test(c)); const L=r.length;
      add(p,nm,{hl:mark?'y':'', rx:{tn:lClean(r[1]||''), form:lClean(r[L>=5?3:2]||''), dose:lClean(r[L-1]||''), ind:L>=5?lClean(r[2]):'', mark}}); }); }
  }));
  items.forEach(it=>{ it.d=A.kFindDrug(it.n); it.hasBody = typeof VIT!=='undefined' && !!(VIT[it.n] || (it.d && VIT[it.d.n])); });
  LDECK=items; lPublish(); return items;
}
function lPrefs(){ try{ return Object.assign({lec:[], set:'all', mode:'cards', dir:'fwd', nnew:15}, JSON.parse(localStorage.getItem(L_PREF)||'{}')); }catch(e){ return {lec:[], set:'all', mode:'cards', dir:'fwd', nnew:15}; } }
function lPrefSave(pr){ try{ localStorage.setItem(L_PREF, JSON.stringify(pr)); }catch(e){} }
function lPool(items,pr){ return items.filter(it=>(!pr.lec.length||pr.lec.includes(it.p)) && (pr.set==='all' || (pr.set==='y'?it.hl==='y':it.hl))); }
const lRec=id=>LST.items[id]||[0,0,0,0,0];
function lRate(id,grade){ // 0 — не помню, 1 — с трудом, 2 — помню
  const r=lRec(id).slice(); const today=lToday();
  if(grade===0){ r[0]=1; r[1]=today; r[3]=(r[3]||0)+1; }
  else if(grade===1){ r[0]=Math.max(1,r[0]); r[1]=today+1; }
  else { r[0]=Math.min(5,r[0]+1); r[1]=today+L_INT[r[0]]; }
  r[2]=(r[2]||0)+1; r[4]=Date.now(); LST.items[id]=r;
  LST.days[today]=(LST.days[today]||0)+1; lSave();
  try{ if(window.MAP){ window.MAP.card({atlas:'farma', ok:grade===2}); lPublish(); } }catch(e){}
}
/* личный кабинет: освоение по лекциям (закреплено — карточка дошла до 3-й коробки, интервал от 4 дней) */
let lPubT=0;
function lPublish(){ clearTimeout(lPubT); lPubT=setTimeout(lPublishNow,400); }
function lPublishNow(){
  try{
    if(!window.MAP||!LDECK||typeof KP==='undefined') return;
    const by={};
    LDECK.forEach(it=>{ const s=by[it.p]||(by[it.p]={total:0,learned:0,seen:0}); s.total++; const r=LST.items[it.id]; if(r&&r[2]) s.seen++; if(r&&r[0]>=3) s.learned++; });
    window.MAP.sections('farma', KP.map(p=>{ const s=by[p.id]||{total:0,learned:0,seen:0}; return {id:p.id, n:p.title, sub:p.lec||p.roman||'', total:s.total, learned:s.learned, seen:s.seen, locked:!!p.locked}; }));
  }catch(e){}
}
function lDueCount(A){ const items=lDeck(A); const t=lToday(); let n=0; items.forEach(it=>{ const r=lRec(it.id); if(r[0]&&r[1]<=t) n++; const x=lRec('rx:'+it.id); if(x[0]&&x[1]<=t) n++; }); return n; }
function lStreak(){ const t=lToday(); let n=0, d=LST.days[t]?t:t-1; while(LST.days[d]){ n++; d--; } return n; }

/* ---------- страница ---------- */
EXTRA.routes.learn=function(A,arg){
  const items=lDeck(A); const pr=lPrefs();
  if(arg){ const pid=decodeURIComponent(arg); if(A.BY[pid]){ pr.lec=[pid]; lPrefSave(pr); } }
  const page=A.$('#page');
  const plates=KP.filter(p=>items.some(it=>it.p===p.id));
  page.innerHTML=`<header><p class="eyebrow">Учить · ${items.length} ${A.plur(items.length,'препарат','препарата','препаратов')} из конспектов</p><h1 class="title">Учить препараты</h1>
  <p class="lead">Карточки с интервальным повторением, тест в формулировках зачёта и тренажёр доз. Колода собрана из ваших конспектов: классификации, «кл / пок / п.э.», возможные формулировки и списки для выписывания.</p></header>
  <div class="l-top"><div class="l-stats" id="lstats"></div><span class="l-sync" id="lsync"></span></div>
  <div class="l-filt">
    <div class="l-lec" role="group" aria-label="Лекции"><button type="button" data-lec="" aria-pressed="${!pr.lec.length}">Все</button>${plates.map(p=>`<button type="button" data-lec="${p.id}" aria-pressed="${pr.lec.includes(p.id)}" title="${A.esc(p.title)}">${p.roman}</button>`).join('')}</div>
    <div class="seg l-set" role="group" aria-label="Набор"><button type="button" data-set="all" aria-pressed="${pr.set==='all'}">Все препараты</button><button type="button" data-set="yg" aria-pressed="${pr.set==='yg'}">Жёлтые + зелёные</button><button type="button" data-set="y" aria-pressed="${pr.set==='y'}">Только жёлтые</button></div>
  </div>
  <div class="l-tabs" role="tablist">${[['cards','Карточки'],['test','Тест'],['rx','Дозы и рецепты'],['prog','Прогресс']].map(([k,t])=>`<button type="button" role="tab" data-mode="${k}" aria-selected="${pr.mode===k}">${t}</button>`).join('')}</div>
  <div id="lmain" class="l-main"></div>`;
  lBadge(); lCloudInit();
  const st={pr, A, items};
  LREFRESH=()=>{ if(document.getElementById('lmain')) lMode(st,true); const dn=document.querySelector('#nav .due'); if(dn){ const n=lDueCount(A); dn.textContent=n; dn.hidden=!n; } };
  page.querySelector('.l-lec').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; const id=b.dataset.lec;
    if(!id) pr.lec=[]; else pr.lec = pr.lec.includes(id) ? pr.lec.filter(x=>x!==id) : pr.lec.concat(id);
    page.querySelectorAll('.l-lec button').forEach(x=>x.setAttribute('aria-pressed', x.dataset.lec? String(pr.lec.includes(x.dataset.lec)) : String(!pr.lec.length)));
    lPrefSave(pr); lMode(st); });
  page.querySelector('.l-set').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; pr.set=b.dataset.set; page.querySelectorAll('.l-set button').forEach(x=>x.setAttribute('aria-pressed',String(x===b))); lPrefSave(pr); lMode(st); });
  page.querySelector('.l-tabs').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; pr.mode=b.dataset.mode; page.querySelectorAll('.l-tabs button').forEach(x=>x.setAttribute('aria-selected',String(x===b))); lPrefSave(pr); lMode(st); });
  lMode(st);
};
function lStats(st){
  const pool=lPool(st.items,st.pr); const t=lToday(); let due=0,nw=0,known=0;
  pool.forEach(it=>{ const r=lRec(it.id); if(!r[0]) nw++; else { if(r[1]<=t) due++; if(r[0]>=4) known++; } });
  const el=document.getElementById('lstats'); if(!el) return;
  const s=lStreak();
  el.innerHTML=`<div><b>${due}</b><span>к повторению</span></div><div><b>${nw}</b><span>новых</span></div><div><b>${known}</b><span>выучено из ${pool.length}</span></div><div class="l-fire${s?' on':''}"><b>${s}</b><span>${s===1?'день подряд':'дней подряд'}</span></div>`;
}
function lMode(st,soft){
  lStats(st);
  const m=st.pr.mode, box=document.getElementById('lmain');
  if(soft && (m==='cards'||m==='rx'||m==='test') && box.dataset.mode===m) return;
  box.dataset.mode=m;
  if(m==='cards') lCards(st,box,false); else if(m==='rx') lCards(st,box,true); else if(m==='test') lTest(st,box); else lProg(st,box);
}

/* ---------- карточки ---------- */
function lQueue(st,rx){
  const t=lToday(); let pool=lPool(st.items,st.pr);
  if(rx) pool=pool.filter(it=>it.rx.length||(it.card&&it.card.rp)||((st.A.uFind(it.n)||{}).x));
  const pid=it=>(rx?'rx:':'')+it.id;
  const due=pool.filter(it=>{ const r=lRec(pid(it)); return r[0] && r[1]<=t; }).sort((a,b)=>lRec(pid(a))[1]-lRec(pid(b))[1]);
  const fresh=pool.filter(it=>!lRec(pid(it))[0]).sort((a,b)=>lRank[b.hl]-lRank[a.hl] || KP.findIndex(p=>p.id===a.p)-KP.findIndex(p=>p.id===b.p));
  return {list:due.concat(fresh.slice(0,st.pr.nnew)), pid, poolN:pool.length};
}
function lCards(st,box,rx){
  const q=lQueue(st,rx); let i=0, flipped=false; const done={again:0,hard:0,good:0};
  const A=st.A;
  const dirBtns = rx?'':`<div class="seg l-dir" role="group" aria-label="Направление"><button type="button" data-dir="fwd" aria-pressed="${st.pr.dir==='fwd'}">Препарат → описание</button><button type="button" data-dir="rev" aria-pressed="${st.pr.dir==='rev'}">Описание → препарат</button></div>`;
  const draw=()=>{
    if(!q.list.length){ box.innerHTML=`${dirBtns}<div class="l-empty"><h2>${q.poolN?'На сегодня всё':'В этом наборе нет препаратов'}</h2><p>${q.poolN?'Новые карточки и повторения появятся завтра. Можно пройти тест или выбрать другие лекции.':'Выберите другие лекции или набор.'}</p><div class="l-more"><button type="button" class="btn pri" data-more="1">Ещё 15 новых</button><button type="button" class="btn" data-goto="test">Пройти тест</button></div></div>`; return; }
    if(i>=q.list.length){ const tot=done.again+done.hard+done.good; box.innerHTML=`${dirBtns}<div class="l-empty"><h2>Сессия завершена</h2><p>Карточек: ${tot}. Помню — ${done.good}, с трудом — ${done.hard}, не помню — ${done.again}.</p><div class="l-more"><button type="button" class="btn pri" data-again="1">Продолжить</button><button type="button" class="btn" data-goto="test">Пройти тест</button></div></div>`; if(done.good>=Math.max(5,tot*0.8)) lConfetti(box); lStats(st); return; }
    const it=q.list[i]; const rev=!rx && st.pr.dir==='rev';
    box.innerHTML=`${dirBtns}<div class="l-prog"><span style="--p:${(i/q.list.length*100).toFixed(1)}%"></span></div><p class="l-count">${i+1} из ${q.list.length}${lRec(q.pid(it))[0]?' · повторение':' · новая'}</p>
    <div class="lc" id="lc"><div class="lc-in"><div class="lc-f">${rx?lFrontRx(A,it):(rev?lFrontRev(A,it):lFront(A,it))}<button type="button" class="btn pri lc-show" data-flip="1">Показать ответ <kbd>пробел</kbd></button></div><div class="lc-b">${rx?lBackRx(A,it):lBack(A,it,rev)}</div></div></div>
    <div class="l-rate" hidden><button type="button" class="r0" data-r="0">Не помню <kbd>1</kbd></button><button type="button" class="r1" data-r="1">С трудом <kbd>2</kbd></button><button type="button" class="r2" data-r="2">Помню <kbd>3</kbd></button></div>`;
    flipped=false;
  };
  const flip=()=>{ const c=document.getElementById('lc'); if(!c||flipped) return; flipped=true; c.classList.add('flip'); box.querySelector('.l-rate').hidden=false; };
  const rate=g=>{ if(!flipped) return; const it=q.list[i]; lRate(q.pid(it),g); done[['again','hard','good'][g]]++; if(g===0) q.list.push(it); i++; lStats(st); draw(); };
  box.onclick=e=>{ const t=e.target;
    if(t.closest('[data-flip]')||(t.closest('.lc-f')&&!t.closest('a,button'))){ flip(); return; }
    const r=t.closest('[data-r]'); if(r){ rate(+r.dataset.r); return; }
    const d=t.closest('[data-dir]'); if(d){ st.pr.dir=d.dataset.dir; lPrefSave(st.pr); lCards(st,box,rx); return; }
    if(t.closest('[data-more]')){ st.pr.nnew+=15; lPrefSave(st.pr); lCards(st,box,rx); return; }
    if(t.closest('[data-again]')){ lCards(st,box,rx); return; }
    const g=t.closest('[data-goto]'); if(g){ document.querySelector(`.l-tabs [data-mode="${g.dataset.goto}"]`).click(); }
  };
  document.onkeydown=e=>{ if(!document.getElementById('lc')||/input|textarea|select/i.test((e.target.tagName||''))) return;
    if(e.key===' '||e.key==='Enter'){ if(!flipped){ e.preventDefault(); flip(); } }
    else if(['1','2','3'].includes(e.key)) rate(+e.key-1); };
  draw();
}
const lHl=it=>it.hl==='y'?'<span class="kd hl-y">наизусть + рецепт</span>':it.hl==='g'?'<span class="kd hl-g">рецепт</span>':'';
function lFront(A,it){ return `<p class="lc-lec">${it.lec} · ${A.esc(it.title)}</p><h2 class="lc-n">${it.n}</h2>${lHl(it)}<p class="lc-ask">Вспомните: группа · механизм · показания · побочные эффекты</p>`; }
function lFrontRev(A,it){
  const c=it.card; let clue='';
  if(c&&c.fm&&c.fm.length) clue=`<p class="lc-q">«${c.fm[Math.floor(Math.random()*c.fm.length)]}»</p><p class="lc-ask">Возможная формулировка. Что за препарат?</p>`;
  else { const bits=[]; if(it.groups.length) bits.push('<b>Группа:</b> '+it.groups[0]); const pk=(c&&c.pok)||(it.d&&(it.d.i||[]).map(x=>x[0]))||[]; if(pk.length) bits.push('<b>Показания:</b> '+pk.slice(0,3).join('; ')); clue=`<p class="lc-q">${bits.join('<br>')||'—'}</p><p class="lc-ask">Что за препарат?</p>`; }
  return `<p class="lc-lec">${it.lec} · ${A.esc(it.title)}</p>${clue}`;
}
function lBack(A,it,rev){
  const e=A.uFind(it.n); const d=it.d;
  const links=`<div class="lb-l">${e?`<button type="button" class="btn pri" data-dr="${A.esc(e.n)}">Вся карточка →</button>`:''}${A.BY[it.p]?`<a class="btn" href="#${it.p}" data-kgo="${A.esc(it.n)}">Конспект ${it.lec} →</a>`:''}${it.hasBody?`<a class="btn" href="#body/${encodeURIComponent(VIT[it.n]?it.n:d.n)}">Организм →</a>`:''}</div>`;
  return `${rev?`<h2 class="lc-n">${it.n}</h2>${lHl(it)}`:`<h3 class="lc-n2">${it.n}</h3>`}${e?A.uLearnHTML(e):''}${links}`;
}
function lFrontRx(A,it){ const r=it.rx[0]; return `<p class="lc-lec">${it.lec} · ${A.esc(it.title)}</p><h2 class="lc-n">${it.n}</h2>${lHl(it)}<p class="lc-ask">${r?`Форма: <b>${A.esc(r.form)}</b><br>Вспомните дозу и способ применения${it.card&&it.card.rp?' — и выпишите рецепт':''}`:'Выпишите рецепт'}</p>`; }
function lBackRx(A,it){ const e=A.uFind(it.n); return `<h3 class="lc-n2">${it.n}</h3>${e?`<div class="lb-s u-dose">${A.uDoseHTML(e,{all:true})}</div><div class="lb-l"><button type="button" class="btn" data-dr="${A.esc(e.n)}">Вся карточка →</button></div>`:''}`; }

/* ---------- тест ---------- */
function lShuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
/* похожие формулировки: совпадение значимых основ слов (чтобы дистрактор не оказался тоже верным) */
const lStems=t=>[...new Set(String(t).toLowerCase().replace(/<[^>]+>/g,'').split(/[^a-zа-яё0-9]+/i).filter(w=>w.length>=5).map(w=>w.slice(0,6)))];
function lLike(t,list){ const st=lStems(t); if(!st.length) return (list||[]).some(y=>y.toLowerCase()===String(t).toLowerCase()); const need=Math.max(1,Math.ceil(st.length/2)); return (list||[]).some(y=>{ const ys=lStems(y); return st.filter(x=>ys.includes(x)).length>=need; }); }
function lQuestions(st,N){
  const pool=lPool(st.items,st.pr); const all=st.items; const qs=[];
  const others=(it,pred)=>lShuffle(pool.filter(x=>x!==it&&x.p===it.p&&pred(x))).concat(lShuffle(all.filter(x=>x!==it&&x.p!==it.p&&pred(x))));
  const pickD=(it,pred)=>{ const o=[]; const seenN=new Set([it.n.toLowerCase()]); for(const x of others(it,pred)){ if(!seenN.has(x.n.toLowerCase())){ seenN.add(x.n.toLowerCase()); o.push(x.n); } if(o.length===3) break; } return o; };
  const gens=[
    it=>{ const fm=it.card&&it.card.fm; if(!fm||!fm.length) return null; const f=fm[Math.floor(Math.random()*fm.length)]; const ds=pickD(it,x=>!(x.card&&x.card.fm&&x.card.fm.includes(f))); return ds.length<3?null:{q:`Возможная формулировка: <b>«${f}»</b>. Какой это препарат?`, a:it.n, opts:ds}; },
    it=>{ if(!it.groups.length) return null; const g=it.groups[0]; const gs=lShuffle([...new Set(pool.concat(all).filter(x=>x.p===it.p).flatMap(x=>x.groups))].filter(x=>!it.groups.includes(x))).slice(0,3); return gs.length<3?null:{q:`К какой группе относится <b>${it.n}</b>?`, a:g, opts:gs}; },
    it=>{ if(!it.groups.length) return null; const g=it.groups[0]; const ds=pickD(it,x=>!x.groups.includes(g)); return ds.length<3?null:{q:`Какой препарат относится к группе <b>${g}</b>?`, a:it.n, opts:ds}; },
    it=>{ const pk=it.card&&it.card.pok; if(!pk||!pk.length) return null; const p=pk[Math.floor(Math.random()*pk.length)]; const ds=pickD(it,x=>!lLike(p,[].concat((x.card&&x.card.pok)||[],(x.d&&(x.d.i||[]).map(z=>z[0]))||[],x.card&&x.card.x?[x.card.x]:[]))); return ds.length<3?null:{q:`Показание из конспекта: <b>${p}</b>. Какой препарат?`, a:it.n, opts:ds}; },
    it=>{ const pe=it.card&&it.card.pe; if(!pe||!pe.length) return null; const p=pe[Math.floor(Math.random()*pe.length)]; const ds=pickD(it,x=>!lLike(p,[].concat((x.card&&x.card.pe)||[],(x.d&&(x.d.a||[]).map(z=>z[0]))||[]))); return ds.length<3?null:{q:`Побочный эффект из конспекта: <b>${p}</b>. У какого препарата?`, a:it.n, opts:ds}; },
    it=>{ const r=it.rx.find(x=>x.mark)||it.rx[0]; if(!r||!r.dose) return null; const ds=pickD(it,x=>x.rx.length>0); return ds.length<3?null:{q:`Способ применения и доза: <b>«${r.dose.length>180?r.dose.slice(0,180)+'…':r.dose}»</b>. Какой препарат?`, a:it.n, opts:ds}; }
  ];
  const cand=lShuffle(pool.slice());
  const hard=cand.filter(it=>(lRec(it.id)[3]||0)>0).sort((a,b)=>lRec(b.id)[3]-lRec(a.id)[3]).slice(0,Math.ceil(N/3));
  const rich=cand.filter(it=>it.card||it.rx.length);
  const usedIt=new Set(); let guard=0;
  const tryIt=it=>{ if(!it||usedIt.has(it.id)) return false; const order=(it.card||it.rx.length)?lShuffle([0,3,4,5]).concat(lShuffle([1,2])):lShuffle([1,2]);
    for(const gi of order){ const q=gens[gi](it); if(q){ usedIt.add(it.id); q.it=it; q.opts=lShuffle([q.a].concat(q.opts)); qs.push(q); return true; } } return false; };
  hard.forEach(it=>{ if(qs.length<N) tryIt(it); });
  while(qs.length<N && guard<N*30 && cand.length){ guard++;
    const src=(guard%3!==0 && rich.length)?rich:cand; tryIt(src[Math.floor(Math.random()*src.length)]); }
  return lShuffle(qs);
}
function lTest(st,box){
  const qs=lQuestions(st,10); let i=0, score=0, answered=false; const wrong=[];
  if(!qs.length){ box.innerHTML=`<div class="l-empty"><h2>Недостаточно данных для теста</h2><p>Выберите больше лекций или набор «Все препараты».</p></div>`; return; }
  const draw=()=>{
    if(i>=qs.length){ const pct=Math.round(score/qs.length*100);
      box.innerHTML=`<div class="l-res"><svg viewBox="0 0 120 120" class="l-ring"><circle cx="60" cy="60" r="52" class="rg-bg"/><circle cx="60" cy="60" r="52" class="rg-fg" style="--p:${pct}"/></svg><div class="l-res-t"><b>${score} из ${qs.length}</b><span>${pct>=90?'Отлично — уровень зачёта':pct>=70?'Хорошо, повторите ошибки':'Стоит повторить карточки'}</span></div></div>${wrong.length?`<div class="bd-card"><h3>Ошибки</h3><ul class="l-wrong">${wrong.map(w=>`<li><span>${w.q}</span><b>${w.a}</b></li>`).join('')}</ul></div>`:''}<div class="l-more"><button type="button" class="btn pri" data-new="1">Новый тест</button><button type="button" class="btn" data-goto="cards">К карточкам</button></div>`;
      if(pct>=80) lConfetti(box); lStats(st); return; }
    const q=qs[i]; answered=false;
    box.innerHTML=`<div class="l-prog"><span style="--p:${(i/qs.length*100).toFixed(1)}%"></span></div><p class="l-count">Вопрос ${i+1} из ${qs.length} · ${q.it.lec}</p><div class="l-q"><p>${q.q}</p><div class="l-opts">${q.opts.map((o,k)=>`<button type="button" data-o="${k}"><kbd>${k+1}</kbd>${o}</button>`).join('')}</div><div class="l-fb" hidden></div></div>`;
  };
  const answer=k=>{ if(answered) return; answered=true; const q=qs[i]; const ok=q.opts[k]===q.a;
    box.querySelectorAll('.l-opts button').forEach((b,j)=>{ b.disabled=true; if(q.opts[j]===q.a) b.classList.add('ok'); else if(j===k) b.classList.add('no'); });
    if(ok){ score++; const r=lRec(q.it.id); if(r[0]<2) lRate(q.it.id,2); } else { lRate(q.it.id,0); wrong.push({q:q.q.replace(/<[^>]+>/g,''),a:q.a}); }
    const fb=box.querySelector('.l-fb'); fb.hidden=false; const it=q.it;
    fb.innerHTML=`<p class="${ok?'ok':'no'}"><b>${ok?'Верно.':'Неверно.'}</b> ${it.n}${it.groups[0]?' — '+it.groups[0]:''}${it.card&&it.card.kl?'; кл: '+it.card.kl:''}</p><button type="button" class="btn pri" data-next="1">Дальше <kbd>Enter</kbd></button>`;
  };
  box.onclick=e=>{ const o=e.target.closest('[data-o]'); if(o){ answer(+o.dataset.o); return; } if(e.target.closest('[data-next]')){ i++; draw(); return; } if(e.target.closest('[data-new]')){ lTest(st,box); return; } const g=e.target.closest('[data-goto]'); if(g) document.querySelector(`.l-tabs [data-mode="${g.dataset.goto}"]`).click(); };
  document.onkeydown=e=>{ if(!box.querySelector('.l-q')||/input|textarea/i.test(e.target.tagName||'')) return; if(['1','2','3','4'].includes(e.key)) answer(+e.key-1); else if(e.key==='Enter'&&answered){ e.preventDefault(); i++; draw(); } };
  draw();
}

/* ---------- прогресс ---------- */
function lProg(st,box){
  document.onkeydown=null;
  const items=st.items; const plates=KP.filter(p=>items.some(it=>it.p===p.id)); const t=lToday();
  const rows=plates.map(p=>{ const its=items.filter(it=>it.p===p.id); let k=0,l=0; its.forEach(it=>{ const r=lRec(it.id); if(r[0]>=4) k++; else if(r[0]) l++; }); return {p,n:its.length,k,l}; });
  const hard=items.filter(it=>(lRec(it.id)[3]||0)>=2).sort((a,b)=>lRec(b.id)[3]-lRec(a.id)[3]).slice(0,16);
  const days=[]; for(let d=t-34; d<=t; d++) days.push([d,LST.days[d]||0]); const mx=Math.max(1,...days.map(x=>x[1]));
  box.innerHTML=`<div class="bd-card"><h3>По лекциям</h3><div class="l-bars">${rows.map(r=>`<a class="l-bar" href="#learn/${r.p.id}"><span class="l-bl">${r.p.roman}</span><span class="l-bt">${st.A.esc(r.p.title)}</span><span class="l-bb"><i class="k" style="width:${(r.k/r.n*100).toFixed(1)}%"></i><i class="l" style="width:${(r.l/r.n*100).toFixed(1)}%"></i></span><span class="l-bn">${r.k}/${r.n}</span></a>`).join('')}</div><p class="l-leg"><i class="k"></i>выучено (коробка 4–5) <i class="l"></i>в процессе <i class="n"></i>новые</p></div>
  <div class="bd-card"><h3>Активность за 5 недель</h3><div class="l-heat">${days.map(([d,n])=>`<i title="${n} карточек" style="--a:${n?0.25+0.75*n/mx:0}"></i>`).join('')}</div></div>
  ${hard.length?`<div class="bd-card"><h3>Трудные препараты</h3><div class="bd-sugg">${hard.map(it=>`<a class="bd-chip" href="#${it.p}" data-kgo="${st.A.esc(it.n)}">${it.n} <small>×${lRec(it.id)[3]}</small></a>`).join('')}</div></div>`:''}
  <div class="l-more"><button type="button" class="btn" data-reset="1">Сбросить прогресс</button></div>`;
  box.onclick=e=>{ if(e.target.closest('[data-reset]')){ if(box.querySelector('.l-confirm')) return; const c=document.createElement('div'); c.className='l-confirm'; c.innerHTML='<p>Удалить весь прогресс обучения? Это нельзя отменить.</p><button type="button" class="btn pri" data-reset-ok="1">Удалить</button> <button type="button" class="btn" data-reset-no="1">Отмена</button>'; box.appendChild(c); return; }
    if(e.target.closest('[data-reset-ok]')){ LST={v:1,items:{},days:{}}; lSave(); lProg(st,box); lStats(st); return; }
    if(e.target.closest('[data-reset-no]')){ const c=box.querySelector('.l-confirm'); if(c) c.remove(); } };
}

/* ---------- конфетти ---------- */
function lConfetti(host){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const w=document.createElement('div'); w.className='confetti'; const cols=['var(--hema)','var(--eosin)','var(--iodine)','var(--hl-g)','var(--hl-y)'];
  for(let i=0;i<46;i++){ const s=document.createElement('i'); s.style.left=(Math.random()*100)+'%'; s.style.background=cols[i%cols.length]; s.style.setProperty('--dx',(Math.random()*160-80)+'px'); s.style.setProperty('--r',(Math.random()*720-360)+'deg'); s.style.animationDelay=(Math.random()*0.35)+'s'; w.appendChild(s); }
  host.appendChild(w); setTimeout(()=>w.remove(),2600);
}
