'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('химия включена в главный каталог и кабинет как открытый атлас',()=>{
 const home=read('index.html'),cabinet=read('cabinet/index.html'),chem=read('chemistry-atlas/index.html');
 assert.match(home,/href="chemistry-atlas\/"/);assert.match(home,/Все занятия доступны без подписки/);
 assert.match(cabinet,/chemistry: SITE \+ 'chemistry-atlas\/'/);assert.match(cabinet,/id === 'chemistry' \? 'Открыт для всех'/);
 assert.match(chem,/href="\.\.\/#atlases"/);assert.match(chem,/href="\.\.\/cabinet\/"/);assert.match(chem,/\.\.\/progress\/progress\.js/);
 for(const f of ['content.js','supplement.js','first-semester.js','visuals.js','app.js','style.css','design.css']){assert.match(chem,new RegExp(f.replace('.','\\.')));assert.ok(fs.existsSync(path.join(root,'chemistry-atlas',f)))}
});
test('каждое химическое занятие открывается и передаёт в кабинет верный адрес',()=>{
 const records=[],stored={};let url={hash:'#lesson-1',href:'https://example.com/medical_atlas/chemistry-atlas/#lesson-1'};
 const cls={add(){},remove(){},toggle(){return false},contains(){return false}};
 function element(id=''){return {id,innerHTML:'',textContent:'',hidden:false,style:{},classList:cls,dataset:{},value:'',setAttribute(){},focus(){},scrollIntoView(){},querySelector(sel){return element(sel)},querySelectorAll(){return []}}}
 const elements=Object.fromEntries(['#nav','#page','#search','#rail','#scrim','#menu'].map(k=>[k,element(k)]));
 const document={querySelector:s=>elements[s]||element(s),addEventListener(){},body:{style:{}},activeElement:{tagName:'BODY'},hidden:false};
 const win={MAP:{last:o=>records.push(o)},scrollTo(){},addEventListener(){}};
 const ctx=vm.createContext({document,window:win,location:url,URL,localStorage:{getItem:k=>stored[k]??null,setItem:(k,v)=>stored[k]=v},matchMedia:()=>({matches:false,addEventListener(){}}),setInterval,clearInterval,setTimeout,clearTimeout,requestAnimationFrame:()=>1,cancelAnimationFrame(){},console});
 for(const f of ['content.js','supplement.js','first-semester.js','visuals.js','app.js'])vm.runInContext(read('chemistry-atlas/'+f),ctx,{filename:f});
 for(let i=1;i<=14;i++){vm.runInContext(`show(${i})`,ctx);assert.equal(records.at(-1).atlas,'chemistry');assert.equal(new URL(records.at(-1).url).hash,`#lesson-${i}`);assert.ok(elements['#page'].innerHTML.includes('panel-visual'));assert.ok(elements['#page'].innerHTML.includes('quiz-form'))}
 assert.equal(records.length,15);
});
