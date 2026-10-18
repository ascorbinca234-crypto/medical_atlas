'use strict';
const {topicFixture}=require('./topic-fixture');
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto'), net = require('net');
const { memoryStore } = require('../src/store/memory');
const { ydbStore } = require('../src/store/ydb');
const { config } = require('../src/config');
const { createApp } = require('../src/app');
const { keys, jwtSign, seal, now } = require('../src/tokens');
const { smtpSend } = require('../src/mail');
const { providers } = require('../src/oauth');
const { createServer } = require('../dev-server');

async function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-stability-'));
  t.after(() => fs.rmSync(dir, {recursive:true,force:true}));
  const cfg = config({ SITE_URL:'https://site.invalid', API_URL:'https://api.invalid', SECRET:'s'.repeat(40), STORE:'memory', MAIL_TRANSPORT:'log', CONTENT_DIR:dir });
  for (const id of cfg.requiredContent) topicFixture(dir,id,'window.SUBJECT='+JSON.stringify(id)+';');
  const store = memoryStore();
  await store.putUser({id:'u1',tv:0,pw:'old-hash',name:'Student',email:'s@example.test',emailVerified:true,ids:[]});
  const app = createApp({cfg,store,mail:{async send(){}},log:{error(){}}});
  const token = jwtSign({sub:'u1',tv:0,typ:'a',exp:now()+300}, keys(cfg.secret).jwt);
  const call = (method,p,body) => app.handle({method,path:p,headers:{authorization:'Bearer '+token},query:{},ip:'127.0.0.1',body:body?JSON.stringify(body):''});
  return {cfg,dir,store,app,call};
}
for (const action of ['logout', 'reset', 'delete']) test('запоздавший профиль не отменяет '+action, async t => {
  const {call,store,cfg} = await fixture(t);
  let release, reached, block = true;
  const entered = new Promise(r=>reached=r), gate = new Promise(r=>release=r);
  const update = store.updateUser;
  store.updateUser = async (id,fn) => { if(block){block=false;reached();await gate;} return update(id,fn); };
  const pending = call('PATCH','/me',{name:'Late'});
  await entered;
  let revoked;
  if(action==='logout') revoked = await call('POST','/auth/logout-all',{});
  if(action==='delete') revoked = await call('DELETE','/me');
  if(action==='reset') {
    const f=crypto.createHash('sha256').update('fp:old-hash').digest('hex').slice(0,16);
    const token=seal({t:'reset',u:'u1',f,exp:now()+60},keys(cfg.secret).seal);
    revoked=await call('POST','/auth/reset',{token,password:'new-password-123'});
  }
  assert.equal(revoked.status,200);
  release(); assert.equal((await pending).status,401);
  assert.equal((await call('GET','/me')).status,401);
  const u=await store.getUser('u1');
  if(action==='delete') assert.equal(u,null); else {assert.equal(u.tv,1);assert.notEqual(u.name,'Late');}
});

test('права предметов независимы; выдача темы проверяет срок и отзыв; профиль не выдаёт доступ', async t=>{
  const {store,call}=await fixture(t);
  for(const id of ['farma','biochem','micro','pathophys','biology']) {
    assert.equal((await call('GET','/content-v3/'+id+'/test-topic')).status,403);
  }
  assert.equal((await call('PATCH','/me',{name:'Student',access:{farma:{expiresAt:Date.now()+60000}},tv:10})).status,200);
  assert.equal((await call('GET','/content-v3/farma/test-topic')).status,403);
  let version=0;
  for(const id of ['farma','biochem','micro']) {
    await store.putDoc('access:u1',{[id]:{expiresAt:Date.now()+60000}},version++);
    for(const other of ['farma','biochem','micro']) assert.equal((await call('GET','/content-v3/'+other+'/test-topic')).status,other===id?200:403);
    const r=await call('GET','/content-v3/'+id+'/test-topic');assert.equal(r.status,200);assert.equal(r.headers['X-Access-Policy'],'subject-subscription-v1');
    await store.putDoc('access:u1',{[id]:{expiresAt:Date.now()-1}},version++);
    assert.equal((await call('GET','/content-v3/'+id+'/test-topic')).status,403);
    await store.putDoc('access:u1',{[id]:{expiresAt:Date.now()+60000,revoked:true}},version++);
    assert.equal((await call('GET','/content-v3/'+id+'/test-topic')).status,403);
  }
  await store.putDoc('access:someone-else',{farma:{expiresAt:Date.now()+60000}},0);
  assert.equal((await call('GET','/content-v3/farma/test-topic')).status,403);
  const status=JSON.parse((await call('GET','/access')).body);
  assert.equal(status.subjects.length,5);assert.deepEqual(status.grants,{});
  assert.equal((await call('GET','/content-v3/unknown/test-topic')).status,404);
});

