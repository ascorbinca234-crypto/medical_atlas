'use strict';
// Опыт и стрик считаются и на сервере (src/progress.js), и в браузере (progress/progress.js). Расчёты должны совпадать.
const test = require('node:test'), assert = require('node:assert');
const path = require('path'), fs = require('fs');
const server = require('../src/progress');
const browserFile = path.join(__dirname, '..', '..', 'progress', 'progress.js');

test('браузер и сервер считают опыт и стрик одинаково', { skip: !fs.existsSync(browserFile) }, () => {
  const browser = require(browserFile);
  assert.deepStrictEqual(browser.RULES, server.RULES);
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let run = 0; run < 300; run++) {
    const today = server.isoAdd('2026-10-17', Math.floor(rnd() * 40));
    const days = {};
    for (let i = 0; i < 120; i++) {
      if (rnd() < 0.35) continue;
      const n = Math.floor(rnd() * 25);
      if (n) days[server.isoAdd(today, -i)] = [n, Math.floor(rnd() * n), Math.floor(rnd() * 4)];
    }
    const bonus = Math.floor(rnd() * 100);
    assert.deepStrictEqual(browser.compute(days, today, bonus), server.compute(days, today, bonus));
    assert.strictEqual(browser.xpBetween(days, server.isoAdd(today, -5), today), server.xpBetween(days, server.isoAdd(today, -5), today));
    assert.deepStrictEqual(browser.mergeDays([days, days]), server.mergeDays([days, days]));
  }
});

test('частичная тема сохраняет ранее освоенные разделы и не публикует нули соседних тем',()=>{
 const vm=require('vm'),values=new Map();
 const window={MA_TOPICS:{},MA_TOPIC:'sec-aa',addEventListener(){}};
 const ctx={window,document:{addEventListener(){}},localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},setTimeout(){},clearTimeout(){},Date,Uint8Array};
 vm.runInNewContext(fs.readFileSync(browserFile,'utf8'),ctx);
 window.MAP.sections('biochem',[{id:'aa',learned:5,total:20},{id:'carb',learned:0,total:3}]);
 window.MA_TOPIC='sec-carb';window.MAP.sections('biochem',[{id:'aa',learned:0,total:1},{id:'carb',learned:7,total:25}]);
 let sec=JSON.parse(values.get('ma-progress-v1')).sec.biochem.list;
 assert.strictEqual(sec.find(x=>x.id==='aa').learned,5);assert.strictEqual(sec.find(x=>x.id==='carb').learned,7);
 window.MA_TOPIC='path-tca';window.MAP.sections('biochem',[{id:'aa',learned:0,total:0}]);
 assert.deepStrictEqual(JSON.parse(values.get('ma-progress-v1')).sec.biochem.list,sec);
});
