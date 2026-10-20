'use strict';
// Real browser acceptance with disposable local users, never production accounts.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('../../pathophys-atlas/node_modules/playwright');
const {config}=require('../src/config'),{createApp}=require('../src/app'),{memoryStore}=require('../src/store/memory'),{provisionAdmin}=require('../src/admin'),{hashPassword}=require('../src/passwords');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const cfg=config({SITE_URL:'http://127.0.0.1',API_URL:'https://local-api.invalid',SECRET:'local-admin-browser-test-secret-not-production',STORE:'memory',MAIL_TRANSPORT:'log',CONTENT_DIR:path.join(root,'server/content')});
 cfg.contentLimits={minute:10000,hour:10000,day:10000,bytesDay:1024*1024*1024};
 const store=memoryStore();await provisionAdmin(store,{id:'browser-admin',email:'admin@example.test',passwordHash:await hashPassword('test-admin-password-123')});
 const app=createApp({cfg,store,mail:{},log:{error:console.error}});
 const server=http.createServer((req,res)=>{
  let rel=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).slice(1);if(!rel||rel.endsWith('/'))rel+='index.html';
  const file=path.resolve(root,rel);if(!file.startsWith(root+path.sep)||rel.split('/').some(s=>s.startsWith('.'))){res.writeHead(404);return res.end();}
  try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':'text/html; charset=utf-8');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;cfg.origins.push(origin);
 const browser=await chromium.launch({headless:true,executablePath:process.env.ATLAS_BROWSER||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
  const context=await browser.newContext({viewport:{width:1365,height:900}}),contentRequests=[];
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.pathname==='/auth/config.js')return route.fulfill({contentType:'application/javascript',body:'window.MA_CONFIG={api:"https://local-api.invalid"};'});
   if(url.hostname==='local-api.invalid'){
    if(url.pathname.startsWith('/content-'))contentRequests.push(url.pathname);
    const result=await app.handle({method:request.method(),path:url.pathname,query:Object.fromEntries(url.searchParams),headers:request.headers(),body:request.postData()||'',ip:'local'});
    return route.fulfill({status:result.status,headers:result.headers,body:result.base64?Buffer.from(result.body,'base64'):result.body});
   }
   if(url.origin===origin)return route.continue();return route.abort();
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/farma-atlas/#body');await page.locator('#bdstage svg').waitFor();
  const names=await page.evaluate(()=>Object.keys(VIT));assert.equal(names.length,176);
  for(const name of process.env.ATLAS_UI_ONLY ? names.slice(0,1) : names){
   await page.evaluate(n=>{location.hash='body/'+encodeURIComponent(n);},name);
   await page.waitForFunction(n=>document.querySelector('#bdpanel h2')?.textContent===n,name);
  }
  assert.deepEqual(contentRequests,[]);console.log(process.env.ATLAS_UI_ONLY?'Free animation route passed':'176 animations are available to guests without paid requests');
  await page.goto(origin+'/farma-atlas/#body/'+encodeURIComponent('Морфин'));await page.locator('#bdpanel h2').waitFor();
  await page.locator('#bdpanel [data-dr]').click();await page.locator('#dz-title').waitFor();
  assert.ok((await page.locator('#dz').textContent()).includes('Анимация доступна бесплатно'));
  await page.goto(origin+'/farma-atlas/#k-adr');await page.locator('.locked-hero').waitFor();assert.equal(await page.locator('.lockcard').count(),1);
  await page.goto(origin+'/auth/#login');await page.locator('#email').fill('admin@example.test');await page.locator('#pw').fill('test-admin-password-123');
  await page.locator('#f button[type=submit]').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('ma-session')||'{}').user?.isAdmin===true);
  for(const [atlas,topic] of [['farma','k-adr'],['biochem','sec-aa'],['micro','g3'],['pathophys','inflammation']]){
   await page.goto(origin+'/'+atlas+'-atlas/#'+(atlas==='biochem'?'topic/':'')+topic);await page.locator('#ma-copy-label').waitFor();
   assert.equal(await page.evaluate(()=>window.MA_COPY.atlas),atlas);
  }
  await page.goto(origin+'/auth/#account');await page.locator('#credentials').waitFor();
  await page.locator('#adminLogin').fill('renamed-admin@example.test');await page.locator('#currentPw').fill('test-admin-password-123');await page.locator('#newPw').fill('changed-test-password-123');
  await page.locator('#credentials button[type=submit]').click();await page.getByText(/Данные обновлены/).waitFor();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ma-session')).user.email),'renamed-admin@example.test');
  assert.deepEqual(errors,[]);console.log('Admin access to all four subjects and credential settings passed');
  await page.setViewportSize({width:390,height:844});await page.goto(origin+'/farma-atlas/#body/'+encodeURIComponent('Адреналин'));await page.locator('#bdpanel h2').waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:path.join(root,'outputs/farma-free-mobile.png')});
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
