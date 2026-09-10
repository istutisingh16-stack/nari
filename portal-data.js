/* ===== NARI Health — Portal data layer =====
   Every page reads and writes through `NariPortal`. Two backends live here:

   • DEMO  (NARI_CONFIG.firebase is null): localStorage in this browser only,
            one-time codes shown on screen, demo staff passwords. Safe to try.
   • LIVE  (NARI_CONFIG.firebase set):   Firebase Authentication (Google + phone
            OTP) and Cloud Firestore on the free Spark plan. Access is enforced
            by firestore.rules, not by this file.

   Pages call NariPortal.ready(role) and get a Promise for the signed-in user.
   After that every read is synchronous from an in-memory cache; writes update
   the cache immediately and persist in the background. */
(function (global) {
  'use strict';

  var CFG = global.NARI_CONFIG || {};
  /* Live only when the console-issued keys are actually filled in; empty or placeholder values keep demo mode. */
  var LIVE = !!(CFG.firebase && CFG.firebase.apiKey && CFG.firebase.appId && /^AIza/.test(CFG.firebase.apiKey) && /^1:/.test(CFG.firebase.appId));

  var DB_KEY = 'nari_portal_db_v2';
  var SESSION_KEY = 'nari_portal_session';
  var OTP_KEY = 'nari_portal_otp';
  var PENDING_KEY = 'nari_portal_pending';
  var REF_KEY = 'nari_portal_ref';

  var MEMBER = CFG.memberWord || 'Member';
  var MEMBERS = CFG.memberWordPlural || 'Members';
  var CATEGORIES = CFG.categories || ["Women's Health", 'PCOS', 'Pregnancy', 'Periods', 'Mental Health', 'Nutrition', 'Sleep', 'Menopause', 'General Health', 'Pelvic Health'];
  var MODES = CFG.modes || [
    { id: 'video', label: 'Video consultation', price: '₹499', desc: '25-minute private video call' },
    { id: 'clinic', label: 'Clinic visit', price: 'On request', desc: 'In person at a partner clinic' }
  ];
  var SOURCES = CFG.sources || ['Friend or family', 'Instagram', 'Google search', 'WhatsApp forward', 'Other'];
  var SLOTS = CFG.slots || ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
  var STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];
  var CC = CFG.phoneCountryCode || '+91';
  var WA_NUMBER = CFG.whatsapp || '916399507521';

  /* ---------- helpers ---------- */
  function uid(prefix) { return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function isoDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function daysFromToday(n) { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return isoDate(d); }
  function todayIso() { return daysFromToday(0); }
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
  var db = { doctors: [], staff: [], members: [], appointments: [] };
  var listeners = [];
  function notify() { listeners.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } }); }

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
      { id: 'mem_3', name: 'Kavita R.', phone: '9876501003', city: 'Jaipur', createdAt: daysFromToday(-30), provider: 'google', email: 'kavita.r@gmail.com' },
      { id: 'mem_4', name: 'Ananya Gupta', phone: '9876501004', city: 'Delhi', createdAt: daysFromToday(-22), provider: 'phone' },
      { id: 'mem_5', name: 'Meera Nair', phone: '9876501005', city: 'Kochi', createdAt: daysFromToday(-18), provider: 'google', email: 'meera.nair@gmail.com' },
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
    return { version: 2, seededAt: new Date().toISOString(), doctors: doctors, staff: staff, members: members, appointments: appointments };
  }

  /* ====================================================================
     STORE adapters — put / patch / remove for a collection
     ==================================================================== */
  var store, fb = null, fs = null;

  var demoStore = {
    init: function () {
      var saved = read(DB_KEY);
      if (!saved || saved.version !== 2) { saved = seedDB(); write(DB_KEY, saved); }
      db = saved;
      return Promise.resolve();
    },
    save: function () { write(DB_KEY, db); },
    put: function (coll, id, obj) { var list = db[coll]; var i = indexOf(list, coll, id); if (i >= 0) list[i] = obj; else list.push(obj); demoStore.save(); return Promise.resolve(); },
    patch: function (coll, id, patchObj) { var list = db[coll]; var i = indexOf(list, coll, id); if (i >= 0) { for (var k in patchObj) list[i][k] = patchObj[k]; } demoStore.save(); return Promise.resolve(); },
    remove: function (coll, id) { db[coll] = db[coll].filter(function (x) { return keyOf(coll, x) !== id; }); demoStore.save(); return Promise.resolve(); }
  };
  function keyOf(coll, x) { return coll === 'staff' ? x.email : x.id; }
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
      var list = db[coll]; var i = indexOf(list, coll, id); if (i >= 0) list[i] = obj; else list.push(obj);
      return fs.collection(coll).doc(id).set(clone(obj)).catch(function (e) { fail('Could not save: ' + e.message); throw e; });
    },
    patch: function (coll, id, patchObj) {
      var list = db[coll]; var i = indexOf(list, coll, id); if (i >= 0) for (var k in patchObj) list[i][k] = patchObj[k];
      return fs.collection(coll).doc(id).update(clone(patchObj)).catch(function (e) { fail('Could not save: ' + e.message); throw e; });
    },
    remove: function (coll, id) {
      db[coll] = db[coll].filter(function (x) { return keyOf(coll, x) !== id; });
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
  function docsOf(snap) { var out = []; snap.forEach(function (d) { var o = d.data(); if (!o.id) o.id = d.id; if (!o.email && d.ref.parent.id === 'staff') o.email = d.id; out.push(o); }); return out; }
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
  function loadLive(role, user) {
    unsubs.forEach(function (u) { u(); }); unsubs = []; liveSets = {};
    var jobs = [watch('doctors', fs.collection('doctors'))];
    if (role === 'member') jobs.push(watch('appointments:mine', fs.collection('appointments').where('memberId', '==', user.id)));
    if (role === 'doctor') {
      jobs.push(watch('appointments:doc', fs.collection('appointments').where('doctorId', '==', user.id)));
      jobs.push(watch('appointments:ref', fs.collection('appointments').where('referredDoctorId', '==', user.id)));
    }
    if (role === 'admin') {
      jobs.push(watch('appointments:all', fs.collection('appointments')));
      jobs.push(watch('members', fs.collection('members')));
      jobs.push(watch('staff', fs.collection('staff')));
    }
    if (!role) jobs.length = 1; /* login pages only need doctors for referral lookups */
    return Promise.all(jobs);
  }

  /* ====================================================================
     AUTH
     ==================================================================== */
  function authUserOf(u) {
    return { uid: u.uid, name: u.displayName || '', email: normEmail(u.email), phone: normPhone(u.phoneNumber), photo: u.photoURL || '', provider: u.phoneNumber && !u.email ? 'phone' : 'google' };
  }
  function currentAuthUser() { return LIVE ? fb.auth().currentUser : read(PENDING_KEY); }
  function waitForAuth() {
    return new Promise(function (resolve) {
      var un = fb.auth().onAuthStateChanged(function (u) { un(); resolve(u); });
    });
  }
  function fbGet(coll, id) { return fs.collection(coll).doc(id).get().then(function (d) { if (!d.exists) return null; var o = d.data(); if (!o.id && coll !== 'staff') o.id = d.id; if (coll === 'staff') o.email = d.id; return o; }); }

  /* Resolve who the signed-in person is for a given role.
     → { status: 'ok', user }            signed in and allowed
     → { status: 'new', authUser }       signed in but no member profile yet (members only)
     → { status: 'none' }                not signed in
     → { status: 'denied', error }       signed in but not on the panel / team */
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
        return fbGet('members', u.uid).then(function (m) {
          if (m) { m.id = u.uid; if (!m.img && au.photo) m.img = au.photo; return { status: 'ok', user: m }; }
          return { status: 'new', authUser: au };
        });
      }
      if (!au.email) return { status: 'denied', error: 'Staff sign in with a Google account. Phone sign-in is for ' + MEMBERS.toLowerCase() + '.' };
      return fbGet('staff', au.email).then(function (st) {
        if (!st || st.role !== role) return { status: 'denied', error: au.email + ' is not registered as ' + (role === 'admin' ? 'a NARI admin' : 'a panel doctor') + '. Ask the NARI team to add you.' };
        if (role === 'admin') return { status: 'ok', user: { id: au.email, name: st.name || au.name || 'NARI admin', email: au.email, img: au.photo, role: 'admin' } };
        return fbGet('doctors', st.doctorId).then(function (d) {
          if (!d) return { status: 'denied', error: 'Your doctor profile is missing. Ask the NARI team to check the panel.' };
          if (!d.active) return { status: 'denied', error: 'This account has been paused. Contact the NARI admin.' };
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
    loginPage: function (role) { return role + '-login.html'; },
    homeFor: function (role) { return role + '.html'; },

    /* ---- Google ---- */
    signInWithGoogle: function (role) {
      return init().then(function () {
        if (!LIVE) {
          /* Demo: pretend a Google account came back. Members go to profile completion unless a demo member has this email. */
          var au = { uid: 'g_demo', name: 'Kavita R.', email: 'kavita.r@gmail.com', photo: '', provider: 'google', phone: '' };
          write(PENDING_KEY, au);
          if (role !== 'member') return { ok: false, error: 'In demo mode, staff sign in with the demo email and password below.' };
          var m = members.findByEmail(au.email);
          if (m) { auth.set('member', m.id); return { ok: true, status: 'ok', user: m }; }
          return { ok: true, status: 'new', authUser: au };
        }
        var provider = new fb.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        return fb.auth().signInWithPopup(provider).catch(function (e) {
          if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) return fb.auth().signInWithRedirect(provider).then(function () { return null; });
          throw e;
        }).then(function () { return resolveRole(role); }).then(function (r) {
          if (r.status === 'ok') return { ok: true, status: 'ok', user: r.user };
          if (r.status === 'new') return { ok: true, status: 'new', authUser: r.authUser };
          if (r.status === 'denied') { fb.auth().signOut(); return { ok: false, error: r.error }; }
          return { ok: false, error: 'Sign-in was cancelled.' };
        }).catch(function (e) { return { ok: false, error: friendlyAuthError(e) }; });
      });
    },

    /* ---- Phone OTP ---- */
    sendOtp: function (phone, buttonId) {
      phone = normPhone(phone);
      if (phone.length !== 10) return Promise.resolve({ ok: false, error: 'Enter a valid 10-digit mobile number.' });
      return init().then(function () {
        if (!LIVE) {
          var code = String(Math.floor(100000 + Math.random() * 900000));
          write(OTP_KEY, { phone: phone, code: code, exp: Date.now() + 5 * 60 * 1000 });
          return { ok: true, phone: phone, demoCode: code, isNew: !members.findByPhone(phone) };
        }
        if (!auth._recaptcha) auth._recaptcha = new fb.auth.RecaptchaVerifier(buttonId || 'sendBtn', { size: 'invisible' });
        return fb.auth().signInWithPhoneNumber(CC + phone, auth._recaptcha).then(function (confirmation) {
          auth._confirmation = confirmation;
          return { ok: true, phone: phone };
        }).catch(function (e) {
          try { auth._recaptcha.clear(); } catch (x) {} auth._recaptcha = null;
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
        var au = { uid: uid('mem'), name: '', email: '', phone: phone, photo: '', provider: 'phone' };
        write(PENDING_KEY, au);
        return Promise.resolve({ ok: true, status: 'new', authUser: au });
      }
      if (!auth._confirmation) return Promise.resolve({ ok: false, error: 'Request a new code first.' });
      return auth._confirmation.confirm(code).then(function () { return resolveRole('member'); }).then(function (r) {
        if (r.status === 'ok') return { ok: true, status: 'ok', user: r.user };
        if (r.status === 'new') return { ok: true, status: 'new', authUser: r.authUser };
        return { ok: false, error: 'Could not sign you in. Try again.' };
      }).catch(function (e) { return { ok: false, error: friendlyAuthError(e) }; });
    },

    /* ---- Demo-only staff password login ---- */
    loginStaff: function (role, email, password) {
      if (LIVE) return { ok: false, error: 'Use Google sign-in.' };
      var st = staffByEmail(email);
      if (!st || st.password !== password || st.role !== role) return { ok: false, error: 'Email or password is incorrect.' };
      if (role === 'doctor') { var d = byId(db.doctors, st.doctorId); if (!d) return { ok: false, error: 'Doctor profile missing.' }; if (!d.active) return { ok: false, error: 'This account has been paused. Contact the NARI admin.' }; auth.set('doctor', d.id); return { ok: true, user: d }; }
      auth.set('admin', st.email); return { ok: true, user: { id: st.email, name: st.name, email: st.email } };
    }
  };

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
      'auth/quota-exceeded': 'SMS limit reached for today. Try Google sign-in instead.',
      'auth/captcha-check-failed': 'Verification failed. Reload the page and try again.'
    };
    return map[c] || (e && e.message) || 'Something went wrong. Please try again.';
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
    /* Finishes sign-up for a freshly authenticated person. `o` = { name, city, phone } */
    completeProfile: function (o) {
      var au = currentAuthUser();
      if (!au) return Promise.reject(new Error('Not signed in.'));
      var id = LIVE ? au.uid : (au.uid || uid('mem'));
      var m = {
        id: id, name: String(o.name || au.displayName || au.name || '').trim(), phone: normPhone(o.phone || au.phoneNumber || au.phone),
        email: normEmail(au.email), city: String(o.city || '').trim(), img: au.photoURL || au.photo || '',
        provider: LIVE ? (au.phoneNumber && !au.email ? 'phone' : 'google') : (au.provider || 'phone'), createdAt: todayIso()
      };
      return store.put('members', id, m).then(function () { if (!LIVE) { remove(PENDING_KEY); auth.set('member', id); } return m; });
    },
    update: function (id, patch) { var m = byId(db.members, id); if (m) for (var k in patch) m[k] = patch[k]; return store.patch('members', id, patch).then(function () { return m; }); },
    remove: function (id) {
      var jobs = [store.remove('members', id)];
      db.appointments.filter(function (a) { return a.memberId === id; }).forEach(function (a) { jobs.push(store.remove('appointments', a.id)); });
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
      var d = { id: o.id || uid('doc'), name: String(o.name || '').trim(), role: String(o.role || '').trim(), exp: String(o.exp || '').trim(), refCode: o.refCode || code, active: true, img: o.img || '', categories: o.categories || [] };
      var st = { email: normEmail(o.email), role: 'doctor', doctorId: d.id, name: d.name };
      if (!LIVE) st.password = o.password || 'doctor123';
      return Promise.all([store.put('doctors', d.id, d), store.put('staff', st.email, st)]).then(function () { return d; });
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
    addAdmin: function (email, name) { var st = { email: normEmail(email), role: 'admin', name: String(name || '').trim() }; if (!LIVE) st.password = 'admin123'; return store.put('staff', st.email, st).then(function () { return st; }); },
    remove: function (email) { return store.remove('staff', normEmail(email)); }
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
      appointments.referredByDoctor(did).forEach(function (a) {
        var m = members.get(a.memberId); if (!m) return;
        if (!map[m.id]) map[m.id] = { member: m, appointments: [], firstReferred: a.createdAt, lastVisit: null };
        map[m.id].appointments.push(a);
        if (a.createdAt < map[m.id].firstReferred) map[m.id].firstReferred = a.createdAt;
        if (a.status === 'completed' && (!map[m.id].lastVisit || a.date > map[m.id].lastVisit)) map[m.id].lastVisit = a.date;
      });
      return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return a.firstReferred < b.firstReferred ? 1 : -1; });
    },
    create: function (o) {
      var m = members.get(o.memberId) || {};
      var r = o.referredBy || null;
      var a = {
        id: uid('apt'), memberId: o.memberId, memberName: m.name || '', memberPhone: m.phone || '', memberCity: m.city || '',
        doctorId: o.doctorId || null, category: o.category, mode: o.mode || MODES[0].id,
        date: o.date, time: o.time, notes: String(o.notes || '').trim(), status: 'pending',
        referredBy: r, referredDoctorId: r && r.type === 'doctor' ? r.doctorId : null, createdAt: todayIso()
      };
      return store.put('appointments', a.id, a).then(function () { return a; });
    },
    setStatus: function (id, status) { if (STATUSES.indexOf(status) < 0) return Promise.reject(new Error('Bad status')); return store.patch('appointments', id, { status: status }); },
    assignDoctor: function (id, doctorId) { return store.patch('appointments', id, { doctorId: doctorId || null }); },
    isPast: function (a) { return a.date < todayIso(); },
    isUpcoming: function (a) { return a.date >= todayIso() && (a.status === 'pending' || a.status === 'confirmed'); }
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
    linkFor: function (code) { var base = window.location.href.replace(/[^\/]*$/, ''); return base + 'member-login.html?ref=' + encodeURIComponent(code); }
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
    date: function (iso) { if (!iso) return '—'; var p = iso.split('-'); return parseInt(p[2], 10) + ' ' + MONTHS[parseInt(p[1], 10) - 1] + ' ' + p[0]; },
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
    firstName: function (name) { return String(name || '').trim().split(/\s+/)[0] || ''; }
  };

  /* ====================================================================
     READY — the one entry point pages use
     ==================================================================== */
  /* ready(role): resolves with the user for that role (after loading their data), or redirects to the login page and resolves null.
     ready(): resolves { role, user } if anyone is signed in for the remembered role, else null. Does not redirect. */
  function ready(role) {
    return init().then(function () {
      if (!role) {
        var hint = LIVE ? (read('nari_portal_role') || 'member') : (read(SESSION_KEY) || {}).role;
        if (!hint) return null;
        return resolveRole(hint).then(function (r) { return r.status === 'ok' ? { role: hint, user: r.user } : null; });
      }
      return resolveRole(role).then(function (r) {
        if (r.status !== 'ok') {
          var back = r.status === 'denied' ? '&error=' + encodeURIComponent(r.error) : '';
          if (r.status === 'denied' && LIVE) fb.auth().signOut();
          window.location.replace(auth.loginPage(role) + '?next=' + encodeURIComponent(auth.homeFor(role)) + back);
          return null;
        }
        write('nari_portal_role', role);
        return (LIVE ? loadLive(role, r.user) : Promise.resolve()).catch(function (e) {
          /* Show the problem on the page instead of an endless loader, then stop. */
          fail(e && e.message || 'Could not load your data.');
          document.body.classList.remove('loading'); var l = document.getElementById('loader'); if (l) l.remove();
          throw e;
        }).then(function () {
          /* Members never read the members collection, so keep their own profile in the cache for bookings. */
          if (LIVE && role === 'member' && !byId(db.members, r.user.id)) db.members.push(r.user);
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
    auth: auth, members: members, doctors: doctors, staff: staff, appointments: appointments, referral: referral, stats: stats,
    fmt: fmt, today: todayIso, daysFromToday: daysFromToday, normPhone: normPhone, waLink: waLink,
    resetDemo: resetDemo, exportJSON: exportJSON, uid: uid,
    _db: function () { return db; }
  };
})(window);
