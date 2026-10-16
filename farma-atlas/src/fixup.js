/* ===== Слияние закрытой части: заглушки заменяются настоящими темами, восстанавливается исходный порядок ===== */
(function(){
  function dedupe(arr){
    const real=new Map(); arr.forEach(p=>{ if(!p.locked) real.set(p.id,p); });
    const seen=new Set(), out=[];
    arr.forEach(p=>{ const r=real.get(p.id)||p; if(seen.has(r.id)) return; seen.add(r.id); out.push(r); });
    arr.length=0; arr.push(...out);
  }
  dedupe(KP); dedupe(P);
  if(typeof DRUGS_ORDER!=='undefined'){
    const all=Object.assign({},DRUGS); Object.keys(DRUGS).forEach(k=>delete DRUGS[k]);
    DRUGS_ORDER.forEach(k=>{ if(all[k]) DRUGS[k]=all[k]; });
    Object.keys(all).forEach(k=>{ if(!DRUGS[k]) DRUGS[k]=all[k]; });
  }
})();
