// Packed & Co. v2: gallery, bundles, sticky buy bar, name preview, scroll reveals. No dependencies.
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- gallery: swipe (scroll-snap) on phones, grid on desktop; dots + "what fits inside" jump ----
  var slides = document.getElementById('slides');
  if (slides) {
    var items = slides.children;
    var dots = document.querySelectorAll('.dots button');
    var isRow = function () { return getComputedStyle(slides).display === 'flex'; };
    var go = function (i) {
      var el = items[i];
      if (!el) return;
      if (isRow()) slides.scrollTo({ left: el.offsetLeft, behavior: reduce ? 'auto' : 'smooth' });
      else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    };
    document.querySelectorAll('[data-go]').forEach(function (b) {
      b.addEventListener('click', function () { go(+b.dataset.go); });
    });
    var mark = function () {
      var i = Math.round(slides.scrollLeft / Math.max(1, slides.clientWidth));
      dots.forEach(function (d, k) { d.setAttribute('aria-current', k === i ? 'true' : 'false'); });
    };
    var t;
    slides.addEventListener('scroll', function () { clearTimeout(t); t = setTimeout(mark, 60); }, { passive: true });
  }

  // ---- bundle choice keeps price, buy link and tracking value in sync ----
  var buy = document.getElementById('buy');
  var price = document.getElementById('price');
  var stickyPrice = document.getElementById('sticky-price');
  function applyBundle(input) {
    if (!input || !buy) return;
    var p = 'A$' + input.dataset.price;
    if (price) price.textContent = p;
    if (stickyPrice) stickyPrice.textContent = p + ' · free shipping';
    if (input.dataset.link) {
      buy.href = input.dataset.link;
      buy.textContent = 'Buy now · ' + p;
      buy.dataset.price = input.dataset.price;
      buy.classList.remove('is-off');
      buy.removeAttribute('aria-disabled');
    } else {
      buy.href = '#';
      buy.textContent = 'Checkout opens soon';
      buy.classList.add('is-off');
      buy.setAttribute('aria-disabled', 'true');
    }
  }
  document.querySelectorAll('input[name="bundle"]').forEach(function (r) {
    r.addEventListener('change', function () { applyBundle(r); });
  });
  applyBundle(document.querySelector('input[name="bundle"]:checked'));
  if (buy) buy.addEventListener('click', function (e) {
    if (buy.classList.contains('is-off')) e.preventDefault();
  });

  // ---- sticky buy bar once the main button has scrolled away ----
  var sticky = document.getElementById('sticky-buy');
  if (sticky && buy) {
    // a scroll check, not IntersectionObserver: IO misses a jump from below the fold to above it
    var state = null, queued = false;
    var check = function () {
      queued = false;
      var on = buy.getBoundingClientRect().bottom < 0;
      if (on === state) return;
      state = on;
      sticky.classList.toggle('is-on', on);
      sticky.setAttribute('aria-hidden', on ? 'false' : 'true');
      var a = sticky.querySelector('a'); if (a) a.tabIndex = on ? 0 : -1;
      document.body.classList.toggle('has-sticky', on);
    };
    window.addEventListener('scroll', function () { if (!queued) { queued = true; requestAnimationFrame(check); } }, { passive: true });
    check();
    var sa = sticky.querySelector('a');
    var target = document.getElementById('preview') || buy;
    if (sa) sa.addEventListener('click', function (e) {
      e.preventDefault();
      target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      var f = target.id === 'preview' ? document.getElementById('np-input') : target;
      if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, reduce ? 0 : 450);
    });
  }

  // ---- name preview: SVG text on the photo's coordinates; shrink long names to fit the case front ----
  var input = document.getElementById('np-input');
  if (input) {
    var nameEl = document.getElementById('np-name');
    var img = document.getElementById('np-img');
    var folder = img.getAttribute('src').replace(/[^/]+$/, '');
    var base = parseFloat(nameEl.dataset.size), max = parseFloat(nameEl.dataset.max);
    var clean = function (v) { return v.replace(/[^A-Za-z0-9 ]/g, '').slice(0, 12); };
    var fit = function () {
      nameEl.setAttribute('font-size', base);
      var w = nameEl.getComputedTextLength ? nameEl.getComputedTextLength() : 0;
      if (w > max) nameEl.setAttribute('font-size', (base * max / w).toFixed(1));
    };
    input.addEventListener('input', function () {
      var v = clean(input.value);
      if (v !== input.value) input.value = v;
      nameEl.textContent = v || 'Your name';
      fit();
    });
    var pick = function (sel, b, fn) {
      document.querySelectorAll(sel).forEach(function (x) { x.classList.toggle('is-on', x === b); x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      fn();
    };
    document.querySelectorAll('.np-swatch').forEach(function (b) {
      b.addEventListener('click', function () {
        pick('.np-swatch', b, function () {
          var want = folder + b.dataset.img;
          img.dataset.want = want;
          img.classList.add('is-swapping');
          var next = new Image();
          next.onload = function () { if (img.dataset.want === want) { img.src = want; img.classList.remove('is-swapping'); } };
          next.onerror = function () { if (img.dataset.want === want) img.classList.remove('is-swapping'); };
          next.src = want;
        });
      });
    });
    document.querySelectorAll('.np-letter').forEach(function (b) {
      b.addEventListener('click', function () { pick('.np-letter', b, function () { nameEl.setAttribute('fill', 'url(#foil-' + b.dataset.tone + ')'); }); });
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit); else fit();
  }

  // ---- reveal on scroll, once ----
  var rv = document.querySelectorAll('.rv');
  if (reduce || !('IntersectionObserver' in window)) {
    rv.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    rv.forEach(function (el) { io.observe(el); });
  }

  // ---- video pause/play (WCAG 2.2.2: moving content over 5 s needs a pause) ----
  document.querySelectorAll('.vid').forEach(function (w) {
    var v = w.querySelector('video'), t = w.querySelector('.vid-toggle');
    if (!v || !t) return;
    var sync = function () { var p = v.paused; t.textContent = p ? 'Play' : 'Pause'; t.setAttribute('aria-label', p ? 'Play video' : 'Pause video'); t.setAttribute('aria-pressed', p ? 'true' : 'false'); };
    t.addEventListener('click', function () { if (v.paused) v.play(); else v.pause(); });
    v.addEventListener('play', sync); v.addEventListener('pause', sync);
    if (reduce) { v.pause(); v.removeAttribute('autoplay'); }
    sync();
  });

  // ---- videos: no autoplay for reduced motion ----
  if (reduce) document.querySelectorAll('video[autoplay]').forEach(function (v) { v.pause(); v.removeAttribute('autoplay'); v.controls = true; });
})();
