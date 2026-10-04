const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../functions/whatsapp-core');
const { createService } = require('../functions/whatsapp-service');

const time = Date.parse('2026-10-04T10:00:00Z');
const config = { businessId: '100', phoneId: '200', gateway: 'razorpay', paymentConfiguration: 'test-config' };
function event(id = 'message-1', planId = 'weekly') {
  return { id: core.hash(id), messageId: id, kind: 'plan', phone: '919876543210', name: 'Test patient', receivedAt: new Date(time).toISOString(), planId };
}
function payment(order, status = 'captured') {
  return { payments: [{ reference_id: order.id, status, currency: 'INR', amount: { value: order.amount * 100, offset: 100 },
    ...(status === 'captured' ? { transactions: [{ id: 'order_test', pg_transaction_id: 'pay_test', type: 'razorpay', status: 'success', updated_timestamp: Math.floor(time / 1000), refunds: [] }] } : {}) }] };
}
// Small transactional store exercises workflow state and enforces Firestore's read-before-write rule.
function fakeDb() {
  const data = new Map(); let tail = Promise.resolve();
  const copy = value => value === undefined ? undefined : structuredClone(value);
  function ref(key) {
    return { id: key.split('/').pop(), path: key,
      async get() { return { exists: data.has(key), data: () => copy(data.get(key)), ref: this }; },
      async set(value, options) { data.set(key, options?.merge ? { ...data.get(key), ...copy(value) } : copy(value)); },
      async create(value) { if (data.has(key)) throw Object.assign(new Error('exists'), { code: 6 }); data.set(key, copy(value)); },
      async update(value) { assert(data.has(key), 'update existing document'); data.set(key, { ...data.get(key), ...copy(value) }); }
    };
  }
  return { data,
    collection(name) {
      return { doc: id => ref(name + '/' + id), where: (field, op, value) => ({
        get: async () => ({ docs: [...data].filter(([k,v]) => k.startsWith(name + '/') && v[field] === value).map(([k]) => ({ ref: ref(k) })) })
      }) };
    },
    runTransaction(fn) {
      const result = tail.then(async () => {
        const writes = []; let writing = false;
        const value = await fn({ get: async r => { assert(!writing, 'all transaction reads must precede writes'); return r.get(); },
          set: (r,v,o) => { writing = true; writes.push(() => r.set(v,o)); }, update: (r,v) => { writing = true; writes.push(() => r.update(v)); } });
        for (const write of writes) await write(); return value;
      });
      tail = result.catch(() => {}); return result;
    }
  };
}
function setup(options = {}) {
  const db = fakeDb(), sent = [], calls = [];
  const service = createService({ db, config, now: options.now || (() => time),
    send: async p => { sent.push(p); if (options.send) return options.send(p); return { messages: [{ id: 'sent-' + sent.length }] }; },
    lookup: async order => { calls.push(order.id); return options.lookup ? options.lookup(order) : payment(order, 'pending'); } });
  return { db, sent, calls, service, orders: () => [...db.data].filter(([k]) => k.startsWith('whatsappOrders/')).map(([,v]) => v) };
}

