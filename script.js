/* ===== NARI Health — standalone script ===== */
(function () {
  'use strict';

  var WA = 'https://wa.me/916399507521?text=Hi%20NARI%20Health%2C%20I%20have%20a%20health%20question';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Data ---------- */
  var REVIEWS = [
    { name: 'Priya S.', city: 'Chennai', text: 'Got a clear answer about my PCOS reports in ten minutes. No panic-Googling at 2am.' },
    { name: 'Divya M.', city: 'Hyderabad', text: 'The doctor was kind and specific. Booking a follow-up took one message.' },
    { name: 'Kavita R.', city: 'Jaipur', text: 'The nutritionist gave me advice I actually trusted. I have recommended NARI to my whole family.' }
  ];


  var starSvg = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';

  /* ---------- Helpers ---------- */
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  /* Copy the HTML expert cards into the mobile carousel. */
  function renderExperts() {
    var grid = document.getElementById('expertsGrid');
    var track = document.getElementById('expertsTrack');
    var dots = document.getElementById('expertsDots');
    if (!grid || !track || !dots) return;
    Array.prototype.forEach.call(grid.children, function (card, i) {
      var slide = el('div', 'carousel-slide');
      slide.appendChild(card.cloneNode(true));
      track.appendChild(slide);
      var dot = el('button', 'carousel-dot' + (i === 0 ? ' active' : ''));
      dot.type = 'button';
      dot.setAttribute('aria-label', 'Go to ' + card.querySelector('.expert-name').textContent);
      dot.addEventListener('click', function () { expertsGoTo(i); });
      dots.appendChild(dot);
    });
    grid.classList.add('carousel-ready');
  }

  /* Experts carousel logic */
  var expertsIdx = 0;
  var expertsTimer = null;
  function expertsGoTo(i) {
    var track = document.getElementById('expertsTrack');
    if (!track) return;
    expertsIdx = (i + track.children.length) % track.children.length;
    var slideW = track.children[0].getBoundingClientRect().width + 16; // gap 1rem
    track.style.transform = 'translateX(' + (-expertsIdx * slideW) + 'px)';
    var dots = document.getElementById('expertsDots');
    Array.prototype.forEach.call(dots.children, function (d, di) {
      d.classList.toggle('active', di === expertsIdx);
    });
  }
  function initExpertsCarousel() {
    var track = document.getElementById('expertsTrack');
    if (!track || window.matchMedia('(min-width: 640px)').matches) return;
    if (expertsTimer) { clearInterval(expertsTimer); expertsTimer = null; }
    expertsTimer = setInterval(function () { expertsGoTo(expertsIdx + 1); }, 3000);
  }

  /* ---------- Render written reviews ---------- */
  function reviewCardHTML(r) {
    return '<div class="stars">' + starSvg + starSvg + starSvg + starSvg + starSvg + '</div>' +
      '<blockquote>“' + r.text + '”</blockquote>' +
      '<figcaption><span class="rv-avatar" aria-hidden="true">' + r.name.split(/\s+/).map(function (w) { return w.charAt(0); }).join('').replace(/\W/g, '').slice(0, 2) + '</span>' +
        '<span><span class="name">' + r.name + '</span><br><span class="city">' + r.city + '</span></span></figcaption>';
  }
  function renderReviews() {
    var grid = document.getElementById('reviewsGrid');
    var mobile = document.getElementById('reviewMobileCard');
    var dotsWrap = document.getElementById('reviewDots');
    if (grid) {
      REVIEWS.forEach(function (r, i) {
        var wrap = el('div', 'reveal');
        wrap.setAttribute('data-delay', String(i * 100));
        var fig = el('figure', 'review-card');
        fig.innerHTML = reviewCardHTML(r);
        wrap.appendChild(fig);
        grid.appendChild(wrap);
      });
    }
    if (mobile && dotsWrap) {
      REVIEWS.forEach(function (r, i) {
        var dot = el('span', 'review-dot' + (i === 0 ? ' active' : ''));
        dotsWrap.appendChild(dot);
      });
      showReview(0);
    }
  }

  var reviewIdx = 0;
  var reviewTimer = null;
  function showReview(i) {
    var mobile = document.getElementById('reviewMobileCard');
    var dotsWrap = document.getElementById('reviewDots');
    if (!mobile) return;
    reviewIdx = (i + REVIEWS.length) % REVIEWS.length;
    mobile.style.opacity = '0';
    setTimeout(function () {
      mobile.innerHTML = '<figure class="review-card">' + reviewCardHTML(REVIEWS[reviewIdx]) + '</figure>';
      mobile.style.opacity = '1';
    }, 200);
    if (dotsWrap) {
      Array.prototype.forEach.call(dotsWrap.children, function (d, di) {
        d.classList.toggle('active', di === reviewIdx);
      });
    }
  }
  function initReviewCarousel() {
    var prev = document.getElementById('reviewPrev');
    var next = document.getElementById('reviewNext');
    if (prev) prev.addEventListener('click', function () { showReview(reviewIdx - 1); resetReviewTimer(); });
    if (next) next.addEventListener('click', function () { showReview(reviewIdx + 1); resetReviewTimer(); });
    resetReviewTimer();
  }
  function resetReviewTimer() {
    if (reviewTimer) clearInterval(reviewTimer);
    reviewTimer = setInterval(function () { showReview(reviewIdx + 1); }, 6000);
  }

  /* ---------- Navbar ---------- */
  function initNavbar() {
    var navbar = document.getElementById('navbar');
    var toggle = document.getElementById('menuToggle');
    var menu = document.getElementById('mobileMenu');
    var iconMenu = toggle.querySelector('.icon-menu');
    var iconClose = toggle.querySelector('.icon-close');
    window.addEventListener('scroll', function () {
      navbar.classList.toggle('solid', window.scrollY > 24);
    }, { passive: true });
    toggle.addEventListener('click', function () {
      var open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      iconMenu.style.display = open ? 'none' : 'block';
      iconClose.style.display = open ? 'block' : 'none';
    });
    Array.prototype.forEach.call(menu.querySelectorAll('a'), function (a) {
      a.addEventListener('click', function () {
        menu.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        iconMenu.style.display = 'block';
        iconClose.style.display = 'none';
      });
    });
  }

  /* ---------- Reveal on scroll ---------- */
  function initReveal() {
    var nodes = document.querySelectorAll('.reveal');
    if (reduceMotion || !('IntersectionObserver' in window)) {
      nodes.forEach(function (n) { n.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          var delay = parseInt(en.target.getAttribute('data-delay') || '0', 10);
          setTimeout(function () { en.target.classList.add('is-visible'); }, delay);
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: '-80px', threshold: 0.05 });
    nodes.forEach(function (n) { io.observe(n); });
  }

  /* ---------- Counters ---------- */
  function initCounters() {
    var nums = document.querySelectorAll('[data-counter]');
    if (reduceMotion || !('IntersectionObserver' in window)) {
      nums.forEach(function (n) {
        var to = parseInt(n.getAttribute('data-counter'), 10);
        var suf = n.getAttribute('data-suffix') || '';
        n.textContent = to.toLocaleString('en-IN') + suf;
      });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var node = en.target;
        var to = parseInt(node.getAttribute('data-counter'), 10);
        var suf = node.getAttribute('data-suffix') || '';
        var start = performance.now();
        var dur = 1400;
        function tick(now) {
          var p = Math.min((now - start) / dur, 1);
          var val = Math.round(to * (1 - Math.pow(1 - p, 3)));
          node.textContent = val.toLocaleString('en-IN') + (p < 1 ? '' : suf);
          if (p < 1) requestAnimationFrame(tick);
          else node.textContent = to.toLocaleString('en-IN') + suf;
        }
        requestAnimationFrame(tick);
        io.unobserve(node);
      });
    }, { rootMargin: '-60px' });
    nums.forEach(function (n) { io.observe(n); });
  }

  /* ---------- Hero parallax ---------- */
  function initParallax() {
    if (reduceMotion) return;
    var bg = document.querySelector('.hero-bg');
    var phone = document.getElementById('heroPhoneWrap');
    var hero = document.getElementById('top');
    if (!hero) return;
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var rect = hero.getBoundingClientRect();
        var progress = Math.max(0, Math.min(1, -rect.top / rect.height));
        if (bg) bg.style.transform = 'translateY(' + (progress * 120) + 'px)';
        if (phone) phone.style.transform = 'translateY(' + (progress * -60) + 'px)';
        ticking = false;
      });
    }, { passive: true });
  }

  /* ---------- Hero underline draw ---------- */
  function initUnderline() {
    var path = document.getElementById('underlinePath');
    if (!path) return;
    if (reduceMotion) { path.style.strokeDashoffset = '0'; return; }
    setTimeout(function () { path.classList.add('animate'); }, 300);
  }

  /* ---------- Newsletter ---------- */
  function initNewsletter() {
    var form = document.getElementById('newsletter');
    var sent = document.getElementById('newsletterSent');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      form.reset();
      sent.style.display = 'block';
    });
  }

  /* ---------- Footer year ---------- */
  function initFooterYear() {
    var fb = document.getElementById('footerBottom');
    if (fb) fb.textContent = '© ' + new Date().getFullYear() + ' NARI Health. Not a substitute for emergency care.';
  }

  /* ---------- Phone conversation animation ---------- */
  function initPhoneAnimation() {
    var mockup = document.getElementById('phoneMockup');
    var body = document.getElementById('phoneBody');
    if (!mockup || !body) return;

    var CHAT = [
      { type: 'me', text: 'Hi, I have had irregular periods for 3 months. Should I be worried?' },
      { type: 'them', text: 'Thanks for sharing. Any recent weight change or high stress?' },
      { type: 'me', text: 'Yes, a lot of stress at work.' },
      { type: 'them', text: 'That can affect your cycle. Dr. Sudha (gynaecologist) has a video slot tomorrow at 10 AM. Shall I book it for you?' }
    ];

    var timers = [];
    var typingEl = null;
    var started = false;

    function clearTimers() {
      timers.forEach(function (t) { clearTimeout(t); });
      timers = [];
    }

    function createTyping() {
      var t = document.createElement('div');
      t.className = 'typing-indicator';
      t.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
      return t;
    }

    function addBubble(chat) {
      var b = el('div', 'chat-bubble ' + chat.type, chat.text);
      body.appendChild(b);
      requestAnimationFrame(function () {
        setTimeout(function () { b.classList.add('is-visible'); }, 30);
      });
    }

    function showTyping() {
      typingEl = createTyping();
      body.appendChild(typingEl);
      requestAnimationFrame(function () {
        setTimeout(function () { if (typingEl) typingEl.classList.add('is-visible'); }, 30);
      });
    }

    function hideTyping() {
      if (typingEl && typingEl.parentNode) { typingEl.parentNode.removeChild(typingEl); }
      typingEl = null;
    }

    function resetChat() {
      clearTimers();
      hideTyping();
      body.innerHTML = '';
    }

    function runSequence() {
      resetChat();

      var t0 = setTimeout(function () { addBubble(CHAT[0]); }, 600);
      timers.push(t0);

      var t1 = setTimeout(function () { showTyping(); }, 2000);
      timers.push(t1);

      var t2 = setTimeout(function () { hideTyping(); addBubble(CHAT[1]); }, 3800);
      timers.push(t2);

      var t3 = setTimeout(function () { addBubble(CHAT[2]); }, 5600);
      timers.push(t3);

      var t4 = setTimeout(function () { showTyping(); }, 7000);
      timers.push(t4);

      var t5 = setTimeout(function () { hideTyping(); addBubble(CHAT[3]); }, 8800);
      timers.push(t5);

      var t6 = setTimeout(function () { runSequence(); }, 13000);
      timers.push(t6);
    }

    if (reduceMotion) {
      CHAT.forEach(function (c) {
        var b = el('div', 'chat-bubble ' + c.type + ' is-visible', c.text);
        body.appendChild(b);
      });
      return;
    }

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting && !started) {
            started = true;
            mockup.classList.add('is-floating');
            runSequence();
            io.unobserve(mockup);
          }
        });
      }, { threshold: 0.25 });
      io.observe(mockup);
    } else {
      started = true;
      mockup.classList.add('is-floating');
      runSequence();
    }
  }

  /* ---------- Recompute carousel on resize ---------- */
  function initResize() {
    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        expertsGoTo(expertsIdx);
        initExpertsCarousel();
      }, 200);
    });
  }

  /* ---------- Boot ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    renderExperts();
    renderReviews();
    initNavbar();
    initReveal();
    initCounters();
    initParallax();
    initUnderline();
    initNewsletter();
    initFooterYear();
    initExpertsCarousel();
    initReviewCarousel();
    initResize();
    initPhoneAnimation();
  });
})();
