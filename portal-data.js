/* ===== NARI Health — Portal data layer =====
   Every page reads and writes through `NariPortal`. Two backends live here:

   • DEMO  (NARI_CONFIG.firebase is null): localStorage in this browser only,
            one-time codes shown on screen, demo staff passwords. Safe to try.
   • LIVE  (NARI_CONFIG.firebase set):   Firebase Authentication and Cloud
            Firestore. Access is enforced by firestore.rules, not by this file.

   Member sign-in is mobile number + one-time SMS code only (no Google, no
   password). The ID token therefore always carries phone_number, and a doctor's
   invite keyed by that number matches her automatically. Staff (doctors, team)
   sign in with email + password or Google.

   Pages call NariPortal.ready(role) and get a Promise for the signed-in user.
   After that every read is synchronous from an in-memory cache; writes update
   the cache immediately and persist in the background. */
(function (global) {
  'use strict';

  var CFG = global.NARI_CONFIG || {};
  /* Live only when the console-issued keys are actually filled in; empty or placeholder values keep demo mode. */
  var LOCALHOST = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(global.location.hostname);
  var LIVE = !!(CFG.firebase && CFG.firebase.apiKey && CFG.firebase.appId && /^AIza/.test(CFG.firebase.apiKey) && /^1:/.test(CFG.firebase.appId));

  var DB_KEY = 'nari_portal_db_v3';
  var SESSION_KEY = 'nari_portal_session';
  var OTP_KEY = 'nari_portal_otp';
  var PENDING_KEY = 'nari_portal_pending';
  var REF_KEY = 'nari_portal_ref';

  var MEMBER = CFG.memberWord || 'Member';
  /* "View as": an admin opening a member's dashboard or a doctor's panel (member?as=<id>, doctor/panel?as=<id>).
     Set by ready(); null in a normal session. Everything written while it is set is stamped with the admin's name. */
  var viewAs = null;
  var MEMBERS = CFG.memberWordPlural || 'Members';
  var CATEGORIES = CFG.categories || ["Women's Health", 'PCOS', 'Pregnancy', 'Periods', 'Stomach & Digestion', 'Mental Health', 'Nutrition', 'Sleep', 'Menopause', 'General Health', 'Pelvic Health'];
  var MODES = CFG.modes || [
    { id: 'video', label: 'Video consultation', price: '₹199', desc: '25-minute private video call' },
    { id: 'clinic', label: 'Clinic visit', price: 'On request', desc: 'In person at a partner clinic' }
  ];
  var PAY = CFG.payments || {};
  var PLANS = PAY.plans || [
    { id: 'sub', label: 'Monthly membership', price: 799, per: '/month', recurring: true, default: true, desc: 'Unlimited consultations. ₹799 every month.', days: 30 },
    { id: 'month', label: '1-month pass', price: 999, per: 'for 30 days', recurring: false, desc: 'Unlimited consultations for 30 days.', days: 30 },
    { id: 'single', label: 'Single consultation', price: 199, per: 'one time', recurring: false, desc: 'One consultation.', days: 0 }
  ];
  var PAY_STATUSES = ['initiated', 'claimed', 'paid', 'failed', 'refunded'];
  var SOURCES = CFG.sources || ['Friend or family', 'Instagram', 'Google search', 'WhatsApp forward', 'Other'];
  var SLOTS = CFG.slots || ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
  var STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];
  var CC = CFG.phoneCountryCode || '+91';
  var WA_NUMBER = CFG.whatsapp || '916399507521';

  /* Absolute URL of the site root, derived from where this script was loaded from, so pages in
     /doctor/ and /admin/ can redirect correctly whether the site is on a custom domain or a
     GitHub Pages sub-path. */
  var ROOT = (function () {
    var src = (document.currentScript && document.currentScript.src) || '';
    if (!src) { var els = document.getElementsByTagName('script'); for (var i = 0; i < els.length; i++) if (/portal-data\.js/.test(els[i].src)) src = els[i].src; }
    return src.replace(/portal-data\.js.*$/, '');
  })();
  var PAGES = {
    member: { login: 'member-login', home: 'member' },
    doctor: { login: 'doctor/', home: 'doctor/panel' },
    admin: { login: 'admin/', home: 'admin/console' }
  };

  /* ---------- helpers ---------- */
  function uid(prefix) { return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function isoDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function daysFromToday(n) { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return isoDate(d); }
  function todayIso() { return daysFromToday(0); }
  function nowIso() { return new Date().toISOString(); }
  /* Calendar-date arithmetic on 'YYYY-MM-DD' strings (UTC-based so daylight-saving never shifts a day). */
  function addDays(iso, n) { var p = iso.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)).toISOString().slice(0, 10); }
  function diffDays(a, b) { var pa = a.split('-'), pb = b.split('-'); return Math.round((Date.UTC(+pa[0], +pa[1] - 1, +pa[2]) - Date.UTC(+pb[0], +pb[1] - 1, +pb[2])) / 86400e3); }
  /* Milliseconds for a stored timestamp: a full ISO string, or a bare date (read as local midnight). */
  function tsOf(s) { if (!s) return 0; var t = new Date(String(s).length === 10 ? s + 'T00:00:00' : s).getTime(); return isNaN(t) ? 0 : t; }
  function read(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }
  function write(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage unavailable */ } }
  function remove(key) { try { localStorage.removeItem(key); } catch (e) {} }
  function normPhone(p) { return String(p || '').replace(/\D/g, '').slice(-10); }
  function normEmail(e) { return String(e || '').trim().toLowerCase(); }
  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function emit(name, detail) { try { global.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch (e) {} }
  function fail(msg) { emit('nari:error', { message: msg }); }

  /* ---------- in-memory cache (both backends) ---------- */
  var db = { doctors: [], staff: [], members: [], appointments: [], invites: [], leads: [], payments: [], cycles: [], pushTokens: [] };
  var listeners = [];
  function notify() { listeners.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } }); }
  /* When this page last wrote anything. The console uses it to tell its own changes (echoed straight back by
     the Firestore listener) from things other people did, so it only chimes for the latter. */
  var lastWrite = 0;
  function touched() { lastWrite = Date.now(); }

  /* ====================================================================
     DEMO seed
     ==================================================================== */
  function seedDB() {
    var doctors = (CFG.seedDoctors || []).map(function (d) { return { id: d.id, name: d.name, role: d.role, exp: d.exp, refCode: d.refCode, active: true, img: d.img || '', categories: d.categories || [] }; });
    var staff = (CFG.seedDoctors || []).map(function (d) { return { email: normEmail(d.email), role: 'doctor', doctorId: d.id, name: d.name, password: 'doctor123' }; });
    staff.push({ email: 'admin@narihealth.in', role: 'admin', name: 'Istuti', password: 'admin123' });
    var members = [
      { id: 'mem_1', name: 'Priya S.', phone: '9876501001', city: 'Chennai', createdAt: daysFromToday(-40), provider: 'phone' },
      { id: 'mem_2', name: 'Divya M.', phone: '9876501002', city: 'Hyderabad', createdAt: daysFromToday(-35), provider: 'phone' },
      { id: 'mem_3', name: 'Kavita R.', phone: '9876501003', city: 'Jaipur', createdAt: daysFromToday(-30), provider: 'phone', email: 'kavita.r@gmail.com' },
      { id: 'mem_4', name: 'Ananya Gupta', phone: '9876501004', city: 'Delhi', createdAt: daysFromToday(-22), provider: 'phone' },
      { id: 'mem_5', name: 'Meera Nair', phone: '9876501005', city: 'Kochi', createdAt: daysFromToday(-18), provider: 'phone', email: 'meera.nair@gmail.com' },
      { id: 'mem_6', name: 'Ritika Bansal', phone: '9876501006', city: 'Lucknow', createdAt: daysFromToday(-12), provider: 'phone' },
      { id: 'mem_7', name: 'Farah Khan', phone: '9876501007', city: 'Mumbai', createdAt: daysFromToday(-9), provider: 'phone' },
      { id: 'mem_8', name: 'Sunita Verma', phone: '9876501008', city: 'Bhopal', createdAt: daysFromToday(-4), provider: 'phone' }
    ];
    function ref(type, val) { return type === 'doctor' ? { type: 'doctor', doctorId: val } : { type: 'source', label: val }; }
    function appt(o) {
      var m = byId(members, o.p);
      return {
        id: uid('apt'), memberId: o.p, memberName: m.name, memberPhone: m.phone, memberCity: m.city,
        doctorId: o.d || null, category: o.c, mode: o.m || 'video',
        date: daysFromToday(o.day), time: o.t || '10:00', notes: o.n || '', status: o.s || 'pending',
        referredBy: o.r, referredDoctorId: o.r && o.r.type === 'doctor' ? o.r.doctorId : null, createdAt: daysFromToday(Math.min(o.day - 3, -1))
      };
    }
    var appointments = [
      appt({ p: 'mem_1', d: 'doc_sudha', c: 'PCOS', day: -30, t: '11:00', s: 'completed', r: ref('source', 'Instagram'), n: 'Irregular cycles for 3 months.' }),
      appt({ p: 'mem_1', d: 'doc_sneha', c: 'Nutrition', day: -12, t: '15:00', s: 'completed', r: ref('doctor', 'doc_sudha'), n: 'PCOS diet plan follow-up.' }),
      appt({ p: 'mem_2', d: 'doc_hanifa', c: 'Mental Health', day: -25, t: '16:00', s: 'completed', r: ref('source', 'Friend or family') }),
      appt({ p: 'mem_2', d: 'doc_hanifa', c: 'Sleep', day: 3, t: '16:00', s: 'confirmed', r: ref('doctor', 'doc_hanifa'), n: 'Follow-up on sleep routine.' }),
      appt({ p: 'mem_3', d: 'doc_sudha', c: 'Menopause', day: -20, t: '10:00', s: 'completed', r: ref('source', 'Google search') }),
      appt({ p: 'mem_3', d: 'doc_nisha', c: 'Pelvic Health', day: 5, t: '12:00', m: 'clinic', s: 'confirmed', r: ref('doctor', 'doc_sudha'), n: 'Pelvic floor strengthening.' }),
      appt({ p: 'mem_4', d: 'doc_sneha', c: 'Nutrition', day: -15, t: '14:00', s: 'completed', r: ref('doctor', 'doc_sudha') }),
      appt({ p: 'mem_4', d: 'doc_sudha', c: 'Pregnancy', day: 1, t: '09:00', s: 'confirmed', r: ref('doctor', 'doc_sneha'), n: 'First trimester questions.' }),
      appt({ p: 'mem_5', d: 'doc_nisha', c: 'Pelvic Health', day: -8, t: '17:00', m: 'clinic', s: 'completed', r: ref('source', 'WhatsApp forward') }),
      appt({ p: 'mem_5', d: 'doc_hanifa', c: 'Mental Health', day: 2, t: '11:00', s: 'pending', r: ref('doctor', 'doc_nisha') }),
      appt({ p: 'mem_6', d: 'doc_sudha', c: 'Periods', day: -5, t: '10:00', s: 'cancelled', r: ref('doctor', 'doc_sudha') }),
      appt({ p: 'mem_6', d: 'doc_sudha', c: 'Periods', day: 4, t: '10:00', s: 'pending', r: ref('doctor', 'doc_sudha'), n: 'Rescheduled from last week.' }),
      appt({ p: 'mem_7', d: 'doc_sneha', c: 'PCOS', day: 0, t: '15:00', s: 'confirmed', r: ref('source', 'Instagram') }),
      appt({ p: 'mem_8', d: null, c: 'General Health', day: 6, t: '12:00', s: 'pending', r: ref('doctor', 'doc_hanifa'), n: 'Not sure which specialist to see.' })
    ];
    var invites = [
      { id: '9876502001', phone: '9876502001', phoneE164: CC + '9876502001', name: 'Lakshmi Iyer', city: 'Coimbatore', email: '', note: 'Post-natal check, prefers mornings.', doctorId: 'doc_sudha', createdAt: daysFromToday(-3), claimedBy: null, claimedAt: null },
      { id: '9876501003', phone: '9876501003', phoneE164: CC + '9876501003', name: 'Kavita R.', city: 'Jaipur', email: 'kavita.r@gmail.com', note: '', doctorId: 'doc_sudha', createdAt: daysFromToday(-31), claimedBy: 'mem_3', claimedAt: daysFromToday(-30) }
    ];
    members[2].referredByDoctorId = 'doc_sudha';
    var leads = [
      { id: 'lead_demo1', name: 'Shalini Verma', phone: '9876503001', concern: 'PCOS', time: 'evening', page: 'home', ref: '', utm: { source: 'instagram', medium: 'social', campaign: '' }, status: 'new', createdAt: new Date(Date.now() - 3 * 3600e3).toISOString() },
      { id: 'lead_demo2', name: 'Pooja Rathi', phone: '9876503002', concern: 'Physiotherapy / pain', time: 'morning', page: 'physiotherapy-bulandshahr', ref: 'NH-SUDHA', utm: { source: '', medium: '', campaign: '' }, status: 'contacted', createdAt: new Date(Date.now() - 30 * 3600e3).toISOString() }
    ];
    var payments = [
      { id: 'pay_demo1', memberId: 'mem_1', memberName: 'Priya S.', memberPhone: '9876501001', planId: 'sub', planLabel: 'Monthly membership', amount: 799, recurring: true, status: 'paid', txnRef: '4231XXXX9012', createdAt: new Date(Date.now() - 10 * 86400e3).toISOString(), paidAt: new Date(Date.now() - 10 * 86400e3).toISOString() },
      { id: 'pay_demo2', memberId: 'mem_2', memberName: 'Divya M.', memberPhone: '9876501002', planId: 'single', planLabel: 'Single consultation', amount: 199, recurring: false, status: 'claimed', txnRef: '4231XXXX7788', createdAt: new Date(Date.now() - 2 * 3600e3).toISOString(), claimedAt: new Date(Date.now() - 1.5 * 3600e3).toISOString() }
    ];
    return { version: 3, seededAt: new Date().toISOString(), doctors: doctors, staff: staff, members: members, appointments: appointments, invites: invites, leads: leads, payments: payments, cycles: seedCycles() };
  }
  /* Priya (mem_1, on a paid membership) has four periods logged, so the tracker has something to predict from. */
  function seedCycles() {
    var logs = {};
    logs[daysFromToday(-9)] = { flow: 'medium', symptoms: ['Cramps', 'Tired'], note: 'Cramps in the evening.' };
    logs[daysFromToday(-8)] = { flow: 'heavy', symptoms: ['Cramps', 'Headache'], note: '' };
    logs[daysFromToday(-6)] = { flow: 'light', symptoms: [], note: '' };
    return [{ id: 'mem_1', memberId: 'mem_1', cycleLength: null, updatedAt: nowIso(), logs: logs, periods: [
      { start: daysFromToday(-95), end: daysFromToday(-91) },
      { start: daysFromToday(-66), end: daysFromToday(-62) },
      { start: daysFromToday(-38), end: daysFromToday(-33) },
      { start: daysFromToday(-9), end: daysFromToday(-5) }
    ] }];
  }

  /* ====================================================================
     STORE adapters — put / patch / remove for a collection
     ==================================================================== */
  var store, fb = null, fs = null;

  var demoStore = {
    init: function () {
      var saved = read(DB_KEY);
      if (!saved || saved.version !== 3) { saved = seedDB(); write(DB_KEY, saved); }
      if (!saved.leads) saved.leads = [];
      if (!saved.payments) saved.payments = [];
      if (!saved.cycles) { saved.cycles = seedCycles(); write(DB_KEY, saved); }
      if (!saved.pushTokens) saved.pushTokens = [];
      /* Enquiries submitted from the public pages in demo mode land in a side key; fold them in. */
      var pending = read('nari_portal_leads');
      if (pending && pending.length) { pending.forEach(function (l) { if (indexOf(saved.leads, 'leads', l.id) < 0) saved.leads.push(l); }); remove('nari_portal_leads'); write(DB_KEY, saved); }
      db = saved;
      return Promise.resolve();
    },
    save: function () { write(DB_KEY, db); },
    put: function (coll, id, obj) { touched(); stamp(obj); var list = db[coll]; var i = indexOf(list, coll, id); if (i >= 0) list[i] = obj; else list.push(obj); demoStore.save(); return Promise.resolve(); },
    patch: function (coll, id, patchObj) { touched(); stamp(patchObj, true); var list = db[coll]; var i = indexOf(list, coll, id); if (i >= 0) { for (var k in patchObj) list[i][k] = patchObj[k]; } demoStore.save(); return Promise.resolve(); },
    remove: function (coll, id) { touched(); db[coll] = db[coll].filter(function (x) { return keyOf(coll, x) !== id; }); demoStore.save(); return Promise.resolve(); }
  };
  function keyOf(coll, x) { return coll === 'staff' ? x.email : x.id; }
  /* Anything an admin saves while viewing as someone else carries who really did it, for the activity feed:
     byAdmin on a new record, updatedByAdmin on a change (a member's own later change leaves byAdmin in place). */
  function stamp(obj, isPatch) { if (viewAs) obj[isPatch ? 'updatedByAdmin' : 'byAdmin'] = viewAs.admin.name || viewAs.admin.email; return obj; }
  function indexOf(list, coll, id) { for (var i = 0; i < list.length; i++) if (keyOf(coll, list[i]) === id) return i; return -1; }

  var liveStore = {
    init: function () {
      return loadFirebase().then(function () {
        if (!fb.apps.length) fb.initializeApp(CFG.firebase);
        fs = fb.firestore();
        fb.auth().languageCode = 'en';
      });
    },
    put: function (coll, id, obj) {
      touched(); stamp(obj); var list = db[coll]; var i = indexOf(list, coll, id); if (i >= 0) list[i] = obj; else list.push(obj);
      return fs.collection(coll).doc(id).set(clone(obj)).catch(function (e) { fail('Could not save: ' + e.message); throw e; });
    },
    patch: function (coll, id, patchObj) {
      touched(); stamp(patchObj, true); var list = db[coll]; var i = indexOf(list, coll, id); if (i >= 0) for (var k in patchObj) list[i][k] = patchObj[k];
      return fs.collection(coll).doc(id).update(clone(patchObj)).catch(function (e) { fail('Could not save: ' + e.message); throw e; });
    },
    remove: function (coll, id) {
      touched(); db[coll] = db[coll].filter(function (x) { return keyOf(coll, x) !== id; });
      return fs.collection(coll).doc(id).delete().catch(function (e) { fail('Could not delete: ' + e.message); throw e; });
    }
  };

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script'); s.src = src; s.async = false;
      s.onload = resolve; s.onerror = function () { reject(new Error('Failed to load ' + src)); };
      document.head.appendChild(s);
    });
  }
  var firebaseLoading = null;
  function loadFirebase() {
    if (firebaseLoading) return firebaseLoading;
    var v = CFG.firebaseVersion || '10.14.1', base = 'https://www.gstatic.com/firebasejs/' + v + '/';
    firebaseLoading = loadScript(base + 'firebase-app-compat.js')
      .then(function () { return Promise.all([loadScript(base + 'firebase-auth-compat.js'), loadScript(base + 'firebase-firestore-compat.js')]); })
      .then(function () { fb = global.firebase; });
    return firebaseLoading;
  }

  store = LIVE ? liveStore : demoStore;
  var initPromise = null;
  function init() { if (!initPromise) initPromise = store.init(); return initPromise; }

  /* ====================================================================
     LIVE data loading — per-role Firestore listeners feeding the cache
     ==================================================================== */
  var liveSets = {}; var unsubs = [];
  function docsOf(snap) {
    var out = [];
    function add(d) { var o = d.data(); if (!o.id) o.id = d.id; if (!o.email && d.ref.parent.id === 'staff') o.email = d.id; out.push(o); }
    /* A single document (cycles/{uid}) or a query result. */
    if (typeof snap.forEach === 'function') snap.forEach(add); else if (snap.exists) add(snap);
    return out;
  }
  function rebuild() {
    var seen = {}, apts = [];
    Object.keys(liveSets).forEach(function (k) {
      if (k.indexOf('appointments') !== 0) return;
      liveSets[k].forEach(function (a) { if (!seen[a.id]) { seen[a.id] = 1; apts.push(a); } });
    });
    db.appointments = apts;
    if (liveSets.doctors) db.doctors = liveSets.doctors;
    if (liveSets.members) db.members = liveSets.members;
    if (liveSets.staff) db.staff = liveSets.staff;
    if (liveSets.invites) db.invites = liveSets.invites;
    if (liveSets.leads) db.leads = liveSets.leads;
    if (liveSets.payments) db.payments = liveSets.payments;
    if (liveSets.cycles) db.cycles = liveSets.cycles;
    if (liveSets.pushTokens) db.pushTokens = liveSets.pushTokens;
  }
  var FIRST_LOAD_TIMEOUT = 12000;
  function watch(key, query) {
    return new Promise(function (resolve, reject) {
      var first = true;
      /* Firestore retries silently when the database does not exist yet; surface that instead of spinning forever. */
      var timer = setTimeout(function () { if (first) { first = false; reject(new Error('Could not reach the database. Check that Firestore is created in project ' + (CFG.firebase.projectId || '') + ' and firestore.rules is published (GO-LIVE.md, steps 4 and 5).')); } }, FIRST_LOAD_TIMEOUT);
      var un = query.onSnapshot(function (snap) {
        liveSets[key] = docsOf(snap); rebuild();
        if (first) { first = false; clearTimeout(timer); resolve(); } else notify();
      }, function (err) { if (first) { first = false; clearTimeout(timer); reject(err); } else fail(err.message); });
      unsubs.push(un);
    });
  }
  function loadLive(role, user, asAdmin) {
    unsubs.forEach(function (u) { u(); }); unsubs = []; liveSets = {};
    var jobs = [watch('doctors', fs.collection('doctors'))];
    /* Payments and the period tracker are add-ons: if the published firestore.rules predate their collections,
       the page still opens (with that list empty) instead of failing with "insufficient permissions". */
    function optional(key, query, label) { return watch(key, query).catch(function (e) { console.warn(label + ' not loaded:', e && e.message); liveSets[key] = []; rebuild(); fail(label + ' could not be loaded. Publish the latest firestore.rules (GO-LIVE.md step 5).'); }); }
    if (role === 'member') {
      jobs.push(watch('appointments:mine', fs.collection('appointments').where('memberId', '==', user.id)));
      jobs.push(optional('payments', fs.collection('payments').where('memberId', '==', user.id), 'Payments'));
      /* Her tracker is read by its id, cycles/{uid}: the rules allow only that, not a query over the collection.
         An admin viewing as her does not read it at all; it is private to the member. */
      if (!asAdmin) jobs.push(optional('cycles', fs.collection('cycles').doc(user.id), 'The period tracker'));
    }
    if (role === 'doctor') {
      jobs.push(watch('appointments:doc', fs.collection('appointments').where('doctorId', '==', user.id)));
      jobs.push(watch('appointments:ref', fs.collection('appointments').where('referredDoctorId', '==', user.id)));
      jobs.push(watch('invites', fs.collection('invites').where('doctorId', '==', user.id)));
    }
    if (role === 'admin') {
      jobs.push(watch('appointments:all', fs.collection('appointments')));
      jobs.push(watch('members', fs.collection('members')));
      jobs.push(watch('staff', fs.collection('staff')));
      jobs.push(watch('invites', fs.collection('invites')));
      jobs.push(watch('leads', fs.collection('leads')));
      jobs.push(optional('payments', fs.collection('payments'), 'Payments'));
      jobs.push(watch('pushTokens', fs.collection('pushTokens')).catch(function () { liveSets.pushTokens = []; rebuild(); }));
    }
    if (!role) jobs.length = 1; /* login pages only need doctors for referral lookups */
    return Promise.all(jobs);
  }

  /* ====================================================================
     AUTH
     ==================================================================== */
  function authUserOf(u) {
    return { uid: u.uid, name: u.displayName || '', email: normEmail(u.email), phone: normPhone(u.phoneNumber), photo: u.photoURL || '', provider: u.phoneNumber && !u.email ? 'phone' : (u.providerData && u.providerData[0] && u.providerData[0].providerId === 'password' ? 'password' : 'google') };
  }
  function currentAuthUser() { return LIVE ? fb.auth().currentUser : read(PENDING_KEY); }
  function waitForAuth() {
    return new Promise(function (resolve) {
      var un = fb.auth().onAuthStateChanged(function (u) { un(); resolve(u); });
    });
  }
  function fbGet(coll, id) { return fs.collection(coll).doc(id).get().then(function (d) { if (!d.exists) return null; var o = d.data(); if (!o.id && coll !== 'staff') o.id = d.id; if (coll === 'staff') o.email = d.id; return o; }); }

  /* Resolve who the signed-in person is for a given role.
     → { status: 'ok', user }                 signed in and allowed
     → { status: 'new', authUser }            mobile verified, no member profile yet (members only)
     → { status: 'none' }                     not signed in
     → { status: 'denied', error }            signed in but not on the panel / team */
  function resolveRole(role) {
    if (!LIVE) {
      var s = read(SESSION_KEY);
      if (!s || s.role !== role) return Promise.resolve({ status: 'none' });
      var u = demoUser(s);
      return Promise.resolve(u ? { status: 'ok', user: u } : { status: 'none' });
    }
    return waitForAuth().then(function (u) {
      if (!u) return { status: 'none' };
      var au = authUserOf(u);
      if (role === 'member') {
        /* Members are phone-only. A leftover Google/password session (staff, or an old account that never
           finished the SMS step) cannot act as a member, so treat it as signed out. */
        if (!au.phone) { fb.auth().signOut(); return { status: 'none' }; }
        return fbGet('members', u.uid).then(function (m) {
          if (m) { m.id = u.uid; if (!m.img && au.photo) m.img = au.photo; }
          /* Keep the profile's number equal to the verified one (older profiles held a typed, unverified number). */
          if (m && m.phone !== au.phone) { m.phone = au.phone; fs.collection('members').doc(u.uid).update({ phone: au.phone }).catch(function () {}); }
          if (m) return { status: 'ok', user: m };
          return { status: 'new', authUser: au };
        });
      }
      if (!au.email) return { status: 'denied', error: 'Staff sign in with the email and password the NARI team gave you. Phone sign-in is for ' + MEMBERS.toLowerCase() + '.' };
      return fbGet('staff', au.email).then(function (st) {
        if (!st || st.role !== role) return { status: 'denied', error: au.email + ' is not registered as ' + (role === 'admin' ? 'a NARI admin' : 'a panel doctor') + '. Ask the NARI team to add you.' };
        if (role === 'admin') return { status: 'ok', user: { id: au.email, name: st.name || au.name || 'NARI admin', email: au.email, img: au.photo, role: 'admin' } };
        return fbGet('doctors', st.doctorId).then(function (d) {
          if (!d) return { status: 'denied', error: 'Your doctor profile is missing. Ask the NARI team to check the panel.' };
          if (!d.active) return { status: 'denied', error: 'This account has been paused. Contact the NARI admin.' };
          /* First sign-in is stamped on the staff record so the team gets a "Dr X is in" notification. */
          if (!st.firstLoginAt) fs.collection('staff').doc(au.email).update({ firstLoginAt: nowIso() }).catch(function () {});
          d.email = au.email; return { status: 'ok', user: d };
        });
      });
    });
  }
  function demoUser(s) {
    if (s.role === 'member') return byId(db.members, s.id);
    if (s.role === 'doctor') { var d = byId(db.doctors, s.id); if (d) { var st = staffForDoctor(d.id); d.email = st ? st.email : ''; } return d; }
    if (s.role === 'admin') { var a = staffByEmail(s.id); return a && a.role === 'admin' ? { id: a.email, name: a.name, email: a.email, role: 'admin' } : null; }
    return null;
  }
  function staffByEmail(email) { email = normEmail(email); for (var i = 0; i < db.staff.length; i++) if (db.staff[i].email === email) return db.staff[i]; return null; }
  function staffForDoctor(id) { for (var i = 0; i < db.staff.length; i++) if (db.staff[i].doctorId === id) return db.staff[i]; return null; }

  var auth = {
    isLive: LIVE,
    /* Demo-only session shape { role, id }. In live mode the session is Firebase's. */
    current: function () { return read(SESSION_KEY); },
    set: function (role, id) { write(SESSION_KEY, { role: role, id: id, at: Date.now() }); },
    logout: function () {
      remove(SESSION_KEY); remove(PENDING_KEY); remove(OTP_KEY);
      unsubs.forEach(function (u) { u(); }); unsubs = [];
      return LIVE ? init().then(function () { return fb.auth().signOut(); }) : Promise.resolve();
    },
    resolve: function (role) { return init().then(function () { return resolveRole(role); }); },
    loginPage: function (role) { return ROOT + (PAGES[role] || PAGES.member).login; },
    homeFor: function (role) { return ROOT + (PAGES[role] || PAGES.member).home; },

    /* ---- Google (staff only; members use their mobile number) ---- */
    signInWithGoogle: function (role) {
      return init().then(function () {
        if (role === 'member') return { ok: false, error: MEMBERS + ' sign in with their mobile number and a one-time code.' };
        if (!LIVE) return { ok: false, error: 'In demo mode, staff sign in with the demo email and password below.' };
        var provider = new fb.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        return fb.auth().signInWithPopup(provider).catch(function (e) {
          if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) return fb.auth().signInWithRedirect(provider).then(function () { return null; });
          throw e;
        }).then(function () { return resolveRole(role); }).then(function (r) {
          if (r.status === 'ok') return { ok: true, status: 'ok', user: r.user };
          if (r.status === 'denied') { fb.auth().signOut(); return { ok: false, error: r.error }; }
          return { ok: false, error: 'Sign-in was cancelled.' };
        }).catch(function (e) { return { ok: false, error: friendlyAuthError(e) }; });
      });
    },

    /* ---- Mobile OTP: the only member sign-in ----
       Live: Firebase sends the SMS (signInWithPhoneNumber) and signs her in with a phone-only account, so
       the ID token carries phone_number and firestore.rules can match a doctor's invite to it. Members who
       earlier signed in with Google and linked this number land in that same account (same uid).
       `containerId` is an empty element for the invisible reCAPTCHA. */
    sendOtp: function (phone, containerId) {
      phone = normPhone(phone);
      if (!/^[6-9]\d{9}$/.test(phone)) return Promise.resolve({ ok: false, error: 'Enter a valid 10-digit Indian mobile number.' });
      return init().then(function () {
        if (!LIVE) {
          var code = String(Math.floor(100000 + Math.random() * 900000));
          write(OTP_KEY, { phone: phone, code: code, exp: Date.now() + 5 * 60 * 1000 });
          return { ok: true, phone: phone, demoCode: code };
        }
        /* First try is an invisible reCAPTCHA. If Google rejects that (it does on some networks and browsers), the
           next try shows the normal "I'm not a robot" box in the same container so she can tick it herself. */
        var holder = containerId || 'recaptcha-holder';
        /* Google's security check rejects real phone sign-in from localhost (auth/invalid-app-credential), so on a
           local copy it is skipped and only Firebase test numbers work (GO-LIVE.md → "Testing phone sign-in locally"). */
        if (LOCALHOST) fb.auth().settings.appVerificationDisabledForTesting = true;
        function verifier() {
          if (auth._recaptcha) return Promise.resolve(auth._recaptcha);
          var v = new fb.auth.RecaptchaVerifier(holder, { size: auth._captchaMode || 'invisible' });
          return v.render().then(function () { auth._recaptcha = v; return v; });
        }
        return verifier().then(function (v) {
          return fb.auth().signInWithPhoneNumber(CC + phone, v);
        }).then(function (confirmation) {
          auth._confirmation = confirmation;
          return { ok: true, phone: phone };
        }).catch(function (e) {
          var code = e && e.code || '';
          try { if (auth._recaptcha) auth._recaptcha.clear(); } catch (x) {} auth._recaptcha = null;
          var el = document.getElementById(holder); if (el) el.innerHTML = '';
          var captchaProblem = /captcha|app-credential|invalid-recaptcha|missing-recaptcha/.test(code);
          if (LOCALHOST && captchaProblem) return { ok: false, error: 'On localhost only Firebase test numbers can sign in (no real SMS is sent). Add one under Firebase console → Authentication → Sign-in method → Phone → Phone numbers for testing, or try a real number on narihealth.in.' };
          if (captchaProblem && auth._captchaMode !== 'normal') {
            auth._captchaMode = 'normal';
            /* Pre-render the visible box now so she sees it immediately. */
            verifier().catch(function () {});
            console.warn('Phone sign-in security check failed:', code, e && e.message);
            return { ok: false, captcha: true, error: 'The automatic security check did not pass. Tick "I\'m not a robot" below, then press Send code again. (' + code + ' on ' + window.location.hostname + ')' };
          }
          return { ok: false, error: friendlyAuthError(e) };
        });
      });
    },
    verifyOtp: function (phone, code) {
      phone = normPhone(phone); code = String(code || '').trim();
      if (!LIVE) {
        var rec = read(OTP_KEY);
        if (!rec || rec.phone !== phone) return Promise.resolve({ ok: false, error: 'Request a new code first.' });
        if (Date.now() > rec.exp) return Promise.resolve({ ok: false, error: 'That code has expired. Request a new one.' });
        if (code !== rec.code) return Promise.resolve({ ok: false, error: 'That code is not right. Check and try again.' });
        remove(OTP_KEY);
        var m = members.findByPhone(phone);
        if (m) { auth.set('member', m.id); return Promise.resolve({ ok: true, status: 'ok', user: m }); }
        var au = { uid: uid('mem'), name: '', email: '', photo: '', provider: 'phone', phone: phone };
        write(PENDING_KEY, au);
        return Promise.resolve({ ok: true, status: 'new', authUser: au });
      }
      if (!auth._confirmation) return Promise.resolve({ ok: false, error: 'Request a new code first.' });
      return auth._confirmation.confirm(code).then(function () {
        auth._confirmation = null;
        return resolveRole('member');
      }).then(function (r) {
        if (r.status === 'ok') return { ok: true, status: 'ok', user: r.user };
        if (r.status === 'new') return { ok: true, status: 'new', authUser: r.authUser };
        return { ok: false, error: 'Could not sign you in. Try again.' };
      }).catch(function (e) { return { ok: false, error: friendlyAuthError(e) }; });
    },

    /* ---- Staff email + password login (credentials are created by an admin) ---- */
    loginStaff: function (role, email, password) {
      email = normEmail(email);
      return init().then(function () {
        if (!LIVE) {
          var st = staffByEmail(email);
          if (!st || st.password !== password || st.role !== role) return { ok: false, error: 'Email or password is incorrect.' };
          if (role === 'doctor') { var d = byId(db.doctors, st.doctorId); if (!d) return { ok: false, error: 'Doctor profile missing.' }; if (!d.active) return { ok: false, error: 'This account has been paused. Contact the NARI admin.' }; if (!st.firstLoginAt) store.patch('staff', st.email, { firstLoginAt: nowIso() }); auth.set('doctor', d.id); return { ok: true, user: d }; }
          auth.set('admin', st.email); return { ok: true, user: { id: st.email, name: st.name, email: st.email } };
        }
        return fb.auth().signInWithEmailAndPassword(email, password).then(function () { return resolveRole(role); }).then(function (r) {
          if (r.status === 'ok') return { ok: true, user: r.user };
          fb.auth().signOut();
          return { ok: false, error: r.error || 'Could not sign you in.' };
        }).catch(function (e) { return { ok: false, error: friendlyAuthError(e) }; });
      });
    },
    /* Sends Firebase's password-reset email to a staff address. */
    resetPassword: function (email) {
      email = normEmail(email);
      if (!LIVE) return Promise.resolve({ ok: false, error: 'Demo mode: password resets are not available. Demo password is doctor123 / admin123.' });
      return init().then(function () { return fb.auth().sendPasswordResetEmail(email); }).then(function () { return { ok: true }; }).catch(function (e) { return { ok: false, error: friendlyAuthError(e) }; });
    }
  };

  /* Creates a sign-in account for someone else without disturbing the admin's own session, by using a
     second Firebase app instance. Resolves { created: true } or { created: false, exists: true } if the
     email already has an account (they can then use "Forgot password"). */
  function createAuthUser(email, password) {
    if (!LIVE) return Promise.resolve({ created: true });
    var name = 'nari-secondary';
    var app2 = null; for (var i = 0; i < fb.apps.length; i++) if (fb.apps[i].name === name) app2 = fb.apps[i];
    if (!app2) app2 = fb.initializeApp(CFG.firebase, name);
    return app2.auth().createUserWithEmailAndPassword(normEmail(email), password).then(function () {
      return app2.auth().signOut().then(function () { return { created: true }; });
    }).catch(function (e) {
      if (e && e.code === 'auth/email-already-in-use') return { created: false, exists: true };
      throw new Error(friendlyAuthError(e));
    });
  }

  function friendlyAuthError(e) {
    var c = e && e.code || '';
    var map = {
      'auth/invalid-phone-number': 'That mobile number does not look right.',
      'auth/too-many-requests': 'Too many attempts from this device. Wait a few minutes and try again.',
      'auth/invalid-verification-code': 'That code is not right. Check and try again.',
      'auth/code-expired': 'That code has expired. Request a new one.',
      'auth/popup-closed-by-user': 'The Google window was closed before finishing.',
      'auth/cancelled-popup-request': 'The Google window was closed before finishing.',
      'auth/network-request-failed': 'No internet connection. Check your network and try again.',
      'auth/unauthorized-domain': 'This website is not yet authorised in Firebase. Add the domain under Authentication → Settings.',
      'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase yet.',
      'auth/quota-exceeded': 'SMS limit reached for today. Please try again tomorrow or message us on WhatsApp.',
      'auth/captcha-check-failed': 'SMS sign-in is not enabled for ' + window.location.hostname + ' yet. The NARI team must add this address under Firebase → Authentication → Settings → Authorized domains.',
      'auth/invalid-app-credential': 'The security check expired or was rejected. Please try again.',
      'auth/missing-app-credential': 'The security check did not load. Reload the page and try again.',
      'auth/invalid-recaptcha-token': 'The security check expired. Please try again.',
      'auth/missing-recaptcha-token': 'The security check did not load. Reload the page and try again.',
      'auth/app-not-authorized': 'This website is not authorised in Firebase. Add the domain under Authentication → Settings.',
      'auth/api-key-not-valid': 'The Firebase API key in portal-config.js is not valid.',
      'auth/permission-denied': 'Your access rules are out of date. Publish the latest firestore.rules (GO-LIVE.md step 5).',
      'auth/billing-not-enabled': 'SMS codes are not switched on for this project yet. The NARI team must enable Phone sign-in billing in Firebase.',
      'auth/account-exists-with-different-credential': 'This mobile number is linked to a different NARI account. Message us on WhatsApp and we will sort it out.',
      'auth/credential-already-in-use': 'This mobile number is linked to a different NARI account. Message us on WhatsApp and we will sort it out.',
      'auth/provider-already-linked': 'A mobile number is already verified on this account.',
      'auth/requires-recent-login': 'For your security, sign in again and retry.',
      'auth/missing-phone-number': 'Enter your mobile number.',
      'auth/invalid-credential': 'Email or password is incorrect.',
      'auth/wrong-password': 'Email or password is incorrect.',
      'auth/user-not-found': 'No account with this email. Ask the NARI admin to add you.',
      'auth/invalid-email': 'That email address does not look right.',
      'auth/weak-password': 'Password must be at least 6 characters.',
      'auth/user-disabled': 'This account has been disabled. Contact the NARI admin.',
      'auth/missing-password': 'Enter your password.'
    };
    var msg = map[c] || (e && e.message) || 'Something went wrong. Please try again.';
    /* Keep the raw code visible for unmapped errors so a screenshot is enough to diagnose. */
    if (!map[c] && c) msg += ' (' + c + ')';
    return msg;
  }

  /* ====================================================================
     MEMBERS
     ==================================================================== */
  var members = {
    word: MEMBER, plural: MEMBERS,
    list: function () { return db.members.slice(); },
    /* Falls back to the details copied onto appointments, so doctors can see names without reading the members collection. */
    get: function (id) {
      var m = byId(db.members, id); if (m) return m;
      for (var i = 0; i < db.appointments.length; i++) { var a = db.appointments[i]; if (a.memberId === id) return { id: id, name: a.memberName || MEMBER, phone: a.memberPhone || '', city: a.memberCity || '', img: '' }; }
      return null;
    },
    findByPhone: function (phone) { phone = normPhone(phone); if (!phone) return null; for (var i = 0; i < db.members.length; i++) if (db.members[i].phone === phone) return db.members[i]; return null; },
    findByEmail: function (email) { email = normEmail(email); if (!email) return null; for (var i = 0; i < db.members.length; i++) if (db.members[i].email === email) return db.members[i]; return null; },
    /* Finishes sign-up for a freshly authenticated person. `o` = { name, city }.
       The phone always comes from the verified number on the account, never from a typed field. */
    completeProfile: function (o) {
      var au = currentAuthUser();
      if (!au) return Promise.reject(new Error('Not signed in.'));
      var phone = normPhone(au.phoneNumber || au.phone);
      if (phone.length !== 10) return Promise.reject(new Error('Verify your mobile number first.'));
      var id = LIVE ? au.uid : (au.uid || uid('mem'));
      var m = {
        id: id, name: String(o.name || au.displayName || au.name || '').trim(), phone: phone,
        email: normEmail(au.email), city: String(o.city || '').trim(), img: au.photoURL || au.photo || '',
        provider: 'phone', createdAt: nowIso()
      };
      return store.put('members', id, m).then(function () { if (!LIVE) { remove(PENDING_KEY); auth.set('member', id); } return m; });
    },
    update: function (id, patch) { var m = byId(db.members, id); if (m) for (var k in patch) m[k] = patch[k]; return store.patch('members', id, patch).then(function () { return m; }); },
    /* The doctor who added or referred this member, if any. */
    referrerOf: function (m) { return m && m.referredByDoctorId ? byId(db.doctors, m.referredByDoctorId) : null; },
    remove: function (id) {
      var jobs = [store.remove('members', id)];
      db.appointments.filter(function (a) { return a.memberId === id; }).forEach(function (a) { jobs.push(store.remove('appointments', a.id)); });
      if (byId(db.cycles, id) || LIVE) jobs.push(store.remove('cycles', id).catch(function () {}));
      return Promise.all(jobs);
    }
  };

  /* ====================================================================
     DOCTORS
     ==================================================================== */
  var doctors = {
    list: function (activeOnly) { return db.doctors.filter(function (d) { return !activeOnly || d.active; }); },
    get: function (id) { return byId(db.doctors, id); },
    emailOf: function (id) { var st = staffForDoctor(id); return st ? st.email : ''; },
    byRefCode: function (code) { code = String(code || '').trim().toUpperCase(); if (!code) return null; for (var i = 0; i < db.doctors.length; i++) if (db.doctors[i].refCode === code) return db.doctors[i]; return null; },
    emailTaken: function (email) { return !!staffByEmail(email); },
    create: function (o) {
      var base = 'NH-' + String(o.name || 'DOC').replace(/^dr\.?\s*/i, '').split(/\s+/)[0].replace(/[^a-z]/gi, '').toUpperCase().slice(0, 8);
      var code = base, n = 2; while (doctors.byRefCode(code)) code = base + n++;
      var d = { id: o.id || uid('doc'), name: String(o.name || '').trim(), role: String(o.role || '').trim(), exp: String(o.exp || '').trim(), refCode: o.refCode || code, active: true, img: o.img || '', categories: o.categories || [], createdAt: nowIso() };
      var st = { email: normEmail(o.email), role: 'doctor', doctorId: d.id, name: d.name };
      if (!LIVE) st.password = o.password || 'doctor123';
      var account = o.password ? createAuthUser(st.email, o.password) : Promise.resolve({ created: false });
      return account.then(function (acc) {
        return Promise.all([store.put('doctors', d.id, d), store.put('staff', st.email, st)]).then(function () { d._account = acc; return d; });
      });
    },
    update: function (id, patch) { var d = byId(db.doctors, id); if (d) for (var k in patch) d[k] = patch[k]; return store.patch('doctors', id, patch).then(function () { return d; }); },
    /* One-click import of the experts listed in portal-config.js (skips ones already present). */
    seedFromConfig: function () {
      var jobs = [];
      (CFG.seedDoctors || []).forEach(function (s) { if (!byId(db.doctors, s.id) && !doctors.byRefCode(s.refCode)) jobs.push(doctors.create(s)); });
      return Promise.all(jobs).then(function (r) { return r.length; });
    }
  };

  /* ====================================================================
     STAFF (admins)
     ==================================================================== */
  var staff = {
    list: function () { return db.staff.slice(); },
    admins: function () { return db.staff.filter(function (s) { return s.role === 'admin'; }); },
    addAdmin: function (email, name, password) {
      var st = { email: normEmail(email), role: 'admin', name: String(name || '').trim(), createdAt: nowIso() }; if (!LIVE) st.password = password || 'admin123';
      var account = password ? createAuthUser(st.email, password) : Promise.resolve({ created: false });
      return account.then(function (acc) { return store.put('staff', st.email, st).then(function () { st._account = acc; return st; }); });
    },
    remove: function (email) { return store.remove('staff', normEmail(email)); }
  };

  /* ====================================================================
     INVITES — members added by a doctor before they sign up themselves.
     Keyed by 10-digit phone. When that person signs in (verified phone, or a
     Google/password account with the same email) the invite is claimed and the
     member is tagged with referredByDoctorId.
     ==================================================================== */
  var invites = {
    list: function () { return db.invites.slice(); },
    get: function (phone) { return byId(db.invites, normPhone(phone)); },
    forDoctor: function (did) { return db.invites.filter(function (i) { return i.doctorId === did; }).sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; }); },
    create: function (o, doctorId) {
      var phone = normPhone(o.phone);
      if (phone.length !== 10) return Promise.reject(new Error('Enter a valid 10-digit mobile number.'));
      if (invites.get(phone)) return Promise.reject(new Error('This number has already been added.'));
      var inv = { id: phone, phone: phone, phoneE164: CC + phone, name: String(o.name || '').trim(), city: String(o.city || '').trim(), email: normEmail(o.email), note: String(o.note || '').trim(), doctorId: doctorId, createdAt: nowIso(), claimedBy: null, claimedAt: null };
      return store.put('invites', inv.id, inv).then(function () { return inv; });
    },
    remove: function (phone) { return store.remove('invites', normPhone(phone)); },
    /* Called for a signed-in member without a referrer: links a matching invite, if one exists. */
    claimFor: function (m) {
      if (!m || m.referredByDoctorId) return Promise.resolve(null);
      var found;
      if (!LIVE) {
        found = Promise.resolve(db.invites.filter(function (i) { return !i.claimedBy && ((m.phone && i.phone === m.phone) || (m.email && i.email && i.email === m.email)); })[0] || null);
      } else {
        var u = fb.auth().currentUser; if (!u) return Promise.resolve(null);
        var byPhone = u.phoneNumber ? fs.collection('invites').doc(normPhone(u.phoneNumber)).get().then(function (d) { return d.exists ? d.data() : null; }) : Promise.resolve(null);
        found = byPhone.then(function (inv) {
          if (inv || !u.email) return inv;
          return fs.collection('invites').where('email', '==', normEmail(u.email)).limit(1).get().then(function (q) { return q.empty ? null : q.docs[0].data(); });
        }).catch(function () { return null; });
      }
      return found.then(function (inv) {
        if (!inv || inv.claimedBy) return null;
        return Promise.all([
          members.update(m.id, { referredByDoctorId: inv.doctorId }),
          store.patch('invites', inv.id, { claimedBy: m.id, claimedAt: todayIso() })
        ]).then(function () { return byId(db.doctors, inv.doctorId); });
      });
    }
  };

  /* ====================================================================
     APPOINTMENTS
     ==================================================================== */
  function sortByDate(list, desc) {
    return list.slice().sort(function (a, b) { var ka = a.date + ' ' + a.time, kb = b.date + ' ' + b.time; return desc ? (ka < kb ? 1 : -1) : (ka > kb ? 1 : -1); });
  }
  var appointments = {
    list: function () { return sortByDate(db.appointments); },
    get: function (id) { return byId(db.appointments, id); },
    forMember: function (mid) { return sortByDate(db.appointments.filter(function (a) { return a.memberId === mid; })); },
    forDoctor: function (did) { return sortByDate(db.appointments.filter(function (a) { return a.doctorId === did; })); },
    referredByDoctor: function (did) { return sortByDate(db.appointments.filter(function (a) { return a.referredDoctorId === did || (a.referredBy && a.referredBy.type === 'doctor' && a.referredBy.doctorId === did); })); },
    /* Distinct members this doctor referred, with a summary each. */
    membersReferredBy: function (did) {
      var map = {};
      function row(key, m) { if (!map[key]) map[key] = { member: m, appointments: [], firstReferred: null, lastVisit: null, invited: false, signedUp: true }; return map[key]; }
      /* Members the doctor added directly (invites), whether or not they have signed up yet. */
      invites.forDoctor(did).forEach(function (inv) {
        var key = inv.claimedBy || 'inv_' + inv.phone;
        var r = row(key, { id: inv.claimedBy || key, name: inv.name || 'Unnamed', phone: inv.phone, city: inv.city, email: inv.email, img: '' });
        r.invited = true; r.signedUp = !!inv.claimedBy; r.note = inv.note; r.firstReferred = inv.createdAt;
      });
      appointments.referredByDoctor(did).forEach(function (a) {
        var m = members.get(a.memberId); if (!m) return;
        var r = row(m.id, m);
        r.appointments.push(a);
        if (!r.firstReferred || a.createdAt < r.firstReferred) r.firstReferred = a.createdAt;
        if (a.status === 'completed' && (!r.lastVisit || a.date > r.lastVisit)) r.lastVisit = a.date;
      });
      /* Members whose profile is tagged with this doctor (admin view has the members collection). */
      db.members.forEach(function (m) { if (m.referredByDoctorId === did) { var r = row(m.id, m); if (!r.firstReferred) r.firstReferred = m.createdAt; } });
      return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return (a.firstReferred || '') < (b.firstReferred || '') ? 1 : -1; });
    },
    create: function (o) {
      var m = members.get(o.memberId) || {};
      var r = o.referredBy || null;
      var a = {
        id: uid('apt'), memberId: o.memberId, memberName: m.name || '', memberPhone: m.phone || '', memberCity: m.city || '',
        doctorId: o.doctorId || null, category: o.category, mode: o.mode || MODES[0].id,
        date: o.date, time: o.time, notes: String(o.notes || '').trim(), status: 'pending',
        referredBy: r, referredDoctorId: r && r.type === 'doctor' ? r.doctorId : null, createdAt: nowIso()
      };
      return store.put('appointments', a.id, a).then(function () { return a; });
    },
    setStatus: function (id, status) {
      if (STATUSES.indexOf(status) < 0) return Promise.reject(new Error('Bad status'));
      var patch = { status: status }; if (status === 'cancelled') patch.cancelledAt = nowIso();
      return store.patch('appointments', id, patch);
    },
    assignDoctor: function (id, doctorId) { return store.patch('appointments', id, { doctorId: doctorId || null }); },
    isPast: function (a) { return a.date < todayIso(); },
    isUpcoming: function (a) { return a.date >= todayIso() && (a.status === 'pending' || a.status === 'confirmed'); }
  };

  /* ====================================================================
     LEADS — call-back enquiries from the public pages (lead-form.js writes them; admins work them here)
     ==================================================================== */
  var LEAD_STATUSES = ['new', 'contacted', 'booked', 'closed'];
  var leads = {
    STATUSES: LEAD_STATUSES,
    TIMES: { morning: 'Morning (9 am – 12 pm)', afternoon: 'Afternoon (12 – 4 pm)', evening: 'Evening (4 – 8 pm)' },
    list: function () { return db.leads.slice().sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; }); },
    get: function (id) { return byId(db.leads, id); },
    countNew: function () { return db.leads.filter(function (l) { return l.status === 'new'; }).length; },
    setStatus: function (id, status) { if (LEAD_STATUSES.indexOf(status) < 0) return Promise.reject(new Error('Bad status')); return store.patch('leads', id, { status: status }); },
    remove: function (id) { return store.remove('leads', id); },
    /* Where the enquiry came from, for the console: referring doctor, campaign, or page. */
    sourceOf: function (l) {
      var parts = [];
      var d = l.ref ? doctors.byRefCode(l.ref) : null; if (d) parts.push('Referred by ' + d.name); else if (l.ref) parts.push('Code ' + l.ref);
      if (l.utm && l.utm.source) parts.push(l.utm.source + (l.utm.campaign ? ' · ' + l.utm.campaign : ''));
      parts.push(l.page === 'home' ? 'Home page' : String(l.page || '').replace(/-/g, ' '));
      return parts.join(' · ');
    }
  };

  /* ====================================================================
     PAYMENTS — plans and Paytm hand-off (see portal-config.js → payments)
     The site has no server, so the browser opens Paytm with the amount pre-filled and records the attempt
     in `payments/{id}`. The member then enters the UPI reference number ("claimed") and the team marks it
     Paid in the console. Entitlement (membership / pass validity) is derived from paid payments.
     ==================================================================== */
  function isMobile() { return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || ''); }
  var payments = {
    PLANS: PLANS, STATUSES: PAY_STATUSES,
    upiId: PAY.upiId || '',
    plan: function (id) { return byId(PLANS, id); },
    defaultPlan: function () { for (var i = 0; i < PLANS.length; i++) if (PLANS[i].default) return PLANS[i]; return PLANS[0]; },
    list: function () { return db.payments.slice().sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; }); },
    get: function (id) { return byId(db.payments, id); },
    forMember: function (mid) { return payments.list().filter(function (p) { return p.memberId === mid; }); },
    countBy: function (status) { return db.payments.filter(function (p) { return p.status === status; }).length; },
    rupees: function (n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); },
    /* What the member currently has: { kind: 'plan', plan, until } for a live membership/pass, { kind: 'single', count }
       for paid single consultations not yet used up, or null. */
    entitlement: function (mid) {
      var paid = payments.forMember(mid).filter(function (p) { return p.status === 'paid'; });
      var best = null;
      paid.forEach(function (p) {
        var plan = payments.plan(p.planId); if (!plan || !plan.days) return;
        var from = new Date(p.paidAt || p.createdAt); var until = new Date(from.getTime() + plan.days * 86400e3);
        if (until >= new Date() && (!best || until > best.until)) best = { kind: 'plan', plan: plan, until: until, payment: p };
      });
      if (best) return best;
      var singles = paid.filter(function (p) { var pl = payments.plan(p.planId); return pl && !pl.days; }).length;
      var used = db.appointments.filter(function (a) { return a.memberId === mid && (a.status === 'completed' || a.status === 'confirmed'); }).length;
      var left = singles - used;
      return left > 0 ? { kind: 'single', count: left } : null;
    },
    /* Builds the links that open Paytm with the amount filled in. */
    links: function (plan, payment) {
      var note = 'NARI ' + plan.label + ' ' + payment.id;
      var q = 'pa=' + encodeURIComponent(payments.upiId) + '&pn=' + encodeURIComponent(PAY.payeeName || 'NARI Health') + '&am=' + Number(plan.price).toFixed(2) + '&cu=INR&tn=' + encodeURIComponent(note) + '&tr=' + encodeURIComponent(payment.id);
      return {
        page: plan.link || '',
        paytm: payments.upiId ? 'paytmmp://pay?' + q : '',
        upi: payments.upiId ? 'upi://pay?' + q : '',
        whatsapp: waLink('Hi NARI Health, I want to pay ' + payments.rupees(plan.price) + ' for the ' + plan.label + ' (ref ' + payment.id + '). Please send me the payment link.')
      };
    },
    /* Records the attempt and returns how to pay: { payment, method: 'page'|'app'|'upi'|'whatsapp', url, links }. */
    start: function (planId, member) {
      var plan = payments.plan(planId); if (!plan) return Promise.reject(new Error('Unknown plan.'));
      var p = {
        id: uid('pay'), memberId: member.id, memberName: member.name || '', memberPhone: member.phone || '',
        planId: plan.id, planLabel: plan.label, amount: Number(plan.price), recurring: !!plan.recurring,
        status: 'initiated', txnRef: '', createdAt: nowIso()
      };
      return store.put('payments', p.id, p).then(function () {
        var l = payments.links(plan, p);
        var method = l.page ? 'page' : l.paytm ? (isMobile() ? 'app' : 'upi') : 'whatsapp';
        var url = method === 'page' ? l.page : method === 'app' ? l.paytm : method === 'upi' ? l.upi : l.whatsapp;
        return { payment: p, plan: plan, method: method, url: url, links: l };
      });
    },
    /* Member: "I have paid", with the 12-digit UPI reference / UTR from Paytm. */
    claim: function (id, txnRef) {
      txnRef = String(txnRef || '').trim().toUpperCase().slice(0, 40);
      if (txnRef.length < 6) return Promise.reject(new Error('Enter the reference number shown in Paytm after paying (usually 12 digits).'));
      return store.patch('payments', id, { status: 'claimed', txnRef: txnRef, claimedAt: nowIso() });
    },
    /* Admin: confirm against the Paytm statement. */
    setStatus: function (id, status) {
      if (PAY_STATUSES.indexOf(status) < 0) return Promise.reject(new Error('Bad status'));
      var patch = { status: status }; if (status === 'paid') patch.paidAt = nowIso();
      return store.patch('payments', id, patch);
    },
    remove: function (id) { return store.remove('payments', id); }
  };

  /* ====================================================================
     REFERRALS (from ?ref= links)
     ==================================================================== */
  var referral = {
    capture: function () {
      var m = window.location.search.match(/[?&]ref=([^&]+)/i);
      if (m) { var d = doctors.byRefCode(decodeURIComponent(m[1])); if (d) { try { sessionStorage.setItem(REF_KEY, d.refCode); } catch (e) {} return d; } }
      return referral.pending();
    },
    pending: function () { try { var c = sessionStorage.getItem(REF_KEY); return c ? doctors.byRefCode(c) : null; } catch (e) { return null; } },
    clear: function () { try { sessionStorage.removeItem(REF_KEY); } catch (e) {} },
    describe: function (r) {
      if (!r) return 'Not specified';
      if (r.type === 'doctor') { var d = doctors.get(r.doctorId); return d ? d.name : 'A NARI doctor'; }
      return r.label || 'Other';
    },
    linkFor: function (code) { return ROOT + 'member-login?ref=' + encodeURIComponent(code); }
  };

  /* ====================================================================
     STATS / FORMATTING
     ==================================================================== */
  var stats = {
    referralBreakdown: function () {
      var counts = {}; var total = 0;
      db.appointments.forEach(function (a) { var k = referral.describe(a.referredBy); counts[k] = (counts[k] || 0) + 1; total++; });
      return { total: total, rows: Object.keys(counts).map(function (k) { return { label: k, count: counts[k] }; }).sort(function (a, b) { return b.count - a.count; }) };
    },
    countBy: function (status) { return db.appointments.filter(function (a) { return a.status === status; }).length; }
  };

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var fmt = {
    /* 'YYYY-MM-DD' or a full ISO timestamp (shown as the local calendar day) → '1 Oct 2026'. */
    date: function (iso) {
      if (!iso) return '—';
      if (iso.length > 10) { var d = new Date(iso); if (!isNaN(d)) return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
      var p = iso.split('-'); return parseInt(p[2], 10) + ' ' + MONTHS[parseInt(p[1], 10) - 1] + ' ' + p[0];
    },
    dayMonth: function (iso) { var p = iso.split('-'); return { d: parseInt(p[2], 10), m: MONTHS[parseInt(p[1], 10) - 1] }; },
    time: function (t) { if (!t) return ''; var h = parseInt(t.split(':')[0], 10); var m = t.split(':')[1]; var ap = h >= 12 ? 'PM' : 'AM'; h = h % 12; if (h === 0) h = 12; return h + ':' + m + ' ' + ap; },
    relative: function (iso) {
      var t = new Date(iso + 'T00:00:00'); var now = new Date(); now.setHours(0, 0, 0, 0);
      var diff = Math.round((t - now) / 86400000);
      if (diff === 0) return 'Today'; if (diff === 1) return 'Tomorrow'; if (diff === -1) return 'Yesterday';
      return diff > 0 ? 'In ' + diff + ' days' : Math.abs(diff) + ' days ago';
    },
    mode: function (id) { for (var i = 0; i < MODES.length; i++) if (MODES[i].id === id) return MODES[i]; return { id: id, label: id === 'whatsapp' ? 'WhatsApp consult' : (id || 'Consultation'), price: '', desc: '' }; },
    initials: function (name) { return String(name || '?').replace(/^dr\.?\s*/i, '').split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join(''); },
    phone: function (p) { p = normPhone(p); return p ? CC + ' ' + p.slice(0, 5) + ' ' + p.slice(5) : '—'; },
    status: function (s) { return s.charAt(0).toUpperCase() + s.slice(1); },
    firstName: function (name) { return String(name || '').trim().split(/\s+/)[0] || ''; },
    /* Full ISO timestamp → '12 Sep, 3:40 PM' plus a relative hint. */
    dateTime: function (iso) { var d = new Date(iso); if (isNaN(d)) return iso || '—'; var h = d.getHours(), ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return d.getDate() + ' ' + MONTHS[d.getMonth()] + ', ' + h + ':' + pad(d.getMinutes()) + ' ' + ap; },
    ago: function (iso) { var ms = Date.now() - new Date(iso).getTime(); if (isNaN(ms)) return ''; var m = Math.round(ms / 60000); if (m < 60) return m <= 1 ? 'just now' : m + ' min ago'; var h = Math.round(m / 60); if (h < 24) return h + ' hr ago'; var dd = Math.round(h / 24); return dd === 1 ? 'yesterday' : dd + ' days ago'; }
  };

  /* ====================================================================
     ACTIVITY — what happened, newest first, for the team console's bell
     Derived from the collections already in the cache (nothing extra is written), so it works the same
     in demo and live mode. Each admin's "seen up to" marker is notifSeenAt on her staff record.
     ==================================================================== */
  var activity = {
    list: function (limit) {
      var ev = [];
      function add(e) { if (e.ts) ev.push(e); }
      /* Saved by an admin while viewing as the member or doctor ("View as" in the console). */
      function by(o) { return o && o.byAdmin ? ' · by ' + o.byAdmin + ' (admin)' : ''; }
      function changedBy(o) { return o && o.updatedByAdmin ? ' · by ' + o.updatedByAdmin + ' (admin)' : ''; }
      db.leads.forEach(function (l) {
        add({ id: 'lead:' + l.id, type: 'lead', ts: tsOf(l.createdAt), icon: 'phone', tab: 'leads', title: 'New enquiry from ' + (l.name || 'someone'), body: (l.concern || 'General') + ' · ' + (leads.TIMES[l.time] || l.time || '') + ' · ' + leads.sourceOf(l), urgent: l.status === 'new' });
      });
      db.payments.forEach(function (p) {
        var who = p.memberName || MEMBER, amt = payments.rupees(p.amount);
        add({ id: 'pay:' + p.id, type: 'payment', ts: tsOf(p.createdAt), icon: 'shieldCheck', tab: 'payments', title: who + ' started a payment of ' + amt, body: p.planLabel + (p.status === 'initiated' ? ' · not completed yet' : '') + by(p) });
        if (p.claimedAt || p.status === 'claimed') add({ id: 'pay:' + p.id + ':claimed', type: 'payment', ts: tsOf(p.claimedAt || p.createdAt), icon: 'shieldCheck', tab: 'payments', title: who + ' paid ' + amt + ' — verify it', body: p.planLabel + ' · UPI ref ' + (p.txnRef || '—') + (p.status === 'claimed' ? ' · check Paytm and mark Paid' + changedBy(p) : ' · ' + p.status), urgent: p.status === 'claimed' });
      });
      db.appointments.forEach(function (a) {
        var d = a.doctorId ? byId(db.doctors, a.doctorId) : null;
        add({ id: 'apt:' + a.id, type: 'booking', ts: tsOf(a.createdAt), icon: 'calendar', tab: 'appointments', title: (a.memberName || MEMBER) + ' requested a consultation', body: a.category + ' · ' + fmt.date(a.date) + ', ' + fmt.time(a.time) + (d ? ' with ' + d.name : ' · expert to be matched') + by(a), urgent: a.status === 'pending' });
        if (a.status === 'cancelled' && a.cancelledAt) add({ id: 'apt:' + a.id + ':cancelled', type: 'booking', ts: tsOf(a.cancelledAt), icon: 'x', tab: 'appointments', title: 'Consultation cancelled — ' + (a.memberName || MEMBER), body: a.category + ' · ' + fmt.date(a.date) + ', ' + fmt.time(a.time) + changedBy(a) });
      });
      db.members.forEach(function (m) {
        var ref = m.referredByDoctorId ? byId(db.doctors, m.referredByDoctorId) : null;
        add({ id: 'mem:' + m.id, type: 'member', ts: tsOf(m.createdAt), icon: 'user', tab: 'members', title: (m.name || 'A new ' + MEMBER.toLowerCase()) + ' signed up', body: fmt.phone(m.phone) + (m.city ? ' · ' + m.city : '') + (ref ? ' · referred by ' + ref.name : '') });
      });
      db.invites.forEach(function (i) {
        var d = byId(db.doctors, i.doctorId);
        add({ id: 'inv:' + i.id, type: 'member', ts: tsOf(i.createdAt), icon: 'users', tab: 'members', title: (d ? d.name : 'A doctor') + ' added ' + (i.name || 'a ' + MEMBER.toLowerCase()), body: fmt.phone(i.phone) + (i.city ? ' · ' + i.city : '') + (i.note ? ' · “' + i.note + '”' : '') + by(i) });
      });
      db.doctors.forEach(function (d) {
        add({ id: 'doc:' + d.id, type: 'doctor', ts: tsOf(d.createdAt), icon: 'stethoscope', tab: 'doctors', title: d.name + ' added to the panel', body: d.role + ' · referral code ' + d.refCode });
      });
      db.staff.forEach(function (s) {
        if (s.role !== 'doctor' || !s.firstLoginAt) return;
        var d = byId(db.doctors, s.doctorId);
        add({ id: 'docin:' + s.email, type: 'doctor', ts: tsOf(s.firstLoginAt), icon: 'stethoscope', tab: 'doctors', title: (d ? d.name : s.name || s.email) + ' signed in for the first time', body: 'Doctor panel · ' + s.email });
      });
      ev.sort(function (a, b) { return b.ts - a.ts; });
      return limit ? ev.slice(0, limit) : ev;
    },
    seenAt: function (email) { var s = staffByEmail(email); return s && s.notifSeenAt ? tsOf(s.notifSeenAt) : 0; },
    /* Written directly rather than through the store: it is bookkeeping, not a change others should be alerted to,
       and a permission error here (rules not yet published) gets one specific hint instead of a generic toast. */
    markSeen: function (email) {
      var s = staffByEmail(email); if (!s) return Promise.resolve();
      s.notifSeenAt = nowIso();
      if (!LIVE) { demoStore.save(); return Promise.resolve(); }
      return fs.collection('staff').doc(normEmail(email)).update({ notifSeenAt: s.notifSeenAt }).catch(function () {
        if (!activity._warned) { activity._warned = true; fail('Notifications cannot be marked as read yet: publish the latest firestore.rules (GO-LIVE.md step 5).'); }
      });
    },
    unread: function (email, list) { var seen = activity.seenAt(email); return (list || activity.list()).filter(function (e) { return e.ts > seen; }).length; }
  };

  /* ====================================================================
     PUSH — device notifications for the team (Firebase Cloud Messaging)
     The browser saves its FCM token under pushTokens/{token}; the Cloud Function in functions/index.js
     sends to every admin token when a lead, payment, booking, member or doctor is written. Needs
     push.vapidKey in portal-config.js and the function deployed (GO-LIVE.md → Push notifications).
     Without those, "Enable alerts" falls back to plain browser notifications while the console is open.
     ==================================================================== */
  var PUSH_KEY = 'nari_portal_push';
  var push = {
    configured: function () { return LIVE && !!(CFG.push && CFG.push.vapidKey); },
    supported: function () { return 'Notification' in window && 'serviceWorker' in navigator; },
    permission: function () { return push.supported() ? Notification.permission : 'unsupported'; },
    /* The FCM token saved on this device (background push), or null when only tab alerts are on. */
    device: function () { return read(PUSH_KEY); },
    enable: function (user, role) {
      if (!push.supported()) return Promise.resolve({ ok: false, error: 'This browser cannot show notifications.' + (/iPhone|iPad/.test(navigator.userAgent) ? ' On iPhone, add the console to your Home Screen first (Share → Add to Home Screen) and open it from there.' : '') });
      return Promise.resolve(Notification.requestPermission()).then(function (perm) {
        if (perm !== 'granted') return { ok: false, error: perm === 'denied' ? 'Notifications are blocked for this site. Allow them in the browser\'s site settings, then try again.' : 'Notifications were not allowed.' };
        if (!push.configured()) return { ok: true, mode: 'tab' };
        var base = 'https://www.gstatic.com/firebasejs/' + (CFG.firebaseVersion || '10.14.1') + '/';
        return loadScript(base + 'firebase-messaging-compat.js')
          .then(function () { return navigator.serviceWorker.register(ROOT + 'firebase-messaging-sw.js'); })
          .then(function (reg) { return fb.messaging().getToken({ vapidKey: CFG.push.vapidKey, serviceWorkerRegistration: reg }); })
          .then(function (token) {
            if (!token) throw new Error('No device token was issued.');
            var doc = { id: token, token: token, email: normEmail(user.email), role: role || 'admin', name: user.name || '', device: deviceLabel(), createdAt: nowIso(), updatedAt: nowIso() };
            return fs.collection('pushTokens').doc(token).set(doc).then(function () { write(PUSH_KEY, { token: token, at: nowIso() }); return { ok: true, mode: 'push' }; });
          })
          .catch(function (e) { return { ok: false, error: friendlyPushError(e) }; });
      });
    },
    disable: function () {
      var rec = read(PUSH_KEY); remove(PUSH_KEY);
      if (!rec || !LIVE) return Promise.resolve({ ok: true });
      return fs.collection('pushTokens').doc(rec.token).delete().catch(function () {})
        .then(function () { try { return fb.messaging().deleteToken(); } catch (e) { return null; } })
        .then(function () { return { ok: true }; }, function () { return { ok: true }; });
    },
    /* Tokens rotate now and then; refresh the saved one at most once a day. */
    refresh: function (user, role) {
      var rec = read(PUSH_KEY);
      if (!rec || !push.configured() || push.permission() !== 'granted') return Promise.resolve();
      if (rec.at && Date.now() - tsOf(rec.at) < 86400e3) return Promise.resolve();
      return push.enable(user, role).then(function (r) {
        var now = read(PUSH_KEY);
        if (r.ok && r.mode === 'push' && now && now.token !== rec.token) fs.collection('pushTokens').doc(rec.token).delete().catch(function () {});
      });
    },
    /* Admin view: every device that has enabled push, and removing one (e.g. a lost phone). */
    devices: function () { return (db.pushTokens || []).slice().sort(function (a, b) { return (a.updatedAt || '') < (b.updatedAt || '') ? 1 : -1; }); },
    forget: function (token) { return store.remove('pushTokens', token).then(function () { var rec = read(PUSH_KEY); if (rec && rec.token === token) remove(PUSH_KEY); }); }
  };
  function deviceLabel() {
    var ua = navigator.userAgent;
    var os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'device';
    var br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    return br + ' on ' + os;
  }
  function friendlyPushError(e) {
    var code = e && e.code || '', m = e && e.message || 'Could not enable notifications.';
    if (/unsupported-browser/.test(code)) return 'This browser does not support push notifications.';
    if (/vapid|applicationServerKey/i.test(m)) return 'The Web Push key in portal-config.js (push.vapidKey) does not look right.';
    if (/service ?worker/i.test(m) && /404|script|mime/i.test(m)) return 'firebase-messaging-sw.js was not found at the site root.';
    if (/permission-blocked|notifications-blocked/.test(code)) return 'Notifications are blocked for this site in the browser settings.';
    if (/permission-denied|insufficient permissions/i.test(code + ' ' + m)) return 'Publish the latest firestore.rules first (GO-LIVE.md step 5), then try again.';
    return m + (code ? ' (' + code + ')' : '');
  }

  /* ====================================================================
     CYCLES — period tracker for members on a paid plan
     One document per member, cycles/{uid}: { periods: [{start, end}], logs: {date: {flow, symptoms, note}},
     cycleLength, updatedAt }. Only the member can read or write it (firestore.rules); admins can only
     delete it along with her account. Predictions are plain averages: not medical advice, not contraception.
     ==================================================================== */
  var SYMPTOMS = ['Cramps', 'Headache', 'Bloating', 'Low mood', 'Tired', 'Acne', 'Tender breasts', 'Back pain', 'Nausea', 'Cravings'];
  var FLOWS = [{ id: 'spotting', label: 'Spotting' }, { id: 'light', label: 'Light' }, { id: 'medium', label: 'Medium' }, { id: 'heavy', label: 'Heavy' }];
  var MAX_PERIODS = 120, MAX_LOGS = 400;
  function mean(list) { return list.length ? list.reduce(function (s, n) { return s + n; }, 0) / list.length : 0; }
  var cycles = {
    SYMPTOMS: SYMPTOMS, FLOWS: FLOWS,
    get: function (mid) { return byId(db.cycles, mid) || { id: mid, memberId: mid, periods: [], logs: {}, cycleLength: null }; },
    save: function (mid, doc) {
      doc.id = mid; doc.memberId = mid; doc.updatedAt = nowIso();
      doc.periods = (doc.periods || []).filter(function (p) { return p && /^\d{4}-\d{2}-\d{2}$/.test(p.start); })
        .sort(function (a, b) { return a.start < b.start ? -1 : 1; }).slice(-MAX_PERIODS);
      doc.logs = doc.logs || {};
      var keys = Object.keys(doc.logs).sort(); while (keys.length > MAX_LOGS) delete doc.logs[keys.shift()];
      return store.put('cycles', mid, doc).then(function () { return doc; });
    },
    /* The logged period covering a date. With `open`, an unfinished period counts up to its expected end. */
    periodOn: function (doc, date, open, avgPeriod) {
      for (var i = doc.periods.length - 1; i >= 0; i--) {
        var p = doc.periods[i]; if (date < p.start) continue;
        var end = p.end || (open ? addDays(p.start, (avgPeriod || 5) - 1) : p.start);
        if (date <= end) return p;
      }
      return null;
    },
    /* "My period started on <date>". Ignored if that day is already inside a logged period. */
    startPeriod: function (mid, date) {
      var doc = clone(cycles.get(mid)); date = date || todayIso();
      if (date > todayIso()) return Promise.reject(new Error('That day has not come yet.'));
      if (cycles.periodOn(doc, date, true)) return Promise.resolve(doc);
      var last = doc.periods[doc.periods.length - 1];
      if (last && !last.end && diffDays(date, last.start) > 0 && diffDays(date, last.start) <= 10) return Promise.resolve(doc);
      doc.periods.push({ start: date, end: null });
      return cycles.save(mid, doc);
    },
    /* "My period ended on <date>": closes the most recent period that started on or before that day. */
    endPeriod: function (mid, date) {
      var doc = clone(cycles.get(mid)); date = date || todayIso();
      var p = null; doc.periods.forEach(function (x) { if (x.start <= date && (!p || x.start > p.start)) p = x; });
      if (!p) return Promise.reject(new Error('Mark the day your period started first.'));
      if (diffDays(date, p.start) > 14) return Promise.reject(new Error('That is more than two weeks after it started. Mark a new period start instead.'));
      p.end = date;
      return cycles.save(mid, doc);
    },
    removePeriod: function (mid, start) { var doc = clone(cycles.get(mid)); doc.periods = doc.periods.filter(function (p) { return p.start !== start; }); return cycles.save(mid, doc); },
    /* Daily note: { flow, symptoms[], note }. An empty entry removes the day. */
    log: function (mid, date, entry) {
      var doc = clone(cycles.get(mid));
      var e = { flow: FLOWS.some(function (f) { return f.id === entry.flow; }) ? entry.flow : '', symptoms: (entry.symptoms || []).filter(function (s) { return SYMPTOMS.indexOf(s) >= 0; }), note: String(entry.note || '').trim().slice(0, 200) };
      if (!e.flow && !e.symptoms.length && !e.note) delete doc.logs[date]; else doc.logs[date] = e;
      return cycles.save(mid, doc);
    },
    /* A member who knows her usual cycle can set it; otherwise the average of her logged cycles is used. */
    setCycleLength: function (mid, n) { var doc = clone(cycles.get(mid)); n = parseInt(n, 10); doc.cycleLength = n >= 15 && n <= 60 ? n : null; return cycles.save(mid, doc); },
    stats: function (doc, today) {
      today = today || todayIso();
      var ps = doc.periods.slice().sort(function (a, b) { return a.start < b.start ? -1 : 1; });
      var lens = []; for (var i = 1; i < ps.length; i++) { var d = diffDays(ps[i].start, ps[i - 1].start); if (d >= 15 && d <= 60) lens.push(d); }
      var recent = lens.slice(-6);
      var avgCycle = doc.cycleLength || (recent.length ? Math.round(mean(recent)) : 28);
      var plens = ps.filter(function (p) { return p.end; }).map(function (p) { return diffDays(p.end, p.start) + 1; }).filter(function (n) { return n >= 1 && n <= 14; }).slice(-6);
      var avgPeriod = plens.length ? Math.round(mean(plens)) : 5;
      var last = ps.length ? ps[ps.length - 1] : null;
      var s = { periods: ps, count: ps.length, cycleLengths: lens, avgCycle: avgCycle, avgPeriod: avgPeriod, auto: !doc.cycleLength && recent.length > 0,
        regular: recent.length >= 3 && Math.max.apply(null, recent) - Math.min.apply(null, recent) <= 7,
        last: last, cycleDay: null, phase: null, nextStart: null, daysToNext: null, late: 0, ovulation: null, fertile: null, predicted: [] };
      if (!last) return s;
      s.cycleDay = diffDays(today, last.start) + 1;
      var next = addDays(last.start, avgCycle);
      /* Long gaps without logging: roll the prediction forward instead of showing weeks of "late". */
      while (diffDays(today, next) > avgCycle) next = addDays(next, avgCycle);
      s.nextStart = next; s.daysToNext = diffDays(next, today); s.late = s.daysToNext < 0 ? -s.daysToNext : 0;
      s.ovulation = addDays(next, -14); s.fertile = { start: addDays(s.ovulation, -5), end: addDays(s.ovulation, 1) };
      var inPeriod = !!cycles.periodOn(doc, today, true, avgPeriod);
      s.phase = inPeriod ? 'period' : s.late > 14 ? 'stale' : s.late ? 'late' : (today >= s.fertile.start && today <= s.fertile.end) ? 'fertile' : today > s.fertile.end ? 'luteal' : 'follicular';
      for (var k = 0; k < 3; k++) { var st = addDays(next, k * avgCycle), ov = addDays(st, -14); s.predicted.push({ start: st, end: addDays(st, avgPeriod - 1), ovulation: ov, fertileStart: addDays(ov, -5), fertileEnd: addDays(ov, 1) }); }
      return s;
    },
    /* Everything the calendar needs for one day. */
    dayInfo: function (doc, s, date) {
      var p = cycles.periodOn(doc, date, true, s.avgPeriod);
      var info = { period: !!p, start: !!p && p.start === date, open: !!p && !p.end, periodStart: p ? p.start : null, predicted: false, fertile: false, ovulation: false, log: doc.logs[date] || null };
      if (!p) s.predicted.forEach(function (c) { if (date >= c.start && date <= c.end) info.predicted = true; if (date >= c.fertileStart && date <= c.fertileEnd) info.fertile = true; if (date === c.ovulation) info.ovulation = true; });
      return info;
    },
    /* Plain-text summary a member can paste to her expert. */
    summary: function (member, doc, s) {
      var lines = ['NARI Health — cycle summary for ' + (member.name || MEMBER) + ' (' + fmt.date(todayIso()) + ')'];
      if (!s.last) { lines.push('No periods logged yet.'); return lines.join('\n'); }
      lines.push('Last period started: ' + fmt.date(s.last.start) + ' (' + fmt.relative(s.last.start).toLowerCase() + ')' + (s.last.end ? ', ended ' + fmt.date(s.last.end) : ', ongoing'));
      lines.push('Average cycle: ' + s.avgCycle + ' days' + (s.cycleLengths.length >= 3 ? (s.regular ? ' (fairly regular)' : ' (varies)') : '') + ' · Average period: ' + s.avgPeriod + ' days');
      if (s.count >= 2) lines.push('Next period expected: ' + fmt.date(s.nextStart));
      if (s.cycleLengths.length) lines.push('Recent cycles: ' + s.cycleLengths.slice(-6).reverse().join(', ') + ' days');
      var counts = {}; Object.keys(doc.logs).sort().slice(-60).forEach(function (d) { (doc.logs[d].symptoms || []).forEach(function (x) { counts[x] = (counts[x] || 0) + 1; }); });
      var top = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 5).map(function (k) { return k + ' (' + counts[k] + ')'; });
      if (top.length) lines.push('Symptoms noted in the last 60 days: ' + top.join(', '));
      return lines.join('\n');
    }
  };

  /* ====================================================================
     DEV — figures and checks for the developer page (admin/dev)
     ==================================================================== */
  var dev = {
    /* Daily traffic rows for the last `days` days, oldest first (see traffic.js for the shape). In demo mode with
       nothing counted yet, a made-up month is returned (flagged sample: true) so the page can be tried. */
    traffic: function (days) {
      var since = daysFromToday(-(days - 1));
      if (!LIVE) {
        var all = read('nari_traffic') || {};
        var rows = Object.keys(all).filter(function (k) { return k >= since; }).sort().map(function (k) { return all[k]; });
        return Promise.resolve(rows.length ? rows : sampleTraffic(days));
      }
      return fs.collection('traffic').where('day', '>=', since).get().then(function (q) {
        var out = []; q.forEach(function (d) { out.push(d.data()); });
        return out.sort(function (a, b) { return a.day < b.day ? -1 : 1; });
      });
    },
    /* Reads one document from collections the console needs; 'denied' means the published rules are older than the code. */
    probe: function () {
      if (!LIVE) return Promise.resolve({ mode: 'demo' });
      function test(coll) { return fs.collection(coll).limit(1).get().then(function () { return 'ok'; }, function (e) { return /permission|insufficient/i.test((e && e.code) + ' ' + (e && e.message)) ? 'denied' : 'error'; }); }
      return Promise.all([test('leads'), test('payments'), test('pushTokens'), test('traffic')]).then(function (r) { return { mode: 'live', leads: r[0], payments: r[1], pushTokens: r[2], traffic: r[3] }; });
    },
    serviceWorker: function () {
      if (!('serviceWorker' in navigator)) return Promise.resolve(null);
      return navigator.serviceWorker.getRegistration(ROOT).then(function (r) { return r ? { scope: r.scope, active: !!r.active, script: (r.active || r.installing || r.waiting || {}).scriptURL || '' } : null; }, function () { return null; });
    }
  };
  function sampleTraffic(days) {
    var pages = ['home', 'physiotherapy_noida', 'physiotherapy_bulandshahr', 'womens_health_near_me', 'female_physiotherapist_near_me', 'physiotherapy_delhi_ncr'];
    var sources = ['direct', 'instagram_com', 'google_com', 'l_instagram_com', 'whatsapp'];
    var out = [];
    for (var i = days - 1; i >= 0; i--) {
      var day = daysFromToday(-i), seed = parseInt(day.replace(/-/g, ''), 10) % 97;
      var views = 40 + (seed * 7) % 60 + (i % 7 === 5 || i % 7 === 6 ? 25 : 0), visitors = Math.round(views * 0.62);
      var t = { day: day, views: views, visitors: visitors, pages: {}, sources: {}, devices: { mobile: Math.round(views * 0.78), desktop: Math.round(views * 0.22) }, hours: {}, campaigns: { diwali_offer: Math.round(visitors * 0.1) }, sample: true };
      pages.forEach(function (p, k) { t.pages[p] = Math.round(views * [0.46, 0.14, 0.12, 0.11, 0.1, 0.07][k]); });
      sources.forEach(function (s, k) { t.sources[s] = Math.round(visitors * [0.38, 0.3, 0.2, 0.07, 0.05][k]); });
      for (var h = 8; h < 23; h++) t.hours['h' + h] = Math.round(views * (h >= 18 && h <= 21 ? 0.11 : 0.045));
      out.push(t);
    }
    return out;
  }

  /* ====================================================================
     READY — the one entry point pages use
     ==================================================================== */
  /* ready(role, opts): resolves with the user for that role (after loading their data), or redirects to the login page and resolves null.
       opts.next — page (in the role's folder) to return to after login; defaults to the role's home.
     ready(): resolves { role, user } if anyone is signed in for the remembered role, else null. Does not redirect. */
  function ready(role, opts) {
    opts = opts || {};
    var asId = asParam(role);
    return init().then(function () {
      if (asId) return readyAs(role, asId, opts).then(function (u) { return u === undefined ? readyNormal(role, opts) : u; });
      return readyNormal(role, opts);
    });
  }
  /* member?as=<uid> or doctor/panel?as=<doctorId>. Only ids in the shape we create are accepted. */
  function asParam(role) {
    if (role !== 'member' && role !== 'doctor') return '';
    var m = global.location.search.match(/[?&]as=([^&]+)/); var v = m ? decodeURIComponent(m[1]) : '';
    return /^[A-Za-z0-9_-]{3,64}$/.test(v) ? v : '';
  }
  /* "View as": the signed-in admin sees the page exactly as that member or doctor would, and acts for them.
     Resolves undefined when the visitor is not an admin, so the page then loads normally for whoever is signed in. */
  function readyAs(role, id, opts) {
    return resolveRole('admin').then(function (r) {
      if (r.status !== 'ok') return undefined;
      var admin = r.user;
      write('nari_portal_role', 'admin');
      var target = role === 'member' ? { id: id } : { id: id };
      return (LIVE ? loadLive(role, target, true) : Promise.resolve()).then(function () {
        if (role === 'doctor') return byId(db.doctors, id);
        return LIVE ? fbGet('members', id) : byId(db.members, id);
      }).then(function (t) {
        if (!t) {
          fail('No ' + (role === 'member' ? MEMBER.toLowerCase() : 'doctor') + ' with id ' + id + '. Go back to the console and try again.');
          document.body.classList.remove('loading');
          if (global.NariLoader) global.NariLoader.hide();
          return null;
        }
        if (role === 'member') { t.id = id; if (!byId(db.members, id)) db.members.push(t); }
        if (role === 'doctor' && !t.email) t.email = doctors.emailOf(id) || '';
        viewAs = { admin: admin, role: role, target: t };
        global.NariPortal.viewAs = viewAs;
        return t;
      });
    });
  }
  function readyNormal(role, opts) {
    return Promise.resolve().then(function () {
      if (!role) {
        var hint = LIVE ? (read('nari_portal_role') || 'member') : (read(SESSION_KEY) || {}).role;
        if (!hint) return null;
        return resolveRole(hint).then(function (r) { return r.status === 'ok' ? { role: hint, user: r.user } : null; });
      }
      return resolveRole(role).then(function (r) {
        if (r.status !== 'ok') {
          var back = r.status === 'denied' ? '&error=' + encodeURIComponent(r.error) : '';
          if (r.status === 'denied' && LIVE) fb.auth().signOut();
          window.location.replace(auth.loginPage(role) + '?next=' + encodeURIComponent(opts.next || (PAGES[role] || PAGES.member).home.split('/').pop()) + back);
          return null;
        }
        write('nari_portal_role', role);
        return (LIVE ? loadLive(role, r.user) : Promise.resolve()).catch(function (e) {
          /* Show the problem on the page instead of an endless loader, then stop. */
          var m = e && e.message || 'Could not load your data.';
          if (/insufficient permissions|permission-denied/i.test(m)) m = 'Your account is fine, but the database rules are out of date: publish the latest firestore.rules in the Firebase console (GO-LIVE.md step 5), then reload.';
          fail(m);
          document.body.classList.remove('loading');
          if (global.NariLoader) global.NariLoader.hide(); else { var l = document.getElementById('loader'); if (l) l.remove(); }
          throw e;
        }).then(function () {
          /* Members never read the members collection, so keep their own profile in the cache for bookings. */
          if (LIVE && role === 'member' && !byId(db.members, r.user.id)) db.members.push(r.user);
          if (role === 'member') return invites.claimFor(r.user).then(function () { return r.user; }, function () { return r.user; });
          return r.user;
        });
      });
    });
  }
  /* Login pages: make sure the cache (doctors for referral codes) is loaded without requiring a session. */
  function readyPublic() { return init().then(function () { return LIVE ? loadLive(null).catch(function (e) { fail(e && e.message); return null; }) : null; }); }
  function subscribe(fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; }

  function resetDemo() { if (LIVE) return; db = seedDB(); write(DB_KEY, db); remove(SESSION_KEY); remove(PENDING_KEY); }
  function exportJSON() { return JSON.stringify(db, null, 2); }
  function waLink(text) { return 'https://wa.me/' + WA_NUMBER + (text ? '?text=' + encodeURIComponent(text) : ''); }

  global.NariPortal = {
    isLive: LIVE, CONFIG: CFG, MEMBER: MEMBER, MEMBERS: MEMBERS,
    CATEGORIES: CATEGORIES, MODES: MODES, SOURCES: SOURCES, SLOTS: SLOTS, STATUSES: STATUSES,
    ready: ready, readyPublic: readyPublic, subscribe: subscribe,
    auth: auth, members: members, doctors: doctors, staff: staff, invites: invites, appointments: appointments, leads: leads, payments: payments, PLANS: PLANS, referral: referral, stats: stats, ROOT: ROOT, PAGES: PAGES,
    activity: activity, push: push, cycles: cycles, dev: dev, viewAs: null,
    fmt: fmt, today: todayIso, daysFromToday: daysFromToday, addDays: addDays, diffDays: diffDays, normPhone: normPhone, waLink: waLink,
    resetDemo: resetDemo, exportJSON: exportJSON, uid: uid, lastWriteAt: function () { return lastWrite; },
    _db: function () { return db; }, _notify: notify
  };
})(window);
