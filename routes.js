/* Real HTML filenames on preview servers; clean URLs on the production host.
   Also imported by the local preview scripts so their route list stays in sync. */
(function (global) {
  'use strict';
  var pages = [
    'index', 'member-login', 'member', 'login', 'gallery', 'privacy', 'terms',
    'physiotherapy-bulandshahr', 'physiotherapy-noida', 'physiotherapy-delhi-ncr',
    'female-physiotherapist-near-me', 'womens-health-near-me',
    'nutritionist-online', 'gynaecologist-online', 'pcos-support', 'menopause-support',
    'irregular-periods', 'painful-periods-pms', 'pregnancy-physiotherapy', 'postpartum-recovery', 'pelvic-floor-physiotherapy', 'urinary-leakage-support', 'vaginal-dryness-painful-intercourse', 'weight-management', 'back-neck-pain', 'constipation-bloating', 'chronic-pelvic-pain', 'fatigue-sleep-support', 'stress-anxiety-support',
    'doctor/index', 'doctor/panel', 'admin/index', 'admin/console', 'admin/dev'
  ];
  if (typeof module === 'object' && module.exports) { module.exports = pages; return; }

  var root = new URL('.', document.currentScript.src);
  var clean = /^(www\.)?narihealth\.in$/.test(global.location.hostname);
  function url(value) {
    if (!value || value.charAt(0) === '#') return value;
    var target;
    try { target = new URL(value, document.baseURI); } catch (e) { return value; }
    if (target.origin !== root.origin || target.pathname.indexOf(root.pathname) !== 0) return value;
    var relative = target.pathname.slice(root.pathname.length);
    var page = relative.replace(/\.html$/, '').replace(/\/$/, '');
    if (!page || page === 'doctor' || page === 'admin') return value;
    if (pages.indexOf(page) < 0) return value;
    var next = clean ? page.replace(/(^|\/)index$/, '$1') : page + '.html';
    target.pathname = root.pathname + next;
    return target.pathname === new URL(value, document.baseURI).pathname ? value : target.href;
  }
  global.NariRoutes = { url: url, pages: pages };

  // Never hide the real filename on a server that cannot resolve clean URLs.
  var current = url(global.location.href);
  if (current !== global.location.href) global.history.replaceState(null, '', current);

  function fixLinks(node) {
    if (!node || !node.querySelectorAll) return;
    function fix(anchor) {
      var before = anchor.getAttribute('href'), after = url(before);
      if (after !== before) anchor.setAttribute('href', after);
    }
    if (node.matches && node.matches('a[href]')) fix(node);
    node.querySelectorAll('a[href]').forEach(fix);
  }
  document.addEventListener('DOMContentLoaded', function () {
    fixLinks(document);
    // Covers links rendered later in member, doctor, admin and callback forms.
    new MutationObserver(function (changes) {
      changes.forEach(function (change) {
        if (change.type === 'attributes') fixLinks(change.target);
        else change.addedNodes.forEach(fixLinks);
      });
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
  });
})(typeof window === 'object' ? window : this);
