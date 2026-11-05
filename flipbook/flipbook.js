/*
 * Portfolio flipbook — a 3D page-turning reader for one PDF.
 *
 * Embed anywhere:
 *   <div data-flipbook data-pdf="portfolio/portfolio.pdf" data-title="Portfolio"></div>
 *   <link rel="stylesheet" href="flipbook/flipbook.css">
 *   <script type="module" src="flipbook/flipbook.js"></script>
 *
 * Replace the PDF at PDF_URL (or the data-pdf path) and the book updates on the next deploy.
 * Built on PDF.js (rendering) and StPageFlip (page turning), both bundled in ./vendor.
 */

export const PDF_URL = 'portfolio/portfolio.pdf';

const BASE = new URL('.', import.meta.url);
const vendor = f => new URL('vendor/' + f, BASE).href;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FLIP_MS = REDUCED ? 250 : 800;
const MAX_CANVAS_PX = 2600;          // longest canvas side, caps memory per page
const KEEP_RANGE = 6;                // pages kept rendered either side of the current spread
const ZOOMS = [1, 1.5, 2, 3];

/* ---------- lucide icons (inline, stroke 1.5) ---------- */
const svg = p => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const I = {
  prev: svg('<path d="m15 18-6-6 6-6"/>'),
  next: svg('<path d="m9 18 6-6-6-6"/>'),
  zin: svg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/>'),
  zout: svg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6"/>'),
  reset: svg('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'),
  full: svg('<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>'),
  exit: svg('<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>'),
  down: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>'),
  close: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  book: svg('<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>'),
};

/* ---------- loaders (lazy, shared) ---------- */
let pdfjsP, flipP;
const loadPdfjs = () => pdfjsP ||= import(vendor('pdf.min.js')).then(m => {
  m.GlobalWorkerOptions.workerSrc = vendor('pdf.worker.min.js');
  return m;
});
const loadPageFlip = () => flipP ||= window.St?.PageFlip ? Promise.resolve(window.St.PageFlip) : new Promise((res, rej) => {
  const s = document.createElement('script');
  s.src = vendor('page-flip.browser.js');
  s.onload = () => res(window.St.PageFlip);
  s.onerror = () => rej(new Error('page-flip failed to load'));
  document.head.appendChild(s);
});

/* usePDFDocument equivalent: one load per URL, shared by preview and reader */
const docs = new Map();
function loadDocument(url) {
  if (!docs.has(url)) {
    docs.set(url, loadPdfjs().then(async pdfjs => {
      const doc = await pdfjs.getDocument({ url, isEvalSupported: false }).promise;
      const first = await doc.getPage(1);
      const vp = first.getViewport({ scale: 1 });
      return { doc, pages: doc.numPages, ratio: vp.width / vp.height };
    }).catch(err => { docs.delete(url); throw err; }));
  }
  return docs.get(url);
}

/* Draw one PDF page into a canvas of the book's page ratio, letterboxed, never stretched. */
async function drawPage(doc, index, canvas, cssW, ratio, quality, slot) {
  const page = await doc.getPage(index + 1);
  const dpr = Math.min(devicePixelRatio || 1, 2);
  let w = Math.round(cssW * dpr * quality), h = Math.round(w / ratio);
  const k = Math.min(1, MAX_CANVAS_PX / Math.max(w, h));
  w = Math.round(w * k); h = Math.round(h * k);
  const vp1 = page.getViewport({ scale: 1 });
  const s = Math.min(w / vp1.width, h / vp1.height);
  const vp = page.getViewport({ scale: s });
  // draw into an offscreen canvas, then swap in, so a turning page never shows a blank frame
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const ctx = off.getContext('2d', { alpha: false });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  const task = page.render({ canvasContext: ctx, viewport: vp, transform: [1, 0, 0, 1, (w - vp.width) / 2, (h - vp.height) / 2] });
  slot.task = task;
  await task.promise;
  slot.task = null;
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d', { alpha: false }).drawImage(off, 0, 0);
  off.width = off.height = 0;
  page.cleanup();
}