test('readiness проверяет БД каждый раз; liveness независим; отсутствующий контент даёт 503', async t=>{
  const {call,store,cfg,dir}=await fixture(t);
  assert.equal((await call('GET','/health')).status,200);
  store.ready=async()=>{throw new Error('database unavailable');};
  assert.equal((await call('GET','/health')).status,503);
  assert.equal((await call('GET','/live')).status,200);
  store.ready=async()=>{};
  fs.unlinkSync(path.join(dir,'topics/micro/test-topic.js'));
  const app=createApp({cfg,store,mail:{},log:{error(){}}});
  assert.equal((await app.handle({method:'GET',path:'/health',headers:{}})).status,503);
  assert.equal((await call('PATCH','/me',{name:'x'.repeat(270000)})).status,413);
});

test('повреждённая файловая база не очищается; нормальная запись атомарна и переживает перезапуск', async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ma-file-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'db.json');
  for(const bad of ['{bad','null','{}','{"users":[],"kv":{},"identities":{}}']) {
    fs.writeFileSync(file,bad);assert.throws(()=>memoryStore(file),/original file preserved/);assert.equal(fs.readFileSync(file,'utf8'),bad);
  }
  fs.unlinkSync(file);const store=memoryStore(file);await store.putUser({id:'u',tv:0});
  await store.updateUser('u',u=>{u.tv++;});assert.equal((await memoryStore(file).getUser('u')).tv,1);
  assert.deepEqual(fs.readdirSync(dir),['db.json']);
});

test('YDB CAS сохраняет отзыв сессий при конфликте и не воссоздаёт удалённого пользователя',async()=>{
  let item={id:{S:'u'},d:{S:JSON.stringify({id:'u',tv:0,name:'old'})}}, puts=0, reads=0;
  const res=(status,obj)=>({ok:status===200,status,text:async()=>JSON.stringify(obj)});
  const store=ydbStore({endpoint:'https://db.invalid',prefix:'ma_',accessKeyId:'a',secretAccessKey:'b'},async(_,o)=>{
    const op=o.headers['X-Amz-Target'].split('.')[1],b=JSON.parse(o.body);
    if(op==='GetItem'){reads++;return res(200,item?{Item:item}:{});}
    assert.equal(op,'PutItem');assert.equal(b.ConditionExpression,'#d = :previous');puts++;
    if(puts===1) item={id:{S:'u'},d:{S:JSON.stringify({id:'u',tv:1,name:'old'})}};
    if(!item||item.d.S!==b.ExpressionAttributeValues[':previous'].S)return res(400,{__type:'ConditionalCheckFailedException'});
    item=b.Item;return res(200,{});
  });
  const u=await store.updateUser('u',u=>{u.name='new';});assert.equal(u.tv,1);assert.equal(u.name,'new');assert.equal(reads,2);
  item=null;assert.equal(await store.updateUser('u',u=>{u.tv=0;}),null);
});

test('OAuth и YDB ограничивают ожидание заголовков и тела ответа, отменяют запрос',async()=>{
  for(const bodyHangs of [false,true]) {
    let signal;
    const never=()=>new Promise(()=>{});
    const fake=async(_,o)=>{signal=o.signal;return bodyHangs?{ok:true,status:200,text:never}:never();};
    const db=ydbStore({endpoint:'https://db.invalid',prefix:'ma_',accessKeyId:'a',secretAccessKey:'b',timeoutMs:25},fake);
    await assert.rejects(db.getUser('u'),/timed out/);assert.equal(signal.aborted,true);
    const cfg=config({});cfg.requestTimeoutMs=25;
    await assert.rejects(providers(cfg,fake).yandex.profile({code:'test'},{v:'test'}),/timed out/);assert.equal(signal.aborted,true);
  }
});

