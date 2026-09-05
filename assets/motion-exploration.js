/* Prototype local sans dependance. Le defilement natif et les lecteurs restent intacts. */
(() => {
  'use strict';
  if (new URLSearchParams(location.search).get('explore') !== '1') return;
  const root = document.getElementById('root');
  if (!root || !window.IntersectionObserver || !window.ResizeObserver) return;
  const html = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const surfaces = new Map(), visible = new Set(), revealed = new WeakSet(), grids = new Set(), animations = new Set();
  const pendingReveals = new Set(), summaries = new Set(), panels = new Map(), activePanels = new Set();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let mode = 'balanced', enabled = !reduced.matches, raf = 0, refreshRaf = 0;
  let lastY = scrollY, lastScrollTime = performance.now(), velocity = 0, targetVelocity = 0, hover = null;
  let lastFrame = 0, backdropSource = null;

  const atmosphere = document.createElement('canvas');
  atmosphere.className = 'kp-atmosphere';
  atmosphere.setAttribute('aria-hidden', 'true');
  atmosphere.width = 128; atmosphere.height = 80;
  document.body.insertBefore(atmosphere, root);
  const atmosphereContext = atmosphere.getContext('2d');
  const panel = document.createElement('details');
  panel.className = 'kp-exploration-panel';
  panel.innerHTML = '<summary>Exploration 01 · <span>Équilibrée</span></summary><div class="kp-exploration-options"><button type="button" data-mode="off" aria-pressed="false">Actuel</button><button type="button" data-mode="balanced" aria-pressed="true">Équilibré</button><button type="button" data-mode="expressive" aria-pressed="false">Expressif</button><label><input type="checkbox" checked> Halo des images</label><p class="kp-exploration-note">Comparer les versions sur toutes les pages. Palette et typographie inchangées.</p></div>';
  document.body.append(panel);
  panel.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
    mode = button.dataset.mode;
    panel.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    panel.querySelector('summary span').textContent = { off: 'Version actuelle', balanced: 'Équilibrée', expressive: 'Expressive' }[mode];
    applyMode();
  }));
  panel.querySelector('input').addEventListener('change', event => {
    html.dataset.kpHalo = event.target.checked ? 'on' : 'off';
  });
  html.dataset.kpHalo = 'on';

  function applyMode() {
    enabled = mode !== 'off' && !reduced.matches;
    html.dataset.kpExplore = mode === 'off' ? 'off' : 'on';
    html.dataset.kpMotion = enabled ? 'on' : 'off';
    if (!enabled) {
      animations.forEach(animation => animation.cancel()); animations.clear();
      root.querySelectorAll('.kp-reveal-pending').forEach(el => el.classList.remove('kp-reveal-pending'));
      surfaces.forEach(s => { s.x = s.y = s.tx = s.ty = 0; });
      panels.forEach(resetPanel);
      velocity = targetVelocity = 0;
    }
    grids.forEach(layoutGallery);
    schedule();
  }
  reduced.addEventListener('change', applyMode);
  finePointer.addEventListener('change', () => { panels.forEach(resetPanel); schedule(); });
  addEventListener('resize', () => panels.forEach(resetPanel), { passive: true });
  addEventListener('blur', () => panels.forEach(resetPanel));

  function resetPanel(p) {
    p.x = p.y = p.tx = p.ty = 0;
    p.el.removeAttribute('data-kp-tilting');
    p.el.style.removeProperty('--kp-panel-rx');
    p.el.style.removeProperty('--kp-panel-ry');
    activePanels.delete(p);
  }

  function registerPanel(el) {
    if (panels.has(el)) return;
    const events = new AbortController();
    const p = { el, events, x: 0, y: 0, tx: 0, ty: 0, bounds: null,
      amount: el.closest('.clients-track,.clients-grid') ? 5 : 2.4 };
    panels.set(el, p); el.classList.add('kp-panel-depth');
    const options = { passive: true, signal: events.signal };
    el.addEventListener('pointerenter', () => { p.bounds = el.getBoundingClientRect(); }, options);
    el.addEventListener('pointermove', event => {
      if (!enabled || !finePointer.matches || event.pointerType !== 'mouse' || el.querySelector('input:focus,textarea:focus,select:focus,[contenteditable]:focus')) return;
      const r = p.bounds || el.getBoundingClientRect();
      p.tx = clamp((event.clientX - r.left) / r.width - .5, -.5, .5);
      p.ty = clamp((event.clientY - r.top) / r.height - .5, -.5, .5);
      activePanels.add(p); schedule();
    }, options);
    const settle = () => { p.tx = p.ty = 0; p.bounds = null; activePanels.add(p); schedule(); };
    el.addEventListener('pointerleave', settle, options);
    el.addEventListener('pointercancel', settle, options);
    el.addEventListener('focusin', () => resetPanel(p), options);
  }

  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      pendingReveals.delete(el);
      revealObserver.unobserve(el);
      el.classList.remove('kp-reveal-pending');
      if (!enabled) return;
      const animation = el.animate([{ opacity: 0, transform: 'translateY(22px)' }, { opacity: 1, transform: 'translateY(0)' }], {
        duration: 650, easing: 'cubic-bezier(.2,.7,.2,1)'
      });
      animations.add(animation); animation.onfinish = () => animations.delete(animation);
    });
  }, { rootMargin: '0px 0px -5% 0px', threshold: 0.06 });

  const surfaceObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const s = surfaces.get(entry.target);
      if (!s) return;
      if (entry.isIntersecting) { visible.add(s); loadSurface(s); }
      else { visible.delete(s); s.canvas.width = s.canvas.height = 1; s.canvas.dataset.ready = 'false'; }
    });
    schedule();
  }, { rootMargin: '80px' });

  const resizeObserver = new ResizeObserver(() => {
    grids.forEach(layoutGallery);
    visible.forEach(s => { s.dirty = true; });
    schedule();
  });

  function layoutGallery(grid) {
    if (!grid.isConnected) { grids.delete(grid); resizeObserver.unobserve(grid); return; }
    const tiles = [...grid.querySelectorAll(':scope > .project-media-tile')];
    const n = tiles.length;
    const feature = n === 3 || n >= 5;
    const tail = feature ? n - 3 : n;
    tiles.forEach((tile, i) => {
      let span = n === 1 ? 6 : n === 2 || n === 4 ? 3 : 2, rows = 1;
      if (feature && i === 0) { span = 4; rows = 2; }
      else if (feature && i >= 3) {
        // Rangees completes, dans l'ordre : triples, puis une paire si necessaire.
        const rest = tail % 3;
        span = rest === 1 ? (i >= n - 4 ? 3 : 2) : rest === 2 && i >= n - 2 ? 3 : 2;
        if (tail === 1) span = 6;
      }
      tile.style.setProperty('--kp-span', span);
      tile.style.setProperty('--kp-rows', rows);
    });
    const summary = grid.closest('.project-hero-grid')?.querySelector('.project-summary');
    const column = grid.parentElement;
    const player = column.querySelector('iframe');
    const playerHeight = player ? player.parentElement.offsetHeight + 12 : 0;
    grid.style.setProperty('--kp-row', clamp(grid.clientWidth / 3 * 9 / 16, 110, 210).toFixed(1) + 'px');
    grid.style.setProperty('--kp-gallery-height', innerWidth > 1024 && summary ? Math.max(0, summary.offsetHeight - playerHeight) + 'px' : '0px');
  }

  function sourceFor(el) {
    if (el.matches(':disabled,.thumb-locked')) return null;
    const img = el.querySelector('img:not([hidden])');
    if (img) return img.currentSrc || img.src;
    return getComputedStyle(el).backgroundImage.match(/url\(["']?([^"')]+)["']?\)/)?.[1] || null;
  }

  function loadSurface(s) {
    const src = sourceFor(s.el);
    if (s.src === src) return;
    s.src = src;
    s.image = null; s.canvas.dataset.ready = 'false';
    if (!src) return;
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.onload = () => { if (s.src !== src || !s.el.isConnected) return; s.image = img; s.dirty = true; schedule(); };
    img.onerror = () => { s.canvas.dataset.ready = 'false'; };
    // Affichage uniquement : aucun export ni lecture de pixels des medias proteges.
    img.src = src;
  }

  function registerSurface(el) {
    if (surfaces.has(el)) { if (visible.has(surfaces.get(el))) loadSurface(surfaces.get(el)); return; }
    if (el.classList.contains('thumb-locked') || !sourceFor(el)) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'kp-warp-canvas'; canvas.setAttribute('aria-hidden', 'true');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    const events = new AbortController();
    const options = { passive: true, signal: events.signal };
    const s = { el, canvas, ctx, events, x: 0, y: 0, tx: 0, ty: 0, dirty: true };
    surfaces.set(el, s);
    el.classList.add('kp-surface'); el.append(canvas);
    el.addEventListener('pointermove', event => {
      if (!enabled || !finePointer.matches) return;
      const r = el.getBoundingClientRect();
      s.tx = clamp((event.clientX - r.left) / r.width - .5, -.5, .5);
      s.ty = clamp((event.clientY - r.top) / r.height - .5, -.5, .5);
      hover = s; schedule();
    }, options);
    el.addEventListener('pointerleave', () => { s.tx = s.ty = 0; if (hover === s) hover = null; schedule(); }, options);
    el.addEventListener('focusin', () => { hover = s; schedule(); }, options);
    el.addEventListener('focusout', () => { if (hover === s) hover = null; schedule(); }, options);
    el.querySelector('img')?.addEventListener('error', () => { s.src = null; loadSurface(s); }, options);
    surfaceObserver.observe(el); resizeObserver.observe(el);
  }

  function draw(s, r, strength) {
    if (!s.image) return;
    const w = s.el.clientWidth, h = s.el.classList.contains('about-profile-figure') ? s.el.querySelector('img').clientHeight : s.el.clientHeight;
    if (s.el.classList.contains('about-profile-figure')) s.canvas.style.height = h + 'px';
    if (w < 1 || h < 1) return;
    const dpr = Math.min(devicePixelRatio || 1, 1.5, 1200 / w);
    const cw = Math.round(w * dpr), ch = Math.round(h * dpr);
    if (s.canvas.width !== cw || s.canvas.height !== ch) { s.canvas.width = cw; s.canvas.height = ch; }
    const ctx = s.ctx, img = s.image;
    const bleed = Math.min(28, Math.min(w, h) * .075) * strength;
    const scale = Math.max((w + bleed * 2) / img.width, (h + bleed * 2) / img.height);
    const sw = w / scale, sh = (h + bleed * 2) / scale;
    const sx = (img.width - sw) / 2 + s.x * bleed / scale;
    const sy = (img.height - sh) / 2;
    const bend = velocity * bleed * .55;
    const drift = clamp((r.top + h / 2 - innerHeight / 2) / innerHeight, -1, 1) * bleed * .22;
    // Les dimensions arrondies du bitmap couvrent exactement le cadre CSS.
    ctx.setTransform(cw / w, 0, 0, ch / h, 0, 0);
    // 24 bandes dessinent une courbure legere, sans WebGL ni boucle au repos.
    const strips = finePointer.matches ? 24 : 12;
    for (let i = 0; i < strips; i++) {
      const x = i / strips, width = w / strips;
      const curve = Math.sin(x * Math.PI) * bend;
      const stripWidth = Math.min(width + 1 / dpr, w - x * w);
      ctx.drawImage(img, sx + x * sw, sy, stripWidth / scale, sh, x * w, -bleed + curve + drift + s.y * bleed * .3, stripWidth, h + bleed * 2);
    }
    s.canvas.dataset.ready = 'true';
    s.el.style.setProperty('--kp-rx', (-s.y * 5 * strength).toFixed(2) + 'deg');
    s.el.style.setProperty('--kp-ry', (s.x * 5 * strength).toFixed(2) + 'deg');
    // Debord calcule : meme en perspective, aucun bord du calque ne rentre dans le cadre.
    const ax = Math.abs(s.y * 5 * strength) * Math.PI / 180;
    const ay = Math.abs(s.x * 5 * strength) * Math.PI / 180;
    const depth = (w * Math.sin(ay) + h * Math.sin(ax)) / 2;
    const overscan = 1.006 / (Math.cos(Math.max(ax, ay)) * (1 - Math.min(depth, 250) / 1000));
    s.el.style.setProperty('--kp-edge-scale', Math.max(1.045, overscan).toFixed(4));
    s.dirty = false;
  }

  function schedule() { if (!raf && enabled && !document.hidden) raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0;
    if (!enabled || document.hidden) return;
    const elapsed = Math.min(40, now - (lastFrame || now - 16)); lastFrame = now;
    const lerp = 1 - Math.exp(-elapsed / 95);
    if (now - lastScrollTime > 70) targetVelocity *= .78;
    velocity += (targetVelocity - velocity) * lerp;
    const strength = (mode === 'expressive' ? 1.65 : 1) * (finePointer.matches ? 1 : .5);
    let moving = Math.abs(velocity) > .008, candidate = hover, nearest = Infinity;
    activePanels.forEach(p => {
      if (!p.el.isConnected || p.el.hidden || !finePointer.matches) { resetPanel(p); return; }
      p.x += (p.tx - p.x) * lerp; p.y += (p.ty - p.y) * lerp;
      if (Math.abs(p.tx - p.x) + Math.abs(p.ty - p.y) < .002) {
        p.x = p.tx; p.y = p.ty; activePanels.delete(p);
        if (!p.x && !p.y) { resetPanel(p); return; }
      } else moving = true;
      p.el.dataset.kpTilting = 'true';
      p.el.style.setProperty('--kp-panel-rx', (-p.y * p.amount).toFixed(3) + 'deg');
      p.el.style.setProperty('--kp-panel-ry', (p.x * p.amount).toFixed(3) + 'deg');
    });
    visible.forEach(s => {
      if (!s.el.isConnected) return;
      const r = s.el.getBoundingClientRect();
      s.x += (s.tx - s.x) * lerp; s.y += (s.ty - s.y) * lerp;
      moving ||= Math.abs(s.tx - s.x) + Math.abs(s.ty - s.y) > .002;
      draw(s, r, strength);
      const distance = Math.abs(r.top + r.height / 2 - innerHeight / 2);
      if (!hover && distance < nearest && r.bottom > 0 && r.top < innerHeight) { candidate = s; nearest = distance; }
    });
    if (candidate?.image && atmosphereContext) {
      if (backdropSource !== candidate.image) {
        atmosphereContext.drawImage(candidate.image, 0, 0, 128, 80);
        backdropSource = candidate.image;
      }
      atmosphere.dataset.visible = 'true';
      atmosphere.style.setProperty('--kp-halo-x', (candidate.x * 18).toFixed(1) + 'px');
      atmosphere.style.setProperty('--kp-halo-y', (candidate.y * 18).toFixed(1) + 'px');
    } else atmosphere.dataset.visible = 'false';
    if (moving) schedule();
  }

  function refresh() {
    refreshRaf = 0;
    pendingReveals.forEach(el => { if (!el.isConnected) { revealObserver.unobserve(el); pendingReveals.delete(el); } });
    summaries.forEach(el => { if (!el.isConnected) { resizeObserver.unobserve(el); summaries.delete(el); } });
    surfaces.forEach((s, el) => {
      if (el.isConnected && sourceFor(el)) return;
      surfaceObserver.unobserve(el); resizeObserver.unobserve(el); visible.delete(s); surfaces.delete(el);
      s.events.abort(); s.canvas.remove(); el.classList.remove('kp-surface');
      ['--kp-rx','--kp-ry','--kp-edge-scale'].forEach(name => el.style.removeProperty(name));
      if (hover === s) hover = null;
    });
    panels.forEach((p, el) => {
      if (!el.isConnected) { resetPanel(p); p.events.abort(); panels.delete(el); }
      else if (el.hidden) resetPanel(p);
    });
    document.querySelectorAll('.clients-track>div[title],.clients-grid>li>div[title],.modal-backdrop>div:not([aria-hidden]),.modal-backdrop>img,[role="dialog"]:not(.modal-backdrop),dialog,.project-gate-panel').forEach(registerPanel);
    root.querySelectorAll('.project-media-grid').forEach(grid => {
      if (!grids.has(grid)) { grids.add(grid); resizeObserver.observe(grid); const summary = grid.closest('.project-hero-grid')?.querySelector('.project-summary'); if (summary) { summaries.add(summary); resizeObserver.observe(summary); } }
      layoutGallery(grid);
    });
    root.querySelectorAll('.project-media-tile:not(:disabled),.project-grid .thumb,.about-profile-figure').forEach(registerSurface);
    root.querySelectorAll('h1,h2,h3,p,.project-details-grid>div>div:first-child').forEach(el => {
      if (revealed.has(el) || el.closest('.hero,.exp-timeline,form,.modal-backdrop,.project-gate,footer')) return;
      revealed.add(el);
      if (enabled) {
        if (el.getBoundingClientRect().top > innerHeight * .85) el.classList.add('kp-reveal-pending');
        pendingReveals.add(el); revealObserver.observe(el);
      }
    });
    schedule();
  }
  new MutationObserver(records => {
    if (records.some(record => record.type !== 'childList' || [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType !== 1 || !node.classList.contains('kp-warp-canvas'))) && !refreshRaf) refreshRaf = requestAnimationFrame(refresh);
  }).observe(document.body, { childList: true, characterData: true, attributes: true, attributeFilter: ['src', 'hidden', 'disabled'], subtree: true });
  addEventListener('scroll', () => {
    const now = performance.now();
    targetVelocity = clamp((scrollY - lastY) / Math.max(16, now - lastScrollTime) / 2, -1, 1);
    lastY = scrollY; lastScrollTime = now; schedule();
  }, { passive: true });
  addEventListener('hashchange', () => { hover = null; backdropSource = null; atmosphere.dataset.visible = 'false'; lastY = scrollY; velocity = targetVelocity = 0; if (!refreshRaf) refreshRaf = requestAnimationFrame(refresh); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; panels.forEach(resetPanel); } else schedule(); });
  document.addEventListener('focusin', event => event.target.closest('.kp-reveal-pending')?.classList.remove('kp-reveal-pending'));
  applyMode(); refresh();
})();
