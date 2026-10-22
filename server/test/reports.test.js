'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
function fixture(){
 const state={items:{},log:[{t:1,i:'known',g:2,a:'Ответ по-русски'}],errs:{},facts:{f:{text:'Мой сложный факт',back:'Ответ',kind:'fact',created:1,th:'g1'}},notes:{},pairs:{p:{a:'Бактерии',b:'Вирусы',diff:'Клеточное строение',note:'Своя заметка',th:'g1'}},runs:[{kind:'test',n:10,score:7,t0:1}]};
 const P={flush(){},S:()=>state,course:()=>({pct:.2,attempts:1,D:1,total:10,due:1,overdue:0,active:0,repeated:0,ts:[{t:'g1',L:1,N:1,acc:1,due:1,overdue:0}]}),
  item:()=>({}),itemTitle:()=> 'Вопрос',LEVELS:[{n:'Не изучено'},{n:'Изучается'}],FACTK:{fact:'Факт'},ERRS:{},ERRT:{},errActive:()=>false,reg:()=>({cmpMap:{}})};
 const ctx=vm.createContext({window:{},document:{addEventListener(){},createElement:()=>({set innerHTML(s){this.content={textContent:s};}})},location:{href:'https://example.test/medical_atlas/micro-atlas/'},URL,TextEncoder,Blob,setTimeout,btoa,Uint8Array,Uint32Array,DataView,TMAP:{g1:{title:'Морфология'}}});
 vm.runInContext(fs.readFileSync(path.join(root,'micro-atlas/src/prep-export.js'),'utf8'),ctx);
 return {api:ctx.window.MICRO_REPORTS,P,state,ctx};
}
test('читаемый отчёт сохраняет метрики, свои сравнения и ответы без изменения прогресса',()=>{
 const {api,P,state}=fixture(),before=JSON.stringify(state),r=api.report(P),text=JSON.stringify(r);
 for(const expected of ['20 %','Морфология','Изучается','Клеточное строение','Своя заметка','Ответ по-русски','7 из 10','70 %'])assert.ok(text.includes(expected),expected);
 assert.equal(JSON.stringify(state),before);
 state.log=[];P.course=()=>({...P.course,attempts:0,ts:[],D:0,total:10});
 assert.match(JSON.stringify(api.report(P)),/Ответов пока нет/);
});
test('раздел данных предлагает PDF и Word, а резервная копия JSON остаётся доступна',()=>{
 const {api,P}=fixture();P.path=()=>({sub:'data'});P.page=()=>'<h2 class="sec">Сохранить и перенести</h2><button>Скачать файл прогресса</button>';
 const html=api.page(P,{});assert.match(html,/Скачать PDF/);assert.match(html,/Скачать Word \(\.docx\)/);assert.match(html,/Скачать резервную копию \(JSON\)/);
 P.path=()=>({sub:'review'});assert.equal(api.page(P,{}),P.page());
 const locked={page:()=> 'Нужна подписка'};assert.equal(api.page(locked,{}),'Нужна подписка');
});
test('Word скачивается как настоящий DOCX и сохраняет пользовательский текст безопасно',async()=>{
 const {api,P,state}=fixture();state.facts.f.note='<script>alert("тест")</script> & < >';
 const blob=api.docx(api.report(P));assert.equal(blob.type,'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-report-')),file=path.join(dir,'report.docx');
 try{
  fs.writeFileSync(file,Buffer.from(await blob.arrayBuffer()));
  execFileSync('python3',['-c',`import sys,zipfile,xml.etree.ElementTree as E
with zipfile.ZipFile(sys.argv[1]) as z:
 assert z.testzip() is None
 for name in z.namelist(): E.fromstring(z.read(name))
 text=''.join(E.fromstring(z.read('word/document.xml')).itertext())
 assert '<script>alert("тест")</script> & < >' in text
 assert 'Клеточное строение' in text
 assert 'Ответ по-русски' in text
`,file]);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
