'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

function chemVm(hasGrant=false, loadedTopics=[]){
 const records=[],stored={};let url={hash:'#lesson-1',href:'https://example.com/medical_atlas/chemistry-atlas/#lesson-1'};
 const cls={add(){},remove(){},toggle(){return false},contains(){return false}};
 function element(id=''){return {id,innerHTML:'',textContent:'',hidden:false,style:{},classList:cls,dataset:{},value:'',addEventListener(){},setAttribute(){},focus(){},scrollIntoView(){},querySelector(sel){return element(sel)},querySelectorAll(){return []}}}
 const elements=Object.fromEntries(['#nav','#page','#search','#rail','#scrim','#menu'].map(k=>[k,element(k)]));
 const document={querySelector:s=>elements[s]||element(s),addEventListener(){},body:{style:{}},activeElement:{tagName:'BODY'},hidden:false};
 const MA={hasAtlasAccess:id=>hasGrant&&id==='chemistry',signedIn:()=>hasGrant,loginUrl:()=>'../auth/',bootAtlas(){}};
 const win={MAP:{last:o=>records.push(o)},MA,scrollTo(){},addEventListener(){}};
 const ctx=vm.createContext({document,window:win,location:url,URL,localStorage:{getItem:k=>stored[k]??null,setItem:(k,v)=>stored[k]=v},matchMedia:()=>({matches:false,addEventListener(){}}),setInterval,clearInterval,setTimeout,clearTimeout,requestAnimationFrame:()=>1,cancelAnimationFrame(){},console});
 for(const f of ['content.js','supplement.js','first-semester.js','visuals.js','formula-cards.js','formula-learning.js','formulas.js'])vm.runInContext(read('chemistry-atlas/'+f),ctx,{filename:f});
 for(const tid of loadedTopics)vm.runInContext(read('server/content/topics/chemistry/'+tid+'.js'),ctx,{filename:tid+'.js'});
 vm.runInContext(read('chemistry-atlas/app.js'),ctx,{filename:'app.js'});
 vm.runInContext('window.bootChemistryApp&&window.bootChemistryApp()',ctx);
 return {ctx,elements,records,url};
}

test('химия включена в каталог и кабинет по общим правилам подписки (2 первых занятия открыты)',()=>{
 const home=read('index.html'),cabinet=read('cabinet/index.html'),chem=read('chemistry-atlas/index.html');
 assert.match(home,/data-ma-atlas="chemistry"[\s\S]*?Пробная версия/);
 assert.match(home,/Без подписки: два первых занятия/);
 assert.match(cabinet,/chemistry: SITE \+ 'chemistry-atlas\/'/);
 assert.doesNotMatch(cabinet,/if\s*\(atlas\s*===\s*'chemistry'\)\s*return true/);
 assert.match(chem,/href="\.\.\/#atlases"/);assert.match(chem,/href="\.\.\/cabinet\/"/);
 assert.match(chem,/bootAtlas\('chemistry','chem-app'\)/);
 assert.match(chem,/anti-theft-guard\.js/);
 const cat=JSON.parse(read('chemistry-atlas/topics.json'));
 assert.deepEqual(cat.demo,['lesson-1','lesson-2']);
 assert.deepEqual(cat.publicRoutes,['start']);
 assert.equal(cat.topics.length,15);
});

test('химия без подписки открывает только занятия 1–2 и блокирует 3–14 и формулы',()=>{
 const {ctx,elements,records}=chemVm(false);
 for(const i of [1,2]){
  vm.runInContext(`window.show(${i})`,ctx);
  assert.doesNotMatch(elements['#page'].innerHTML,/data-chem-locked="true"/);
  assert.ok(elements['#page'].innerHTML.includes('panel-visual'));
  assert.ok(elements['#page'].innerHTML.includes('quiz-form'));
 }
 assert.equal(records.length,3);
 for(let i=3;i<=14;i++){
  vm.runInContext(`window.show(${i})`,ctx);
  assert.match(elements['#page'].innerHTML,/data-chem-locked="true"/);
  assert.doesNotMatch(elements['#page'].innerHTML,/quiz-form/);
 }
 vm.runInContext('window.showFormulas()',ctx);
 assert.match(elements['#page'].innerHTML,/data-chem-locked="true"/);
});

test('химия с подпиской и серверными пакетами открывает все 14 занятий и справочник формул',()=>{
 const allTopics=[...Array.from({length:14},(_,i)=>'lesson-'+(i+1)),'formulas'];
 const {ctx,elements,records}=chemVm(true,allTopics);
 for(let i=1;i<=14;i++){
  vm.runInContext(`window.show(${i})`,ctx);
  assert.doesNotMatch(elements['#page'].innerHTML,/data-chem-locked="true"/);
  assert.equal(records.at(-1).atlas,'chemistry');
  assert.equal(new URL(records.at(-1).url).hash,`#lesson-${i}`);
  assert.ok(elements['#page'].innerHTML.includes('panel-visual'));
  assert.ok(elements['#page'].innerHTML.includes('quiz-form'));
 }
 vm.runInContext('window.showFormulas()',ctx);
 assert.doesNotMatch(elements['#page'].innerHTML,/data-chem-locked="true"/);
 assert.ok(elements['#page'].innerHTML.includes('formula-card'));
});
