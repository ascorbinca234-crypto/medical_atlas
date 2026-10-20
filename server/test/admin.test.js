'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {provisionAdmin}=require('../src/admin'),{memoryStore}=require('../src/store/memory'),{hashPassword,verifyPassword}=require('../src/passwords');
const {config}=require('../src/config'),{createApp}=require('../src/app'),{topicFixture}=require('./topic-fixture');
async function fixture(t){
 const store=memoryStore(),seed={id:'test-admin',email:'admin@example.test',passwordHash:await hashPassword('initial-password-123')};
 await provisionAdmin(store,seed);
 const marker=await store.getDoc('setup:content-admin:test-admin'),uid=marker.d.userId;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ma-admin-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const cfg=config({SITE_URL:'https://site.invalid',API_URL:'https://api.invalid',SECRET:'x'.repeat(40),STORE:'memory',MAIL_TRANSPORT:'log',CONTENT_DIR:dir});
 for(const id of cfg.requiredContent)topicFixture(dir,id,'window.TOPIC_OK=true;');
 const app=createApp({cfg,store,mail:{async send(){}},log:{error(){}}});
 const call=(method,url,body,token)=>app.handle({method,path:url,query:{},ip:'local',body:body?JSON.stringify(body):'',headers:token?{authorization:'Bearer '+token}:{}});
 const login=JSON.parse((await call('POST','/auth/login',{email:seed.email,password:'initial-password-123'})).body);
 return{store,seed,uid,call,token:login.accessToken};
}
test('администратор открывает все опубликованные атласы без платных прав; отзыв действует сразу',async t=>{
 const {call,store,uid,token}=await fixture(t);
 const access=JSON.parse((await call('GET','/access',null,token)).body);
 assert.equal(access.admin,true);assert.deepEqual(Object.keys(access.grants),['farma','biochem','micro','pathophys']);
 assert.equal(await store.getDoc('access:'+uid),null);
 for(const id of Object.keys(access.grants))assert.equal((await call('GET','/content-v3/'+id+'/test-topic',null,token)).status,200);
 await store.updateUser(uid,u=>{u.contentAdmin=false;});
 assert.equal((await call('GET','/content-v3/farma/test-topic',null,token)).status,403);
});
test('профиль и пользовательские данные не могут выдать админский доступ',async t=>{
 const {call,store,uid,token}=await fixture(t);await store.updateUser(uid,u=>{u.contentAdmin=false;});
 assert.equal((await call('PATCH','/me',{contentAdmin:true,isAdmin:true,role:'admin'},token)).status,200);
 assert.equal((await store.getUser(uid)).contentAdmin,false);
 assert.equal((await call('PATCH','/me/credentials',{currentPassword:'initial-password-123'},token)).status,403);
 assert.equal((await call('GET','/content-v3/micro/test-topic',null,token)).status,403);
});
test('логин и пароль администратора меняются; прежние сессии отозваны; bootstrap не возвращает старые данные',async t=>{
 const {call,store,uid,seed,token}=await fixture(t);
 assert.equal((await call('PATCH','/me/credentials',{currentPassword:'wrong',newPassword:'new-password-123'},token)).status,400);
 const changed=await call('PATCH','/me/credentials',{email:'new-admin@example.test',currentPassword:'initial-password-123',newPassword:'new-password-123'},token);
 assert.equal(changed.status,200);const session=JSON.parse(changed.body);assert.equal(session.user.isAdmin,true);
 assert.equal((await call('GET','/me',null,token)).status,401);
 assert.equal((await call('POST','/auth/login',{email:seed.email,password:'initial-password-123'})).status,401);
 assert.equal((await call('POST','/auth/login',{email:'new-admin@example.test',password:'new-password-123'})).status,200);
 await provisionAdmin(store,seed);
 const current=await store.getUser(uid);assert.equal(current.email,'new-admin@example.test');assert.ok(await verifyPassword('new-password-123',current.pw));
 assert.equal((await call('GET','/content-v3/pathophys/test-topic',null,session.accessToken)).status,200);
});
test('занятый логин не захватывается при настройке и при переименовании администратора',async t=>{
 const {call,store,seed,token}=await fixture(t);
 await store.putUser({id:'ordinary',email:'busy@example.test',tv:0});await store.createIdentity('email:busy@example.test','ordinary');
 assert.equal((await call('PATCH','/me/credentials',{email:'busy@example.test',currentPassword:'initial-password-123'},token)).status,409);
 await assert.rejects(provisionAdmin(store,{...seed,id:'other-seed',email:'busy@example.test'}),/already occupied/);
 assert.equal((await store.getUser('ordinary')).contentAdmin,undefined);
});
test('одновременный запуск создаёт одного администратора; удалённый аккаунт не восстанавливается',async t=>{
 const {store,seed,uid}=await fixture(t);
 await Promise.all(Array.from({length:8},()=>provisionAdmin(store,{...seed,id:'concurrent',email:'concurrent@example.test'})));
 const marker=await store.getDoc('setup:content-admin:concurrent');
 assert.equal(marker.d.complete,true);assert.equal(await store.getIdentity('email:concurrent@example.test'),marker.d.userId);
 await store.deleteUser(uid);await provisionAdmin(store,seed);assert.equal(await store.getUser(uid),null);
});
