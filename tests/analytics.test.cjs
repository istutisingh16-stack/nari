const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function browser(consent, privacy = {}) {
  const listeners = {}, scripts = [], storage = new Map();
  if (consent) storage.set('nari_analytics_consent', consent);
  const c = {URL, Date, navigator: privacy, location: new URL('https://narihealth.in/physiotherapy-noida?phone=secret#private'),
    localStorage: {getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v)},
    document: {querySelector: () => ({href:'https://narihealth.in/physiotherapy-noida'}), createElement: () => ({}), head: {appendChild: s => scripts.push(s)}, getElementById: () => null, addEventListener: (k,v) => listeners[k] = v},
    addEventListener() {}};
  c.window = c; vm.createContext(c);
  const source = fs.readFileSync('analytics.js','utf8'); vm.runInContext(source,c);
  return {c,scripts,runAgain:()=>vm.runInContext(source,c),click(href) {listeners.click({target:{closest:()=>({href})}});}, events:()=> (c.dataLayer || []).filter(x=>x[0]==='event')};
}
test('no analytics network or events before opt-in, or under privacy signals', () => {
  for (const [consent,privacy] of [[null,{}],['denied',{}],['granted',{doNotTrack:'1'}],['granted',{globalPrivacyControl:true}]]) {
    const b=browser(consent,privacy); b.click('tel:+916399507521');
    assert.equal(b.scripts.length,0);assert.equal(b.events().length,0);
  }
});
test('opt-in loads the existing property once and strips URL parameters', () => {
  const b=browser(); b.c.NariAnalytics.setConsent(true); b.runAgain(); b.c.NariAnalytics.setConsent(true);
  assert.equal(b.scripts.length,1);assert.match(b.scripts[0].src,/G-9V6RCQWJEM/);
  const config=b.c.dataLayer.find(x=>x[0]==='config')[2];
  assert.equal(config.page_location,'https://narihealth.in/physiotherapy-noida'); assert.equal(config.page_referrer,'');
  assert.equal(b.events().length,0);
});
test('each contact action produces one event without destinations or health data', () => {
  const b=browser('granted');
  for(const href of ['tel:+916399507521','https://wa.me/916399507521?text=private-health-answer','/member-login.html?ref=private']) b.click(href);
  b.click('https://example.org/member-login'); b.click('/nutritionist-online');
  b.c.NariAnalytics.track('lead_submitted',{concern:'private',phone:'secret'});
  b.c.NariAnalytics.track('unknown_event');
  assert.deepEqual(Array.from(b.events(),x=>x[1]),['phone_click','whatsapp_click','booking_start','lead_submitted']);
  for(const e of b.events()) assert.deepEqual(Object.keys(e[2]),['transport_type']);
  assert(!JSON.stringify(b.c.dataLayer).includes('private'));
});
test('withdrawal blocks further events and disables GA', () => {
  const b=browser('granted'); b.c.NariAnalytics.setConsent(false); b.click('tel:+916399507521');
  assert.equal(b.events().length,0); assert.equal(b.c['ga-disable-G-9V6RCQWJEM'],true);
});
