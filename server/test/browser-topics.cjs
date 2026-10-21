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
 const browser=await chromium.launch({headless:true,executablePath:process.env.ATLAS_BROWSER});
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
  const failures=[];let count=0;
  const original=await context.newPage();await original.goto(origin+'/biochem-atlas/');
  await original.locator('#grid .card').first().waitFor();assert.equal(await original.locator('#grid .card').count(),131);await original.close();
  for(const atlas of ['farma','micro']){
   const catalog=JSON.parse(fs.readFileSync(path.join(root,atlas+'-atlas/topics.json')));
   const topics=catalog.topics.filter(t=>!(catalog.demo||[]).includes(t.id));
   for(const topic of (process.env.ATLAS_SMOKE ? topics.slice(0,1) : topics)){
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const hash=atlas==='biochem'?'topic/'+topic.id:topic.id.startsWith('pg-')?'pathogens/'+topic.id.slice(3):topic.id;
    await page.goto(origin+'/'+atlas+'-atlas/#'+hash,{waitUntil:'domcontentloaded'});
    try {await page.waitForSelector('#ma-copy-label',{timeout:7000});await page.waitForTimeout(30);}
    catch(e){errors.push('No personal mark: '+(await page.locator('body').innerText()).slice(0,250));}
    if(errors.length)failures.push({atlas,topic:topic.id,errors});
    if(['k-adr','sec-aa','g3'].includes(topic.id)){
      fs.mkdirSync(path.join(root,'outputs'),{recursive:true});await page.screenshot({path:path.join(root,'outputs',atlas+'-topic.png')});
    }
    if(errors.length)console.log(JSON.stringify({atlas,topic:topic.id,errors}));
    count++;await page.close();
   }
   console.log(atlas+': verified '+(process.env.ATLAS_SMOKE?1:topics.length)+' pages');
  }
  // Direct navigation must replace the topic and leave no prior topic data behind.
  const page=await context.newPage();await page.goto(origin+'/farma-atlas/#k-adr');await page.waitForSelector('#ma-copy-label');
  await page.locator('#ma-topic-controls summary').click();
  await page.locator('#ma-topic-controls a[href="#k-his"]').click();await page.waitForFunction(()=>window.MA_COPY&&window.MA_COPY.topic==='k-his');
  assert.equal(await page.evaluate(()=>window.MA_TOPIC),'k-his');
  await db.putDoc('access:test',{},1);await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.waitForFunction(()=>window.MA_STATE && window.MA_STATE.auth==='subscription-required');await page.waitForSelector('#ma-topic-controls');assert.equal(await page.locator('#ma-copy-label').count(),0);
  console.log(JSON.stringify({count,failures},null,2));assert.deepEqual(failures,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
