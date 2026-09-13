/* ===== NARI Health — "Get a free call back" lead form =====
   Runs on the public pages (no sign-in). Saves the enquiry to Firestore `leads/{id}` so it shows up in
   the team console → Enquiries. If Firebase is not configured or the save fails, it opens WhatsApp with
   the details pre-filled so no lead is lost. Loads the Firebase SDK only when the visitor starts typing. */
(function () {
  'use strict';
  var CFG = window.NARI_CONFIG || {};
  var LIVE = !!(CFG.firebase && CFG.firebase.apiKey && /^AIza/.test(CFG.firebase.apiKey));
  var WA = CFG.whatsapp || '916399507521';
  var CC = CFG.phoneCountryCode || '+91';
  var TIMES = [['morning', 'Morning', '9 am – 12 pm'], ['afternoon', 'Afternoon', '12 – 4 pm'], ['evening', 'Evening', '4 – 8 pm']];
  var CATS = (CFG.categories || ["Women's Health", 'PCOS', 'Pregnancy', 'Periods', 'Mental Health', 'Nutrition', 'Sleep', 'Menopause', 'General Health', 'Pelvic Health']).concat(['Physiotherapy / pain', 'Not sure yet']);

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function param(n) { var m = window.location.search.match(new RegExp('[?&]' + n + '=([^&]+)')); return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')).slice(0, 80) : ''; }
  function normPhone(p) { return String(p || '').replace(/\D/g, '').slice(-10); }
  function uid() { return 'lead_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); }
  function track(name, params) { try { if (window.gtag) window.gtag('event', name, params || {}); } catch (e) {} }

  /* Referral code in the URL (doctor shares narihealth.in/?ref=NH-SUDHA) is remembered for the session. */
  var ref = param('ref').toUpperCase();
  try { if (ref) sessionStorage.setItem('nari_portal_ref', ref); else ref = sessionStorage.getItem('nari_portal_ref') || ''; } catch (e) {}
  var utm = { source: param('utm_source'), medium: param('utm_medium'), campaign: param('utm_campaign') };

  /* ---- Firebase (loaded lazily) ---- */
  var fbLoading = null;
  function loadScript(src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = function () { rej(new Error('load failed')); }; document.head.appendChild(s); }); }
  function firestore() {
    if (!LIVE) return Promise.reject(new Error('demo'));
    if (!fbLoading) {
      var base = 'https://www.gstatic.com/firebasejs/' + (CFG.firebaseVersion || '12.18.0') + '/';
      fbLoading = (window.firebase ? Promise.resolve() : loadScript(base + 'firebase-app-compat.js')).then(function () {
        return window.firebase.firestore ? null : loadScript(base + 'firebase-firestore-compat.js');
      }).then(function () {
        if (!window.firebase.apps.length) window.firebase.initializeApp(CFG.firebase);
        return window.firebase.firestore();
      });
      fbLoading.catch(function () { fbLoading = null; });
    }
    return fbLoading;
  }
  function withTimeout(p, ms) { return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, ms); })]); }

  function saveLead(lead) {
    if (!LIVE) {
      /* Demo: keep it in this browser; the admin console (demo mode) reads it from here. */
      try { var list = JSON.parse(localStorage.getItem('nari_portal_leads') || '[]'); list.push(lead); localStorage.setItem('nari_portal_leads', JSON.stringify(list)); } catch (e) {}
      return Promise.resolve();
    }
    return withTimeout(firestore().then(function (fs) { return fs.collection('leads').doc(lead.id).set(lead); }), 9000);
  }

  function waText(lead) {
    var t = TIMES.filter(function (x) { return x[0] === lead.time; })[0];
    return 'Hi NARI Health, I\'d like a call back.\nName: ' + lead.name + '\nMobile: ' + CC + ' ' + lead.phone + '\nConcern: ' + lead.concern + '\nBest time: ' + (t ? t[1] + ' (' + t[2] + ')' : lead.time) + (lead.ref ? '\nReferral code: ' + lead.ref : '');
  }
  function waLink(text) { return 'https://wa.me/' + WA + '?text=' + encodeURIComponent(text); }

  /* ---- Markup ---- */
  function render(root) {
    var page = root.getAttribute('data-page') || 'home';
    var compact = root.hasAttribute('data-compact');
    root.className = 'lead-card' + (compact ? ' compact' : '');
    root.innerHTML =
      '<div class="lead-head">' +
        '<span class="lead-pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>Free call back</span>' +
        '<h3 class="lead-title">Tell us what\'s going on. We\'ll call you.</h3>' +
        '<p class="lead-sub">A NARI care coordinator calls within a few hours, helps you pick the right expert and books your slot. No sign-up, no payment until your consultation is confirmed.</p>' +
      '</div>' +
      '<form class="lead-form" novalidate>' +
        '<div class="lead-row two">' +
          '<label class="lead-field"><span>Your name</span><input type="text" name="name" autocomplete="name" placeholder="e.g. Ananya" maxlength="80" required></label>' +
          '<label class="lead-field"><span>Mobile number</span><span class="lead-phone"><em>' + esc(CC) + '</em><input type="tel" name="phone" inputmode="numeric" autocomplete="tel-national" placeholder="98765 43210" maxlength="12" required></span></label>' +
        '</div>' +
        '<label class="lead-field"><span>What do you need help with?</span><select name="concern" required><option value="" disabled selected>Choose one</option>' + CATS.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select></label>' +
        '<div class="lead-field"><span>Best time to call</span><div class="lead-times">' + TIMES.map(function (t, i) { return '<label><input type="radio" name="time" value="' + t[0] + '"' + (i === 0 ? ' checked' : '') + '><span><strong>' + t[1] + '</strong><small>' + t[2] + '</small></span></label>'; }).join('') + '</div></div>' +
        '<input type="text" name="website" tabindex="-1" autocomplete="off" class="lead-hp" aria-hidden="true">' +
        '<p class="lead-error" role="alert"></p>' +
        '<button type="submit" class="btn-pill full lead-btn">Get my free call back <svg class="arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button>' +
        '<p class="lead-fine">Or <a href="' + waLink('Hi NARI Health, I have a health question') + '" target="_blank" rel="noreferrer">WhatsApp us</a> · Prefer to book yourself? <a href="member-login.html">Sign in and book</a>. By submitting you agree to our <a href="privacy.html">Privacy Policy</a>.</p>' +
      '</form>';

    var form = root.querySelector('form'), err = root.querySelector('.lead-error'), btn = root.querySelector('.lead-btn');
    var phoneEl = form.elements.phone;
    phoneEl.addEventListener('input', function () { var v = phoneEl.value.replace(/\D/g, '').slice(0, 10); phoneEl.value = v.length > 5 ? v.slice(0, 5) + ' ' + v.slice(5) : v; });
    var warmed = false;
    form.addEventListener('focusin', function () { if (!warmed) { warmed = true; track('lead_form_start', { page: page }); if (LIVE) firestore().catch(function () {}); } });

    function showErr(m) { err.textContent = m || ''; err.classList.toggle('show', !!m); }
    form.addEventListener('submit', function (e) {
      e.preventDefault(); showErr('');
      if (form.elements.website.value) return; /* honeypot: bots fill hidden fields */
      var name = form.elements.name.value.trim(), phone = normPhone(phoneEl.value), concern = form.elements.concern.value;
      var time = (form.querySelector('input[name="time"]:checked') || {}).value || 'morning';
      if (name.length < 2) { showErr('Please tell us your name.'); form.elements.name.focus(); return; }
      if (!/^[6-9]\d{9}$/.test(phone)) { showErr('Enter a valid 10-digit Indian mobile number.'); phoneEl.focus(); return; }
      if (!concern) { showErr('Choose what you need help with, or pick "Not sure yet".'); form.elements.concern.focus(); return; }
      var lead = { id: uid(), name: name.slice(0, 80), phone: phone, concern: concern.slice(0, 60), time: time, page: page, ref: ref || '', utm: utm, status: 'new', createdAt: new Date().toISOString() };
      btn.disabled = true; var label = btn.innerHTML; btn.innerHTML = '<span class="lead-spin"></span>Sending…';
      saveLead(lead).then(function () {
        track('lead_submitted', { page: page, concern: concern, time: time, ref: ref || '(none)' });
        success(root, lead, false);
      }, function () {
        /* Could not save: hand the details to WhatsApp so the team still gets them. */
        track('lead_fallback_whatsapp', { page: page });
        success(root, lead, true);
        window.open(waLink(waText(lead)), '_blank', 'noopener');
      }).then(null, function () { btn.disabled = false; btn.innerHTML = label; showErr('Something went wrong. Please WhatsApp us instead.'); });
    });
  }

  function success(root, lead, viaWa) {
    var t = TIMES.filter(function (x) { return x[0] === lead.time; })[0];
    root.innerHTML =
      '<div class="lead-done">' +
        '<span class="lead-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' +
        '<h3 class="lead-title">Thank you, ' + esc(lead.name.split(/\s+/)[0]) + '.</h3>' +
        (viaWa
          ? '<p class="lead-sub">We opened WhatsApp with your details so the NARI team gets them right away. If it did not open, tap the button below.</p>'
          : '<p class="lead-sub">A NARI care coordinator will call <strong>' + esc(CC + ' ' + lead.phone.slice(0, 5) + ' ' + lead.phone.slice(5)) + '</strong> ' + (t ? 'in the <strong>' + t[1].toLowerCase() + '</strong> (' + t[2] + ')' : 'shortly') + ' about <strong>' + esc(lead.concern) + '</strong>. Save our number so you know it\'s us.</p>') +
        '<a class="btn-pill full lead-btn" target="_blank" rel="noreferrer" href="' + waLink(viaWa ? waText(lead) : 'Hi NARI Health, this is ' + lead.name + '. I just requested a call back about ' + lead.concern + '.') + '"><svg class="wa-icon sm" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.48-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35zM12.02 2C6.5 2 2.02 6.48 2.02 12c0 1.77.46 3.42 1.28 4.86L2 22l5.28-1.38A9.94 9.94 0 0 0 12.02 22c5.52 0 10-4.48 10-10s-4.48-10-10-10z"/></svg>' + (viaWa ? 'Send on WhatsApp' : 'Chat with us now on WhatsApp') + '</a>' +
        '<p class="lead-fine">In a hurry? <a href="member-login.html">Sign in and book a slot yourself</a>.</p>' +
      '</div>';
    root.classList.add('is-done');
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-lead-form]').forEach(render);
  });
})();
