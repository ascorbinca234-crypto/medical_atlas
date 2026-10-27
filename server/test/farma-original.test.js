'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
test('ссылки фармакологии с главной открывают обзор атласа',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const links=[...html.matchAll(/href="(farma-atlas[^\"]*)"/g)].map(m=>m[1]);
 assert.ok(links.length>=3);assert.ok(links.every(href=>href==='farma-atlas/?v=farma-original-20261027'));
});
test('публичная фармакология подключает авторский тренажёр и показывает размер полного каталога',()=>{
 const html=fs.readFileSync(path.join(root,'farma-atlas/index.html'),'utf8');
 const summary=JSON.parse(fs.readFileSync(path.join(root,'farma-atlas/src/overview.json')));
 assert.equal(summary.drugs,522);assert.equal(summary.lectures,13);
 assert.match(html,/function lTest\(/);assert.match(html,/\['test','Тест'\]/);
 assert.match(html,/if\(!window.MA_FARMA_FULL\)/);
 assert.equal(JSON.parse(fs.readFileSync(path.join(root,'farma-atlas/topics.json'))).fullAtlas,'atlas');
});
test('защищённый оригинал содержит 522 препарата и полный готовый тренажёр', {skip:!fs.existsSync(path.join(root,'server/content/topics/farma/atlas.js'))},()=>{
 const code=fs.readFileSync(path.join(root,'server/content/topics/farma/atlas.js'),'utf8');
 const appStart=code.indexOf('/* ===== Рендер атласа ===== */'),fxStart=code.indexOf('/* ===== Анимации и «фишки»');
 const registryEnd=code.indexOf('/* ---------- карточка ---------- */',appStart);
 assert.ok(appStart>fxStart&&fxStart>0&&registryEnd>appStart);
 const prefix=code.slice(0,fxStart)+code.slice(appStart,registryEnd);
 const ctx=vm.createContext({window:{},localStorage:{getItem:()=>null},setTimeout:()=>0,clearTimeout(){}});
 vm.runInContext(prefix+'\nglobalThis.result={drugs:UNI.length,lectures:KP.length,deck:lDeck({kSame,key,kFindDrug}).map(it=>it.p),test:typeof lTest};})();})();',ctx);
 assert.equal(ctx.result.drugs,522);assert.equal(ctx.result.lectures,13);assert.equal(ctx.result.test,'function');
 assert.ok(ctx.result.deck.length>400);assert.equal(new Set(ctx.result.deck).size,12);
 assert.doesNotMatch(fs.readFileSync(path.join(root,'farma-atlas/index.html'),'utf8'), /const DRUGS_ORDER=/);
});