/* ---------- Reader (overlay) ---------- */
class Reader {
  constructor(opts) {
    this.url = opts.pdf; this.title = opts.title; this.download = opts.download;
    this.opener = document.activeElement;
    this.zoom = 1; this.tx = 0; this.ty = 0;
    this.slots = [];          // per page: { canvas, q, task, busy }
    this.build();
    this.open();
  }

  build() {
    const o = this.el = document.createElement('div');
    o.className = 'pfb-overlay';
    o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true');
    o.setAttribute('aria-label', `${this.title}, flip book`);
    o.tabIndex = -1;
    o.innerHTML = `
      <div class="pfb-stage"><div class="pfb-pan"><div class="pfb-book"><div class="pfb-shadow" aria-hidden="true"></div><div class="pfb-host"></div></div></div>
        <p class="pfb-status" role="status">Opening the book…</p></div>
      <div class="pfb-bar" role="toolbar" aria-label="Book controls">
        <button type="button" data-a="prev" aria-label="Previous page">${I.prev}</button>
        <span class="pfb-count" aria-live="polite">– / –</span>
        <button type="button" data-a="next" aria-label="Next page">${I.next}</button>
        <i class="pfb-sep" aria-hidden="true"></i>
        <button type="button" data-a="zout" aria-label="Zoom out">${I.zout}</button>
        <button type="button" data-a="reset" class="pfb-zoomlabel" aria-label="Reset zoom">100%</button>
        <button type="button" data-a="zin" aria-label="Zoom in">${I.zin}</button>
        <i class="pfb-sep" aria-hidden="true"></i>
        <button type="button" data-a="full" aria-label="Full screen">${I.full}</button>
        ${this.download ? `<a class="pfb-btn" href="${this.url}" download aria-label="Download PDF">${I.down}</a>` : ''}
        <button type="button" data-a="close" aria-label="Close book">${I.close}</button>
      </div>`;
    this.stage = o.querySelector('.pfb-stage');
    this.pan = o.querySelector('.pfb-pan');
    this.bookEl = o.querySelector('.pfb-book');
    this.host = o.querySelector('.pfb-host');
    this.status = o.querySelector('.pfb-status');
    this.count = o.querySelector('.pfb-count');
    this.zl = o.querySelector('.pfb-zoomlabel');

    o.querySelector('.pfb-bar').addEventListener('click', e => {
      const b = e.target.closest('button[data-a]'); if (!b) return;
      ({ prev: () => this.turn(-1), next: () => this.turn(1), zin: () => this.setZoom(1), zout: () => this.setZoom(-1),
         reset: () => this.setZoom(0), full: () => this.toggleFull(), close: () => this.close() })[b.dataset.a]();
    });
    // listens on the document while open, so keys work even if focus lands on <body>
    this.onKey = e => {
      this.wake();
      if (e.key === 'Escape') { if (document.fullscreenElement) return; e.preventDefault(); this.close(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); this.turn(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); this.turn(-1); }
      else if (e.key === 'Tab') this.trap(e);
      else if (![' ', 'Enter'].includes(e.key)) return;
      if (e.key !== ' ' && e.key !== 'Enter') e.stopPropagation();
    };
    // toolbar rests quietly when the reader is idle; any movement, touch or focus brings it back
    let idleT;
    this.wake = () => { o.classList.remove('is-idle'); clearTimeout(idleT); idleT = setTimeout(() => o.classList.add('is-idle'), 2600); };
    ['pointermove', 'pointerdown', 'keydown', 'focusin'].forEach(ev => o.addEventListener(ev, this.wake, { passive: true }));
    // panning while zoomed
    let drag = null;
    this.stage.addEventListener('pointerdown', e => {
      if (this.zoom === 1 || e.target.closest('.pfb-bar')) return;
      drag = { x: e.clientX - this.tx, y: e.clientY - this.ty }; this.stage.setPointerCapture(e.pointerId);
    });
    this.stage.addEventListener('pointermove', e => { if (drag) { this.tx = e.clientX - drag.x; this.ty = e.clientY - drag.y; this.applyZoom(); } });
    ['pointerup', 'pointercancel'].forEach(ev => this.stage.addEventListener(ev, () => { drag = null; }));
    this.stage.addEventListener('dblclick', e => { if (!e.target.closest('.pfb-bar')) this.setZoom(this.zoom === 1 ? 1 : 0); });
    this.onResize = () => { clearTimeout(this.rT); this.rT = setTimeout(() => this.layout(), 120); };
    this.onFs = () => {
      const fs = !!document.fullscreenElement;
      const b = o.querySelector('[data-a="full"]');
      b.innerHTML = fs ? I.exit : I.full; b.setAttribute('aria-label', fs ? 'Exit full screen' : 'Full screen');
      this.onResize();
    };
  }