async function listen(t,server){
  const sockets=new Set();server.on('connection',s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));});
  await new Promise((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok);});
  t.after(()=>{for(const s of sockets)s.destroy();server.close();});return server.address().port;
}
for(const kind of ['early-close','mid-close','trickle'])test('SMTP: '+kind+' завершается с ошибкой, не зависает',async t=>{
  const srv=net.createServer(sock=>{
    if(kind==='early-close'){sock.end();return;}
    if(kind==='mid-close'){sock.write('220 ready\r\n');sock.once('data',()=>sock.end());return;}
    const timer=setInterval(()=>sock.write('250-partial\r\n'),10);sock.once('close',()=>clearInterval(timer));
  });
  const port=await listen(t,srv);
  await assert.rejects(smtpSend({host:'127.0.0.1',port,secure:false,user:'x',pass:'x',from:'x@test',timeoutMs:80},'y@test','text'),/SMTP/);
});
function raw(port,text){return new Promise((ok,no)=>{let data='';const sock=net.connect(port,'127.0.0.1',()=>sock.write(text));sock.on('data',x=>data+=x);sock.on('end',()=>ok(data));sock.on('error',no);});}
test('HTTP: плохой URL, большой/медленный body и исключение не роняют следующий запрос',async t=>{
  const port=await listen(t,createServer({async handle(req){if(req.path==='/throw')throw new Error('test');return{status:200,body:'ok'};}},{maxBodyBytes:10,bodyTimeoutMs:60}));
  assert.match(await raw(port,'GET //[ HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n'),/^HTTP\/1.1 400/);
  assert.match(await raw(port,'POST / HTTP/1.1\r\nHost: localhost\r\nContent-Length: 11\r\n\r\n'),/^HTTP\/1.1 413/);
  assert.match(await raw(port,'POST / HTTP/1.1\r\nHost: localhost\r\nTransfer-Encoding: chunked\r\n\r\nb\r\n12345678901\r\n0\r\n\r\n'),/^HTTP\/1.1 413/);
  assert.match(await raw(port,'POST / HTTP/1.1\r\nHost: localhost\r\nContent-Length: 5\r\n\r\na'),/^HTTP\/1.1 408/);
  assert.match(await raw(port,'GET /throw HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n'),/^HTTP\/1.1 500/);
  assert.match(await raw(port,'GET / HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n'),/^HTTP\/1.1 200/);
});
test('комплект хранит пять отдельных сроков; истечение одного не отзывает остальные',async t=>{
  const {store,call}=await fixture(t),ids=['farma','biochem','micro','pathophys','biology'];
  const grants=Object.fromEntries(ids.map((id,i)=>[id,{expiresAt:Date.now()+60000+i*1000}]));
  await store.putDoc('access:u1',grants,0);
  assert.deepEqual(Object.keys(JSON.parse((await call('GET','/access')).body).grants),ids);
  grants.farma.expiresAt=Date.now()-1;await store.putDoc('access:u1',grants,1);
  assert.equal((await call('GET','/content-v3/farma/test-topic')).status,403);
  assert.equal((await call('GET','/content-v3/biochem/test-topic')).status,200);
  assert.equal((await call('GET','/content-v3/micro/test-topic')).status,200);
  assert.equal((await call('GET','/content-v3/biology/test-topic')).status,503,'право не создаёт отсутствующие материалы');
});
test('YDB readiness не использует успешный прошлый ensure()',async()=>{
  let online=true;
  const db=ydbStore({endpoint:'https://db.invalid',prefix:'ma_',accessKeyId:'a',secretAccessKey:'b'},async()=>{
    if(!online)throw new Error('offline');return{ok:true,status:200,text:async()=>JSON.stringify({Table:{TableStatus:'ACTIVE'}})};
  });
  await db.ensure();await db.ready();online=false;await db.ensure();await assert.rejects(db.ready(),/offline/);
});
test('SMTP: подтверждённое письмо не становится ошибкой из-за отсутствия ответа на QUIT',async t=>{
  let disconnected;
  const closed=new Promise(r=>disconnected=r);
  const srv=net.createServer(sock=>{
    let step=0,buf='';sock.write('220 ready\r\n');sock.on('close',disconnected);sock.on('error',()=>{});
    sock.on('data',chunk=>{
      buf+=chunk;
      if(step===7){if(buf.includes('\r\n.\r\n')){step++;buf='';sock.write('250 accepted\r\n');}return;}
      if(step>=8)return;
      if(!buf.endsWith('\r\n'))return;
      const codes=[250,334,334,235,250,250,354];sock.write(codes[step++]+' ok\r\n');buf='';
    });
  });
  const port=await listen(t,srv);
  await smtpSend({host:'127.0.0.1',port,secure:false,user:'x',pass:'x',from:'x@test',timeoutMs:500},'y@test','text');
  await closed;
});
