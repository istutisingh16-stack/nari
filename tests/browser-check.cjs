// Optional integration check: requires Playwright and a local Chrome installation.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {createServer}=require(process.cwd()+'/scripts/serve.cjs');
const assert=require('node:assert/strict');
(async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || '/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 try{
 const context=await browser.newContext(); await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const pages=['','physiotherapy-bulandshahr','physiotherapy-noida','physiotherapy-delhi-ncr','female-physiotherapist-near-me','womens-health-near-me'];
 for(const width of [320,390,1440])for(const route of pages){
  await page.setViewportSize({width,height:900});await page.goto(base+'/'+route);await page.waitForTimeout(150);
  assert.equal(await page.locator('h1').count(),1);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route+' overflow at '+width);
  assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),'https://narihealth.in/'+route);
  const faq=page.locator('details.faq-item').last();await faq.locator('summary').click();assert(await faq.getAttribute('open')!==null);
  assert(await page.locator('a[href*="member-login"]').count()>0);
 }
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/physiotherapy-noida');await page.screenshot({path:'/tmp/nari-noida-mobile.png',fullPage:true});
 assert.equal(await page.locator('script[src*="googletagmanager"]').count(),0);
 await page.goto(base+'/privacy');await page.check('#analyticsConsent');assert.equal(await page.locator('script[src*="googletagmanager"]').count(),1);
 await page.goto(base+'/physiotherapy-noida');
 await page.evaluate(()=>{window.saveCount=0;window.firebase={apps:[{}],firestore:()=>({collection:()=>({doc:()=>({set:()=>{window.saveCount++;return new Promise(resolve=>window.finishSave=resolve);}})})})};});
 const form=page.locator('.lead-form');await form.locator('button[type=submit]').click();assert(await page.locator('.lead-error').innerText());
 await form.locator('[name=name]').fill('Test Patient');await form.locator('[name=phone]').fill('9876543210');await form.locator('[name=concern]').selectOption({index:1});
 await form.locator('button[type=submit]').click();await page.waitForFunction(()=>window.saveCount===1);
 await page.evaluate(()=>document.querySelector('.lead-form').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true})));
 assert.equal(await page.evaluate(()=>window.saveCount),1);
 assert.equal(await page.evaluate(()=>dataLayer.filter(x=>x[0]==='event'&&x[1]==='lead_submitted').length),0);
 await page.evaluate(()=>window.finishSave());await page.locator('.lead-done').waitFor();
 assert.equal(await page.evaluate(()=>dataLayer.filter(x=>x[0]==='event'&&x[1]==='lead_submitted').length),1);
 assert(!(await page.evaluate(()=>JSON.stringify(dataLayer))).includes('Test Patient'));
 await page.goto(base+'/privacy');await page.uncheck('#analyticsConsent');assert.equal(await page.evaluate(()=>NariAnalytics.allowed()),false);
 assert.deepEqual(errors,[]);
 const nojs=await browser.newContext({javaScriptEnabled:false});await nojs.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());const plain=await nojs.newPage();
 for(const route of pages){await plain.goto(base+'/'+route);const faq=plain.locator('details.faq-item').last();await faq.locator('summary').click();assert(await faq.getAttribute('open')!==null);}
 console.log('PASS: six pages at 320/390/1440px; metadata, overflow, CTAs, FAQs with/without JS, consent, form validation, pending-submit deduplication, success-only conversion, no personal data in event queue. No runtime errors. External requests blocked.');
 } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