  async open() {
    this.prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.appendChild(this.el);
    requestAnimationFrame(() => this.el.classList.add('is-open'));
    this.el.focus({ preventScroll: true });
    this.wake();
    addEventListener('resize', this.onResize);
    document.addEventListener('keydown', this.onKey, true);
    document.addEventListener('fullscreenchange', this.onFs);
    try {
      const [info, PageFlip] = await Promise.all([loadDocument(this.url), loadPageFlip()]);
      if (this.closed) return;
      this.info = info; this.PageFlip = PageFlip;
      this.slots = Array.from({ length: info.pages }, () => ({ canvas: Object.assign(document.createElement('canvas'), { className: 'pfb-canvas' }), q: 0, task: null }));
      this.status.hidden = true;
      this.layout(true);
    } catch (err) {
      this.status.textContent = /Missing|404/i.test(String(err && (err.name + err.message)))
        ? `The book isn't here yet. Add your PDF at ${this.url}.` : 'This book could not be opened. Try the download instead.';
    }
  }

  /* Fit the book to the stage; rebuild the flip engine only when switching between spread and single page */
  layout(first = false) {
    if (!this.info || this.closed) return;
    const st = this.stage.getBoundingClientRect();
    const single = innerWidth < 768;
    const padX = single ? 16 : 64, padY = single ? 24 : 56;
    const availW = st.width - padX * 2, availH = st.height - padY * 2;
    const r = this.info.ratio;
    const w = Math.max(160, Math.floor(Math.min(availW, availH * (single ? r : 2 * r))));
    this.bookEl.style.width = w + 'px';
    this.pageW = single ? w : w / 2;
    if (first || single !== this.single) this.mount(single);
    else this.flip.update();
    this.queue();
  }

  mount(single) {
    const start = this.flip ? this.flip.getCurrentPageIndex() : 0;
    if (this.flip) { this.flip.off('flip'); this.flip.destroy(); }
    this.single = single;
    this.bookEl.querySelector('.pfb-host')?.remove();
    const host = document.createElement('div'); host.className = 'pfb-host';
    this.bookEl.appendChild(host); this.host = host;
    const n = this.info.pages;
    const pages = this.slots.map((s, i) => {
      const p = document.createElement('div');
      p.className = 'pfb-page' + (single ? '' : i === 0 ? '' : i % 2 ? ' --left' : ' --right');
      p.appendChild(s.canvas);
      host.appendChild(p);
      return p;
    });
    this.bookEl.classList.toggle('is-single', single);
    this.flip = new this.PageFlip(host, {
      width: 1000, height: Math.round(1000 / this.info.ratio), size: 'stretch',
      // single mode: a huge minWidth makes the engine always choose one page; spread mode never goes portrait
      minWidth: single ? 5000 : 50, maxWidth: 5000, minHeight: 50, maxHeight: 8000,
      autoSize: true, showCover: true, usePortrait: single, drawShadow: true, maxShadowOpacity: 0.25,
      flippingTime: FLIP_MS, mobileScrollSupport: false, swipeDistance: 30, showPageCorners: !single,
      startPage: Math.min(start, n - 1),
    });
    this.flip.loadFromHTML(pages);
    host.style.minWidth = '0'; host.style.minHeight = '0';   // the engine sets these from minWidth; the stage sizes the book instead
    this.flip.update();
    this.flip.on('flip', () => { this.sync(); this.queue(); });
    this.flip.on('changeState', e => this.el.classList.toggle('is-flipping', e.data !== 'read'));
    this.sync();
  }

