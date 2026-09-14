/* ===== NARI Health — page loader =====
   Include as the FIRST thing inside <body>:  <script src="loader.js"></script>
   Paints a full-screen curtain with the NARI lotus and a rotating health quote, before anything else
   renders, so a slow connection shows something calm instead of a blank page.

   • Public pages: hides itself on window load (or after 6 s, whichever is first). If the page is ready
     within 400 ms, it fades instantly so fast connections never notice it.
   • Portal pages (<body class="portal loading">): stays until the page calls NariLoader.hide(),
     which PortalUI.pageReady() does once the signed-in data has arrived. */
(function () {
  'use strict';
  if (document.getElementById('loader')) return;

  var QUOTES = [
    ['Your body hears everything your mind says. Be kind to it.', 'NARI Health'],
    ['Rest is not idleness. It is how the body heals.', 'NARI Health'],
    ['A regular cycle starts with regular sleep.', 'Dr. Sudha Sharma, Gynaecologist'],
    ['Strong pelvic floor, stronger you. Ten minutes a day.', 'Dr. Nisha Andola, Physiotherapist'],
    ['Eat for your hormones, not for the scale.', 'Dr. Sneha Iyer, Nutritionist'],
    ['Asking for help is a form of strength.', 'Dr. Hanifa, Psychologist'],
    ['Water, fibre, movement. Your gut will thank you.', 'NARI Health'],
    ['Small steps every day beat one big resolution.', 'NARI Health'],
    ['You know your body best. We are here to listen.', 'NARI Health']
  ];

  var BASE = (function () { var src = (document.currentScript && document.currentScript.src) || ''; return src.replace(/loader\.js.*$/, ''); })();

  var css =
    '#loader{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.4rem;padding:2rem 1.5rem;text-align:center;' +
      'background:#FFFDFC;color:#121212;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;transition:opacity .45s ease,visibility .45s}' +
    '#loader.out{opacity:0;visibility:hidden;pointer-events:none}' +
    '#loader .lotus{width:150px;height:auto;animation:nl-breathe 2.6s ease-in-out infinite}' +
    '#loader .lotus img{width:100%;height:auto;display:block}' +
    '#loader .brand{font-family:"Plus Jakarta Sans",Inter,system-ui,sans-serif;font-weight:800;font-size:1.35rem;letter-spacing:-.02em}' +
    '#loader .brand em{font-style:normal;color:#C91F35}' +
    '#loader .quote{max-width:26rem;min-height:4.6rem;display:flex;flex-direction:column;justify-content:center;gap:.4rem;transition:opacity .4s}' +
    '#loader .quote.fade{opacity:0}' +
    '#loader .quote p{font-size:1rem;line-height:1.55;color:#3d3335;margin:0}' +
    '#loader .quote small{font-size:.75rem;letter-spacing:.08em;text-transform:uppercase;color:#8a7f83}' +
    '#loader .bar{width:120px;height:3px;border-radius:2px;background:rgba(201,31,53,.12);overflow:hidden}' +
    '#loader .bar i{display:block;width:40%;height:100%;border-radius:2px;background:#C91F35;animation:nl-slide 1.4s ease-in-out infinite}' +
    '@keyframes nl-breathe{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(1.06);opacity:1}}' +
    '@keyframes nl-slide{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}}' +
    '@media (prefers-reduced-motion:reduce){#loader .lotus,#loader .bar i{animation:none}}';

  var style = document.createElement('style'); style.textContent = css;
  document.head.appendChild(style);

  var start = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  var el = document.createElement('div');
  el.id = 'loader'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
  el.innerHTML = '<div class="lotus"><img src="' + BASE + 'assets/logo.png" alt="NARI Health" width="150" height="103"></div>' +
    '<div class="quote" id="loaderQuote"><p>“' + start[0] + '”</p><small>' + start[1] + '</small></div><div class="bar"><i></i></div>';
  (document.body || document.documentElement).appendChild(el);

  var idx = QUOTES.indexOf(start), timer = null, shownAt = Date.now(), hidden = false;
  function rotate() {
    var q = document.getElementById('loaderQuote'); if (!q) return;
    q.classList.add('fade');
    setTimeout(function () {
      idx = (idx + 1) % QUOTES.length;
      q.innerHTML = '<p>“' + QUOTES[idx][0] + '”</p><small>' + QUOTES[idx][1] + '</small>';
      q.classList.remove('fade');
    }, 400);
  }
  timer = setInterval(rotate, 3200);

  function hide() {
    if (hidden) return; hidden = true;
    clearInterval(timer);
    var quick = Date.now() - shownAt < 400;
    if (quick) el.style.transition = 'none';
    el.classList.add('out');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, quick ? 0 : 500);
  }

  window.NariLoader = { hide: hide };

  /* Portal pages keep the curtain up until their data is ready (they call NariLoader.hide()). */
  var portal = document.body && document.body.classList.contains('loading');
  if (!portal) {
    if (document.readyState === 'complete') hide();
    else window.addEventListener('load', hide);
    setTimeout(hide, 6000);
  } else {
    setTimeout(hide, 20000); /* never trap the user behind the curtain */
  }
})();
