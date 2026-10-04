const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
function portal(configured = true) {
  const storage = new Map();
  const context = {
    console, Date, URL, Promise, setTimeout, clearTimeout,
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) },
    sessionStorage: { getItem: () => null },
    location: { hostname: 'localhost', search: '', pathname: '/member' },
    navigator: { userAgent: 'Test desktop' },
    document: { currentScript: { src: 'http://localhost/portal-data.js' } },
    dispatchEvent() {}
  };
  context.window = context;
  vm.createContext(context);
  if (configured) { vm.runInContext(read('portal-config.js'), context); context.NARI_CONFIG.firebase = null; }
  vm.runInContext(read('portal-data.js'), context);
  return context.NariPortal;
}
for (const configured of [true, false]) {
  test(`current catalogue and UPI amounts (${configured ? 'configured' : 'fallback'})`, async () => {
    const p = portal(configured); await p.readyPublic();
    assert.equal(p.payments.defaultPlan().id, 'weekly');
    for (const [id, price, days] of [['weekly',799,7],['monthly',2499,30],['single',199,0]]) {
      const plan = p.payments.plan(id);
      assert.equal(plan.price, price); assert.equal(plan.days, days); assert.equal(plan.recurring, false);
      const r = await p.payments.start(id, {id:'test_member'});
      assert.equal(r.payment.amount, price);
      if (configured) assert.equal(new URL(r.links.upi).searchParams.get('am'), price.toFixed(2));
    }
    await assert.rejects(p.payments.start('sub', {id:'test_member'}), /Unknown plan/);
    await assert.rejects(p.payments.start('month', {id:'test_member'}), /Unknown plan/);
  });
}
test('weekly/monthly access begins only after approval and expires after the correct duration', async () => {
  const p = portal(); await p.readyPublic();
  for (const [id,days] of [['weekly',7],['monthly',30]]) {
    const mid = 'test_'+id;
    const r = await p.payments.start(id,{id:mid});
    assert.equal(p.payments.entitlement(mid),null);
    await p.payments.claim(r.payment.id,'123456789012');
    assert.equal(p.payments.entitlement(mid),null);
    await p.payments.setStatus(r.payment.id,'paid');
    let entitlement = p.payments.entitlement(mid);
    assert.equal(entitlement.until.getTime()-new Date(r.payment.paidAt).getTime(),days*86400000);
    r.payment.paidAt = new Date(Date.now()-(days*86400000)-1000).toISOString();
    assert.equal(p.payments.entitlement(mid),null);
    r.payment.paidAt = new Date().toISOString();
    await p.payments.setStatus(r.payment.id,'refunded');
    assert.equal(p.payments.entitlement(mid),null);
  }
});
test('old memberships retain 30 days and checkout resumes at the recorded amount', async () => {
  const p = portal(); await p.readyPublic();
  for (const [id,amount] of [['sub',799],['month',999]]) {
    const paidAt = new Date(Date.now()-10*86400000).toISOString();
    const payment = {id:'legacy_'+id,memberId:'legacy_'+id,planId:id,planLabel:'Original label',amount,status:'paid',paidAt,createdAt:paidAt};
    p._db().payments.push(payment);
    const entitlement = p.payments.entitlement(payment.memberId);
    assert.equal(entitlement.until.getTime()-new Date(paidAt).getTime(),30*86400000);
    const plan = p.payments.forPayment(payment);
    assert.equal(plan.price,amount);
    assert.equal(new URL(p.payments.links(plan,payment).upi).searchParams.get('am'),amount.toFixed(2));
  }
  const resumed = p.payments.forPayment({planId:'monthly',amount:2300,planLabel:'Original price'});
  assert.equal(resumed.price,2300);
  assert.equal(p.payments.plan('monthly').price,2499);
});
const publicPages = ['index','physiotherapy-bulandshahr','physiotherapy-noida','physiotherapy-delhi-ncr','female-physiotherapist-near-me','womens-health-near-me'];
test('public metadata, local resources and structured data are valid', () => {
  const titles = new Set();
  for(const page of publicPages) {
    const html=read(page+'.html');
    const title=html.match(/<title>(.*?)<\/title>/)[1];
    assert(!titles.has(title)); titles.add(title);
    assert.equal((html.match(/<h1\b/g)||[]).length,1);
    assert(html.includes(`rel="canonical" href="https://narihealth.in/${page==='index'?'':page}"`));
    assert(!/horizons-cdn|₹799 a month|₹799\/month|₹999|src="loader.js"/.test(html));
    for(const m of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) JSON.parse(m[1]);
    for(const m of html.matchAll(/(?:src|href)="([^"#?]+)(?:[?#][^"]*)?"/g)) {
      const url=m[1]; if(/^(https?:|mailto:|tel:|data:)/.test(url)) continue;
      const file=path.join(root,url);
      assert(fs.existsSync(file)||fs.existsSync(file+'.html'),`${page}: missing ${url}`);
    }
  }
});
test('homepage FAQ is usable without JS and matches its schema', () => {
  const html=read('index.html');
  const schemas=[...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(m=>JSON.parse(m[1]));
  const faq=schemas.find(s=>s['@type']==='FAQPage');
  assert.equal((html.match(/<details class="faq-item">/g)||[]).length,faq.mainEntity.length);
  const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  for(const q of faq.mainEntity) {assert(html.includes(esc(q.name)));assert(html.includes(esc(q.acceptedAnswer.text)));}
  const offers=schemas.find(s=>s['@type']==='MedicalBusiness').hasOfferCatalog.itemListElement;
  assert.equal(offers[1].price,'799');assert.equal(offers[2].price,'2499');
  assert.equal((html.match(/class="expert-name"/g)||[]).length,4);
  assert.equal((html.match(/class="cat-label"/g)||[]).length,11);
});
test('all executable scripts, including inline portal scripts, parse', () => {
  for(const dir of ['','admin','doctor','functions']) {
    for(const file of fs.readdirSync(path.join(root,dir))) {
      const relative=path.join(dir,file);
      if(file.endsWith('.js')) new vm.Script(read(relative),{filename:relative});
      if(file.endsWith('.html')) for(const m of read(relative).matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
        if(/application\/ld\+json/.test(m[1])) JSON.parse(m[2]);
        else new vm.Script(m[2],{filename:relative});
      }
    }
  }
});