test('server prices match the website and native invoice carries the exact price, duration and reference', () => {
  const context = { window: {} }; vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../portal-config.js'), 'utf8'), context);
  const menu = core.menuMessage('919876543210');
  assert.equal(menu.interactive.action.buttons.length, 3);
  assert(menu.interactive.action.buttons.every(b => b.reply.title.length <= 20));
  for (const plan of Object.values(core.PLANS)) {
    const website = context.window.NARI_CONFIG.payments.plans.find(p => p.id === plan.id);
    assert.equal(plan.amount, website.price); assert.equal(plan.days, website.days);
    const id = core.orderId(plan.id);
    const body = core.orderMessage({ ...plan, id, planLabel: plan.label, phone: '919876543210', gateway: 'razorpay', paymentConfiguration: 'test', checkoutExpiresAt: new Date(time + 3600000).toISOString() });
    const p = JSON.parse(body.interactive.action.parameters);
    assert.equal(body.interactive.type, 'order_details');
    assert.equal(p.reference_id, id); assert(id.length <= 35);
    assert.equal(p.total_amount.value, website.price * 100); assert.equal(p.total_amount.offset, 100);
    assert.deepEqual(p.payment_settings[0].payment_gateway.enabled_payment_options, ['upi']);
    assert(!JSON.stringify(body).includes('payment_link'));
  }
});
test('webhook HMAC rejects tampering, missing signatures and bad lengths', () => {
  const raw = Buffer.from('{"object":"whatsapp_business_account"}'), secret = 'test-secret';
  const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');
  assert(core.validSignature(raw, signature, secret));
  for (const invalid of ['', 'sha256=1', signature.slice(0, -1) + (signature.endsWith('0') ? '1' : '0')]) assert(!core.validSignature(raw, invalid, secret));
  assert(!core.validSignature(Buffer.from('{}'), signature, secret));
});
test('webhook filters business/number, parses all messages, deduplicates ids, and discards medical text', () => {
  const body = { object: 'whatsapp_business_account', entry: [{ id: '100', changes: [{ field: 'messages', value: {
    metadata: { phone_number_id: '200' }, contacts: [{ wa_id: '919876543210', profile: { name: 'Patient' } }],
    messages: [
      { id: 'a', from: '919876543210', timestamp: String(time/1000), text: { body: 'private medical history' } },
      { id: 'b', from: '919876543210', timestamp: String(time/1000), interactive: { button_reply: { id: 'plan_monthly' } } },
      { id: 'c', from: '919876543210', timestamp: String(time/1000), text: { body: 'STOP' } }
    ]
  } }] }] };
  const events = core.inboundEvents(body, config);
  assert.deepEqual(events.map(e => e.kind), ['menu','plan','stop']); assert.equal(events[1].planId, 'monthly');
  assert(!JSON.stringify(events).includes('medical')); assert.deepEqual(core.inboundEvents(body, config), events);
  assert.deepEqual(core.inboundEvents(body, { ...config, phoneId: 'other' }), []);
  assert.deepEqual(core.inboundEvents(body, { ...config, businessId: 'other' }), []);
  assert(!core.withinWindow(new Date(time - 86400000).toISOString(), time));
  assert(!core.withinWindow(new Date(time + 600000).toISOString(), time));
});
test('only captured exact-price transactions activate a plan; refund validation and repeat checks preserve dates', () => {
  const order = { id: core.orderId('payment'), ...core.PLANS.weekly, gateway: 'razorpay', createdAt: new Date(time).toISOString() };
  order.id = core.orderId('payment');
  const response = payment(order);
  const verified = core.verifiedPayment(order, response, time);
  assert.equal(verified.status, 'paid'); assert.equal(Date.parse(verified.validUntil) - Date.parse(verified.paidAt), 7*86400000);
  assert.equal(core.verifiedPayment(order, payment(order, 'pending'), time), null);
  for (const mutate of [p => p.amount.value = 1, p => p.currency = 'USD', p => p.reference_id = 'wrong', p => p.transactions = [], p => p.transactions[0].type = 'payu']) {
    const bad = structuredClone(response); mutate(bad.payments[0]); assert.throws(() => core.verifiedPayment(order, bad, time));
  }
  const refund = { id: 'refund1', status: 'success', amount: { offset: 100, value: 10000 } };
  response.payments[0].transactions[0].refunds = [refund, refund];
  let result = core.verifiedPayment(order, response, time); assert.equal(result.refundedAmount, 100); assert.equal(result.status, 'partially_refunded');
  response.payments[0].transactions[0].refunds = [{ ...refund, amount: { offset: 100, value: 79900 } }];
  result = core.verifiedPayment({ ...order, paidAt: verified.paidAt }, response, time + 86400000);
  assert.equal(result.status, 'refunded'); assert.equal(result.paidAt, verified.paidAt);
});
test('first message appears as an enquiry, selection creates one order and repeats cannot create another bill', async () => {
  const s = setup();
  await s.service.processEvent({ ...event(), kind: 'menu' });
  assert.equal(s.orders().length, 0); assert(s.db.data.has('whatsappCustomers/919876543210'));
  await s.service.processEvent(event()); await s.service.processEvent(event());
  await s.service.processEvent(event('second-tap', 'monthly'));
  assert.equal(s.orders().length, 1);
  assert.equal(s.sent.filter(m => m.interactive?.type === 'order_details').length, 1);
  assert.equal(s.orders()[0].status, 'pending');
});
test('concurrent selections share one active payment request', async () => {
  const s = setup();
  await Promise.all([s.service.processEvent(event('a')), s.service.processEvent(event('b', 'monthly'))]);
  assert.equal(s.orders().length, 1);
  assert.equal(s.sent.filter(m => m.interactive?.type === 'order_details').length, 1);
});
test('failed delivery is surfaced and uncertain delivery is not silently resent', async () => {
  const s = setup({ send: async m => { if (m.interactive?.type === 'order_details') throw new Error('timeout'); return { messages: [{ id: 'ok' }] }; } });
  await assert.rejects(s.service.processEvent(event()), /timeout/);
  assert.equal(s.orders()[0].invoiceStatus, 'needs_review');
  await s.service.processEvent(event());
  assert.equal(s.sent.filter(m => m.interactive?.type === 'order_details').length, 1);
  const t = setup(); await t.service.processEvent(event());
  await t.service.processEvent({ kind: 'delivery', messageId: t.orders()[0].invoiceMessageId, errorCode: '131000' });
  assert.equal(t.orders()[0].invoiceStatus, 'failed'); assert.equal(t.orders()[0].status, 'pending');
});
test('verified payment, duplicate/out-of-order signals and refunds produce one stable paid record', async () => {
  let status = 'captured', refunded = 0;
  const s = setup({ lookup: order => { const result = payment(order, status); if (refunded) result.payments[0].transactions[0].refunds = [{ id: 'r', status: 'success', amount: { value: refunded, offset: 100 } }]; return result; } });
  await s.service.processEvent(event()); const id = s.orders()[0].id;
  await s.service.processEvent({ kind: 'payment', orderId: id });
  const paidAt = s.orders()[0].paidAt;
  await s.service.processEvent({ kind: 'payment', orderId: id });
  assert.equal(s.sent.filter(m => m.interactive?.type === 'order_status').length, 1);
  status = 'pending'; await s.service.reconcile(id); assert.equal(s.orders()[0].status, 'paid');
  status = 'captured'; refunded = 79900; await s.service.reconcile(id); assert.equal(s.orders()[0].status, 'refunded');
  refunded = 0; await s.service.reconcile(id); assert.equal(s.orders()[0].status, 'refunded');
  assert.equal(s.orders()[0].paidAt, paidAt);
});
test('HELP/STOP pause replies, MENU resumes, old messages and late confirmations do not bypass the session window', async () => {
  let clock = time;
  const s = setup({ now: () => clock, lookup: order => payment(order) });
  await s.service.processEvent({ ...event('stop'), kind: 'stop' });
  await s.service.processEvent(event()); assert.equal(s.orders().length, 0);
  await s.service.processEvent({ ...event('start'), kind: 'menu', resume: true });
  await s.service.processEvent(event()); assert.equal(s.orders().length, 1);
  clock += 86400000;
  const before = s.sent.length;
  await s.service.processEvent({ ...event('old'), kind: 'menu' }); assert.equal(s.sent.length, before);
  await s.service.reconcile(s.orders()[0].id);
  assert.equal(s.orders()[0].status, 'paid'); assert.equal(s.orders()[0].confirmationStatus, 'team_follow_up');
  assert.equal(s.sent.length, before);
});
test('a missed capture webhook is reconciled before permitting another purchase', async () => {
  const s = setup({ lookup: order => payment(order) });
  await s.service.processEvent(event());
  await s.service.processEvent(event('second', 'monthly'));
  assert.equal(s.orders().length, 1); assert.equal(s.orders()[0].status, 'paid');
  assert.equal(s.calls.length, 1);
});
test('expired unpaid requests can be replaced only after lookup, while unresolved transactions remain blocked', async () => {
  let clock = time, pendingTransaction = true;
  const s = setup({ now: () => clock, lookup: order => {
    const p = payment(order, 'pending'); if (pendingTransaction) p.payments[0].transactions = [{status: 'pending'}]; return p;
  } });
  await s.service.processEvent(event()); clock += 7200000;
  const next = { ...event('next'), receivedAt: new Date(clock).toISOString() };
  await s.service.processEvent(next); assert.equal(s.orders().length, 1);
  pendingTransaction = false;
  await s.service.processEvent({ ...next, messageId: 'next-new' });
  assert.equal(s.orders().length, 2); assert.equal(s.orders()[0].status, 'expired');
});

