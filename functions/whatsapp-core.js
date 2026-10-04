'use strict';
// Provider-independent, server-owned prices. tests/whatsapp.test.cjs checks browser parity.
const crypto = require('node:crypto');
const PLANS = Object.freeze({
  single: Object.freeze({ id: 'single', label: 'One-time consultation', amount: 199, days: 0 }),
  weekly: Object.freeze({ id: 'weekly', label: '1 week consultation', amount: 799, days: 7 }),
  monthly: Object.freeze({ id: 'monthly', label: '1 month consultation', amount: 2499, days: 30 })
});
const GATEWAYS = ['razorpay', 'payu', 'billdesk', 'zaakpay'];
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const orderId = messageId => 'wa_' + hash(messageId).slice(0, 30);
function validSignature(raw, signature, secret) {
  if (!Buffer.isBuffer(raw) || !secret || !/^sha256=[a-f0-9]{64}$/i.test(signature || '')) return false;
  const actual = Buffer.from(signature.slice(7), 'hex');
  const expected = crypto.createHmac('sha256', secret).update(raw).digest();
  return crypto.timingSafeEqual(actual, expected);
}
function withinWindow(timestamp, now = Date.now()) {
  const time = Date.parse(timestamp);
  return Number.isFinite(time) && time <= now + 300000 && now - time < 23.5 * 3600000;
}
function inboundEvents(body, config) {
  if (body?.object !== 'whatsapp_business_account') return [];
  const events = [];
  for (const entry of body.entry || []) {
    if (entry.id !== config.businessId) continue;
    for (const change of entry.changes || []) {
      const v = change.value;
      if (change.field !== 'messages' || v?.metadata?.phone_number_id !== config.phoneId) continue;
      for (const m of v.messages || []) {
        if (!m.id || !/^91[6-9]\d{9}$/.test(m.from || '') || !/^\d{1,12}$/.test(m.timestamp || '')) continue;
        const text = String(m.text?.body || '').trim().toLowerCase();
        const selection = m.interactive?.button_reply?.id || m.interactive?.list_reply?.id || '';
        const plan = { '1': 'single', '2': 'weekly', '3': 'monthly' }[text] || (/^plan_(single|weekly|monthly)$/.exec(selection)?.[1]);
        const kind = /^(stop|unsubscribe)$/.test(text) ? 'stop' : /^(help|human|agent|team)$/.test(text) ? 'help' : plan ? 'plan' : 'menu';
        const contact = (v.contacts || []).find(c => c.wa_id === m.from);
        events.push({ id: hash('message:' + m.id), kind, messageId: m.id, phone: m.from,
          name: String(contact?.profile?.name || '').slice(0, 80),
          receivedAt: new Date(Number(m.timestamp) * 1000).toISOString(), planId: plan || '',
          resume: /^(menu|start)$/.test(text) });
      }
      for (const s of v.statuses || []) {
        const reference = s.payment?.reference_id;
        if (s.type === 'payment' && /^wa_[a-f0-9]{30}$/.test(reference || '')) {
          events.push({ id: hash(JSON.stringify(['payment', reference, s.id, s.status, s.timestamp, s.payment])),
            kind: 'payment', orderId: reference });
        } else if (s.status === 'failed' && s.id) {
          events.push({ id: hash('delivery:' + s.id), kind: 'delivery', messageId: s.id,
            errorCode: String(s.errors?.[0]?.code || 'delivery_failed').slice(0, 50) });
        }
      }
    }
  }
  return events;
}
function message(to, content) { return { messaging_product: 'whatsapp', recipient_type: 'individual', to, ...content }; }
function textMessage(to, text) { return message(to, { type: 'text', text: { body: text } }); }
function menuMessage(to) {
  return message(to, { type: 'interactive', interactive: { type: 'button',
    body: { text: 'Welcome to NARI Health. Choose your consultation plan:\n1. One-time consultation — ₹199\n2. 1 week — ₹799 (7 days)\n3. 1 month — ₹2,499 (30 days)\n\nOne payment, no auto-debit. Tap a plan to review and pay in WhatsApp. Reply HELP for our team or STOP to pause automated replies. Please keep medical reports for your private consultation.\nTerms: https://narihealth.in/terms\nPrivacy: https://narihealth.in/privacy' },
    action: { buttons: [
      { type: 'reply', reply: { id: 'plan_single', title: 'One-time ₹199' } },
      { type: 'reply', reply: { id: 'plan_weekly', title: '1 week ₹799' } },
      { type: 'reply', reply: { id: 'plan_monthly', title: '1 month ₹2,499' } }
    ] }
  } });
}
function orderMessage(order) {
  const value = { value: order.amount * 100, offset: 100 };
  const parameters = { reference_id: order.id, type: 'digital-goods', currency: 'INR', total_amount: value,
    payment_settings: [{ type: 'payment_gateway', payment_gateway: {
      type: order.gateway, configuration_name: order.paymentConfiguration, enabled_payment_options: ['upi']
    } }],
    order: { status: 'pending', items: [{ name: order.planLabel, amount: value, quantity: 1 }], subtotal: value,
      expiration: { timestamp: String(Math.floor(Date.parse(order.checkoutExpiresAt) / 1000)), description: 'Payment request valid for 1 hour.' } }
  };
  // Meta's current PG reference requires action.parameters to be JSON encoded.
  return message(order.phone, { type: 'interactive', interactive: { type: 'order_details',
    body: { text: `${order.planLabel} — ₹${order.amount.toLocaleString('en-IN')}. ${order.days ? order.days + ' days from successful payment.' : 'One consultation.'} No auto-debit. Review and pay below; choose WhatsApp Pay to stay in WhatsApp. Our team will arrange your consultation after payment.` },
    footer: { text: 'NARI Health • Reply HELP for our team' },
    action: { name: 'review_and_pay', parameters: JSON.stringify(parameters) }
  } });
}
function confirmationMessage(order) {
  return message(order.phone, { type: 'interactive', interactive: { type: 'order_status',
    body: { text: `Payment of ₹${order.amount.toLocaleString('en-IN')} received for ${order.planLabel}. Our team will contact you here to arrange your consultation. Reference: ${order.id}.` },
    action: { name: 'review_order', parameters: JSON.stringify({ reference_id: order.id,
      order: { status: 'processing', description: 'Payment verified. Consultation scheduling is pending.' } }) }
  } });
}
// Never fulfil using webhook assertions, screenshots, a browser redirect or an admin checkbox.
function verifiedPayment(order, result, now = Date.now()) {
  const payment = result?.payments?.find(p => p.reference_id === order.id);
  if (!payment || payment.currency !== 'INR' || payment.amount?.offset !== 100 || payment.amount?.value !== order.amount * 100) {
    throw new Error('Payment reference, currency or amount does not match the order.');
  }
  const successes = (payment.transactions || []).filter(t => t.status === 'success');
  if (payment.status !== 'captured') return null;
  if (successes.length !== 1 || successes[0].type !== order.gateway || !successes[0].id || !successes[0].pg_transaction_id) {
    throw new Error('Captured payment has no unique successful gateway transaction.');
  }
  const tx = successes[0];
  if (tx.currency && tx.currency !== 'INR' || tx.amount && (tx.amount.offset !== 100 || tx.amount.value !== order.amount * 100)) {
    throw new Error('Transaction amount does not match the order.');
  }
  const timestamp = Number(tx.updated_timestamp) * 1000;
  if (!Number.isFinite(timestamp) || timestamp < Date.parse(order.createdAt) - 300000 || timestamp > now + 300000) throw new Error('Invalid payment timestamp.');
  let refunded = 0;
  const seen = new Set();
  for (const r of tx.refunds || []) {
    if (r.status !== 'success' || seen.has(r.id)) continue;
    if (!r.id || r.amount?.offset !== 100 || !Number.isSafeInteger(r.amount.value) || r.amount.value < 0) throw new Error('Invalid refund amount.');
    seen.add(r.id); refunded += r.amount.value;
  }
  if (refunded > order.amount * 100) throw new Error('Refund exceeds order amount.');
  const paidAt = order.paidAt || new Date(timestamp).toISOString();
  return { status: refunded === order.amount * 100 ? 'refunded' : refunded ? 'partially_refunded' : 'paid',
    paidAt, validUntil: order.days ? new Date(Date.parse(paidAt) + order.days * 86400000).toISOString() : '',
    transactionId: tx.pg_transaction_id, gatewayOrderId: tx.id, refundedAmount: refunded / 100,
    verifiedAt: new Date(now).toISOString() };
}
module.exports = { PLANS, GATEWAYS, hash, orderId, validSignature, withinWindow, inboundEvents,
  menuMessage, textMessage, orderMessage, confirmationMessage, verifiedPayment };
