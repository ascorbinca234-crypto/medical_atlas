'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),vm=require('vm');
const {topicFixture}=require('./topic-fixture');
const {memoryStore}=require('../src/store/memory');
const {createApp}=require('../src/app');
const {config}=require('../src/config');
const {keys,jwtSign,now}=require('../src/tokens');
async function setup(t,limits={}) {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ma-topics-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const cfg=config({SITE_URL:'https://site.invalid',API_URL:'https://api.invalid',SECRET:'x'.repeat(40),STORE:'memory',MAIL_TRANSPORT:'log',CONTENT_DIR:dir});
 Object.assign(cfg.contentLimits,limits);
 topicFixture(dir,'farma','window.ONLY_TOPIC_A=true;','topic-a');topicFixture(dir,'farma','window.ONLY_TOPIC_B=true;','topic-b');
 fs.writeFileSync(path.join(dir,'farma.js'),'OLD_FULL_SECRET');
 const store=memoryStore();
 for(const id of ['one','two']) { await store.putUser({id,tv:0});await store.putDoc('access:'+id,{farma:{expiresAt:Date.now()+60000}},0); }
 const app=()=>createApp({cfg,store,mail:{},log:{error(){}}});const apps=[app(),app()];
 const call=(url='/content-v3/farma/topic-a',id='one',instance=0)=>apps[instance].handle({method:'GET',path:url,headers:{authorization:'Bearer '+jwtSign({sub:id,tv:0,typ:'a',exp:now()+600},keys(cfg.secret).jwt)},ip:'shared-ip',query:{}});
 return {store,cfg,dir,call,apps};
}
test('старые адреса не выдают полный пакет даже владельцу подписки',async t=>{
 const {call}=await setup(t);
 for(const prefix of ['content','content-v2']) {const r=await call('/'+prefix+'/farma');assert.equal(r.status,410);assert.doesNotMatch(r.body,/OLD_FULL_SECRET/);}
 for(const url of ['/content-v3/farma','/content-v3/farma/..%2Ffarma','/content-v3/farma/unknown'])assert.equal((await call(url)).status,404);
});
test('выдаётся только выбранная тема; метки различаются по аккаунту и запросу; cache no-store',async t=>{
 const {call}=await setup(t);const a=await call(),b=await call(undefined,'two'),c=await call();
 for(const r of [a,b,c]){assert.equal(r.status,200);assert.match(r.body,/ONLY_TOPIC_A/);assert.doesNotMatch(r.body,/ONLY_TOPIC_B|OLD_FULL_SECRET/);assert.match(r.headers['Cache-Control'],/private, no-store/);assert.equal(r.headers['X-Content-Policy'],'topic-delivery-v1');}
 const mark=r=>{const x={window:{}};vm.runInNewContext(r.body,x);return x.window.MA_COPY;};
 assert.notEqual(mark(a).account,mark(b).account);assert.equal(mark(a).account,mark(c).account);assert.notEqual(mark(a).receipt,mark(c).receipt);
 assert.notEqual(a.headers['X-Content-Hash'],c.headers['X-Content-Hash']);assert.match(a.headers.Vary,/Authorization/);
});
test('общий лимит действует для параллельных запросов, разных тем и экземпляров сервера',async t=>{
 const {call,store}=await setup(t,{minute:4});
 const rs=await Promise.all(Array.from({length:10},(_,i)=>call('/content-v3/farma/topic-'+(i%2?'b':'a'),'one',i%2)));
 assert.equal(rs.filter(r=>r.status===200).length,4);assert.equal(rs.filter(r=>r.status===429).length,6);
 for(const r of rs.filter(r=>r.status===429)){assert.ok(Number(r.headers['Retry-After'])>0);assert.doesNotMatch(r.body,/ONLY_TOPIC/);}
 assert.equal((await call(undefined,'two')).status,200);
 const quota=Object.values(store._dump().docs).find(v=>v.d.events&&v.d.events.length===4);assert.ok(quota);
});
test('часовой, суточный и байтовый лимиты независимо ограничивают выдачу',async t=>{
 for(const limits of [{hour:1},{day:1},{bytesDay:35}]){
  const {call}=await setup(t,limits);assert.equal((await call()).status,200);assert.equal((await call('/content-v3/farma/topic-b')).status,429);
 }
});
test('истечение скользящего окна снимает блокировку',async t=>{
 const {call,store}=await setup(t,{minute:1});await call();assert.equal((await call()).status,429);
 const entry=Object.entries(store._dump().docs).find(([k])=>k.startsWith('delivery:'));const [key,r]=entry;r.d.events[0].t-=61000;
 await store.putDoc(key,r.d,r.v);assert.equal((await call()).status,200);
});
test('отзыв после резервирования лимита не выдаёт материал',async t=>{
 const {call,store}=await setup(t);const put=store.putDoc;
 store.putDoc=async (k,d,v)=>{const r=await put(k,d,v);if(k.startsWith('delivery:'))await put('access:one',{farma:{expiresAt:Date.now()+60000,revoked:true}},1);return r;};
 const r=await call();assert.equal(r.status,403);assert.doesNotMatch(r.body,/ONLY_TOPIC/);
});
test('сбой общего хранилища и повреждённый пакет не разрешают выдачу',async t=>{
 let f=await setup(t);f.store.putDoc=async()=>{throw Error('db unavailable');};assert.equal((await f.call()).status,500);
 f=await setup(t);fs.writeFileSync(path.join(f.dir,'topics/farma/topic-a.js'),'tampered');assert.equal((await f.call()).status,500);
});
test('каждый собранный пакет синтаксически корректен; фармакология и микробиология содержат одну тему',{skip:!fs.existsSync(path.resolve(__dirname,'../content/topics'))},()=>{
 const root=path.resolve(__dirname,'../..');const out=path.join(root,'server/content/topics');
 assert.ok(fs.existsSync(out),'Run build.py --full before release verification');
 for(const atlas of ['farma','biochem','micro']){
  const manifest=JSON.parse(fs.readFileSync(path.join(out,atlas,'manifest.json')));
  for(const id of Object.keys(manifest.topics)) {
   const code=fs.readFileSync(path.join(out,atlas,id+'.js'),'utf8');new vm.Script(code,{filename:atlas+'/'+id});
   if(atlas==='farma') {
    const ctx=vm.createContext({window:{},localStorage:{getItem:()=>null}});
    const src=path.join(root,'farma-atlas/src');vm.runInContext(['data.js','k0.js','k_00_gen.js','k_01_aff.js','locked_stubs.js','drugs.js'].map(f=>fs.readFileSync(path.join(src,f),'utf8')).join('\n'),ctx);vm.runInContext(code,ctx);
    const unlocked=JSON.parse(vm.runInContext('JSON.stringify([...P,...KP].filter(t=>!t.locked).map(t=>t.id))',ctx));
    assert.deepEqual(unlocked.filter(t=>!['k-gen','k-aff'].includes(t)),['k-gen','k-aff'].includes(id)?[]:[id]);
    assert.ok(vm.runInContext('Object.keys(DRUGS).length<273',ctx));
   }
   if(atlas==='micro') {
    const ctx=vm.createContext({window:{},localStorage:{getItem:()=>null}});
    vm.runInContext(fs.readFileSync(path.join(root,'micro-atlas/src/core.js'),'utf8')+'\n'+code,ctx);
    assert.ok(vm.runInContext('PG.length<103 && QS.length<205',ctx));
   }
  }
 }
});

test('удаление аккаунта удаляет журнал меток, лимиты и права',async t=>{
 const {call,store,apps,cfg}=await setup(t);await call();
 const token=jwtSign({sub:'one',tv:0,typ:'a',exp:now()+600},keys(cfg.secret).jwt);
 const r=await apps[0].handle({method:'DELETE',path:'/me',headers:{authorization:'Bearer '+token},query:{},ip:'local'});
 assert.equal(r.status,200);assert.equal(await store.getDoc('access:one'),null);
 assert.ok(!Object.values(store._dump().docs).some(r=>r.d.userId==='one'));
});
