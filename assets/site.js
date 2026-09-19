/* راهبرد ایرانی — تنها جاوااسکریپت سایت.
   سه کار: بزرگ‌نمایی عکس، منوی اشتراک، جستجو.
   بدون کتابخانه بیرونی؛ اگر اجرا نشود سایت همچنان کامل خوانده می‌شود. */
(function () {
  'use strict';

  /* ── ۰. پخش ویدیو در همان صفحه ──
     تا کلیک نشود هیچ بایتی از ویدیو دانلود نمی‌شود؛ با کلیک، قاب جای خود را
     به یک پخش‌کننده واقعی می‌دهد و همان‌جا پخش می‌شود. */
  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-video]');
    if (!btn) return;

    var v = document.createElement('video');
    v.className = 'player';
    v.src = btn.dataset.video;
    if (btn.dataset.poster) v.poster = btn.dataset.poster;
    v.controls = true;
    v.playsInline = true;
    v.preload = 'metadata';
    v.setAttribute('controlsList', 'nodownload');
    // اندازه قاب حفظ شود تا صفحه نپرد
    v.style.aspectRatio = btn.style.aspectRatio || '';
    v.style.height = btn.style.height || '';

    btn.replaceWith(v);
    var go = v.play();
    if (go && go.catch) go.catch(function () { /* مرورگر اجازه نداد؛ دکمه پخش هست */ });

    // با شروع یک ویدیو، بقیه متوقف شوند
    v.addEventListener('play', function () {
      document.querySelectorAll('video.player').forEach(function (other) {
        if (other !== v) other.pause();
      });
    });
  });

  /* ── ۱. بزرگ‌نمایی عکس ── */
  var lb = document.getElementById('lb');
  if (lb) {
    var img = lb.querySelector('img');
    var cap = lb.querySelector('figcaption');

    function open(src, text) {
      if (!src) return;
      img.src = src;
      cap.textContent = text || '';
      cap.hidden = !text;
      lb.hidden = false;
      document.body.style.overflow = 'hidden';
    }
    function close() {
      lb.hidden = true;
      img.src = '';
      document.body.style.overflow = '';
    }

    document.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-full]');
      if (btn && btn.dataset.full) { open(btn.dataset.full, btn.dataset.cap); return; }
      if (ev.target.closest('.lightbox__close') || ev.target === lb) close();
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !lb.hidden) close();
    });
  }

  /* ── ۲. منوی اشتراک ── */
  var SHARE = [
    ['تلگرام', 'https://t.me/share/url?url='],
    ['واتساپ', 'https://wa.me/?text='],
    ['ایکس', 'https://twitter.com/intent/tweet?url=']
  ];

  document.addEventListener('click', function (ev) {
    var open = document.querySelector('.sharemenu');
    var btn = ev.target.closest('.share');
    if (open && (!btn || open.previousElementSibling === btn)) {
      var owner = open.previousElementSibling;
      if (owner) owner.setAttribute('aria-expanded', 'false');
      open.remove();
      if (!btn) return;
      if (open.previousElementSibling === btn) return;
    }
    if (!btn) return;

    var url = new URL(btn.dataset.url || location.href, location.href).href;
    var menu = document.createElement('div');
    menu.className = 'sharemenu';
    SHARE.forEach(function (s) {
      var a = document.createElement('a');
      a.href = s[1] + encodeURIComponent(url);
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = s[0];
      menu.appendChild(a);
    });
    var copy = document.createElement('button');
    copy.type = 'button';
    copy.textContent = 'کپی نشانی';
    copy.addEventListener('click', function () {
      if (navigator.clipboard) navigator.clipboard.writeText(url);
      copy.textContent = 'کپی شد';
    });
    menu.appendChild(copy);
    btn.setAttribute('aria-expanded', 'true');
    btn.insertAdjacentElement('afterend', menu);
  });

  /* ── ۳. جستجو ── */
  var q = document.getElementById('q');
  if (!q) return;

  var results = document.getElementById('results');
  var note = document.getElementById('searchnote');
  var moreBtn = document.getElementById('more');
  var state = { place: '', days: '', media: false, breaking: false, shown: 20 };
  var data = null;
  var PAGE = 20;


  function normalize(s) {
    return (s || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\u200c/g, ' ');
  }

  function escape(s) {
    return s.replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function highlight(text, term) {
    var flat = normalize(text), hit = flat.indexOf(term);
    if (hit < 0) return escape(text.slice(0, 220));
    var from = Math.max(0, hit - 70);
    var slice = text.slice(from, from + 240);
    var at = normalize(slice).indexOf(term);
    return (from ? '…' : '') + escape(slice.slice(0, at)) +
      '<mark>' + escape(slice.slice(at, at + term.length)) + '</mark>' +
      escape(slice.slice(at + term.length)) + '…';
  }

  function matches(p, term) {
    if (state.place && (p.p || []).indexOf(state.place) < 0) return false;
    if (state.media && !p.m) return false;
    if (state.breaking && !p.b) return false;
    if (state.days) {
      var edge = new Date();
      edge.setDate(edge.getDate() - (+state.days));
      if (new Date(p.w) < edge) return false;
    }
    return normalize((p.h || '') + ' ' + p.t + ' ' + p.s).indexOf(term) >= 0;
  }

  function run(keepShown) {
    if (!keepShown) state.shown = PAGE;
    var term = normalize(q.value.trim());
    if (!data || term.length < 2) {
      results.innerHTML = '';
      moreBtn.hidden = true;
      note.textContent = term ? 'دست‌کم دو حرف بنویسید.' : 'برای دیدن نتیجه‌ها چیزی بنویسید.';
      return;
    }
    var hits = data.posts.filter(function (p) { return matches(p, term); });
    note.innerHTML = hits.length
      ? hits.length.toLocaleString('fa') + ' نتیجه برای «' + escape(q.value.trim()) + '»'
      : 'چیزی پیدا نشد.';
    results.innerHTML = hits.slice(0, state.shown).map(function (p) {
      return '<a class="result" href="' + p.u + '">' +
        (p.h ? '<b class="result__title">' + highlight(p.h, term) + '</b>' : '') +
        (p.s ? '<b class="result__src">' + escape(p.s) + '</b>' : '') +
        '<span class="result__text">' + highlight(p.t, term) + '</span>' +
        '<span class="result__meta">' + escape(p.d) + '</span></a>';
    }).join('');
    moreBtn.hidden = hits.length <= state.shown;
  }

  fetch('search-index.json')
    .then(function (r) { return r.json(); })
    .then(function (j) { data = j; run(); })
    .catch(function () { note.textContent = 'نمایه جستجو بار نشد.'; });

  q.addEventListener('input', function () { run(); });
  moreBtn.addEventListener('click', function () { state.shown += PAGE; run(true); });

  // چیپ‌های تک‌انتخابی: منطقه و بازه
  [['places', 'place'], ['spans', 'days']].forEach(function (pair) {
    var box = document.getElementById(pair[0]);
    if (!box) return;
    box.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-' + pair[1] + ']');
      if (!b) return;
      state[pair[1]] = pair[1] === 'place' ? b.dataset.place : b.dataset.days;
      box.querySelectorAll('.pill').forEach(function (x) {
        x.classList.toggle('is-on', x === b);
        x.classList.toggle('pill--strong', x === b);
      });
      run();
    });
  });

  // کلیدهای دوحالته
  var flags = document.getElementById('flags');
  if (flags) {
    flags.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-flag]');
      if (!b) return;
      var key = b.dataset.flag;
      state[key] = !state[key];
      b.classList.toggle('is-on', state[key]);
      b.classList.toggle('pill--strong', state[key]);
      run();
    });
  }
})();
