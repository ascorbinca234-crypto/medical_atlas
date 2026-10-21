'use strict';
// Release acceptance against a local server and in-memory accounts; never contacts production.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {config}=require('../src/config'),{createApp}=require('../src/app'),{memoryStore}=require('../src/store/memory'),{jwtSign,keys,now}=require('../src/tokens');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const cfg=config({SITE_URL:'http://127.0.0.1',API_URL:'https://local-api.invalid',SECRET:'local-browser-test-secret-not-production',STORE:'memory',MAIL_TRANSPORT:'log',CONTENT_DIR:path.join(root,'server/content')});
 cfg.contentLimits={minute:10000,hour:10000,day:10000,bytesDay:1024*1024*1024};
 const db=memoryStore();await db.putUser({id:'test',tv:0,name:'Локальная проверка'});
 await db.putDoc('access:test',Object.fromEntries(['farma','biochem','micro'].map(s=>[s,{expiresAt:Date.now()+3600000}])),0);
 const app=createApp({cfg,store:db,mail:{},log:{error:console.error}});
 const token=jwtSign({sub:'test',tv:0,typ:'a',exp:now()+3600},keys(cfg.secret).jwt);
 const session={access:token,accessExp:now()+3600,refresh:'local-test',refreshExp:now()+3600,user:{id:'test'}};
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');let rel=decodeURIComponent(url.pathname).slice(1);if(!rel||rel.endsWith('/'))rel+='index.html';
  const file=path.resolve(root,rel);
  if(!file.startsWith(root+path.sep)||!['auth','progress','farma-atlas','biochem-atlas','micro-atlas'].includes(rel.split('/')[0])){res.writeHead(404);return res.end();}
  try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.json')?'application/json':'text/html; charset=utf-8');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 cfg.origins.push(origin);
 const browser=await chromium.launch({headless:true,executablePath:process.env.ATLAS_BROWSER||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try {
  const context=await browser.newContext({viewport:{width:1365,height:900}});
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.pathname==='/auth/config.js')return route.fulfill({contentType:'application/javascript',body:'window.MA_CONFIG={api:"https://local-api.invalid"};'});
   if(url.hostname==='local-api.invalid'){
    const r=await app.handle({method:request.method(),path:url.pathname,query:Object.fromEntries(url.searchParams),headers:request.headers(),body:request.postData()||'',ip:'local'});
    return route.fulfill({status:r.status,headers:r.headers,body:r.base64?Buffer.from(r.body,'base64'):r.body});
   }
   if(url.origin===origin)return route.continue();return route.abort();
  });
  await context.addInitScript(s=>{if(!localStorage.getItem('ma-browser-initialized')){localStorage.setItem('ma-session',JSON.stringify(s));localStorage.setItem('ma-browser-initialized','1');}},session);
  const failures=[], catalog=JSON.parse(fs.readFileSync(path.join(root,'micro-atlas/topics.json')));
  const topics=process.env.ATLAS_SMOKE ? catalog.topics.filter(t=>['g1','g3','p18','z4','pg-s-aureus','questions','learn-pg','gallery-11','anim-v-hiv','abx'].includes(t.id)) : catalog.topics;
  for(const topic of topics){
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   page.on('console',m=>{if(m.type()==='warning'&&/анимация|превью/.test(m.text()))errors.push(m.text());});
   await page.goto(origin+'/micro-atlas/#'+topic.route,{waitUntil:'domcontentloaded'});
   try{
    await page.locator('#ma-topic-controls').waitFor({timeout:15000});
    if(!catalog.demo.includes(topic.id))await page.locator('#ma-copy-label').waitFor({timeout:15000});
    await page.waitForTimeout(40);
    if(/^g[0-9]|^p[0-9]/.test(topic.id))assert.ok((await page.locator('main h1').textContent()).length>3);
    if(topic.id.startsWith('z'))assert.ok(await page.locator('main .chapter').count());
    if(topic.id==='questions')assert.equal(await page.locator('main .qrow').count(),440);
    if(topic.id.startsWith('gallery-'))assert.ok(await page.locator('main img').count());
    if(topic.id.startsWith('anim-'))await page.locator('#anv .ap-svg').waitFor();
    if(topic.id==='abx')await page.locator('#abxmap svg').first().waitFor();
   }catch(e){errors.push(e.message+' | '+(await page.locator('body').innerText()).slice(-350));}
   if(['abx','g3'].includes(topic.id))await page.screenshot({path:path.join(root,'outputs/micro-v7-'+topic.id+'.png')});
   if(errors.length){failures.push({topic:topic.id,errors});console.log(JSON.stringify(failures.at(-1)));}
   await page.close();
  }
  console.log('Micro v7: '+topics.length+' authorized routes checked');
  const paid=await context.newPage();await paid.goto(origin+'/micro-atlas/#g3');await paid.locator('[data-read=g3]').waitFor();
  await paid.locator('[data-read=g3]').click();assert.match(await paid.locator('[data-read=g3]').textContent(),/Прочитано/);
  await paid.goto(origin+'/micro-atlas/#g4');await paid.locator('[data-read=g4]').waitFor();
  assert.ok(await paid.evaluate(()=>JSON.parse(localStorage.getItem('ma-progress-v1')).sec.micro.list.find(t=>t.id==='g3').learned));
  await paid.goto(origin+'/micro-atlas/#pathogens');await paid.locator('main .pgrow').first().click();
  await paid.locator('#ma-copy-label').waitFor();await paid.locator('#dz .dz').waitFor();
  await paid.goto(origin+'/micro-atlas/#learn/pg');await paid.locator('[data-l=show]').click();await paid.locator('[data-l="2"]').click();
  await paid.goto(origin+'/micro-atlas/#abx/ceftriaxone');await paid.locator('#ma-copy-label').waitFor();
  await paid.goto(origin+'/micro-atlas/#g3');await paid.locator('#ma-copy-label').waitFor();
  await db.putDoc('access:test',{},1);await paid.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  await paid.waitForFunction(()=>window.MA_STATE?.auth==='subscription-required');assert.equal(await paid.locator('[data-read=g3]').count(),0);
  const guest=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await guest.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const page=await guest.newPage(),guestErrors=[];page.on('pageerror',e=>guestErrors.push(e.message));
  await page.goto(origin+'/micro-atlas/#g1');await page.locator('[data-read=g1]').waitFor();await page.locator('[data-read=g1]').click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:path.join(root,'outputs/micro-v7-mobile.png')});
  for(const hash of ['g3','questions','gallery/11','learn/ph/2','anim/v-hiv','abx/ceftriaxone']){
   await page.goto(origin+'/micro-atlas/#'+hash);await page.locator('#ma-topic-controls').waitFor();
   assert.match(await page.locator('main').innerText(),/Этот материал входит в подписку/i);
   assert.equal(await page.locator('#ma-copy-label').count(),0);
  }
  assert.deepEqual(guestErrors,[]);await guest.close();
  console.log(JSON.stringify({routes:topics.length,failures,progress:true,revocation:true,mobile:true,guestLocks:true},null,2));
  assert.deepEqual(failures,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
