/* Public-site analytics. No health answers, contact details or destination query strings. */
(function () {
  'use strict';
  if (window.NariAnalytics) return;
  var id = 'G-9V6RCQWJEM', key = 'nari_analytics_consent', loaded = false;
  function allowed() {
    if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl) return false;
    try { return localStorage.getItem(key) === 'granted'; } catch (_) { return false; }
  }
  function gtag() { (window.dataLayer = window.dataLayer || []).push(arguments); }
  function start() {
    window['ga-disable-' + id] = !allowed();
    if (!allowed() || loaded) return;
    loaded = true;
    window.gtag = gtag;
    gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    gtag('js', new Date());
    var canonical = document.querySelector('link[rel="canonical"]');
    gtag('config', id, {
      page_location: canonical ? canonical.href : location.origin + location.pathname,
      page_referrer: '', allow_google_signals: false, allow_ad_personalization_signals: false
    });
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
    document.head.appendChild(script);
  }
  // Deliberate allowlist: callers cannot pass form fields or arbitrary event parameters.
  var events = ['phone_click', 'whatsapp_click', 'booking_start', 'lead_form_start', 'lead_submitted', 'lead_fallback_whatsapp'];
  function track(name) {
    if (!allowed() || events.indexOf(name) < 0) return;
    start();
    gtag('event', name, { transport_type: 'beacon' });
  }
  function setConsent(value) {
    try { localStorage.setItem(key, value ? 'granted' : 'denied'); } catch (_) {}
    if (loaded) gtag('consent', 'update', { analytics_storage: allowed() ? 'granted' : 'denied' });
    start();
  }
  window.NariAnalytics = { track: track, allowed: allowed, setConsent: setConsent };
  start();
  window.addEventListener('storage', function (e) { if (e.key === key) { if (loaded) gtag('consent', 'update', { analytics_storage: allowed() ? 'granted' : 'denied' }); start(); } });
  document.addEventListener('click', function (e) {
    var anchor = e.target.closest && e.target.closest('a[href]');
    if (!anchor || e.defaultPrevented) return;
    var url;
    try { url = new URL(anchor.href, location.href); } catch (_) { return; }
    if (url.protocol === 'tel:') track('phone_click');
    else if (url.protocol === 'https:' && /^(wa\.me|api\.whatsapp\.com)$/.test(url.hostname)) track('whatsapp_click');
    else if (url.origin === location.origin && /^\/member-login(?:\.html)?\/?$/.test(url.pathname)) track('booking_start');
  });
  var checkbox = document.getElementById('analyticsConsent');
  var status = document.getElementById('analyticsStatus');
  function showChoice() {
    if (checkbox) checkbox.checked = allowed();
    if (status) status.textContent = allowed() ? 'Optional analytics is enabled on this browser.' : 'Optional analytics is off. Booking and contact forms still work.';
  }
  if (checkbox) checkbox.addEventListener('change', function () { setConsent(checkbox.checked); showChoice(); });
  showChoice();
})();
