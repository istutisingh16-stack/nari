/* ===== NARI Health — Portal shared UI helpers ===== */
(function (global) {
  'use strict';
  var NP = global.NariPortal;

  /* Escape user-supplied text before it goes into innerHTML. */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }

  /* ---------- Icons (Feather-style, stroke) ---------- */
  var I = {
    wrap: function (paths, cls) { return '<svg class="' + (cls || 'ic') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>'; },
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    shieldCheck: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    arrowLeft: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
    heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
    sparkle: '<path d="M12 3l1.9 5.8L19.7 11l-5.8 1.9L12 18.7l-1.9-5.8L4.3 11l5.8-1.9z"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    stethoscope: '<path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    video: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
    mapPin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    message: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
    home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    cloud: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>'
  };
  function icon(name, cls) { return I.wrap(I[name] || '', cls); }
  var WA_SVG = '<svg class="wa-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.48-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35zM12.02 2C6.5 2 2.02 6.48 2.02 12c0 1.77.46 3.42 1.28 4.86L2 22l5.28-1.38A9.94 9.94 0 0 0 12.02 22c5.52 0 10-4.48 10-10s-4.48-10-10-10z"/></svg>';
  var GOOGLE_SVG = '<svg class="g-icon" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
  var WA_URL = NP.waLink('') + '?text=';

  /* ---------- Toasts ---------- */
  var toastWrap = null;
  function toast(msg, type, ms) {
    if (!toastWrap) { toastWrap = el('div', 'toast-wrap'); toastWrap.setAttribute('role', 'status'); toastWrap.setAttribute('aria-live', 'polite'); document.body.appendChild(toastWrap); }
    var t = el('div', 'toast ' + (type || 'info'));
    t.innerHTML = icon(type === 'success' ? 'check' : type === 'error' ? 'alert' : 'info') + '<div>' + msg + '</div>';
    toastWrap.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(function () { t.remove(); }, 300); }, ms || 3800);
  }
  /* Background save failures from the data layer surface here. */
  global.addEventListener('nari:error', function (e) { toast(esc(e.detail && e.detail.message || 'Something went wrong.'), 'error', 6000); });

  /* ---------- Status badge ---------- */
  function statusBadge(s) {
    var ic = { pending: 'clock', confirmed: 'check', completed: 'shieldCheck', cancelled: 'x' }[s] || 'info';
    return '<span class="badge ' + esc(s) + '">' + icon(ic, '') + esc(NP.fmt.status(s)) + '</span>';
  }

  /* ---------- Avatar ---------- */
  function avatar(user, size) {
    var cls = 'avatar' + (size ? ' ' + size : '');
    if (user && user.img) return '<span class="' + cls + '"><img src="' + esc(user.img) + '" alt="" loading="lazy" referrerpolicy="no-referrer"></span>';
    return '<span class="' + cls + '">' + esc(NP.fmt.initials(user && user.name)) + '</span>';
  }

  /* ---------- Appointment card ---------- */
  /* opts: { who: 'member'|'doctor'|'admin', actions: fn(a) -> html string } */
  function apptCard(a, opts) {
    opts = opts || {};
    var dm = NP.fmt.dayMonth(a.date);
    var doc = a.doctorId ? NP.doctors.get(a.doctorId) : null;
    var mem = NP.members.get(a.memberId);
    var mode = NP.fmt.mode(a.mode);
    var past = NP.appointments.isPast(a);
    var forMember = opts.who === 'member';
    var title = forMember ? (doc ? doc.name : 'Expert to be matched') : (mem ? mem.name : 'Unknown ' + NP.MEMBER.toLowerCase());
    var subtitle = forMember ? (doc ? doc.role : 'NARI will match you with the right expert') : (doc ? 'with ' + doc.name : 'No expert assigned yet');
    var modeIc = a.mode === 'video' ? 'video' : a.mode === 'clinic' ? 'mapPin' : 'message';
    var refTxt = NP.referral.describe(a.referredBy);
    return '<article class="appt' + (past ? ' past' : '') + ' ' + esc(a.status) + '" data-id="' + esc(a.id) + '">' +
        '<div class="when"><span class="d">' + dm.d + '</span><span class="m">' + dm.m + '</span><span class="t">' + esc(NP.fmt.time(a.time)) + '</span></div>' +
        '<div class="body">' +
          '<div class="top"><span class="title">' + esc(title) + '</span>' + statusBadge(a.status) + '</div>' +
          '<div class="meta">' +
            '<span>' + icon('heart', 'ic sm') + esc(a.category) + '</span>' +
            '<span>' + icon(modeIc, 'ic sm') + esc(mode.label) + (mode.price && mode.price !== 'On request' ? ' · ' + esc(mode.price) : '') + '</span>' +
            '<span>' + icon('calendar', 'ic sm') + esc(NP.fmt.relative(a.date)) + '</span>' +
          '</div>' +
          '<div class="small muted">' + esc(subtitle) + (!forMember && mem && mem.phone ? ' · ' + esc(NP.fmt.phone(mem.phone)) : '') + '</div>' +
          (a.notes ? '<div class="note">' + esc(a.notes) + '</div>' : '') +
          '<div class="foot"><span class="ref">' + icon('share', '') + 'Referred by <strong>&nbsp;' + esc(refTxt) + '</strong></span>' +
            '<div class="actions">' + (opts.actions ? opts.actions(a) : '') + '</div></div>' +
        '</div>' +
      '</article>';
  }

  /* ---------- Dashboard navbar ---------- */
  function renderNav(container, user, roleLabel, sub) {
    container.innerHTML =
      '<div class="dash-nav-inner">' +
        '<a href="index.html" class="dash-brand" aria-label="NARI Health home">' +
          '<img src="https://horizons-cdn.hostinger.com/4f4cbd5f-21cd-4aac-8b1c-4a246b104cf0/9acd6eddb9cebb990d19c12ee018b0f9.png" alt="NARI Health">' +
          '<span class="divider"></span><span class="badge role">' + esc(roleLabel) + '</span>' +
          (NP.isLive ? '' : '<span class="badge demo" title="Data lives in this browser only">Demo</span>') +
        '</a>' +
        '<div class="dash-user">' +
          '<div class="who"><div class="name">' + esc(user.name) + '</div><div class="sub">' + esc(sub || '') + '</div></div>' +
          avatar(user) +
          '<button type="button" class="btn btn-ghost btn-sm" id="logoutBtn">' + icon('logout', 'ic sm') + '<span>Log out</span></button>' +
        '</div>' +
      '</div>';
    $('logoutBtn').addEventListener('click', function () {
      var b = $('logoutBtn'); b.disabled = true;
      NP.auth.logout().then(function () { window.location.href = 'login.html'; }, function () { window.location.href = 'login.html'; });
    });
  }

  /* ---------- Page loader ---------- */
  function pageReady() { document.body.classList.remove('loading'); var l = $('loader'); if (l) l.remove(); }
  function greeting(name) { var h = new Date().getHours(); return (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening') + (name ? ', ' + name : ''); }

  /* ---------- Tabs ---------- */
  function initTabs(root) {
    var tabs = root.querySelectorAll('.tab');
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        tabs.forEach(function (x) { x.classList.remove('active'); });
        t.classList.add('active');
        document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.toggle('active', p.id === t.getAttribute('data-tab')); });
        try { history.replaceState(null, '', '#' + t.getAttribute('data-tab')); } catch (e) {}
      });
    });
    var h = window.location.hash.slice(1);
    if (h) { var m = root.querySelector('.tab[data-tab="' + h + '"]'); if (m) { m.click(); setTimeout(function () { window.scrollTo(0, 0); }, 0); } }
  }

  /* ---------- Modal confirm ---------- */
  function confirmDialog(title, body, okLabel, danger) {
    return new Promise(function (resolve) {
      var bg = el('div', 'modal-bg open');
      bg.innerHTML = '<div class="modal" role="dialog" aria-modal="true"><h3>' + esc(title) + '</h3><p class="muted" style="margin-top:.6rem;line-height:1.6">' + body + '</p>' +
        '<div class="row" style="justify-content:flex-end;margin-top:1.5rem"><button type="button" class="btn btn-ghost btn-sm" data-act="no">Cancel</button>' +
        '<button type="button" class="btn ' + (danger ? 'btn-dark' : 'btn-primary') + ' btn-sm" data-act="yes">' + esc(okLabel || 'Confirm') + '</button></div></div>';
      document.body.appendChild(bg);
      bg.addEventListener('click', function (e) {
        var act = e.target.getAttribute && e.target.getAttribute('data-act');
        if (e.target === bg || act === 'no') { bg.remove(); resolve(false); }
        if (act === 'yes') { bg.remove(); resolve(true); }
      });
    });
  }

  /* ---------- Copy ---------- */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallback(); });
    return Promise.resolve(fallback());
    function fallback() { var ta = el('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} ta.remove(); return ok; }
  }

  /* ---------- Password eye toggle ---------- */
  function initPasswordToggles() {
    document.querySelectorAll('[data-toggle-pw]').forEach(function (btn) {
      var input = $(btn.getAttribute('data-toggle-pw'));
      btn.innerHTML = icon('eye', 'ic');
      btn.addEventListener('click', function () {
        var show = input.type === 'password'; input.type = show ? 'text' : 'password';
        btn.innerHTML = icon(show ? 'eyeOff' : 'eye', 'ic'); btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      });
    });
  }

  /* ---------- Buttons ---------- */
  function googleButton(id, label) { return '<button type="button" class="btn btn-google btn-block" id="' + esc(id) + '">' + GOOGLE_SVG + '<span>' + esc(label || 'Continue with Google') + '</span></button>'; }
  function busy(btn, on, label) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>' + esc(label || 'Please wait…'); }
    else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
  }

  function showError(id, msg) { var n = $(id); if (!n) return; n.textContent = msg || ''; n.classList.toggle('show', !!msg); }
  function param(name) { var m = window.location.search.match(new RegExp('[?&]' + name + '=([^&]+)')); return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : ''; }
  function nextParam(fallback) { var v = param('next'); return /^[a-z-]+\.html$/.test(v) ? v : fallback; }

  /* Live-mode pages hide demo helpers; demo pages hide live-only ones. */
  function applyMode() {
    document.querySelectorAll('[data-demo-only]').forEach(function (n) { n.classList.toggle('hidden', NP.isLive); });
    document.querySelectorAll('[data-live-only]').forEach(function (n) { n.classList.toggle('hidden', !NP.isLive); });
    document.querySelectorAll('[data-member-word]').forEach(function (n) { n.textContent = n.getAttribute('data-member-word') === 'plural' ? NP.MEMBERS : NP.MEMBER; });
  }
  document.addEventListener('DOMContentLoaded', applyMode);

  global.PortalUI = { esc: esc, $: $, el: el, icon: icon, WA_SVG: WA_SVG, GOOGLE_SVG: GOOGLE_SVG, WA_URL: WA_URL, toast: toast, statusBadge: statusBadge, avatar: avatar, apptCard: apptCard, renderNav: renderNav, pageReady: pageReady, greeting: greeting, initTabs: initTabs, confirmDialog: confirmDialog, copyText: copyText, initPasswordToggles: initPasswordToggles, googleButton: googleButton, busy: busy, showError: showError, param: param, nextParam: nextParam, applyMode: applyMode };
})(window);
