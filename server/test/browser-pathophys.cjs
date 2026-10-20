'use strict';
// Local acceptance: real Chromium, isolated accounts, no production requests.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('../../pathophys-atlas/node_modules/playwright');
const {config}=require('../src/config'),{createApp}=require('../src/app'),{memoryStore}=require('../src/store/memory'),{jwtSign,keys,now}=require('../src/tokens');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const cfg=config({SITE_URL:'http://127.0.0.1',API_URL:'https://local-api.invalid',SECRET:'local-pathophys-test-secret-not-production',STORE:'memory',MAIL_TRANSPORT:'log',CONTENT_DIR:path.join(root,'server/content')});
 cfg.contentLimits={minute:10000,hour:10000,day:10000,bytesDay:1024*1024*1024};
 const db=memoryStore();await db.putUser({id:'test',tv:0,name:'Test'});
 await db.putDoc('access:test',{pathophys:{expiresAt:Date.now()+3600000}},0);
 const app=createApp({cfg,store:db,mail:{},log:{error:console.error}});
 const token=jwtSign({sub:'test',tv:0,typ:'a',exp:now()+3600},keys(cfg.secret).jwt);
 const session={access:token,accessExp:now()+3600,refresh:'local-test',refreshExp:now()+3600,user:{id:'test',name:'Test'}};
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');let rel=decodeURIComponent(url.pathname).slice(1);if(!rel||rel.endsWith('/'))rel+='index.html';
  const file=path.resolve(root,rel);
  if(!file.startsWith(root+path.sep)||rel.split('/').some(s=>s.startsWith('.'))){res.writeHead(404);return res.end();}
  try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html; charset=utf-8');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;cfg.origins.push(origin);
 const browser=await chromium.launch({headless:true,executablePath:process.env.ATLAS_BROWSER||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
  async function context(signedIn){
   const context=await browser.newContext({viewport:{width:1440,height:1000}});
   await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.pathname==='/auth/config.js')return route.fulfill({contentType:'application/javascript',body:'window.MA_CONFIG={api:"https://local-api.invalid"};'});
    if(url.hostname==='local-api.invalid'){
     const result=await app.handle({method:request.method(),path:url.pathname,query:Object.fromEntries(url.searchParams),headers:request.headers(),body:request.postData()||'',ip:'local'});
     return route.fulfill({status:result.status,headers:result.headers,body:result.base64?Buffer.from(result.body,'base64'):result.body});
    }
    if(url.origin===origin)return route.continue();return route.abort();
   });
   if(signedIn)await context.addInitScript(s=>localStorage.setItem('ma-session',JSON.stringify(s)),session);
   return context;
  }
  const paid=await context(true),guest=await context(false),failures=[];
  const catalog=JSON.parse(fs.readFileSync(path.join(root,'pathophys-atlas/topics.json')));
  for(const topic of process.env.ATLAS_UI_ONLY ? [] : catalog.topics){
   const page=await paid.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin+'/pathophys-atlas/#'+topic.id,{waitUntil:'domcontentloaded'});
   await page.getByRole('heading',{name:topic.title,exact:true}).waitFor();
   await page.getByRole('tab',{name:/Визуализация/}).click();
   await page.locator('[role=tabpanel] svg').first().waitFor();
   for(const label of ['Патогенез','Порочные круги','Ловушки','Блиц']){
    const tab=page.getByRole('tab',{name:new RegExp('^'+label)});if(await tab.count())await tab.click();
   }
   if(errors.length)failures.push({topic:topic.id,errors});
   if(topic.id==='inflammation'){
    await page.getByRole('tab',{name:/Визуализация/}).click();
    fs.mkdirSync(path.join(root,'outputs'),{recursive:true});await page.screenshot({path:path.join(root,'outputs/pathophys-desktop.png')});
   }
   await page.close();
  }
  assert.deepEqual(failures,[]);if(!process.env.ATLAS_UI_ONLY)console.log('28 paid topics: data, diagrams and tabs passed');
  const page=await guest.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/pathophys-atlas/#disease');await page.getByRole('heading',{name:'Болезнь и этиология',exact:true}).waitFor();
  await page.getByRole('button',{name:'Отметить изученной',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('ma-progress-v1')).sec.pathophys.list.some(t=>t.id==='disease'&&t.learned===1));
  await page.getByRole('button',{name:'Экзамен',exact:true}).click();
  await page.getByRole('tab',{name:/Блиц/}).click();await page.getByRole('button',{name:'Показать ответ',exact:true}).first().click();
  await page.getByRole('button',{name:'Ответил верно',exact:true}).first().click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('ma-progress-v1')).days[Object.keys(JSON.parse(localStorage.getItem('ma-progress-v1')).days)[0]][0]===1);
  await page.goto(origin+'/pathophys-atlas/#inflammation');await page.getByRole('heading',{name:'Воспаление',exact:true}).waitFor();
  assert.equal(await page.getByRole('tab').count(),0);assert.equal(await page.locator('#ma-copy-label').count(),0);
  assert.equal(await page.evaluate(()=>!!window.MA_PATHO_TOPIC),false);
  await page.setViewportSize({width:390,height:844});await page.goto(origin+'/pathophys-atlas/');
  await page.getByRole('heading',{name:'Атлас патофизиологии',exact:true}).waitFor();
  await page.getByRole('button',{name:'Открыть меню',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.getByLabel('Поиск по атласу').fill('саногенез');
  await Promise.all([page.waitForEvent('load'),dialog.getByRole('button').filter({hasText:'Общий патогенез'}).first().click()]);
  await page.getByRole('heading',{name:'Общий патогенез',exact:true}).waitFor();
  await page.screenshot({path:path.join(root,'outputs/pathophys-mobile.png')});
  const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,elements:[...document.querySelectorAll('main *, .pa-topbar *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,12).map(e=>({tag:e.tagName,class:e.className,text:e.textContent.slice(0,70),right:e.getBoundingClientRect().right}))}));
  assert.ok(overflow.scroll<=overflow.width+1,JSON.stringify(overflow));
  await page.goto(origin+'/cabinet/');await page.locator('[data-atlas="pathophys"]').click();
  await page.getByText('Закреплено: тема отмечена вами как изученная',{exact:true}).waitFor();
  assert.ok((await page.locator('#masBody').textContent()).includes('Болезнь'));
  assert.deepEqual(errors,[]);console.log('Guest lessons, locks, mobile search and cabinet progress passed');
  const check=await paid.newPage();await check.goto(origin+'/pathophys-atlas/#inflammation');await check.getByRole('heading',{name:'Воспаление',exact:true}).waitFor();
  await check.locator('aside[aria-label="Навигация"]').getByRole('button',{name:'Экзаменационный прогон',exact:true}).click();
  await check.getByRole('heading',{name:'Экзаменационный прогон',exact:true}).waitFor();
  assert.equal(await check.evaluate(()=>window.MA_PATHO_TOPIC.topic.id),'inflammation');
  assert.equal(await check.getByRole('main').getByRole('button',{name:'Воспаление',exact:true}).isEnabled(),true);
  await check.locator('aside[aria-label="Навигация"]').getByRole('button').filter({hasText:'Лихорадка'}).click();
  await check.waitForFunction(()=>window.MA_COPY?.topic==='fever');assert.equal(await check.evaluate(()=>window.MA_PATHO_TOPIC.topic.id),'fever');
  await db.putDoc('access:test',{},1);await check.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  await check.waitForFunction(()=>window.MA_STATE?.auth==='subscription-required');await check.getByRole('heading',{name:catalog.topics.find(t=>t.id==='fever').title,exact:true}).waitFor();
  assert.equal(await check.getByRole('tab').count(),0);console.log('Topic switching and revoked access passed');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
