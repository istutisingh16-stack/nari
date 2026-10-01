/* ===== NARI Health — page-view counter for the developer page =====
   Runs on the public pages after they have loaded. Adds one view to today's row, traffic/{YYYY-MM-DD}, split
   by page, source (utm_source or the referring site), device and hour; the first page of a visit also counts
   as a visitor. Uses Firestore's REST API directly (one small request, no SDK), so it costs the visitor
   nothing noticeable. Google Analytics stays the detailed source; this gives the team a quick, own view in
   /admin/dev without an extra sign-in. In demo mode the counts live in this browser's localStorage. */
(function () {
  'use strict';
  var CFG = window.NARI_CONFIG || {};
  var FB = CFG.firebase || {};
  var LIVE = !!(FB.apiKey && FB.projectId && /^AIza/.test(FB.apiKey));
  var KEY = 'nari_traffic', VISIT_KEY = 'nari_visit';
  /* Honour the browser's "do not track" and "global privacy control" signals. */
  if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl) return;

  function key(s) { s = String(s || '').toLowerCase().replace(/^www\./, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40); return s || 'other'; }
  function param(n) { var m = window.location.search.match(new RegExp('[?&]' + n + '=([^&]+)')); return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : ''; }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  var d = new Date();
  var day = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  var page = (document.body.getAttribute('data-page') || window.location.pathname.split('/').pop() || 'index').replace(/\.html$/, '') || 'index';
  if (page === 'index') page = 'home';
  var newVisit = false;
  try { if (!sessionStorage.getItem(VISIT_KEY)) { sessionStorage.setItem(VISIT_KEY, '1'); newVisit = true; } } catch (e) { newVisit = true; }
  var source = param('utm_source');
  if (!source && document.referrer) { try { var h = new URL(document.referrer).hostname; if (h && h !== window.location.hostname) source = h; } catch (e) {} }
  source = key(source || 'direct');
  var device = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
  var hour = String(d.getHours());
  var campaign = key(param('utm_campaign') || '');

  function demoCount() {
    try {
      var all = JSON.parse(localStorage.getItem(KEY) || '{}');
      var t = all[day] || { day: day, views: 0, visitors: 0, pages: {}, sources: {}, devices: {}, hours: {}, campaigns: {} };
      t.views++; if (newVisit) t.visitors++;
      t.pages[key(page)] = (t.pages[key(page)] || 0) + 1;
      t.devices[device] = (t.devices[device] || 0) + 1;
      t.hours[hour] = (t.hours[hour] || 0) + 1;
      if (newVisit) { t.sources[source] = (t.sources[source] || 0) + 1; if (campaign !== 'other') t.campaigns[campaign] = (t.campaigns[campaign] || 0) + 1; }
      all[day] = t;
      /* Keep 90 days. */
      Object.keys(all).sort().slice(0, -90).forEach(function (k) { delete all[k]; });
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch (e) {}
  }

  function liveCount() {
    var name = 'projects/' + FB.projectId + '/databases/(default)/documents/traffic/' + day;
    function inc(path) { return { fieldPath: path, increment: { integerValue: '1' } }; }
    var transforms = [inc('views'), inc('pages.' + key(page)), inc('devices.' + device), inc('hours.h' + hour)];
    if (newVisit) { transforms.push(inc('visitors')); transforms.push(inc('sources.' + source)); if (campaign !== 'other') transforms.push(inc('campaigns.' + campaign)); }
    var body = JSON.stringify({ writes: [{ update: { name: name, fields: { day: { stringValue: day } } }, updateMask: { fieldPaths: ['day'] }, updateTransforms: transforms }] });
    var url = 'https://firestore.googleapis.com/v1/projects/' + FB.projectId + '/databases/(default)/documents:commit?key=' + encodeURIComponent(FB.apiKey);
    try { fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true, mode: 'cors' }).catch(function () {}); } catch (e) {}
  }

  function run() { if (LIVE) liveCount(); else demoCount(); }
  if (document.readyState === 'complete') setTimeout(run, 800);
  else window.addEventListener('load', function () { setTimeout(run, 800); });
})();
