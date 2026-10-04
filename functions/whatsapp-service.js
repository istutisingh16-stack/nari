'use strict';
const core = require('./whatsapp-core');

function createService({ db, config, send, lookup, now = () => Date.now() }) {
  const iso = () => new Date(now()).toISOString();
  const orders = db.collection('whatsappOrders');
  const customers = db.collection('whatsappCustomers');

  async function reconcile(id) {
    const ref = orders.doc(id), snap = await ref.get();
    if (!snap.exists) return;
    const order = snap.data();
    let verified, lookupResult;
    try { lookupResult = await lookup(order); verified = core.verifiedPayment(order, lookupResult, now()); }
    catch (error) {
      await ref.update({ checkError: 'Payment could not be verified. Check the gateway and retry.', lastCheckedAt: iso() });
      throw error;
    }
    await db.runTransaction(async t => {
      const current = (await t.get(ref)).data();
      const patch = { lastCheckedAt: iso(), checkError: '' };
      const payment = lookupResult.payments.find(p => p.reference_id === id);
      if (!verified && current.status === 'pending' && now() > Date.parse(current.checkoutExpiresAt) + 300000 &&
          payment.status === 'pending' && !(payment.transactions || []).some(tx => tx.status === 'pending')) patch.status = 'expired';
      // Concurrent or delayed lookups must not revoke a confirmed payment/refund.
      if (verified && (verified.refundedAmount || 0) >= (current.refundedAmount || 0)) {
        Object.assign(patch, verified, { paidAt: current.paidAt || verified.paidAt });
        if (current.paidAt && current.days) patch.validUntil = new Date(Date.parse(current.paidAt) + current.days * 86400000).toISOString();
      }
      t.update(ref, patch);
    });
    const latest = (await ref.get()).data();
    if (latest.status !== 'paid' || latest.confirmationStatus === 'sent') return;
    const customer = (await customers.doc(latest.phone).get()).data();
    if (customer?.paused || !core.withinWindow(customer?.lastMessageAt, now())) {
      await ref.update({ confirmationStatus: 'team_follow_up' });
      return;
    }
    await send(core.confirmationMessage(latest));
    await ref.update({ confirmationStatus: 'sent', confirmationSentAt: iso() });
  }

  async function handleMessage(event) {
    const canReply = core.withinWindow(event.receivedAt, now());
    if (!Number.isFinite(Date.parse(event.receivedAt)) || Date.parse(event.receivedAt) > now() + 300000) return;
    const customerRef = customers.doc(event.phone);
    const customer = await db.runTransaction(async t => {
      const snap = await t.get(customerRef), current = snap.data() || {};
      // A queued selection preceding STOP must not restart payment automation.
      if (current.lastMessageAt && current.lastMessageAt > event.receivedAt) return { ...current, stale: true };
      const data = { id: event.phone, phone: event.phone, name: event.name || current.name || '',
        source: 'whatsapp', createdAt: current.createdAt || event.receivedAt, lastMessageAt: event.receivedAt,
        followUp: current.followUp || 'new', paused: current.paused || false };
      if (event.kind === 'stop' || event.kind === 'help') {
        data.paused = true; data.followUp = event.kind === 'help' ? 'new' : data.followUp;
        data.needsHelp = event.kind === 'help';
      } else if (event.resume) { data.paused = false; data.needsHelp = false; }
      if (!canReply && event.kind !== 'stop') { data.needsHelp = true; data.followUp = 'new'; }
      t.set(customerRef, data, { merge: true });
      return { ...current, ...data };
    });
    if (customer.stale) return;
    // Keep delayed enquiries visible to the team even when an automatic reply is no longer allowed.
    if (!canReply) return;
    if (event.kind === 'stop') {
      await send(core.textMessage(event.phone, 'Automated replies paused. Reply START when you want to see plans again.')); return;
    }
    if (event.kind === 'help') {
      await send(core.textMessage(event.phone, 'Our team has your request and will reply here. Automated plan messages are paused; reply MENU to see plans again.')); return;
    }
    if (customer.paused) return;
    if (event.kind !== 'plan') { await send(core.menuMessage(event.phone)); return; }

    const plan = core.PLANS[event.planId];
    if (!plan) return;
    if (customer.activeOrderId) {
      const prior = await orders.doc(customer.activeOrderId).get();
      // Reconcile before opening another bill, including when a success webhook was missed.
      if (prior.exists && prior.data().status === 'pending') await reconcile(customer.activeOrderId);
    }
    const id = core.orderId(event.messageId), ref = orders.doc(id);
    const result = await db.runTransaction(async t => {
      const existing = await t.get(ref), customerSnap = await t.get(customerRef);
      const c = customerSnap.data();
      if (c.paused) return { paused: true };
      if (existing.exists) return { order: existing.data() };
      const active = c.activeOrderId ? await t.get(orders.doc(c.activeOrderId)) : null;
      if (active?.exists) {
        const previous = active.data();
        if (previous.status === 'pending') return { active: previous };
        if (previous.status === 'paid' && (previous.days ? Date.parse(previous.validUntil) > now() : previous.followUp !== 'closed')) return { paid: previous };
      }
      const order = { id, phone: event.phone, name: customer.name, source: 'whatsapp', planId: plan.id,
        planLabel: plan.label, amount: plan.amount, days: plan.days, currency: 'INR', status: 'pending',
        gateway: config.gateway, paymentConfiguration: config.paymentConfiguration,
        createdAt: iso(), checkoutExpiresAt: new Date(now() + 3600000).toISOString(),
        invoiceStatus: 'ready', confirmationStatus: 'pending', followUp: 'new' };
      t.set(ref, order);
      t.update(customerRef, { activeOrderId: id, selectedPlan: plan.id });
      return { order };
    });
    if (result.paused) return;
    if (result.active) {
      await send(core.textMessage(event.phone, `You already have a payment request for ${result.active.planLabel} above (reference ${result.active.id}). Please use that request. Reply HELP to change your plan or if payment is stuck.`)); return;
    }
    if (result.paid) {
      await send(core.textMessage(event.phone, `Your ${result.paid.planLabel} is already paid. Reply HELP to arrange your consultation with our team.`)); return;
    }
    // Order messages cannot safely be resent after an ambiguous timeout: Meta requires unique references.
    // Save the claim before calling Meta, and surface ambiguity for reconciliation instead of charging twice.
    const claimed = await db.runTransaction(async t => {
      const current = (await t.get(ref)).data();
      if (current.invoiceStatus !== 'ready') return false;
      t.update(ref, { invoiceStatus: 'sending', invoiceAttemptAt: iso() }); return true;
    });
    if (!claimed) return;
    try {
      const response = await send(core.orderMessage(result.order));
      if (!response?.messages?.[0]?.id) throw new Error('No message id');
      await ref.update({ invoiceStatus: 'sent', invoiceMessageId: response.messages[0].id, invoiceSentAt: iso() });
    } catch (error) {
      await ref.update({ invoiceStatus: 'needs_review', invoiceError: 'Checkout delivery could not be confirmed. Recheck payment before sending another request.' });
      throw error;
    }
  }

  async function processEvent(event) {
    if (event.kind === 'payment') return reconcile(event.orderId);
    if (event.kind === 'delivery') {
      const matches = await orders.where('invoiceMessageId', '==', event.messageId).get();
      await Promise.all(matches.docs.map(d => d.ref.update({ invoiceStatus: 'failed', invoiceError: 'WhatsApp delivery error: ' + event.errorCode })));
      return;
    }
    return handleMessage(event);
  }
  return { processEvent, reconcile };
}
module.exports = { createService };
