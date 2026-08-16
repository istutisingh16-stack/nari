/* ===== NARI Health — standalone script ===== */
(function () {
  'use strict';

  var WA = 'https://wa.me/919999999999?text=Hi%20NARI%20Health%2C%20I%20have%20a%20health%20question';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Data ---------- */
  var CATEGORIES = [
    { label: "Women's Health", tint: '#FCEEEE', icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' },
    { label: 'PMOS(PCOS)', tint: '#F3F0FF', icon: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>' },
    { label: 'Pregnancy', tint: '#FFF4E8', icon: '<path d="M9 12h6M12 9v6"/><circle cx="12" cy="12" r="10"/>' },
    { label: 'Periods', tint: '#FCEEEE', icon: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>' },
    { label: 'Mental Health', tint: '#EAF4FF', icon: '<path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2zM14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2z"/>' },
    { label: 'Nutrition', tint: '#EDF9EF', icon: '<path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06z"/><path d="M10 2c1 .5 2 2 2 5"/>' },
    { label: 'Sleep', tint: '#F1F0FB', icon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>' },
    { label: 'Menopause', tint: '#FFF1F6', icon: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' },
    { label: 'General Health', tint: '#F4F5F7', icon: '<path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/>' },
    { label: 'Pelvic Health', tint: '#FFF4E8', icon: '<path d="M12 3l1.9 5.8L19.7 11l-5.8 1.9L12 18.7l-1.9-5.8L4.3 11l5.8-1.9z"/>' }
  ];

  var EXPERTS = [
    { img: 'https://horizons-cdn.hostinger.com/4f4cbd5f-21cd-4aac-8b1c-4a246b104cf0/21382c5b8e03d1b3281a7be4d1d609f2.png', name: 'Dr. Sudha Sharma', role: 'Gynecologist', exp: '32+ yrs' },
    { img: 'https://horizons-cdn.hostinger.com/4f4cbd5f-21cd-4aac-8b1c-4a246b104cf0/39c844c99b0c53eb89ca7bcd29bf7874.png', name: 'Dr. Hanifa', role: 'Psychologist', exp: '15+ yrs' },
    { img: 'https://horizons-cdn.hostinger.com/4f4cbd5f-21cd-4aac-8b1c-4a246b104cf0/00080d23203e6329660ad5faf6d06897.png', name: 'Dr. Nisha Andola', role: 'Physiotherapist', exp: '4 yrs' },
    { img: 'https://horizons-cdn.hostinger.com/4f4cbd5f-21cd-4aac-8b1c-4a246b104cf0/0a8f90209fff53566c4ee75a308ec234.png', name: 'Dr. Sneha Iyer', role: 'Nutritionist', exp: ' 2 yrs' }
  ];

  var REVIEWS = [
    { img: 'https://images.hostinger.com/2dfc825e-a1c1-490e-99c2-b77a6e4236d7.png', name: 'Priya S.', city: 'Chennai', text: 'Got a clear answer about my PCOS reports in ten minutes. No panic-Googling at 2am.' },
    { img: 'https://images.hostinger.com/a24c2559-102e-4ffa-84c6-fdc8899cc74c.png', name: 'Divya M.', city: 'Hyderabad', text: 'The doctor was kind and specific. Booking a follow-up took one message.' },
    { img: 'https://images.hostinger.com/62fcdbf3-7fa2-4760-85a2-76b8f9e72cbe.png', name: 'Kavita R.', city: 'Jaipur', text: 'For ₹99 I got advice I actually trusted. I have recommended it to my whole family.' }
  ];

  var VIDEO_REVIEWS = [
    { img: 'https://images.hostinger.com/2dfc825e-a1c1-490e-99c2-b77a6e4236d7.png', name: 'Priya S.', city: 'Chennai', duration: '1:12', text: 'How NARI helped me understand my PCOS diagnosis.' },
    { img: 'https://images.hostinger.com/a24c2559-102e-4ffa-84c6-fdc8899cc74c.png', name: 'Divya M.', city: 'Hyderabad', duration: '0:58', text: 'I got a same-day care plan — all on WhatsApp.' },
    { img: 'https://images.hostinger.com/62fcdbf3-7fa2-4760-85a2-76b8f9e72cbe.png', name: 'Kavita R.', city: 'Jaipur', duration: '1:34', text: 'Why I recommend NARI Health to every woman I know.' }
  ];

  var FAQS = [
    ['What exactly do I get for ₹99?', 'One full consultation thread on WhatsApp with a verified professional — your question, follow-ups, and a clear next step.'],
    ['How fast will someone reply?', 'Most questions are answered within minutes. Complex cases may take a few hours.'],
    ['Is my conversation private?', 'Yes. Chats are end-to-end encrypted on WhatsApp and never shared or sold.'],
    ['Are the experts really verified?', 'Every professional is licence-verified and reviewed before joining the NARI panel.'],
    ['Can I book an in-person doctor?', 'Yes. If your case needs a physical exam, we help you book the right specialist.']
  ];

  var starSvg = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
  var badgeSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>';

  /* ---------- Helpers ---------- */
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  /* ---------- Render Categories ---------- */
  function renderCategories() {
    var grid = document.getElementById('catGrid');
    if (!grid) return;
    CATEGORIES.forEach(function (c, i) {
      var card = el('div', 'cat-card reveal');
      card.setAttribute('data-delay', String(i * 50));
      card.style.backgroundColor = c.tint;
      card.innerHTML =
        '<span class="cat-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + c.icon + '</svg></span>' +
        '<p class="cat-label">' + c.label + '</p>';
      grid.appendChild(card);
    });
  }

  /* ---------- Render Experts ---------- */
  function expertCardHTML(e) {
    return '<div class="expert-img-wrap"><img src="' + e.img + '" alt="' + e.name + ', ' + e.role + '" loading="lazy" />' +
      '<span class="verified-badge">' + badgeSvg + ' Verified</span></div>' +
      '<div class="expert-body"><h3 class="expert-name">' + e.name + '</h3>' +
      '<p class="expert-role">' + e.role + ' · ' + e.exp + ' experience</p></div>';
  }
  function renderExperts() {
    var grid = document.getElementById('expertsGrid');
    var track = document.getElementById('expertsTrack');
    var dots = document.getElementById('expertsDots');
    if (grid) {
      EXPERTS.forEach(function (e, i) {
        var wrap = el('div', 'reveal');
        wrap.setAttribute('data-delay', String(i * 80));
        var card = el('article', 'expert-card');
        card.innerHTML = expertCardHTML(e);
        wrap.appendChild(card);
        grid.appendChild(wrap);
      });
    }
    if (track && dots) {
      EXPERTS.forEach(function (e, i) {
        var slide = el('div', 'carousel-slide');
        var card = el('article', 'expert-card');
        card.innerHTML = expertCardHTML(e);
        slide.appendChild(card);
        track.appendChild(slide);
        var dot = el('button', 'carousel-dot' + (i === 0 ? ' active' : ''));
        dot.setAttribute('type', 'button');
        dot.setAttribute('aria-label', 'Go to ' + e.name);
        dot.addEventListener('click', function () { expertsGoTo(i); });
        dots.appendChild(dot);
      });
    }
  }

  /* Experts carousel logic */
  var expertsIdx = 0;
  var expertsTimer = null;
  function expertsGoTo(i) {
    var track = document.getElementById('expertsTrack');
    if (!track) return;
    expertsIdx = (i + EXPERTS.length) % EXPERTS.length;
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

  /* ---------- Render Video testimonials ---------- */
  function renderVideos() {
    var grid = document.getElementById('videoGrid');
    if (!grid) return;
    VIDEO_REVIEWS.forEach(function (v, i) {
      var wrap = el('div', 'reveal');
      wrap.setAttribute('data-delay', String(i * 100));
      var card = el('div', 'video-card');
      card.innerHTML =
        '<div class="video-thumb">' +
          '<img src="' + v.img + '" alt="' + v.name + '" loading="lazy" />' +
          '<div class="video-overlay"></div>' +
          '<button type="button" class="video-play" aria-label="Play video testimonial from ' + v.name + '">' +
            '<span class="video-play-btn"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>' +
          '</button>' +
          '<span class="video-duration">' + v.duration + '</span>' +
        '</div>' +
        '<div class="video-body">' +
          '<div class="stars">' + starSvg + starSvg + starSvg + starSvg + starSvg + '</div>' +
          '<p class="video-quote">"' + v.text + '"</p>' +
          '<div class="video-author"><img src="' + v.img + '" alt="' + v.name + '" loading="lazy" />' +
            '<span class="name">' + v.name + '</span><span class="city">· ' + v.city + '</span></div>' +
        '</div>';
      var playBtn = card.querySelector('.video-play');
      var thumb = card.querySelector('.video-thumb');
      playBtn.addEventListener('click', function () {
        thumb.innerHTML =
          '<div class="video-playing"><div style="text-align:center">' +
            '<div class="pulse"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></div>' +
            '<p>Video testimonial — coming soon</p></div></div>';
      });
      wrap.appendChild(card);
      grid.appendChild(wrap);
    });
  }

  /* ---------- Render written reviews ---------- */
  function reviewCardHTML(r) {
    return '<div class="stars">' + starSvg + starSvg + starSvg + starSvg + starSvg + '</div>' +
      '<blockquote>“' + r.text + '”</blockquote>' +
      '<figcaption><img src="' + r.img + '" alt="' + r.name + '" loading="lazy" />' +
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

  /* ---------- Render FAQ ---------- */
  function renderFAQ() {
    var list = document.getElementById('faqList');
    if (!list) return;
    FAQS.forEach(function (pair, i) {
      var item = el('div', 'faq-item' + (i === 0 ? ' open' : ''));
      item.innerHTML =
        '<button type="button" class="faq-q" aria-expanded="' + (i === 0) + '">' +
          '<span class="faq-q-text">' + pair[0] + '</span>' +
          '<span class="faq-ic">' + (i === 0 ? minusSvg() : plusSvg()) + '</span>' +
        '</button>' +
        '<div class="faq-a"><p>' + pair[1] + '</p></div>';
      var btn = item.querySelector('.faq-q');
      btn.addEventListener('click', function () {
        var isOpen = item.classList.contains('open');
        // close all
        Array.prototype.forEach.call(list.children, function (c) {
          c.classList.remove('open');
          c.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
          c.querySelector('.faq-ic').innerHTML = plusSvg();
        });
        if (!isOpen) {
          item.classList.add('open');
          btn.setAttribute('aria-expanded', 'true');
          item.querySelector('.faq-ic').innerHTML = minusSvg();
        }
      });
      list.appendChild(item);
    });
  }
  function plusSvg() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'; }
  function minusSvg() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>'; }

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
      { type: 'them', text: 'That can affect your cycle. Let us start with a thyroid + PCOS panel. Sharing a plan now.' }
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
    renderCategories();
    renderExperts();
    renderVideos();
    renderReviews();
    renderFAQ();
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