  sync() {
    const i = this.flip.getCurrentPageIndex(), n = this.info.pages;
    let label = String(i + 1);
    if (!this.single && i > 0 && i < n - 1 && i % 2 === 1) label = `${i + 1}–${i + 2}`;
    this.count.textContent = `${label} / ${n}`;
    this.bookEl.classList.toggle('at-start', !this.single && i === 0);
    this.bookEl.classList.toggle('at-end', !this.single && i === n - 1 && n % 2 === 0);
    const prev = this.el.querySelector('[data-a="prev"]'), next = this.el.querySelector('[data-a="next"]');
    prev.disabled = i === 0;
    next.disabled = i >= n - 1 || (!this.single && i % 2 === 1 && i + 1 >= n - 1);
    if (document.activeElement?.disabled) (prev.disabled ? next : prev).focus({ preventScroll: true });
  }

  /* Render nearby pages first; drop far ones; cancel work that is no longer needed */
  queue() {
    if (!this.flip) return;
    const i = this.flip.getCurrentPageIndex(), n = this.info.pages;
    const q = Math.min(this.zoom, 3);
    const order = [0, 1, -1, 2, 3, -2, 4, 5].map(d => i + d).filter(k => k >= 0 && k < n);
    this.slots.forEach((s, k) => {
      if (Math.abs(k - i) > KEEP_RANGE) {
        if (s.task) { s.task.cancel(); s.task = null; }
        if (s.q) { s.canvas.width = s.canvas.height = 0; s.q = 0; }
      }
    });
    (async () => {
      for (const k of order) {
        const s = this.slots[k];
        const needQ = Math.abs(k - i) <= 1 ? q : 1;      // only the open spread renders at zoom quality
        if (this.closed) return;
        if (s.busy || (s.q >= needQ && s.w === Math.round(this.pageW))) continue;
        s.busy = true;
        try { await drawPage(this.info.doc, k, s.canvas, this.pageW, this.info.ratio, needQ, s); s.q = needQ; s.w = Math.round(this.pageW); }
        catch (e) { if (e && e.name !== 'RenderingCancelledException') console.warn('[flipbook]', e); }
        s.busy = false;
      }
    })();
  }

  turn(d) {
    if (!this.flip) return;
    if (this.zoom !== 1) this.setZoom(0);
    d > 0 ? this.flip.flipNext() : this.flip.flipPrev();
  }

  setZoom(step) {
    let idx = ZOOMS.indexOf(this.zoom);
    idx = step === 0 ? 0 : Math.max(0, Math.min(ZOOMS.length - 1, idx + step));
    this.zoom = ZOOMS[idx];
    if (this.zoom === 1) this.tx = this.ty = 0;
    this.applyZoom();
    this.zl.textContent = Math.round(this.zoom * 100) + '%';
    this.el.classList.toggle('is-zoomed', this.zoom > 1);
    clearTimeout(this.zT); this.zT = setTimeout(() => this.queue(), 200);
  }

  applyZoom() {
    const b = this.bookEl.getBoundingClientRect(), st = this.stage.getBoundingClientRect();
    const baseW = b.width / (this.curZ || 1), baseH = b.height / (this.curZ || 1);
    const mx = Math.max(0, (baseW * this.zoom - st.width) / 2 + 40), my = Math.max(0, (baseH * this.zoom - st.height) / 2 + 40);
    this.tx = Math.max(-mx, Math.min(mx, this.tx)); this.ty = Math.max(-my, Math.min(my, this.ty));
    this.curZ = this.zoom;
    this.pan.style.transform = `translate(${this.tx}px, ${this.ty}px) scale(${this.zoom})`;
  }

  toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else this.el.requestFullscreen?.().catch(() => {});
  }

  trap(e) {
    const f = [...this.el.querySelectorAll('button:not([disabled]), a[href]')];
    if (!f.length) return;
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    if (document.fullscreenElement) document.exitFullscreen?.();
    removeEventListener('resize', this.onResize);
    document.removeEventListener('keydown', this.onKey, true);
    document.removeEventListener('fullscreenchange', this.onFs);
    this.slots.forEach(s => { if (s.task) s.task.cancel(); });
    this.el.classList.remove('is-open');
    const done = () => {
      if (this.flip) { this.flip.off('flip'); this.flip.destroy(); this.flip = null; }
      this.slots.forEach(s => { s.canvas.width = s.canvas.height = 0; });
      this.el.remove();
      document.documentElement.style.overflow = this.prevOverflow;
      this.opener?.focus?.({ preventScroll: true });
    };
    REDUCED ? done() : setTimeout(done, 320);
  }
}

/* ---------- Inline preview ---------- */
function preview(el) {
  const url = el.dataset.pdf || PDF_URL;
  const title = el.dataset.title || 'Portfolio';
  const download = el.dataset.download !== 'false';
  const fallback = el.dataset.fallback;   // optional: where to send readers while the PDF isn't uploaded
  el.classList.add('pfb');
  el.innerHTML = `
    <button type="button" class="pfb-cover" aria-label="Open ${title} as a flip book">
      <span class="pfb-cover-book"><canvas class="pfb-cover-canvas" aria-hidden="true"></canvas><span class="pfb-cover-ph" aria-hidden="true">${I.book}</span></span>
    </button>
    <div class="pfb-meta">
      <p class="pfb-kicker">Flip book</p>
      <h3 class="pfb-title">${title}</h3>
      <p class="pfb-sub">Loading…</p>
      <div class="pfb-actions">
        <button type="button" class="pfb-open">Open the book</button>
        ${download ? `<a class="pfb-dl" href="${url}" download>Download PDF</a>` : ''}
      </div>
    </div>`;
  const sub = el.querySelector('.pfb-sub');
  const openR = () => new Reader({ pdf: url, title, download });
  el.querySelector('.pfb-open').addEventListener('click', openR);
  el.querySelector('.pfb-cover').addEventListener('click', openR);

  const io = new IntersectionObserver(async ents => {
    if (!ents.some(e => e.isIntersecting)) return;
    io.disconnect();
    try {
      const info = await loadDocument(url);
      sub.textContent = `${info.pages} pages · drag a corner or use the arrow keys to turn`;
      const c = el.querySelector('.pfb-cover-canvas');
      const book = el.querySelector('.pfb-cover-book');
      book.style.aspectRatio = String(info.ratio);
      await drawPage(info.doc, 0, c, book.clientWidth || 280, info.ratio, 1, {});
      el.classList.add('is-ready');
    } catch (err) {
      el.classList.add('is-empty');
      const missing = /Missing|404/i.test(String(err && (err.name + err.message)));
      if (missing) console.info(`[flipbook] No PDF at ${url} yet. Upload it there and this book appears.`);
      el.querySelectorAll('.pfb-open, .pfb-dl, .pfb-cover').forEach(b => { b.disabled = true; b.hidden = b.tagName === 'A'; });
      if (fallback) {
        sub.textContent = 'Read the full book online.';
        el.querySelector('.pfb-open').hidden = true;
        el.querySelector('.pfb-actions').insertAdjacentHTML('afterbegin', `<a class="pfb-open" href="${fallback}" target="_blank" rel="noopener">Read the book ↗</a>`);
        if (el.dataset.cover) {   // show the project's cover image while the PDF isn't uploaded
          const book = el.querySelector('.pfb-cover-book');
          book.insertAdjacentHTML('afterbegin', `<img class="pfb-cover-img" src="${el.dataset.cover}" alt="">`);
          el.classList.add('has-cover');
          const cv = el.querySelector('.pfb-cover'); cv.disabled = false;
          cv.addEventListener('click', e => { e.stopImmediatePropagation(); open(fallback, '_blank', 'noopener'); }, true);
        }
      } else {
        sub.textContent = missing ? 'This book is coming soon.' : 'The book could not be loaded right now.';
        el.querySelector('.pfb-open').hidden = true;
      }
    }
  }, { rootMargin: '400px' });
  io.observe(el);
}

document.querySelectorAll('[data-flipbook]').forEach(preview);
