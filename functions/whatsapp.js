'use strict';
const { onRequest } = require('firebase-functions/v2/https');
const { onDocumentCreated, onDocumentWritten } = require('firebase-functions/v2/firestore');
const { defineString, defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');
const core = require('./whatsapp-core');
const { createService } = require('./whatsapp-service');

// Opt-in activation: existing push functions can still be deployed without a connected WhatsApp account.
const enabled = defineString('WA_ENABLED', { default: 'false' });
const version = defineString('WA_GRAPH_VERSION', { default: '' });
const phoneId = defineString('WA_PHONE_NUMBER_ID', { default: '' });
const businessId = defineString('WA_BUSINESS_ACCOUNT_ID', { default: '' });
const gateway = defineString('WA_PAYMENT_GATEWAY', { default: '' });
const paymentConfiguration = defineString('WA_PAYMENT_CONFIGURATION', { default: '' });
const accessToken = defineSecret('WA_ACCESS_TOKEN');
const appSecret = defineSecret('WA_APP_SECRET');
const verifyToken = defineSecret('WA_VERIFY_TOKEN');
function configuration() {
  return { version: version.value(), phoneId: phoneId.value(), businessId: businessId.value(),
    gateway: gateway.value(), paymentConfiguration: paymentConfiguration.value() };
}
function validateConfig(c) {
  if (!/^v\d+\.\d+$/.test(c.version) || !/^\d+$/.test(c.phoneId) || !/^\d+$/.test(c.businessId) ||
    !core.GATEWAYS.includes(c.gateway) || !c.paymentConfiguration || c.paymentConfiguration.length > 60) {
    throw new Error('Complete the WA configuration in functions/.env before activation.');
  }
}
function service() {
  const config = configuration(); validateConfig(config);
  async function graph(path, payload) {
    const response = await fetch(`https://graph.facebook.com/${config.version}/${config.phoneId}/${path}`, {
      method: payload ? 'POST' : 'GET', headers: { Authorization: `Bearer ${accessToken.value()}`, 'Content-Type': 'application/json' },
      ...(payload ? { body: JSON.stringify(payload) } : {}), signal: AbortSignal.timeout(15000)
    });
    const body = await response.json();
    // Do not log request bodies, phone numbers, access tokens or health information.
    if (!response.ok || body.error) throw new Error(`Meta request failed (${response.status}, code ${body.error?.code || 'unknown'}).`);
    return body;
  }
  return createService({ db: admin.firestore(), config,
    send: payload => graph('messages', payload),
    lookup: order => graph(`payments/${encodeURIComponent(order.paymentConfiguration)}/${encodeURIComponent(order.id)}`) });
}

exports.whatsappWebhook = onRequest({ invoker: 'public', cors: false, secrets: [appSecret, verifyToken], timeoutSeconds: 30 }, async (req, res) => {
  if (enabled.value() !== 'true') { res.status(503).send('WhatsApp integration is not enabled.'); return; }
  if (req.method === 'GET') {
    const valid = req.query['hub.mode'] === 'subscribe' && verifyToken.value() && req.query['hub.verify_token'] === verifyToken.value();
    res.status(valid ? 200 : 403).type('text/plain').send(valid ? String(req.query['hub.challenge'] || '') : 'Forbidden'); return;
  }
  if (req.method !== 'POST') { res.set('Allow', 'GET, POST').status(405).send('Method not allowed'); return; }
  if (!req.rawBody || req.rawBody.length > 1024 * 1024) { res.status(413).send('Invalid payload size'); return; }
  if (!core.validSignature(req.rawBody, req.get('x-hub-signature-256'), appSecret.value())) { res.status(401).send('Invalid signature'); return; }
  try {
    const config = configuration(); validateConfig(config);
    const events = core.inboundEvents(JSON.parse(req.rawBody.toString('utf8')), config);
    const db = admin.firestore();
    // Acknowledge only after durable storage. Meta retries are safe because each event has a stable id.
    for (const event of events) {
      try { await db.collection('whatsappEvents').doc(event.id).create({ ...event, state: 'queued', queuedAt: new Date().toISOString(), expireAt: new Date(Date.now() + 30 * 86400000) }); }
      catch (error) { if (error.code !== 6 && error.code !== 'already-exists') throw error; }
    }
    if (events.length) await db.collection('integrations').doc('whatsapp').set({ enabled: true, lastWebhookAt: new Date().toISOString() }, { merge: true });
    res.status(200).send('EVENT_RECEIVED');
  } catch (error) {
    logger.error('WhatsApp webhook could not be queued', { code: error.code || 'invalid_or_unavailable' });
    res.status(500).send('Please retry');
  }
});

exports.onWhatsAppEvent = onDocumentCreated({ document: 'whatsappEvents/{id}', secrets: [accessToken], retry: true, timeoutSeconds: 120 }, async event => {
  if (enabled.value() !== 'true') return;
  const db = admin.firestore(), ref = event.data.ref;
  const acquired = await db.runTransaction(async t => {
    const current = (await t.get(ref)).data();
    if (current.state === 'done') return false;
    if (current.leaseUntil > Date.now()) throw new Error('Event is being processed.');
    t.update(ref, { leaseUntil: Date.now() + 120000, state: 'processing' }); return true;
  });
  if (!acquired) return;
  try {
    await service().processEvent(event.data.data());
    await ref.update({ state: 'done', leaseUntil: 0, processedAt: new Date().toISOString() });
  } catch (error) {
    await ref.update({ state: 'retry', leaseUntil: 0 });
    logger.error('WhatsApp processing needs retry', { eventId: event.params.id, code: error.code || 'upstream_or_validation' });
    throw new Error('WhatsApp event processing failed.');
  }
});

// The admin can request an authoritative lookup but cannot set a WhatsApp payment's status.
exports.onWhatsAppRecheck = onDocumentWritten({ document: 'whatsappRechecks/{id}', secrets: [accessToken], retry: true, timeoutSeconds: 60 }, async event => {
  if (!event.data.after.exists || enabled.value() !== 'true') return;
  await service().reconcile(event.params.id);
});
