'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
test('ссылки фармакологии с главной открывают обзор атласа',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const links=[...html.matchAll(/href="(farma-atlas[^\"]*)"/g)].map(m=>m[1]);
 assert.ok(links.length>=3);assert.ok(links.every(href=>href==='farma-atlas/?v=farma-20261113'));
});
test('публичная фармакология подключает авторский тренажёр и показывает размер полного каталога',()=>{
 const html=fs.readFileSync(path.join(root,'farma-atlas/index.html'),'utf8');
 const summary=JSON.parse(fs.readFileSync(path.join(root,'farma-atlas/src/overview.json')));
 assert.equal(summary.drugs,523);assert.equal(summary.lectures,13);assert.equal(summary.cards,635);
 assert.match(html,/function lTestBox\(/);assert.match(html,/\['test','Тест'\]/);
 assert.match(html,/if\(!window.MA_FARMA_FULL\)/);
 assert.equal(JSON.parse(fs.readFileSync(path.join(root,'farma-atlas/topics.json'))).fullAtlas,'atlas');
});
test('защищённый оригинал содержит 523 препарата и полный готовый тренажёр', {skip:!fs.existsSync(path.join(root,'server/content/topics/farma/atlas.js'))},()=>{
 const code=fs.readFileSync(path.join(root,'server/content/topics/farma/atlas.js'),'utf8');
 const appStart=code.indexOf('/* ===== Рендер атласа ===== */'),fxStart=code.indexOf('/* ===== Анимации и «фишки»');
 const registryEnd=code.indexOf('/* ---------- карточка ---------- */',appStart);
 assert.ok(appStart>fxStart&&fxStart>0&&registryEnd>appStart);
 const prefix=code.slice(0,fxStart)+code.slice(appStart,registryEnd);
 const ctx=vm.createContext({window:{},localStorage:{getItem:()=>null},setTimeout:()=>0,clearTimeout(){}});
 vm.runInContext(prefix+'\nglobalThis.result={drugs:UNI.length,lectures:KP.length,deck:lDeck({kSame,key,kFindDrug,uFind,rpAll:()=>[]}).map(it=>it.p),test:typeof lTestBox};})();})();',ctx);
 assert.equal(ctx.result.drugs,523);assert.equal(ctx.result.lectures,13);assert.equal(ctx.result.test,'function');
 assert.equal(ctx.result.deck.length,635);assert.equal(new Set(ctx.result.deck).size,12);
 assert.doesNotMatch(fs.readFileSync(path.join(root,'farma-atlas/index.html'),'utf8'), /const DRUGS_ORDER=/);
});

test('новый алгоритм повторения сохраняет прежнюю историю и сообщает об ответах кабинету',()=>{
 const source=fs.readFileSync(path.join(root,'farma-atlas/src/learn.js'),'utf8');
 const day=Math.floor(Date.now()/864e5), stamp=123456789;
 const stored={v:1,items:{'k-aff:лидокаин':[3,day,8,2,stamp]},days:{[day]:8}};
 const cards=[];
 const ctx=vm.createContext({window:{MAP:{card:x=>cards.push(x)}},localStorage:{getItem:k=>k==='atlas-learn-v1'?JSON.stringify(stored):null,setItem(){}},setTimeout:()=>0,clearTimeout(){},EXTRA:{routes:{},nav:[],home:[]}});
 vm.runInContext(source+";globalThis.before=JSON.parse(JSON.stringify(LST));lRate('k-aff:лидокаин',3);globalThis.after=JSON.parse(JSON.stringify(LST));",ctx);
 assert.equal(ctx.before.v,2);assert.deepEqual(Array.from(ctx.before.items['k-aff:лидокаин']).slice(0,5),[4,day,8,2,stamp]);
 assert.equal(ctx.after.items['k-aff:лидокаин'][2],9);assert.equal(ctx.after.days[day],9);assert.equal(cards.length,1);assert.equal(cards[0].ok,true);
});
