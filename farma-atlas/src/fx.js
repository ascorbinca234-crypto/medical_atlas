/* ===== Анимации и «фишки»: живые схемы, подсветка цепочек, появление при прокрутке, горячие клавиши, тема ===== */
const FX = (function(){
  const RM = ()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const T_KEY='atlas-theme';
  const qs=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>Array.from(r.querySelectorAll(s));

  /* ---------- тема ---------- */
  function themeGet(){ try{ return localStorage.getItem(T_KEY)||'auto'; }catch(e){ return 'auto'; } }
  function themeSet(t){ try{ localStorage.setItem(T_KEY,t); }catch(e){} themeApply(t); }
  function themeApply(t){ const r=document.documentElement; if(t==='auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme',t);
    qa('.fx-theme button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.th===t))); }
  themeApply(themeGet());

  /* ---------- наблюдатель прокрутки ---------- */
  const hasIO = typeof IntersectionObserver!=='undefined';
  const cb = new WeakMap();
  let io = hasIO ? new IntersectionObserver(es=>es.forEach(e=>{ if(!e.isIntersecting) return; const f=cb.get(e.target); io.unobserve(e.target); cb.delete(e.target); if(f) f(e.target); }),{rootMargin:'0px 0px -8% 0px',threshold:0.06}) : null;
  function watch(el,fn){ if(!io){ fn(el); return; } cb.set(el,fn); io.observe(el); }

  /* ---------- появление блоков ---------- */
  function reveal(root){
    if(RM()||!io) return;
    const H=innerHeight;
    qa('.kc,.fig,.pcard,.tblw,.klist,.kwarn,.dbrow,.module,.bd-card,.l-bar',root).forEach((el,i)=>{
      if(el.closest('.dz')||el.classList.contains('rv')) return;
      const r=el.getBoundingClientRect(); if(r.top<H-20) return;
      el.classList.add('rv'); watch(el,x=>{ x.classList.add('in'); setTimeout(()=>x.classList.remove('rv','in'),700); });
    });
  }
  /* цепочки «причина → следствие» разворачиваются по звеньям */
  function chains(root){
    if(RM()) return;
    qa('.cf',root).forEach(cf=>{ if(cf._fx) return; cf._fx=1; Array.from(cf.children).forEach((c,i)=>c.style.setProperty('--i',i)); cf.classList.add('fx-cf'); watch(cf,x=>x.classList.add('in')); });
  }

  /* ---------- блок-схемы: уровни, проигрывание, подсветка цепочки ---------- */
  function gPrep(svg){
    if(svg._g) return svg._g;
    const nodes=qa('.gn-w',svg), edges=qa('.ge-w',svg); const N={}; nodes.forEach(g=>N[g.dataset.n]=g);
    const out={}, inc={};
    edges.forEach(e=>{ const a=e.dataset.a, b=e.dataset.b; if(a&&N[a]) (out[a]=out[a]||[]).push(e); if(b&&N[b]) (inc[b]=inc[b]||[]).push(e); });
    const lv={};
    const bfs=roots=>{ const q=roots.slice(); while(q.length){ const id=q.shift(); (out[id]||[]).forEach(e=>{ const b=e.dataset.b; if(b&&N[b]&&lv[b]===undefined){ lv[b]=lv[id]+1; q.push(b); } }); } };
    const roots=nodes.map(g=>g.dataset.n).filter(id=>!(inc[id]||[]).some(e=>e.dataset.a&&N[e.dataset.a]));
    roots.forEach(id=>lv[id]=0); bfs(roots);
    nodes.forEach(g=>{ const id=g.dataset.n; if(lv[id]===undefined){ lv[id]=0; bfs([id]); } });
    let max=0;
    nodes.forEach(g=>{ g._s=lv[g.dataset.n]; max=Math.max(max,g._s); });
    edges.forEach(e=>{ const a=e.dataset.a, b=e.dataset.b; e._s = a&&N[a] ? lv[a]+1 : (b&&N[b] ? lv[b] : 0); max=Math.max(max,e._s); });
    return svg._g={nodes,edges,N,out,inc,max};
  }
  function drawEdge(e,ms){
    const p=e.querySelector('path'); if(!p||!p.getTotalLength) return;
    let L=0; try{ L=p.getTotalLength(); }catch(x){} if(!L) return;
    const me=p.getAttribute('marker-end'), msA=p.getAttribute('marker-start');
    if(me) p.removeAttribute('marker-end'); if(msA) p.removeAttribute('marker-start');
    p.style.transition='none'; p.style.strokeDasharray=L; p.style.strokeDashoffset=L; p.getBoundingClientRect();
    p.style.transition=`stroke-dashoffset ${ms}ms ease-out`; p.style.strokeDashoffset='0';
    setTimeout(()=>{ p.style.transition=''; p.style.strokeDasharray=''; p.style.strokeDashoffset=''; if(me) p.setAttribute('marker-end',me); if(msA) p.setAttribute('marker-start',msA); },ms+20);
  }
  function gStop(svg){ (svg._tm||[]).forEach(clearTimeout); svg._tm=[]; svg.classList.remove('fx-hide','fx-playing'); qa('.on,.cur',svg).forEach(x=>x.classList.remove('on','cur')); const b=svg.closest('.kgraph'); const btn=b&&qs('.fx-gbtn',b); if(btn){ btn.textContent='▶ Проиграть'; btn.setAttribute('aria-pressed','false'); } const st=b&&qs('.fx-step',b); if(st) st.textContent=''; }
  function gPlay(svg,step,slow){
    const G=gPrep(svg); if(!G.edges.length) return;
    gStop(svg); gTrace(svg,null); svg._pin=null;
    svg.classList.add('fx-hide'); if(slow) svg.classList.add('fx-playing');
    const fig=svg.closest('.kgraph'); const btn=fig&&qs('.fx-gbtn',fig), st=fig&&qs('.fx-step',fig);
    if(slow&&btn){ btn.textContent='■ Стоп'; btn.setAttribute('aria-pressed','true'); }
    const tm=svg._tm=[];
    for(let s=0;s<=G.max;s++){
      tm.push(setTimeout(()=>{
        if(slow) qa('.cur',svg).forEach(x=>x.classList.remove('cur'));
        G.edges.forEach(e=>{ if(e._s===s){ e.classList.add('on'); drawEdge(e,Math.min(step*0.85,520)); } });
        G.nodes.forEach(g=>{ if(g._s===s){ g.classList.add('on'); if(slow) g.classList.add('cur'); } });
        if(slow&&st) st.textContent=`шаг ${s+1} из ${G.max+1}`;
      }, s*step));
    }
    tm.push(setTimeout(()=>gStop(svg), (G.max+1)*step + (slow?900:450)));
  }
  function gTrace(svg,id){
    qa('.tr',svg).forEach(x=>x.classList.remove('tr','tr-up','tr-dn','tr-me'));
    if(!id){ svg.classList.remove('fx-trace'); return; }
    const G=gPrep(svg); if(!G.N[id]) return;
    const walk=(start,dir)=>{ const seen=new Set([start]); const st=[start]; while(st.length){ const x=st.pop(); ((dir==='dn'?G.out:G.inc)[x]||[]).forEach(e=>{ e.classList.add('tr','tr-'+dir); const y=dir==='dn'?e.dataset.b:e.dataset.a; if(y&&G.N[y]&&!seen.has(y)){ seen.add(y); G.N[y].classList.add('tr'); st.push(y); } }); } };
    walk(id,'dn'); walk(id,'up');
    G.N[id].classList.add('tr','tr-me'); svg.classList.add('fx-trace');
  }
  function graphs(root){
    qa('.kgraph',root).forEach(fig=>{
      const svg=qs('.fig-scroll svg',fig); if(!svg||svg._fxb) return; svg._fxb=1;
      const G=gPrep(svg); if(!G.edges.length) return;
      const head=qs('.fig-head',fig);
      if(head && !qs('.fx-gbtn',head)) head.insertAdjacentHTML('beforeend',`<span class="fx-gctl"><span class="fx-step" aria-live="polite"></span><button type="button" class="fx-gbtn" aria-pressed="false" title="Пошагово показать, как развивается цепочка">▶ Проиграть</button></span>`);
      const sc=qs('.fig-scroll',fig); if(sc && !qs('.fx-hint',fig)) sc.insertAdjacentHTML('afterend',`<p class="fx-hint">Наведите на блок (на телефоне — нажмите): <span class="fx-dn">синим</span> — к чему он ведёт, <span class="fx-up">оранжевым</span> — откуда.</p>`);
      qs('.fx-gbtn',fig).addEventListener('click',()=>{ if(svg._tm&&svg._tm.length&&svg.classList.contains('fx-playing')) gStop(svg); else gPlay(svg,RM()?60:760,true); });
      svg.addEventListener('pointerover',e=>{ if(e.pointerType!=='mouse'||svg._pin||svg.classList.contains('fx-hide')) return; const g=e.target.closest('.gn-w'); gTrace(svg,g?g.dataset.n:null); });
      svg.addEventListener('pointerleave',e=>{ if(e.pointerType==='mouse'&&!svg._pin) gTrace(svg,null); });
      svg.addEventListener('click',e=>{ if(svg.classList.contains('fx-hide')) return; const g=e.target.closest('.gn-w');
        if(!g){ svg._pin=null; gTrace(svg,null); return; }
        if(g.querySelector('[data-kd]')) return; // препарат: переход к карточке
        const id=g.dataset.n; if(svg._pin===id){ svg._pin=null; gTrace(svg,null); } else { svg._pin=id; gTrace(svg,id); } });
      svg.addEventListener('focusin',e=>{ const g=e.target.closest('.gn-w'); if(g&&!svg._pin) gTrace(svg,g.dataset.n); });
      svg.addEventListener('focusout',()=>{ if(!svg._pin) gTrace(svg,null); });
      if(!RM() && io){ const r=fig.getBoundingClientRect(); if(r.top>innerHeight*0.55){ watch(fig,()=>gPlay(svg,Math.max(70,Math.min(130,900/(G.max+1))),false)); } }
    });
  }

  /* ---------- прогресс чтения ---------- */
  let bar=null, raf=0;
  function progInit(){ if(bar) return; bar=document.createElement('div'); bar.className='fx-prog'; bar.setAttribute('aria-hidden','true'); bar.innerHTML='<i></i>'; document.body.appendChild(bar);
    addEventListener('scroll',()=>{ if(!raf) raf=requestAnimationFrame(progDraw); },{passive:true}); addEventListener('resize',progDraw); }
  function progDraw(){ raf=0; if(!bar) return; const h=document.documentElement.scrollHeight-innerHeight; const on=h>innerHeight*1.2; bar.classList.toggle('on',on); bar.firstChild.style.transform=`scaleX(${on?Math.min(1,Math.max(0,scrollY/h)).toFixed(4):0})`; }

  /* ---------- горячие клавиши ---------- */
  function focusSearch(){ const q=qs('#q'); if(!q) return; const rail=qs('#rail'); if(matchMedia('(max-width: 920px)').matches && rail && !rail.classList.contains('open')) qs('#menuBtn').click(); setTimeout(()=>{ q.focus(); q.select(); },matchMedia('(max-width: 920px)').matches?230:0); }
  document.addEventListener('keydown',e=>{
    const t=e.target, typing=/^(input|textarea|select)$/i.test(t.tagName||'')||t.isContentEditable;
    if((e.ctrlKey||e.metaKey)&&!e.altKey&&(e.key==='k'||e.key==='K'||e.key==='л'||e.key==='Л')){ e.preventDefault(); focusSearch(); return; }
    if(typing||e.ctrlKey||e.metaKey||e.altKey) return;
    if(e.key==='/'||e.key==='.'&&e.code==='Slash'){ e.preventDefault(); focusSearch(); }
  });

  /* ---------- оболочка: тема, подсказка клавиш ---------- */
  function shell(){
    const rail=qs('#rail'); if(rail && !qs('.fx-theme',rail)){
      rail.insertAdjacentHTML('beforeend',`<div class="fx-theme" role="group" aria-label="Тема оформления"><span>Тема</span><button type="button" data-th="auto">Авто</button><button type="button" data-th="light">Светлая</button><button type="button" data-th="dark">Тёмная</button></div>`);
      qs('.fx-theme',rail).addEventListener('click',e=>{ const b=e.target.closest('[data-th]'); if(b) themeSet(b.dataset.th); });
      themeApply(themeGet());
    }
    const s=qs('.search'); if(s && !qs('.fx-k',s)){ s.insertAdjacentHTML('beforeend','<kbd class="fx-k" aria-hidden="true">/</kbd>'); }
    progInit();
  }

  /* ---------- маршрут ---------- */
  function page(kind){
    if(io){ io.disconnect(); }
    const pg=qs('#page');
    if(pg && !RM()){ pg.classList.remove('fx-enter'); void pg.offsetWidth; pg.classList.add('fx-enter'); }
    requestAnimationFrame(()=>{ graphs(pg); chains(pg); reveal(pg); progDraw(); });
  }
  function dossier(){ const b=qs('#dzBody'); if(b) requestAnimationFrame(()=>chains(b)); }

  /* ---------- число с подсчётом ---------- */
  function count(el,to,ms){ if(!el) return; if(RM()){ el.textContent=to; return; } const t0=performance.now(); const step=t=>{ const k=Math.min(1,(t-t0)/(ms||900)); el.textContent=Math.round(to*(1-Math.pow(1-k,3))); if(k<1) requestAnimationFrame(step); }; requestAnimationFrame(step); }

  return {page, dossier, chains, shell, count, RM, gPlay, gTrace};
})();
