'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'../..');
function browser(fetchImpl, signedIn=true){
  let session=signedIn?JSON.stringify({access:'token',accessExp:Date.now()/1000+300,refresh:'refresh',refreshExp:Date.now()/1000+600,user:{id:'u'}}):null;
  let reads=0,deleted=0;
  const ctx={URL,Promise,Date,AbortController,console,setTimeout:(fn,ms)=>setTimeout(fn,Math.min(ms,50)),clearTimeout,
    window:{MA_CONFIG:{api:'https://api.invalid'},addEventListener(){}},
    document:{currentScript:{src:'https://site.invalid/auth/auth.js'},addEventListener(){}},location:{href:'https://site.invalid/farma-atlas/'},
    localStorage:{getItem:()=>session,setItem:(_,v)=>session=v,removeItem:()=>session=null},
    indexedDB:{open(){reads++;throw new Error('Must not read old cache');},deleteDatabase(){deleted++;}},fetch:fetchImpl};
  vm.runInNewContext(fs.readFileSync(path.join(root,'auth/auth.js'),'utf8'),ctx);
  return {MA:ctx.window.MA,cache:()=>({reads,deleted}),change:()=>{session=null;}};
}
const response=(status,policy='subject-subscription-v1',expires=Date.now()+60000)=>({ok:status===200,status,headers:{get:n=>n==='X-Access-Policy'?policy:n==='X-Content-Policy'?'topic-delivery-v1':String(expires)},text:async()=>status===200?'paidContent()':'{}'});
test('старый кэш не используется при 401/403/404 или старом API без политики',async()=>{
  for(const [status,policy] of [[401,''],[403,''],[404,''],[200,'']]){
    const b=browser(async()=>response(status,policy));const r=await b.MA.loadLocked('farma','old-hash');
    assert.notEqual(r.status,'ok');assert.equal(r.code,null);assert.deepEqual(b.cache(),{reads:0,deleted:1+(status===401?1:0)});
  }
});
test('только подтверждённый доступ текущего аккаунта даёт код; истёкшее право отвергается',async()=>{
  let url;
  const b=browser(async u=>{url=u;return response(200);});assert.equal((await b.MA.loadLocked('farma','test-topic')).code,'paidContent()');assert.match(url,/\/content-v3\/farma\/test-topic$/);
  assert.equal((await browser(async()=>response(200,undefined,Date.now()-1)).MA.loadLocked('micro','test-topic')).code,null);
  let finish;
  const delayed=browser(()=>new Promise(r=>finish=r));const load=delayed.MA.loadLocked('biochem','test-topic');
  await new Promise(r=>setImmediate(r));delayed.change();finish(response(200));assert.equal((await load).code,null);
});
test('без входа запросов нет; зависший сервер завершает загрузку пробной версии',async()=>{
  let calls=0;
  const anon=browser(async()=>{calls++;},false);assert.equal((await anon.MA.loadLocked('micro','test-topic')).status,'signed-out');assert.equal(calls,0);
  const b=browser(()=>new Promise(()=>{}));assert.equal((await b.MA.loadLocked('micro','test-topic')).status,'error');
});
test('запоздалое обновление токена не возвращает пользователя после выхода',async()=>{
  let finish;
  const b=browser(()=>new Promise(r=>finish=r));const refresh=b.MA.refresh();b.change();finish({ok:true,status:200,text:async()=>JSON.stringify({accessToken:'a',refreshToken:'b',user:{id:'u'}})});
  await assert.rejects(refresh,/Аккаунт изменился/);assert.equal(b.MA.signedIn(),false);
});
test('публичная фармакология содержит только два полных конспекта и пустые заглушки остальных',()=>{
  const page=fs.readFileSync(path.join(root,'farma-atlas/index.html'),'utf8');
  const data=[...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(x=>x.includes('const KP ='));
  const ctx=vm.createContext({});vm.runInContext(data,ctx);
  assert.equal(vm.runInContext('JSON.stringify(KP.filter(p=>!p.locked).map(p=>p.id))',ctx),'["k-gen","k-aff"]');
  assert.equal(vm.runInContext('P.every(p=>p.locked&&p.blocks.length===0)',ctx),true);
  assert.equal(vm.runInContext('Object.keys(DRUGS).length+Object.keys(RXD).length+ANTIDOTES.length',ctx),0);
  assert.equal(vm.runInContext('KP.filter(p=>p.locked).every(p=>!p.lead&&p.blocks.length===0)',ctx),true);
  assert.ok(!fs.existsSync(path.join(root,'farma-atlas/src/k_02_pns.js')));
});
test('бесплатная Фарма содержит все анимации, сохраняя закрытые конспекты и досье',()=>{
  const ctx=vm.createContext({window:{},localStorage:{getItem:()=>null}}),src=path.join(root,'farma-atlas/src');
  vm.runInContext(['data.js','k0.js','k_00_gen.js','k_01_aff.js','locked_stubs.js','drugs.js','body.js'].map(f=>fs.readFileSync(path.join(src,f),'utf8')).join('\n'),ctx);
  assert.equal(vm.runInContext('Object.keys(VIT).length',ctx),176);
  assert.equal(vm.runInContext('typeof EXTRA.routes.body',ctx),'function');
  assert.equal(vm.runInContext('Object.keys(DRUGS).length',ctx),0);
  assert.equal(vm.runInContext('KP.filter(p=>!p.locked).length',ctx),2);
  const catalog=JSON.parse(fs.readFileSync(path.join(root,'farma-atlas/topics.json')));
  assert.deepEqual(catalog.publicRoutes,['body','drugs','topics']);assert.deepEqual(catalog.aliases,{});
});
test('публичная патанатомия содержит 3 открытые темы первых 2 занятий и закрытые заглушки остальных 23 тем',()=>{
  const page=fs.readFileSync(path.join(root,'patan-atlas/index.html'),'utf8');
  const m=page.match(/<script id="patan-data">\s*window\.PATAN_DATA=(\{[\s\S]*?\});\s*<\/script>/);
  assert.ok(m, 'window.PATAN_DATA script found in patan-atlas/index.html');
  const data=JSON.parse(m[1]);
  const topics=data.topics;
  assert.equal(topics.length,26);
  assert.deepEqual(topics.filter(t=>!t.locked).map(t=>t.id),['norma','necrosis','infarction']);
  assert.equal(topics.filter(t=>t.locked).length,23);
  assert.ok(topics.filter(t=>t.locked).every(t=>t.def===''&&t.blocks.length===0&&t.micro.length===0&&t.macro.length===0&&t.em.length===0&&t.schemes.length===0&&t.quiz.length===0&&t._counts));
  const catalog=JSON.parse(fs.readFileSync(path.join(root,'patan-atlas/topics.json'),'utf8'));
  assert.deepEqual(catalog.demo,['norma','necrosis','infarction']);
  assert.deepEqual(catalog.publicRoutes,['diag','method']);
});
test('публичная биохимия открывает только 2 первых раздела (aa, carb) и 2 конспекта; остальное закрыто до загрузки пакетов',()=>{
  const page=fs.readFileSync(path.join(root,'biochem-atlas/index.html'),'utf8');
  const m=page.match(/<script type="text\/plain" id="biochem-app">([\s\S]*?)<\/script>/);
  assert.ok(m,'biochem-app script block found');
  assert.match(page,/bootAtlas\('biochem','biochem-app'\)/);
  assert.match(page,/anti-theft-guard\.js/);
  for(const name of ['ETC','Kin','Hb','Box','Camp'])assert.doesNotMatch(page,new RegExp('function mount'+name+'\\('));
  const makeEl=(id)=>{const c=[];let html='';const n={get innerHTML(){return html;},set innerHTML(v){html=String(v||'');if(id==='rxAll'){c.length=0;const k=(html.match(/<details\b/g)||[]).length;for(let i=0;i<k;i++)c.push(makeEl());}},textContent:'',value:'',hidden:false,children:c,nextSibling:null,style:{setProperty(){}},dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},setAttribute(){},getAttribute:()=>null,appendChild(ch){c.push(ch);return ch;},replaceChildren(...xs){c.length=0;c.push(...xs);},insertBefore(ch){c.push(ch);return ch;},remove(){},scrollIntoView(){},addEventListener(){},focus(){},blur(){},closest:()=>null,querySelector:()=>makeEl(),querySelectorAll:()=>[]};n.parentNode=n;return n;};
  const byId=Object.create(null);
  const ctx=vm.createContext({console,URL,setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},requestAnimationFrame:()=>1,cancelAnimationFrame(){},
    window:{location:{hash:'',href:'https://site.invalid/biochem-atlas/'},matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){},scrollTo(){},MA_TOPICS:JSON.parse(fs.readFileSync(path.join(root,'biochem-atlas/topics.json'),'utf8'))},
    location:{hash:'',href:'https://site.invalid/biochem-atlas/'},history:{replaceState(){}},
    document:{documentElement:{lang:'',classList:{add(){},remove(){},toggle(){}}},addEventListener(){},getElementById:id=>(byId[id]||(byId[id]=makeEl(id))),createElement:()=>makeEl(),createElementNS:()=>makeEl(),querySelector:()=>makeEl(),querySelectorAll:()=>[],body:{classList:{toggle(){},add(){},remove(){}},appendChild(){}}},
    localStorage:{getItem:()=>null,setItem(){}},navigator:{clipboard:{writeText:async()=>{}}}});
  vm.runInContext(m[1],ctx);
  assert.equal(vm.runInContext('DB.length',ctx),40);
  assert.equal(vm.runInContext("DB.every(x=>x.s==='aa'||x.s==='carb')",ctx),true);
  assert.equal(vm.runInContext('RX.length',ctx),90);
  assert.equal(vm.runInContext("NOTES.filter(n=>!n.locked).map(n=>n.id).join(',')",ctx),'proteins,enzymes');
  assert.equal(vm.runInContext("NOTES.filter(n=>n.locked).every(n=>n.sum.length===0&&n.secs.length===0&&n.quiz.length===0)",ctx),true);
  assert.equal(vm.runInContext('PATHS.every(p=>p.locked&&!p.nodes&&!p.edges&&!p.steps)',ctx),true);
  assert.equal(vm.runInContext('ANIMS.every(a=>a.locked&&!a.mount)',ctx),true);
  const catalog=JSON.parse(fs.readFileSync(path.join(root,'biochem-atlas/topics.json'),'utf8'));
  assert.deepEqual(catalog.demo,['sec-aa','sec-carb','note-proteins','note-enzymes']);
  assert.deepEqual(catalog.publicRoutes,['','atlas']);
  assert.equal(catalog.topics.length,34);
});
test('полная фармакология восстанавливает данные и регистрирует все расширения', {skip:!fs.existsSync(path.join(root,'server/content/farma.js'))},()=>{
  const ctx=vm.createContext({window:{},localStorage:{getItem:()=>null}});
  const src=path.join(root,'farma-atlas/src');
  vm.runInContext(['data.js','k0.js','k_00_gen.js','k_01_aff.js','locked_stubs.js','drugs.js'].map(f=>fs.readFileSync(path.join(src,f),'utf8')).join('\n'),ctx);
  vm.runInContext(fs.readFileSync(path.join(root,'server/content/farma.js'),'utf8'),ctx);
  assert.equal(vm.runInContext('JSON.stringify([KP.length,P.length,Object.keys(DRUGS).length,Object.keys(VIT).length])',ctx),'[13,16,273,176]');
  assert.equal(vm.runInContext('typeof EXTRA.routes.body',ctx),'function');
  assert.equal(vm.runInContext('typeof EXTRA.routes.learn',ctx),'function');
});

