/* ===== NARI Health — push notification service worker =====
   Registered by the team console (NariPortal.push.enable) so admins get notifications from Firebase Cloud
   Messaging even when the console is closed. The Cloud Function in functions/index.js sends a ready-made
   notification (title, body, link), which the Firebase SDK shows and opens on tap, so this file only has
   to initialise Firebase with the same config the site uses. Must live at the site root. */
/* portal-config.js assigns window.NARI_CONFIG; a worker has no window, so point it at the worker scope. */
self.window = self;
importScripts('portal-config.js');

var CFG = self.NARI_CONFIG || {};
var VERSION = CFG.firebaseVersion || '12.18.0';
importScripts('https://www.gstatic.com/firebasejs/' + VERSION + '/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/' + VERSION + '/firebase-messaging-compat.js');

if (CFG.firebase && CFG.firebase.apiKey) {
  firebase.initializeApp(CFG.firebase);
  var messaging = firebase.messaging();
  /* Data-only messages (none are sent today) would need showing by hand; notification messages are shown by the SDK. */
  messaging.onBackgroundMessage(function (payload) {
    if (payload.notification) return;
    var d = payload.data || {};
    if (d.title) self.registration.showNotification(d.title, { body: d.body || '', icon: 'assets/logo.png', data: { link: d.link || '' } });
  });
}

/* Take over open tabs straight away after an update, so a redeploy never leaves a stale worker around. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
