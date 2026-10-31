/* Sahil Singh Pawar — Portfolio interactions (shared by every page) */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Loader / arrival curtain ---------- */
  const root = document.documentElement;
  let readyFired = false;
  const ready = () => { root.classList.add('ready'); if (!readyFired) { readyFired = true; document.dispatchEvent(new Event('site:ready')); } };
  let fromNav = false; try { fromNav = sessionStorage.getItem('ssp-nav') === '1'; sessionStorage.removeItem('ssp-nav'); } catch (e) {}
  const loader = $('.loader');
  const isHome = !!document.querySelector('.timeline');
  let entered = false; try { entered = sessionStorage.getItem('ssp-entered') === '1'; } catch (e) {}
  if (reduce) { loader?.remove(); ready(); }
  else if (fromNav) {
    // Came from another page on this site: skip the long loader, lift the curtain instead
    loader?.remove();
    root.classList.add('arriving');
    requestAnimationFrame(() => requestAnimationFrame(() => { root.classList.remove('arriving'); root.classList.add('arrived'); }));
    setTimeout(ready, 250);
  } else if (loader && entered && !isHome) {
    loader.remove(); ready();
  } else if (loader) {
    // Count up while the lines arrive, then hold until the visitor chooses to enter
    const pct = $('.pct', loader); let n = 0, waiting = false, finished = false;
    const finish = () => {
      if (!waiting || finished) return; finished = true;
      try { sessionStorage.setItem('ssp-entered', '1'); } catch (e) {}
      loader.classList.remove('wait'); loader.classList.add('leave');
      setTimeout(() => { loader.classList.add('gone'); ready(); }, 650);
      setTimeout(() => loader.remove(), 1700);
    };
    const t = setInterval(() => {
      n = Math.min(100, n + 1 + Math.round(Math.random() * 4));
      pct.textContent = '▸ ' + n + '%';
      if (n >= 100) { clearInterval(t); setTimeout(() => { waiting = true; loader.classList.add('wait'); loader.focus({ preventScroll: true }); }, 300); }
    }, 32);
    loader.addEventListener('click', finish);
    loader.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); finish(); } });
    document.documentElement.style.overflow = 'hidden';
    document.addEventListener('site:ready', () => { document.documentElement.style.overflow = ''; }, { once: true });
  } else if (!$('.splash')) ready();

  /* ---------- Home splash: VR hero that morphs into the timeline ---------- */
  const splash = $('.splash'), space = $('.intro-space');
  if (splash && space) {
    root.classList.add('splash-on');
    const bg = $('.sp-bg', splash), slot = $('.sp-pslot', splash), por = $('.sp-portrait', splash), img = $('img', por);
    const w1 = $('.sp-w1', splash), w2 = $('.sp-w2', splash), nav = $('.sp-nav', splash), rowCards = $$('.sp-c', splash);
    const calls = $$('.sp-call', splash), dots = $$('.sp-dot', splash), paths = $$('.sp-lines path', splash), card = $('.sp-front', splash);
    const frameEl = $('.timeline .stage .lines'), cluster0 = $('.timeline .cluster'), tile0 = cluster0 && $('.t-art', cluster0);
    // points on the headset (fractions of the square photo) each callout points at
    const ANCHORS = [[0.345, 0.47], [0.63, 0.33]];
    const clamp = v => Math.min(1, Math.max(0, v));
    const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const seg = (p, a, b) => ease(clamp((p - a) / (b - a)));
    const lerp = (a, b, t) => a + (b - a) * t;
    const R = el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
    let spaceH = 1, start = null, cardR = null, p = 0, pt = 0, mx = 0, my = 0, tmx = 0, tmy = 0, raf = 0, lastT = 0, busy = false, readyDone = false;

    // bottom cards: slanted seams with rounded corners (clip-path paths need pixels, so build them here)
    const pill = $('.sp-pill', splash);
    const roundPoly = (pts, rs) => pts.map((pt, i) => {
      const a = pts[(i + pts.length - 1) % pts.length], b = pts[(i + 1) % pts.length], r = rs[i];
      const u = (q) => { const dx = q[0] - pt[0], dy = q[1] - pt[1], l = Math.hypot(dx, dy) || 1, k = Math.min(r, l / 2) / l; return [pt[0] + dx * k, pt[1] + dy * k]; };
      const p1 = u(a), p2 = u(b);
      return `${i ? 'L' : 'M'}${p1[0].toFixed(1)} ${p1[1].toFixed(1)} Q${pt[0]} ${pt[1]} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }).join(' ') + 'Z';
    const shapeCards = () => {
      const R0 = parseFloat(getComputedStyle(splash).getPropertyValue('--sp-r')) || 22, r1 = 12;
      const sl = parseFloat(getComputedStyle(rowCards[0].parentNode).getPropertyValue('--sl')) || 30;
      rowCards.forEach((c, i) => {
        const w = c.offsetWidth, h = c.offsetHeight; if (!w) return;
        const pts = i === 0 ? [[0, 0], [w, 0], [w - sl, h], [0, h]]
                  : i === 1 ? [[sl, 0], [w - sl, 0], [w, h], [0, h]]
                  :           [[0, 0], [w, 0], [w, h], [sl, h]];
        const rs = i === 0 ? [R0, r1, r1, R0] : i === 1 ? [r1, r1, R0, R0] : [R0, R0, R0, r1];
        c.style.clipPath = `path('${roundPoly(pts, rs)}')`;
      });
    };
    const measure = () => {
      spaceH = space.offsetHeight || innerHeight; shapeCards();
      start = R(slot); cardR = R(card);
      pt = clamp(scrollY / spaceH);
    };
    // targets are measured where they WILL rest when the intro finishes, so nothing chases the rising stage
    const rest = () => Math.max(0, spaceH - scrollY);
    const tileRect = () => {
      if (!tile0) return { x: innerWidth * .2, y: innerHeight * .25, w: innerWidth * .3, h: innerHeight * .4 };
      const c = cluster0.getBoundingClientRect();
      return { x: c.left + tile0.offsetLeft, y: c.top + tile0.offsetTop - rest(), w: tile0.offsetWidth, h: tile0.offsetHeight };
    };
    const frameRect = () => { if (!frameEl) return cardR; const r = R(frameEl); r.y -= rest(); return r; };
    const insetOf = r => `inset(${r.y}px ${innerWidth - r.x - r.w}px ${innerHeight - r.y - r.h}px ${r.x}px round `;

    const render = () => {
      const q = reduce ? 0 : p;                       // reduced motion: crossfade only, nothing travels
      // 1 — blue card shrinks/grows into the timeline's guide-line frame and fades to paper
      const f = frameRect(), k = seg(q, 0, .8);
      const box = { x: lerp(cardR.x, f.x, k), y: lerp(cardR.y, f.y, k), w: lerp(cardR.w, f.w, k), h: lerp(cardR.h, f.h, k) };
      bg.style.clipPath = insetOf(box) + lerp(22, 0, k).toFixed(1) + 'px)';
      bg.style.opacity = (1 - seg(p, .32, .85)).toFixed(3);
      $('.sp-backdrop', splash).style.opacity = (1 - seg(p, .15, .6)).toFixed(3);
      // 2 — portrait flies into the first project tile, then hands over to it
      const t = tileRect(), kp = seg(q, .08, .92);
      const pr = { x: lerp(start.x, t.x, kp), y: lerp(start.y, t.y, kp), w: lerp(start.w, t.w, kp), h: lerp(start.h, t.h, kp) };
      por.style.cssText = `left:${pr.x}px;top:${pr.y}px;width:${pr.w}px;height:${pr.h}px;opacity:${(1 - seg(p, .82, 1)).toFixed(3)};--pk:${seg(q, .12, .7).toFixed(3)};--fade:${((1 - seg(q, 0, .2)) * 12).toFixed(2)}%`;
      por.style.setProperty('--ix', (mx * -10 * (1 - kp)).toFixed(2) + 'px');
      por.style.setProperty('--iy', (my * -6 * (1 - kp)).toFixed(2) + 'px');
      // 3 — the name splits apart, nav lifts, cards drop, callouts retract
      const kw = seg(q, 0, .55);
      w1.style.setProperty('--wx', (mx * 14 - kw * innerWidth * .35).toFixed(1) + 'px'); w1.style.setProperty('--wy', (my * 8 - kw * 40).toFixed(1) + 'px');
      w2.style.setProperty('--wx', (mx * -18 + kw * innerWidth * .35).toFixed(1) + 'px'); w2.style.setProperty('--wy', (my * -8 + kw * 40).toFixed(1) + 'px');
      w1.style.opacity = w2.style.opacity = (1 - seg(p, .05, .5)).toFixed(3);
      nav.style.transform = `translate3d(0,${(-seg(q, 0, .3) * 60).toFixed(1)}px,0)`; nav.style.opacity = (1 - seg(p, 0, .25)).toFixed(3);
      rowCards.forEach((c, i) => { const kc = seg(q, i * .05, .38 + i * .05); c.style.setProperty('--ry', (kc * innerHeight * .3).toFixed(1) + 'px'); c.style.opacity = (1 - seg(p, i * .05, .32 + i * .05)).toFixed(3); });
      pill.style.transform = `translate3d(0,${(seg(q, .05, .43) * innerHeight * .3).toFixed(1)}px,0)`; if (splash.classList.contains('in')) pill.style.opacity = (1 - seg(p, .02, .3)).toFixed(3);
      const kc = 1 - seg(p, 0, .28);
      calls.forEach((c, i) => {
        c.style.setProperty('--cx', (mx * (i ? -6 : 6)).toFixed(1) + 'px'); c.style.setProperty('--cy', (my * 5).toFixed(1) + 'px'); c.style.opacity = kc.toFixed(3);
        // dot on the headset, mapped through object-fit:cover of the (moving) portrait
        const S = Math.max(pr.w, pr.h), ox = (pr.w - S) * .5, oy = (pr.h - S) * .18;
        const dx = pr.x + ox + ANCHORS[i][0] * S + mx * -10 * (1 - kp) - cardR.x, dy = pr.y + oy + ANCHORS[i][1] * S + my * -6 * (1 - kp) - cardR.y;
        dots[i].style.setProperty('--dx', dx.toFixed(1) + 'px'); dots[i].style.setProperty('--dy', dy.toFixed(1) + 'px'); dots[i].style.opacity = kc.toFixed(3);
        const cr = c.getBoundingClientRect(), th = $('.th', c).getBoundingClientRect();
        const ax = (i ? cr.left - 12 : cr.right + 12) - cardR.x, ay = th.top + th.height / 2 - cardR.y;
        const mxp = i ? Math.max(dx + 30, ax - 60) : Math.min(dx - 30, ax + 60);
        paths[i].setAttribute('d', `M${ax.toFixed(1)} ${ay.toFixed(1)} H${mxp.toFixed(1)} L${dx.toFixed(1)} ${dy.toFixed(1)}`);
        paths[i].style.opacity = kc.toFixed(3);
      });
      if (reduce) splash.style.opacity = (1 - p).toFixed(3);
      splash.classList.toggle('live', p < .3);
      splash.classList.toggle('off', p > .999);
      if (!readyDone && p > .22) { readyDone = true; try { sessionStorage.setItem('ssp-entered', '1'); } catch (e) {} ready(); }
    };

    const tick = now => {
      const dt = Math.min(64, now - (lastT || now)); lastT = now;
      const a = 1 - Math.exp(-dt / (busy ? 60 : 90));
      p += (pt - p) * a; mx += (tmx - mx) * a * .6; my += (tmy - my) * a * .6;
      if (reduce || Math.abs(pt - p) < .0004) p = pt;
      if (p > 0 && p < 1) splash.classList.add('morphing'); else splash.classList.remove('morphing');
      render();
      const still = p === pt && Math.abs(tmx - mx) < .002 && Math.abs(tmy - my) < .002;
      raf = still ? 0 : requestAnimationFrame(tick);
      if (!raf) lastT = 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

    addEventListener('scroll', () => { pt = clamp(scrollY / spaceH); kick(); }, { passive: true });
    addEventListener('resize', () => { measure(); render(); kick(); });
    if (matchMedia('(hover:hover)').matches && !reduce) addEventListener('pointermove', e => {
      if (p > .5) return; tmx = e.clientX / innerWidth - .5; tmy = e.clientY / innerHeight - .5; kick();
    }, { passive: true });

    // Enter: the same transition as scrolling, driven by a tween of the real scroll position
    const block = e => { if (busy) e.preventDefault(); };
    ['wheel', 'touchmove'].forEach(ev => addEventListener(ev, block, { passive: false }));
    const go = () => {
      if (busy || scrollY >= spaceH - 2) return;
      busy = true; splash.classList.add('morphing');
      const from = scrollY, dur = reduce ? 0 : 1500, t0 = performance.now();
      const step = now => {
        const k = dur ? clamp((now - t0) / dur) : 1;
        scrollTo(0, from + (spaceH - from) * ease(k));
        if (k < 1) requestAnimationFrame(step);
        else { busy = false; $('#main')?.focus({ preventScroll: true }); }
      };
      requestAnimationFrame(step);
    };
    $$('.sp-go', splash).forEach(b => b.addEventListener('click', go));
    addEventListener('keydown', e => {
      if (e.key !== 'Enter' || scrollY >= spaceH - 2 || e.target.closest('a,button,input,textarea,select')) return;
      e.preventDefault(); go();
    });
    addEventListener('keydown', e => { if (busy && [' ', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) e.preventDefault(); });

    // Returning visitors (this session, or arriving from another page) land on the timeline
    measure();
    if (entered || fromNav) { scrollTo(0, spaceH); pt = p = 1; readyDone = true; ready(); }
    else if (reduce) { readyDone = true; }
    else { p = pt; }
    render();
    const show = () => requestAnimationFrame(() => splash.classList.add('in'));
    (img.decode ? img.decode() : Promise.resolve()).then(show, show);
    setTimeout(show, 2500);
    if (document.fonts) document.fonts.ready.then(() => { measure(); render(); });
  }

  /* ---------- Full case-study boards: expand / collapse ---------- */
  $$('.cf-toggle').forEach(btn => {
    const board = document.getElementById(btn.getAttribute('aria-controls')), label = $('span', btn);
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', open); board.classList.toggle('open', open);
      label.textContent = open ? 'Show less' : 'Show full case study';
      btn.lastChild.textContent = open ? ' ↑' : ' ↓';
      if (!open) board.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
  });

  /* ---------- Curtain on the way out to another page ---------- */
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const href = a.getAttribute('href');
    if (a.target === '_blank' || !/^[\w-]+\.html(#.*)?$/.test(href) || reduce) return;
    e.preventDefault();
    let goBack = false;
    if (a.hasAttribute('data-back')) {
      try { goBack = !!document.referrer && new URL(document.referrer).origin === location.origin && location.origin !== 'null' && history.length > 1; } catch (err) {}
    }
    try { sessionStorage.setItem('ssp-nav', '1'); } catch (err) {}
    document.body.classList.remove('menu-open');
    root.classList.add('leaving');
    setTimeout(() => { if (goBack) history.back(); else location.href = href; }, 720);
  });
  addEventListener('pageshow', e => { if (e.persisted) { root.classList.remove('leaving', 'arriving'); ready(); } });

  /* ---------- Split headings into lines, reveal things on scroll ---------- */
  $$('[data-split]').forEach(el => {
    el.innerHTML = el.innerHTML.split(/<br\s*\/?>/i).map(l => `<span class="ln"><span>${l.trim()}</span></span>`).join('');
  });
  $$('[data-stagger]').forEach(list => [...list.children].forEach((c, i) => c.style.setProperty('--i', Math.min(i, 12))));
  const revealables = $$('[data-split],[data-reveal],[data-stagger],.statement,.site-foot .big');
  const startReveals = () => {
    if (!('IntersectionObserver' in window)) { revealables.forEach(el => el.classList.add('in')); return; }
    // Elements hidden with clip-path report no intersection, so watch their parent instead
    const proxy = new Map();
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting) return;
      (proxy.get(en.target) || [en.target]).forEach(el => el.classList.add('in'));
      io.unobserve(en.target);
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
    revealables.forEach(el => {
      const clipped = getComputedStyle(el).clipPath !== 'none';
      const watch = clipped ? el.parentElement : el;
      if (clipped) { if (!proxy.has(watch)) proxy.set(watch, []); proxy.get(watch).push(el); }
      io.observe(watch);
    });
  };
  if (readyFired) startReveals(); else document.addEventListener('site:ready', startReveals, { once: true });

  /* ---------- Sound: soft mechanical click/tick on hover (off by default) ---------- */
  let ctx = null, noiseBuf = null, lastTick = 0;
  const click = (t, freq, q, vol, dur) => {
    // one mechanical transient: a tiny burst of noise through a resonant band-pass
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.0008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(hp).connect(g).connect(ctx.destination);
    src.start(t, Math.random() * 0.05); src.stop(t + dur + 0.01);
  };
  const tickSound = () => {
    if (!document.body.classList.contains('sound-on')) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      if (!noiseBuf) {
        noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.1), ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const now = ctx.currentTime;
      if (now - lastTick < 0.045) return;          // don't machine-gun on fast mouse moves
      lastTick = now;
      const v = 0.9 + Math.random() * 0.2;          // slight variation so it feels physical
      click(now, 3600 * v, 6, 0.22, 0.012);          // crisp "tick"
      click(now + 0.018, 1900 * v, 5, 0.08, 0.02);   // softer "tock" release
    } catch (e) {}
  };
  document.addEventListener('pointerover', e => { if (e.target.closest('a,button')) tickSound(); });

  /* ---------- Rail toggles: sound + annotations ---------- */
  const setToggle = (btn, on) => {
    btn.setAttribute('aria-pressed', on);
    document.body.classList.toggle(btn.dataset.on, on);
    if (btn.dataset.off) document.body.classList.toggle(btn.dataset.off, !on);
  };
  $$('[data-toggle]').forEach(btn => {
    const key = 'ssp-' + btn.dataset.toggle;
    const saved = store.get(key);
    setToggle(btn, saved === null ? btn.getAttribute('aria-pressed') === 'true' : saved === '1');
    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      setToggle(btn, on); store.set(key, on ? '1' : '0'); if (on) tickSound();
    });
  });

  /* ---------- Background music: soft, looping, on by default, remembers its place across pages ---------- */
  const musicBtn = $('[data-toggle="music"]');
  if (musicBtn) {
    const VOL = 0.09;                                   // soft background level (track is also mastered quieter & warmer)
    const music = new Audio(); music.src = 'audio/bg-music.mp3'; music.loop = true; music.preload = 'none'; music.volume = 0;
    let fadeRaf = 0, started = false;
    const fadeTo = (target, ms, done) => {
      cancelAnimationFrame(fadeRaf);
      const from = music.volume, t0 = performance.now();
      const step = now => {
        const k = Math.min(1, (now - t0) / ms);
        music.volume = Math.max(0, Math.min(1, from + (target - from) * k));
        if (k < 1) fadeRaf = requestAnimationFrame(step); else if (done) done();
      };
      fadeRaf = requestAnimationFrame(step);
    };
    const wanted = () => musicBtn.getAttribute('aria-pressed') === 'true';
    let saved = null; try { saved = JSON.parse(sessionStorage.getItem('ssp-music') || 'null'); } catch (e) {}
    const play = () => {
      if (!wanted() || document.hidden) return;
      if (!started && saved && saved.t) { try { music.currentTime = saved.t; } catch (e) {} }
      const p = music.play();
      if (p) p.then(() => { started = true; fadeTo(VOL, started && saved ? 1500 : 4000); }).catch(() => {});
    };
    const pause = () => fadeTo(0, 600, () => music.pause());
    // browsers only allow sound after a visitor interacts: start on the first click / tap / key
    const firstGesture = () => { ['pointerdown', 'keydown', 'touchstart'].forEach(ev => removeEventListener(ev, firstGesture, true)); if (music.paused) play(); };
    ['pointerdown', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, firstGesture, true));
    if (saved && saved.on) play();                      // already playing on the previous page: carry on
    musicBtn.addEventListener('click', () => { wanted() ? play() : pause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { if (!music.paused) pause(); } else if (started) play(); });
    addEventListener('pagehide', () => { try { sessionStorage.setItem('ssp-music', JSON.stringify({ on: !music.paused && wanted(), t: music.currentTime || 0 })); } catch (e) {} });
  }

  /* ---------- About portrait: drifts gently toward the cursor ---------- */
  const me = $('.me');
  if (me && !reduce && matchMedia('(hover:hover)').matches) {
    me.addEventListener('pointermove', e => {
      const r = me.getBoundingClientRect();
      me.style.setProperty('--tx', (((e.clientX - r.left) / r.width - .5) * 10).toFixed(1) + 'px');
      me.style.setProperty('--ty', (((e.clientY - r.top) / r.height - .5) * 6).toFixed(1) + 'px');
    });
    me.addEventListener('pointerleave', () => { me.style.setProperty('--tx', '0px'); me.style.setProperty('--ty', '0px'); });
  }

  /* ---------- Looping videos: play only while visible; still poster for reduced motion ---------- */
  const vids = $$('video.loop-vid');
  if (vids.length) {
    vids.forEach(v => { v.muted = true; v.setAttribute('muted', ''); if (reduce) { v.removeAttribute('autoplay'); v.pause(); } });
    if (!reduce && 'IntersectionObserver' in window) {
      const vio = new IntersectionObserver(es => es.forEach(en => {
        const v = en.target;
        if (en.isIntersecting) { const p = v.play(); if (p) p.catch(() => {}); } else v.pause();
      }), { threshold: 0.15 });
      vids.forEach(v => vio.observe(v));
    }
  }

  /* ---------- Menu overlay ---------- */
  const menu = $('#menu'), menuBtn = $('#menu-btn');
  if (menu && menuBtn) {
    const focusables = () => $$('a,button', menu);
    const open = () => {
      document.body.classList.add('menu-open'); menu.removeAttribute('inert'); menu.setAttribute('aria-hidden', 'false');
      menuBtn.setAttribute('aria-expanded', 'true'); menuBtn.firstElementChild.textContent = 'Close';
      setTimeout(() => focusables()[0]?.focus(), reduce ? 0 : 400);
    };
    const close = () => {
      document.body.classList.remove('menu-open'); menu.setAttribute('inert', ''); menu.setAttribute('aria-hidden', 'true');
      menuBtn.setAttribute('aria-expanded', 'false'); menuBtn.firstElementChild.textContent = 'Menu'; menuBtn.focus();
    };
    menuBtn.addEventListener('click', () => document.body.classList.contains('menu-open') ? close() : open());
    document.addEventListener('keydown', e => {
      if (!document.body.classList.contains('menu-open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') { // keep focus inside the menu (+ its close button)
        const f = [...focusables(), menuBtn], i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    });
  }

  /* ---------- Home: scroll-driven horizontal timeline ---------- */
  const tl = $('.timeline');
  if (tl) {
    const stage = $('.stage', tl), track = $('.track', tl), clusters = $$('.cluster', tl);
    const idx = $('.nowbar .idx'), name = $('.nowbar .name'), go = $('.nowbar .go');
    let last = -1;
    const layout = () => {
      const ph = stage.clientWidth * 0.2;
      stage.style.setProperty('--ph', ph + 'px');
      const lastC = clusters[clusters.length - 1];
      const end = lastC.offsetLeft + lastC.offsetWidth * 0.4;   // track x that should finish under the playhead
      const start = clusters[0].offsetLeft + clusters[0].offsetWidth * 0.05;
      const rect = tl.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -rect.top / (tl.offsetHeight - innerHeight)));
      const x = start + (end - start) * p;                       // track x currently under the playhead
      track.style.transform = `translate3d(${ph - x}px,0,0)`;
      clusters.forEach(c => {
        const rel = x - (c.offsetLeft + c.offsetWidth * 0.3);
        if (Math.abs(rel) < c.offsetWidth * 1.5) c.querySelectorAll('[data-d]').forEach(t => t.style.setProperty('--px', (rel * parseFloat(t.dataset.d)).toFixed(1) + 'px'));
      });
      let cur = 0;
      clusters.forEach((c, i) => { if (x >= c.offsetLeft - c.offsetWidth * 0.45) cur = i; });
      if (cur !== last) {
        last = cur;
        clusters.forEach((c, i) => c.classList.toggle('on', i === cur));
        const c = clusters[cur];
        [idx, name].forEach(el => { el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap'); });
        idx.textContent = String(cur + 1).padStart(2, '0');
        name.textContent = c.dataset.name;
        go.href = c.dataset.href;
        go.setAttribute('aria-label', 'View project: ' + c.dataset.name);
      }
    };
    addEventListener('scroll', () => requestAnimationFrame(layout), { passive: true });
    addEventListener('resize', layout); layout();
  }

  /* ---------- Home: hover a project on the timeline ---------- */
  const tlTrack = $('.timeline .track');
  if (tlTrack && matchMedia('(hover:hover)').matches) {
    const cs = $$('.cluster', tlTrack);
    const nIdx = $('.nowbar .idx'), nName = $('.nowbar .name'), nGo = $('.nowbar .go');
    const cursor = document.createElement('div');
    cursor.className = 'cursor'; cursor.setAttribute('aria-hidden', 'true');
    cursor.innerHTML = '<span>View ▸</span><em class="note"></em>';
    document.body.appendChild(cursor);
    let mx = 0, my = 0, cx = 0, cy = 0, raf = 0;
    const follow = () => {
      cx += (mx - cx) * 0.18; cy += (my - cy) * 0.18;
      cursor.style.transform = `translate3d(${cx}px,${cy}px,0)`;
      raf = Math.abs(mx - cx) + Math.abs(my - cy) > 0.3 ? requestAnimationFrame(follow) : 0;
    };
    const stage = $('.timeline .stage');
    stage.addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; if (!raf) raf = requestAnimationFrame(follow); });
    stage.addEventListener('pointerenter', e => { cx = mx = e.clientX; cy = my = e.clientY; cursor.classList.add('on'); });
    stage.addEventListener('pointerleave', () => cursor.classList.remove('on', 'big'));
    const show = (c, i) => {
      [nIdx, nName].forEach(el => { el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap'); });
      nIdx.textContent = String(i + 1).padStart(2, '0'); nName.textContent = c.dataset.name; nGo.href = c.dataset.href;
    };
    cs.forEach((c, i) => {
      const tiles = $$('.tile', c);
      const enter = () => {
        c.classList.add('hover'); tlTrack.classList.add('hovering');
        cursor.classList.add('big'); $('.note', cursor).textContent = c.dataset.name;
        show(c, i);
      };
      const leave = e => {
        const to = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.tile'); if (to && c.contains(to)) return;
        c.classList.remove('hover'); tlTrack.classList.remove('hovering'); cursor.classList.remove('big');
        const on = cs.findIndex(x => x.classList.contains('on')); if (on > -1) show(cs[on], on);
      };
      tiles.forEach(t => {
        t.addEventListener('pointerenter', enter);
        t.addEventListener('pointerleave', leave);
        if (!t.matches('a')) t.addEventListener('click', () => $('.t-art', c).click());
      });
    });
    /* Ribbon tabs: dock-style magnify + name tip */
    const ribbon = $('.ribbon', tlTrack);
    if (ribbon) {
      const tabs = $$('.rb', ribbon), tip = $('.rb-tip', ribbon), label = $('span', cursor);
      const SCALE = [2.5, 1.75, 1.35, 1.12];
      let hotI = -1;
      const placeTip = () => { if (hotI > -1) { const t = tabs[hotI]; tip.style.left = (t.offsetLeft + t.offsetWidth / 2) + 'px'; } };
      ribbon.addEventListener('pointerover', e => {
        const t = e.target.closest('.rb'); if (!t) return;
        const i = tabs.indexOf(t); if (i === hotI) return; hotI = i;
        ribbon.classList.add('active');
        tabs.forEach((x, j) => {
          const d = Math.abs(j - i);
          x.style.setProperty('--s', d < SCALE.length ? SCALE[d] : 1);
          x.classList.toggle('hot', d === 0); x.classList.toggle('near', d > 0 && d < 3);
        });
        // keep the hovered tab centred where it was, so growth doesn't slide another tab under the cursor
        const w0 = Math.max(innerWidth, innerHeight) * 0.052, gap = 6;
        let c = 0; for (let j = 0; j < i; j++) { const d = i - j; c += w0 * (d < SCALE.length ? SCALE[d] : 1) + gap; }
        c += w0 * SCALE[0] / 2;
        ribbon.style.transform = `translateX(${(i * (w0 + gap) + w0 / 2) - c}px)`;
        tip.textContent = t.dataset.name + (t.target === '_blank' ? '  ↗' : '  →'); tip.classList.add('on');
        cursor.classList.remove('big');
        const t0 = performance.now(); const loop = () => { placeTip(); if (performance.now() - t0 < 320) requestAnimationFrame(loop); }; loop();
      });
      ribbon.addEventListener('pointerleave', () => {
        hotI = -1; ribbon.classList.remove('active'); tip.classList.remove('on'); ribbon.style.transform = '';
        tabs.forEach(x => { x.style.removeProperty('--s'); x.classList.remove('hot', 'near'); });
        
      });
    }
  }
  document.addEventListener('site:ready', () => setTimeout(() => document.documentElement.classList.add('intro-done'), 1600));

  /* ---------- Work page: filters + hover preview ---------- */
  const filters = $$('.filter');
  if (filters.length) {
    const rows = $$('.row[data-cat]');
    filters.forEach(b => {
      const c = b.dataset.filter;
      const n = c === 'all' ? rows.length : rows.filter(r => r.dataset.cat.split(' ').includes(c)).length;
      b.insertAdjacentHTML('beforeend', `<sup>${n}</sup>`); if (!n) b.disabled = true;
      b.addEventListener('click', () => {
        filters.forEach(f => f.setAttribute('aria-pressed', f === b));
        let shown = 0;
        rows.forEach(r => { const on = c === 'all' || r.dataset.cat.split(' ').includes(c); r.classList.toggle('is-hidden', !on); if (on) shown++; });
        const s = $('#filter-status'); if (s) s.textContent = `${shown} projects shown`;
      });
    });
    const want = location.hash.slice(1);
    const match = filters.find(f => f.dataset.filter === want);
    if (match) match.click();
  }
  const peek = $('.peek');
  if (peek && matchMedia('(hover:hover)').matches) {
    $$('.row[data-art]').forEach(r => {
      r.addEventListener('pointerenter', () => { peek.innerHTML = r.dataset.img ? `<img src="${r.dataset.img}" alt="">` : `<div class="art art--${r.dataset.art}"></div>`; peek.classList.add('show'); });
      r.addEventListener('pointerleave', () => peek.classList.remove('show'));
      r.addEventListener('pointermove', e => { peek.style.left = e.clientX + 'px'; peek.style.top = e.clientY + 'px'; });
    });
  }

  /* ---------- Figma embed ---------- */
  const toEmbed = url => 'https://www.figma.com/embed?embed_host=share&url=' + encodeURIComponent(url);
  const isFigma = url => /^https:\/\/([\w-]+\.)?figma\.com\/(file|design|proto|board|deck|slides)\//.test(url.trim());
  $$('.figma').forEach(box => {
    const mount = url => {
      box.innerHTML = `<iframe title="${box.dataset.title || 'Figma file'}" src="${toEmbed(url)}" loading="lazy" allowfullscreen></iframe>`;
      const open = document.getElementById(box.id + '-open');
      if (open) { open.href = url; open.hidden = false; }
    };
    const url = (box.dataset.figma || '').trim();
    if (url) { mount(url); return; }
    const form = $('form', box), input = $('input', box), err = $('.figma-err', box);
    form?.addEventListener('submit', e => {
      e.preventDefault();
      if (!isFigma(input.value)) { err.textContent = 'That doesn’t look like a Figma link. Copy it from Share → Copy link in Figma.'; input.focus(); return; }
      mount(input.value.trim());
    });
    input?.addEventListener('input', () => { if (err.textContent) err.textContent = ''; });
  });

  /* ---------- Copy email ---------- */
  $$('[data-copy]').forEach(btn => btn.addEventListener('click', () => {
    const out = document.getElementById(btn.dataset.status);
    const say = m => { if (out) { out.textContent = m; setTimeout(() => out.textContent = '', 2500); } };
    try { navigator.clipboard.writeText(btn.dataset.copy).then(() => say('Copied'), () => say(btn.dataset.copy)); }
    catch (e) { say(btn.dataset.copy); }
  }));

  /* ---------- Contact form ---------- */
  const form = $('#contact-form');
  if (form) {
    const rules = {
      name: v => v.trim() ? '' : 'Enter your name so I know who to reply to.',
      email: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Enter an email like name@company.com.',
      message: v => v.trim().length >= 10 ? '' : 'Add a little more detail (at least 10 characters).'
    };
    const check = el => {
      const msg = rules[el.name](el.value), f = el.closest('.field');
      f.classList.toggle('invalid', !!msg); el.setAttribute('aria-invalid', !!msg); $('.err', f).textContent = msg; return !msg;
    };
    Object.keys(rules).forEach(n => {
      const el = form.elements[n];
      el.addEventListener('blur', () => { if (el.value) check(el); });
      el.addEventListener('input', () => { if (el.closest('.field').classList.contains('invalid')) check(el); });
    });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const bad = Object.keys(rules).map(n => form.elements[n]).filter(el => !check(el));
      if (bad.length) { bad[0].focus(); return; }
      const d = Object.fromEntries(new FormData(form));
      // Swap this for a form service (e.g. Formspree) when the site is live.
      location.href = `mailto:sahilpawar.2050@gmail.com?subject=${encodeURIComponent('Portfolio enquiry from ' + d.name)}&body=${encodeURIComponent(d.message + '\n\n— ' + d.name + '\n' + d.email)}`;
      const s = $('#form-status'); s.hidden = false; s.focus();
    });
  }

  /* ---------- Back to top + year ---------- */
  $$('[data-top]').forEach(b => b.addEventListener('click', () => scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })));
  $$('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
})();
