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
  } else ready();

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
