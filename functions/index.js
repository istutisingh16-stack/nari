/* ===== NARI Health — Cloud Functions =====
   One job: push a notification to every admin device (pushTokens/{token} with role 'admin') when something
   happens that the team should act on. The triggers are Firestore writes, so they fire for enquiries from
   the public pages, member bookings and payments, and doctor changes alike, whichever page made the write.

   Deploy once, from a computer with Node.js 22 (and again only if this file changes):
     cd functions && npm install && cd ..
     npx firebase-tools login
     npx firebase-tools deploy --only functions
   See GO-LIVE.md → "Push notifications for the team". Logs: npx firebase-tools functions:log */
'use strict';

const { setGlobalOptions } = require('firebase-functions/v2');
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { defineString } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

admin.initializeApp();
/* Same region as the Firestore database (Mumbai). Small limits: this only ever sends a handful of messages. */
setGlobalOptions({ region: 'asia-south1', maxInstances: 5, memory: '256MiB', timeoutSeconds: 30 });

/* Where the console lives; tapping a notification opens it on the right tab. Set in functions/.env. */
const SITE_URL = defineString('SITE_URL', { default: 'https://narihealth.in' });

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TIMES = { morning: 'morning', afternoon: 'afternoon', evening: 'evening' };
const MEMBER = 'Member';

function fmtDate(iso) { if (!iso) return ''; const p = String(iso).slice(0, 10).split('-'); return p.length === 3 ? `${parseInt(p[2], 10)} ${MONTHS[parseInt(p[1], 10) - 1]}` : iso; }
function fmtTime(t) { if (!t) return ''; const [hh, mm] = t.split(':'); let h = parseInt(hh, 10); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${mm} ${ap}`; }
function rupees(n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); }
function phone(p) { p = String(p || '').replace(/\D/g, '').slice(-10); return p ? `+91 ${p.slice(0, 5)} ${p.slice(5)}` : ''; }
function first(name) { return String(name || '').trim().split(/\s+/)[0] || ''; }

async function doctorName(id) {
  if (!id) return '';
  const d = await admin.firestore().collection('doctors').doc(id).get();
  return d.exists ? (d.data().name || '') : '';
}

/* Sends one notification to every admin device and forgets tokens that FCM reports as dead. */
async function notifyAdmins({ title, body, tab, tag }) {
  const db = admin.firestore();
  const snap = await db.collection('pushTokens').where('role', '==', 'admin').get();
  const tokens = snap.docs.map((d) => d.id);
  if (!tokens.length) { logger.info(`No admin devices enabled; skipped "${title}"`); return; }
  const site = SITE_URL.value().replace(/\/$/, '');
  const link = `${site}/admin/console#${tab || 'overview'}`;
  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: { tab: tab || 'overview', link },
    webpush: {
      headers: { Urgency: 'high', TTL: '86400' },
      notification: { title, body, icon: `${site}/assets/logo.png`, tag: tag || 'nari', renotify: true },
      fcmOptions: { link }
    }
  });
  const dead = [];
  res.responses.forEach((r, i) => {
    if (r.success) return;
    const code = r.error && r.error.code;
    if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token' || code === 'messaging/invalid-argument') dead.push(tokens[i]);
    else logger.warn(`Could not send to a device: ${code || r.error}`);
  });
  await Promise.all(dead.map((t) => db.collection('pushTokens').doc(t).delete().catch(() => {})));
  logger.info(`"${title}" → ${res.successCount}/${tokens.length} admin devices${dead.length ? `, ${dead.length} stale token(s) removed` : ''}`);
}

/* ---- Website enquiry ("Get a free call back") ---- */
exports.onLead = onDocumentCreated('leads/{id}', (event) => {
  const l = event.data.data();
  return notifyAdmins({
    title: `New enquiry from ${l.name || 'the website'}`,
    body: `${l.concern || 'General'} · call in the ${TIMES[l.time] || l.time || 'day'} · ${phone(l.phone)}${l.ref ? ` · code ${l.ref}` : ''}`,
    tab: 'leads', tag: `lead-${event.params.id}`
  });
});

/* ---- Payments: started, then claimed with a UPI reference ---- */
exports.onPayment = onDocumentCreated('payments/{id}', (event) => {
  const p = event.data.data();
  return notifyAdmins({
    title: `${p.memberName || MEMBER} started a payment of ${rupees(p.amount)}`,
    body: `${p.planLabel || 'Plan'} · Paytm · ${phone(p.memberPhone)}`,
    tab: 'payments', tag: `pay-${event.params.id}`
  });
});
exports.onPaymentClaimed = onDocumentUpdated('payments/{id}', (event) => {
  const before = event.data.before.data(), after = event.data.after.data();
  if (before.status === after.status || after.status !== 'claimed') return null;
  return notifyAdmins({
    title: `${after.memberName || MEMBER} paid ${rupees(after.amount)} — verify it`,
    body: `${after.planLabel || 'Plan'} · UPI ref ${after.txnRef || '—'} · check Paytm and mark Paid`,
    tab: 'payments', tag: `pay-${event.params.id}`
  });
});

/* ---- Consultation requested by a member ---- */
exports.onBooking = onDocumentCreated('appointments/{id}', async (event) => {
  const a = event.data.data();
  const doc = await doctorName(a.doctorId);
  return notifyAdmins({
    title: `${a.memberName || MEMBER} requested a consultation`,
    body: `${a.category || 'Consultation'} · ${fmtDate(a.date)}, ${fmtTime(a.time)}${doc ? ` with ${doc}` : ' · expert to be matched'}`,
    tab: 'appointments', tag: `apt-${event.params.id}`
  });
});

/* ---- New member (signed up herself) or added by a doctor ---- */
exports.onMember = onDocumentCreated('members/{uid}', async (event) => {
  const m = event.data.data();
  const doc = await doctorName(m.referredByDoctorId);
  return notifyAdmins({
    title: `${m.name || 'A new member'} signed up`,
    body: `${phone(m.phone)}${m.city ? ` · ${m.city}` : ''}${doc ? ` · referred by ${doc}` : ''}`,
    tab: 'members', tag: `mem-${event.params.uid}`
  });
});
exports.onInvite = onDocumentCreated('invites/{phone}', async (event) => {
  const i = event.data.data();
  const doc = await doctorName(i.doctorId);
  return notifyAdmins({
    title: `${doc || 'A doctor'} added ${i.name || 'a member'}`,
    body: `${phone(i.phone)}${i.city ? ` · ${i.city}` : ''}${i.note ? ` · “${i.note}”` : ''}`,
    tab: 'members', tag: `inv-${event.params.phone}`
  });
});

/* ---- Doctors: added to the panel, and their first sign-in ---- */
exports.onDoctor = onDocumentCreated('doctors/{id}', (event) => {
  const d = event.data.data();
  return notifyAdmins({
    title: `${d.name || 'A doctor'} added to the panel`,
    body: `${d.role || 'Doctor'} · referral code ${d.refCode || '—'}`,
    tab: 'doctors', tag: `doc-${event.params.id}`
  });
});
exports.onDoctorFirstLogin = onDocumentUpdated('staff/{email}', async (event) => {
  const before = event.data.before.data(), after = event.data.after.data();
  if (after.role !== 'doctor' || before.firstLoginAt || !after.firstLoginAt) return null;
  const doc = await doctorName(after.doctorId);
  return notifyAdmins({
    title: `${doc || after.name || first(event.params.email)} signed in for the first time`,
    body: `Doctor panel · ${event.params.email}`,
    tab: 'doctors', tag: `docin-${after.doctorId || event.params.email}`
  });
});