function webhookHarness() {
  const db = fakeDb(), settings = { WA_ENABLED: 'true', WA_GRAPH_VERSION: 'v25.0', WA_PHONE_NUMBER_ID: '200', WA_BUSINESS_ACCOUNT_ID: '100', WA_PAYMENT_GATEWAY: 'razorpay', WA_PAYMENT_CONFIGURATION: 'test', WA_APP_SECRET: 'secret', WA_VERIFY_TOKEN: 'verify' };
  const exports = {};
  const stubs = {
    'firebase-functions/v2/https': { onRequest: (options, handler) => handler },
    'firebase-functions/v2/firestore': { onDocumentCreated: (options, handler) => handler, onDocumentWritten: (options, handler) => handler },
    'firebase-functions/params': { defineString: key => ({ value: () => settings[key] }), defineSecret: key => ({ value: () => settings[key] }) },
    'firebase-admin': { firestore: () => db }, 'firebase-functions/logger': { error() {} },
    './whatsapp-core': core, './whatsapp-service': { createService }
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../functions/whatsapp'), 'utf8'), { require: name => stubs[name], exports, Buffer, Date, JSON });
  async function request(req) {
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, type() { return this; }, set() { return this; }, send(body) { this.body = body; return this; } };
    await exports.whatsappWebhook({ query: {}, get: () => '', ...req }, res); return res;
  }
  return { db, settings, request };
}
test('HTTP webhook validates challenge, method, signature and disabled state before writing anything', async () => {
  const h = webhookHarness();
  let res = await h.request({ method: 'GET', query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'verify', 'hub.challenge': '123' } });
  assert.equal(res.statusCode, 200); assert.equal(res.body, '123');
  assert.equal((await h.request({ method: 'GET' })).statusCode, 403);
  assert.equal((await h.request({ method: 'PUT' })).statusCode, 405);
  assert.equal((await h.request({ method: 'POST', rawBody: Buffer.from('{}') })).statusCode, 401);
  h.settings.WA_ENABLED = 'false'; assert.equal((await h.request({ method: 'POST' })).statusCode, 503);
  assert.equal(h.db.data.size, 0);
});
test('HTTP webhook durably queues a signed message once across retries', async () => {
  const h = webhookHarness();
  const rawBody = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account', entry: [{ id: '100', changes: [{ field: 'messages', value: { metadata: { phone_number_id: '200' }, messages: [{ id: 'message-1', from: '919876543210', timestamp: String(time/1000), text: { body: '1' } }] } }] }] }));
  const signature = 'sha256=' + crypto.createHmac('sha256', 'secret').update(rawBody).digest('hex');
  const req = { method: 'POST', rawBody, get: () => signature };
  assert.equal((await h.request(req)).statusCode, 200);
  assert.equal((await h.request(req)).statusCode, 200);
  assert.equal([...h.db.data.keys()].filter(k => k.startsWith('whatsappEvents/')).length, 1);
  assert.equal(h.db.data.get('integrations/whatsapp').enabled, true);
});
